import { printfulPresets } from './printfulPresets';
import { redbubblePresets } from './redbubblePresets';
import { SPRING_STANDARD_APPAREL_PRESET } from './additionalPlatformPresets';
import { zazzleProductPresets } from './zazzleProductPresets';

export type ConverterPlatformId =
  | 'standard'
  | 'printful'
  | 'redbubble'
  | 'teepublic'
  | 'spring'
  | 'zazzle'
  | 'gelato'
  | 'generic'
  | 'custom';

export type ProductConverterPreset = {
  id: string;
  platform: ConverterPlatformId;
  category: string;
  label: string;
  width: number;
  height: number;
  filename: string;
  helperText?: string;
  presetType?: string;
  bleedNote?: string;
  ppi?: number;
  physicalSize?: string;
};

const STANDARD_W = 4200;
const STANDARD_H = 4800;
const TEEPUBLIC_W = 5000;
const TEEPUBLIC_H = 5500;

function slugFilename(slug: string, width: number, height: number): string {
  return `${slug}-${width}x${height}.png`;
}

const GENERIC_POD_PRESETS: ProductConverterPreset[] = [
  {
    id: 'generic-square',
    platform: 'generic',
    category: 'Generic POD',
    label: 'Square',
    width: 4500,
    height: 4500,
    filename: slugFilename('pod-checker-square', 4500, 4500),
    helperText: 'Generic square preset for logos, icons, and square POD products.',
  },
  {
    id: 'generic-sticker',
    platform: 'generic',
    category: 'Generic POD',
    label: 'Sticker',
    width: 3000,
    height: 3000,
    filename: slugFilename('pod-checker-sticker', 3000, 3000),
    helperText: 'Generic square preset for sticker-style POD products.',
  },
  {
    id: 'generic-poster',
    platform: 'generic',
    category: 'Generic POD',
    label: 'Poster',
    width: 5400,
    height: 7200,
    filename: slugFilename('pod-checker-poster', 5400, 7200),
    helperText: 'Generic tall preset for poster-style POD products.',
  },
  {
    id: 'generic-mug',
    platform: 'generic',
    category: 'Generic POD',
    label: 'Mug',
    width: 2700,
    height: 1200,
    filename: slugFilename('pod-checker-mug', 2700, 1200),
    helperText: 'Generic wraparound preset for mug-style POD products.',
  },
  {
    id: 'generic-tote-bag',
    platform: 'generic',
    category: 'Generic POD',
    label: 'Tote Bag',
    width: 4500,
    height: 5400,
    filename: slugFilename('pod-checker-tote-bag', 4500, 5400),
    helperText: 'Generic tall preset for tote bag-style POD products.',
  },
  {
    id: 'generic-phone-case',
    platform: 'generic',
    category: 'Generic POD',
    label: 'Phone Case',
    width: 2400,
    height: 3600,
    filename: slugFilename('pod-checker-phone-case', 2400, 3600),
    helperText: 'Generic tall preset for phone case-style POD products.',
  },
];

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const STANDARD_PRESETS: ProductConverterPreset[] = [
  {
    id: 'standard-apparel',
    platform: 'standard',
    category: 'Apparel',
    label: 'Standard Apparel',
    width: STANDARD_W,
    height: STANDARD_H,
    filename: slugFilename('pod-checker-standard-apparel', STANDARD_W, STANDARD_H),
    helperText: 'Best general export for most POD shirt uploads.',
  },
];

const PRINTFUL_PRESETS: ProductConverterPreset[] = printfulPresets.map((preset) => ({
  id: `printful-${preset.id}`,
  platform: 'printful' as const,
  category: 'Printful',
  label: preset.label,
  width: preset.width,
  height: preset.height,
  filename: slugFilename(`pod-checker-${toSlug(preset.label)}`, preset.width, preset.height),
  helperText: 'Printful DTG/DTF export preset.',
}));

const REDBUBBLE_PRESETS: ProductConverterPreset[] = redbubblePresets.map((preset) => ({
  id: `redbubble-${preset.id}`,
  platform: 'redbubble' as const,
  category: 'Redbubble',
  label: preset.label,
  width: preset.width,
  height: preset.height,
  filename: slugFilename(`pod-checker-${toSlug(preset.label)}`, preset.width, preset.height),
  helperText: 'Redbubble apparel export preset.',
}));

const TEEPUBLIC_PRESETS: ProductConverterPreset[] = [
  {
    id: 'teepublic-all-products',
    platform: 'teepublic',
    category: 'TeePublic',
    label: 'TeePublic All Products',
    width: TEEPUBLIC_W,
    height: TEEPUBLIC_H,
    filename: 'teepublic-5000x5500.png',
    helperText: 'TeePublic all-products upload size.',
  },
];

const SPRING_PRESETS: ProductConverterPreset[] = [
  {
    id: SPRING_STANDARD_APPAREL_PRESET.id,
    platform: 'spring',
    category: 'Spring',
    label: SPRING_STANDARD_APPAREL_PRESET.label,
    width: SPRING_STANDARD_APPAREL_PRESET.width,
    height: SPRING_STANDARD_APPAREL_PRESET.height,
    filename: SPRING_STANDARD_APPAREL_PRESET.filename,
    helperText:
      'Recommended standard POD artwork size published by Spring. Use a high-quality PNG with genuine transparency where required.',
  },
];

const ZAZZLE_PRESETS: ProductConverterPreset[] = zazzleProductPresets.map((preset) => ({
  id: preset.id,
  platform: 'zazzle' as const,
  category: preset.category,
  label: preset.label,
  width: preset.width,
  height: preset.height,
  filename: preset.filename,
  helperText: preset.helperText,
  presetType: preset.presetType,
  bleedNote: preset.bleedNote,
  ppi: preset.ppi,
  physicalSize: preset.physicalSize,
}));

export const CONVERTER_PLATFORMS: { id: ConverterPlatformId; label: string }[] = [
  { id: 'standard', label: 'Standard' },
  { id: 'printful', label: 'Printful' },
  { id: 'redbubble', label: 'Redbubble' },
  { id: 'teepublic', label: 'TeePublic' },
  { id: 'spring', label: 'Spring' },
  { id: 'zazzle', label: 'Zazzle' },
  { id: 'gelato', label: 'Gelato' },
  { id: 'generic', label: 'Generic POD' },
  { id: 'custom', label: 'Custom Size' },
];

export const ALL_CONVERTER_PRESETS: ProductConverterPreset[] = [
  ...STANDARD_PRESETS,
  ...PRINTFUL_PRESETS,
  ...REDBUBBLE_PRESETS,
  ...TEEPUBLIC_PRESETS,
  ...SPRING_PRESETS,
  ...ZAZZLE_PRESETS,
  ...GENERIC_POD_PRESETS,
];

export function getPresetsForPlatform(platform: ConverterPlatformId): ProductConverterPreset[] {
  return ALL_CONVERTER_PRESETS.filter((preset) => preset.platform === platform);
}

export function platformUsesCustomDimensions(platform: ConverterPlatformId): boolean {
  return platform === 'gelato' || platform === 'custom';
}

export function getDefaultPresetIdForPlatform(platform: ConverterPlatformId): string | null {
  const presets = getPresetsForPlatform(platform);
  return presets[0]?.id ?? null;
}

export function getPresetById(id: string): ProductConverterPreset | undefined {
  return ALL_CONVERTER_PRESETS.find((preset) => preset.id === id);
}

export function getCustomDimensionFilename(
  platform: 'gelato' | 'custom',
  width: number,
  height: number,
): string {
  if (platform === 'gelato') {
    return `gelato-apparel-${width}x${height}.png`;
  }
  return `pod-checker-custom-${width}x${height}.png`;
}

export const CUSTOM_DIMENSION_MIN = 500;
export const CUSTOM_DIMENSION_MAX = 12000;

export function isValidCustomDimensions(width: number, height: number): boolean {
  return (
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width >= CUSTOM_DIMENSION_MIN &&
    width <= CUSTOM_DIMENSION_MAX &&
    height >= CUSTOM_DIMENSION_MIN &&
    height <= CUSTOM_DIMENSION_MAX
  );
}

export function getZazzleCategoriesForPlatform(): string[] {
  const categories = new Set<string>();
  for (const preset of ZAZZLE_PRESETS) {
    categories.add(preset.category);
  }
  return Array.from(categories);
}
