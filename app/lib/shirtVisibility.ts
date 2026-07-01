import type { CheckItem } from './podCheckerTypes';

export type RGB = { r: number; g: number; b: number };

export type ShirtVisibilityLevel = 'strong' | 'preview' | 'low';

/** Shirt background colours — matches DesignPreviewPanel preview options plus Light Blue. */
export const SHIRT_COLOUR_PRESETS = [
  { name: 'White', r: 255, g: 255, b: 255 },
  { name: 'Black', r: 0, g: 0, b: 0 },
  { name: 'Dark Grey', r: 0x4b, g: 0x55, b: 0x63 },
  { name: 'Navy', r: 0x1e, g: 0x3a, b: 0x8a },
  { name: 'Red', r: 0xdc, g: 0x26, b: 0x26 },
  { name: 'Pink', r: 0xf4, g: 0x72, b: 0xb6 },
  { name: 'Light Blue', r: 0x93, g: 0xc5, b: 0xfd },
] as const;

export type ShirtVisibilityMetrics = {
  shirtName: string;
  level: ShirtVisibilityLevel;
  boundaryLowPercentileContrast: number;
  visiblePixelLowPercentileContrast: number;
  internalEdgeRetention: number;
  lowContrastPixelFraction: number;
  lowColourSeparationFraction: number;
  semiTransparentPixelFraction: number;
  semiTransparencyRisk: boolean;
  visibilityScore: number;
};

/** Calibration defaults — tune with controlled fixtures, not industry standards. */
export const SHIRT_VISIBILITY_THRESHOLDS = {
  MAX_ANALYSIS_DIM: 850,
  ALPHA_TRANSPARENT: 10,
  ALPHA_SEMI_MAX: 239,
  PERCENTILE: 0.08,
  STRONG_MIN_BOUNDARY_CONTRAST: 2.8,
  STRONG_MIN_VISIBLE_CONTRAST: 2.4,
  STRONG_MIN_EDGE_RETENTION: 0.48,
  STRONG_MAX_LOW_CONTRAST_FRAC: 0.22,
  STRONG_MAX_LOW_SEPARATION_FRAC: 0.28,
  PREVIEW_MIN_BOUNDARY_CONTRAST: 1.6,
  PREVIEW_MIN_VISIBLE_CONTRAST: 1.35,
  PREVIEW_MIN_EDGE_RETENTION: 0.28,
  LOW_CONTRAST_RATIO: 1.35,
  LOW_DELTA_E: 0.06,
  SEMI_TRANSPARENT_FRAC_RISK: 0.06,
  EDGE_GRADIENT_PERCENTILE: 0.72,
} as const;

export function srgb8ToLinear(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function linearToSrgb8(v: number): number {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.round(Math.min(255, Math.max(0, c * 255)));
}

export function compositeSourceOverLinear(
  src: RGB,
  srcAlpha: number,
  dst: RGB,
): RGB {
  const a = srcAlpha;
  const ia = 1 - a;
  return {
    r: src.r * a + dst.r * ia,
    g: src.g * a + dst.g * ia,
    b: src.b * a + dst.b * ia,
  };
}

export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(l1: number, l2: number): number {
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

type Oklab = { L: number; a: number; b: number };

export function linearSrgbToOklab(r: number, g: number, b: number): Oklab {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.357977544 * m_ + 0.4505930899 * s_,
    b: 0.805610645 * l_ - 0.772840092 * m_ + 0.005331365 * s_,
  };
}

export function deltaEOK(a: Oklab, b: Oklab): number {
  const dL = a.L - b.L;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)));
  return sorted[idx];
}

function downsampleImageData(source: ImageData, maxDim: number): ImageData {
  const { width, height, data } = source;
  const longest = Math.max(width, height);
  if (longest <= maxDim) return source;

  const scale = maxDim / longest;
  const nw = Math.max(1, Math.round(width * scale));
  const nh = Math.max(1, Math.round(height * scale));
  const out = new Uint8ClampedArray(nw * nh * 4);

  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const sx = Math.min(width - 1, Math.floor((x + 0.5) / scale));
      const sy = Math.min(height - 1, Math.floor((y + 0.5) / scale));
      const si = (sy * width + sx) * 4;
      const di = (y * nw + x) * 4;
      out[di] = data[si];
      out[di + 1] = data[si + 1];
      out[di + 2] = data[si + 2];
      out[di + 3] = data[si + 3];
    }
  }

  return new ImageData(out, nw, nh);
}

function shirtLinearRgb(shirt: { r: number; g: number; b: number }): RGB {
  return {
    r: srgb8ToLinear(shirt.r),
    g: srgb8ToLinear(shirt.g),
    b: srgb8ToLinear(shirt.b),
  };
}

function isTransparent(alpha: number): boolean {
  return alpha <= SHIRT_VISIBILITY_THRESHOLDS.ALPHA_TRANSPARENT;
}

function isSemiTransparent(alpha: number): boolean {
  return alpha > SHIRT_VISIBILITY_THRESHOLDS.ALPHA_TRANSPARENT && alpha <= SHIRT_VISIBILITY_THRESHOLDS.ALPHA_SEMI_MAX;
}

function buildBoundaryMask(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const mask = new Uint8Array(width * height);
  const offsets = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const a = data[i * 4 + 3];
      if (isTransparent(a)) continue;

      let boundary = false;
      for (const [dx, dy] of offsets) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
          boundary = true;
          break;
        }
        const na = data[(ny * width + nx) * 4 + 3];
        if (isTransparent(na)) {
          boundary = true;
          break;
        }
      }
      if (boundary) mask[i] = 1;
    }
  }

  return mask;
}

function computeLuminanceMap(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  shirtLinear: RGB,
): Float32Array {
  const lum = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const a = data[idx + 3];
      if (isTransparent(a)) {
        lum[y * width + x] = -1;
        continue;
      }
      const src: RGB = {
        r: srgb8ToLinear(data[idx]),
        g: srgb8ToLinear(data[idx + 1]),
        b: srgb8ToLinear(data[idx + 2]),
      };
      const comp = compositeSourceOverLinear(src, a / 255, shirtLinear);
      lum[y * width + x] = relativeLuminance(comp.r, comp.g, comp.b);
    }
  }
  return lum;
}

function computeGradientMagnitudes(lum: Float32Array, width: number, height: number): Float32Array {
  const grad = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (lum[i] < 0) continue;

      const gx =
        -3 * (lum[i - width - 1] >= 0 ? lum[i - width - 1] : lum[i]) +
        -10 * (lum[i - 1] >= 0 ? lum[i - 1] : lum[i]) +
        -3 * (lum[i + width - 1] >= 0 ? lum[i + width - 1] : lum[i]) +
        3 * (lum[i - width + 1] >= 0 ? lum[i - width + 1] : lum[i]) +
        10 * (lum[i + 1] >= 0 ? lum[i + 1] : lum[i]) +
        3 * (lum[i + width + 1] >= 0 ? lum[i + width + 1] : lum[i]);

      const gy =
        -3 * (lum[i - width - 1] >= 0 ? lum[i - width - 1] : lum[i]) +
        -10 * (lum[i - width] >= 0 ? lum[i - width] : lum[i]) +
        -3 * (lum[i - width + 1] >= 0 ? lum[i - width + 1] : lum[i]) +
        3 * (lum[i + width - 1] >= 0 ? lum[i + width - 1] : lum[i]) +
        10 * (lum[i + width] >= 0 ? lum[i + width] : lum[i]) +
        3 * (lum[i + width + 1] >= 0 ? lum[i + width + 1] : lum[i]);

      grad[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return grad;
}

function classifyShirtMetrics(input: {
  boundaryContrasts: number[];
  visibleContrasts: number[];
  lowContrastCount: number;
  lowSeparationCount: number;
  visibleCount: number;
  semiTransparentCount: number;
  edgeRetention: number;
}): Pick<
  ShirtVisibilityMetrics,
  'level' | 'boundaryLowPercentileContrast' | 'visiblePixelLowPercentileContrast' | 'internalEdgeRetention' | 'lowContrastPixelFraction' | 'lowColourSeparationFraction' | 'semiTransparentPixelFraction' | 'semiTransparencyRisk' | 'visibilityScore'
> {
  const T = SHIRT_VISIBILITY_THRESHOLDS;
  const boundaryLow = percentile(input.boundaryContrasts, T.PERCENTILE);
  const visibleLow = percentile(input.visibleContrasts, T.PERCENTILE);
  const lowContrastFrac = input.visibleCount > 0 ? input.lowContrastCount / input.visibleCount : 1;
  const lowSepFrac = input.visibleCount > 0 ? input.lowSeparationCount / input.visibleCount : 1;
  const semiFrac = input.visibleCount > 0 ? input.semiTransparentCount / input.visibleCount : 0;
  const semiRisk = semiFrac >= T.SEMI_TRANSPARENT_FRAC_RISK;

  const visibilityScore =
    boundaryLow * 0.28 +
    visibleLow * 0.22 +
    input.edgeRetention * 2.5 +
    (1 - lowContrastFrac) * 1.2 +
    (1 - lowSepFrac) * 0.8;

  const strong =
    boundaryLow >= T.STRONG_MIN_BOUNDARY_CONTRAST &&
    visibleLow >= T.STRONG_MIN_VISIBLE_CONTRAST &&
    input.edgeRetention >= T.STRONG_MIN_EDGE_RETENTION &&
    lowContrastFrac <= T.STRONG_MAX_LOW_CONTRAST_FRAC &&
    lowSepFrac <= T.STRONG_MAX_LOW_SEPARATION_FRAC;

  const preview =
    boundaryLow >= T.PREVIEW_MIN_BOUNDARY_CONTRAST &&
    visibleLow >= T.PREVIEW_MIN_VISIBLE_CONTRAST &&
    input.edgeRetention >= T.PREVIEW_MIN_EDGE_RETENTION;

  let level: ShirtVisibilityLevel = 'low';
  if (strong) level = 'strong';
  else if (preview) level = 'preview';

  return {
    level,
    boundaryLowPercentileContrast: boundaryLow,
    visiblePixelLowPercentileContrast: visibleLow,
    internalEdgeRetention: input.edgeRetention,
    lowContrastPixelFraction: lowContrastFrac,
    lowColourSeparationFraction: lowSepFrac,
    semiTransparentPixelFraction: semiFrac,
    semiTransparencyRisk: semiRisk,
    visibilityScore,
  };
}

function analyzeOneShirt(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  boundaryMask: Uint8Array,
  shirt: { name: string; r: number; g: number; b: number },
): ShirtVisibilityMetrics {
  const shirtLinear = shirtLinearRgb(shirt);
  const shirtLum = relativeLuminance(shirtLinear.r, shirtLinear.g, shirtLinear.b);
  const shirtOklab = linearSrgbToOklab(shirtLinear.r, shirtLinear.g, shirtLinear.b);

  const lumMap = computeLuminanceMap(data, width, height, shirtLinear);
  const gradMag = computeGradientMagnitudes(lumMap, width, height);

  const edgeThreshold = percentile(
    Array.from(gradMag).filter((v) => v > 0),
    SHIRT_VISIBILITY_THRESHOLDS.EDGE_GRADIENT_PERCENTILE,
  );

  const boundaryContrasts: number[] = [];
  const visibleContrasts: number[] = [];
  let lowContrastCount = 0;
  let lowSeparationCount = 0;
  let visibleCount = 0;
  let semiTransparentCount = 0;
  let importantEdgeTotal = 0;
  let importantEdgeRetained = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const idx = i * 4;
      const alpha = data[idx + 3];
      if (isTransparent(alpha)) continue;

      visibleCount++;
      if (isSemiTransparent(alpha)) semiTransparentCount++;

      const src: RGB = {
        r: srgb8ToLinear(data[idx]),
        g: srgb8ToLinear(data[idx + 1]),
        b: srgb8ToLinear(data[idx + 2]),
      };
      const comp = compositeSourceOverLinear(src, alpha / 255, shirtLinear);
      const compLum = relativeLuminance(comp.r, comp.g, comp.b);
      const cr = contrastRatio(compLum, shirtLum);
      const compOklab = linearSrgbToOklab(comp.r, comp.g, comp.b);
      const de = deltaEOK(compOklab, shirtOklab);

      visibleContrasts.push(cr);
      if (cr < SHIRT_VISIBILITY_THRESHOLDS.LOW_CONTRAST_RATIO) lowContrastCount++;
      if (de < SHIRT_VISIBILITY_THRESHOLDS.LOW_DELTA_E) lowSeparationCount++;
      if (boundaryMask[i]) boundaryContrasts.push(cr);

      if (gradMag[i] >= edgeThreshold && edgeThreshold > 0) {
        importantEdgeTotal++;
        if (cr >= SHIRT_VISIBILITY_THRESHOLDS.PREVIEW_MIN_VISIBLE_CONTRAST) {
          importantEdgeRetained++;
        }
      }
    }
  }

  const edgeRetention =
    importantEdgeTotal > 0 ? importantEdgeRetained / importantEdgeTotal : visibleCount > 0 ? 0.5 : 0;

  const classified = classifyShirtMetrics({
    boundaryContrasts,
    visibleContrasts,
    lowContrastCount,
    lowSeparationCount,
    visibleCount,
    semiTransparentCount,
    edgeRetention,
  });

  return {
    shirtName: shirt.name,
    ...classified,
  };
}

export function analyzeShirtVisibility(imageData: ImageData): ShirtVisibilityMetrics[] {
  const sampled = downsampleImageData(imageData, SHIRT_VISIBILITY_THRESHOLDS.MAX_ANALYSIS_DIM);
  const { data, width, height } = sampled;
  const boundaryMask = buildBoundaryMask(data, width, height);

  return SHIRT_COLOUR_PRESETS.map((shirt) => analyzeOneShirt(data, width, height, boundaryMask, shirt));
}

export function visibilityLevelMessage(level: ShirtVisibilityLevel): string {
  if (level === 'strong') return 'Strong visibility';
  if (level === 'preview') return 'Preview recommended — some details may blend';
  return 'Details may blend into this shirt colour';
}

export type ShirtVisibilityDisplayGroups = {
  strong: string[];
  preview: string[];
  low: string[];
  semiTransparencyRisk: boolean;
};

export function groupShirtVisibility(metrics: ShirtVisibilityMetrics[]): ShirtVisibilityDisplayGroups {
  const strong: string[] = [];
  const preview: string[] = [];
  const low: string[] = [];
  let semiTransparencyRisk = false;

  for (const m of metrics) {
    if (m.level === 'strong') strong.push(m.shirtName);
    else if (m.level === 'preview') preview.push(m.shirtName);
    else low.push(m.shirtName);
    if (m.semiTransparencyRisk) semiTransparencyRisk = true;
  }

  return { strong, preview, low, semiTransparencyRisk };
}

export function groupShirtVisibilityFromChecks(checks: CheckItem[]): ShirtVisibilityDisplayGroups | null {
  const shirtItems = checks.filter((c) => c.label.startsWith('Shirt Fit:'));
  if (shirtItems.length === 0) return null;

  const strong: string[] = [];
  const preview: string[] = [];
  const low: string[] = [];
  let semiTransparencyRisk = false;

  for (const item of shirtItems) {
    const name = item.label.replace(/^Shirt Fit:\s*/, '');
    const level = item.visibilityLevel ?? 'preview';
    if (level === 'strong') strong.push(name);
    else if (level === 'preview') preview.push(name);
    else low.push(name);
    if (item.semiTransparencyRisk) semiTransparencyRisk = true;
  }

  return { strong, preview, low, semiTransparencyRisk };
}

/** Controlled ImageData fixtures for development validation. */
export function runShirtVisibilityDevTests(): void {
  if (process.env.NODE_ENV !== 'development') return;

  function makeImageData(
    w: number,
    h: number,
    fill: (x: number, y: number) => [number, number, number, number],
  ): ImageData {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const [r, g, b, a] = fill(x, y);
        const i = (y * w + x) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = a;
      }
    }
    return new ImageData(data, w, h);
  }

  function levelFor(results: ShirtVisibilityMetrics[], name: string) {
    return results.find((r) => r.shirtName === name)?.level ?? '?';
  }

  const fixtures: { label: string; img: ImageData; note: string }[] = [
    {
      label: 'White on transparent',
      img: makeImageData(200, 200, () => [255, 255, 255, 255]),
      note: 'Black strong, White low/preview',
    },
    {
      label: 'Black on transparent',
      img: makeImageData(200, 200, () => [0, 0, 0, 255]),
      note: 'White strong, Black low/preview',
    },
    {
      label: 'Black on black fill',
      img: makeImageData(200, 200, () => [10, 10, 10, 255]),
      note: 'Black low',
    },
    {
      label: 'White on white fill',
      img: makeImageData(200, 200, () => [250, 250, 250, 255]),
      note: 'White low',
    },
    {
      label: 'Multicolour artwork',
      img: makeImageData(200, 200, (x, y) => {
        const t = (x + y) % 3;
        if (t === 0) return [240, 200, 40, 255];
        if (t === 1) return [220, 60, 60, 255];
        return [80, 160, 240, 255];
      }),
      note: 'Black and White may both be strong',
    },
    {
      label: 'Dark/light split',
      img: makeImageData(200, 200, (x) => (x < 100 ? [10, 10, 10, 255] : [250, 250, 250, 255])),
      note: 'Both extremes visible on opposite shirts',
    },
    {
      label: 'White outline ring',
      img: makeImageData(200, 200, (x, y) => {
        const d = Math.hypot(x - 100, y - 100);
        if (d > 70 && d < 85) return [255, 255, 255, 255];
        if (d < 60) return [20, 20, 20, 255];
        return [0, 0, 0, 0];
      }),
      note: 'Outline helps on dark shirts',
    },
    {
      label: 'Semi-transparent glow',
      img: makeImageData(200, 200, () => [255, 255, 255, 120]),
      note: 'Semi-transparency risk',
    },
  ];

  console.info('POD Checker — Shirt Visibility Dev Tests');
  console.info('Thresholds:', SHIRT_VISIBILITY_THRESHOLDS);
  for (const fixture of fixtures) {
    const results = analyzeShirtVisibility(fixture.img);
    console.info(`\n${fixture.label} (${fixture.note})`);
    console.table(
      results.map((r) => ({
        shirt: r.shirtName,
        level: r.level,
        boundaryP8: Number(r.boundaryLowPercentileContrast.toFixed(2)),
        visibleP8: Number(r.visiblePixelLowPercentileContrast.toFixed(2)),
        edgeRet: Number(r.internalEdgeRetention.toFixed(2)),
        semiRisk: r.semiTransparencyRisk,
        score: Number(r.visibilityScore.toFixed(2)),
      })),
    );
    console.info(`  Black=${levelFor(results, 'Black')}, White=${levelFor(results, 'White')}`);
  }
}
