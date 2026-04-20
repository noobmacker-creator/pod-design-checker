export type RedbubblePresetId =
  | 'apparel'
  | 'premium-tee'
  | 'stickers-square'
  | 'large-home';

export type RedbubblePreset = {
  id: RedbubblePresetId;
  label: string;
  width: number;
  height: number;
};

export const redbubblePresets: RedbubblePreset[] = [
  {
    id: 'apparel',
    label: 'Redbubble Apparel',
    width: 2400,
    height: 3200,
  },
  {
    id: 'premium-tee',
    label: 'Redbubble Premium Tee',
    width: 2875,
    height: 3900,
  },
  {
    id: 'stickers-square',
    label: 'Redbubble Stickers / Square',
    width: 2800,
    height: 2800,
  },
  {
    id: 'large-home',
    label: 'Redbubble Large Home',
    width: 7632,
    height: 6480,
  },
];