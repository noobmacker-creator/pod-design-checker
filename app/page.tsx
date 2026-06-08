'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  formatBytes,
  detectFakeTransparencyBackground,
  getImageDpi,
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

import DesignPreviewPanel, { type PreviewBackground } from './components/DesignPreviewPanel';

import IssueBucketsPanel from './components/IssueBucketsPanel';
import ScanResultsPanel from './components/ScanResultsPanel';

type Bounds = {
  x: number;
  y: number;
  w: number;
  h: number;
};

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

// Stray Speck Check: only counts small blobs outside an expanded artwork safe area.
function detectStraySpecks(imageData: ImageData, thresholdAlpha = 40, maxSpeckPixels = 12): number {
  const { width, height, data } = imageData;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] > thresholdAlpha) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX === -1) return 0;

  const padding = Math.max(40, Math.round(width * 0.02), Math.round(height * 0.02));
  const safeMinX = Math.max(0, minX - padding);
  const safeMinY = Math.max(0, minY - padding);
  const safeMaxX = Math.min(width - 1, maxX + padding);
  const safeMaxY = Math.min(height - 1, maxY + padding);

  const isInsideSafeArea = (x: number, y: number) =>
    x >= safeMinX && x <= safeMaxX && y >= safeMinY && y <= safeMaxY;

  const visited = new Uint8Array(width * height);
  let specks = 0;

  function isSolid(x: number, y: number) {
    const i = (y * width + x) * 4;
    return data[i + 3] > thresholdAlpha;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex = y * width + x;
      if (visited[pixelIndex]) continue;
      visited[pixelIndex] = 1;
      if (!isSolid(x, y)) continue;

      const stack: [number, number][] = [[x, y]];
      let blobSize = 0;
      let touchesSafeArea = false;

      while (stack.length > 0) {
        const [cx, cy] = stack.pop()!;
        blobSize++;
        if (isInsideSafeArea(cx, cy)) touchesSafeArea = true;

        const neighbors = [
          [cx - 1, cy],
          [cx + 1, cy],
          [cx, cy - 1],
          [cx, cy + 1],
          [cx - 1, cy - 1],
          [cx + 1, cy - 1],
          [cx - 1, cy + 1],
          [cx + 1, cy + 1],
        ];

        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = ny * width + nx;
          if (visited[ni]) continue;
          visited[ni] = 1;
          if (isSolid(nx, ny)) stack.push([nx, ny]);
        }
      }

      if (blobSize <= maxSpeckPixels && !touchesSafeArea) {
        specks++;
      }
    }
  }

  return specks;
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

  const [originalBounds, setOriginalBounds] = useState<Bounds | null>(null);
  const [coverage, setCoverage] = useState(0);
  const [specks, setSpecks] = useState(0);
  const [thinLinePercent, setThinLinePercent] = useState(0);

  const [fakeTransparencyDetected, setFakeTransparencyDetected] = useState(false);
  const [shirtFitTone, setShirtFitTone] = useState<'dark' | 'light' | 'colourful' | 'mid' | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('pod');
  const [previewSize, setPreviewSize] = useState<PreviewSize>(DEFAULT_PREVIEW_SIZE);
  const [inspectZoom, setInspectZoom] = useState(1);
  const [previewBackground, setPreviewBackground] = useState<PreviewBackground>('checker');

  const [transform, setTransform] = useState({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const [originalTransform, setOriginalTransform] = useState<{
    scale: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [autoFixPreviewMode, setAutoFixPreviewMode] = useState<'fixed' | 'original'>('fixed');

  const [actionMessage, setActionMessage] = useState('Upload a design to begin.');
  const [downloadMessage, setDownloadMessage] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [showSafeAreaOverlay, setShowSafeAreaOverlay] = useState(false);
  const [hasAutoFixApplied, setHasAutoFixApplied] = useState(false);
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [selectedRedbubblePreset, setSelectedRedbubblePreset] = useState<RedbubblePresetId>('apparel');
  const [selectedPrintfulPreset, setSelectedPrintfulPreset] = useState<PrintfulPresetId>('dtg-dtf-apparel');
  const [activePresetSystem, setActivePresetSystem] = useState<'redbubble' | 'printful' | 'teepublic'>('redbubble');

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);

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
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = img.naturalWidth;
canvas.height = img.naturalHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const res = detectBoundsAndCoverage(imageData, 10);
    setOriginalBounds(res.bounds);
    setCoverage(res.coverage);
    setSpecks(detectStraySpecks(imageData));
    setThinLinePercent(estimateThinLines(imageData));
    const fakeTransparency = detectFakeTransparencyBackground(imageData);
    setFakeTransparencyDetected(fakeTransparency.detected);
    
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

    setWhiteEdgeCheck(getWhiteEdgeHaloCheck(imageData));
    setSemiTransparencyCheck(getSemiTransparencyRiskCheck(imageData));
    setCutOffEdgeCheck(getCutOffEdgeRiskCheck(imageData));
    setLowContrastCheck(getLowContrastRiskCheck(imageData));
    setTinyTextCheck(getTinyTextRiskCheck(imageData));
    setCompressionArtifactCheck(getCompressionArtifactRiskCheck(imageData));
    setEmptyPaddingCheck(getEmptyPaddingRiskCheck(imageData));
    setPixelationCheck(getPixelationRiskCheck(imageData));
    setUnevenPaddingCheck(getUnevenPaddingRiskCheck(imageData));
    setOversizedArtworkCheck(getOversizedArtworkRiskCheck(imageData));
    setSolidBackgroundBoxCheck(getSolidBackgroundBoxRiskCheck(imageData));

    // Shirt Colour Fit: estimate if the artwork is mostly dark, mostly light, or colourful.
    // Only opaque pixels are counted so transparent areas are ignored.
    const data = imageData.data;
    let opaqueCount = 0;
    let lumaSum = 0;
    let colourfulnessSum = 0;
    let nearWhiteCount = 0;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha < 128) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      lumaSum += 0.299 * r + 0.587 * g + 0.114 * b;
      colourfulnessSum += Math.max(r, g, b) - Math.min(r, g, b);
      // Count solid or near-white pixels for the White Background Risk check.
      if (r >= 240 && g >= 240 && b >= 240) {
        nearWhiteCount++;
      }
      opaqueCount++;
    }

    // White Background Risk: ratio of visible pixels that are solid/near-white.
    setWhitePixelRatio(opaqueCount === 0 ? 0 : nearWhiteCount / opaqueCount);

    if (opaqueCount === 0) {
      setShirtFitTone(null);
    } else {
      const avgLuma = lumaSum / opaqueCount;
      const avgColourfulness = colourfulnessSum / opaqueCount;
      if (avgColourfulness > 60) {
        setShirtFitTone('colourful');
      } else if (avgLuma < 90) {
        setShirtFitTone('dark');
      } else if (avgLuma > 170) {
        setShirtFitTone('light');
      } else {
        setShirtFitTone('mid');
      }
    }
  }, [img]);

  const effectiveBounds = useMemo(() => {
    return getEffectiveArtBounds(originalBounds, transform);
  }, [originalBounds, transform]);

  const designCanvasSize = useMemo(() => {
    return getDesignCanvasSize(effectiveBounds, img);
  }, [effectiveBounds, img]);

  const previewTransform = useMemo(() => {
    if (hasAutoFixApplied && autoFixPreviewMode === 'original' && originalTransform) {
      return originalTransform;
    }
    return transform;
  }, [hasAutoFixApplied, autoFixPreviewMode, originalTransform, transform]);

  const previewEffectiveBounds = useMemo(() => {
    return getEffectiveArtBounds(originalBounds, previewTransform);
  }, [originalBounds, previewTransform]);

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

  const checks: CheckItem[] = useMemo(() => {
    if (!imgW || !imgH) return [];

    const exactSize = imgW === targetCanvasW && imgH === targetCanvasH;
    const aspect = imgW / imgH;
    const aspectClose = Math.abs(aspect - targetCanvasAspect) < 0.01;
    const largerThanTarget = imgW >= targetCanvasW && imgH >= targetCanvasH;

    // Shirt Colour Fit: compare the artwork tone against common shirt colours.
    // Shirt tone groups: 'light' shirts, 'dark' shirts, and red (medium colourful).
    const shirtColours: { name: string; tone: 'light' | 'dark' | 'red' }[] = [
      { name: 'White', tone: 'light' },
      { name: 'Black', tone: 'dark' },
      { name: 'Dark Grey', tone: 'dark' },
      { name: 'Navy', tone: 'dark' },
      { name: 'Red', tone: 'red' },
      { name: 'Pink', tone: 'light' },
      { name: 'Light Blue', tone: 'light' },
    ];

    const shirtFitChecks: CheckItem[] = shirtColours.map((shirt) => {
      let status: CheckStatus = 'warn';
      let message = `Check first on ${shirt.name}. Some parts may blend into the shirt colour.`;

      if (shirtFitTone === null) {
        status = 'info';
        message = `Could not measure artwork colours clearly for ${shirt.name}.`;
      } else if (shirtFitTone === 'dark') {
        if (shirt.tone === 'light') {
          status = 'pass';
          message = `Good fit on ${shirt.name}. Artwork should show clearly.`;
        } else if (shirt.tone === 'dark') {
          status = 'fail';
          message = `Not recommended on ${shirt.name}. Dark artwork may disappear on dark shirts.`;
        } else {
          status = 'warn';
          message = `Check first on ${shirt.name}. Some parts may blend into the shirt colour.`;
        }
      } else if (shirtFitTone === 'light') {
        if (shirt.tone === 'dark') {
          status = 'pass';
          message = `Good fit on ${shirt.name}. Artwork should show clearly.`;
        } else if (shirt.tone === 'light') {
          status = 'fail';
          message = `Not recommended on ${shirt.name}. Light artwork may disappear on light shirts.`;
        } else {
          status = 'warn';
          message = `Check first on ${shirt.name}. Some parts may blend into the shirt colour.`;
        }
      } else if (shirtFitTone === 'colourful') {
        if (shirt.tone === 'light') {
          status = 'pass';
          message = `Good fit on ${shirt.name}. Artwork should show clearly.`;
        } else {
          status = 'warn';
          message = `Check first on ${shirt.name}. Some parts may blend into the shirt colour.`;
        }
      } else {
        // 'mid' tone: not clearly dark or light, so always worth checking.
        status = 'warn';
        message = `Check first on ${shirt.name}. Some parts may blend into the shirt colour.`;
      }

      return {
        label: `Shirt Fit: ${shirt.name}`,
        status,
        message,
      };
    });

    return [
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
      ...shirtFitChecks,
    ];
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
    shirtFitTone,
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

  function drawBoundsOverlay(
    ctx: CanvasRenderingContext2D,
    bx: number,
    by: number,
    bw: number,
    bh: number
  ) {
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(bx, by, bw, bh);
    ctx.setLineDash([]);

    const cx = bx + bw / 2;
    const cy = by + bh / 2;

    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(cx - 18, cy);
    ctx.lineTo(cx + 18, cy);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, cy - 18);
    ctx.lineTo(cx, cy + 18);
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

      const drawW = img.naturalWidth * previewTransform.scale;
      const drawH = img.naturalHeight * previewTransform.scale;
      const drawX = previewTransform.offsetX;
      const drawY = previewTransform.offsetY;

      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      if (previewEffectiveBounds) {
        drawBoundsOverlay(ctx, previewEffectiveBounds.x, previewEffectiveBounds.y, previewEffectiveBounds.w, previewEffectiveBounds.h);
      }
    }

    if (viewMode === 'design') {
      canvas.width = previewDesignCanvasSize.width;
      canvas.height = previewDesignCanvasSize.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 3;
      ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

      const drawW = img.naturalWidth * previewTransform.scale;
      const drawH = img.naturalHeight * previewTransform.scale;

      if (previewEffectiveBounds) {
        const targetX = (canvas.width - previewEffectiveBounds.w) / 2;
        const targetY = (canvas.height - previewEffectiveBounds.h) / 2;

        const shiftX = targetX - previewEffectiveBounds.x;
        const shiftY = targetY - previewEffectiveBounds.y;

        const drawX = previewTransform.offsetX + shiftX;
        const drawY = previewTransform.offsetY + shiftY;

        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        drawBoundsOverlay(ctx, targetX, targetY, previewEffectiveBounds.w, previewEffectiveBounds.h);
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

      const drawW = img.naturalWidth * previewTransform.scale * mapX * mockupScale;
const drawH = img.naturalHeight * previewTransform.scale * mapY * mockupScale;
const drawX = SHIRT_PRINT_X + previewTransform.offsetX * mapX + mockupOffsetX;
const drawY = SHIRT_PRINT_Y + previewTransform.offsetY * mapY + mockupOffsetY;

      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      if (previewEffectiveBounds) {
        drawBoundsOverlay(
          ctx,
          SHIRT_PRINT_X + previewEffectiveBounds.x * mapX,
          SHIRT_PRINT_Y + previewEffectiveBounds.y * mapY,
          previewEffectiveBounds.w * mapX,
          previewEffectiveBounds.h * mapY
        );
      }
    }
  }, [img, shirtImg, previewTransform, previewEffectiveBounds, viewMode, previewDesignCanvasSize, mockupOffsetX, mockupOffsetY, mockupScale]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
  
    setIsScanning(true);
    setHasAutoFixApplied(false);
    setOriginalTransform(null);
    setAutoFixPreviewMode('fixed');
    setPreviewBackground('checker');
    setShowSafeAreaOverlay(false);

    if (fileUrl) URL.revokeObjectURL(fileUrl);
  
    setFile(selected);
    setFileSize(selected.size);
  
    const arrayBuffer = await selected.arrayBuffer();
    setDpiMetadata(getImageDpi(selected, arrayBuffer));
  
    const url = URL.createObjectURL(selected);
    setFileUrl(url);
  
    setActionMessage('Scanning design...');
  
    const image = new Image();
  
    image.onload = () => {
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
      setTimeout(() => setIsScanning(false), 600);
    };
  
    image.onerror = () => {
      setActionMessage('Could not load that image.');
      setTimeout(() => setIsScanning(false), 600);
    };
  
    image.src = url;
  }

  function handleQuickFix() {
    if (!originalBounds) return;

    setOriginalTransform({ ...transform });
    setAutoFixPreviewMode('fixed');
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
  
    setTransform({
      scale: Math.round(nextScale * 1000) / 1000,
      offsetX: Math.round(x),
      offsetY: Math.round(y),
    });
  
    setActionMessage('Auto Fix applied. Artwork was centered and moved into a safer print area. Review the preview, then download the fixed PNG.');
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
    setHasTransparency(null);
    setWhitePixelRatio(0);
    setOriginalBounds(null);
    setCoverage(0);
    setSpecks(0);
    setThinLinePercent(0);
    setFakeTransparencyDetected(false);
    setShirtFitTone(null);

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

    setHasAutoFixApplied(false);
    setOriginalTransform(null);
    setAutoFixPreviewMode('fixed');
    setIsScanning(false);
    setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
    setMockupOffsetX(0);
    setMockupOffsetY(0);
    setMockupScale(1);
    setInspectZoom(1);
    setPreviewSize(DEFAULT_PREVIEW_SIZE);
    setPreviewBackground('checker');
    setShowSafeAreaOverlay(false);
    setViewMode('pod');
    setActionMessage('Upload a design to begin.');
    setDownloadMessage('');
    setUploadInputKey((key) => key + 1);
  }

  function toSafeSlug(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  
  function downloadPngForSize(width: number, height: number, label: string, filenameLabel: string) {
    if (!img) return;

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width;
  exportCanvas.height = height;

  const ctx = exportCanvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  ctx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);

  const fitScale = Math.min(exportCanvas.width / CANVAS_W, exportCanvas.height / CANVAS_H);
  const padX = (exportCanvas.width - CANVAS_W * fitScale) / 2;
  const padY = (exportCanvas.height - CANVAS_H * fitScale) / 2;

  const drawW = img.naturalWidth * transform.scale * fitScale;
  const drawH = img.naturalHeight * transform.scale * fitScale;
  const drawX = transform.offsetX * fitScale + padX;
  const drawY = transform.offsetY * fitScale + padY;

  ctx.drawImage(img, drawX, drawY, drawW, drawH);

  const link = document.createElement('a');
  const safeName = toSafeSlug(filenameLabel) || 'pod-checker-export';
  link.download = `${safeName}-${width}x${height}.png`;
  link.href = exportCanvas.toDataURL('image/png');
  link.click();

  setDownloadMessage(`Download ready. Use this fixed transparent PNG (${label} ${width}×${height}) for your POD upload.`);
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

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #140c08 0%, #111827 45%, #0f172a 100%)',
        color: '#f9fafb',
        fontFamily: 'Arial, Helvetica, sans-serif',
        padding: '24px',
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
      `}</style>

<div style={{ width: '100%', padding: '0 20px' }}>


        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '400px minmax(0, 1fr) 360px',
gap: 16,
          }}
        >
         <div style={{ minWidth: 0, width: '100%', maxWidth: '100%' }}>
         <ScanResultsPanel
  file={file}
  uploadInputKey={uploadInputKey}
  actionMessage={actionMessage}
  downloadMessage={downloadMessage}
  handleFileChange={handleFileChange}
  viewMode={viewMode}
  setViewMode={setViewMode}
  setActionMessage={setActionMessage}
  handleQuickFix={handleQuickFix}
  handleDownloadFixedPng={handleDownloadApparelPng}
  handleResetDesign={handleResetDesign}
  autoFixApplied={hasAutoFixApplied}
  img={img}
  checks={checks}
  printScore={printScore}
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
  practicalPrintDpi={practicalPrintDpi}
  targetCanvasW={targetCanvasW}
  targetCanvasH={targetCanvasH}
/>
</div>

          <DesignPreviewPanel
  previewCanvasRef={previewCanvasRef}
  imgW={imgW}
  imgH={imgH}
  previewSize={previewSize}
  inspectZoom={inspectZoom}
  practicalPrintDpi={practicalPrintDpi}
  previewCanvasW={previewCanvasW}
  previewCanvasH={previewCanvasH}
  totalScale={totalScale}
  previewBackground={previewBackground}
  setPreviewBackground={setPreviewBackground}
  setPreviewSize={setPreviewSize}
  setInspectZoom={setInspectZoom}
  setActionMessage={setActionMessage}
  autoFixApplied={hasAutoFixApplied}
  autoFixPreviewMode={autoFixPreviewMode}
  setAutoFixPreviewMode={setAutoFixPreviewMode}
  isScanning={isScanning}
  viewMode={viewMode}
  showSafeAreaOverlay={showSafeAreaOverlay}
  setShowSafeAreaOverlay={setShowSafeAreaOverlay}
/>
<IssueBucketsPanel
  isScanning={isScanning}
  img={img}
  checks={checks}
  downloadMessage={downloadMessage}
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
  handleDownloadApparelPng={handleDownloadApparelPng}
  handleDownloadRedbubblePng={handleDownloadRedbubblePng}
  handleDownloadPrintfulPng={handleDownloadPrintfulPng}
  handleDownloadTeePublicPng={handleDownloadTeePublicPng}
/>
        </div>
        
      <canvas ref={analysisCanvasRef} style={{ display: 'none' }} />
      </div>
    </main>
  );
}
