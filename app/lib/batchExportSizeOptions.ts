export type BatchMultiExportSizeOption = {
  id: string;
  label: string;
  checkboxLabel: string;
  width: number;
  height: number;
  folderSlug: string;
};

/** Shared multi-size export options (same dimensions as Multi-Size Export Pack). */
export const BATCH_MULTI_EXPORT_SIZE_OPTIONS: BatchMultiExportSizeOption[] = [
  {
    id: 'standard',
    label: 'Standard Apparel',
    checkboxLabel: 'Standard Apparel — 4200 × 4800',
    width: 4200,
    height: 4800,
    folderSlug: 'standard-apparel-4200x4800',
  },
  {
    id: 'redbubble',
    label: 'Redbubble Apparel',
    checkboxLabel: 'Redbubble Apparel — 2400 × 3200',
    width: 2400,
    height: 3200,
    folderSlug: 'redbubble-apparel-2400x3200',
  },
  {
    id: 'printful',
    label: 'Printful Apparel',
    checkboxLabel: 'Printful Apparel — 4500 × 5400',
    width: 4500,
    height: 5400,
    folderSlug: 'printful-apparel-4500x5400',
  },
  {
    id: 'teepublic',
    label: 'TeePublic',
    checkboxLabel: 'TeePublic — 5000 × 5500',
    width: 5000,
    height: 5500,
    folderSlug: 'teepublic-5000x5500',
  },
  {
    id: 'square',
    label: 'Square',
    checkboxLabel: 'Square — 4500 × 4500',
    width: 4500,
    height: 4500,
    folderSlug: 'square-4500x4500',
  },
  {
    id: 'sticker',
    label: 'Sticker',
    checkboxLabel: 'Sticker — 3000 × 3000',
    width: 3000,
    height: 3000,
    folderSlug: 'sticker-3000x3000',
  },
  {
    id: 'poster',
    label: 'Poster',
    checkboxLabel: 'Poster — 5400 × 7200',
    width: 5400,
    height: 7200,
    folderSlug: 'poster-5400x7200',
  },
  {
    id: 'mug',
    label: 'Mug',
    checkboxLabel: 'Mug — 2700 × 1200',
    width: 2700,
    height: 1200,
    folderSlug: 'mug-2700x1200',
  },
  {
    id: 'tote-bag',
    label: 'Tote Bag',
    checkboxLabel: 'Tote Bag — 4500 × 5400',
    width: 4500,
    height: 5400,
    folderSlug: 'tote-bag-4500x5400',
  },
  {
    id: 'phone-case',
    label: 'Phone Case',
    checkboxLabel: 'Phone Case — 2400 × 3600',
    width: 2400,
    height: 3600,
    folderSlug: 'phone-case-2400x3600',
  },
];

export type BatchExportSizeSelection = Pick<
  BatchMultiExportSizeOption,
  'label' | 'width' | 'height' | 'folderSlug'
>;
