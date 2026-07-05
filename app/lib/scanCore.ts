import type { CheckItem, CheckStatus } from './podCheckerTypes';
import {
  detectBoundsAndCoverage,
  detectFakeTransparencyBackground,
  estimateThinLines,
  formatBytes,
  getEffectiveArtBounds,
} from './podCheckerUtils';
import {
  analyzeStructuralArtwork,
  getCompressionArtifactRiskCheck,
  getCutOffEdgeRiskCheck,
  getEmptyPaddingRiskCheck,
  getLowContrastRiskCheck,
  getOversizedArtworkRiskCheck,
  getSemiTransparencyRiskCheck,
  getSolidBackgroundBoxRiskCheck,
  getUnevenPaddingRiskCheck,
  getWhiteEdgeHaloCheck,
} from './imageScanChecks';
import type { BatchScanResult, BatchScanStatus } from './batchQueueUtils';

const CANVAS_W = 4200;
const CANVAS_H = 4800;
const SAFE_BORDER = 6;

export const AUTO_FIXABLE_LABELS = new Set([
  'Design Too Small',
  'Print Safety Border',
  'Off-Center Design',
  'Empty Padding Risk',
  'Uneven Padding Risk',
  'Artwork Near Canvas Edge',
  'Cut-Off Edge Risk',
]);

export const OPTIONAL_NOTE_LABELS = new Set([
  'Soft Transparency',
  'Export Size Note',
  'Artwork Size',
  'DPI Metadata',
]);

export const ISSUE_PRIORITY = [
  'Solid Background Box Risk',
  'White Background Risk',
  'Fake Transparency Background',
  'File Type Risk',
  'Aspect Ratio',
  'Cut-Off Edge Risk',
  'Artwork Near Canvas Edge',
  'Empty Padding Risk',
  'Uneven Padding Risk',
  'Design Too Small',
  'Print Safety Border',
  'White Edge / Halo Risk',
  'Compression Artifact Risk',
  'Low Contrast Risk',
  'Line Thickness',
  'Off-Center Design',
  'Artwork Size',
  'Stray Speck Check',
] as const;

export const SHORT_ACTION: Record<string, string> = {
  'Solid Background Box Risk': 'Remove the solid background or upload a transparent PNG.',
  'White Background Risk': 'Use transparent PNG',
  'Fake Transparency Background': 'Fix fake transparency',
  'File Type Risk': 'Use PNG source file',
  'White Edge / Halo Risk': 'Clean design edges',
  'Compression Artifact Risk': 'Use cleaner PNG',
  'Low Contrast Risk': 'Increase contrast',
  'Line Thickness': 'Thicken fine lines',
  'Stray Speck Check': 'Remove stray marks',
  'Design Too Small': 'Run Auto Fix',
  'Print Safety Border': 'Run Auto Fix',
  'Off-Center Design': 'Run Auto Fix',
  'Empty Padding Risk': 'Run Auto Fix',
  'Uneven Padding Risk': 'Run Auto Fix',
  'Artwork Near Canvas Edge': 'Run Auto Fix',
  'Cut-Off Edge Risk': 'Run Auto Fix',
};

type Bounds = { x: number; y: number; w: number; h: number };

function getWhiteBackgroundCheck(imageData: ImageData): CheckItem {
  const wbData = imageData.data;
  const totalPixels = wbData.length / 4;
  let visiblePixelCount = 0;
  let whiteVisibleCount = 0;
  let transparentPixelCount = 0;

  for (let i = 0; i < wbData.length; i += 4) {
    const a = wbData[i + 3];
    if (a < 40) {
      transparentPixelCount++;
      continue;
    }
    visiblePixelCount++;
    const r = wbData[i];
    const g = wbData[i + 1];
    const b = wbData[i + 2];
    if (r > 235 && g > 235 && b > 235 && a > 220) {
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

  return { label: 'White Background Risk', status, message };
}

function getDefaultTransform(imgW: number, imgH: number) {
  const scaleX = CANVAS_W / imgW;
  const scaleY = CANVAS_H / imgH;
  const scale = Math.min(scaleX, scaleY);
  const scaledW = imgW * scale;
  const scaledH = imgH * scale;
  return {
    scale,
    offsetX: Math.round((CANVAS_W - scaledW) / 2),
    offsetY: Math.round((CANVAS_H - scaledH) / 2),
  };
}

function getDesignTooSmallStatus(
  effectiveBounds: Bounds | null,
  originalBounds: Bounds | null,
  imgW: number,
  imgH: number,
  targetCanvasW: number,
  targetCanvasH: number,
): { status: CheckStatus; message: string } {
  if (!effectiveBounds) {
    return { status: 'warn', message: 'Could not measure artwork size clearly.' };
  }

  const isSelectedTargetSizedImage = imgW === targetCanvasW && imgH === targetCanvasH;
  const exportFitScale = Math.min(targetCanvasW / CANVAS_W, targetCanvasH / CANVAS_H);
  const exportBoundsW = effectiveBounds.w * exportFitScale;
  const exportBoundsH = effectiveBounds.h * exportFitScale;
  const measuredBoundsW = isSelectedTargetSizedImage && originalBounds ? originalBounds.w : exportBoundsW;
  const measuredBoundsH = isSelectedTargetSizedImage && originalBounds ? originalBounds.h : exportBoundsH;
  const widthRatio = measuredBoundsW / targetCanvasW;
  const heightRatio = measuredBoundsH / targetCanvasH;
  const areaRatio = (measuredBoundsW * measuredBoundsH) / (targetCanvasW * targetCanvasH);

  if (widthRatio >= 0.55 && heightRatio >= 0.55 && areaRatio >= 0.22) {
    return {
      status: 'pass',
      message: `Artwork fill looks healthy. Width ${(widthRatio * 100).toFixed(0)}% • Height ${(heightRatio * 100).toFixed(0)}%`,
    };
  }

  if (widthRatio >= 0.38 && heightRatio >= 0.38 && areaRatio >= 0.1) {
    return {
      status: isSelectedTargetSizedImage ? 'pass' : 'warn',
      message: isSelectedTargetSizedImage
        ? 'Design fill is moderate, but this file is already sized for the selected target.'
        : 'Design may print a bit small. Auto Fix can help before export.',
    };
  }

  return {
    status: isSelectedTargetSizedImage ? 'warn' : 'fail',
    message: isSelectedTargetSizedImage
      ? 'Design fill is still quite small for the selected target.'
      : 'Design looks too small and may print tiny. Auto Fix can help before export.',
  };
}

function getOffCenterStatus(effectiveBounds: Bounds | null): { status: CheckStatus; message: string } {
  if (!effectiveBounds) {
    return { status: 'warn', message: 'Could not measure artwork position clearly.' };
  }

  const artCenterX = effectiveBounds.x + effectiveBounds.w / 2;
  const artCenterY = effectiveBounds.y + effectiveBounds.h / 2;
  const deltaX = artCenterX - CANVAS_W / 2;
  const deltaY = artCenterY - CANVAS_H / 2;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (absX <= 40 && absY <= 40) {
    return { status: 'pass', message: 'Artwork looks well centered.' };
  }
  if (absX <= 120 && absY <= 120) {
    return { status: 'warn', message: 'Artwork is slightly off-center. Auto Fix can help.' };
  }
  return { status: 'fail', message: 'Artwork is noticeably off-center. Auto Fix can help.' };
}

function getSafetyBorderStatus(effectiveBounds: Bounds | null): { status: CheckStatus; message: string } {
  if (!effectiveBounds) {
    return {
      status: 'warn',
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
      status: 'pass',
      message: `Artwork appears safely inside the ${SAFE_BORDER}px safety border.`,
    };
  }
  if (minEdge >= SAFE_BORDER) {
    return {
      status: 'warn',
      message: 'Safe but close to edge. Auto Fix can add more breathing room.',
    };
  }
  return {
    status: 'fail',
    message: 'Artwork is touching or very close to the safety edge. Auto Fix can help.',
  };
}

function computePrintScore(params: {
  hasTransparency: boolean | null;
  fakeTransparencyDetected: boolean;
  designTooSmallStatus: CheckStatus;
  offCenterStatus: CheckStatus;
  safetyBorderStatus: CheckStatus;
  specks: number;
  thinLinePercent: number;
}): number {
  let score = 100;
  if (params.hasTransparency === false) score -= 25;
  if (params.fakeTransparencyDetected) score -= 15;
  if (params.designTooSmallStatus === 'fail') score -= 15;
  else if (params.designTooSmallStatus === 'warn') score -= 8;
  if (params.offCenterStatus === 'fail') score -= 10;
  else if (params.offCenterStatus === 'warn') score -= 5;
  if (params.safetyBorderStatus === 'fail') score -= 15;
  else if (params.safetyBorderStatus === 'warn') score -= 8;
  if (params.specks > 0) score -= 8;
  if (params.thinLinePercent >= 18) score -= 12;
  else if (params.thinLinePercent >= 8) score -= 5;
  return Math.max(0, score);
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

function pickMainIssueLabel(labels: string[]): string | null {
  if (labels.length === 0) return null;
  let bestLabel = labels[0];
  let bestRank = Infinity;
  for (const label of labels) {
    const key = matchPriorityKey(label);
    const rank = key ? ISSUE_PRIORITY.indexOf(key) : Infinity;
    if (rank < bestRank) {
      bestRank = rank;
      bestLabel = label;
    }
  }
  return matchPriorityKey(bestLabel) ?? bestLabel;
}

export const REVIEW_ACTION: Record<string, string> = {
  ...SHORT_ACTION,
  'Line Thickness': 'Inspect thin details',
  'Fake Transparency Background': 'Fix the source transparency',
};

/** After Auto Fix, current display must reflect post-fix review issues, not stale Run Auto Fix. */
export function resolvePostAutoFixScanResult(
  scanResult: BatchScanResult,
  finalStatus: BatchScanStatus,
): BatchScanResult {
  if (finalStatus === 'safe-auto-fix') {
    return scanResult;
  }

  const remainingLabels = [...scanResult.failures, ...scanResult.warnings].filter(
    (label) => !AUTO_FIXABLE_LABELS.has(label),
  );

  if (remainingLabels.length > 0) {
    const mainIssue = pickMainIssueLabel(remainingLabels) ?? scanResult.mainIssue;
    const nextAction =
      AUTO_FIXABLE_LABELS.has(mainIssue)
        ? REVIEW_ACTION[mainIssue] ?? 'Review scan results'
        : REVIEW_ACTION[mainIssue] ?? SHORT_ACTION[mainIssue] ?? 'Review scan results';

    return {
      ...scanResult,
      mainIssue,
      nextAction,
    };
  }

  if (scanResult.nextAction === 'Run Auto Fix') {
    return {
      ...scanResult,
      nextAction: REVIEW_ACTION[scanResult.mainIssue] ?? 'Review scan results',
    };
  }

  return scanResult;
}

function getDisplayConfidence(
  printScore: number,
  status: BatchScanStatus,
  mainIssueLabel: string | null,
): number {
  let score = printScore;
  if (status === 'failed') return Math.min(score, 59);
  if (status === 'needs-review') return Math.min(score, 89);
  if (status === 'safe-auto-fix') return Math.min(score, 85);
  if (mainIssueLabel && AUTO_FIXABLE_LABELS.has(mainIssueLabel)) return Math.min(score, 85);
  return score;
}

function classifyBatchStatus(blockingChecks: CheckItem[]): BatchScanStatus {
  if (blockingChecks.length === 0) return 'ready';
  const allAutoFixable = blockingChecks.every((item) => AUTO_FIXABLE_LABELS.has(item.label));
  if (allAutoFixable) return 'safe-auto-fix';
  return 'needs-review';
}

export type BatchScanAnalysisInput = {
  file: File;
  imageData: ImageData;
  imgW: number;
  imgH: number;
  dpiMetadata: number | null;
  scanTimeMs: number;
};

export type BatchFileScanOutput = {
  status: BatchScanStatus;
  scanResult: BatchScanResult;
};

export function analyzeBatchScan(input: BatchScanAnalysisInput): BatchFileScanOutput {
  const { file, imageData, imgW, imgH, dpiMetadata, scanTimeMs } = input;

  const boundsResult = detectBoundsAndCoverage(imageData, 10);
  // Single connected-component pass: stray-speck count plus structural artwork bounds
  // (union of components larger than the speck limit). Tiny specks are excluded from
  // the structural bounds so layout checks are not thrown off by them.
  const structural = analyzeStructuralArtwork(imageData);
  const specks = structural.speckCount;
  const structuralBounds = structural.structuralBounds;
  // Use structural bounds for layout; fall back to detected bounds only when no
  // structural component was found.
  const originalBounds = structuralBounds
    ? { x: structuralBounds.x, y: structuralBounds.y, w: structuralBounds.w, h: structuralBounds.h }
    : boundsResult.bounds;
  const thinLinePercent = estimateThinLines(imageData);
  const fakeTransparency = detectFakeTransparencyBackground(imageData);
  const fakeTransparencyDetected = fakeTransparency.detected;

  let hasTransparency: boolean | null = false;
  for (let i = 3; i < imageData.data.length; i += 4) {
    if (imageData.data[i] < 255) {
      hasTransparency = true;
      break;
    }
  }

  const transform = getDefaultTransform(imgW, imgH);
  const effectiveBounds = getEffectiveArtBounds(originalBounds, transform);
  const targetCanvasW = CANVAS_W;
  const targetCanvasH = CANVAS_H;
  const targetCanvasAspect = targetCanvasW / targetCanvasH;

  const designTooSmallStatus = getDesignTooSmallStatus(
    effectiveBounds,
    originalBounds,
    imgW,
    imgH,
    targetCanvasW,
    targetCanvasH,
  );
  const offCenterStatus = getOffCenterStatus(effectiveBounds);
  const safetyBorderStatus = getSafetyBorderStatus(effectiveBounds);

  const whiteBackgroundCheck = getWhiteBackgroundCheck(imageData);
  const whiteEdgeCheck = getWhiteEdgeHaloCheck(imageData);
  const semiTransparencyCheck = getSemiTransparencyRiskCheck(imageData);
  const cutOffEdgeCheck = getCutOffEdgeRiskCheck(imageData, structuralBounds);
  const lowContrastCheck = getLowContrastRiskCheck(imageData);
  const compressionArtifactCheck = getCompressionArtifactRiskCheck(imageData);
  const emptyPaddingCheck = getEmptyPaddingRiskCheck(imageData, structuralBounds);
  const unevenPaddingCheck = getUnevenPaddingRiskCheck(imageData, structuralBounds);
  const oversizedArtworkCheck = getOversizedArtworkRiskCheck(imageData, structuralBounds);
  const solidBackgroundBoxCheck = getSolidBackgroundBoxRiskCheck(imageData);

  const exactSize = imgW === targetCanvasW && imgH === targetCanvasH;
  const aspect = imgW / imgH;
  const aspectClose = Math.abs(aspect - targetCanvasAspect) < 0.01;
  const largerThanTarget = imgW >= targetCanvasW && imgH >= targetCanvasH;

  const fileTypeCheck: CheckItem = file.type.includes('png')
    ? { label: 'File Type Risk', status: 'pass', message: 'PNG detected. Good choice for transparent POD designs.' }
    : file.type.includes('jpeg') || file.type.includes('jpg')
    ? {
        label: 'File Type Risk',
        status: 'warn',
        message: 'JPG detected. PNG with transparency is usually safer for POD.',
      }
    : {
        label: 'File Type Risk',
        status: 'warn',
        message: 'Unusual file type detected. PNG is recommended for most POD designs.',
      };

  const checks: CheckItem[] = [
    {
      label: 'Export Size Note',
      status: exactSize || largerThanTarget ? 'pass' : 'info',
      message: exactSize
        ? `Ready for selected target: ${imgW} × ${imgH}`
        : 'Selected export size is larger than the uploaded file.',
    },
    {
      label: 'Aspect Ratio',
      status: aspectClose ? 'pass' : 'info',
      message: aspectClose ? `Good aspect ratio: ${aspect.toFixed(3)}` : 'Aspect differs from standard target.',
    },
    {
      label: 'Transparency',
      status: hasTransparency ? 'pass' : 'warn',
      message: hasTransparency
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
        file.size <= 50 * 1024 * 1024 ? 'pass' : file.size <= 100 * 1024 * 1024 ? 'warn' : 'fail',
      message:
        file.size <= 50 * 1024 * 1024
          ? `Good file size: ${formatBytes(file.size)}`
          : file.size <= 100 * 1024 * 1024
          ? `Large file size: ${formatBytes(file.size)}.`
          : `Very large file size: ${formatBytes(file.size)}.`,
    },
    fileTypeCheck,
    compressionArtifactCheck,
    {
      label: 'Artwork Size',
      status: 'info',
      message: effectiveBounds
        ? `Detected artwork area: ${Math.round(effectiveBounds.w)} × ${Math.round(effectiveBounds.h)}`
        : 'Artwork area measurement unavailable.',
    },
    emptyPaddingCheck,
    unevenPaddingCheck,
    oversizedArtworkCheck,
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
      label: 'Stray Speck Check',
      status: specks === 0 ? 'pass' : specks < 15 ? 'warn' : 'fail',
      message:
        specks === 0
          ? 'No obvious stray specks detected.'
          : specks < 15
          ? 'Small stray pixels detected outside the main artwork.'
          : 'Heavy stray pixels detected outside the main artwork.',
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
      message: dpiMetadata ? `Embedded DPI metadata: ${dpiMetadata} DPI` : 'No DPI metadata found.',
    },
    whiteBackgroundCheck,
    solidBackgroundBoxCheck,
    whiteEdgeCheck,
    semiTransparencyCheck,
    cutOffEdgeCheck,
    lowContrastCheck,
  ];

  const blockingChecks = checks.filter(
    (item) =>
      (item.status === 'fail' || item.status === 'warn') &&
      !OPTIONAL_NOTE_LABELS.has(item.label),
  );

  const failures = checks.filter((item) => item.status === 'fail').map((item) => item.label);
  const warnings = checks.filter((item) => item.status === 'warn').map((item) => item.label);

  const status = classifyBatchStatus(blockingChecks);
  const mainItem = pickMainIssue(
    checks.filter(
      (item) =>
        (item.status === 'fail' || item.status === 'warn') &&
        !OPTIONAL_NOTE_LABELS.has(item.label),
    ),
  );
  const mainIssue = mainItem ? matchPriorityKey(mainItem.label) ?? mainItem.label : 'No major issue found.';
  const nextAction = mainItem
    ? AUTO_FIXABLE_LABELS.has(mainItem.label)
      ? 'Run Auto Fix'
      : SHORT_ACTION[mainItem.label] ?? 'Review scan results'
    : 'Download and upload.';

  const printScore = computePrintScore({
    hasTransparency,
    fakeTransparencyDetected,
    designTooSmallStatus: designTooSmallStatus.status,
    offCenterStatus: offCenterStatus.status,
    safetyBorderStatus: safetyBorderStatus.status,
    specks,
    thinLinePercent,
  });

  const printConfidence = getDisplayConfidence(printScore, status, mainItem?.label ?? null);

  return {
    status,
    scanResult: {
      printConfidence,
      mainIssue,
      nextAction,
      warnings,
      failures,
      scanTimeMs,
    },
  };
}
