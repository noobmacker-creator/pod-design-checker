'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

type CheckStatus = 'pass' | 'warn' | 'fail' | 'info';
type ViewMode = 'pod' | 'design' | 'shirt';
type PreviewSize = number;

type CheckItem = {
  label: string;
  status: CheckStatus;
  message: string;
};

type Bounds = {
  x: number;
  y: number;
  w: number;
  h: number;
};

const CANVAS_W = 4200;
const CANVAS_H = 4800;
const CANVAS_ASPECT = CANVAS_W / CANVAS_H;

const SAFE_BORDER = 6;
const SAFE_BOX = 180;
const AUTO_FIX_MARGIN = 60;

const VIEWPORT_W = 920;
const VIEWPORT_H = 920;
const DEFAULT_PREVIEW_SIZE =
  Math.min(VIEWPORT_W / CANVAS_W, VIEWPORT_H / CANVAS_H) * 0.9;

const SHIRT_W = 1600;
const SHIRT_H = 1900;
const SHIRT_PRINT_X = 400;
const SHIRT_PRINT_Y = 420;
const SHIRT_PRINT_W = 800;
const SHIRT_PRINT_H = 1000;

function statusColor(status: CheckStatus) {
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

function statusIcon(status: CheckStatus) {
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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
function detectFakeTransparencyBackground(imageData: ImageData) {
  const { data } = imageData;

  let darkA = 0;
  let darkB = 0;
  let checked = 0;

  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a !== 255) continue;

    checked++;

    if (r === 31 && g === 31 && b === 31) darkA++;
    if (r === 42 && g === 42 && b === 42) darkB++;
  }

  const checkerPixels = darkA + darkB;
  const ratio = checked === 0 ? 0 : checkerPixels / checked;

  return {
    checkerPixels,
    ratio,
    detected: ratio > 0.05,
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

function getImageDpi(file: File, arrayBuffer: ArrayBuffer): number | null {
  const type = file.type.toLowerCase();
  if (type.includes('png')) return parsePngDpi(arrayBuffer);
  if (type.includes('jpeg') || type.includes('jpg')) return parseJpegDpi(arrayBuffer);
  return null;
}

function detectBoundsAndCoverage(
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

function detectSpecks(imageData: ImageData, thresholdAlpha = 40, maxSpeckPixels = 12) {
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

function estimateThinLines(imageData: ImageData) {
  const { width, height, data } = imageData;
  let thinHits = 0;
  let checked = 0;

  for (let y = 2; y < height - 2; y += 4) {
    for (let x = 2; x < width - 2; x += 4) {
      const i = (y * width + x) * 4;
      const a = data[i + 3];

      if (a > 40) {
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

        if (horizontal <= 2 || vertical <= 2) thinHits++;
      }
    }
  }

  if (checked === 0) return 0;
  return (thinHits / checked) * 100;
}

function resizeImage(file: File) {
  return new Promise<HTMLImageElement>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      let w = img.width;
      let h = img.height;

      const max = 1200;

      if (w > max || h > max) {
        if (w > h) {
          h = h * (max / w);
          w = max;
        } else {
          w = w * (max / h);
          h = max;
        }
      }

      canvas.width = w;
      canvas.height = h;

      ctx.drawImage(img, 0, 0, w, h);

      const newImg = new Image();
      newImg.onload = () => resolve(newImg);
      newImg.src = canvas.toDataURL('image/png');
    };

    img.src = url;
  });
}
function getEffectiveArtBounds(
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

function getDesignCanvasSize(effectiveBounds: Bounds | null, img: HTMLImageElement | null) {
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

export default function Page() {
  
  const [file, setFile] = useState<File | null>(null);
  const [showMoreFixes, setShowMoreFixes] = useState(false);
  const [fileUrl, setFileUrl] = useState('');
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  const [imgW, setImgW] = useState(0);
  const [imgH, setImgH] = useState(0);
  const [fileSize, setFileSize] = useState(0);

  const [dpiMetadata, setDpiMetadata] = useState<number | null>(null);
  const [hasTransparency, setHasTransparency] = useState<boolean | null>(null);

  const [originalBounds, setOriginalBounds] = useState<Bounds | null>(null);
  const [coverage, setCoverage] = useState(0);
  const [specks, setSpecks] = useState(0);
  const [thinLinePercent, setThinLinePercent] = useState(0);
  let printScore = 0;

if (img) {
  printScore = 100;

  if (imgW !== CANVAS_W || imgH !== CANVAS_H) {
    printScore -= 20;
  }

  if (hasTransparency === false) {
    printScore -= 25;
  }

  if (specks > 0) {
    printScore -= 8;
  }

  if (thinLinePercent >= 18) {
    printScore -= 12;
  } else if (thinLinePercent >= 8) {
    printScore -= 5;
  }

  if (printScore < 0) {
    printScore = 0;
  }
}

const [fakeTransparencyDetected, setFakeTransparencyDetected] = useState(false);
const [viewMode, setViewMode] = useState<ViewMode>('pod');
const [previewSize, setPreviewSize] = useState<PreviewSize>(DEFAULT_PREVIEW_SIZE);
const [inspectZoom, setInspectZoom] = useState(1);

const [transform, setTransform] = useState({
  scale: 1,
  offsetX: 0,
  offsetY: 0,
});

const [actionMessage, setActionMessage] = useState('Upload a design to begin.');
const [downloadMessage, setDownloadMessage] = useState('');

const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);

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
    setSpecks(detectSpecks(imageData, 120, 3));
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
  }, [img]);

  const effectiveBounds = useMemo(() => {
    return getEffectiveArtBounds(originalBounds, transform);
  }, [originalBounds, transform]);

  const designCanvasSize = useMemo(() => {
    return getDesignCanvasSize(effectiveBounds, img);
  }, [effectiveBounds, img]);

  const previewCanvasW = useMemo(() => {
    if (viewMode === 'pod') return CANVAS_W;
    if (viewMode === 'design') return designCanvasSize.width;
    return SHIRT_W;
  }, [viewMode, designCanvasSize]);

  const previewCanvasH = useMemo(() => {
    if (viewMode === 'pod') return CANVAS_H;
    if (viewMode === 'design') return designCanvasSize.height;
    return SHIRT_H;
  }, [viewMode, designCanvasSize]);

  const totalScale = useMemo(() => {
    return previewSize * inspectZoom;
  }, [previewSize, inspectZoom]);

  const practicalPrintDpi = useMemo(() => {
    if (!imgW || !imgH) return 0;
    const dpiX = imgW / 14;
    const dpiY = imgH / 16;
    return Math.round(Math.min(dpiX, dpiY));
  }, [imgW, imgH]);

  const designTooSmallStatus = useMemo(() => {
    if (!effectiveBounds) {
      return {
        status: 'warn' as CheckStatus,
        message: 'Could not measure artwork size clearly.',
      };
    }

    const widthRatio = effectiveBounds.w / CANVAS_W;
    const heightRatio = effectiveBounds.h / CANVAS_H;
    const areaRatio = (effectiveBounds.w * effectiveBounds.h) / (CANVAS_W * CANVAS_H);

    if (widthRatio >= 0.55 && heightRatio >= 0.55 && areaRatio >= 0.22) {
      return {
        status: 'pass' as CheckStatus,
        message: `Artwork fill looks healthy. Width ${(widthRatio * 100).toFixed(0)}% • Height ${(heightRatio * 100).toFixed(0)}%`,
      };
    }

    if (widthRatio >= 0.38 && heightRatio >= 0.38 && areaRatio >= 0.1) {
      return {
        status: 'warn' as CheckStatus,
        message: `Design may print a bit small. Width ${(widthRatio * 100).toFixed(0)}% • Height ${(heightRatio * 100).toFixed(0)}%`,
      };
    }

    return {
      status: 'fail' as CheckStatus,
      message: `Design looks too small and may print tiny. Width ${(widthRatio * 100).toFixed(0)}% • Height ${(heightRatio * 100).toFixed(0)}%`,
    };
  }, [effectiveBounds]);

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
        message: `Artwork is slightly off-center. It is ${horizontal} and ${vertical}.`,
      };
    }

    return {
      status: 'fail' as CheckStatus,
      message: `Artwork is noticeably off-center. It is ${horizontal} and ${vertical}.`,
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
message: "Safe but close to edge. For best results, use quick fix Auto ."
      };
    }

    return {
      status: 'fail' as CheckStatus,
      message: `Artwork is touching or very close to the ${SAFE_BORDER}px safety edge.`,
    };
  }, [effectiveBounds]);

  const checks: CheckItem[] = useMemo(() => {
    if (!imgW || !imgH) return [];

    const exactSize = imgW === CANVAS_W && imgH === CANVAS_H;
    const aspect = imgW / imgH;
    const aspectClose = Math.abs(aspect - CANVAS_ASPECT) < 0.01;
    const practicalGood = practicalPrintDpi >= 300;
    const largeEnough = imgW >= CANVAS_W && imgH >= CANVAS_H;

    return [
      {
        label: 'Canvas Size',
        status: exactSize ? 'pass' : largeEnough ? 'warn' : 'fail',
        message: exactSize
          ? `Correct size: ${imgW} × ${imgH}`
          : largeEnough
          ? `Larger than recommended. Consider resizing canvas to ${CANVAS_W} × ${CANVAS_H}.`
          : `Incorrect size. Recommended: ${CANVAS_W} × ${CANVAS_H}`,
      },
      {
        label: 'Aspect Ratio',
        status: aspectClose ? 'pass' : 'fail',
        message: aspectClose
          ? `Good aspect ratio: ${aspect.toFixed(3)}`
          : `Aspect ratio mismatch. Current: ${aspect.toFixed(3)}, recommended: ${CANVAS_ASPECT.toFixed(3)}`,
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
      {
        label: 'Artwork Size',
        status:
          effectiveBounds && effectiveBounds.w >= 2400 && effectiveBounds.h >= 2400
            ? 'pass'
            : 'warn',
        message: effectiveBounds
          ? `Detected artwork area: ${Math.round(effectiveBounds.w)} × ${Math.round(effectiveBounds.h)}`
          : 'Could not detect artwork bounds clearly.',
      },
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
        label: 'Speck Detector',
        status: specks === 0 ? 'pass' : specks < 25 ? 'warn' : 'fail',
        message:
          specks === 0
            ? 'No obvious specks detected.'
            : specks <= 2
            ? 'Specks detected. Clean up small stray marks before printing.'
            : `${specks} specks detected. Clean your design before printing.`,
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
    ];
  }, [
    imgW,
    imgH,
    hasTransparency,
    fileSize,
    practicalPrintDpi,
    effectiveBounds,
    designTooSmallStatus,
    offCenterStatus,
    safetyBorderStatus,
    specks,
    thinLinePercent,
    dpiMetadata,
    fakeTransparencyDetected,
  ]);

  function drawPodBackground(ctx: CanvasRenderingContext2D) {
    const size = 40;
    for (let y = 0; y < CANVAS_H; y += size) {
      for (let x = 0; x < CANVAS_W; x += size) {
        ctx.fillStyle =
          (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0 ? '#1f1f1f' : '#2a2a2a';
        ctx.fillRect(x, y, size, size);
      }
    }

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

  function drawPreview() {
    if (!img) return;

    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (viewMode === 'pod') {
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      drawPodBackground(ctx);

      const drawW = img.naturalWidth * transform.scale;
      const drawH = img.naturalHeight * transform.scale;
      const drawX = transform.offsetX;
      const drawY = transform.offsetY;

      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      if (effectiveBounds) {
        drawBoundsOverlay(ctx, effectiveBounds.x, effectiveBounds.y, effectiveBounds.w, effectiveBounds.h);
      }
    }

    if (viewMode === 'design') {
      canvas.width = designCanvasSize.width;
      canvas.height = designCanvasSize.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const square = 36;
      for (let y = 0; y < canvas.height; y += square) {
        for (let x = 0; x < canvas.width; x += square) {
          ctx.fillStyle =
            (Math.floor(x / square) + Math.floor(y / square)) % 2 === 0 ? '#1f1f1f' : '#2a2a2a';
          ctx.fillRect(x, y, square, square);
        }
      }

      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 3;
      ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

      const drawW = img.naturalWidth * transform.scale;
      const drawH = img.naturalHeight * transform.scale;

      if (effectiveBounds) {
        const targetX = (canvas.width - effectiveBounds.w) / 2;
        const targetY = (canvas.height - effectiveBounds.h) / 2;

        const shiftX = targetX - effectiveBounds.x;
        const shiftY = targetY - effectiveBounds.y;

        const drawX = transform.offsetX + shiftX;
        const drawY = transform.offsetY + shiftY;

        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        drawBoundsOverlay(ctx, targetX, targetY, effectiveBounds.w, effectiveBounds.h);
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

      ctx.fillStyle = '#dbe4f0';
      ctx.fillRect(0, 0, SHIRT_W, SHIRT_H);

      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(520, 190);
      ctx.lineTo(680, 130);
      ctx.lineTo(920, 130);
      ctx.lineTo(1080, 190);
      ctx.lineTo(1240, 360);
      ctx.lineTo(1160, 580);
      ctx.lineTo(1110, 1680);
      ctx.lineTo(490, 1680);
      ctx.lineTo(440, 580);
      ctx.lineTo(360, 360);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(710, 190);
      ctx.quadraticCurveTo(800, 250, 890, 190);
      ctx.lineTo(860, 150);
      ctx.quadraticCurveTo(800, 195, 740, 150);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 4;
      ctx.strokeRect(SHIRT_PRINT_X, SHIRT_PRINT_Y, SHIRT_PRINT_W, SHIRT_PRINT_H);

      const mapX = SHIRT_PRINT_W / CANVAS_W;
      const mapY = SHIRT_PRINT_H / CANVAS_H;

      const drawW = img.naturalWidth * transform.scale * mapX;
      const drawH = img.naturalHeight * transform.scale * mapY;
      const drawX = SHIRT_PRINT_X + transform.offsetX * mapX;
      const drawY = SHIRT_PRINT_Y + transform.offsetY * mapY;

      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      if (effectiveBounds) {
        drawBoundsOverlay(
          ctx,
          SHIRT_PRINT_X + effectiveBounds.x * mapX,
          SHIRT_PRINT_Y + effectiveBounds.y * mapY,
          effectiveBounds.w * mapX,
          effectiveBounds.h * mapY
        );
      }
    }
  }

  useEffect(() => {
    drawPreview();
  }, [img, transform, effectiveBounds, viewMode, designCanvasSize]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (fileUrl) URL.revokeObjectURL(fileUrl);

    setFile(selected);
    setFileSize(selected.size);

    const arrayBuffer = await selected.arrayBuffer();
    setDpiMetadata(getImageDpi(selected, arrayBuffer));

    const url = URL.createObjectURL(selected);
    setFileUrl(url);

    setActionMessage('Scanning design...');
    const image = new Image();
image.src = url;

image.onload = () => {
  setImg(image);
  setImgW(image.naturalWidth);
  setImgH(image.naturalHeight);

  setTransform({
    scale: 1,
    offsetX: Math.round((CANVAS_W - image.naturalWidth) / 2),
    offsetY: Math.round((CANVAS_H - image.naturalHeight) / 2),
  });

  setPreviewSize(DEFAULT_PREVIEW_SIZE);
  setInspectZoom(1);
  setViewMode('pod');
  setActionMessage('Design uploaded and centered on the POD canvas.');
  setDownloadMessage('');
};
return;
    
    
    
    setTransform({
      scale: 1,
      offsetX: Math.round((CANVAS_W - image.naturalWidth) / 2),
      offsetY: Math.round((CANVAS_H - image.naturalHeight) / 2),
    });
    
    setPreviewSize(DEFAULT_PREVIEW_SIZE);
    setInspectZoom(1);
    setViewMode('pod');
    setActionMessage('Design uploaded and centered on the POD canvas.');
    setDownloadMessage('');
    
  }

  function handleFixCanvas() {
    if (!img) return;

    setViewMode('pod');
    setTransform((prev) => ({
      ...prev,
      offsetX: Math.round((CANVAS_W - img.naturalWidth * prev.scale) / 2),
      offsetY: Math.round((CANVAS_H - img.naturalHeight * prev.scale) / 2),
    }));
    setActionMessage('Fix Canvas applied.');
  }

  function handleCenterArtwork() {
    if (!img || !originalBounds) return;
  
    setViewMode('pod');
  
    const scaledW = originalBounds.w * transform.scale;
    const scaledH = originalBounds.h * transform.scale;
  
    const x = (CANVAS_W - scaledW) / 2 - originalBounds.x * transform.scale;
    const y = (CANVAS_H - scaledH) / 2 - originalBounds.y * transform.scale;
  
    setTransform((prev) => ({
      ...prev,
      offsetX: Math.round(x),
      offsetY: Math.round(y),
    }));
  
    setActionMessage('Artwork centered using detected artwork bounds.');
  }

  function handleAutoFixSafetyBorder() {
    if (!originalBounds) return;
  
    setViewMode('pod');
  
    const availableW = CANVAS_W - AUTO_FIX_MARGIN * 2;
    const availableH = CANVAS_H - AUTO_FIX_MARGIN * 2;
    const scaleX = availableW / originalBounds.w;
    const scaleY = availableH / originalBounds.h;
    const nextScale = Math.min(scaleX, scaleY, 1);
  
    const scaledW = originalBounds.w * nextScale;
    const scaledH = originalBounds.h * nextScale;
  
    const x = (CANVAS_W - scaledW) / 2 - originalBounds.x * nextScale;
    const y = (CANVAS_H - scaledH) / 2 - originalBounds.y * nextScale;
  
    setTransform({
      scale: nextScale,
      offsetX: Math.round(x),
      offsetY: Math.round(y),
    });
    setActionMessage('Auto Fix Safety Border applied.');
  }
  
  function handleAutoFixTooSmall() {
    if (!originalBounds) return;
  
    setViewMode('pod');
  
    const availableW = CANVAS_W - SAFE_BOX * 2;
    const availableH = CANVAS_H - SAFE_BOX * 2;
    const scaleX = availableW / originalBounds.w;
    const scaleY = availableH / originalBounds.h;
    const nextScale = Math.min(scaleX, scaleY);
  
    const scaledW = originalBounds.w * nextScale;
    const scaledH = originalBounds.h * nextScale;
  
    const x = (CANVAS_W - scaledW) / 2 - originalBounds.x * nextScale;
    const y = (CANVAS_H - scaledH) / 2 - originalBounds.y * nextScale;
  
    setTransform({
      scale: Math.round(nextScale * 1000) / 1000,
      offsetX: Math.round(x),
      offsetY: Math.round(y),
    });
    setActionMessage('Auto Fix Design Too Small applied.');
  }
  
  function handleQuickFix() {
    if (!originalBounds) return;
  
    setViewMode('pod');
  
    const availableW = CANVAS_W - SAFE_BOX * 2;
    const availableH = CANVAS_H - SAFE_BOX * 2;
  
    const scaleX = availableW / originalBounds.w;
    const scaleY = availableH / originalBounds.h;
  
    let nextScale = Math.min(scaleX, scaleY);
  
    if (nextScale > 1) {
      nextScale = Math.min(nextScale, 1.25);
    }
  
    const scaledW = originalBounds.w * nextScale;
    const scaledH = originalBounds.h * nextScale;
  
    const x = (CANVAS_W - scaledW) / 2 - originalBounds.x * nextScale;
    const y = (CANVAS_H - scaledH) / 2 - originalBounds.y * nextScale;
  
    setTransform({
      scale: Math.round(nextScale * 1000) / 1000,
      offsetX: Math.round(x),
      offsetY: Math.round(y),
    });
  
    setActionMessage('Quick Fix applied: artwork centered and fitted to a safer print area.');
  }
  
  function resetToOriginalView() {
    if (!img) return;
  
    setTransform({
      scale: 1,
      offsetX: Math.round((CANVAS_W - img.naturalWidth) / 2),
      offsetY: Math.round((CANVAS_H - img.naturalHeight) / 2),
    });
    setPreviewSize(DEFAULT_PREVIEW_SIZE);
    setInspectZoom(1);
    setViewMode('pod');
    setActionMessage('View reset to original centered POD canvas.');
  }
  
  function handleDownloadFixedPng() {
    if (!img) return;

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = CANVAS_W;
  exportCanvas.height = CANVAS_H;

  const ctx = exportCanvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  ctx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);

  const drawW = img.naturalWidth * transform.scale;
  const drawH = img.naturalHeight * transform.scale;
  const drawX = transform.offsetX;
  const drawY = transform.offsetY;

  ctx.drawImage(img, drawX, drawY, drawW, drawH);

  const link = document.createElement('a');
  const baseName = file?.name?.replace(/\.[^/.]+$/, '') || 'pod-design-fixed';
  link.download = `${baseName}-fixed-transparent.png`;
  link.href = exportCanvas.toDataURL('image/png');
  link.click();

  setDownloadMessage(`Download ready: 4200×4800 transparent PNG`);
  setActionMessage('Clean transparent PNG exported.');
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
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20,
            padding: 24,
            background: 'rgba(255,255,255,0.04)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
            marginBottom: 20,
          }}
        >
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800 }}>POD Design Checker™</h1>
          <p style={{ marginTop: 10, color: '#cbd5e1', lineHeight: 1.6 }}>
          Upload your design to instantly see if it's ready for print.
</p>
          
          

          <div
            style={{
              marginTop: 18,
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleFileChange}
              style={{
                background: 'rgba(15,23,42,0.85)',
                color: '#fff',
                padding: 12,
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            />

<button onClick={handleQuickFix} disabled={!img || !originalBounds}>Quick Fix (Auto)</button>
<button onClick={resetToOriginalView} disabled={!img}>Reset Position</button>
<button onClick={handleDownloadFixedPng} disabled={!img}>Download Print-Ready PNG (4200×4800)</button>

<button onClick={() => setShowMoreFixes((v) => !v)} disabled={!img}>
  {showMoreFixes ? 'Hide Tools' : 'More Tools'}
</button>

{showMoreFixes && (
  <>
    <button onClick={handleFixCanvas} disabled={!img}>Fit to Canvas</button>
    <button onClick={handleCenterArtwork} disabled={!img}>Center Design</button>
    <button onClick={handleAutoFixSafetyBorder} disabled={!img || !originalBounds}>Fix Safety Border</button>
    <button onClick={handleAutoFixTooSmall} disabled={!img || !originalBounds}>Scale Design Up</button>
  </>
)}
          </div>

          <div
            style={{
              marginTop: 14,
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: 800, color: '#bae6fd' }}>Canvas Zoom</span>

            <button onClick={() => { setViewMode('pod'); setActionMessage('POD Canvas view selected.'); }} disabled={!img}>POD Canvas</button>
            <button onClick={() => { setViewMode('design'); setActionMessage('Design & Zoom view selected.'); }} disabled={!img}>
  Design & Zoom
</button>
<button onClick={() => { setViewMode('shirt'); setActionMessage('Shirt Preview selected.'); }} disabled={!img}>Preview on Shirt</button>
          </div>

          <div
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 18,
              background: 'rgba(8,47,73,0.6)',
              border: '1px solid rgba(56,189,248,0.35)',
              color: '#e0f2fe',
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 6, color: '#93c5fd' }}>Last Action</div>
            <div>{actionMessage}</div>
            {downloadMessage && <div style={{ marginTop: 8, color: '#7dd3fc' }}>{downloadMessage}</div>}
          </div>

          {file && (
            <div
              style={{
                marginTop: 18,
                padding: 14,
                borderRadius: 14,
                background: 'rgba(15,23,42,0.8)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Uploaded file:</div>
              <div style={{ color: '#fdba74', fontWeight: 600 }}>{file.name}</div>
            </div>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '420px 1fr',
            gap: 20,
          }}
        >
          <div
            style={{
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 20,
              padding: 20,
              background: 'rgba(255,255,255,0.04)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.28)',
              alignSelf: 'start',
            }}
          >
           <h2 style={{ marginTop: 0, marginBottom: 6, fontSize: 20, fontWeight: 800, letterSpacing: 0.4 }}>
  Scan Results
</h2>
            <p style={{ marginTop: 0, marginBottom: 20, color: '#cbd5e1', lineHeight: 1.6, fontSize: 15 }}>
  Review critical issues first, then warnings, before exporting your final print file.
</p>
            
            <div
  style={{
    marginBottom: 10,
    padding: 12,
    borderRadius: 10,
    background: 'linear-gradient(180deg, #020617 0%, #020617 60%, #020617cc 100%)',
    border: '2px solid rgba(56,189,248,0.6)',
    textAlign: 'center',
  }}
>
<div style={{ fontSize: 14, color: '#ffffff', fontWeight: 700 }}>
  PRINT READINESS
</div>
  <div style={{ fontSize: 42, fontWeight: 800, color:
  printScore >= 80
    ? '#22c55e'
    : printScore >= 50
    ? '#f59e0b'
    : '#ef4444' }}>
  {printScore}%
  <div
  style={{
    marginTop: 12,
    width: '100%',
    height: 18,
    borderRadius: 999,
    background: 'rgba(15,23,42,0.85)',
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.08)',
  }}
>
  <div
    style={{
      width: `${printScore}%`,
      height: '100%',
      borderRadius: 999,
      background:
        printScore >= 80
          ? '#22c55e'
          : printScore >= 50
          ? '#f59e0b'
          : '#ef4444',
          transition: 'width 0.5s ease',
    }}
  />
</div>
<div style={{ marginTop: 12, fontWeight: 800 }}>
  {hasTransparency === false
    ? 'HIGH RISK'
    : printScore < 60
    ? 'MEDIUM RISK'
    : 'READY FOR PRINT'}
</div>
<div
  style={{
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    background: '#020617',
    border: '1px solid #334155',
  }}
>
  <div
    style={{
      marginBottom: 12,
      padding: '10px 14px',
      borderRadius: 8,
      fontWeight: 700,
      textAlign: 'center',
      background:
        !img
          ? '#1e293b'
          : hasTransparency === false || printScore < 60
          ? '#7f1d1d'
          : 100 - printScore >= 30
          ? '#78350f'
          : '#14532d',
    }}
  >
    {!img
      ? 'UPLOAD A DESIGN TO BEGIN'
      : hasTransparency === false || printScore < 60
      ? '🔴 HIGH RISK'
      : 100 - printScore >= 30
      ? '🟡 MEDIUM RISK'
      : '🟢 LOW RISK'}
  </div>

  <div style={{ fontWeight: 700, marginBottom: hasTransparency === false || printScore < 60 || 100 - printScore >= 30 ? 6 : 2 }}>
  {hasTransparency === false || printScore < 60 || 100 - printScore >= 30 ? 'Scan Summary' : 'Ready'}
</div>

<div
  style={{
    height: 1,
    background: '#334155',
    marginBottom: hasTransparency === false || printScore < 60 || 100 - printScore >= 30 ? 10 : 6,
  }}
/>

<div style={{ marginBottom: hasTransparency === false || printScore < 60 || 100 - printScore >= 30 ? 10 : 6, fontWeight: 600 }}>
<div style={{ padding: 18, borderRadius: 16, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.12)' }}>
<span style={{ fontWeight: 800 }}>Main Issue:</span>
    {!img
      ? '—'
      : hasTransparency === false
      ? ' No transparency'
      : thinLinePercent >= 18
      ? ' Too many thin lines'
      : specks > 0
      ? ' Specks detected'
      : imgW !== CANVAS_W || imgH !== CANVAS_H
      ? ' Wrong size'
      : ' No major issues'}
  </div>

  {hasTransparency === false || printScore < 60 || 100 - printScore >= 30 ? (
  <div style={{ marginBottom: 8 }}>
<span style={{ fontWeight: 800 }}>Next Step:</span>
  {!img
    ? '—'
    : hasTransparency === false
    ? 'Add transparent background'
    : thinLinePercent >= 18
    ? 'Thicken thin lines'
    : specks > 0
    ? 'Clean specks / noise'
    : imgW !== CANVAS_W || imgH !== CANVAS_H
    ? 'Resize to 4200×4800'
    : 'Ready to download'}
</div>
) : null}
</div>



  
</div>
  </div>
</div>

            {!img && (
              <div
                style={{
                  padding: 16,
                  borderRadius: 14,
                  background: 'rgba(15,23,42,0.85)',
                  color: '#cbd5e1',
                }}
              >
                Upload your design to start scanning.
              </div>
            )}

{checks.filter((item) => item.status === 'fail').length > 0 && (
  <div style={{ marginBottom: 16 }}>
    <div
      style={{
        marginBottom: 10,
        padding: '10px 14px',
        borderRadius: 10,
        background: '#7f1d1d',
        color: '#fff',
        fontWeight: 800,
      }}
    >
      Critical Issues
    </div>

    {checks
      .filter((item) => item.status === 'fail')
      .map((item, index) => (
        <div
          key={`${item.label}-fail-${index}`}
          style={{
            marginBottom: 8,
            borderRadius: 10,
            padding: 10,
            background: 'linear-gradient(180deg, rgba(127,29,29,0.55), rgba(15,23,42,0.92))',
            border: `1px solid ${statusColor(item.status)}66`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 700,
              marginBottom: 6,
              color: statusColor(item.status),
            }}
          >
            <span>{statusIcon(item.status)}</span>
            <span>{item.label}</span>
          </div>
          <div style={{ color: '#e5e7eb', lineHeight: 1.5 }}>
  {item.message}
</div>

<div style={{ marginTop: 6, fontSize: 13, color: '#94a3b8' }}>
  {item.status === 'fail'
    ? 'Fix: This must be corrected before printing.'
    : item.status === 'warn'
    ? 'Fix: Improve this for better print quality.'
    : ''}
</div>
        </div>
      ))}
  </div>
)}

{checks.filter((item) => item.status === 'warn').length > 0 && (
  <div style={{ marginBottom: 16 }}>
    <div
      style={{
        marginBottom: 10,
        padding: '10px 14px',
        borderRadius: 10,
        background: '#78350f',
        color: '#fff',
        fontWeight: 800,
      }}
    >
      Warnings
    </div>

    {checks
      .filter((item) => item.status === 'warn')
      .map((item, index) => (
        <div
          key={`${item.label}-warn-${index}`}
          style={{
            marginBottom: 8,
            borderRadius: 10,
            padding: 10,
            background: 'linear-gradient(180deg, rgba(154,52,18,0.45), rgba(15,23,42,0.92))',
            border: `1px solid ${statusColor(item.status)}66`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 700,
              marginBottom: 6,
              color: statusColor(item.status),
            }}
          >
            <span>{statusIcon(item.status)}</span>
            <span>{item.label}</span>
          </div>
          <div style={{ color: '#e5e7eb', lineHeight: 1.5 }}>{item.message}</div>
        </div>
      ))}
  </div>
)}

{checks.filter((item) => item.status === 'pass' || item.status === 'info').length > 0 && (
  <div style={{ marginBottom: 16 }}>
    <div
      style={{
        marginBottom: 10,
        padding: '10px 14px',
        borderRadius: 10,
        background: '#14532d',
        color: '#fff',
        fontWeight: 800,
      }}
    >
      Passed Checks
    </div>

    {checks
      .filter((item) => item.status === 'pass' || item.status === 'info')
      .map((item, index) => (
        <div
          key={`${item.label}-pass-${index}`}
          style={{
            marginBottom: 8,
            borderRadius: 10,
            padding: 10,
            background:
              item.status === 'pass'
                ? 'linear-gradient(180deg, rgba(20,83,45,0.45), rgba(15,23,42,0.92))'
                : '#0f172a',
            border: `1px solid ${statusColor(item.status)}66`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 700,
              marginBottom: 6,
              color: statusColor(item.status),
            }}
          >
            <span>{statusIcon(item.status)}</span>
            <span>{item.label}</span>
          </div>
          <div style={{ color: '#e5e7eb', lineHeight: 1.5 }}>{item.message}</div>
        </div>
      ))}
  </div>
)}

            {img && effectiveBounds && (
              <div
                style={{
                  marginTop: 12,
                  padding: 14,
                  borderRadius: 14,
                  background: 'rgba(15,23,42,0.75)',
backdropFilter: 'blur(4px)',
                  border: '1px solid rgba(34,197,94,0.35)',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 8, color: '#22c55e' }}>
                  Artwork Fill Info
                </div>
                <div style={{ color: '#e5e7eb', lineHeight: 1.5 }}>
                  Width fill: <strong>{((effectiveBounds.w / CANVAS_W) * 100).toFixed(1)}%</strong>
                  <br />
                  Height fill: <strong>{((effectiveBounds.h / CANVAS_H) * 100).toFixed(1)}%</strong>
                  <br />
                  Coverage sample: <strong>{coverage.toFixed(1)}%</strong>
                  <br />
                  Current scale: <strong>{(transform.scale * 100).toFixed(1)}%</strong>
                  <br />
                  Preview size: <strong>{Math.round(previewSize * 100)}%</strong>
                  <br />
                  Inspect zoom: <strong>{inspectZoom * 100}%</strong>
                </div>
              </div>
            )}

            {img && (
              <div
                style={{
                  marginTop: 20,
                  borderRadius: 16,
                  padding: 16,
                  background: 'rgba(2,6,23,0.9)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <h3 style={{ marginTop: 0, marginBottom: 12, fontWeight: 800 }}>
  Important POD Notes
</h3>

                <p style={{ marginTop: 0, color: '#cbd5e1', lineHeight: 1.6 }}>
                  Important: <strong>300 DPI metadata by itself does not guarantee the file is correct for POD.</strong>{' '}
                  What matters most is the pixel size and whether the art sits properly on the canvas.
                </p>

                <p style={{ color: '#cbd5e1', lineHeight: 1.6 }}>
                  <strong>Print Resolution</strong> is the practical POD check. DPI metadata can be shown for information,
                  but printers care mainly about pixel dimensions and layout quality.
                </p>

                <p style={{ color: '#cbd5e1', lineHeight: 1.6 }}>
                  The <span style={{ color: '#ef4444', fontWeight: 700 }}>red dashed overlay</span> shows the safety border,
                  the <span style={{ color: '#3b82f6', fontWeight: 700 }}> blue dashed box</span> shows the safe print zone,
                  the <span style={{ color: '#22c55e', fontWeight: 700 }}> green box</span> shows detected artwork bounds,
                  and the <span style={{ color: '#facc15', fontWeight: 700 }}> yellow center marker</span> shows the artwork center.
                </p>

                <p style={{ marginBottom: 0, color: '#cbd5e1', lineHeight: 1.6 }}>
                  Recommended shirt workflow: <strong>4200 × 4800 px</strong>, PNG, transparent background, RGB / sRGB.
                </p>
              </div>
            )}
          </div>

          <div
            style={{
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 20,
              padding: 20,
              background: 'rgba(255,255,255,0.04)',
              boxShadow: '0 25px 70px rgba(0,0,0,0.35)',
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'center',
                flexWrap: 'wrap',
                marginBottom: 16,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Preview</h2>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: '#bae6fd' }}>Preview Size</span>
                <button onClick={() => { setPreviewSize(0.1); setActionMessage('Preview Size set to 10%.'); }}>10%</button>
                <button onClick={() => { setPreviewSize(0.25); setActionMessage('Preview Size set to 25%.'); }}>25%</button>
                <button onClick={() => { setPreviewSize(0.5); setActionMessage('Preview Size set to 50%.'); }}>50%</button>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: '#bae6fd' }}>Detail Zoom</span>
                {[1, 2, 4, 8].map((z) => (
                  <button
                    key={z}
                    onClick={() => {
                      setInspectZoom(z);
                      setActionMessage(`Inspect Zoom set to ${z * 100}%.`);
                    }}
                  >
                    {z * 100}%
                  </button>
                ))}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 14,
                flexWrap: 'wrap',
                marginBottom: 16,
              }}
            >
              <div style={{ background: 'rgba(15,23,42,0.85)', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                Canvas: <strong>{imgW || '-'} × {imgH || '-'}</strong>
              </div>

              <div style={{ background: 'rgba(15,23,42,0.85)', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                Preview Size: <strong>{Math.round(previewSize * 100)}%</strong>
              </div>

              <div style={{ background: 'rgba(15,23,42,0.85)', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                Inspect Zoom: <strong>{inspectZoom * 100}%</strong>
              </div>

              <div style={{ background: 'rgba(15,23,42,0.85)', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                Practical DPI: <strong>{practicalPrintDpi || '-'}</strong>
              </div>
            </div>

            <div
              style={{
                width: VIEWPORT_W,
                height: VIEWPORT_H,
                overflow: 'auto',
                borderRadius: 18,
                border: '2px solid #38bdf8',
                boxShadow: '0 0 0 1px rgba(56,189,248,0.25), inset 0 0 30px rgba(8,47,73,0.25)',
                background: '#020617',
                padding: 20,
              }}
            >
              <div
                style={{
                  width: previewCanvasW * totalScale,
                  height: previewCanvasH * totalScale,
                }}
              >
                <canvas
                  ref={previewCanvasRef}
                  style={{
                    display: 'block',
                    width: `${previewCanvasW * totalScale}px`,
                    height: `${previewCanvasH * totalScale}px`,
                    boxShadow: '0 12px 50px rgba(0,0,0,0.55)',
                    borderRadius: 12,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <canvas ref={analysisCanvasRef} style={{ display: 'none' }} />
      </div>
    </main>
  );
}