export type AdditionalPlatformPreset = {
  id: 'spring-apparel' | 'zazzle-apparel-high-resolution';
  width: number;
  height: number;
  filename: string;
  label: string;
};

export const SPRING_STANDARD_APPAREL_PRESET: AdditionalPlatformPreset = {
  id: 'spring-apparel',
  width: 3720,
  height: 4950,
  filename: 'spring-standard-apparel-3720x4950.png',
  label: 'Spring Standard Apparel',
};

export const ZAZZLE_APPAREL_HIGH_RESOLUTION_PRESET: AdditionalPlatformPreset = {
  id: 'zazzle-apparel-high-resolution',
  width: 4200,
  height: 3600,
  filename: 'zazzle-apparel-high-resolution-4200x3600.png',
  label: 'Zazzle Apparel High Resolution',
};
