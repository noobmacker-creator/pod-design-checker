import { formatBytes } from './podCheckerUtils';
import type { CheckItem, CheckStatus } from './podCheckerTypes';
import {
  getCompressionArtifactRiskCheck,
  getCutOffEdgeRiskCheck,
  getEmptyPaddingRiskCheck,
  getLowContrastRiskCheck,
  getOversizedArtworkRiskCheck,
  getPixelationRiskCheck,
  getSemiTransparencyRiskCheck,
  getSolidBackgroundBoxRiskCheck,
  getUnevenPaddingRiskCheck,
  getWhiteEdgeHaloCheck,
} from './imageScanChecks';
import { AUTO_FIXABLE_LABELS, ISSUE_PRIORITY, OPTIONAL_NOTE_LABELS, SHORT_ACTION } from './scanCore';
import type { SingleScanAdapterOutput } from './singleScanAdapter';

const SINGLE_ONLY_LABELS = new Set(['Tiny Text Risk', 'Pixelation Risk']);

export type SingleScanParitySnapshot = {
  printConfidence: number | null;
  mainIssue: string;
  nextAction: string;
  warnings: string[];
  failures: string[];
  targetCanvasW: number;
  targetCanvasH: number;
  safeBorder: number;
};

export type SingleScanParityDiff = {
  field: keyof SingleScanParitySnapshot;
  expected: unknown;
  actual: unknown;
};

export type SingleScanLegacySnapshotInput = {
  checks: CheckItem[];
  printScore: number;
  targetCanvasW: number;
  targetCanvasH: number;
  safeBorder: number;
};

export type SingleScanShadowSnapshotInput = {
  file: File | null;
  imageData: ImageData;
  imgW: number;
  imgH: number;
  dpiMetadata: number | null;
  scanTimeMs: number;
  fileSize: number;
  hasTransparency: boolean | null;
  fakeTransparencyDetected: boolean;
  transparentFound: boolean;
  designTooSmallStatus: { status: CheckStatus; message: string };
  offCenterStatus: { status: CheckStatus; message: string };
  safetyBorderStatus: { status: CheckStatus; message: string };
  specks: number;
  thinLinePercent: number;
  targetCanvasW: number;
  targetCanvasH: number;
  safeBorder: number;
};

function isComparableLabel(label: string): boolean {
  return !SINGLE_ONLY_LABELS.has(label) && !OPTIONAL_NOTE_LABELS.has(label);
}

function matchPriorityKey(label: string) {
  return ISSUE_PRIORITY.find((key) => label === key || label.startsWith(key));
}

function pickMainIssue(items: CheckItem[]): CheckItem | null {
  let bestItem: CheckItem | null = null;
  let bestRank = Infinity;

  for (const item of items) {
    const key = matchPriorityKey(item.label);
    const rank = key ? ISSUE_PRIORITY.indexOf(key) : Infinity;
    if (rank < bestRank) {
      bestRank = rank;
      bestItem = item;
    }
  }

  return bestItem;
}

export function buildSingleScanLegacySnapshot(
  input: SingleScanLegacySnapshotInput,
): SingleScanParitySnapshot {
  const comparableChecks = input.checks.filter(
    (item) => (item.status === 'fail' || item.status === 'warn') && isComparableLabel(item.label),
  );
  const warnings = input.checks
    .filter((item) => item.status === 'warn' && isComparableLabel(item.label))
    .map((item) => item.label);
  const failures = input.checks
    .filter((item) => item.status === 'fail' && isComparableLabel(item.label))
    .map((item) => item.label);

  const mainItem = pickMainIssue(comparableChecks);
  const mainIssue = mainItem ? matchPriorityKey(mainItem.label) ?? mainItem.label : 'No major issue found.';
  const nextAction = mainItem
    ? AUTO_FIXABLE_LABELS.has(mainItem.label)
      ? 'Run Auto Fix'
      : SHORT_ACTION[mainItem.label] ?? 'Review scan results'
    : 'Download and upload.';

  let printConfidence = input.printScore;
  if (failures.length > 0) {
    printConfidence = Math.min(printConfidence, 59);
  } else if (warnings.length > 0) {
    printConfidence = Math.min(printConfidence, 89);
  } else if (mainItem && AUTO_FIXABLE_LABELS.has(mainItem.label)) {
    printConfidence = Math.min(printConfidence, 85);
  }

  return {
    printConfidence,
    mainIssue,
    nextAction,
    warnings,
    failures,
    targetCanvasW: input.targetCanvasW,
    targetCanvasH: input.targetCanvasH,
    safeBorder: input.safeBorder,
  };
}

function buildWhiteBackgroundCheck(imageData: ImageData): CheckItem {
  const { data } = imageData;
  const totalPixels = data.length / 4;
  let visiblePixelCount = 0;
  let whiteVisibleCount = 0;
  let transparentPixelCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 40) {
      transparentPixelCount++;
      continue;
    }

    visiblePixelCount++;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r > 235 && g > 235 && b > 235 && alpha > 220) {
      whiteVisibleCount++;
    }
  }

  const whiteRatio = visiblePixelCount === 0 ? 0 : whiteVisibleCount / visiblePixelCount;
  const transparentPixelRatio = totalPixels === 0 ? 0 : transparentPixelCount / totalPixels;

  let status: CheckStatus = 'pass';
  let message = 'No obvious white background detected.';

  if (visiblePixelCount > 0 && transparentPixelRatio < 0.02 && whiteRatio > 0.6) {
    status = 'fail';
    message = 'White background likely detected. Use a transparent PNG for best POD results.';
  } else if (whiteRatio > 0.35) {
    status = 'warn';
    message = 'Possible white background detected. Check before uploading to dark shirts.';
  }

  return {
    label: 'White Background Risk',
    status,
    message,
  };
}

function buildFileTypeCheck(file: File): CheckItem {
  if (file.type.includes('png')) {
    return {
      label: 'File Type Risk',
      status: 'pass',
      message: 'PNG detected. Good choice for transparent POD designs.',
    };
  }

  if (file.type.includes('jpeg') || file.type.includes('jpg')) {
    return {
      label: 'File Type Risk',
      status: 'warn',
      message: 'JPG detected. PNG with transparency is usually safer for POD.',
    };
  }

  return {
    label: 'File Type Risk',
    status: 'warn',
    message: 'Unusual file type detected. PNG is recommended for most POD designs.',
  };
}

function buildFileSizeCheck(fileSize: number): CheckItem {
  return {
    label: 'File Size',
    status: fileSize <= 50 * 1024 * 1024 ? 'pass' : fileSize <= 100 * 1024 * 1024 ? 'warn' : 'fail',
    message:
      fileSize <= 50 * 1024 * 1024
        ? `Good file size: ${formatBytes(fileSize)}`
        : fileSize <= 100 * 1024 * 1024
        ? `Large file size: ${formatBytes(fileSize)}. Should still be okay for many POD platforms, but check upload limits.`
        : `Very large file size: ${formatBytes(fileSize)}. This may fail on some POD platforms.`,
  };
}

function buildTransparencyCheck(hasTransparency: boolean | null): CheckItem {
  return {
    label: 'Transparency',
    status: hasTransparency === null ? 'info' : hasTransparency ? 'pass' : 'warn',
    message:
      hasTransparency === null
        ? 'Not checked yet.'
        : hasTransparency
        ? 'Transparency detected.'
        : 'No transparency detected. PNG with transparent background is preferred for POD.',
  };
}

function buildShadowChecks(input: SingleScanShadowSnapshotInput): CheckItem[] {
  return [
    {
      label: 'Export Size Note',
      status:
        input.imgW === input.targetCanvasW && input.imgH === input.targetCanvasH
          ? 'pass'
          : input.imgW >= input.targetCanvasW && input.imgH >= input.targetCanvasH
          ? 'pass'
          : 'info',
      message:
        input.imgW === input.targetCanvasW && input.imgH === input.targetCanvasH
          ? `Ready for selected target: ${input.imgW} × ${input.imgH}`
          : input.imgW >= input.targetCanvasW && input.imgH >= input.targetCanvasH
          ? `Larger than selected target (${input.targetCanvasW} × ${input.targetCanvasH}).`
          : 'Selected export size is larger than the uploaded file.',
    },
    {
      label: 'Aspect Ratio',
      status:
        Math.abs(input.imgW / input.imgH - input.targetCanvasW / input.targetCanvasH) < 0.01
          ? 'pass'
          : 'info',
      message: 'Aspect ratio checked.',
    },
    buildTransparencyCheck(input.hasTransparency),
    {
      label: 'Fake Transparency Background',
      status: input.fakeTransparencyDetected ? 'fail' : 'pass',
      message: input.fakeTransparencyDetected
        ? 'Possible fake transparency background detected.'
        : 'No fake transparency background detected.',
    },
    buildFileSizeCheck(input.fileSize),
    buildFileTypeCheck(input.file as File),
    getCompressionArtifactRiskCheck(input.imageData),
    {
      label: 'Artwork Size',
      status: 'info',
      message: 'Artwork size measured.',
    },
    getEmptyPaddingRiskCheck(input.imageData),
    getUnevenPaddingRiskCheck(input.imageData),
    getOversizedArtworkRiskCheck(input.imageData),
    {
      label: 'Design Too Small',
      status: input.designTooSmallStatus.status,
      message: input.designTooSmallStatus.message,
    },
    {
      label: 'Off-Center Design',
      status: input.offCenterStatus.status,
      message: input.offCenterStatus.message,
    },
    {
      label: 'Print Safety Border',
      status: input.safetyBorderStatus.status,
      message: input.safetyBorderStatus.message,
    },
    {
      label: 'Stray Speck Check',
      status: input.specks === 0 ? 'pass' : input.specks < 15 ? 'warn' : 'fail',
      message:
        input.specks === 0
          ? 'No obvious stray specks detected.'
          : input.specks < 15
          ? 'Small stray pixels detected outside the main artwork.'
          : 'Heavy stray pixels detected outside the main artwork.',
    },
    {
      label: 'Line Thickness',
      status: input.thinLinePercent < 8 ? 'pass' : input.thinLinePercent < 18 ? 'warn' : 'fail',
      message:
        input.thinLinePercent < 8
          ? 'Line thickness looks healthy for print.'
          : input.thinLinePercent < 18
          ? 'Some thin line risk detected.'
          : 'A lot of thin line risk detected.',
    },
    {
      label: 'DPI Metadata',
      status: 'info',
      message: input.dpiMetadata ? `Embedded DPI metadata: ${input.dpiMetadata} DPI` : 'No DPI metadata found.',
    },
    buildWhiteBackgroundCheck(input.imageData),
    getSolidBackgroundBoxRiskCheck(input.imageData),
    getWhiteEdgeHaloCheck(input.imageData),
    getSemiTransparencyRiskCheck(input.imageData),
    getCutOffEdgeRiskCheck(input.imageData),
    getLowContrastRiskCheck(input.imageData),
    getPixelationRiskCheck(input.imageData),
  ];
}

function buildShadowPrintScore(input: SingleScanShadowSnapshotInput): number {
  let printScore = 100;
  if (input.transparentFound === false) printScore -= 25;
  if (input.fakeTransparencyDetected) printScore -= 15;
  if (input.designTooSmallStatus.status === 'fail') printScore -= 15;
  else if (input.designTooSmallStatus.status === 'warn') printScore -= 8;
  if (input.offCenterStatus.status === 'fail') printScore -= 10;
  else if (input.offCenterStatus.status === 'warn') printScore -= 5;
  if (input.safetyBorderStatus.status === 'fail') printScore -= 15;
  else if (input.safetyBorderStatus.status === 'warn') printScore -= 8;
  if (input.specks > 0) printScore -= 8;
  if (input.thinLinePercent >= 18) printScore -= 12;
  else if (input.thinLinePercent >= 8) printScore -= 5;
  return Math.max(0, printScore);
}

export function buildSingleScanShadowLegacySnapshot(
  input: SingleScanShadowSnapshotInput,
): SingleScanParitySnapshot {
  return buildSingleScanLegacySnapshot({
    checks: buildShadowChecks(input),
    printScore: buildShadowPrintScore(input),
    targetCanvasW: input.targetCanvasW,
    targetCanvasH: input.targetCanvasH,
    safeBorder: input.safeBorder,
  });
}

function arraysStrictEqual(expected: string[], actual: string[]): boolean {
  if (expected.length !== actual.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (expected[i] !== actual[i]) return false;
  }
  return true;
}

export function toSingleScanParitySnapshot(
  adapter: SingleScanAdapterOutput,
): SingleScanParitySnapshot {
  return {
    printConfidence: adapter.printConfidence,
    mainIssue: adapter.mainIssue,
    nextAction: adapter.nextAction,
    warnings: adapter.warnings,
    failures: adapter.failures,
    targetCanvasW: adapter.targetCanvasW,
    targetCanvasH: adapter.targetCanvasH,
    safeBorder: adapter.safeBorder,
  };
}

export function compareSingleScanParity(
  expected: SingleScanParitySnapshot,
  actual: SingleScanParitySnapshot,
): SingleScanParityDiff[] {
  const diffs: SingleScanParityDiff[] = [];

  if (expected.printConfidence !== actual.printConfidence) {
    diffs.push({ field: 'printConfidence', expected: expected.printConfidence, actual: actual.printConfidence });
  }

  if (expected.mainIssue !== actual.mainIssue) {
    diffs.push({ field: 'mainIssue', expected: expected.mainIssue, actual: actual.mainIssue });
  }

  if (expected.nextAction !== actual.nextAction) {
    diffs.push({ field: 'nextAction', expected: expected.nextAction, actual: actual.nextAction });
  }

  if (!arraysStrictEqual(expected.warnings, actual.warnings)) {
    diffs.push({ field: 'warnings', expected: expected.warnings, actual: actual.warnings });
  }

  if (!arraysStrictEqual(expected.failures, actual.failures)) {
    diffs.push({ field: 'failures', expected: expected.failures, actual: actual.failures });
  }

  if (expected.targetCanvasW !== actual.targetCanvasW) {
    diffs.push({ field: 'targetCanvasW', expected: expected.targetCanvasW, actual: actual.targetCanvasW });
  }

  if (expected.targetCanvasH !== actual.targetCanvasH) {
    diffs.push({ field: 'targetCanvasH', expected: expected.targetCanvasH, actual: actual.targetCanvasH });
  }

  if (expected.safeBorder !== actual.safeBorder) {
    diffs.push({ field: 'safeBorder', expected: expected.safeBorder, actual: actual.safeBorder });
  }

  return diffs;
}
