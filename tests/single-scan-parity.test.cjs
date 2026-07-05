const assert = require('node:assert/strict');
const createJiti = require('jiti');

const jiti = createJiti(__filename);

const { compareSingleScanParity } = jiti('../app/lib/singleScanParity.ts');

const baseSnapshot = {
  printConfidence: 88,
  mainIssue: 'Design Too Small',
  nextAction: 'Run Auto Fix',
  warnings: ['White Background Risk', 'Compression Artifact Risk'],
  failures: ['Design Too Small'],
  targetCanvasW: 4200,
  targetCanvasH: 4800,
  safeBorder: 6,
};

const cases = [];

function testCase(name, fn) {
  cases.push({ name, fn });
}

testCase('full match returns no diffs', () => {
  const diffs = compareSingleScanParity(baseSnapshot, { ...baseSnapshot });
  assert.deepEqual(diffs, []);
});

testCase('different confidence is reported', () => {
  const diffs = compareSingleScanParity(baseSnapshot, { ...baseSnapshot, printConfidence: 89 });
  assert.equal(diffs.length, 1);
  assert.equal(diffs[0].field, 'printConfidence');
});

testCase('different main issue is reported', () => {
  const diffs = compareSingleScanParity(baseSnapshot, { ...baseSnapshot, mainIssue: 'Off-Center Design' });
  assert.equal(diffs.length, 1);
  assert.equal(diffs[0].field, 'mainIssue');
});

testCase('warnings in a different order are reported', () => {
  const diffs = compareSingleScanParity(baseSnapshot, {
    ...baseSnapshot,
    warnings: ['Compression Artifact Risk', 'White Background Risk'],
  });
  assert.equal(diffs.length, 1);
  assert.equal(diffs[0].field, 'warnings');
});

testCase('missing warning is reported', () => {
  const diffs = compareSingleScanParity(baseSnapshot, {
    ...baseSnapshot,
    warnings: ['White Background Risk'],
  });
  assert.equal(diffs.length, 1);
  assert.equal(diffs[0].field, 'warnings');
});

testCase('different target dimensions are reported', () => {
  const diffs = compareSingleScanParity(baseSnapshot, {
    ...baseSnapshot,
    targetCanvasW: 3000,
    targetCanvasH: 4000,
  });
  assert.equal(diffs.length, 2);
  assert.deepEqual(
    diffs.map((diff) => diff.field).sort(),
    ['targetCanvasH', 'targetCanvasW'],
  );
});

(async () => {
  const failures = [];

  for (const entry of cases) {
    try {
      await entry.fn();
      console.log(`ok - ${entry.name}`);
    } catch (error) {
      failures.push({ name: entry.name, error });
      console.error(`not ok - ${entry.name}`);
      console.error(error && error.stack ? error.stack : error);
    }
  }

  console.log(`1..${cases.length}`);
  console.log(`# tests ${cases.length}`);
  console.log(`# pass ${cases.length - failures.length}`);
  console.log(`# fail ${failures.length}`);

  if (failures.length > 0) {
    process.exitCode = 1;
  }
})();
