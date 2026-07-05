import { analyzeBatchScan, type BatchFileScanOutput } from './scanCore';
import { getImageDpi } from './podCheckerUtils';
import type { BatchScanStatus } from './batchQueueUtils';
export { resolvePostAutoFixScanResult } from './scanCore';

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

export async function scanBatchFile(file: File): Promise<BatchFileScanOutput> {
  const scanStart = performance.now();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const dpiMetadata = getImageDpi(file, arrayBuffer);
    const image = await loadImageFromFile(file);

    const imgW = image.naturalWidth;
    const imgH = image.naturalHeight;

    if (!imgW || !imgH || imgW < 1 || imgH < 1) {
      throw new Error('Invalid image dimensions');
    }

    const canvas = document.createElement('canvas');
    canvas.width = imgW;
    canvas.height = imgH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Scan failed');

    ctx.clearRect(0, 0, imgW, imgH);
    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, imgW, imgH);
    const scanTimeMs = Math.round(performance.now() - scanStart);

    const output = analyzeBatchScan({
      file,
      imageData,
      imgW,
      imgH,
      dpiMetadata,
      scanTimeMs,
    });

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Batch Scan] ${file.name} — ${scanTimeMs} ms — ${output.status}`);
    }

    canvas.width = 0;
    canvas.height = 0;

    return output;
  } catch (error) {
    const scanTimeMs = Math.round(performance.now() - scanStart);
    const message =
      error instanceof Error && error.message === 'Could not read image'
        ? 'Could not read image'
        : error instanceof Error && error.message === 'Invalid image dimensions'
        ? 'Invalid image dimensions'
        : 'Scan failed';

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Batch Scan] ${file.name} — ${scanTimeMs} ms — failed`);
    }

    return {
      status: 'failed',
      scanResult: {
        printConfidence: null,
        mainIssue: message,
        nextAction: 'Fix or replace this file before upload.',
        warnings: [],
        failures: [message],
        scanTimeMs,
        errorMessage: message,
      },
    };
  }
}

export function getBatchStatusLabel(status: BatchScanStatus): string {
  switch (status) {
    case 'waiting':
      return 'Waiting';
    case 'scanning':
      return 'Scanning';
    case 'ready':
      return 'Ready';
    case 'safe-auto-fix':
      return 'Safe Auto Fix';
    case 'needs-review':
      return 'Needs Review';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}

export function getBatchStatusColors(status: BatchScanStatus): { color: string; background: string; border: string } {
  switch (status) {
    case 'scanning':
      return { color: '#bfdbfe', background: 'rgba(37, 99, 235, 0.18)', border: 'rgba(147, 197, 253, 0.35)' };
    case 'ready':
      return { color: '#86efac', background: 'rgba(22, 163, 74, 0.16)', border: 'rgba(134, 239, 172, 0.28)' };
    case 'safe-auto-fix':
      return { color: '#fde68a', background: 'rgba(250, 204, 21, 0.14)', border: 'rgba(250, 204, 21, 0.28)' };
    case 'needs-review':
      return { color: '#fdba74', background: 'rgba(249, 115, 22, 0.14)', border: 'rgba(251, 146, 60, 0.28)' };
    case 'failed':
      return { color: '#fca5a5', background: 'rgba(239, 68, 68, 0.14)', border: 'rgba(248, 113, 113, 0.28)' };
    default:
      return { color: '#94a3b8', background: 'rgba(148, 163, 184, 0.14)', border: 'rgba(148, 163, 184, 0.22)' };
  }
}
