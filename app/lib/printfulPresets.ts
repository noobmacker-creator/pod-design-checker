export type PrintfulPresetId =
  | 'dtg-dtf-apparel'
  | 'sticker-square'
  | 'poster-16x20'
  | 'golf-towel';

export type PrintfulPreset = {
  id: PrintfulPresetId;
  label: string;
  width: number;
  height: number;
};

export const printfulPresets: PrintfulPreset[] = [
  {
    id: 'dtg-dtf-apparel',
    label: 'Printful DTG/DTF Apparel',
    width: 4500,
    height: 5400,
  },
  {
    id: 'sticker-square',
    label: 'Printful Sticker / Square',
    width: 1650,
    height: 1650,
  },
  {
    id: 'poster-16x20',
    label: 'Printful Poster 16 × 20',
    width: 4800,
    height: 6000,
  },
  {
    id: 'golf-towel',
    label: 'Printful Golf Towel',
    width: 4800,
    height: 7200,
  },
];
