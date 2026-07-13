import { sanitizeUploadBasename } from './productConverterExport';

export type ColorCheckPresetId =
  | 'white'
  | 'black'
  | 'heather-grey'
  | 'navy'
  | 'red'
  | 'forest-green';

export type ColorCheckEntry = {
  id: string;
  label: string;
  hex: string;
  isCustom?: boolean;
};

export const COLOR_CHECK_PRESETS: ColorCheckEntry[] = [
  { id: 'white', label: 'White', hex: '#FFFFFF' },
  { id: 'black', label: 'Black', hex: '#000000' },
  { id: 'heather-grey', label: 'Heather Grey', hex: '#B8B8B8' },
  { id: 'navy', label: 'Navy', hex: '#1E3A5F' },
  { id: 'red', label: 'Red', hex: '#C41E3A' },
  { id: 'forest-green', label: 'Forest Green', hex: '#228B22' },
];

export const DEFAULT_SELECTED_PRESET_IDS: ColorCheckPresetId[] = [
  'white',
  'black',
  'heather-grey',
  'navy',
];

export const MAX_CUSTOM_COLOURS = 6;

const HEX_PATTERN = /^#?[0-9A-Fa-f]{6}$/;

export function normalizeHexColour(input: string): string | null {
  const trimmed = input.trim();
  if (!HEX_PATTERN.test(trimmed)) return null;
  const hex = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  return `#${hex.toUpperCase()}`;
}

export function isValidHexColour(input: string): boolean {
  return normalizeHexColour(input) !== null;
}

export function getColourCheckFilename(sourceFilename: string): string {
  const base = sanitizeUploadBasename(sourceFilename);
  return `${base}-colour-check.png`;
}

export function togglePresetSelection(
  selected: Set<string>,
  presetId: string,
): Set<string> {
  const next = new Set(selected);
  if (next.has(presetId)) {
    if (next.size <= 1) return next;
    next.delete(presetId);
  } else {
    next.add(presetId);
  }
  return next;
}

export function buildActiveColourEntries(
  selectedPresetIds: Set<string>,
  customColours: string[],
): ColorCheckEntry[] {
  const presets = COLOR_CHECK_PRESETS.filter((preset) => selectedPresetIds.has(preset.id));
  const customEntries = customColours.map((hex) => ({
    id: `custom-${hex}`,
    label: `Custom ${hex}`,
    hex,
    isCustom: true,
  }));
  return [...presets, ...customEntries];
}

export function addCustomColour(
  customColours: string[],
  rawInput: string,
): { colours: string[]; error: string | null } {
  const normalized = normalizeHexColour(rawInput);
  if (!normalized) {
    return { colours: customColours, error: 'Enter a valid 6-digit hex colour, for example #7A3F91.' };
  }
  if (customColours.includes(normalized)) {
    return { colours: customColours, error: 'That colour is already added.' };
  }
  const presetMatch = COLOR_CHECK_PRESETS.some(
    (preset) => preset.hex.toUpperCase() === normalized,
  );
  if (presetMatch) {
    return { colours: customColours, error: 'That colour matches an existing preset.' };
  }
  if (customColours.length >= MAX_CUSTOM_COLOURS) {
    return {
      colours: customColours,
      error: `You can add up to ${MAX_CUSTOM_COLOURS} custom colours.`,
    };
  }
  return { colours: [...customColours, normalized], error: null };
}

export function removeCustomColour(customColours: string[], hex: string): string[] {
  return customColours.filter((colour) => colour !== hex);
}

export function resetToDefaultSelection(): Set<string> {
  return new Set(DEFAULT_SELECTED_PRESET_IDS);
}

/** Layout constants for the comparison sheet PNG. */
export const COMPARISON_SHEET = {
  padding: 48,
  titleHeight: 72,
  cardGap: 24,
  cardWidth: 320,
  cardHeight: 360,
  labelHeight: 36,
  cols: 3,
} as const;

export function computeComparisonSheetSize(panelCount: number): { width: number; height: number } {
  const { padding, titleHeight, cardGap, cardWidth, cardHeight, cols } = COMPARISON_SHEET;
  const rows = Math.max(1, Math.ceil(panelCount / cols));
  const gridWidth = cols * cardWidth + (cols - 1) * cardGap;
  const gridHeight = rows * cardHeight + (rows - 1) * cardGap;
  return {
    width: padding * 2 + gridWidth,
    height: padding * 2 + titleHeight + cardGap + gridHeight,
  };
}

export function drawCheckerboard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cellSize = 12,
) {
  ctx.fillStyle = '#cccccc';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#ffffff';
  for (let row = 0; row < Math.ceil(h / cellSize); row++) {
    for (let col = 0; col < Math.ceil(w / cellSize); col++) {
      if ((row + col) % 2 === 0) continue;
      ctx.fillRect(x + col * cellSize, y + row * cellSize, cellSize, cellSize);
    }
  }
}

export function drawDesignCentredInRect(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.min(w / image.naturalWidth, h / image.naturalHeight);
  const drawW = image.naturalWidth * scale;
  const drawH = image.naturalHeight * scale;
  const drawX = x + (w - drawW) / 2;
  const drawY = y + (h - drawH) / 2;
  ctx.drawImage(image, drawX, drawY, drawW, drawH);
}

export async function createComparisonSheetBlob(
  image: HTMLImageElement,
  sourceFilename: string,
  entries: ColorCheckEntry[],
  includeCheckerboard: boolean,
): Promise<Blob | null> {
  const panels: ColorCheckEntry[] = [...entries];
  if (includeCheckerboard) {
    panels.push({ id: 'checkerboard', label: 'Transparency', hex: 'checkerboard' });
  }
  if (panels.length === 0) return null;

  const { width, height } = computeComparisonSheetSize(panels.length);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 28px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Colour Comparison Sheet', COMPARISON_SHEET.padding, COMPARISON_SHEET.padding + 32);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px Arial, Helvetica, sans-serif';
  ctx.fillText(sourceFilename, COMPARISON_SHEET.padding, COMPARISON_SHEET.padding + 58);

  const previewAreaH = COMPARISON_SHEET.cardHeight - COMPARISON_SHEET.labelHeight;
  const startY = COMPARISON_SHEET.padding + COMPARISON_SHEET.titleHeight + COMPARISON_SHEET.cardGap;

  panels.forEach((entry, index) => {
    const col = index % COMPARISON_SHEET.cols;
    const row = Math.floor(index / COMPARISON_SHEET.cols);
    const cardX =
      COMPARISON_SHEET.padding + col * (COMPARISON_SHEET.cardWidth + COMPARISON_SHEET.cardGap);
    const cardY = startY + row * (COMPARISON_SHEET.cardHeight + COMPARISON_SHEET.cardGap);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cardX, cardY, COMPARISON_SHEET.cardWidth, COMPARISON_SHEET.cardHeight);

    if (entry.hex === 'checkerboard') {
      drawCheckerboard(ctx, cardX, cardY, COMPARISON_SHEET.cardWidth, previewAreaH);
    } else {
      ctx.fillStyle = entry.hex;
      ctx.fillRect(cardX, cardY, COMPARISON_SHEET.cardWidth, previewAreaH);
    }

    drawDesignCentredInRect(
      ctx,
      image,
      cardX,
      cardY,
      COMPARISON_SHEET.cardWidth,
      previewAreaH,
    );

    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(
      cardX,
      cardY + previewAreaH,
      COMPARISON_SHEET.cardWidth,
      COMPARISON_SHEET.labelHeight,
    );
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 14px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      entry.label,
      cardX + COMPARISON_SHEET.cardWidth / 2,
      cardY + previewAreaH + 23,
    );
  });

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const link = document.createElement('a');
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}
