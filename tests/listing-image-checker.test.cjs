const assert = require('node:assert/strict');
const createJiti = require('jiti');

const jiti = createJiti(__filename);

const {
  LISTING_CROP_PREVIEWS,
  SAFE_AREA_DEFAULT_ENABLED,
  buildThumbnailNotes,
  getListingAspectRatio,
  getListingOrientation,
  getListingPreviewStatus,
  getListingPreviewStatusNote,
  mayCropTightlyInAnyPreview,
  wouldCropTightly,
} = jiti('../app/lib/listingImageCheckerUtils.ts');

const { ALL_CONVERTER_PRESETS } = jiti('../app/lib/productConverterPresets.ts');

// aspect ratio calculation
assert.equal(getListingAspectRatio(4200, 4800), '7:8');
assert.equal(getListingAspectRatio(1000, 1000), '1:1');

// orientation detection
assert.equal(getListingOrientation(4200, 4800), 'Portrait');
assert.equal(getListingOrientation(4800, 4200), 'Landscape');
assert.equal(getListingOrientation(1000, 1000), 'Square');

// listing preview crop definitions
assert.equal(LISTING_CROP_PREVIEWS.length, 4);
assert.ok(LISTING_CROP_PREVIEWS.some((crop) => crop.id === 'square'));
assert.ok(LISTING_CROP_PREVIEWS.some((crop) => crop.id === 'listing-43'));
assert.ok(LISTING_CROP_PREVIEWS.some((crop) => crop.id === 'portrait'));
assert.ok(LISTING_CROP_PREVIEWS.some((crop) => crop.id === 'mobile-narrow'));

const squareCrop = LISTING_CROP_PREVIEWS.find((crop) => crop.id === 'square');
assert.equal(squareCrop.ratioLabel, '1:1');
assert.equal(squareCrop.aspectRatio, 1);

// safe area default enabled
assert.equal(SAFE_AREA_DEFAULT_ENABLED, true);

// file size note logic
const largeFileNotes = buildThumbnailNotes(2000, 2000, 6 * 1024 * 1024);
assert.ok(largeFileNotes.some((note) => /Large file size/i.test(note.text)));

// very wide image crop note
const wideNotes = buildThumbnailNotes(4000, 1000, 100000);
assert.ok(wideNotes.some((note) => /wide images may crop tightly on mobile/i.test(note.text)));

// very tall image crop note
const tallNotes = buildThumbnailNotes(1000, 4000, 100000);
assert.ok(tallNotes.some((note) => /tall images may crop tightly in wide previews/i.test(note.text)));

// small image note via preview status
assert.equal(getListingPreviewStatus(600, 800, 100000), 'Needs attention');

// square image triggers check crop because other preview shapes may crop tightly
assert.equal(getListingPreviewStatus(2000, 2000, 100000), 'Check crop');
assert.ok(mayCropTightlyInAnyPreview(2000, 2000));
assert.equal(
  getListingPreviewStatusNote('Check crop'),
  'Some preview shapes may cut off important parts of this image.',
);

// tight crop detection
assert.ok(wouldCropTightly(1, 4 / 3));
assert.ok(!wouldCropTightly(1, 1));

// extreme aspect ratio status
assert.equal(getListingPreviewStatus(5000, 1000, 100000), 'Check crop');

// Listing Image Checker does not change scanner logic — no scanner imports here

// Listing Image Checker does not change Converter preset data
assert.ok(ALL_CONVERTER_PRESETS.length > 0);

console.log('listing-image-checker.test.cjs passed');
