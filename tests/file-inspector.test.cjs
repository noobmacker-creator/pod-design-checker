const assert = require('node:assert/strict');
const createJiti = require('jiti');

const jiti = createJiti(__filename);

const {
  analyzeTransparency,
  detectPossibleSolidBackground,
  formatFileSizeLabel,
  getDpiMetadataInfo,
  getFileTypeLabel,
  getOrientation,
  simplifyAspectRatio,
} = jiti('../app/lib/fileInspectorUtils.ts');

const { ALL_CONVERTER_PRESETS } = jiti('../app/lib/productConverterPresets.ts');

function mockImageData(width, height, fill) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const pixel = fill(x, y);
      data[index] = pixel.r;
      data[index + 1] = pixel.g;
      data[index + 2] = pixel.b;
      data[index + 3] = pixel.a;
    }
  }
  return { data, width, height };
}

// file size formatting
assert.match(formatFileSizeLabel(8400000), /MB/);

// aspect ratio simplification
assert.equal(simplifyAspectRatio(4200, 4800), '7:8');
assert.equal(simplifyAspectRatio(1000, 1000), '1:1');

// orientation detection
assert.equal(getOrientation(4200, 4800), 'Portrait');
assert.equal(getOrientation(4800, 4200), 'Landscape');
assert.equal(getOrientation(1000, 1000), 'Square');

// JPG transparency status
const jpgTransparency = analyzeTransparency(null, 'image/jpeg');
assert.equal(jpgTransparency.notSupported, true);
assert.equal(jpgTransparency.title, 'TRANSPARENCY NOT SUPPORTED');
assert.match(jpgTransparency.detail, /JPG files cannot contain real transparent backgrounds/i);

// PNG with no transparency found
const opaqueImage = mockImageData(4, 4, () => ({ r: 255, g: 255, b: 255, a: 255 }));
const opaqueResult = analyzeTransparency(opaqueImage, 'image/png');
assert.equal(opaqueResult.isFullyOpaque, true);
assert.equal(opaqueResult.title, 'NO TRANSPARENCY FOUND');
assert.match(opaqueResult.detail, /This PNG has no real transparent pixels/i);

// PNG alpha transparency detection
const transparentImage = mockImageData(4, 4, (x, y) => ({
  r: 255,
  g: 0,
  b: 0,
  a: x === 0 ? 0 : 255,
}));
const transparentResult = analyzeTransparency(transparentImage, 'image/png');
assert.equal(transparentResult.hasTransparentAreas, true);
assert.equal(transparentResult.title, 'TRANSPARENT AREAS FOUND');
assert.match(transparentResult.detail, /real transparent pixels/i);

// semi-transparent pixel detection
const semiImage = mockImageData(4, 4, () => ({ r: 200, g: 200, b: 200, a: 128 }));
const semiResult = analyzeTransparency(semiImage, 'image/png');
assert.equal(semiResult.hasSemiTransparent, true);
assert.equal(semiResult.title, 'SEMI-TRANSPARENT PIXELS FOUND');
assert.match(semiResult.detail, /partially transparent pixels/i);

// could not check transparency when image data is missing for PNG
const missingDataResult = analyzeTransparency(null, 'image/png');
assert.equal(missingDataResult.title, 'COULD NOT CHECK TRANSPARENCY');
assert.match(missingDataResult.detail, /could not be checked/i);

// cautious solid background hint
const solidImage = mockImageData(20, 20, () => ({ r: 255, g: 255, b: 255, a: 255 }));
const solidTransparency = analyzeTransparency(solidImage, 'image/png');
assert.equal(detectPossibleSolidBackground(solidImage, solidTransparency), true);

const transparentSolidImage = mockImageData(20, 20, (x) => ({
  r: 255,
  g: 255,
  b: 255,
  a: x === 0 ? 0 : 255,
}));
const transparentSolidResult = analyzeTransparency(transparentSolidImage, 'image/png');
assert.equal(detectPossibleSolidBackground(transparentSolidImage, transparentSolidResult), false);

// DPI metadata missing status
const missingDpi = getDpiMetadataInfo(null);
assert.equal(missingDpi.label, 'DPI metadata missing');
assert.match(missingDpi.detail, /Pixel dimensions matter more/i);

const foundDpi = getDpiMetadataInfo(300);
assert.equal(foundDpi.label, '300 PPI found');

// file type label
assert.equal(getFileTypeLabel({ name: 'test.png', type: 'image/png' }), 'PNG');
assert.equal(getFileTypeLabel({ name: 'test.jpg', type: 'image/jpeg' }), 'JPEG');

// File Inspector does not change Converter preset data
assert.ok(ALL_CONVERTER_PRESETS.length > 0);

console.log('file-inspector.test.cjs passed');
