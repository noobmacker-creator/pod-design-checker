import type { BatchScanResult, BatchScanStatus } from './batchQueueUtils';
import { analyzeScanCore, type ScanCoreInput, type ScanCoreOptions } from './scanCore';

export type SingleScanStatus = 'ready' | 'warning' | 'failure';
export type SingleRiskLabel = 'READY' | 'NEEDS REVIEW' | 'HIGH RISK';

export type SingleScanAdapterInput = ScanCoreInput;

export type SingleScanAdapterOutput = {
  coreStatus: BatchScanStatus;
  scanStatus: SingleScanStatus;
  riskLabel: SingleRiskLabel;
  printConfidence: number | null;
  mainIssue: string;
  nextAction: string;
  warnings: string[];
  failures: string[];
  scanResult: BatchScanResult;
  targetCanvasW: number;
  targetCanvasH: number;
  safeBorder: number;
};

const DEFAULT_ADAPTER_OPTIONS = {
  targetCanvasW: 4200,
  targetCanvasH: 4800,
  safeBorder: 6,
} satisfies Required<ScanCoreOptions>;

function getAdapterOptions(options?: ScanCoreOptions) {
  return {
    ...DEFAULT_ADAPTER_OPTIONS,
    ...options,
  };
}

function getSingleScanStatus(scanResult: BatchScanResult): SingleScanStatus {
  if (scanResult.failures.length > 0) return 'failure';
  if (scanResult.warnings.length > 0) return 'warning';
  return 'ready';
}

function getRiskLabel(status: SingleScanStatus): SingleRiskLabel {
  if (status === 'failure') return 'HIGH RISK';
  if (status === 'warning') return 'NEEDS REVIEW';
  return 'READY';
}

export function analyzeSingleScan(input: SingleScanAdapterInput): SingleScanAdapterOutput {
  const options = getAdapterOptions(input.options);
  const coreResult = analyzeScanCore({
    ...input,
    options,
  });
  const scanStatus = getSingleScanStatus(coreResult.scanResult);

  return {
    coreStatus: coreResult.status,
    scanStatus,
    riskLabel: getRiskLabel(scanStatus),
    printConfidence: coreResult.scanResult.printConfidence,
    mainIssue: coreResult.scanResult.mainIssue,
    nextAction: coreResult.scanResult.nextAction,
    warnings: coreResult.scanResult.warnings,
    failures: coreResult.scanResult.failures,
    scanResult: coreResult.scanResult,
    targetCanvasW: options.targetCanvasW,
    targetCanvasH: options.targetCanvasH,
    safeBorder: options.safeBorder,
  };
}
