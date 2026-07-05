import { detectBoundsAndCoverage } from './podCheckerUtils';
import type { BatchScanResult } from './batchQueueUtils';

const CANVAS_W = 4200;
const CANVAS_H = 4800;
const SAFE_BOX = 180;
const MAX_ARTWORK_FILL = 0.8;

type Bounds = { x: number; y: number; w: number; h: number };
type Transform = { scale: number; offsetX: number; offsetY: number };

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    image.src = url;
  });
}

export function computeQuickFixTransform(originalBounds: Bounds): Transform {
  const availableW = CANVAS_W - SAFE_BOX * 2;
  const availableH = CANVAS_H - SAFE_BOX * 2;
  const presetAspect = CANVAS_W / CANVAS_H;
  const safeAspect = availableW / availableH;

  const targetW = safeAspect > presetAspect ? availableH * presetAspect : availableW;
  const targetH = safeAspect > presetAspect ? availableH : availableW / presetAspect;

  const scaleX = targetW / originalBounds.w;
  const scaleY = targetH / originalBounds.h;
  const maxFillScale = Math.min(
    (CANVAS_W * MAX_ARTWORK_FILL) / originalBounds.w,
    (CANVAS_H * MAX_ARTWORK_FILL) / originalBounds.h,
  );

  let nextScale = Math.min(scaleX, scaleY, maxFillScale);

  if (nextScale > 1) {
    nextScale = Math.min(nextScale, 1.25);
  }

  const scaledW = originalBounds.w * nextScale;
  const scaledH = originalBounds.h * nextScale;

  const targetX = (CANVAS_W - targetW) / 2;
  const targetY = (CANVAS_H - targetH) / 2;
  const x = targetX + (targetW - scaledW) / 2 - originalBounds.x * nextScale;
  const y = targetY + (targetH - scaledH) / 2 - originalBounds.y * nextScale;

  return {
    scale: Math.round(nextScale * 1000) / 1000,
    offsetX: Math.round(x),
    offsetY: Math.round(y),
  };
}

const FIX_LABELS: Record<string, string> = {
  'Design Too Small': 'Scaled design safely',
  'Print Safety Border': 'Fitted to safe area',
  'Off-Center Design': 'Centred artwork',
  'Empty Padding Risk': 'Prepared target canvas',
  'Uneven Padding Risk': 'Balanced artwork placement',
  'Artwork Near Canvas Edge': 'Added breathing room',
  'Cut-Off Edge Risk': 'Adjusted canvas placement',
};

export function describeFixesFromScanResult(scanResult: BatchScanResult): string[] {
  const labels = new Set<string>([
    scanResult.mainIssue,
    ...scanResult.warnings,
    ...scanResult.failures,
  ]);
  const fixes: string[] = [];

  for (const [label, description] of Object.entries(FIX_LABELS)) {
    if ([...labels].some((entry) => entry === label || entry.startsWith(label))) {
      fixes.push(description);
    }
  }

  return fixes.length > 0 ? fixes : ['Applied safe placement fix'];
}

function renderFixedCanvas(
  image: HTMLImageElement,
  transform: Transform,
): HTMLCanvasElement | null {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = CANVAS_W;
  exportCanvas.height = CANVAS_H;

  const ctx = exportCanvas.getContext('2d', { alpha: true });
  if (!ctx) return null;

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  const drawW = image.naturalWidth * transform.scale;
  const drawH = image.naturalHeight * transform.scale;
  ctx.drawImage(image, transform.offsetX, transform.offsetY, drawW, drawH);

  return exportCanvas;
}

export async function createBatchFixedPngBlob(
  file: File,
): Promise<{ blob: Blob; fixesApplied: string[] } | null> {
  const image = await loadImageFromFile(file);
  const imgW = image.naturalWidth;
  const imgH = image.naturalHeight;

  if (!imgW || !imgH) {
    throw new Error('Invalid image dimensions');
  }

  const canvas = document.createElement('canvas');
  canvas.width = imgW;
  canvas.height = imgH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not create fixed PNG');

  ctx.clearRect(0, 0, imgW, imgH);
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, imgW, imgH);
  canvas.width = 0;
  canvas.height = 0;

  const boundsResult = detectBoundsAndCoverage(imageData, 10);
  const originalBounds = boundsResult.bounds;
  if (!originalBounds) {
    throw new Error('Could not measure artwork bounds');
  }

  const transform = computeQuickFixTransform(originalBounds);
  const exportCanvas = renderFixedCanvas(image, transform);
  if (!exportCanvas) throw new Error('Could not create fixed PNG');

  const blob = await new Promise<Blob | null>((resolve) => {
    exportCanvas.toBlob((result) => resolve(result), 'image/png');
  });

  exportCanvas.width = 0;
  exportCanvas.height = 0;

  if (!blob) throw new Error('Could not create fixed PNG');

  return { blob, fixesApplied: [] };
}
