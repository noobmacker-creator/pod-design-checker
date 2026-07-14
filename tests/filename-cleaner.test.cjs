const assert = require('node:assert/strict');
const createJiti = require('jiti');

const jiti = createJiti(__filename);

const {
  cleanBasename,
  cleanFilename,
  DEFAULT_FILENAME_CLEAN_OPTIONS,
  resolveDuplicateFilenames,
  validateManualFilename,
} = jiti('../app/lib/filenameCleanerUtils.ts');

const { ALL_CONVERTER_PRESETS } = jiti('../app/lib/productConverterPresets.ts');

const defaultOptions = { ...DEFAULT_FILENAME_CLEAN_OPTIONS };

// lowercase filenames
assert.equal(
  cleanFilename('My Design.PNG', defaultOptions),
  'my-design.png',
);

// spaces converted to hyphens
assert.equal(
  cleanBasename('hello world test', defaultOptions),
  'hello-world-test',
);

// underscores converted to hyphens
assert.equal(
  cleanBasename('hello_world_test', defaultOptions),
  'hello-world-test',
);

// unsafe characters removed
assert.equal(
  cleanBasename('bad<>name/file', defaultOptions),
  'badnamefile',
);

// repeated hyphens collapsed
assert.equal(
  cleanBasename('hello---world', defaultOptions),
  'hello-world',
);

// extension preserved and lowercased
assert.equal(
  cleanFilename('Design.JPG', defaultOptions),
  'design.jpg',
);

// junk words removed
assert.equal(
  cleanBasename('my-design-copy-final-download', defaultOptions),
  'my-design',
);

// adjacent duplicate words removed
assert.equal(
  cleanBasename('my-design-design-art', defaultOptions),
  'my-design-art',
);

// random long ID chunks removed
assert.equal(
  cleanFilename('azalea-front-2-69a58ed476497.jpg', defaultOptions),
  'azalea-front-2.jpg',
);

// meaningful short numbers preserved
assert.equal(
  cleanBasename('retro-80s-design-2', defaultOptions),
  'retro-80s-design-2',
);

assert.equal(
  cleanBasename('version-3', defaultOptions),
  'version-3',
);

assert.equal(
  cleanBasename('design-4200x4800', defaultOptions),
  'design-4200x4800',
);

// empty cleaned name becomes design
assert.equal(
  cleanBasename('copy-final-download', defaultOptions),
  'design',
);

// duplicate output filenames receive -2, -3
const duplicates = resolveDuplicateFilenames(['design.png', 'design.png', 'design.png']);
assert.equal(duplicates[0].cleanFilename, 'design.png');
assert.equal(duplicates[1].cleanFilename, 'design-2.png');
assert.equal(duplicates[2].cleanFilename, 'design-3.png');
assert.equal(duplicates[1].statusNote, 'Renamed to avoid duplicate');

// manual filename edit validation
assert.equal(validateManualFilename('').valid, false);
assert.equal(validateManualFilename('no-extension').valid, false);
assert.equal(validateManualFilename('valid-name.png').valid, true);
assert.equal(validateManualFilename('valid-name.png').normalized, 'valid-name.png');
assert.equal(validateManualFilename('bad|name.png').valid, false);

// add size to filename
const withSizeOptions = { ...defaultOptions, addSizeToFilename: true };
assert.equal(
  cleanFilename('my-design.png', withSizeOptions, { width: 4200, height: 4800 }),
  'my-design-4200x4800.png',
);

// keep colour words does not remove colour tokens from junk removal path
const keepColourOptions = { ...defaultOptions, keepColourWords: true };
assert.match(
  cleanBasename('navy-front-design', keepColourOptions),
  /navy/,
);

// Filename Cleaner does not change Converter preset data
assert.ok(Array.isArray(ALL_CONVERTER_PRESETS));
assert.ok(ALL_CONVERTER_PRESETS.length > 0);
assert.ok(ALL_CONVERTER_PRESETS.every((preset) => preset.width > 0 && preset.height > 0));

console.log('filename-cleaner.test.cjs: all tests passed');
