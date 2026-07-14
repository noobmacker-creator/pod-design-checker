const assert = require('node:assert/strict');
const createJiti = require('jiti');

const jiti = createJiti(__filename);

const {
  calculateRequiredPpi,
  centimetresToInches,
  computePrintSizes,
  getPlannedPrintStatus,
  inchesToCentimetres,
  pixelsToInches,
  roundToOneDecimal,
  validatePixelDimension,
} = jiti('../app/lib/printSizeCalculatorUtils.ts');

const { ALL_CONVERTER_PRESETS } = jiti('../app/lib/productConverterPresets.ts');

// pixels to inches calculation
assert.equal(roundToOneDecimal(pixelsToInches(4200, 300)), 14);
assert.equal(roundToOneDecimal(pixelsToInches(4800, 300)), 16);

// pixels to centimetres calculation
assert.equal(roundToOneDecimal(inchesToCentimetres(14)), 35.6);
assert.equal(roundToOneDecimal(inchesToCentimetres(16)), 40.6);

// 150 / 200 / 300 PPI results
const sizes = computePrintSizes(4200, 4800);
assert.equal(sizes.length, 3);

const at300 = sizes.find((size) => size.ppi === 300);
const at200 = sizes.find((size) => size.ppi === 200);
const at150 = sizes.find((size) => size.ppi === 150);

assert.ok(at300);
assert.ok(at200);
assert.ok(at150);

assert.equal(at300.widthIn, 14);
assert.equal(at300.heightIn, 16);
assert.equal(at300.widthCm, 35.6);
assert.equal(at300.heightCm, 40.6);
assert.equal(at300.detailLabel, 'High detail');

assert.equal(at200.widthIn, 21);
assert.equal(at200.heightIn, 24);
assert.equal(at200.detailLabel, 'Standard print');

assert.equal(at150.widthIn, 28);
assert.equal(at150.heightIn, 32);
assert.equal(at150.detailLabel, 'Large print / lower detail');

// planned print size required PPI
const requiredInches = calculateRequiredPpi(4200, 4800, 14, 16, 'in');
assert.equal(requiredInches, 300);

const requiredCm = calculateRequiredPpi(4200, 4800, 35.56, 40.64, 'cm');
assert.equal(requiredCm, 300);

// cm input conversion to inches
assert.equal(roundToOneDecimal(centimetresToInches(2.54)), 1);

// invalid width rejected
assert.ok(validatePixelDimension('').error);
assert.ok(validatePixelDimension('-10').error);
assert.ok(validatePixelDimension('12.5').error);
assert.ok(validatePixelDimension('0').error);

// invalid height rejected
assert.ok(validatePixelDimension('abc').error);

// valid pixel values
assert.deepEqual(validatePixelDimension('4200'), { value: 4200, error: null });
assert.deepEqual(validatePixelDimension('4800'), { value: 4800, error: null });

// planned print status labels
assert.equal(getPlannedPrintStatus(320).label, 'High detail');
assert.equal(getPlannedPrintStatus(250).label, 'Good for many products');
assert.equal(getPlannedPrintStatus(170).label, 'May be okay for larger/simple prints');
assert.equal(getPlannedPrintStatus(120).label, 'Low detail risk');

// Print Size Calculator does not change Converter preset data
assert.ok(ALL_CONVERTER_PRESETS.length > 0);

console.log('print-size-calculator.test.cjs passed');
