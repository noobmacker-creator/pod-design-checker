import { formatBytes } from './podCheckerUtils';

export type Orientation = 'Square' | 'Portrait' | 'Landscape';

export type TransparencyAnalysis = {
  title: string;
  detail: string;
  notSupported: boolean;
  hasTransparentAreas: boolean;
  hasSemiTransparent: boolean;
  isFullyOpaque: boolean;
};

export type DpiMetadataInfo = {
  label: string;
  detail: string;
};

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x || 1;
}

export function simplifyAspectRatio(widthPx: number, heightPx: number): string {
  if (widthPx <= 0 || heightPx <= 0) return '—';
  const divisor = gcd(widthPx, heightPx);
  const ratioW = Math.round(widthPx / divisor);
  const ratioH = Math.round(heightPx / divisor);
  if (ratioW > 99 || ratioH > 99) {
    const ratio = widthPx / heightPx;
    if (Math.abs(ratio - 1) < 0.01) return '1:1';
    return ratio >= 1 ? `${ratio.toFixed(2)}:1` : `1:${(1 / ratio).toFixed(2)}`;
  }
  return `${ratioW}:${ratioH}`;
}

export function getOrientation(widthPx: number, heightPx: number): Orientation {
  if (widthPx <= 0 || heightPx <= 0) return 'Square';
  const ratio = widthPx / heightPx;
  if (Math.abs(ratio - 1) < 0.01) return 'Square';
  return heightPx > widthPx ? 'Portrait' : 'Landscape';
}

export function getFileTypeLabel(file: File): string {
  const type = file.type.toLowerCase();
  if (type.includes('png')) return 'PNG';
  if (type.includes('jpeg') || type.includes('jpg')) return 'JPEG';
  if (type.includes('webp')) return 'WEBP';
  if (file.type) return file.type.toUpperCase();
  const ext = file.name.split('.').pop()?.toUpperCase();
  return ext || 'Unknown';
}

export function supportsAlphaChannel(fileType: string): boolean {
  const type = fileType.toLowerCase();
  return type.includes('png') || type.includes('webp');
}

function getNoTransparencyDetail(fileType: string): string {
  const type = fileType.toLowerCase();
  const label = type.includes('webp') ? 'WEBP' : 'PNG';
  return [
    `This ${label} has no real transparent pixels.`,
    '',
    'If you expected a transparent design, it may have a solid background box.',
    'Open it in Single Design to check for background issues.',
  ].join('\n');
}

export function analyzeTransparency(
  imageData: ImageData | null,
  fileType: string,
): TransparencyAnalysis {
  if (!supportsAlphaChannel(fileType)) {
    return {
      title: 'TRANSPARENCY NOT SUPPORTED',
      detail: 'JPG files cannot contain real transparent backgrounds.',
      notSupported: true,
      hasTransparentAreas: false,
      hasSemiTransparent: false,
      isFullyOpaque: false,
    };
  }

  if (!imageData) {
    return {
      title: 'COULD NOT CHECK TRANSPARENCY',
      detail: 'Transparency could not be checked in the browser.',
      notSupported: false,
      hasTransparentAreas: false,
      hasSemiTransparent: false,
      isFullyOpaque: false,
    };
  }

  const { data } = imageData;
  let hasTransparentAreas = false;
  let hasSemiTransparent = false;
  let sampled = 0;

  for (let i = 3; i < data.length; i += 16) {
    sampled++;
    const alpha = data[i];
    if (alpha <= 10) {
      hasTransparentAreas = true;
    } else if (alpha < 250) {
      hasSemiTransparent = true;
    }
  }

  if (sampled === 0) {
    return {
      title: 'COULD NOT CHECK TRANSPARENCY',
      detail: 'Transparency could not be checked in the browser.',
      notSupported: false,
      hasTransparentAreas: false,
      hasSemiTransparent: false,
      isFullyOpaque: false,
    };
  }

  if (hasTransparentAreas) {
    return {
      title: 'TRANSPARENT AREAS FOUND',
      detail: 'This file contains real transparent pixels.',
      notSupported: false,
      hasTransparentAreas: true,
      hasSemiTransparent,
      isFullyOpaque: false,
    };
  }

  if (hasSemiTransparent) {
    return {
      title: 'SEMI-TRANSPARENT PIXELS FOUND',
      detail: 'This file contains partially transparent pixels.',
      notSupported: false,
      hasTransparentAreas: false,
      hasSemiTransparent: true,
      isFullyOpaque: false,
    };
  }

  return {
    title: 'NO TRANSPARENCY FOUND',
    detail: getNoTransparencyDetail(fileType),
    notSupported: false,
    hasTransparentAreas: false,
    hasSemiTransparent: false,
    isFullyOpaque: true,
  };
}

function colourDistance(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
): number {
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
}

function samplePixel(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
): { r: number; g: number; b: number; a: number } | null {
  if (x < 0 || y < 0 || x >= width) return null;
  const index = (y * width + x) * 4;
  if (index + 3 >= data.length) return null;
  return {
    r: data[index],
    g: data[index + 1],
    b: data[index + 2],
    a: data[index + 3],
  };
}

export function detectPossibleSolidBackground(
  imageData: ImageData | null,
  transparency: TransparencyAnalysis,
): boolean {
  if (!imageData) return false;
  if (transparency.hasTransparentAreas) return false;

  const { width, height, data } = imageData;
  if (width < 2 || height < 2) return false;

  const points = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [Math.floor(width / 2), 0],
    [Math.floor(width / 2), height - 1],
    [0, Math.floor(height / 2)],
    [width - 1, Math.floor(height / 2)],
  ];

  const edgeSamples: { r: number; g: number; b: number }[] = [];

  for (const [x, y] of points) {
    const pixel = samplePixel(data, width, x, y);
    if (!pixel || pixel.a < 200) return false;
    edgeSamples.push({ r: pixel.r, g: pixel.g, b: pixel.b });
  }

  if (edgeSamples.length < 4) return false;

  const average = edgeSamples.reduce(
    (acc, sample) => ({
      r: acc.r + sample.r,
      g: acc.g + sample.g,
      b: acc.b + sample.b,
    }),
    { r: 0, g: 0, b: 0 },
  );

  average.r = Math.round(average.r / edgeSamples.length);
  average.g = Math.round(average.g / edgeSamples.length);
  average.b = Math.round(average.b / edgeSamples.length);

  let matching = 0;
  for (const sample of edgeSamples) {
    if (colourDistance(sample, average) <= 35) matching++;
  }

  const edgeMatchRatio = matching / edgeSamples.length;
  return transparency.isFullyOpaque && edgeMatchRatio >= 0.75;
}

export function getDpiMetadataInfo(dpiMetadata: number | null): DpiMetadataInfo {
  if (dpiMetadata === 300) {
    return {
      label: '300 PPI found',
      detail: 'DPI metadata may not reflect true print quality. Pixel dimensions matter more for POD uploads.',
    };
  }
  if (dpiMetadata === 150) {
    return {
      label: '150 PPI found',
      detail: 'DPI metadata may not reflect true print quality. Pixel dimensions matter more for POD uploads.',
    };
  }
  if (dpiMetadata !== null && dpiMetadata > 0) {
    return {
      label: `${dpiMetadata} PPI found`,
      detail: 'DPI metadata may not reflect true print quality. Pixel dimensions matter more for POD uploads.',
    };
  }
  return {
    label: 'DPI metadata missing',
    detail: 'Pixel dimensions matter more than DPI metadata for POD uploads.',
  };
}

export function buildQuickNotes(params: {
  fileTypeLabel: string;
  widthPx: number;
  heightPx: number;
  transparency: TransparencyAnalysis;
  solidBackgroundHint: boolean;
  dpiInfo: DpiMetadataInfo;
}): string[] {
  const notes: string[] = [];

  if (params.fileTypeLabel === 'PNG') {
    notes.push('PNG supports transparency.');
  } else if (params.fileTypeLabel === 'JPEG') {
    notes.push('JPG does not support transparency.');
  } else if (params.fileTypeLabel === 'WEBP') {
    notes.push('WEBP can support transparency.');
  }

  if (params.widthPx >= 3000 || params.heightPx >= 3000) {
    notes.push('Large pixel dimensions give more print-size flexibility.');
  }

  notes.push('File size is not the same as print quality.');
  notes.push('Pixel dimensions matter more than DPI metadata.');

  if (params.transparency.hasSemiTransparent) {
    notes.push('Semi-transparent pixels are common in smooth edges and fades.');
  }

  if (params.solidBackgroundHint) {
    notes.push('This file may have a solid background instead of real transparency.');
  }

  if (params.dpiInfo.label === 'DPI metadata missing') {
    notes.push('Missing DPI metadata is common and usually not a problem.');
  }

  return notes;
}

export function formatFileSizeLabel(bytes: number): string {
  return formatBytes(bytes);
}
