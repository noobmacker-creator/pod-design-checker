const assert = require('node:assert/strict');
const createJiti = require('jiti');

const jiti = createJiti(__filename);

const {
  dedupeSingleScanChecks,
  mergeSingleScanDisplayChecks,
  runSingleScanVisibleSummaryFromFixedOutput,
  runSingleScanVisibleSummary,
} = jiti('../app/lib/singleScanDisplay.ts');

const baseSummary = {
  coreStatus: 'ready',
  scanStatus: 'ready',
  riskLabel: 'READY',
  printConfidence: 92,
  mainIssue: 'No major issue found.',
  nextAction: 'Download and upload.',
  warnings: [],
  failures: [],
  scanResult: {
    printConfidence: 92,
    mainIssue: 'No major issue found.',
    nextAction: 'Download and upload.',
    warnings: [],
    failures: [],
    scanTimeMs: 12,
  },
  targetCanvasW: 4200,
  targetCanvasH: 4800,
  safeBorder: 6,
};

const cases = [];

function testCase(name, fn) {
  cases.push({ name, fn });
}

testCase('shared scan helper calls the scanner once and returns its result', () => {
  let callCount = 0;
  const result = runSingleScanVisibleSummary(
    { file: null, imageData: {}, imgW: 1, imgH: 1, dpiMetadata: null, scanTimeMs: 0, options: {} },
    (input) => {
      callCount++;
      assert.equal(input.imgW, 1);
      return baseSummary;
    },
  );

  assert.equal(callCount, 1);
  assert.equal(result.printConfidence, baseSummary.printConfidence);
  assert.equal(result.mainIssue, baseSummary.mainIssue);
});

testCase('shared warnings and failures override overlapping labels once', () => {
  const merged = mergeSingleScanDisplayChecks(
    [
      { label: 'White Background Risk', status: 'pass', message: 'legacy pass' },
      { label: 'Tiny Text Risk', status: 'pass', message: 'single-only pass' },
      { label: 'White Background Risk', status: 'info', message: 'duplicate legacy label' },
      { label: 'Design Too Small', status: 'warn', message: 'legacy warn' },
    ],
    {
      warnings: ['White Background Risk'],
      failures: ['Design Too Small'],
    },
  );

  assert.deepEqual(merged, [
    { label: 'White Background Risk', status: 'warn', message: 'legacy pass' },
    { label: 'Tiny Text Risk', status: 'pass', message: 'single-only pass' },
    { label: 'Design Too Small', status: 'fail', message: 'legacy warn' },
  ]);
});

testCase('fixed output helper rescans once and replaces stale confidence', () => {
  let renderCount = 0;
  let scanCount = 0;

  const fixedSummary = runSingleScanVisibleSummaryFromFixedOutput(
    {
      file: new File([new Uint8Array([1, 2, 3])], 'auto-fix.png', { type: 'image/png' }),
      img: {},
      dpiMetadata: null,
      scanTimeMs: 0,
      options: {},
      outputWidth: 4200,
      outputHeight: 4800,
      transform: { scale: 1.25, offsetX: 18, offsetY: 22 },
      renderImageData: ({ width, height, transform }) => {
        renderCount++;
        assert.equal(width, 4200);
        assert.equal(height, 4800);
        assert.deepEqual(transform, { scale: 1.25, offsetX: 18, offsetY: 22 });
        return {
          width,
          height,
          data: new Uint8ClampedArray(width * height * 4),
        };
      },
    },
    (input) => {
      scanCount++;
      assert.equal(input.imgW, 4200);
      assert.equal(input.imgH, 4800);
      return {
        ...baseSummary,
        printConfidence: 97,
        mainIssue: 'No major issue found.',
        nextAction: 'Download and upload.',
        warnings: [],
        failures: [],
        scanResult: {
          ...baseSummary.scanResult,
          printConfidence: 97,
          mainIssue: 'No major issue found.',
          nextAction: 'Download and upload.',
          warnings: [],
          failures: [],
        },
      };
    },
  );

  assert.equal(renderCount, 1);
  assert.equal(scanCount, 1);
  assert.equal(fixedSummary.printConfidence, 97);
  assert.equal(fixedSummary.mainIssue, 'No major issue found.');
});

testCase('fixed output helper preserves remaining warnings and failures', () => {
  const fixedSummary = runSingleScanVisibleSummaryFromFixedOutput(
    {
      file: new File([new Uint8Array([1, 2, 3])], 'auto-fix-warning.png', { type: 'image/png' }),
      img: {},
      dpiMetadata: null,
      scanTimeMs: 0,
      options: {},
      outputWidth: 4200,
      outputHeight: 4800,
      transform: { scale: 1.1, offsetX: 0, offsetY: 0 },
      renderImageData: ({ width, height }) => ({
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4),
      }),
    },
    () => ({
      ...baseSummary,
      scanStatus: 'warning',
      riskLabel: 'NEEDS REVIEW',
      printConfidence: 84,
      mainIssue: 'Tiny Text Risk',
      nextAction: 'Review scan results',
      warnings: ['Tiny Text Risk'],
      failures: ['White Background Risk'],
      scanResult: {
        ...baseSummary.scanResult,
        printConfidence: 84,
        mainIssue: 'Tiny Text Risk',
        nextAction: 'Review scan results',
        warnings: ['Tiny Text Risk'],
        failures: ['White Background Risk'],
      },
    }),
  );

  assert.equal(fixedSummary.printConfidence, 84);
  assert.equal(fixedSummary.scanStatus, 'warning');
  assert.equal(fixedSummary.riskLabel, 'NEEDS REVIEW');
  assert.deepEqual(fixedSummary.warnings, ['Tiny Text Risk']);
  assert.deepEqual(fixedSummary.failures, ['White Background Risk']);
});

testCase('duplicate labels are removed while single-only labels stay in order', () => {
  const checks = dedupeSingleScanChecks([
    { label: 'White Background Risk', status: 'warn', message: 'shared warning' },
    { label: 'Tiny Text Risk', status: 'warn', message: 'single-only warning' },
    { label: 'White Background Risk', status: 'fail', message: 'duplicate shared warning' },
    { label: 'Pixelation Risk', status: 'warn', message: 'single-only warning' },
  ]);

  assert.deepEqual(
    checks.map((check) => check.label),
    ['White Background Risk', 'Tiny Text Risk', 'Pixelation Risk'],
  );
  assert.equal(checks[0].message, 'shared warning');
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
