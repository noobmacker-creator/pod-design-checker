import type { BatchQueueItem } from './batchQueueUtils';
import {
  createConverterExportBlob,
  sanitizeUploadBasename,
} from './productConverterExport';
import {
  getPresetById,
  getQuickExportPackPresetIds,
  type ProductConverterPreset,
  type QuickExportPackId,
} from './productConverterPresets';

export const CUSTOM_EXPORT_MIN = 500;
export const CUSTOM_EXPORT_MAX = 12000;

export function parseCustomExportSize(
  widthStr: string,
  heightStr: string,
): { valid: true; width: number; height: number } | { valid: false; error: string } {
  const trimmedWidth = widthStr.trim();
  const trimmedHeight = heightStr.trim();

  if (!/^\d+$/.test(trimmedWidth) || !/^\d+$/.test(trimmedHeight)) {
    return {
      valid: false,
      error: 'Enter a width and height between 500 and 12000 px.',
    };
  }

  const width = Number.parseInt(trimmedWidth, 10);
  const height = Number.parseInt(trimmedHeight, 10);

  if (
    width < CUSTOM_EXPORT_MIN ||
    width > CUSTOM_EXPORT_MAX ||
    height < CUSTOM_EXPORT_MIN ||
    height > CUSTOM_EXPORT_MAX
  ) {
    return {
      valid: false,
      error: 'Enter a width and height between 500 and 12000 px.',
    };
  }

  return { valid: true, width, height };
}

export function getCustomSizeFilename(width: number, height: number): string {
  return `custom-${width}x${height}.png`;
}

export function makeCustomSizePreset(width: number, height: number): ProductConverterPreset {
  return {
    id: `custom-${width}x${height}`,
    platform: 'custom',
    category: 'Custom',
    label: `Custom Size — ${width} × ${height}`,
    width,
    height,
    filename: getCustomSizeFilename(width, height),
  };
}

export function computeBatchExportSizeCount(presetCount: number, hasCustomSize: boolean): number {
  return presetCount + (hasCustomSize ? 1 : 0);
}

export type BatchProductExportProgress = {
  current: number;
  total: number;
  designName: string;
  productName: string;
  message: string;
};

/** Designs eligible for batch export — ready status only. */
export function getEligibleBatchExportItems(items: BatchQueueItem[]): BatchQueueItem[] {
  return items.filter((item) => item.status === 'ready');
}

export function computeBatchProductOutputCount(
  designCount: number,
  productCount: number,
): number {
  if (designCount < 0 || productCount < 0) return 0;
  return designCount * productCount;
}

export function getPresetsForQuickExportPack(packId: QuickExportPackId): ProductConverterPreset[] {
  return getQuickExportPackPresetIds(packId)
    .map((id) => getPresetById(id))
    .filter((preset): preset is ProductConverterPreset => preset !== undefined);
}

export function getPresetsByIds(ids: string[]): ProductConverterPreset[] {
  return ids
    .map((id) => getPresetById(id))
    .filter((preset): preset is ProductConverterPreset => preset !== undefined);
}

/** Unique folder names per design — avoids overwriting when filenames repeat. */
export function makeUniqueDesignFolderNames(filenames: string[]): string[] {
  const usedCounts = new Map<string, number>();

  return filenames.map((filename) => {
    const base = sanitizeUploadBasename(filename);
    const count = usedCounts.get(base) ?? 0;
    usedCounts.set(base, count + 1);
    if (count === 0) return base;
    return `${base}-${count + 1}`;
  });
}

function loadImageFromBlobOrFile(source: Blob | File): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(source);
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

async function loadImageFromBatchItem(item: BatchQueueItem): Promise<HTMLImageElement | null> {
  const source = item.fixedBlob ?? item.file;
  return loadImageFromBlobOrFile(source);
}

export type BatchProductExportResult = {
  zipBlob: Blob;
  addedCount: number;
  skippedDesigns: string[];
  failedOutputs: string[];
};

/**
 * Build a ZIP with one folder per design and one PNG per selected product preset.
 * Uses the same fit/centre export logic as Product Converter.
 */
export async function buildBatchProductExportZip(
  items: BatchQueueItem[],
  presets: ProductConverterPreset[],
  onProgress: (progress: BatchProductExportProgress) => void,
): Promise<BatchProductExportResult | null> {
  if (items.length === 0 || presets.length === 0) return null;

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const folderNames = makeUniqueDesignFolderNames(items.map((item) => item.filename));
  const totalOutputs = items.length * presets.length;
  let outputIndex = 0;
  let addedCount = 0;
  const skippedDesigns: string[] = [];
  const failedOutputs: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const folderName = folderNames[i];

    const image = await loadImageFromBatchItem(item);
    if (!image) {
      skippedDesigns.push(item.filename);
      outputIndex += presets.length;
      continue;
    }

    for (const preset of presets) {
      outputIndex += 1;
      onProgress({
        current: outputIndex,
        total: totalOutputs,
        designName: item.filename,
        productName: preset.label,
        message: `Creating ${outputIndex} of ${totalOutputs} PNG files…`,
      });

      const blob = await createConverterExportBlob(image, preset.width, preset.height);
      if (!blob) {
        failedOutputs.push(`${item.filename} — ${preset.label}`);
        continue;
      }

      zip.file(`${folderName}/${preset.filename}`, blob);
      addedCount += 1;
    }
  }

  if (addedCount === 0) return null;

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return { zipBlob, addedCount, skippedDesigns, failedOutputs };
}

export type BatchReadyFilesExportResult = {
  zipBlob: Blob;
  addedCount: number;
  skippedDesigns: string[];
};

const READY_EXPORT_WIDTH = 4200;
const READY_EXPORT_HEIGHT = 4800;

/**
 * Export one transparent PNG per ready design without additional product sizes.
 * Uses fixedBlob when available, otherwise exports at standard apparel size.
 */
export async function buildBatchReadyFilesZip(
  items: BatchQueueItem[],
  onProgress: (message: string) => void,
): Promise<BatchReadyFilesExportResult | null> {
  if (items.length === 0) return null;

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const folderNames = makeUniqueDesignFolderNames(items.map((item) => item.filename));
  let addedCount = 0;
  const skippedDesigns: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const folderName = folderNames[i];
    onProgress(`Adding ${i + 1} of ${items.length}: ${item.filename}`);

    if (item.fixedBlob) {
      zip.file(`${folderName}/${sanitizeUploadBasename(item.filename)}.png`, item.fixedBlob);
      addedCount += 1;
      continue;
    }

    const image = await loadImageFromBatchItem(item);
    if (!image) {
      skippedDesigns.push(item.filename);
      continue;
    }

    const blob = await createConverterExportBlob(image, READY_EXPORT_WIDTH, READY_EXPORT_HEIGHT);
    if (!blob) {
      skippedDesigns.push(item.filename);
      continue;
    }

    zip.file(`${folderName}/${sanitizeUploadBasename(item.filename)}.png`, blob);
    addedCount += 1;
  }

  if (addedCount === 0) return null;

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return { zipBlob, addedCount, skippedDesigns };
}

export function triggerZipDownload(zipBlob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = objectUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}
