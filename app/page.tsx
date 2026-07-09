'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  formatBytes,
  detectFakeTransparencyBackground,
  getImageDpi,
  getColourProfile,
  detectBoundsAndCoverage,
  estimateThinLines,
  getEffectiveArtBounds,
  getDesignCanvasSize,
} from './lib/podCheckerUtils';
import type { CheckStatus, ViewMode, PreviewSize, CheckItem } from './lib/podCheckerTypes';
import { redbubblePresets } from './lib/redbubblePresets';
import type { RedbubblePresetId } from './lib/redbubblePresets';
import { printfulPresets } from './lib/printfulPresets';
import type { PrintfulPresetId } from './lib/printfulPresets';
import {
  mergeSingleScanDisplayChecks,
  runSingleScanVisibleSummary,
  runSingleScanVisibleSummaryFromFixedOutput,
} from './lib/singleScanDisplay';

import DesignPreviewPanel, { type PreviewBackground } from './components/DesignPreviewPanel';

import IssueBucketsPanel from './components/IssueBucketsPanel';
import ScanResultsPanel from './components/ScanResultsPanel';
import ProductConverterPanel from './components/ProductConverterPanel';
import StartupTutorial, { shouldAutoOpenStartupTutorial } from './components/StartupTutorial';

type Bounds = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type ScanTimingSnapshot = {
  scanStart: number;
  fileReadMs: number;
  dpiProfileMs: number;
  decodeMs: number;
};

const isDevScannerTimingEnabled = () => process.env.NODE_ENV === 'development';

function formatTimingMs(ms: number): string {
  return `${Math.round(ms)} ms`;
}

function logScannerTiming(stages: Record<string, number>, totalMs: number) {
  if (!isDevScannerTimingEnabled()) return;

  console.group('POD Checker Scanner Timing');
  const tableRows = Object.entries(stages).map(([stage, ms]) => ({
    Stage: stage,
    Duration: formatTimingMs(ms),
  }));
  console.table(tableRows);
  console.log(`Total scan: ${formatTimingMs(totalMs)}`);
  console.groupEnd();
}

const CANVAS_W = 4200;
const CANVAS_H = 4800;
const CANVAS_ASPECT = CANVAS_W / CANVAS_H;
const TEEPUBLIC_ALL_PRODUCTS_W = 5000;
const TEEPUBLIC_ALL_PRODUCTS_H = 5500;

const SAFE_BORDER = 6;
const SAFE_BOX = 180;

const DEFAULT_PREVIEW_SIZE = 0.2;

const SHIRT_W = 1900;
const SHIRT_H = 2250;
const SHIRT_PRINT_X = 400;
const SHIRT_PRINT_Y = 420;
const SHIRT_PRINT_W = 800;
const SHIRT_PRINT_H = 1000;

// White Edge / Halo Risk: looks for near-white visible pixels that sit right next to
// transparent pixels. These often show as a white halo around artwork on dark shirts.
function getWhiteEdgeHaloCheck(imageData: ImageData): CheckItem {
  const { data, width, height } = imageData;
  let visiblePixels = 0;
  let whiteEdgePixels = 0;

  const alphaAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return 255;
    return data[(y * width + x) * 4 + 3];
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const a = data[idx + 3];
      // Ignore fully transparent pixels.
      if (a < 40) continue;
      visiblePixels++;

      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      // Near-white visible pixel.
      if (r >= 230 && g >= 230 && b >= 230 && a >= 120) {
        let nearTransparent = false;
        for (let dy = -2; dy <= 2 && !nearTransparent; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (alphaAt(x + dx, y + dy) < 40) {
              nearTransparent = true;
              break;
            }
          }
        }
        if (nearTransparent) whiteEdgePixels++;
      }
    }
  }

  const whiteEdgeRatio = visiblePixels === 0 ? 0 : whiteEdgePixels / visiblePixels;

  let status: CheckStatus = 'pass';
  let message = 'No obvious white edge or halo detected.';

  if (whiteEdgeRatio >= 0.012) {
    status = 'fail';
    message =
      'White edge or halo likely detected. Clean the design edges before uploading to dark shirts.';
  } else if (whiteEdgeRatio >= 0.003) {
    status = 'warn';
    message = 'Possible white edge detected. Check this design on dark shirts before upload.';
  }

  return {
    label: 'White Edge / Halo Risk',
    status,
    message,
  };
}

// Soft Transparency: counts partly transparent pixels (alpha between 20 and 220).
// Common in smooth edges, shadows, and vintage/distressed artwork.
function getSemiTransparencyRiskCheck(imageData: ImageData): CheckItem {
  const { data } = imageData;
  let transparentPixels = 0;
  let solidPixels = 0;
  let semiTransparentPixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 20) {
      transparentPixels++;
    } else if (a >= 220) {
      solidPixels++;
    } else {
      semiTransparentPixels++;
    }
  }

  const visiblePixels = solidPixels + semiTransparentPixels;
  const semiTransparentRatio = visiblePixels === 0 ? 0 : semiTransparentPixels / visiblePixels;

  let status: CheckStatus = 'pass';
  let message = 'No major soft transparency issue detected.';

  if (semiTransparentRatio >= 0.25) {
    status = 'warn';
    message =
      'Heavy soft transparency detected. Check the design preview on dark shirt colours.';
  } else if (semiTransparentRatio >= 0.03) {
    status = 'info';
    message =
      'Soft transparent pixels detected. Common in smooth edges, shadows, fades, and vintage artwork.';
  }

  return {
    label: 'Soft Transparency',
    status,
    message,
  };
}

// Stray Speck Check: only counts small blobs outside an expanded structural-artwork safe area.
// Safe area is built from the union of all connected components larger than maxSpeckPixels.
function detectStraySpecks(imageData: ImageData, thresholdAlpha = 40, maxSpeckPixels = 12): number {
  const { width, height, data } = imageData;
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const stack = new Int32Array(pixelCount);

  const dx8 = [-1, 1, 0, 0, -1, 1, -1, 1];
  const dy8 = [0, 0, -1, 1, -1, -1, 1, 1];

  const isSolidAt = (idx: number) => data[(idx << 2) + 3] > thresholdAlpha;

  type BlobStats = {
    size: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    touchesSafeArea: boolean;
  };

  const floodFill = (
    startIdx: number,
    markVisited: Uint8Array,
    trackSafeTouch: boolean,
    safeMinX: number,
    safeMinY: number,
    safeMaxX: number,
    safeMaxY: number,
  ): BlobStats => {
    let stackLen = 0;
    stack[stackLen++] = startIdx;
    let size = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let touchesSafeArea = false;

    while (stackLen > 0) {
      const idx = stack[--stackLen];
      size++;
      const x = idx % width;
      const y = (idx / width) | 0;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      if (
        trackSafeTouch &&
        x >= safeMinX &&
        x <= safeMaxX &&
        y >= safeMinY &&
        y <= safeMaxY
      ) {
        touchesSafeArea = true;
      }

      for (let d = 0; d < 8; d++) {
        const nx = x + dx8[d];
        const ny = y + dy8[d];
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (markVisited[ni]) continue;
        markVisited[ni] = 1;
        if (isSolidAt(ni)) stack[stackLen++] = ni;
      }
    }

    return { size, minX, minY, maxX, maxY, touchesSafeArea };
  };

  // Pass 1: union bounds of every structural component (larger than maxSpeckPixels).
  let hasStructural = false;
  let mainMinX = width;
  let mainMinY = height;
  let mainMaxX = -1;
  let mainMaxY = -1;

  for (let idx = 0; idx < pixelCount; idx++) {
    if (visited[idx]) continue;
    visited[idx] = 1;
    if (!isSolidAt(idx)) continue;

    const blob = floodFill(idx, visited, false, 0, 0, 0, 0);
    if (blob.size > maxSpeckPixels) {
      hasStructural = true;
      if (blob.minX < mainMinX) mainMinX = blob.minX;
      if (blob.minY < mainMinY) mainMinY = blob.minY;
      if (blob.maxX > mainMaxX) mainMaxX = blob.maxX;
      if (blob.maxY > mainMaxY) mainMaxY = blob.maxY;
    }
  }

  if (!hasStructural) return 0;

  const padding = Math.max(40, Math.round(width * 0.02), Math.round(height * 0.02));
  const safeMinX = Math.max(0, mainMinX - padding);
  const safeMinY = Math.max(0, mainMinY - padding);
  const safeMaxX = Math.min(width - 1, mainMaxX + padding);
  const safeMaxY = Math.min(height - 1, mainMaxY + padding);

  // Pass 2: count small blobs outside the expanded structural-artwork safe area only.
  visited.fill(0);
  let specks = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x >= safeMinX && x <= safeMaxX && y >= safeMinY && y <= safeMaxY) continue;

      const idx = y * width + x;
      if (visited[idx]) continue;
      visited[idx] = 1;
      if (!isSolidAt(idx)) continue;

      const blob = floodFill(idx, visited, true, safeMinX, safeMinY, safeMaxX, safeMaxY);
      if (blob.size <= maxSpeckPixels && !blob.touchesSafeArea) {
        specks++;
      }
    }
  }

  return specks;
}

type StraySpeckTestResult = {
  name: string;
  specks: number;
  expected: string;
};

function createStraySpeckTestImage(
  width: number,
  height: number,
  paint: (data: Uint8ClampedArray, x: number, y: number, i: number) => void,
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      paint(data, x, y, (y * width + x) * 4);
    }
  }
  return new ImageData(data, width, height);
}

function runStraySpeckDetectorTests(): StraySpeckTestResult[] {
  const solid = (data: Uint8ClampedArray, i: number) => {
    data[i] = 20;
    data[i + 1] = 20;
    data[i + 2] = 20;
    data[i + 3] = 255;
  };

  const tests: StraySpeckTestResult[] = [];

  const cleanArt = createStraySpeckTestImage(220, 220, (data, x, y, i) => {
    if (x >= 60 && x <= 160 && y >= 60 && y <= 160) solid(data, i);
  });
  tests.push({
    name: 'Clean artwork, no stray specks',
    specks: detectStraySpecks(cleanArt),
    expected: '0',
  });

  const oneSpeck = createStraySpeckTestImage(220, 220, (data, x, y, i) => {
    if (x >= 60 && x <= 160 && y >= 60 && y <= 160) solid(data, i);
    if (x === 8 && y === 8) solid(data, i);
  });
  tests.push({
    name: 'One isolated 1-pixel speck outside artwork',
    specks: detectStraySpecks(oneSpeck),
    expected: '1',
  });

  const manySpecks = createStraySpeckTestImage(220, 220, (data, x, y, i) => {
    if (x >= 60 && x <= 160 && y >= 60 && y <= 160) solid(data, i);
    if (x === 8 && y === 8) solid(data, i);
    if (x === 12 && y === 8) solid(data, i);
    if (x === 205 && y === 205) solid(data, i);
    if (x === 206 && y === 205) solid(data, i);
  });
  tests.push({
    name: 'Several isolated tiny specks outside artwork',
    specks: detectStraySpecks(manySpecks),
    expected: '3',
  });

  const connectedDetail = createStraySpeckTestImage(220, 220, (data, x, y, i) => {
    if (x >= 60 && x <= 160 && y >= 60 && y <= 160) solid(data, i);
    if (x === 161 && y >= 100 && y <= 104) solid(data, i);
  });
  tests.push({
    name: 'Tiny detail connected to main artwork',
    specks: detectStraySpecks(connectedDetail),
    expected: '0',
  });

  const distressedInside = createStraySpeckTestImage(220, 220, (data, x, y, i) => {
    if (x >= 60 && x <= 160 && y >= 60 && y <= 160) {
      if ((x + y) % 9 !== 0) solid(data, i);
    }
  });
  tests.push({
    name: 'Intentional distressed texture inside artwork',
    specks: detectStraySpecks(distressedInside),
    expected: '0',
  });

  const disconnectedLetters = createStraySpeckTestImage(300, 200, (data, x, y, i) => {
    if (x >= 40 && x <= 55 && y >= 80 && y <= 120) solid(data, i);
    if (x >= 200 && x <= 215 && y >= 80 && y <= 120) solid(data, i);
  });
  tests.push({
    name: 'Multiple disconnected letters',
    specks: detectStraySpecks(disconnectedLetters),
    expected: '0',
  });

  const starsNearDesign = createStraySpeckTestImage(220, 220, (data, x, y, i) => {
    if (x >= 60 && x <= 160 && y >= 60 && y <= 160) solid(data, i);
    if (x >= 162 && x <= 168 && y >= 100 && y <= 112) solid(data, i);
  });
  tests.push({
    name: 'Small stars near the main design',
    specks: detectStraySpecks(starsNearDesign),
    expected: '0',
  });

  const distressedWithStray = createStraySpeckTestImage(220, 220, (data, x, y, i) => {
    if (x >= 60 && x <= 160 && y >= 60 && y <= 160) {
      if ((x + y) % 9 !== 0) solid(data, i);
    }
    if (x === 5 && y === 5) solid(data, i);
  });
  tests.push({
    name: 'One real stray mark outside a distressed design',
    specks: detectStraySpecks(distressedWithStray),
    expected: '1',
  });

  return tests;
}

if (typeof window !== 'undefined' && isDevScannerTimingEnabled()) {
  (
    window as Window & { __runStraySpeckTests?: () => StraySpeckTestResult[] }
  ).__runStraySpeckTests = runStraySpeckDetectorTests;
}

// Cut-Off Edge Risk: looks for visible artwork sitting in a small band around the
// outside of the uploaded file. That often means the design is cropped too tight.
function getCutOffEdgeRiskCheck(imageData: ImageData): CheckItem {
  const { data, width, height } = imageData;
  const band = 8;
  let visiblePixels = 0;
  let edgeVisiblePixels = 0;
  let topTouched = false;
  let bottomTouched = false;
  let leftTouched = false;
  let rightTouched = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      // Ignore transparent pixels.
      if (a <= 40) continue;
      visiblePixels++;

      const inTop = y < band;
      const inBottom = y >= height - band;
      const inLeft = x < band;
      const inRight = x >= width - band;

      if (inTop || inBottom || inLeft || inRight) {
        edgeVisiblePixels++;
        if (inTop) topTouched = true;
        if (inBottom) bottomTouched = true;
        if (inLeft) leftTouched = true;
        if (inRight) rightTouched = true;
      }
    }
  }

  const touchedSides =
    (topTouched ? 1 : 0) +
    (bottomTouched ? 1 : 0) +
    (leftTouched ? 1 : 0) +
    (rightTouched ? 1 : 0);
  const edgeRatio = visiblePixels === 0 ? 0 : edgeVisiblePixels / visiblePixels;

  let status: CheckStatus = 'pass';
  let message = 'No obvious cut-off edge detected.';

  if (edgeRatio >= 0.01 || touchedSides >= 3) {
    status = 'fail';
    message = 'Cut-off edge likely detected. The design may be cropped too tight before upload.';
  } else if (edgeRatio >= 0.001 || touchedSides >= 1) {
    status = 'warn';
    message = 'Possible cut-off edge detected. Artwork touches the edge of the uploaded file.';
  }

  return {
    label: 'Cut-Off Edge Risk',
    status,
    message,
  };
}

// Low Contrast Risk: measures the brightness range of visible pixels. A small range
// means the artwork is low contrast and may print muddy, flat, or hard to read.
function getLowContrastRiskCheck(imageData: ImageData): CheckItem {
  const { data } = imageData;
  let visiblePixels = 0;
  let minBrightness = 255;
  let maxBrightness = 0;
  let totalBrightness = 0;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    // Ignore transparent pixels.
    if (a <= 40) continue;
    visiblePixels++;

    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (brightness < minBrightness) minBrightness = brightness;
    if (brightness > maxBrightness) maxBrightness = brightness;
    totalBrightness += brightness;
  }

  const contrastRange = visiblePixels === 0 ? 0 : maxBrightness - minBrightness;

  let status: CheckStatus = 'pass';
  let message = 'Artwork contrast looks healthy for print.';

  if (visiblePixels > 0 && contrastRange < 55) {
    status = 'fail';
    message = 'Low contrast likely detected. Artwork may print flat or hard to read.';
  } else if (visiblePixels > 0 && contrastRange < 95) {
    status = 'warn';
    message = 'Possible low contrast detected. Some details may look muddy when printed.';
  }

  return {
    label: 'Low Contrast Risk',
    status,
    message,
  };
}

// Tiny Text Risk: samples visible pixels and looks for small detailed clusters where
// solid and transparent pixels sit close together. Lots of these often mean tiny text
// or fine detail that may be hard to read when printed on POD products.
function getTinyTextRiskCheck(imageData: ImageData): CheckItem {
  const { data, width, height } = imageData;
  let visibleSampledPixels = 0;
  let tinyDetailHits = 0;

  const alphaAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return 0;
    return data[(y * width + x) * 4 + 3];
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const a = data[idx + 3];
      // Ignore transparent pixels.
      if (a <= 40) continue;

      // Sample every 6th pixel to keep this fast on large files.
      if ((x + y * width) % 6 !== 0) continue;
      visibleSampledPixels++;

      if (a > 120) {
        let hasSolid = false;
        let hasTransparent = false;
        // Check a 5x5 area around this pixel for both solid and transparent neighbours.
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const na = alphaAt(x + dx, y + dy);
            if (na > 120) hasSolid = true;
            else if (na <= 40) hasTransparent = true;
          }
        }
        if (hasSolid && hasTransparent) tinyDetailHits++;
      }
    }
  }

  const tinyDetailRatio = visibleSampledPixels === 0 ? 0 : tinyDetailHits / visibleSampledPixels;

  let status: CheckStatus = 'pass';
  let message = 'No obvious tiny text risk detected.';

  if (tinyDetailRatio >= 0.12) {
    status = 'fail';
    message = 'Tiny text risk likely detected. Enlarge small lettering before uploading.';
  } else if (tinyDetailRatio >= 0.04) {
    status = 'warn';
    message =
      'Possible tiny text risk detected. Small details may be hard to read when printed.';
  }

  return {
    label: 'Tiny Text Risk',
    status,
    message,
  };
}

// Compression Artifact Risk: samples visible pixels and looks for harsh colour jumps
// between neighbouring pixels (to the right and below). Lots of these often mean JPG
// compression noise, blockiness, or dirty pixels that can make POD prints look messy.
function getCompressionArtifactRiskCheck(imageData: ImageData): CheckItem {
  const { data, width, height } = imageData;
  let sampledVisiblePixels = 0;
  let harshChangeCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const a = data[idx + 3];
      // Ignore transparent pixels.
      if (a <= 40) continue;
      sampledVisiblePixels++;

      const r1 = data[idx];
      const g1 = data[idx + 1];
      const b1 = data[idx + 2];

      // Compare with the pixel to the right.
      if (x + 1 < width) {
        const ridx = (y * width + (x + 1)) * 4;
        if (data[ridx + 3] > 40) {
          const diff =
            Math.abs(r1 - data[ridx]) +
            Math.abs(g1 - data[ridx + 1]) +
            Math.abs(b1 - data[ridx + 2]);
          if (diff > 120) harshChangeCount++;
        }
      }

      // Compare with the pixel below.
      if (y + 1 < height) {
        const didx = ((y + 1) * width + x) * 4;
        if (data[didx + 3] > 40) {
          const diff =
            Math.abs(r1 - data[didx]) +
            Math.abs(g1 - data[didx + 1]) +
            Math.abs(b1 - data[didx + 2]);
          if (diff > 120) harshChangeCount++;
        }
      }
    }
  }

  const artifactRatio = sampledVisiblePixels === 0 ? 0 : harshChangeCount / sampledVisiblePixels;

  let status: CheckStatus = 'pass';
  let message = 'No obvious compression artifact risk detected.';

  if (artifactRatio >= 0.18) {
    status = 'fail';
    message = 'Heavy compression artifact risk detected. Use a cleaner PNG source before uploading.';
  } else if (artifactRatio >= 0.08) {
    status = 'warn';
    message =
      'Possible compression artifacts detected. Check for blocky edges or dirty pixels before upload.';
  }

  return {
    label: 'Compression Artifact Risk',
    status,
    message,
  };
}

// Empty Padding Risk: finds the visible artwork bounds (alpha > 40) and compares them to
// the full image size. If the artwork only fills a small part of the file, there is a lot
// of empty transparent space, which can make the design print too small or hard to place.
function getEmptyPaddingRiskCheck(imageData: ImageData): CheckItem {
  const { data, width, height } = imageData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      // Treat pixels with alpha > 40 as visible artwork.
      if (a <= 40) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  // No visible artwork found.
  if (maxX < 0 || maxY < 0) {
    return {
      label: 'Empty Padding Risk',
      status: 'info',
      message: 'Could not measure artwork bounds clearly.',
    };
  }

  const artworkWidth = maxX - minX + 1;
  const artworkHeight = maxY - minY + 1;
  const artworkWidthRatio = width === 0 ? 0 : artworkWidth / width;
  const artworkHeightRatio = height === 0 ? 0 : artworkHeight / height;

  let status: CheckStatus = 'fail';
  let message =
    'Heavy empty padding detected. Crop empty space or use Auto Fix before uploading.';

  if (artworkWidthRatio >= 0.55 || artworkHeightRatio >= 0.55) {
    status = 'pass';
    message = 'Artwork fills the uploaded file well. No major empty padding risk detected.';
  } else if (artworkWidthRatio >= 0.35 || artworkHeightRatio >= 0.35) {
    status = 'warn';
    message =
      'Some empty padding detected. Check that the artwork is not printing smaller than expected.';
  }

  return {
    label: 'Empty Padding Risk',
    status,
    message,
  };
}

// Pixelation Risk: samples visible pixels every 4px and compares each one to the pixel
// 4px to the right and 4px below. Lots of harsh blocky jumps can mean a pixelated or
// blocky source, while too many very flat areas can mean a blurry or low-detail image.
function getPixelationRiskCheck(imageData: ImageData): CheckItem {
  const { data, width, height } = imageData;
  let sampledVisiblePixels = 0;
  let flatHits = 0;
  let blockyHits = 0;

  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      const idx = (y * width + x) * 4;
      const a = data[idx + 3];
      // Ignore transparent pixels.
      if (a <= 40) continue;
      sampledVisiblePixels++;

      const r1 = data[idx];
      const g1 = data[idx + 1];
      const b1 = data[idx + 2];

      // Compare with the pixel 4px to the right.
      if (x + 4 < width) {
        const ridx = (y * width + (x + 4)) * 4;
        if (data[ridx + 3] > 40) {
          const diff =
            Math.abs(r1 - data[ridx]) +
            Math.abs(g1 - data[ridx + 1]) +
            Math.abs(b1 - data[ridx + 2]);
          if (diff < 8) flatHits++;
          else if (diff > 160) blockyHits++;
        }
      }

      // Compare with the pixel 4px below.
      if (y + 4 < height) {
        const didx = ((y + 4) * width + x) * 4;
        if (data[didx + 3] > 40) {
          const diff =
            Math.abs(r1 - data[didx]) +
            Math.abs(g1 - data[didx + 1]) +
            Math.abs(b1 - data[didx + 2]);
          if (diff < 8) flatHits++;
          else if (diff > 160) blockyHits++;
        }
      }
    }
  }

  const flatRatio = sampledVisiblePixels === 0 ? 0 : flatHits / sampledVisiblePixels;
  const blockyRatio = sampledVisiblePixels === 0 ? 0 : blockyHits / sampledVisiblePixels;

  let status: CheckStatus = 'pass';
  let message = 'No obvious pixelation or blur risk detected.';

  if (blockyRatio > 0.22) {
    status = 'fail';
    message = 'Pixelation risk likely detected. Use a cleaner or higher-quality source image.';
  } else if (blockyRatio > 0.12) {
    status = 'warn';
    message = 'Possible pixelation or blur detected. Check the design closely before upload.';
  } else if (flatRatio > 0.75) {
    status = 'warn';
    message = 'Possible pixelation or blur detected. Check the design closely before upload.';
  }

  return {
    label: 'Pixelation Risk',
    status,
    message,
  };
}

// Uneven Padding Risk: finds the visible artwork bounds (alpha > 40) and measures the
// empty space on each side. If one side has a lot more space than the opposite side,
// the artwork may be badly cropped or off balance.
function getUnevenPaddingRiskCheck(imageData: ImageData): CheckItem {
  const { data, width, height } = imageData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      // Treat pixels with alpha > 40 as visible artwork.
      if (a <= 40) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  // No visible artwork found.
  if (maxX < 0 || maxY < 0) {
    return {
      label: 'Uneven Padding Risk',
      status: 'info',
      message: 'Could not measure artwork bounds clearly.',
    };
  }

  const leftSpace = minX;
  const rightSpace = width - maxX - 1;
  const topSpace = minY;
  const bottomSpace = height - maxY - 1;

  const horizontalDifference = Math.abs(leftSpace - rightSpace);
  const verticalDifference = Math.abs(topSpace - bottomSpace);
  const horizontalDifferenceRatio = width === 0 ? 0 : horizontalDifference / width;
  const verticalDifferenceRatio = height === 0 ? 0 : verticalDifference / height;

  let status: CheckStatus = 'pass';
  let message = 'Padding looks balanced around the artwork.';

  if (horizontalDifferenceRatio >= 0.2 || verticalDifferenceRatio >= 0.2) {
    status = 'fail';
    message =
      'Heavy uneven padding detected. The uploaded file may be badly cropped or off balance.';
  } else if (horizontalDifferenceRatio >= 0.08 || verticalDifferenceRatio >= 0.08) {
    status = 'warn';
    message =
      'Uneven padding detected. Check that the artwork is cropped and centered correctly.';
  }

  return {
    label: 'Uneven Padding Risk',
    status,
    message,
  };
}

// Oversized Artwork Risk: finds the visible artwork bounds (alpha > 40) and compares them
// to the full image size. If the artwork fills almost the whole file, it may print too
// large, feel cramped, or leave too little breathing room.
function getOversizedArtworkRiskCheck(imageData: ImageData): CheckItem {
  const { data, width, height } = imageData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      // Treat pixels with alpha > 40 as visible artwork.
      if (a <= 40) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  // No visible artwork found.
  if (maxX < 0 || maxY < 0) {
    return {
      label: 'Artwork Near Canvas Edge',
      status: 'info',
      message: 'Could not measure artwork bounds clearly.',
    };
  }

  const artworkWidth = maxX - minX + 1;
  const artworkHeight = maxY - minY + 1;
  const artworkWidthRatio = width === 0 ? 0 : artworkWidth / width;
  const artworkHeightRatio = height === 0 ? 0 : artworkHeight / height;

  let status: CheckStatus = 'pass';
  let message = 'Artwork size looks balanced. No oversized artwork risk detected.';

  if (artworkWidthRatio >= 0.94 || artworkHeightRatio >= 0.94) {
    status = 'fail';
    message =
      'Artwork fills almost the whole uploaded file. Add more transparent space around it or reduce the artwork size.';
  } else if (artworkWidthRatio >= 0.82 || artworkHeightRatio >= 0.82) {
    status = 'warn';
    message =
      'Artwork may be filling too much of the uploaded file. Check that it has enough transparent space around it.';
  }

  return {
    label: 'Artwork Near Canvas Edge',
    status,
    message,
  };
}

// Solid Background Box Risk: looks for a solid rectangle/background baked into the image.
// It measures how transparent the whole image is, then checks the outer edge band: if the
// edge pixels are all close to one average colour and there is very little transparency,
// the design probably has a solid background box that may print as a visible rectangle.
function getSolidBackgroundBoxRiskCheck(imageData: ImageData): CheckItem {
  const { data, width, height } = imageData;

  // Whole-image transparency sampling.
  let totalSampledPixels = 0;
  let transparentPixels = 0;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 200));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      totalSampledPixels++;
      if (data[(y * width + x) * 4 + 3] < 40) transparentPixels++;
    }
  }

  // Edge band around the outside of the image (corners and outer edges).
  const band = Math.max(2, Math.floor(Math.min(width, height) * 0.04));
  const edgeStep = Math.max(1, Math.floor(Math.min(width, height) / 200));
  const isEdge = (x: number, y: number) =>
    x < band || y < band || x >= width - band || y >= height - band;

  let edgeCount = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  for (let y = 0; y < height; y += edgeStep) {
    for (let x = 0; x < width; x += edgeStep) {
      if (!isEdge(x, y)) continue;
      const idx = (y * width + x) * 4;
      sumR += data[idx];
      sumG += data[idx + 1];
      sumB += data[idx + 2];
      edgeCount++;
    }
  }

  // Not enough data to judge confidently.
  if (edgeCount === 0 || totalSampledPixels === 0) {
    return {
      label: 'Solid Background Box Risk',
      status: 'info',
      message: 'Could not measure the background edges clearly.',
    };
  }

  const avgR = sumR / edgeCount;
  const avgG = sumG / edgeCount;
  const avgB = sumB / edgeCount;

  // Count how many edge pixels are close to the average edge colour.
  let matchingEdgePixels = 0;
  for (let y = 0; y < height; y += edgeStep) {
    for (let x = 0; x < width; x += edgeStep) {
      if (!isEdge(x, y)) continue;
      const idx = (y * width + x) * 4;
      const diff =
        Math.abs(data[idx] - avgR) +
        Math.abs(data[idx + 1] - avgG) +
        Math.abs(data[idx + 2] - avgB);
      if (diff < 60) matchingEdgePixels++;
    }
  }

  const edgeMatchRatio = matchingEdgePixels / edgeCount;
  const transparencyRatio = transparentPixels / totalSampledPixels;

  let status: CheckStatus = 'pass';
  let message = 'No obvious solid background box detected.';

  if (transparencyRatio < 0.02 && edgeMatchRatio >= 0.75) {
    status = 'fail';
    message =
      'Solid background box likely detected. This may print as a visible rectangle on the product.';
  } else if (transparencyRatio < 0.1 && edgeMatchRatio >= 0.55) {
    status = 'warn';
    message =
      'Possible solid background box detected. Check that this will not print as a rectangle.';
  }

  return {
    label: 'Solid Background Box Risk',
    status,
    message,
  };
}

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState('');
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [shirtImg, setShirtImg] = useState<HTMLImageElement | null>(null);
  const [mockupOffsetX, setMockupOffsetX] = useState(0);
  const [mockupOffsetY, setMockupOffsetY] = useState(0);
  const [mockupScale, setMockupScale] = useState(1);

  const [imgW, setImgW] = useState(0);
  const [imgH, setImgH] = useState(0);
  const [fileSize, setFileSize] = useState(0);

  const [dpiMetadata, setDpiMetadata] = useState<number | null>(null);
  const [colourProfileStatus, setColourProfileStatus] = useState<
    'srgb' | 'non-srgb' | 'unknown'
  >('unknown');
  const [hasTransparency, setHasTransparency] = useState<boolean | null>(null);
  const [whitePixelRatio, setWhitePixelRatio] = useState(0);
  const [whiteBackgroundCheck, setWhiteBackgroundCheck] = useState<CheckItem | null>(null);
  const [whiteEdgeCheck, setWhiteEdgeCheck] = useState<CheckItem | null>(null);
  const [semiTransparencyCheck, setSemiTransparencyCheck] = useState<CheckItem | null>(null);
  const [cutOffEdgeCheck, setCutOffEdgeCheck] = useState<CheckItem | null>(null);
  const [lowContrastCheck, setLowContrastCheck] = useState<CheckItem | null>(null);
  const [tinyTextCheck, setTinyTextCheck] = useState<CheckItem | null>(null);
  const [compressionArtifactCheck, setCompressionArtifactCheck] = useState<CheckItem | null>(null);
  const [emptyPaddingCheck, setEmptyPaddingCheck] = useState<CheckItem | null>(null);
  const [pixelationCheck, setPixelationCheck] = useState<CheckItem | null>(null);
  const [unevenPaddingCheck, setUnevenPaddingCheck] = useState<CheckItem | null>(null);
  const [oversizedArtworkCheck, setOversizedArtworkCheck] = useState<CheckItem | null>(null);
  const [solidBackgroundBoxCheck, setSolidBackgroundBoxCheck] = useState<CheckItem | null>(null);
  const [singleScanSummary, setSingleScanSummary] = useState<ReturnType<typeof runSingleScanVisibleSummary> | null>(null);

  const [originalBounds, setOriginalBounds] = useState<Bounds | null>(null);
  const [coverage, setCoverage] = useState(0);
  const [specks, setSpecks] = useState(0);
  const [thinLinePercent, setThinLinePercent] = useState(0);

  const [fakeTransparencyDetected, setFakeTransparencyDetected] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('pod');
  const [previewSize, setPreviewSize] = useState<PreviewSize>(DEFAULT_PREVIEW_SIZE);
  const [inspectZoom, setInspectZoom] = useState(1);
  const [previewBackground, setPreviewBackground] = useState<PreviewBackground>('checker');

  const [transform, setTransform] = useState({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const [actionMessage, setActionMessage] = useState('Upload a design to begin.');
  const [downloadMessage, setDownloadMessage] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [hasAutoFixApplied, setHasAutoFixApplied] = useState(false);
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (shouldAutoOpenStartupTutorial()) {
      const timer = window.setTimeout(() => setTutorialOpen(true), 400);
      return () => window.clearTimeout(timer);
    }
  }, []);
  const [selectedRedbubblePreset, setSelectedRedbubblePreset] = useState<RedbubblePresetId>('apparel');
  const [selectedPrintfulPreset, setSelectedPrintfulPreset] = useState<PrintfulPresetId>('dtg-dtf-apparel');
  const [activePresetSystem, setActivePresetSystem] = useState<'redbubble' | 'printful' | 'teepublic'>('redbubble');
  const [uploadTarget, setUploadTarget] = useState<
    | 'standard'
    | 'redbubble'
    | 'printful'
    | 'teepublic'
    | 'spring'
    | 'zazzle'
    | 'gelato'
    | 'custom'
    | 'presets'
  >('standard');
  const [customSizeFocusToken, setCustomSizeFocusToken] = useState(0);
  const [productPresetsFocusToken, setProductPresetsFocusToken] = useState(0);
  const [exportPackZipFocusToken, setExportPackZipFocusToken] = useState(0);
  const [batchCheckOpen, setBatchCheckOpen] = useState(false);
  const [batchExportOpen, setBatchExportOpen] = useState(false);
  const [toolsTab, setToolsTab] = useState<'export' | 'batch' | 'converter'>('export');

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanTimingRef = useRef<ScanTimingSnapshot | null>(null);

  useEffect(() => {
    const shirt = new Image();
    shirt.src = '/mockups/shirt-front.png';

    shirt.onload = () => {
      setShirtImg(shirt);
    };
  }, []);


  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  useEffect(() => {
    if (!img) return;

    const canvas = analysisCanvasRef.current;
    if (!canvas) {
      setIsScanning(false);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      setIsScanning(false);
      return;
    }

    const devTiming = isDevScannerTimingEnabled();
    const timingStages: Record<string, number> = {};
    const timingSnapshot = scanTimingRef.current;

    if (timingSnapshot) {
      timingStages['File read'] = timingSnapshot.fileReadMs;
      timingStages['DPI and colour profile'] = timingSnapshot.dpiProfileMs;
      timingStages['Image decode'] = timingSnapshot.decodeMs;
    }

    let stageStart = devTiming ? performance.now() : 0;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    if (devTiming) timingStages['Canvas drawing'] = performance.now() - stageStart;

    stageStart = devTiming ? performance.now() : 0;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (devTiming) timingStages['ImageData extraction'] = performance.now() - stageStart;

    stageStart = devTiming ? performance.now() : 0;
    const res = detectBoundsAndCoverage(imageData, 10);
    setOriginalBounds(res.bounds);
    setCoverage(res.coverage);
    if (devTiming) timingStages['Bounds and coverage'] = performance.now() - stageStart;

    stageStart = devTiming ? performance.now() : 0;
    setSpecks(detectStraySpecks(imageData));
    if (devTiming) timingStages['Speck detection'] = performance.now() - stageStart;

    stageStart = devTiming ? performance.now() : 0;
    setThinLinePercent(estimateThinLines(imageData));
    if (devTiming) timingStages['Thin-line detection'] = performance.now() - stageStart;

    stageStart = devTiming ? performance.now() : 0;
    const fakeTransparency = detectFakeTransparencyBackground(imageData);
    setFakeTransparencyDetected(fakeTransparency.detected);
    if (devTiming) timingStages['Fake-transparency detection'] = performance.now() - stageStart;

    let transparentFound = false;
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] < 255) {
        transparentFound = true;
        break;
      }
    }
    setHasTransparency(transparentFound);

    // White Background Risk: calculated directly from imageData so it never depends on
    // stale transparency state. Counts visible, near-white, and transparent pixels.
    stageStart = devTiming ? performance.now() : 0;
    {
      const wbData = imageData.data;
      const totalPixels = wbData.length / 4;
      let visiblePixelCount = 0;
      let whiteVisibleCount = 0;
      let transparentPixelCount = 0;

      for (let i = 0; i < wbData.length; i += 4) {
        const a = wbData[i + 3];
        if (a < 40) {
          transparentPixelCount++;
          continue;
        }
        // Visible pixel (alpha > 40).
        visiblePixelCount++;
        const r = wbData[i];
        const g = wbData[i + 1];
        const b = wbData[i + 2];
        if (r > 235 && g > 235 && b > 235 && a > 220) {
          whiteVisibleCount++;
        }
      }

      const whiteRatio = visiblePixelCount === 0 ? 0 : whiteVisibleCount / visiblePixelCount;
      const transparentPixelRatio = totalPixels === 0 ? 0 : transparentPixelCount / totalPixels;

      let wbStatus: CheckStatus = 'pass';
      let wbMessage = 'No obvious white background detected.';

      if (visiblePixelCount > 0 && transparentPixelRatio < 0.02 && whiteRatio > 0.6) {
        wbStatus = 'fail';
        wbMessage = 'White background likely detected. Use a transparent PNG for best POD results.';
      } else if (whiteRatio > 0.35) {
        wbStatus = 'warn';
        wbMessage = 'Possible white background detected. Check before uploading to dark shirts.';
      }

      setWhiteBackgroundCheck({
        label: 'White Background Risk',
        status: wbStatus,
        message: wbMessage,
      });
    }
    if (devTiming) timingStages['White-background calculation'] = performance.now() - stageStart;

    stageStart = devTiming ? performance.now() : 0;
    setWhiteEdgeCheck(getWhiteEdgeHaloCheck(imageData));
    if (devTiming) timingStages['White-edge detection'] = performance.now() - stageStart;

    stageStart = devTiming ? performance.now() : 0;
    setSemiTransparencyCheck(getSemiTransparencyRiskCheck(imageData));
    if (devTiming) timingStages['Semi-transparency detection'] = performance.now() - stageStart;

    stageStart = devTiming ? performance.now() : 0;
    setCutOffEdgeCheck(getCutOffEdgeRiskCheck(imageData));
    if (devTiming) timingStages['Cut-off edge detection'] = performance.now() - stageStart;

    stageStart = devTiming ? performance.now() : 0;
    setLowContrastCheck(getLowContrastRiskCheck(imageData));
    if (devTiming) timingStages['Low-contrast detection'] = performance.now() - stageStart;

    stageStart = devTiming ? performance.now() : 0;
    setTinyTextCheck(getTinyTextRiskCheck(imageData));
    if (devTiming) timingStages['Tiny-text detection'] = performance.now() - stageStart;

    stageStart = devTiming ? performance.now() : 0;
    setCompressionArtifactCheck(getCompressionArtifactRiskCheck(imageData));
    if (devTiming) timingStages['Compression-artifact detection'] = performance.now() - stageStart;

    stageStart = devTiming ? performance.now() : 0;
    setEmptyPaddingCheck(getEmptyPaddingRiskCheck(imageData));
    if (devTiming) timingStages['Empty-padding detection'] = performance.now() - stageStart;

    stageStart = devTiming ? performance.now() : 0;
    setPixelationCheck(getPixelationRiskCheck(imageData));
    if (devTiming) timingStages['Pixelation detection'] = performance.now() - stageStart;

    stageStart = devTiming ? performance.now() : 0;
    setUnevenPaddingCheck(getUnevenPaddingRiskCheck(imageData));
    if (devTiming) timingStages['Uneven-padding detection'] = performance.now() - stageStart;

    stageStart = devTiming ? performance.now() : 0;
    setOversizedArtworkCheck(getOversizedArtworkRiskCheck(imageData));
    if (devTiming) timingStages['Oversized-artwork detection'] = performance.now() - stageStart;

    stageStart = devTiming ? performance.now() : 0;
    setSolidBackgroundBoxCheck(getSolidBackgroundBoxRiskCheck(imageData));
    if (devTiming) timingStages['Solid-background-box detection'] = performance.now() - stageStart;
    if (file) {
      setSingleScanSummary(
        runSingleScanVisibleSummary({
          file,
          imageData,
          imgW,
          imgH,
          dpiMetadata,
          scanTimeMs: timingSnapshot ? Math.round(performance.now() - timingSnapshot.scanStart) : 0,
          options: {
            targetCanvasW,
            targetCanvasH,
            safeBorder: SAFE_BORDER,
          },
        }),
      );
    }

    // White Background Risk: count opaque/near-white pixels.
    stageStart = devTiming ? performance.now() : 0;
    const data = imageData.data;
    let opaqueCount = 0;
    let nearWhiteCount = 0;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha < 128) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Count solid or near-white pixels for the White Background Risk check.
      if (r >= 240 && g >= 240 && b >= 240) {
        nearWhiteCount++;
      }
      opaqueCount++;
    }

    setWhitePixelRatio(opaqueCount === 0 ? 0 : nearWhiteCount / opaqueCount);

    if (devTiming && timingSnapshot) {
      logScannerTiming(timingStages, performance.now() - timingSnapshot.scanStart);
    }

    scanTimingRef.current = null;
    setIsScanning(false);
  }, [img]);

  const effectiveBounds = useMemo(() => {
    return getEffectiveArtBounds(originalBounds, transform);
  }, [originalBounds, transform]);

  const designCanvasSize = useMemo(() => {
    return getDesignCanvasSize(effectiveBounds, img);
  }, [effectiveBounds, img]);

  const previewEffectiveBounds = useMemo(() => {
    return getEffectiveArtBounds(originalBounds, transform);
  }, [originalBounds, transform]);

  const previewDesignCanvasSize = useMemo(() => {
    return getDesignCanvasSize(previewEffectiveBounds, img);
  }, [previewEffectiveBounds, img]);

  const previewCanvasW = useMemo(() => {
    if (viewMode === 'pod') return CANVAS_W;
    if (viewMode === 'design') return previewDesignCanvasSize.width;
    return SHIRT_W;
  }, [viewMode, previewDesignCanvasSize]);

  const previewCanvasH = useMemo(() => {
    if (viewMode === 'pod') return CANVAS_H;
    if (viewMode === 'design') return previewDesignCanvasSize.height;
    return SHIRT_H;
  }, [viewMode, previewDesignCanvasSize]);

  const totalScale = useMemo(() => {
    return previewSize * inspectZoom;
  }, [previewSize, inspectZoom]);

  const practicalPrintDpi = useMemo(() => {
    if (!imgW || !imgH) return 0;
    const dpiX = imgW / 14;
    const dpiY = imgH / 16;
    return Math.round(Math.min(dpiX, dpiY));
  }, [imgW, imgH]);
  const selectedRedbubblePresetData =
  redbubblePresets.find((preset) => preset.id === selectedRedbubblePreset) ??
  redbubblePresets[0];
  const selectedPrintfulPresetData =
    printfulPresets.find((preset) => preset.id === selectedPrintfulPreset) ?? printfulPresets[0];
  const selectedTargetPresetData =
    activePresetSystem === 'teepublic'
      ? {
          width: TEEPUBLIC_ALL_PRODUCTS_W,
          height: TEEPUBLIC_ALL_PRODUCTS_H,
        }
      : activePresetSystem === 'printful'
      ? selectedPrintfulPresetData
      : selectedRedbubblePresetData;
  const selectedRedbubbleDownloadLabel = `Download ${selectedRedbubblePresetData.label} PNG`;
  const selectedPrintfulDownloadLabel = `Download ${selectedPrintfulPresetData.label} PNG`;
  const teePublicDownloadLabel = 'Download TeePublic PNG';
  const targetCanvasW = selectedTargetPresetData.width;
  const targetCanvasH = selectedTargetPresetData.height;
  const targetCanvasAspect = targetCanvasW / targetCanvasH;
  const standardTargetLine = `Selected target: Standard Apparel — ${CANVAS_W} × ${CANVAS_H}`;
  const redbubbleTargetLine = `Selected target: ${selectedRedbubblePresetData.label} — ${selectedRedbubblePresetData.width} × ${selectedRedbubblePresetData.height}`;
  const printfulTargetLine = `Selected target: ${selectedPrintfulPresetData.label} — ${selectedPrintfulPresetData.width} × ${selectedPrintfulPresetData.height}`;
  const teePublicTargetLine = `Selected target: TeePublic — ${TEEPUBLIC_ALL_PRODUCTS_W} × ${TEEPUBLIC_ALL_PRODUCTS_H}`;

  const designTooSmallStatus = useMemo(() => {
    if (!effectiveBounds) {
      return {
        status: 'warn' as CheckStatus,
        message: 'Could not measure artwork size clearly.',
      };
    }

    // Match the same fit logic used by export so "Design Too Small" reflects real output size.
    const isSelectedTargetSizedImage = imgW === targetCanvasW && imgH === targetCanvasH;
    const exportFitScale = Math.min(targetCanvasW / CANVAS_W, targetCanvasH / CANVAS_H);
    const exportBoundsW = effectiveBounds.w * exportFitScale;
    const exportBoundsH = effectiveBounds.h * exportFitScale;
    const measuredBoundsW =
      isSelectedTargetSizedImage && originalBounds ? originalBounds.w : exportBoundsW;
    const measuredBoundsH =
      isSelectedTargetSizedImage && originalBounds ? originalBounds.h : exportBoundsH;
    const widthRatio = measuredBoundsW / targetCanvasW;
    const heightRatio = measuredBoundsH / targetCanvasH;
    const areaRatio = (measuredBoundsW * measuredBoundsH) / (targetCanvasW * targetCanvasH);
    const hasExportReadySizing = hasAutoFixApplied || isSelectedTargetSizedImage;
    const exportHint =
      activePresetSystem === 'printful'
        ? 'Download Selected Printful PNG'
        : activePresetSystem === 'teepublic'
        ? 'Download TeePublic All Products PNG'
        : activePresetSystem === 'redbubble'
        ? 'Download Selected Redbubble PNG'
        : 'Download DTG/DTF Apparel PNG (4200 × 4800)';

    if (widthRatio >= 0.55 && heightRatio >= 0.55 && areaRatio >= 0.22) {
      return {
        status: 'pass' as CheckStatus,
        message: `Artwork fill looks healthy. Width ${(widthRatio * 100).toFixed(0)}% • Height ${(heightRatio * 100).toFixed(0)}%`,
      };
    }

    if (widthRatio >= 0.38 && heightRatio >= 0.38 && areaRatio >= 0.1) {
      return {
        status: isSelectedTargetSizedImage ? ('pass' as CheckStatus) : ('warn' as CheckStatus),
        message: hasExportReadySizing
          ? `Design fill is moderate, but this file is already sized for the selected target. Export should work, though fine detail or print size may be limited.`
          : `Design may print a bit small. Please press Auto Fix top left, then ${exportHint}.`,
      };
    }

    return {
      status: hasExportReadySizing ? ('warn' as CheckStatus) : ('fail' as CheckStatus),
      message: hasExportReadySizing
        ? 'Design fill is still quite small for the selected target. Export will work, but quality and print size may be limited.'
        : `Design looks too small and may print tiny. Please press Auto Fix top left, then ${exportHint}.`,
    };
  }, [
    effectiveBounds,
    targetCanvasW,
    targetCanvasH,
    activePresetSystem,
    hasAutoFixApplied,
    imgW,
    imgH,
    originalBounds,
  ]);

  const offCenterStatus = useMemo(() => {
    if (!effectiveBounds) {
      return {
        status: 'warn' as CheckStatus,
        message: 'Could not measure artwork position clearly.',
      };
    }

    const artCenterX = effectiveBounds.x + effectiveBounds.w / 2;
    const artCenterY = effectiveBounds.y + effectiveBounds.h / 2;

    const deltaX = artCenterX - CANVAS_W / 2;
    const deltaY = artCenterY - CANVAS_H / 2;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    let horizontal = 'centered left-to-right';
    let vertical = 'centered top-to-bottom';

    if (deltaX < -40) horizontal = `shifted left by ${Math.round(absX)} px`;
    if (deltaX > 40) horizontal = `shifted right by ${Math.round(absX)} px`;
    if (deltaY < -40) vertical = `shifted up by ${Math.round(absY)} px`;
    if (deltaY > 40) vertical = `shifted down by ${Math.round(absY)} px`;

    if (absX <= 40 && absY <= 40) {
      return {
        status: 'pass' as CheckStatus,
        message: `Artwork looks well centered. It is ${horizontal} and ${vertical}.`,
      };
    }

    if (absX <= 120 && absY <= 120) {
      return {
        status: 'warn' as CheckStatus,
        message: 'Artwork is slightly off-center. Please press Auto Fix top left.',
      };
    }

    return {
      status: 'fail' as CheckStatus,
      message: 'Artwork is noticeably off-center. Please press Auto Fix top left.',
    };
  }, [effectiveBounds]);

  const safetyBorderStatus = useMemo(() => {
    if (!effectiveBounds) {
      return {
        status: 'warn' as CheckStatus,
        message: `Could not measure artwork against the ${SAFE_BORDER}px safety border.`,
      };
    }

    const left = effectiveBounds.x;
    const top = effectiveBounds.y;
    const right = CANVAS_W - (effectiveBounds.x + effectiveBounds.w);
    const bottom = CANVAS_H - (effectiveBounds.y + effectiveBounds.h);
    const minEdge = Math.min(left, top, right, bottom);

    if (minEdge >= SAFE_BORDER + 20) {
      return {
        status: 'pass' as CheckStatus,
        message: `Artwork appears safely inside the ${SAFE_BORDER}px safety border.`,
      };
    }

    if (minEdge >= SAFE_BORDER) {
      return {
        
      
status: 'warn' as CheckStatus,
message: "Safe but close to edge. For best results, use quick fix Auto Fix top left."
      };
    }

    return {
      status: 'fail' as CheckStatus,
      message: 'Artwork is touching or very close to the safety edge. Please press Auto Fix top left.',
    };
  }, [effectiveBounds]);

  const printScore = useMemo(() => {
    if (!img) return 0;

    let score = 100;

    if (hasTransparency === false) {
      score -= 25;
    }

    if (fakeTransparencyDetected) {
      score -= 15;
    }

    if (designTooSmallStatus.status === 'fail') {
      score -= 15;
    } else if (designTooSmallStatus.status === 'warn') {
      score -= 8;
    }

    if (offCenterStatus.status === 'fail') {
      score -= 10;
    } else if (offCenterStatus.status === 'warn') {
      score -= 5;
    }

    if (safetyBorderStatus.status === 'fail') {
      score -= 15;
    } else if (safetyBorderStatus.status === 'warn') {
      score -= 8;
    }

    if (specks > 0) {
      score -= 8;
    }

    if (thinLinePercent >= 18) {
      score -= 12;
    } else if (thinLinePercent >= 8) {
      score -= 5;
    }

    return Math.max(0, score);
  }, [
    img,
    imgW,
    imgH,
    hasTransparency,
    fakeTransparencyDetected,
    designTooSmallStatus.status,
    offCenterStatus.status,
    safetyBorderStatus.status,
    specks,
    thinLinePercent,
    targetCanvasW,
    targetCanvasH,
  ]);

  const displayPrintScore = singleScanSummary?.printConfidence ?? printScore;

  const checks: CheckItem[] = useMemo(() => {
    if (!imgW || !imgH) return [];

    const exactSize = imgW === targetCanvasW && imgH === targetCanvasH;
    const aspect = imgW / imgH;
    const aspectClose = Math.abs(aspect - targetCanvasAspect) < 0.01;
    const largerThanTarget = imgW >= targetCanvasW && imgH >= targetCanvasH;

    return mergeSingleScanDisplayChecks([
      {
        label: 'Export Size Note',
        status: exactSize || largerThanTarget ? 'pass' : 'info',
        message: exactSize
          ? `Ready for selected target: ${imgW} × ${imgH}`
          : largerThanTarget
          ? `Larger than selected target (${targetCanvasW} × ${targetCanvasH}).`
          : 'Selected export size is larger than the uploaded file. The app will place the design on the export canvas with transparent space around it.\n\nFine detail depends on the original artwork quality.',
      },
      {
        label: 'Aspect Ratio',
        status: aspectClose ? 'pass' : 'info',
        message: aspectClose
          ? `Good aspect ratio: ${aspect.toFixed(3)}`
          : `Aspect differs from selected target (${targetCanvasW} × ${targetCanvasH}) — export will add transparent padding.`,
      },
      {
        label: 'Transparency',
        status: hasTransparency === null ? 'info' : hasTransparency ? 'pass' : 'warn',
        message:
          hasTransparency === null
            ? 'Not checked yet.'
            : hasTransparency
            ? 'Transparency detected.'
            : 'No transparency detected. PNG with transparent background is preferred for POD.',
      },
    {
  label: 'Fake Transparency Background',
  status: fakeTransparencyDetected ? 'fail' : 'pass',
  message: fakeTransparencyDetected
    ? 'Possible fake transparency background detected.'
    : 'No fake transparency background detected.',
},  









{
  label: 'File Size',
  status:
    fileSize <= 50 * 1024 * 1024
      ? 'pass'
      : fileSize <= 100 * 1024 * 1024
      ? 'warn'
      : 'fail',
  message:
    fileSize <= 50 * 1024 * 1024
      ? `Good file size: ${formatBytes(fileSize)}`
      : fileSize <= 100 * 1024 * 1024
      ? `Large file size: ${formatBytes(fileSize)}. Should still be okay for many POD platforms, but check upload limits.`
      : `Very large file size: ${formatBytes(fileSize)}. This may fail on some POD platforms.`,
},
      // File Type Risk: PNG is ideal for POD; warn on JPG/JPEG and any other file type.
      ...(file
        ? [
            file.type.includes('png')
              ? {
                  label: 'File Type Risk',
                  status: 'pass' as CheckStatus,
                  message: 'PNG detected. Good choice for transparent POD designs.',
                }
              : file.type.includes('jpeg') || file.type.includes('jpg')
              ? {
                  label: 'File Type Risk',
                  status: 'warn' as CheckStatus,
                  message: 'JPG detected. PNG with transparency is usually safer for POD.',
                }
              : {
                  label: 'File Type Risk',
                  status: 'warn' as CheckStatus,
                  message: 'Unusual file type detected. PNG is recommended for most POD designs.',
                },
          ]
        : []),
      ...(compressionArtifactCheck ? [compressionArtifactCheck] : []),
      {
        label: 'Artwork Size',
        status: 'info',
        message: effectiveBounds
          ? `Detected artwork area: ${Math.round(effectiveBounds.w)} × ${Math.round(effectiveBounds.h)}`
          : 'Artwork area measurement unavailable.',
      },
      ...(emptyPaddingCheck ? [emptyPaddingCheck] : []),
      ...(unevenPaddingCheck ? [unevenPaddingCheck] : []),
      ...(oversizedArtworkCheck ? [oversizedArtworkCheck] : []),
      {
        label: 'Design Too Small',
        status: designTooSmallStatus.status,
        message: designTooSmallStatus.message,
      },
      {
        label: 'Off-Center Design',
        status: offCenterStatus.status,
        message: offCenterStatus.message,
      },
      {
        label: 'Print Safety Border',
        status: safetyBorderStatus.status,
        message: safetyBorderStatus.message,
      },
      
      {
        label: 'Stray Speck Check',
        status: specks === 0 ? 'pass' : specks < 15 ? 'warn' : 'fail',
        message:
          specks === 0
            ? 'No obvious stray specks detected.'
            : specks < 15
            ? 'Small stray pixels detected outside the main artwork. Check empty transparent areas before upload.'
            : 'Heavy stray pixels detected outside the main artwork. Remove unwanted floating marks before upload.',
      },
          {
            label: 'Line Thickness',
            status: thinLinePercent < 8 ? 'pass' : thinLinePercent < 18 ? 'warn' : 'fail',
        message:
          thinLinePercent < 8
            ? 'Line thickness looks healthy for print.'
            : thinLinePercent < 18
            ? 'Some thin line risk detected.'
            : 'A lot of thin line risk detected.',
      },
      {
        label: 'DPI Metadata',
        status: 'info',
        message: dpiMetadata
          ? `Embedded DPI metadata: ${dpiMetadata} DPI`
          : 'No DPI metadata found. This is informational only and does not usually matter for POD if pixel size is correct.',
      },
      whiteBackgroundCheck ?? {
        label: 'White Background Risk',
        status: 'info' as CheckStatus,
        message: 'Not checked yet.',
      },
      ...(solidBackgroundBoxCheck ? [solidBackgroundBoxCheck] : []),
      ...(whiteEdgeCheck ? [whiteEdgeCheck] : []),
      ...(semiTransparencyCheck ? [semiTransparencyCheck] : []),
      ...(cutOffEdgeCheck ? [cutOffEdgeCheck] : []),
      ...(lowContrastCheck ? [lowContrastCheck] : []),
    ], singleScanSummary?.scanResult);
  }, [
    imgW,
    imgH,
    hasTransparency,
    file,
    fileSize,
    effectiveBounds,
    designTooSmallStatus,
    offCenterStatus,
    safetyBorderStatus,
    specks,
    thinLinePercent,
    dpiMetadata,
    fakeTransparencyDetected,
    whiteBackgroundCheck,
    whiteEdgeCheck,
    semiTransparencyCheck,
    cutOffEdgeCheck,
    lowContrastCheck,
    compressionArtifactCheck,
    emptyPaddingCheck,
    unevenPaddingCheck,
    oversizedArtworkCheck,
    solidBackgroundBoxCheck,
    singleScanSummary,
    targetCanvasW,
    targetCanvasH,
    targetCanvasAspect,
  ]);

  function drawPodBackground(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 10]);
    ctx.strokeRect(SAFE_BORDER, SAFE_BORDER, CANVAS_W - SAFE_BORDER * 2, CANVAS_H - SAFE_BORDER * 2);

    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 4;
    ctx.setLineDash([18, 12]);
    ctx.strokeRect(SAFE_BOX, SAFE_BOX, CANVAS_W - SAFE_BOX * 2, CANVAS_H - SAFE_BOX * 2);

    ctx.setLineDash([]);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(CANVAS_W / 2, 0);
    ctx.lineTo(CANVAS_W / 2, CANVAS_H);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, CANVAS_H / 2);
    ctx.lineTo(CANVAS_W, CANVAS_H / 2);
    ctx.stroke();
  }

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    if (!img) {
      const ctx = canvas.getContext('2d');
      canvas.width = 1;
      canvas.height = 1;
      if (ctx) ctx.clearRect(0, 0, 1, 1);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (viewMode === 'pod') {
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const drawW = img.naturalWidth * transform.scale;
      const drawH = img.naturalHeight * transform.scale;
      const drawX = transform.offsetX;
      const drawY = transform.offsetY;

      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    }

    if (viewMode === 'design') {
      canvas.width = previewDesignCanvasSize.width;
      canvas.height = previewDesignCanvasSize.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 3;
      ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

      const drawW = img.naturalWidth * transform.scale;
      const drawH = img.naturalHeight * transform.scale;

      if (previewEffectiveBounds) {
        const targetX = (canvas.width - previewEffectiveBounds.w) / 2;
        const targetY = (canvas.height - previewEffectiveBounds.h) / 2;

        const shiftX = targetX - previewEffectiveBounds.x;
        const shiftY = targetY - previewEffectiveBounds.y;

        const drawX = transform.offsetX + shiftX;
        const drawY = transform.offsetY + shiftY;

        ctx.drawImage(img, drawX, drawY, drawW, drawH);
      } else {
        const drawX = (canvas.width - drawW) / 2;
        const drawY = (canvas.height - drawH) / 2;
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
      }
    }

    if (viewMode === 'shirt') {
      canvas.width = SHIRT_W;
      canvas.height = SHIRT_H;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (shirtImg) {
        ctx.drawImage(shirtImg, 0, 0, SHIRT_W, SHIRT_H);
      }

      

      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 4;
      ctx.strokeRect(SHIRT_PRINT_X, SHIRT_PRINT_Y, SHIRT_PRINT_W, SHIRT_PRINT_H);

      const mapX = SHIRT_PRINT_W / CANVAS_W;
      const mapY = SHIRT_PRINT_H / CANVAS_H;

      const drawW = img.naturalWidth * transform.scale * mapX * mockupScale;
const drawH = img.naturalHeight * transform.scale * mapY * mockupScale;
const drawX = SHIRT_PRINT_X + transform.offsetX * mapX + mockupOffsetX;
const drawY = SHIRT_PRINT_Y + transform.offsetY * mapY + mockupOffsetY;

      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    }
  }, [img, shirtImg, transform, previewEffectiveBounds, viewMode, previewDesignCanvasSize, mockupOffsetX, mockupOffsetY, mockupScale]);

  async function loadDesignFile(selected: File) {
    const devTiming = isDevScannerTimingEnabled();
    const scanStart = devTiming ? performance.now() : 0;

    setIsScanning(true);
    setHasAutoFixApplied(false);
    setPreviewBackground('checker');

    if (fileUrl) URL.revokeObjectURL(fileUrl);

    setFile(selected);
    setFileSize(selected.size);

    const fileReadStart = devTiming ? performance.now() : 0;
    const arrayBuffer = await selected.arrayBuffer();
    const fileReadMs = devTiming ? performance.now() - fileReadStart : 0;

    const dpiProfileStart = devTiming ? performance.now() : 0;
    setDpiMetadata(getImageDpi(selected, arrayBuffer));
    setColourProfileStatus(getColourProfile(selected, arrayBuffer));
    const dpiProfileMs = devTiming ? performance.now() - dpiProfileStart : 0;

    const url = URL.createObjectURL(selected);
    setFileUrl(url);

    setActionMessage('Scanning design...');

    const image = new Image();
    const decodeStart = devTiming ? performance.now() : 0;

    image.onload = () => {
      const decodeMs = devTiming ? performance.now() - decodeStart : 0;

      if (devTiming) {
        scanTimingRef.current = {
          scanStart,
          fileReadMs,
          dpiProfileMs,
          decodeMs,
        };
      }

      setImg(image);
      setImgW(image.naturalWidth);
      setImgH(image.naturalHeight);

      const scaleX = CANVAS_W / image.naturalWidth;
      const scaleY = CANVAS_H / image.naturalHeight;
      const scale = Math.min(scaleX, scaleY);

      const scaledW = image.naturalWidth * scale;
      const scaledH = image.naturalHeight * scale;

      setTransform({
        scale,
        offsetX: Math.round((CANVAS_W - scaledW) / 2),
        offsetY: Math.round((CANVAS_H - scaledH) / 2),
      });

      setMockupOffsetX(0);
      setMockupOffsetY(0);
      setMockupScale(1);

      setInspectZoom(1);
      setActionMessage('Design uploaded and centered on the POD canvas.');
      setDownloadMessage('');
      setViewMode('design');
      setPreviewSize(0.15);
      setUploadInputKey((key) => key + 1);
    };

    image.onerror = () => {
      scanTimingRef.current = null;
      setActionMessage('Could not load that image.');
      setIsScanning(false);
    };

    image.src = url;
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    await loadDesignFile(selected);
  }

  async function handleLoadFileFromBatch(selected: File) {
    await loadDesignFile(selected);
  }

  function handleQuickFix() {
    if (!originalBounds || !file || !img) return;

    setViewMode('pod');
  
    const availableW = CANVAS_W - SAFE_BOX * 2;
    const availableH = CANVAS_H - SAFE_BOX * 2;
    const presetAspect = selectedTargetPresetData.width / selectedTargetPresetData.height;
    const safeAspect = availableW / availableH;

    const targetW = safeAspect > presetAspect ? availableH * presetAspect : availableW;
    const targetH = safeAspect > presetAspect ? availableH : availableW / presetAspect;
  
    const scaleX = targetW / originalBounds.w;
    const scaleY = targetH / originalBounds.h;
  
    let nextScale = Math.min(scaleX, scaleY);
  
    if (nextScale > 1) {
      nextScale = Math.min(nextScale, 1.25);
    }
  
    const scaledW = originalBounds.w * nextScale;
    const scaledH = originalBounds.h * nextScale;
  
    const targetX = (CANVAS_W - targetW) / 2;
    const targetY = (CANVAS_H - targetH) / 2;
    const x = targetX + (targetW - scaledW) / 2 - originalBounds.x * nextScale;
    const y = targetY + (targetH - scaledH) / 2 - originalBounds.y * nextScale;
    const nextTransform = {
      scale: Math.round(nextScale * 1000) / 1000,
      offsetX: Math.round(x),
      offsetY: Math.round(y),
    };

    setTransform(nextTransform);

    const fixedSummary = runSingleScanVisibleSummaryFromFixedOutput({
      file,
      img,
      dpiMetadata,
      scanTimeMs: 0,
      options: {
        targetCanvasW,
        targetCanvasH,
        safeBorder: SAFE_BORDER,
      },
      outputWidth: targetCanvasW,
      outputHeight: targetCanvasH,
      transform: nextTransform,
      renderImageData: ({ width, height, transform: renderTransform }) => {
        const canvas = createExportCanvas(width, height, renderTransform);
        if (!canvas) return null;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        return ctx ? ctx.getImageData(0, 0, width, height) : null;
      },
    });

    if (fixedSummary) {
      setSingleScanSummary(fixedSummary);
    }

    setActionMessage('Auto Fix applied.');
    setHasAutoFixApplied(true);
  }

  function clearDesignCanvases() {
    const analysisCanvas = analysisCanvasRef.current;
    if (analysisCanvas) {
      analysisCanvas.width = 0;
      analysisCanvas.height = 0;
    }

    const previewCanvas = previewCanvasRef.current;
    if (previewCanvas) {
      const ctx = previewCanvas.getContext('2d');
      previewCanvas.width = 1;
      previewCanvas.height = 1;
      if (ctx) ctx.clearRect(0, 0, 1, 1);
    }
  }

  function handleResetDesign() {
    if (fileUrl) URL.revokeObjectURL(fileUrl);

    clearDesignCanvases();

    setFile(null);
    setFileUrl('');
    setImg(null);
    setImgW(0);
    setImgH(0);
    setFileSize(0);
    setDpiMetadata(null);
    setColourProfileStatus('unknown');
    setHasTransparency(null);
    setWhitePixelRatio(0);
    setOriginalBounds(null);
    setCoverage(0);
    setSpecks(0);
    setThinLinePercent(0);
    setFakeTransparencyDetected(false);

    setWhiteBackgroundCheck(null);
    setWhiteEdgeCheck(null);
    setSemiTransparencyCheck(null);
    setCutOffEdgeCheck(null);
    setLowContrastCheck(null);
    setTinyTextCheck(null);
    setCompressionArtifactCheck(null);
    setEmptyPaddingCheck(null);
    setPixelationCheck(null);
    setUnevenPaddingCheck(null);
    setOversizedArtworkCheck(null);
    setSolidBackgroundBoxCheck(null);
    setSingleScanSummary(null);

    setHasAutoFixApplied(false);
    setIsScanning(false);
    setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
    setMockupOffsetX(0);
    setMockupOffsetY(0);
    setMockupScale(1);
    setInspectZoom(1);
    setPreviewSize(DEFAULT_PREVIEW_SIZE);
    setPreviewBackground('checker');
    setViewMode('pod');
    setActionMessage('Upload a design to begin.');
    setDownloadMessage('');
    setUploadInputKey((key) => key + 1);
    setUploadTarget('standard');
  }

  function toSafeSlug(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  
  function createExportCanvas(
    width: number,
    height: number,
    renderTransform = transform,
  ): HTMLCanvasElement | null {
    if (!img) return null;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = width;
    exportCanvas.height = height;

    const ctx = exportCanvas.getContext('2d', { alpha: true });
    if (!ctx) return null;

    ctx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);

    const fitScale = Math.min(exportCanvas.width / CANVAS_W, exportCanvas.height / CANVAS_H);
    const padX = (exportCanvas.width - CANVAS_W * fitScale) / 2;
    const padY = (exportCanvas.height - CANVAS_H * fitScale) / 2;

    const drawW = img.naturalWidth * renderTransform.scale * fitScale;
    const drawH = img.naturalHeight * renderTransform.scale * fitScale;
    const drawX = renderTransform.offsetX * fitScale + padX;
    const drawY = renderTransform.offsetY * fitScale + padY;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    return exportCanvas;
  }

  function getExportFileName(filenameLabel: string, width: number, height: number) {
    const safeName = toSafeSlug(filenameLabel) || 'pod-checker-export';
    return `${safeName}-${width}x${height}.png`;
  }

  function generatePngBlobForSize(width: number, height: number): Promise<Blob | null> {
    const exportCanvas = createExportCanvas(width, height);
    if (!exportCanvas) return Promise.resolve(null);

    return new Promise((resolve) => {
      exportCanvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  }

  function downloadPngForSize(
    width: number,
    height: number,
    label: string,
    filenameLabel: string,
    successMessage?: string
  ) {
    const exportCanvas = createExportCanvas(width, height);
    if (!exportCanvas) return;

    const link = document.createElement('a');
    link.download = getExportFileName(filenameLabel, width, height);
    link.href = exportCanvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadMessage(
      successMessage ??
        `Download ready. Use this fixed transparent PNG (${label} ${width}×${height}) for your POD upload.`
    );
    setActionMessage('Clean transparent PNG exported.');
  }

  function handleDownloadApparelPng() {
    downloadPngForSize(CANVAS_W, CANVAS_H, 'DTG/DTF Apparel', 'pod-checker-standard-apparel');
    setDownloadMessage('Download ready: Standard 4200 × 4800 apparel PNG exported.');
  }

  function handleDownloadRedbubblePng() {
    setActivePresetSystem('redbubble');
    downloadPngForSize(
      selectedRedbubblePresetData.width,
      selectedRedbubblePresetData.height,
      'Redbubble',
      selectedRedbubblePresetData.label
    );
    setDownloadMessage('Download ready: Redbubble apparel PNG exported.');
  }

  function handleDownloadPrintfulPng() {
    setActivePresetSystem('printful');
    downloadPngForSize(
      selectedPrintfulPresetData.width,
      selectedPrintfulPresetData.height,
      'Printful',
      selectedPrintfulPresetData.label
    );
    setDownloadMessage('Download ready: Printful DTG/DTF apparel PNG exported.');
  }

  function handleDownloadTeePublicPng() {
    setActivePresetSystem('teepublic');
    downloadPngForSize(
      TEEPUBLIC_ALL_PRODUCTS_W,
      TEEPUBLIC_ALL_PRODUCTS_H,
      'TeePublic All Products',
      'teepublic'
    );
    setDownloadMessage('Download ready: TeePublic PNG exported.');
  }

  function handleDownloadCustomPng(
    width: number,
    height: number,
    presetName?: string,
    filenameLabelOverride?: string
  ) {
    const label = presetName ?? 'Custom';
    const filenameSlug =
      filenameLabelOverride ??
      (presetName ? `pod-checker-${toSafeSlug(presetName)}` : 'pod-checker-custom');
    downloadPngForSize(
      width,
      height,
      label,
      filenameSlug,
      `Download started: ${label} ${width} × ${height} PNG. Check your Downloads folder.`
    );
  }

  async function handleDownloadConvertedPng(
    image: HTMLImageElement,
    width: number,
    height: number,
    exactFilename: string,
    presetLabel: string,
  ) {
    const blob = await createExportBlobFromImage(image, width, height);
    if (!blob) return;

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = exactFilename;
    link.href = objectUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);

    setDownloadMessage(
      `Download started: ${presetLabel} ${width} × ${height} PNG. Check your Downloads folder.`,
    );
    setActionMessage('Converted transparent PNG exported.');
  }

  function loadImageFromFile(selected: File): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(selected);
      const image = new Image();

      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };

      image.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };

      image.src = url;
    });
  }

  function createExportBlobFromImage(
    image: HTMLImageElement,
    exportWidth: number,
    exportHeight: number,
  ): Promise<Blob | null> {
    const scaleX = CANVAS_W / image.naturalWidth;
    const scaleY = CANVAS_H / image.naturalHeight;
    const fitScaleToCanvas = Math.min(scaleX, scaleY);
    const scaledW = image.naturalWidth * fitScaleToCanvas;
    const scaledH = image.naturalHeight * fitScaleToCanvas;
    const offsetX = Math.round((CANVAS_W - scaledW) / 2);
    const offsetY = Math.round((CANVAS_H - scaledH) / 2);

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = exportWidth;
    exportCanvas.height = exportHeight;

    const ctx = exportCanvas.getContext('2d', { alpha: true });
    if (!ctx) return Promise.resolve(null);

    ctx.clearRect(0, 0, exportWidth, exportHeight);

    const canvasFitScale = Math.min(exportWidth / CANVAS_W, exportHeight / CANVAS_H);
    const padX = (exportWidth - CANVAS_W * canvasFitScale) / 2;
    const padY = (exportHeight - CANVAS_H * canvasFitScale) / 2;
    const drawW = image.naturalWidth * fitScaleToCanvas * canvasFitScale;
    const drawH = image.naturalHeight * fitScaleToCanvas * canvasFitScale;
    const drawX = offsetX * canvasFitScale + padX;
    const drawY = offsetY * canvasFitScale + padY;

    ctx.drawImage(image, drawX, drawY, drawW, drawH);

    return new Promise((resolve) => {
      exportCanvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  }

  async function handleDownloadBatchExportZip(
    files: File[],
    sizes: { label: string; width: number; height: number; folderSlug: string }[],
    onProgress: (message: string) => void,
  ) {
    if (files.length === 0 || sizes.length === 0) return;

    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    let addedCount = 0;
    const totalOutputs = files.length * sizes.length;
    let outputIndex = 0;

    onProgress('Building batch export...');

    for (let i = 0; i < files.length; i++) {
      const selectedFile = files[i];
      const image = await loadImageFromFile(selectedFile);
      if (!image) continue;

      const baseName =
        toSafeSlug(selectedFile.name.replace(/\.[^.]+$/, '')) || `design-${i + 1}`;

      for (const size of sizes) {
        outputIndex += 1;
        onProgress(
          `Adding ${outputIndex} of ${totalOutputs}: ${selectedFile.name} at ${size.label} ${size.width} × ${size.height}`,
        );

        const blob = await createExportBlobFromImage(image, size.width, size.height);
        if (!blob) continue;

        zip.file(`${size.folderSlug}/${baseName}.png`, blob);
        addedCount += 1;
      }
    }

    if (addedCount === 0) {
      onProgress('Could not export any selected designs. Check that the files can be loaded.');
      return;
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.download = 'pod-checker-batch-export.zip';
    const objectUrl = URL.createObjectURL(zipBlob);
    link.href = objectUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);

    onProgress('Batch export ready. Check your Downloads folder.');
    setDownloadMessage(
      `Download started: Batch export ZIP (${addedCount} PNG${addedCount === 1 ? '' : 's'}). Check your Downloads folder.`,
    );
    setActionMessage('Batch export ZIP downloaded.');
  }

  function buildExportPackReadme(
    items: { label: string; width: number; height: number; filenameSlug: string }[]
  ): string {
    const exportLines = items
      .map(
        (item) =>
          `- ${item.label} ${item.width} × ${item.height} (${getExportFileName(item.filenameSlug, item.width, item.height)})`
      )
      .join('\n');

    return `POD Design Checker V5 Export Pack

This ZIP contains transparent PNG exports prepared from your uploaded design.

Included exports:
${exportLines}

Notes:

- Review each PNG before uploading.
- Shirt Colour Preview is for preview only.
- Downloads stay transparent.
- Generic product presets are quick POD export helpers, not official platform approval.
- Final platform upload requirements may vary by product.

Generated by POD Design Checker V5.
`;
  }

  async function handleDownloadExportPackZip(
    items: { label: string; width: number; height: number; filenameSlug: string }[]
  ) {
    if (!img || items.length === 0) return;

    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    setDownloadMessage('Building export pack...');

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      setDownloadMessage(`Adding ${item.label} ${item.width} × ${item.height} PNG...`);
      const blob = await generatePngBlobForSize(item.width, item.height);
      if (!blob) continue;
      zip.file(getExportFileName(item.filenameSlug, item.width, item.height), blob);
    }

    zip.file('POD-Launch-Pack-Notes.txt', buildExportPackReadme(items));

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.download = 'pod-checker-export-pack.zip';
    const objectUrl = URL.createObjectURL(zipBlob);
    link.href = objectUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);

    setDownloadMessage('Export pack ready. Check your Downloads folder.');
    setActionMessage('Export pack ZIP downloaded.');
  }

  function handleOpenCustomSize() {
    setUploadTarget('custom');
    setCustomSizeFocusToken((value) => value + 1);
  }

  function handleOpenProductPresets() {
    setUploadTarget('presets');
    setProductPresetsFocusToken((value) => value + 1);
  }

  function handleOpenExportPackZip() {
    setExportPackZipFocusToken((value) => value + 1);
  }

  function handleOpenBatchCheck() {
    setBatchCheckOpen(true);
    setBatchExportOpen(false);
  }

  function handleOpenBatchExport() {
    setBatchExportOpen(true);
    setBatchCheckOpen(false);
  }

  return (
    <main
      className="pod-app-shell"
      style={{
        background: 'linear-gradient(180deg, #140c08 0%, #111827 45%, #0f172a 100%)',
        color: '#f9fafb',
        fontFamily: 'Arial, Helvetica, sans-serif',
        padding: '16px',
      }}
    >
      <style jsx global>{`
        button {
          padding: 12px 16px;
          border-radius: 12px;
          border: none;
          background: #0f172a;
          color: #fff;
          cursor: pointer;
          font-weight: 700;
        }
        button:disabled {
          background: #475569;
          cursor: not-allowed;
        }
        ::-webkit-scrollbar {
          width: 14px;
          height: 14px;
        }
        ::-webkit-scrollbar-track {
          background: #0f172a;
          border-radius: 999px;
        }
        ::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #38bdf8, #3b82f6);
          border-radius: 999px;
          border: 2px solid #0f172a;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #67e8f9, #60a5fa);
        }
        .pod-app-shell {
          height: 100dvh;
          min-height: 0;
          overflow: hidden;
          box-sizing: border-box;
        }
        .pod-app-inner {
          height: 100%;
          min-height: 0;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }
        .pod-main-grid {
          display: grid;
          grid-template-columns: 390px minmax(0, 1fr) 450px;
          gap: 12px;
          height: 100%;
          min-height: 0;
          flex: 1;
          width: 100%;
          box-sizing: border-box;
        }
        .pod-grid-child {
          height: 100%;
          min-height: 0;
          min-width: 0;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          overflow-y: auto;
          overflow-x: hidden;
        }
        .pod-grid-child-center {
          height: 100%;
          min-height: 0;
          min-width: 0;
          overflow: hidden;
        }
        @media (max-width: 900px) {
          .pod-app-shell {
            height: auto;
            min-height: 100dvh;
            overflow: auto;
          }
          .pod-app-inner {
            height: auto;
          }
          .pod-main-grid {
            grid-template-columns: 1fr;
            height: auto;
          }
          .pod-grid-child,
          .pod-grid-child-center {
            height: auto;
            overflow: visible;
          }
        }
      `}</style>

      <StartupTutorial open={tutorialOpen} onOpenChange={setTutorialOpen} />

      <div className="pod-app-inner">
<div className="pod-main-grid">
         <div className="pod-grid-child">
         <ScanResultsPanel
  file={file}
  uploadInputKey={uploadInputKey}
  actionMessage={actionMessage}
  downloadMessage={downloadMessage}
  handleFileChange={handleFileChange}
  setActionMessage={setActionMessage}
  handleQuickFix={handleQuickFix}
  handleDownloadFixedPng={handleDownloadApparelPng}
  handleResetDesign={handleResetDesign}
  autoFixApplied={hasAutoFixApplied}
  img={img}
  checks={checks}
  printScore={displayPrintScore}
  hasTransparency={hasTransparency}
  thinLinePercent={thinLinePercent}
  specks={specks}
  imgW={imgW}
  imgH={imgH}
  effectiveBounds={effectiveBounds}
  coverage={coverage}
  transform={transform}
  previewSize={previewSize}
  inspectZoom={inspectZoom}
  setInspectZoom={setInspectZoom}
  practicalPrintDpi={practicalPrintDpi}
  targetCanvasW={targetCanvasW}
  targetCanvasH={targetCanvasH}
  onOpenTutorial={() => setTutorialOpen(true)}
  onOpenCustomSize={handleOpenCustomSize}
  onOpenProductPresets={handleOpenProductPresets}
  onOpenExportPackZip={handleOpenExportPackZip}
  onOpenBatchCheck={handleOpenBatchCheck}
  batchCheckOpen={batchCheckOpen}
  onLoadFileFromBatch={handleLoadFileFromBatch}
  onOpenBatchExport={handleOpenBatchExport}
  batchExportOpen={batchExportOpen}
  onDownloadBatchExportZip={handleDownloadBatchExportZip}
  uploadTarget={uploadTarget}
  toolsTab={toolsTab}
  onToolsTabChange={setToolsTab}
/>
</div>

<div className="pod-grid-child-center">
          {toolsTab === 'converter' ? (
            <ProductConverterPanel onDownloadConverted={handleDownloadConvertedPng} />
          ) : (
          <DesignPreviewPanel
  previewCanvasRef={previewCanvasRef}
  previewCanvasW={previewCanvasW}
  previewCanvasH={previewCanvasH}
  totalScale={totalScale}
  previewBackground={previewBackground}
  setPreviewBackground={setPreviewBackground}
  setActionMessage={setActionMessage}
  isScanning={isScanning}
/>
          )}
</div>

<div className="pod-grid-child">
{toolsTab !== 'converter' ? (
<IssueBucketsPanel
  img={img}
  checks={checks}
  downloadMessage={downloadMessage}
  file={file}
  fileSize={fileSize}
  colourProfileStatus={colourProfileStatus}
  hasTransparency={hasTransparency}
  practicalPrintDpi={practicalPrintDpi}
  standardTargetLine={standardTargetLine}
  redbubbleTargetLine={redbubbleTargetLine}
  printfulTargetLine={printfulTargetLine}
  teePublicTargetLine={teePublicTargetLine}
  selectedRedbubbleDownloadLabel={selectedRedbubbleDownloadLabel}
  selectedPrintfulDownloadLabel={selectedPrintfulDownloadLabel}
  teePublicDownloadLabel={teePublicDownloadLabel}
  selectedRedbubblePreset={selectedRedbubblePreset}
  setSelectedRedbubblePreset={setSelectedRedbubblePreset}
  selectedPrintfulPreset={selectedPrintfulPreset}
  setSelectedPrintfulPreset={setSelectedPrintfulPreset}
  setActivePresetSystem={setActivePresetSystem}
  uploadTarget={uploadTarget}
  setUploadTarget={setUploadTarget}
  handleDownloadApparelPng={handleDownloadApparelPng}
  handleDownloadRedbubblePng={handleDownloadRedbubblePng}
  handleDownloadPrintfulPng={handleDownloadPrintfulPng}
  handleDownloadTeePublicPng={handleDownloadTeePublicPng}
  handleDownloadCustomPng={handleDownloadCustomPng}
  handleDownloadExportPackZip={handleDownloadExportPackZip}
  customSizeFocusToken={customSizeFocusToken}
  productPresetsFocusToken={productPresetsFocusToken}
  exportPackZipFocusToken={exportPackZipFocusToken}
  autoFixApplied={hasAutoFixApplied}
/>
) : null}
</div>
      </div>

      <canvas ref={analysisCanvasRef} style={{ display: 'none' }} />
      </div>
    </main>
  );
}

