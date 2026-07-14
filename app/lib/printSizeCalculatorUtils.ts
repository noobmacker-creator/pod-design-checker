export const COMMON_PPI_VALUES = [300, 200, 150] as const;

export type PrintSizeAtPpi = {
  ppi: number;
  widthIn: number;
  heightIn: number;
  widthCm: number;
  heightCm: number;
  detailLabel: string;
};

export type PlannedPrintStatus = {
  label: string;
  tone: 'high' | 'good' | 'maybe' | 'low';
};

export function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function pixelsToInches(pixels: number, ppi: number): number {
  return pixels / ppi;
}

export function inchesToCentimetres(inches: number): number {
  return inches * 2.54;
}

export function centimetresToInches(cm: number): number {
  return cm / 2.54;
}

export function getDetailLabelForPpi(ppi: number): string {
  if (ppi >= 300) return 'High detail';
  if (ppi >= 200) return 'Standard print';
  return 'Large print / lower detail';
}

export function computePrintSizes(widthPx: number, heightPx: number): PrintSizeAtPpi[] {
  return COMMON_PPI_VALUES.map((ppi) => {
    const widthIn = roundToOneDecimal(pixelsToInches(widthPx, ppi));
    const heightIn = roundToOneDecimal(pixelsToInches(heightPx, ppi));
    const widthCm = roundToOneDecimal(inchesToCentimetres(widthIn));
    const heightCm = roundToOneDecimal(inchesToCentimetres(heightIn));
    return {
      ppi,
      widthIn,
      heightIn,
      widthCm,
      heightCm,
      detailLabel: getDetailLabelForPpi(ppi),
    };
  });
}

export function validatePixelDimension(input: string): { value: number | null; error: string | null } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { value: null, error: 'Enter a pixel value.' };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { value: null, error: 'Use a whole number of pixels.' };
  }
  const value = Number.parseInt(trimmed, 10);
  if (value <= 0) {
    return { value: null, error: 'Must be greater than zero.' };
  }
  return { value, error: null };
}

export function validatePrintDimension(input: string): { value: number | null; error: string | null } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { value: null, error: null };
  }
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { value: null, error: 'Enter a value greater than zero.' };
  }
  return { value: parsed, error: null };
}

export function calculateRequiredPpi(
  pixelWidth: number,
  pixelHeight: number,
  printWidth: number,
  printHeight: number,
  unit: 'in' | 'cm',
): number | null {
  if (printWidth <= 0 || printHeight <= 0 || pixelWidth <= 0 || pixelHeight <= 0) {
    return null;
  }
  const widthIn = unit === 'cm' ? centimetresToInches(printWidth) : printWidth;
  const heightIn = unit === 'cm' ? centimetresToInches(printHeight) : printHeight;
  if (widthIn <= 0 || heightIn <= 0) return null;
  const ppiWidth = pixelWidth / widthIn;
  const ppiHeight = pixelHeight / heightIn;
  return roundToOneDecimal(Math.min(ppiWidth, ppiHeight));
}

export function getPlannedPrintStatus(requiredPpi: number): PlannedPrintStatus {
  if (requiredPpi >= 300) {
    return { label: 'High detail', tone: 'high' };
  }
  if (requiredPpi >= 200) {
    return { label: 'Good for many products', tone: 'good' };
  }
  if (requiredPpi >= 150) {
    return { label: 'May be okay for larger/simple prints', tone: 'maybe' };
  }
  return { label: 'Low detail risk', tone: 'low' };
}

export function formatPrintSizeLine(size: PrintSizeAtPpi): string {
  return `${size.ppi} PPI — ${size.widthIn} × ${size.heightIn} in — ${size.widthCm} × ${size.heightCm} cm`;
}
