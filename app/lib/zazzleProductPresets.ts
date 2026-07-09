export type ZazzlePresetType = 'source-export' | 'verified-design-area' | 'product-size-based';

export type ZazzlePresetId =
  | 'zazzle-apparel-high-resolution'
  | 'zazzle-standard-mouse-pad'
  | 'zazzle-gel-mouse-pad'
  | 'zazzle-jumbo-mug'
  | 'zazzle-bone-china-mug'
  | 'zazzle-bump-magnet'
  | 'zazzle-square-keychain'
  | 'zazzle-round-sticker-small'
  | 'zazzle-round-sticker-large'
  | 'zazzle-custom-cut-sticker-3x3'
  | 'zazzle-business-card-standard'
  | 'zazzle-business-card-mini'
  | 'zazzle-business-card-mighty'
  | 'zazzle-business-card-square'
  | 'zazzle-business-card-euro'
  | 'zazzle-business-card-oceania'
  | 'zazzle-photo-print-5x7'
  | 'zazzle-poster-11x14'
  | 'zazzle-poster-16x20';

export type ZazzleProductPreset = {
  id: ZazzlePresetId;
  category: string;
  label: string;
  width: number;
  height: number;
  ppi: number;
  physicalSize: string;
  filename: string;
  filenameSlug: string;
  presetType: ZazzlePresetType;
  helperText: string;
  bleedNote?: string;
};

export const ZAZZLE_DEFAULT_PRESET_ID: ZazzlePresetId = 'zazzle-apparel-high-resolution';

export const ZAZZLE_PRESET_TYPE_LABELS: Record<ZazzlePresetType, string> = {
  'source-export': 'High-resolution source export',
  'verified-design-area': 'Verified product design area',
  'product-size-based': 'Size-based export — confirm Zazzle guide',
};

export const ZAZZLE_PRESET_CATEGORIES = [
  'Apparel',
  'Mousepads',
  'Mugs',
  'Magnets & Keychains',
  'Stickers',
  'Business Cards',
  'Photo Prints & Posters',
] as const;

export const zazzleProductPresets: ZazzleProductPreset[] = [
  {
    id: 'zazzle-apparel-high-resolution',
    category: 'Apparel',
    label: 'Apparel High-Resolution Source',
    width: 4200,
    height: 3600,
    ppi: 300,
    physicalSize: '14 × 12 inch light-apparel design area',
    filename: 'zazzle-apparel-high-resolution-4200x3600.png',
    filenameSlug: 'zazzle-apparel-high-resolution',
    presetType: 'source-export',
    helperText:
      'High-resolution source export. This is not a universal required Zazzle apparel size. Confirm final placement using the selected product\'s Zazzle Guide File.',
  },
  {
    id: 'zazzle-standard-mouse-pad',
    category: 'Mousepads',
    label: 'Standard Mouse Pad',
    width: 1388,
    height: 1163,
    ppi: 150,
    physicalSize: '9.25 × 7.75 inches',
    filename: 'zazzle-standard-mouse-pad-1388x1163.png',
    filenameSlug: 'zazzle-standard-mouse-pad',
    presetType: 'verified-design-area',
    helperText: 'Verified Zazzle standard mouse pad design area.',
  },
  {
    id: 'zazzle-gel-mouse-pad',
    category: 'Mousepads',
    label: 'Gel Mouse Pad',
    width: 1185,
    height: 1290,
    ppi: 150,
    physicalSize: '7.9 × 8.6 inches',
    filename: 'zazzle-gel-mouse-pad-1185x1290.png',
    filenameSlug: 'zazzle-gel-mouse-pad',
    presetType: 'verified-design-area',
    helperText: 'Verified Zazzle gel mouse pad design area.',
    bleedNote:
      'Zazzle recommends adding approximately 1/6 inch bleed. Confirm against the current product guide.',
  },
  {
    id: 'zazzle-jumbo-mug',
    category: 'Mugs',
    label: 'Jumbo Mug',
    width: 2100,
    height: 800,
    ppi: 200,
    physicalSize: '10.5 × 4 inches',
    filename: 'zazzle-jumbo-mug-2100x800.png',
    filenameSlug: 'zazzle-jumbo-mug',
    presetType: 'verified-design-area',
    helperText: 'Verified Zazzle jumbo mug design area.',
  },
  {
    id: 'zazzle-bone-china-mug',
    category: 'Mugs',
    label: 'Bone China Mug',
    width: 1450,
    height: 650,
    ppi: 200,
    physicalSize: '7.25 × 3.25 inches',
    filename: 'zazzle-bone-china-mug-1450x650.png',
    filenameSlug: 'zazzle-bone-china-mug',
    presetType: 'verified-design-area',
    helperText: 'Verified Zazzle bone china mug design area.',
  },
  {
    id: 'zazzle-bump-magnet',
    category: 'Magnets & Keychains',
    label: 'Bump Magnet',
    width: 580,
    height: 780,
    ppi: 200,
    physicalSize: '2.9 × 3.9 inches',
    filename: 'zazzle-bump-magnet-580x780.png',
    filenameSlug: 'zazzle-bump-magnet',
    presetType: 'verified-design-area',
    helperText: 'Verified Zazzle bump magnet design area.',
    bleedNote:
      'Zazzle recommends 1/8 inch bleed. This export represents the listed design area, so confirm bleed using the product guide.',
  },
  {
    id: 'zazzle-square-keychain',
    category: 'Magnets & Keychains',
    label: 'Square Acrylic Keychain',
    width: 375,
    height: 375,
    ppi: 200,
    physicalSize: '1.875 × 1.875 inches',
    filename: 'zazzle-square-keychain-375x375.png',
    filenameSlug: 'zazzle-square-keychain',
    presetType: 'verified-design-area',
    helperText: 'Verified Zazzle square acrylic keychain design area.',
    bleedNote:
      'Zazzle recommends 1/16 inch bleed. Confirm using the product guide.',
  },
  {
    id: 'zazzle-round-sticker-small',
    category: 'Stickers',
    label: 'Classic Round Sticker — Small',
    width: 300,
    height: 300,
    ppi: 200,
    physicalSize: '1.5 inch diameter',
    filename: 'zazzle-round-sticker-small-300x300.png',
    filenameSlug: 'zazzle-round-sticker-small',
    presetType: 'product-size-based',
    helperText:
      'Size-based export for the 1.5-inch classic round sticker. Confirm bleed and safe placement in Zazzle.',
  },
  {
    id: 'zazzle-round-sticker-large',
    category: 'Stickers',
    label: 'Classic Round Sticker — Large',
    width: 600,
    height: 600,
    ppi: 200,
    physicalSize: '3 inch diameter',
    filename: 'zazzle-round-sticker-large-600x600.png',
    filenameSlug: 'zazzle-round-sticker-large',
    presetType: 'product-size-based',
    helperText:
      'Size-based export for the 3-inch classic round sticker. Confirm bleed and safe placement in Zazzle.',
  },
  {
    id: 'zazzle-custom-cut-sticker-3x3',
    category: 'Stickers',
    label: 'Custom-Cut Vinyl Sticker — 3 × 3 Design Area',
    width: 600,
    height: 600,
    ppi: 200,
    physicalSize: '3 × 3 inches',
    filename: 'zazzle-custom-cut-sticker-3x3-600x600.png',
    filenameSlug: 'zazzle-custom-cut-sticker-3x3',
    presetType: 'verified-design-area',
    helperText: 'Verified Zazzle custom-cut vinyl sticker design area.',
    bleedNote:
      'Zazzle adds a small 1/8-inch border around custom-cut stickers. Check the Zazzle preview to make sure the cut line looks right.',
  },
  {
    id: 'zazzle-business-card-standard',
    category: 'Business Cards',
    label: 'Standard Business Card',
    width: 700,
    height: 400,
    ppi: 200,
    physicalSize: '3.5 × 2 inches',
    filename: 'zazzle-business-card-standard-700x400.png',
    filenameSlug: 'zazzle-business-card-standard',
    presetType: 'product-size-based',
    helperText:
      '200-PPI source export based on Zazzle\'s listed physical product dimensions. Not guaranteed bleed-ready. Confirm bleed and safe area in Zazzle.',
  },
  {
    id: 'zazzle-business-card-mini',
    category: 'Business Cards',
    label: 'Mini Business Card',
    width: 600,
    height: 200,
    ppi: 200,
    physicalSize: '3 × 1 inches',
    filename: 'zazzle-business-card-mini-600x200.png',
    filenameSlug: 'zazzle-business-card-mini',
    presetType: 'product-size-based',
    helperText:
      '200-PPI source export based on Zazzle\'s listed physical product dimensions. Not guaranteed bleed-ready. Confirm bleed and safe area in Zazzle.',
  },
  {
    id: 'zazzle-business-card-mighty',
    category: 'Business Cards',
    label: 'Mighty Business Card',
    width: 700,
    height: 500,
    ppi: 200,
    physicalSize: '3.5 × 2.5 inches',
    filename: 'zazzle-business-card-mighty-700x500.png',
    filenameSlug: 'zazzle-business-card-mighty',
    presetType: 'product-size-based',
    helperText:
      '200-PPI source export based on Zazzle\'s listed physical product dimensions. Not guaranteed bleed-ready. Confirm bleed and safe area in Zazzle.',
  },
  {
    id: 'zazzle-business-card-square',
    category: 'Business Cards',
    label: 'Square Business Card',
    width: 500,
    height: 500,
    ppi: 200,
    physicalSize: '2.5 × 2.5 inches',
    filename: 'zazzle-business-card-square-500x500.png',
    filenameSlug: 'zazzle-business-card-square',
    presetType: 'product-size-based',
    helperText:
      '200-PPI source export based on Zazzle\'s listed physical product dimensions. Not guaranteed bleed-ready. Confirm bleed and safe area in Zazzle.',
  },
  {
    id: 'zazzle-business-card-euro',
    category: 'Business Cards',
    label: 'Euro Business Card',
    width: 670,
    height: 433,
    ppi: 200,
    physicalSize: '3.346 × 2.165 inches',
    filename: 'zazzle-business-card-euro-670x433.png',
    filenameSlug: 'zazzle-business-card-euro',
    presetType: 'product-size-based',
    helperText:
      '200-PPI source export based on Zazzle\'s listed physical product dimensions. Not guaranteed bleed-ready. Confirm bleed and safe area in Zazzle.',
  },
  {
    id: 'zazzle-business-card-oceania',
    category: 'Business Cards',
    label: 'Oceania Business Card',
    width: 708,
    height: 433,
    ppi: 200,
    physicalSize: '3.54 × 2.165 inches',
    filename: 'zazzle-business-card-oceania-708x433.png',
    filenameSlug: 'zazzle-business-card-oceania',
    presetType: 'product-size-based',
    helperText:
      '200-PPI source export based on Zazzle\'s listed physical product dimensions. Not guaranteed bleed-ready. Confirm bleed and safe area in Zazzle.',
  },
  {
    id: 'zazzle-photo-print-5x7',
    category: 'Photo Prints & Posters',
    label: 'Photo Print — 5 × 7',
    width: 1500,
    height: 2100,
    ppi: 300,
    physicalSize: '5 × 7 inches',
    filename: 'zazzle-photo-print-5x7-1500x2100.png',
    filenameSlug: 'zazzle-photo-print-5x7',
    presetType: 'product-size-based',
    helperText:
      '300-PPI source export based on the selected physical print size. Confirm cropping, bleed and orientation in Zazzle.',
  },
  {
    id: 'zazzle-poster-11x14',
    category: 'Photo Prints & Posters',
    label: 'Poster — 11 × 14',
    width: 3300,
    height: 4200,
    ppi: 300,
    physicalSize: '11 × 14 inches',
    filename: 'zazzle-poster-11x14-3300x4200.png',
    filenameSlug: 'zazzle-poster-11x14',
    presetType: 'product-size-based',
    helperText:
      '300-PPI source export based on the selected physical print size. Confirm cropping, bleed and orientation in Zazzle.',
  },
  {
    id: 'zazzle-poster-16x20',
    category: 'Photo Prints & Posters',
    label: 'Poster — 16 × 20',
    width: 4800,
    height: 6000,
    ppi: 300,
    physicalSize: '16 × 20 inches',
    filename: 'zazzle-poster-16x20-4800x6000.png',
    filenameSlug: 'zazzle-poster-16x20',
    presetType: 'product-size-based',
    helperText:
      '300-PPI source export based on the selected physical print size. Confirm cropping, bleed and orientation in Zazzle.',
  },
];

export function getZazzlePresetById(id: ZazzlePresetId): ZazzleProductPreset {
  return (
    zazzleProductPresets.find((preset) => preset.id === id) ??
    zazzleProductPresets.find((preset) => preset.id === ZAZZLE_DEFAULT_PRESET_ID)!
  );
}

export function getZazzlePresetsByCategory(): Map<string, ZazzleProductPreset[]> {
  const grouped = new Map<string, ZazzleProductPreset[]>();
  for (const category of ZAZZLE_PRESET_CATEGORIES) {
    grouped.set(
      category,
      zazzleProductPresets.filter((preset) => preset.category === category)
    );
  }
  return grouped;
}
