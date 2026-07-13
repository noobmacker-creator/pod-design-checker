const assert = require('node:assert/strict');
const createJiti = require('jiti');

const jiti = createJiti(__filename);

const {
  computeBatchProductOutputCount,
  computeBatchExportSizeCount,
  getEligibleBatchExportItems,
  getPresetsForQuickExportPack,
  getCustomSizeFilename,
  makeCustomSizePreset,
  makeUniqueDesignFolderNames,
  parseCustomExportSize,
} = jiti('../app/lib/batchProductExport.ts');

const {
  getQuickExportPackPresetIds,
  getPresetById,
  ALL_CONVERTER_PRESETS,
} = jiti('../app/lib/productConverterPresets.ts');

function makeQueueItem(overrides) {
  return {
    id: overrides.id ?? 'item-1',
    file: overrides.file ?? new File([new Uint8Array([1])], overrides.filename ?? 'design.png', {
      type: 'image/png',
    }),
    filename: overrides.filename ?? 'design.png',
    relativePath: overrides.filename ?? 'design.png',
    size: 100,
    type: 'PNG',
    status: overrides.status ?? 'ready',
  };
}

// output count calculation
assert.equal(computeBatchProductOutputCount(0, 3), 0);
assert.equal(computeBatchProductOutputCount(5, 0), 0);
assert.equal(computeBatchProductOutputCount(3, 4), 12);
assert.equal(computeBatchProductOutputCount(12, 3), 36);

// one design with multiple products
assert.equal(computeBatchProductOutputCount(1, 5), 5);

// multiple designs with one product
assert.equal(computeBatchProductOutputCount(8, 1), 8);

// multiple designs with multiple products
assert.equal(computeBatchProductOutputCount(2, 3), 6);

// no products selected
const emptyPresets = getPresetsForQuickExportPack('apparel').filter(() => false);
assert.equal(emptyPresets.length, 0);
assert.equal(computeBatchProductOutputCount(5, emptyPresets.length), 0);

// no eligible designs
const mixedItems = [
  makeQueueItem({ id: 'a', status: 'ready', filename: 'a.png' }),
  makeQueueItem({ id: 'b', status: 'needs-review', filename: 'b.png' }),
  makeQueueItem({ id: 'c', status: 'failed', filename: 'c.png' }),
  makeQueueItem({ id: 'd', status: 'safe-auto-fix', filename: 'd.png' }),
];
const eligible = getEligibleBatchExportItems(mixedItems);
assert.equal(eligible.length, 1);
assert.equal(eligible[0].filename, 'a.png');

// failed designs are not exported
assert.ok(!eligible.some((item) => item.status === 'failed'));
assert.ok(!eligible.some((item) => item.status === 'needs-review'));
assert.ok(!eligible.some((item) => item.status === 'safe-auto-fix'));

// Quick Pack selection uses existing Converter pack definitions
const apparelIds = getQuickExportPackPresetIds('apparel');
const apparelPresets = getPresetsForQuickExportPack('apparel');
assert.equal(apparelPresets.length, apparelIds.length);
for (const preset of apparelPresets) {
  assert.ok(getPresetById(preset.id));
  assert.ok(apparelIds.includes(preset.id));
}

const printfulPresets = getPresetsForQuickExportPack('printful');
assert.ok(printfulPresets.length > 0);
for (const preset of printfulPresets) {
  assert.equal(preset.platform, 'printful');
}

// duplicate source filenames do not overwrite output folders
const folderNames = makeUniqueDesignFolderNames([
  'My Design.png',
  'my-design.jpg',
  'Other.png',
  'My Design.png',
]);
assert.equal(folderNames[0], 'my-design');
assert.equal(folderNames[1], 'my-design-2');
assert.equal(folderNames[2], 'other');
assert.equal(folderNames[3], 'my-design-3');
assert.equal(new Set(folderNames).size, folderNames.length);

// existing Converter presets remain unchanged
assert.ok(ALL_CONVERTER_PRESETS.length > 0);
const standardPreset = ALL_CONVERTER_PRESETS.find((p) => p.id === 'standard-apparel');
assert.ok(standardPreset);
assert.equal(standardPreset.width, 4200);
assert.equal(standardPreset.height, 4800);

const teepublicPreset = ALL_CONVERTER_PRESETS.find((p) => p.id === 'teepublic-all-products');
assert.ok(teepublicPreset);
assert.equal(teepublicPreset.width, 5000);
assert.equal(teepublicPreset.height, 5500);

// valid custom width and height
const validCustom = parseCustomExportSize('4200', '4800');
assert.equal(validCustom.valid, true);
if (validCustom.valid) {
  assert.equal(validCustom.width, 4200);
  assert.equal(validCustom.height, 4800);
}

// zero or negative values rejected
assert.equal(parseCustomExportSize('0', '4800').valid, false);
assert.equal(parseCustomExportSize('4200', '-100').valid, false);

// decimal values rejected
assert.equal(parseCustomExportSize('4200.5', '4800').valid, false);
assert.equal(parseCustomExportSize('4200', '4800.9').valid, false);

// custom size counts as one export size
assert.equal(computeBatchExportSizeCount(3, true), 4);
assert.equal(computeBatchExportSizeCount(0, true), 1);
assert.equal(computeBatchExportSizeCount(3, false), 3);

// custom-only Batch export output count
assert.equal(computeBatchProductOutputCount(13, 1), 13);

// presets plus custom-size export output count
assert.equal(computeBatchProductOutputCount(13, 4), 52);

// correct custom filename
assert.equal(getCustomSizeFilename(4200, 4800), 'custom-4200x4800.png');
assert.equal(getCustomSizeFilename(5000, 6000), 'custom-5000x6000.png');

// custom preset uses correct dimensions and filename
const customPreset = makeCustomSizePreset(4200, 4800);
assert.equal(customPreset.width, 4200);
assert.equal(customPreset.height, 4800);
assert.equal(customPreset.filename, 'custom-4200x4800.png');
assert.match(customPreset.label, /Custom Size/);

// removing custom size updates the output total (logic-only)
assert.equal(computeBatchProductOutputCount(13, computeBatchExportSizeCount(3, false)), 39);
assert.equal(computeBatchProductOutputCount(13, computeBatchExportSizeCount(3, true)), 52);

// zero eligible designs cannot export a custom size (UI guard — eligible list empty)
assert.equal(getEligibleBatchExportItems([]).length, 0);

console.log('batch-product-export.test.cjs: all tests passed');
