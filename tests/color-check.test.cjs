const assert = require('node:assert/strict');
const createJiti = require('jiti');

const jiti = createJiti(__filename);

const {
  DEFAULT_SELECTED_PRESET_IDS,
  COLOR_CHECK_PRESETS,
  MAX_CUSTOM_COLOURS,
  addCustomColour,
  buildActiveColourEntries,
  computeComparisonSheetSize,
  getColourCheckFilename,
  normalizeHexColour,
  removeCustomColour,
  resetToDefaultSelection,
  togglePresetSelection,
} = jiti('../app/lib/colorCheckUtils.ts');

const { ALL_CONVERTER_PRESETS } = jiti('../app/lib/productConverterPresets.ts');

// default selected colours
assert.deepEqual([...DEFAULT_SELECTED_PRESET_IDS], ['white', 'black', 'heather-grey', 'navy']);
assert.equal(DEFAULT_SELECTED_PRESET_IDS.length, 4);

const defaultSelection = resetToDefaultSelection();
assert.equal(defaultSelection.size, 4);
for (const id of DEFAULT_SELECTED_PRESET_IDS) {
  assert.ok(defaultSelection.has(id));
}

// selecting and removing preset colours
let selected = resetToDefaultSelection();
selected = togglePresetSelection(selected, 'red');
assert.ok(selected.has('red'));
selected = togglePresetSelection(selected, 'red');
assert.ok(!selected.has('red'));

// at least one colour remains selected
selected = resetToDefaultSelection();
const onlyOne = new Set(['white']);
selected = togglePresetSelection(onlyOne, 'white');
assert.equal(selected.size, 1);
assert.ok(selected.has('white'));

// valid custom hex colour
const added = addCustomColour([], '#7a3f91');
assert.equal(added.error, null);
assert.deepEqual(added.colours, ['#7A3F91']);

// invalid custom hex rejected
const invalid = addCustomColour([], 'not-a-colour');
assert.ok(invalid.error);
assert.equal(invalid.colours.length, 0);

// duplicate custom colour rejected
const duplicate = addCustomColour(['#7A3F91'], '#7A3F91');
assert.ok(duplicate.error);
assert.deepEqual(duplicate.colours, ['#7A3F91']);

// custom colour limit
let colours = [];
for (let i = 0; i < MAX_CUSTOM_COLOURS; i++) {
  const hex = `#${(100000 + i).toString(16).toUpperCase().padStart(6, '0')}`;
  const result = addCustomColour(colours, hex);
  assert.equal(result.error, null);
  colours = result.colours;
}
const overLimit = addCustomColour(colours, '#ABCDEF');
assert.ok(overLimit.error);
assert.equal(overLimit.colours.length, MAX_CUSTOM_COLOURS);

// custom colour removal
assert.deepEqual(removeCustomColour(['#7A3F91', '#123456'], '#7A3F91'), ['#123456']);

// build active entries
const active = buildActiveColourEntries(defaultSelection, ['#7A3F91']);
assert.equal(active.length, 5);
assert.ok(active.some((entry) => entry.label === 'Custom #7A3F91'));

// comparison sheet filename
assert.equal(getColourCheckFilename('Demon Rider.png'), 'demon-rider-colour-check.png');
assert.equal(getColourCheckFilename('My Design.JPG'), 'my-design-colour-check.png');

// normalize hex
assert.equal(normalizeHexColour('#abc123'), '#ABC123');
assert.equal(normalizeHexColour('abc123'), '#ABC123');
assert.equal(normalizeHexColour('bad'), null);

// comparison sheet size grows with panel count
const sizeOne = computeComparisonSheetSize(1);
const sizeFour = computeComparisonSheetSize(4);
assert.ok(sizeFour.height >= sizeOne.height);
assert.ok(sizeFour.width >= sizeOne.width);

// Color Check does not change Converter preset data
assert.ok(ALL_CONVERTER_PRESETS.length > 0);
assert.ok(COLOR_CHECK_PRESETS.length >= 6);

console.log('color-check.test.cjs passed');
