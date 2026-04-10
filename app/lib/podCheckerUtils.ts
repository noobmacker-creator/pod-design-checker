export function statusColor(status: 'pass' | 'warn' | 'fail' | 'info') {
    switch (status) {
      case 'pass':
        return '#22c55e';
      case 'warn':
        return '#f59e0b';
      case 'fail':
        return '#ef4444';
      default:
        return '#60a5fa';
    }
  }
  
  export function statusIcon(status: 'pass' | 'warn' | 'fail' | 'info') {
    switch (status) {
      case 'pass':
        return '✔';
      case 'warn':
        return '⚠';
      case 'fail':
        return '✘';
      default:
        return '•';
    }
  }
  
  export function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  
export function detectFakeTransparencyBackground(imageData: ImageData) {
  const { data } = imageData;

  let checkerToneA = 0;
  let checkerToneB = 0;
  let checked = 0;

  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

    if (a !== 255) continue;

    checked++;

    const maxChannel = Math.max(r, g, b);
    const minChannel = Math.min(r, g, b);
    const average = (r + g + b) / 3;
    const isNeutralGray = maxChannel - minChannel <= 10;

    if (!isNeutralGray) continue;

    if (average >= 22 && average <= 40) checkerToneA++;
    if (average >= 41 && average <= 68) checkerToneB++;
  }

  const checkerPixels = checkerToneA + checkerToneB;
  const ratio = checked === 0 ? 0 : checkerPixels / checked;
  const balancedPattern =
    checkerToneA >= 20 &&
    checkerToneB >= 20 &&
    Math.min(checkerToneA, checkerToneB) / Math.max(checkerToneA, checkerToneB) >= 0.35;

  return {
    checkerPixels,
    ratio,
    detected: ratio > 0.08 && balancedPattern,
  };
}
  
  function parsePngDpi(arrayBuffer: ArrayBuffer): number | null {
    try {
      const bytes = new Uint8Array(arrayBuffer);
      const pngSig = [137, 80, 78, 71, 13, 10, 26, 10];
  
      for (let i = 0; i < pngSig.length; i++) {
        if (bytes[i] !== pngSig[i]) return null;
      }
  
      let offset = 8;
  
      while (offset < bytes.length) {
        const length =
          (bytes[offset] << 24) |
          (bytes[offset + 1] << 16) |
          (bytes[offset + 2] << 8) |
          bytes[offset + 3];
  
        const type = String.fromCharCode(
          bytes[offset + 4],
          bytes[offset + 5],
          bytes[offset + 6],
          bytes[offset + 7]
        );
  
        if (type === 'pHYs') {
          const dataOffset = offset + 8;
          const xPpu =
            (bytes[dataOffset] << 24) |
            (bytes[dataOffset + 1] << 16) |
            (bytes[dataOffset + 2] << 8) |
            bytes[dataOffset + 3];
          const unit = bytes[dataOffset + 8];
  
          if (unit === 1) {
            return Math.round(xPpu / 39.3701);
          }
          return null;
        }
  
        offset += 12 + length;
      }
  
      return null;
    } catch {
      return null;
    }
  }
  
  function parseJpegDpi(arrayBuffer: ArrayBuffer): number | null {
    try {
      const view = new DataView(arrayBuffer);
      if (view.getUint16(0) !== 0xffd8) return null;
  
      let offset = 2;
      while (offset < view.byteLength) {
        if (view.getUint8(offset) !== 0xff) break;
  
        const marker = view.getUint8(offset + 1);
        const length = view.getUint16(offset + 2);
  
        if (marker === 0xe0) {
          const identifier =
            String.fromCharCode(view.getUint8(offset + 4)) +
            String.fromCharCode(view.getUint8(offset + 5)) +
            String.fromCharCode(view.getUint8(offset + 6)) +
            String.fromCharCode(view.getUint8(offset + 7)) +
            String.fromCharCode(view.getUint8(offset + 8));
  
            if (identifier === 'JFIF\0') {
              const units = view.getUint8(offset + 11);
              const xDensity = view.getUint16(offset + 12);
  
              if (units === 1) return xDensity;
              if (units === 2) return Math.round(xDensity * 2.54);
              return null;
            }
        }
  
        offset += 2 + length;
      }
  
      return null;
    } catch {
      return null;
    }
  }
  
  export function getImageDpi(file: File, arrayBuffer: ArrayBuffer): number | null {
    const type = file.type.toLowerCase();
    if (type.includes('png')) return parsePngDpi(arrayBuffer);
    if (type.includes('jpeg') || type.includes('jpg')) return parseJpegDpi(arrayBuffer);
    return null;
  }
  
  export type Bounds = {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  
  export function detectBoundsAndCoverage(
    imageData: ImageData,
    coverageSampleStep = 8,
    alphaThreshold = 20
  ): { bounds: Bounds | null; coverage: number } {
    const { width, height, data } = imageData;
  
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
  
    let solid = 0;
    let sampled = 0;
  
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const alpha = data[i + 3];
  
        if (alpha > alphaThreshold) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
  
        if (x % coverageSampleStep === 0 && y % coverageSampleStep === 0) {
          sampled++;
          if (alpha > alphaThreshold) {
            solid++;
          }
        }
      }
    }
  
    if (maxX === -1 || maxY === -1) {
      return { bounds: null, coverage: 0 };
    }
  
    return {
      bounds: {
        x: minX,
        y: minY,
        w: Math.max(1, maxX - minX + 1),
        h: Math.max(1, maxY - minY + 1),
      },
      coverage: sampled === 0 ? 0 : (solid / sampled) * 100,
    };
  }
  
  export function detectSpecks(imageData: ImageData, thresholdAlpha = 40, maxSpeckPixels = 12) {
    const { width, height, data } = imageData;
  
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
  
        while (stack.length > 0) {
          const [cx, cy] = stack.pop()!;
          blobSize++;
  
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
  
            if (isSolid(nx, ny)) {
              stack.push([nx, ny]);
            }
          }
        }
  
        if (blobSize <= maxSpeckPixels) {
          specks++;
        }
      }
    }
  
    return specks;
  }
  
export function estimateThinLines(imageData: ImageData) {
  const { width, height, data } = imageData;
  let thinHits = 0;
  let checked = 0;
  
  for (let y = 2; y < height - 2; y += 4) {
      for (let x = 2; x < width - 2; x += 4) {
        const i = (y * width + x) * 4;
        const a = data[i + 3];
  
      if (a > 120) {
        checked++;
  
        let horizontal = 0;
        for (let nx = -2; nx <= 2; nx++) {
          const ni = (y * width + (x + nx)) * 4;
            if (data[ni + 3] > 40) horizontal++;
          }
  
          let vertical = 0;
        for (let ny = -2; ny <= 2; ny++) {
          const ni = ((y + ny) * width + x) * 4;
          if (data[ni + 3] > 40) vertical++;
        }
  
        let nearbySolid = 0;
        for (let sy = -1; sy <= 1; sy++) {
          for (let sx = -1; sx <= 1; sx++) {
            const ni = ((y + sy) * width + (x + sx)) * 4;
            if (data[ni + 3] > 120) nearbySolid++;
          }
        }

        // Skip tiny isolated bits so rough texture does not look like thin line risk.
        if (nearbySolid < 3) continue;

        if (horizontal <= 2 || vertical <= 2) thinHits++;
      }
    }
  }
  
    if (checked === 0) return 0;
    return (thinHits / checked) * 100;
  }
  
  export function getEffectiveArtBounds(
    originalBounds: Bounds | null,
    transform: { scale: number; offsetX: number; offsetY: number }
  ): Bounds | null {
    if (!originalBounds) return null;
  
    return {
      x: originalBounds.x * transform.scale + transform.offsetX,
      y: originalBounds.y * transform.scale + transform.offsetY,
      w: originalBounds.w * transform.scale,
      h: originalBounds.h * transform.scale,
    };
  }
  
  export function getDesignCanvasSize(effectiveBounds: Bounds | null, img: HTMLImageElement | null) {
    if (effectiveBounds) {
      return {
        width: Math.max(Math.round(effectiveBounds.w + 260), 900),
        height: Math.max(Math.round(effectiveBounds.h + 260), 900),
      };
    }
  
    if (img) {
      return {
        width: Math.max(img.naturalWidth + 260, 900),
        height: Math.max(img.naturalHeight + 260, 900),
      };
    }
  
    return { width: 900, height: 900 };
  }
