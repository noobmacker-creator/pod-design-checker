import type { CheckItem, CheckStatus } from './podCheckerTypes';

export type CompatibilityRating = 'good' | 'review' | 'poor';

export type PrintMethod = 'DTG' | 'DTF' | 'Screen Print' | 'Sublimation';

export type PrintMethodCompatibilityResult = {
  method: PrintMethod;
  rating: CompatibilityRating;
  reason: string;
};

export type PrintMethodCompatibilityInput = {
  hasTransparency: boolean | null;
  semiTransparentRatio: number;
  dominantColourCount: number;
  gradientLikely: boolean;
  photographicLikely: boolean;
  thinLinePercent: number;
  speckCount: number;
  practicalPrintDpi: number;
  coveragePercent: number;
  designTooSmall: boolean;
  filledBackgroundLikely: boolean;
  isJpeg: boolean;
};

export type PrintMethodMetrics = Pick<
  PrintMethodCompatibilityInput,
  | 'semiTransparentRatio'
  | 'dominantColourCount'
  | 'gradientLikely'
  | 'photographicLikely'
  | 'filledBackgroundLikely'
>;

const SAMPLE_STEP = 4;
const COLOUR_BUCKET = 32;

function quantizeChannel(value: number): number {
  return Math.min(COLOUR_BUCKET - 1, Math.floor(value / (256 / COLOUR_BUCKET)));
}

function checkStatusIsWarnOrFail(status: CheckStatus | undefined): boolean {
  return status === 'warn' || status === 'fail';
}

function getCheckStatus(checks: CheckItem[] | undefined, label: string): CheckStatus | undefined {
  return checks?.find((item) => item.label === label)?.status;
}

/** Lightweight colour / gradient metrics from canvas ImageData. */
export function extractPrintMethodMetrics(
  imageData: ImageData,
  file: File | null,
): PrintMethodMetrics {
  const { data, width, height } = imageData;
  const colourBuckets = new Set<number>();
  let visibleSampled = 0;
  let semiTransparentSampled = 0;
  let moderateTransitionCount = 0;
  let transitionSamples = 0;
  let transparentSampled = 0;
  let totalSampled = 0;

  const isJpeg =
    file?.type.includes('jpeg') ||
    file?.type.includes('jpg') ||
    (file?.name.split('.').pop()?.toLowerCase() ?? '') === 'jpg' ||
    (file?.name.split('.').pop()?.toLowerCase() ?? '') === 'jpeg';

  for (let y = 0; y < height; y += SAMPLE_STEP) {
    for (let x = 0; x < width; x += SAMPLE_STEP) {
      const idx = (y * width + x) * 4;
      const a = data[idx + 3];
      totalSampled++;

      if (a < 20) {
        transparentSampled++;
        continue;
      }

      visibleSampled++;
      const bucketKey =
        (quantizeChannel(data[idx]) << 16) |
        (quantizeChannel(data[idx + 1]) << 8) |
        quantizeChannel(data[idx + 2]);
      colourBuckets.add(bucketKey);

      if (a >= 220) {
        // solid
      } else {
        semiTransparentSampled++;
      }

      if (x + SAMPLE_STEP < width) {
        const nidx = (y * width + (x + SAMPLE_STEP)) * 4;
        const na = data[nidx + 3];
        if (na > 20 && a > 20) {
          const diff =
            Math.abs(data[idx] - data[nidx]) +
            Math.abs(data[idx + 1] - data[nidx + 1]) +
            Math.abs(data[idx + 2] - data[nidx + 2]);
          transitionSamples++;
          if (diff >= 18 && diff <= 90) {
            moderateTransitionCount++;
          }
        }
      }
    }
  }

  const semiTransparentRatio =
    visibleSampled === 0 ? 0 : semiTransparentSampled / visibleSampled;
  const transitionRatio =
    transitionSamples === 0 ? 0 : moderateTransitionCount / transitionSamples;
  const dominantColourCount = colourBuckets.size;
  const transparencyRatio = totalSampled === 0 ? 0 : transparentSampled / totalSampled;

  const gradientLikely =
    semiTransparentRatio >= 0.03 || transitionRatio >= 0.22 || dominantColourCount >= 48;

  const photographicLikely =
    dominantColourCount >= 64 &&
    (isJpeg || transitionRatio >= 0.28 || semiTransparentRatio >= 0.08);

  const filledBackgroundLikely = transparencyRatio < 0.02;

  return {
    semiTransparentRatio,
    dominantColourCount,
    gradientLikely,
    photographicLikely,
    filledBackgroundLikely,
  };
}

export function buildPrintMethodCompatibilityInput(params: {
  imageData: ImageData;
  file: File | null;
  hasTransparency: boolean | null;
  thinLinePercent: number;
  speckCount: number;
  practicalPrintDpi: number;
  coveragePercent: number;
  designTooSmallStatus?: CheckStatus;
  checks?: CheckItem[];
}): PrintMethodCompatibilityInput {
  const metrics = extractPrintMethodMetrics(params.imageData, params.file);
  const solidBackgroundWarn = checkStatusIsWarnOrFail(
    getCheckStatus(params.checks, 'Solid Background Box Risk'),
  );
  const whiteBackgroundWarn = checkStatusIsWarnOrFail(
    getCheckStatus(params.checks, 'White Background Risk'),
  );
  const compressionWarn = checkStatusIsWarnOrFail(
    getCheckStatus(params.checks, 'Compression Artifact Risk'),
  );

  const isJpeg =
    params.file?.type.includes('jpeg') ||
    params.file?.type.includes('jpg') ||
    false;

  return {
    hasTransparency: params.hasTransparency,
    semiTransparentRatio: metrics.semiTransparentRatio,
    dominantColourCount: metrics.dominantColourCount,
    gradientLikely: metrics.gradientLikely,
    photographicLikely:
      metrics.photographicLikely || (compressionWarn && metrics.dominantColourCount >= 40),
    thinLinePercent: params.thinLinePercent,
    speckCount: params.speckCount,
    practicalPrintDpi: params.practicalPrintDpi,
    coveragePercent: params.coveragePercent,
    designTooSmall: checkStatusIsWarnOrFail(params.designTooSmallStatus),
    filledBackgroundLikely:
      metrics.filledBackgroundLikely ||
      params.hasTransparency === false ||
      solidBackgroundWarn ||
      whiteBackgroundWarn,
    isJpeg,
  };
}

function joinReasons(reasons: string[]): string {
  if (reasons.length === 0) return 'No major artwork property conflicts detected.';
  if (reasons.length === 1) return reasons[0];
  return reasons.slice(0, 2).join(' ');
}

function rateFromSignals(
  goodSignals: string[],
  reviewSignals: string[],
  poorSignals: string[],
): PrintMethodCompatibilityResult['rating'] {
  if (poorSignals.length >= 2 || (poorSignals.length >= 1 && reviewSignals.length >= 2)) {
    return 'poor';
  }
  if (poorSignals.length >= 1 || reviewSignals.length >= 2) {
    return 'review';
  }
  if (reviewSignals.length >= 1) {
    return 'review';
  }
  if (goodSignals.length >= 1) {
    return 'good';
  }
  return 'review';
}

function evaluateDtg(input: PrintMethodCompatibilityInput): PrintMethodCompatibilityResult {
  const good: string[] = [];
  const review: string[] = [];
  const poor: string[] = [];

  if (input.hasTransparency === true) {
    good.push('Transparent artwork suits garment printing.');
  } else if (input.hasTransparency === false) {
    review.push('No transparency detected.');
  }

  if (input.gradientLikely || input.dominantColourCount >= 24) {
    good.push('Gradients and multiple colours detected.');
  }

  if (input.photographicLikely) {
    good.push('Photographic detail detected.');
  }

  if (input.semiTransparentRatio >= 0.25) {
    review.push('Semi-transparency detected.');
  } else if (input.semiTransparentRatio >= 0.03) {
    review.push('Some semi-transparent edge pixels detected.');
  }

  if (input.speckCount >= 15) {
    review.push('Tiny isolated specks detected.');
  } else if (input.speckCount > 0) {
    review.push('Fine specks may need review.');
  }

  if (input.thinLinePercent >= 18) {
    review.push('Fine details may be difficult.');
  }

  if (input.practicalPrintDpi > 0 && input.practicalPrintDpi < 150) {
    review.push('Practical resolution is weak.');
  }

  const rating = rateFromSignals(good, review, poor);
  const reason =
    rating === 'good'
      ? joinReasons(good.length ? good : ['Likely a good match for direct-to-garment printing.'])
      : joinReasons(review.length ? review : poor);

  return { method: 'DTG', rating, reason };
}

function evaluateDtf(input: PrintMethodCompatibilityInput): PrintMethodCompatibilityResult {
  const good: string[] = [];
  const review: string[] = [];
  const poor: string[] = [];

  if (input.hasTransparency === true) {
    good.push('Transparent artwork suits transfer printing.');
  }

  if (input.dominantColourCount <= 24 && input.dominantColourCount > 0) {
    good.push('Bold colour regions detected.');
  }

  if (input.gradientLikely) {
    good.push('Gradients detected.');
  }

  if (input.hasTransparency === true && input.semiTransparentRatio < 0.12) {
    good.push('Clear solid edges likely.');
  }

  if (input.semiTransparentRatio >= 0.25) {
    review.push('Excessive semi-transparency detected.');
  } else if (input.semiTransparentRatio >= 0.08) {
    review.push('Semi-transparency detected.');
  }

  if (input.speckCount >= 8 && input.thinLinePercent >= 8) {
    review.push('Very fine distressed texture detected.');
  }

  if (input.speckCount >= 15) {
    review.push('Tiny isolated specks detected.');
  } else if (input.speckCount > 0) {
    review.push('Small specks may need review.');
  }

  if (input.thinLinePercent >= 18) {
    review.push('Fine details may be difficult.');
  }

  const rating = rateFromSignals(good, review, poor);
  const reason =
    rating === 'good'
      ? joinReasons(good.length ? good : ['Likely a good match for DTF transfers.'])
      : joinReasons(review.length ? review : poor);

  return { method: 'DTF', rating, reason };
}

function evaluateScreenPrint(input: PrintMethodCompatibilityInput): PrintMethodCompatibilityResult {
  const good: string[] = [];
  const review: string[] = [];
  const poor: string[] = [];

  if (input.dominantColourCount <= 12) {
    good.push('Limited dominant colours detected.');
  } else if (input.dominantColourCount >= 32) {
    poor.push('Many colours detected.');
  } else {
    review.push('Moderate colour count detected.');
  }

  if (input.filledBackgroundLikely && input.dominantColourCount <= 16) {
    good.push('Large solid colour regions present.');
  }

  if (input.semiTransparentRatio < 0.03) {
    good.push('Little semi-transparency detected.');
  } else if (input.semiTransparentRatio >= 0.12) {
    poor.push('Semi-transparency detected.');
  } else {
    review.push('Some semi-transparency detected.');
  }

  if (!input.gradientLikely && input.dominantColourCount <= 20) {
    good.push('No complex gradients likely.');
  } else if (input.gradientLikely) {
    poor.push('Gradients detected.');
  }

  if (input.photographicLikely) {
    poor.push('Photographic detail detected.');
  }

  if (input.thinLinePercent >= 18) {
    poor.push('Very thin lines detected.');
  } else if (input.thinLinePercent >= 8) {
    review.push('Thin lines detected.');
  }

  if (input.speckCount >= 15) {
    review.push('Tiny details detected.');
  }

  const rating = rateFromSignals(good, review, poor);
  const reason =
    rating === 'good'
      ? joinReasons(good.length ? good : ['Likely a good match for screen printing.'])
      : joinReasons(poor.length ? poor : review);

  return { method: 'Screen Print', rating, reason };
}

function evaluateSublimation(input: PrintMethodCompatibilityInput): PrintMethodCompatibilityResult {
  const good: string[] = [];
  const review: string[] = [];
  const poor: string[] = [];

  if (input.photographicLikely || input.dominantColourCount >= 40) {
    good.push('Many colours or photographic detail detected.');
  }

  if (input.gradientLikely) {
    good.push('Gradients detected.');
  }

  if (input.filledBackgroundLikely || input.coveragePercent >= 55) {
    good.push('Full-background artwork may suit sublimation products.');
  }

  if (input.hasTransparency === true && input.coveragePercent < 45) {
    review.push('Design relies on transparent garment areas.');
  }

  if (input.designTooSmall || input.coveragePercent < 18) {
    review.push('Small isolated graphic may not suit full sublimation layouts.');
  }

  if (input.practicalPrintDpi > 0 && input.practicalPrintDpi < 150) {
    review.push('Practical image quality is weak.');
  }

  const rating = rateFromSignals(good, review, poor);
  const reason =
    rating === 'good'
      ? joinReasons(good.length ? good : ['Likely a good match for sublimation-style artwork.'])
      : joinReasons(review.length ? review : poor);

  return { method: 'Sublimation', rating, reason };
}

export function evaluatePrintMethodCompatibility(
  input: PrintMethodCompatibilityInput,
): PrintMethodCompatibilityResult[] {
  return [
    evaluateDtg(input),
    evaluateDtf(input),
    evaluateScreenPrint(input),
    evaluateSublimation(input),
  ];
}

export function computePrintMethodCompatibility(params: {
  imageData: ImageData;
  file: File | null;
  hasTransparency: boolean | null;
  thinLinePercent: number;
  speckCount: number;
  imgW: number;
  imgH: number;
  coveragePercent: number;
  designTooSmallStatus?: CheckStatus;
  checks?: CheckItem[];
}): PrintMethodCompatibilityResult[] {
  const practicalPrintDpi =
    params.imgW > 0 && params.imgH > 0
      ? Math.round(Math.min(params.imgW / 14, params.imgH / 16))
      : 0;

  return evaluatePrintMethodCompatibility(
    buildPrintMethodCompatibilityInput({
      imageData: params.imageData,
      file: params.file,
      hasTransparency: params.hasTransparency,
      thinLinePercent: params.thinLinePercent,
      speckCount: params.speckCount,
      practicalPrintDpi,
      coveragePercent: params.coveragePercent,
      designTooSmallStatus: params.designTooSmallStatus,
      checks: params.checks,
    }),
  );
}

export function compatibilityRatingLabel(rating: CompatibilityRating): string {
  if (rating === 'good') return 'Good Match';
  if (rating === 'review') return 'Review Needed';
  return 'Poor Match';
}
