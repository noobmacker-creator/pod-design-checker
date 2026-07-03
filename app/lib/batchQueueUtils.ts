export type BatchScanStatus =
  | 'waiting'
  | 'scanning'
  | 'ready'
  | 'safe-auto-fix'
  | 'needs-review'
  | 'failed';

export type BatchScanResult = {
  printConfidence: number | null;
  mainIssue: string;
  nextAction: string;
  warnings: string[];
  failures: string[];
  scanTimeMs: number | null;
  errorMessage?: string;
};

export type BatchQueueItem = {
  id: string;
  file: File;
  filename: string;
  relativePath: string;
  size: number;
  type: string;
  status: BatchScanStatus;
  scanResult?: BatchScanResult | null;
};

export const BATCH_QUEUE_MAX_FILES = 100;
export const BATCH_QUEUE_MAX_FILE_BYTES = 50 * 1024 * 1024;
export const BATCH_QUEUE_MAX_COMBINED_BYTES = 500 * 1024 * 1024;

const SUPPORTED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);

export function formatBatchFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getBatchFileTypeLabel(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'png' || file.type === 'image/png') return 'PNG';
  if (ext === 'jpg' || ext === 'jpeg' || file.type === 'image/jpeg') return 'JPEG';
  if (ext === 'webp' || file.type === 'image/webp') return 'WEBP';
  return ext ? ext.toUpperCase() : 'Unknown';
}

export function isSupportedBatchImageFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (SUPPORTED_EXTENSIONS.has(ext)) return true;
  if (file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/webp') {
    return true;
  }
  return false;
}

export function makeBatchQueueId(file: File): string {
  const relativePath =
    'webkitRelativePath' in file && typeof file.webkitRelativePath === 'string'
      ? file.webkitRelativePath
      : file.name;
  return `${relativePath}|${file.size}|${file.lastModified}`;
}

export type BatchQueueIntakeResult = {
  accepted: BatchQueueItem[];
  skippedUnsupported: number;
  skippedDuplicate: number;
  skippedFileTooLarge: number;
  skippedMaxFiles: number;
  skippedCombinedLimit: number;
};

export function intakeBatchFiles(
  files: File[],
  existingItems: BatchQueueItem[],
): BatchQueueIntakeResult {
  const existingIds = new Set(existingItems.map((item) => item.id));
  const accepted: BatchQueueItem[] = [...existingItems];
  let combinedSize = existingItems.reduce((sum, item) => sum + item.size, 0);

  let skippedUnsupported = 0;
  let skippedDuplicate = 0;
  let skippedFileTooLarge = 0;
  let skippedMaxFiles = 0;
  let skippedCombinedLimit = 0;

  for (const file of files) {
    if (!isSupportedBatchImageFile(file)) {
      skippedUnsupported++;
      continue;
    }

    const id = makeBatchQueueId(file);
    if (existingIds.has(id)) {
      skippedDuplicate++;
      continue;
    }

    if (file.size > BATCH_QUEUE_MAX_FILE_BYTES) {
      skippedFileTooLarge++;
      continue;
    }

    if (accepted.length >= BATCH_QUEUE_MAX_FILES) {
      skippedMaxFiles++;
      continue;
    }

    if (combinedSize + file.size > BATCH_QUEUE_MAX_COMBINED_BYTES) {
      skippedCombinedLimit++;
      continue;
    }

    const relativePath =
      'webkitRelativePath' in file && typeof file.webkitRelativePath === 'string'
        ? file.webkitRelativePath
        : '';

    const item: BatchQueueItem = {
      id,
      file,
      filename: file.name,
      relativePath,
      size: file.size,
      type: getBatchFileTypeLabel(file),
      status: 'waiting',
    };

    accepted.push(item);
    existingIds.add(id);
    combinedSize += file.size;
  }

  return {
    accepted,
    skippedUnsupported,
    skippedDuplicate,
    skippedFileTooLarge,
    skippedMaxFiles,
    skippedCombinedLimit,
  };
}

export function buildBatchIntakeMessage(result: BatchQueueIntakeResult, previousCount: number): string {
  const added = result.accepted.length - previousCount;
  const parts: string[] = [];

  if (added > 0) {
    parts.push(`${added} file${added === 1 ? '' : 's'} added to the queue.`);
  }

  if (result.skippedUnsupported > 0) {
    parts.push(
      `${result.skippedUnsupported} unsupported file${result.skippedUnsupported === 1 ? '' : 's'} skipped.`,
    );
  }
  if (result.skippedDuplicate > 0) {
    parts.push(
      `${result.skippedDuplicate} duplicate file${result.skippedDuplicate === 1 ? '' : 's'} skipped.`,
    );
  }
  if (result.skippedFileTooLarge > 0) {
    parts.push(
      `${result.skippedFileTooLarge} file${result.skippedFileTooLarge === 1 ? '' : 's'} over 50 MB skipped.`,
    );
  }
  if (result.skippedMaxFiles > 0) {
    parts.push(`${result.skippedMaxFiles} file${result.skippedMaxFiles === 1 ? '' : 's'} skipped — 100 file limit reached.`);
  }
  if (result.skippedCombinedLimit > 0) {
    parts.push(
      `${result.skippedCombinedLimit} file${result.skippedCombinedLimit === 1 ? '' : 's'} skipped — 500 MB combined limit reached.`,
    );
  }

  return parts.join(' ');
}
