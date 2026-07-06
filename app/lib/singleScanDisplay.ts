import type { CheckItem } from './podCheckerTypes';
import type { ScanCoreOptions } from './scanCore';
import { analyzeSingleScan, type SingleScanAdapterInput, type SingleScanAdapterOutput } from './singleScanAdapter';

export type SingleScanVisibleScanFn = (input: SingleScanAdapterInput) => SingleScanAdapterOutput;

export function runSingleScanVisibleSummary(
  input: SingleScanAdapterInput,
  scanFn: SingleScanVisibleScanFn = analyzeSingleScan,
): SingleScanAdapterOutput {
  return scanFn(input);
}

export function dedupeSingleScanChecks(checks: CheckItem[]): CheckItem[] {
  const seen = new Set<string>();
  const deduped: CheckItem[] = [];

  for (const item of checks) {
    if (seen.has(item.label)) continue;
    seen.add(item.label);
    deduped.push(item);
  }

  return deduped;
}

export function mergeSingleScanDisplayChecks(
  checks: CheckItem[],
  scanResult: Pick<SingleScanAdapterOutput['scanResult'], 'warnings' | 'failures'> | null | undefined,
): CheckItem[] {
  if (!scanResult) {
    return dedupeSingleScanChecks(checks);
  }

  const warnings = new Set(scanResult.warnings);
  const failures = new Set(scanResult.failures);

  return dedupeSingleScanChecks(
    checks.map((item) => {
      if (failures.has(item.label)) {
        return { ...item, status: 'fail' };
      }
      if (warnings.has(item.label)) {
        return { ...item, status: 'warn' };
      }
      return item;
    }),
  );
}

export type SingleScanFixedOutputRenderInput = {
  width: number;
  height: number;
  transform: { scale: number; offsetX: number; offsetY: number };
};

export type SingleScanFixedOutputRenderer = (
  input: SingleScanFixedOutputRenderInput,
) => ImageData | null;

export type SingleScanFixedOutputInput = {
  file: File;
  img: HTMLImageElement;
  dpiMetadata: number | null;
  scanTimeMs: number;
  options: ScanCoreOptions;
  outputWidth: number;
  outputHeight: number;
  transform: { scale: number; offsetX: number; offsetY: number };
  renderImageData: SingleScanFixedOutputRenderer;
};

export function runSingleScanVisibleSummaryFromFixedOutput(
  input: SingleScanFixedOutputInput,
  scanFn: SingleScanVisibleScanFn = analyzeSingleScan,
): SingleScanAdapterOutput | null {
  const imageData = input.renderImageData({
    width: input.outputWidth,
    height: input.outputHeight,
    transform: input.transform,
  });

  if (!imageData) {
    return null;
  }

  return runSingleScanVisibleSummary(
    {
      file: input.file,
      imageData,
      imgW: input.outputWidth,
      imgH: input.outputHeight,
      dpiMetadata: input.dpiMetadata,
      scanTimeMs: input.scanTimeMs,
      options: {
        ...input.options,
        targetCanvasW: input.outputWidth,
        targetCanvasH: input.outputHeight,
      },
    },
    scanFn,
  );
}
