import type { CheckItem, CheckStatus } from './podCheckerTypes';

export function getWhiteEdgeHaloCheck(imageData: ImageData): CheckItem {
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
      if (a < 40) continue;
      visiblePixels++;

      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
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

export function getSemiTransparencyRiskCheck(imageData: ImageData): CheckItem {
  const { data } = imageData;
  let solidPixels = 0;
  let semiTransparentPixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 20) {
      continue;
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

export function detectStraySpecks(imageData: ImageData, thresholdAlpha = 40, maxSpeckPixels = 12): number {
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

// Cut-Off Edge Risk: looks for visible artwork sitting in a small band around the
// outside of the uploaded file. That often means the design is cropped too tight.
export function getCutOffEdgeRiskCheck(imageData: ImageData): CheckItem {
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
export function getLowContrastRiskCheck(imageData: ImageData): CheckItem {
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
export function getTinyTextRiskCheck(imageData: ImageData): CheckItem {
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
export function getCompressionArtifactRiskCheck(imageData: ImageData): CheckItem {
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
export function getEmptyPaddingRiskCheck(imageData: ImageData): CheckItem {
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
export function getPixelationRiskCheck(imageData: ImageData): CheckItem {
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
export function getUnevenPaddingRiskCheck(imageData: ImageData): CheckItem {
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
export function getOversizedArtworkRiskCheck(imageData: ImageData): CheckItem {
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
export function getSolidBackgroundBoxRiskCheck(imageData: ImageData): CheckItem {
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
