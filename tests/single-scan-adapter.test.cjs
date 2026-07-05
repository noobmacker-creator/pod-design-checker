const assert = require('node:assert/strict');
const createJiti = require('jiti');

const jiti = createJiti(__filename);

const { analyzeScanCore } = jiti('../app/lib/scanCore.ts');
const { analyzeSingleScan } = jiti('../app/lib/singleScanAdapter.ts');

function makeFixture(kind, width, height, artBounds = null) {
  return { kind, width, height, artBounds };
}

function makeGradientFixture(width, height, artBounds) {
  return makeFixture('gradient', width, height, artBounds);
}

function makeSolidWhiteFixture(width, height) {
  return makeFixture('solid-white', width, height, { x: 0, y: 0, w: width, h: height });
}

function makeImageDataFromFixture(fixture) {
  const data = new Uint8ClampedArray(fixture.width * fixture.height * 4);

  if (fixture.kind === 'solid-white') {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = 255;
    }
    return { width: fixture.width, height: fixture.height, data };
  }

  if (!fixture.artBounds) {
    return { width: fixture.width, height: fixture.height, data };
  }

  const { x, y, w, h } = fixture.artBounds;
  const splitX = x + Math.floor(w / 2);
  const dark = { r: 15, g: 25, b: 90, a: 255 };
  const bright = { r: 240, g: 220, b: 40, a: 255 };

  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      const idx = (py * fixture.width + px) * 4;
      const colour = px < splitX ? dark : bright;
      data[idx] = colour.r;
      data[idx + 1] = colour.g;
      data[idx + 2] = colour.b;
      data[idx + 3] = colour.a;
    }
  }

  return { width: fixture.width, height: fixture.height, data };
}

function makeInput(name, type, fixture, options) {
  const file = new File([new Uint8Array([1, 2, 3])], name, { type });
  return {
    file,
    imageData: makeImageDataFromFixture(fixture),
    imgW: fixture.width,
    imgH: fixture.height,
    dpiMetadata: null,
    scanTimeMs: 14,
    options,
  };
}

const cases = [];

function testCase(name, fn) {
  cases.push({ name, fn });
}

testCase('Ready design maps to the ready single-scan shape', () => {
  const input = makeInput(
    'ready.png',
    'image/png',
    makeGradientFixture(1200, 1200, { x: 200, y: 200, w: 800, h: 800 }),
  );

  const core = analyzeScanCore(input);
  const single = analyzeSingleScan(input);

  assert.equal(single.scanStatus, 'ready');
  assert.equal(single.riskLabel, 'READY');
  assert.equal(single.coreStatus, core.status);
  assert.equal(single.printConfidence, core.scanResult.printConfidence);
  assert.equal(single.mainIssue, core.scanResult.mainIssue);
  assert.equal(single.nextAction, core.scanResult.nextAction);
  assert.deepEqual(single.warnings, core.scanResult.warnings);
  assert.deepEqual(single.failures, core.scanResult.failures);
  assert.equal(single.targetCanvasW, 4200);
  assert.equal(single.targetCanvasH, 4800);
  assert.equal(single.safeBorder, 6);
});

testCase('Warning design maps to the warning single-scan shape', () => {
  const input = makeInput(
    'warning.png',
    'image/png',
    makeGradientFixture(1000, 1000, { x: 200, y: 200, w: 600, h: 600 }),
  );

  const core = analyzeScanCore(input);
  const single = analyzeSingleScan(input);

  assert.equal(single.scanStatus, 'warning');
  assert.equal(single.riskLabel, 'NEEDS REVIEW');
  assert.equal(single.coreStatus, core.status);
  assert.equal(single.printConfidence, core.scanResult.printConfidence);
  assert.equal(single.mainIssue, core.scanResult.mainIssue);
  assert.equal(single.nextAction, core.scanResult.nextAction);
  assert.deepEqual(single.warnings, core.scanResult.warnings);
  assert.deepEqual(single.failures, core.scanResult.failures);
  assert.ok(single.warnings.length > 0);
  assert.equal(single.failures.length, 0);
});

testCase('Failure design maps to the failure single-scan shape', () => {
  const input = makeInput('failure.png', 'image/png', makeSolidWhiteFixture(1000, 1000));

  const core = analyzeScanCore(input);
  const single = analyzeSingleScan(input);

  assert.equal(single.scanStatus, 'failure');
  assert.equal(single.riskLabel, 'HIGH RISK');
  assert.equal(single.coreStatus, core.status);
  assert.equal(single.printConfidence, core.scanResult.printConfidence);
  assert.equal(single.mainIssue, core.scanResult.mainIssue);
  assert.equal(single.nextAction, core.scanResult.nextAction);
  assert.deepEqual(single.warnings, core.scanResult.warnings);
  assert.deepEqual(single.failures, core.scanResult.failures);
  assert.ok(single.failures.length > 0);
});

testCase('Custom core options flow through the adapter', () => {
  const input = makeInput(
    'custom-target.png',
    'image/png',
    makeGradientFixture(1000, 1000, { x: 200, y: 200, w: 600, h: 600 }),
    { targetCanvasW: 1000, targetCanvasH: 1000, safeBorder: 12 },
  );

  const core = analyzeScanCore(input);
  const single = analyzeSingleScan(input);

  assert.equal(single.targetCanvasW, 1000);
  assert.equal(single.targetCanvasH, 1000);
  assert.equal(single.safeBorder, 12);
  assert.equal(single.scanStatus, 'ready');
  assert.equal(single.riskLabel, 'READY');
  assert.equal(single.coreStatus, core.status);
  assert.equal(single.printConfidence, core.scanResult.printConfidence);
  assert.deepEqual(single.scanResult, core.scanResult);
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
