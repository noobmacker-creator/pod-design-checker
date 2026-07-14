import { getOrientation, simplifyAspectRatio } from './fileInspectorUtils';
import { formatBytes } from './podCheckerUtils';

export type ListingCropDefinition = {
  id: string;
  name: string;
  ratioLabel: string;
  aspectRatio: number;
  note: string;
};

export type ListingPreviewStatus = 'Looks okay' | 'Check crop' | 'Needs attention';

export type ListingThumbnailNote = {
  text: string;
};

export const LISTING_CROP_PREVIEWS: ListingCropDefinition[] = [
  {
    id: 'square',
    name: 'Square thumbnail',
    ratioLabel: '1:1',
    aspectRatio: 1,
    note: 'Good for shop grids and search thumbnails.',
  },
  {
    id: 'listing-43',
    name: '4:3 listing crop',
    ratioLabel: '4:3',
    aspectRatio: 4 / 3,
    note: 'Common wide listing preview.',
  },
  {
    id: 'portrait',
    name: 'Portrait crop',
    ratioLabel: '3:4',
    aspectRatio: 3 / 4,
    note: 'Useful for tall product images.',
  },
  {
    id: 'mobile-narrow',
    name: 'Mobile narrow crop',
    ratioLabel: '9:16',
    aspectRatio: 9 / 16,
    note: 'Shows how the image may feel on small screens.',
  },
];

export const SAFE_AREA_DEFAULT_ENABLED = true;

export function formatListingFileSize(bytes: number): string {
  return formatBytes(bytes);
}

export function getListingAspectRatio(widthPx: number, heightPx: number): string {
  return simplifyAspectRatio(widthPx, heightPx);
}

export function getListingOrientation(widthPx: number, heightPx: number) {
  return getOrientation(widthPx, heightPx);
}

export function wouldCropTightly(
  imageRatio: number,
  cropRatio: number,
  visibleFractionThreshold = 0.88,
): boolean {
  if (imageRatio <= 0 || cropRatio <= 0) return true;
  const visibleFraction =
    imageRatio > cropRatio ? cropRatio / imageRatio : imageRatio / cropRatio;
  return visibleFraction < visibleFractionThreshold;
}

export function mayCropTightlyInAnyPreview(widthPx: number, heightPx: number): boolean {
  if (widthPx <= 0 || heightPx <= 0) return false;
  const imageRatio = widthPx / heightPx;
  return LISTING_CROP_PREVIEWS.some((crop) =>
    wouldCropTightly(imageRatio, crop.aspectRatio),
  );
}

export function buildThumbnailNotes(
  widthPx: number,
  heightPx: number,
  fileSizeBytes: number,
): ListingThumbnailNote[] {
  if (widthPx <= 0 || heightPx <= 0) return [];

  const notes: ListingThumbnailNote[] = [];
  const ratio = widthPx / heightPx;

  if (Math.abs(ratio - 1) > 0.25) {
    notes.push({ text: 'Product may appear small in square thumbnail.' });
  }

  if (ratio > 1.75 || ratio < 0.57) {
    notes.push({ text: 'Important content may be close to the edge.' });
  }

  if (ratio > 2) {
    notes.push({ text: 'Very wide images may crop tightly on mobile.' });
  }

  if (ratio < 0.5) {
    notes.push({ text: 'Very tall images may crop tightly in wide previews.' });
  }

  if (fileSizeBytes > 5 * 1024 * 1024) {
    notes.push({ text: 'Large file size may slow upload or page loading.' });
  }

  return notes;
}

export function getListingPreviewStatus(
  widthPx: number,
  heightPx: number,
  fileSizeBytes: number,
): ListingPreviewStatus {
  if (widthPx <= 0 || heightPx <= 0) return 'Needs attention';

  const ratio = widthPx / heightPx;
  const minSide = Math.min(widthPx, heightPx);

  if (minSide < 800 || fileSizeBytes > 10 * 1024 * 1024) {
    return 'Needs attention';
  }

  if (ratio > 2.5 || ratio < 0.4) {
    return 'Check crop';
  }

  if (mayCropTightlyInAnyPreview(widthPx, heightPx)) {
    return 'Check crop';
  }

  return 'Looks okay';
}

export function getListingPreviewStatusNote(status: ListingPreviewStatus): string | null {
  if (status === 'Check crop') {
    return 'Some preview shapes may cut off important parts of this image.';
  }
  return null;
}

export function getListingPreviewStatusColor(status: ListingPreviewStatus): string {
  if (status === 'Looks okay') return '#86efac';
  if (status === 'Check crop') return '#facc15';
  return '#fca5a5';
}
