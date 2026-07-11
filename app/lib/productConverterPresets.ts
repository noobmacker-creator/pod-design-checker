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

export type QuickExportCategoryPackId =
  | 'apparel'
  | 'sticker'
  | 'poster'
  | 'mug-drinkware'
  | 'business-card'
  | 'mousepad';

export type QuickExportPlatformPackId =
  | 'zazzle'
  | 'printful'
  | 'redbubble'
  | 'teepublic'
  | 'spring'
  | 'standard-generic'
  | 'all-products';

export type QuickExportPackId = QuickExportCategoryPackId | QuickExportPlatformPackId;

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
  quickPackTags?: readonly QuickExportCategoryPackId[];
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
    quickPackTags: ['sticker'],
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
    quickPackTags: ['poster'],
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
    quickPackTags: ['mug-drinkware'],
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

const PRINTFUL_QUICK_TAGS: Partial<Record<string, readonly QuickExportCategoryPackId[]>> = {
  'dtg-dtf-apparel': ['apparel'],
  'sticker-square': ['sticker'],
  'poster-16x20': ['poster'],
};

const REDBUBBLE_QUICK_TAGS: Partial<Record<string, readonly QuickExportCategoryPackId[]>> = {
  apparel: ['apparel'],
  'premium-tee': ['apparel'],
  'stickers-square': ['sticker'],
  'large-home': ['poster'],
};

const ZAZZLE_QUICK_TAGS: Partial<Record<string, readonly QuickExportCategoryPackId[]>> = {
  'zazzle-apparel-high-resolution': ['apparel'],
  'zazzle-standard-mouse-pad': ['mousepad'],
  'zazzle-gel-mouse-pad': ['mousepad'],
  'zazzle-jumbo-mug': ['mug-drinkware'],
  'zazzle-bone-china-mug': ['mug-drinkware'],
  'zazzle-round-sticker-small': ['sticker'],
  'zazzle-round-sticker-large': ['sticker'],
  'zazzle-custom-cut-sticker-3x3': ['sticker'],
  'zazzle-business-card-standard': ['business-card'],
  'zazzle-business-card-mini': ['business-card'],
  'zazzle-business-card-mighty': ['business-card'],
  'zazzle-business-card-square': ['business-card'],
  'zazzle-business-card-euro': ['business-card'],
  'zazzle-business-card-oceania': ['business-card'],
  'zazzle-photo-print-5x7': ['poster'],
  'zazzle-poster-11x14': ['poster'],
  'zazzle-poster-16x20': ['poster'],
};

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
    quickPackTags: ['apparel'],
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
  quickPackTags: PRINTFUL_QUICK_TAGS[preset.id],
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
  quickPackTags: REDBUBBLE_QUICK_TAGS[preset.id],
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
    quickPackTags: ['apparel'],
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
    quickPackTags: ['apparel'],
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
  quickPackTags: ZAZZLE_QUICK_TAGS[preset.id],
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

const FIXED_SIZE_PLATFORM_IDS: ConverterPlatformId[] = [
  'standard',
  'printful',
  'redbubble',
  'teepublic',
  'spring',
  'zazzle',
  'generic',
];

export type PresetPlatformGroup = {
  platformId: ConverterPlatformId;
  platformLabel: string;
  presets: ProductConverterPreset[];
};

/** Fixed-size presets grouped by platform for Multi-Product Export Pack. */
export function getFixedSizePresetsGrouped(): PresetPlatformGroup[] {
  return FIXED_SIZE_PLATFORM_IDS.map((platformId) => {
    const platformLabel =
      CONVERTER_PLATFORMS.find((item) => item.id === platformId)?.label ?? platformId;
    return {
      platformId,
      platformLabel,
      presets: getPresetsForPlatform(platformId),
    };
  }).filter((group) => group.presets.length > 0);
}

export type QuickExportPackGroup = 'category' | 'platform';

export type QuickExportPackDefinition = {
  id: QuickExportPackId;
  label: string;
  group: QuickExportPackGroup;
};

export const QUICK_EXPORT_CATEGORY_PACKS: QuickExportPackDefinition[] = [
  { id: 'apparel', label: 'Apparel', group: 'category' },
  { id: 'sticker', label: 'Stickers', group: 'category' },
  { id: 'poster', label: 'Posters & Photos', group: 'category' },
  { id: 'mug-drinkware', label: 'Mugs & Drinkware', group: 'category' },
  { id: 'business-card', label: 'Business Cards', group: 'category' },
  { id: 'mousepad', label: 'Mousepads', group: 'category' },
];

export const QUICK_EXPORT_PLATFORM_PACKS: QuickExportPackDefinition[] = [
  { id: 'zazzle', label: 'Zazzle', group: 'platform' },
  { id: 'printful', label: 'Printful', group: 'platform' },
  { id: 'redbubble', label: 'Redbubble', group: 'platform' },
  { id: 'teepublic', label: 'TeePublic', group: 'platform' },
  { id: 'spring', label: 'Spring', group: 'platform' },
  { id: 'standard-generic', label: 'Standard & Generic', group: 'platform' },
  { id: 'all-products', label: 'All Products', group: 'platform' },
];

export const QUICK_EXPORT_PACKS: QuickExportPackDefinition[] = [
  ...QUICK_EXPORT_CATEGORY_PACKS,
  ...QUICK_EXPORT_PLATFORM_PACKS,
];

function getPresetsByCategoryTag(tag: QuickExportCategoryPackId): string[] {
  return ALL_CONVERTER_PRESETS.filter((preset) => preset.quickPackTags?.includes(tag)).map(
    (preset) => preset.id,
  );
}

function getPresetsByPlatform(platform: ConverterPlatformId): string[] {
  return ALL_CONVERTER_PRESETS.filter((preset) => preset.platform === platform).map(
    (preset) => preset.id,
  );
}

/** Preset IDs for a Quick Export Pack — only includes IDs present in ALL_CONVERTER_PRESETS. */
export function getQuickExportPackPresetIds(packId: QuickExportPackId): string[] {
  switch (packId) {
    case 'apparel':
    case 'sticker':
    case 'poster':
    case 'mug-drinkware':
    case 'business-card':
    case 'mousepad':
      return getPresetsByCategoryTag(packId);
    case 'zazzle':
      return getPresetsByPlatform('zazzle');
    case 'printful':
      return getPresetsByPlatform('printful');
    case 'redbubble':
      return getPresetsByPlatform('redbubble');
    case 'teepublic':
      return getPresetsByPlatform('teepublic');
    case 'spring':
      return getPresetsByPlatform('spring');
    case 'standard-generic':
      return ALL_CONVERTER_PRESETS.filter(
        (preset) => preset.platform === 'standard' || preset.platform === 'generic',
      ).map((preset) => preset.id);
    case 'all-products':
      return ALL_CONVERTER_PRESETS.map((preset) => preset.id);
    default:
      return [];
  }
}

/** Product count per pack — for development verification. */
export function getQuickExportPackCounts(): Record<QuickExportPackId, number> {
  const counts = {} as Record<QuickExportPackId, number>;
  for (const pack of QUICK_EXPORT_PACKS) {
    counts[pack.id] = getQuickExportPackPresetIds(pack.id).length;
  }
  return counts;
}
