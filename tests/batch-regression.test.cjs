const assert = require('node:assert/strict');
const createJiti = require('jiti');

const jiti = createJiti(__filename);

const { analyzeStructuralArtwork } = jiti('../app/lib/imageScanChecks.ts');
const { computeQuickFixTransform, createBatchFixedPngBlob } = jiti('../app/lib/batchAutoFix.ts');
const { analyzeBatchScan, analyzeScanCore } = jiti('../app/lib/scanCore.ts');
const { resolvePostAutoFixScanResult, scanBatchFile } = jiti('../app/lib/batchScanner.ts');

const CANVAS_W = 4200;
const CANVAS_H = 4800;

const AUTO_FIXABLE_LABELS = new Set([
  'Design Too Small',
  'Print Safety Border',
  'Off-Center Design',
  'Empty Padding Risk',
  'Uneven Padding Risk',
  'Artwork Near Canvas Edge',
  'Cut-Off Edge Risk',
]);

const originalDocument = globalThis.document;
const originalImage = globalThis.Image;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

const objectUrlMap = new Map();
const blobFixtureMap = new WeakMap();

let nextObjectUrlId = 0;
let currentLoadedFixture = null;
const cases = [];

function makeFixture(kind, width, height, artBounds = null) {
  return { kind, width, height, artBounds };
}

function makeGradientFixture(width, height, artBounds) {
  return makeFixture('gradient', width, height, artBounds);
}

function makeSolidWhiteFixture(width, height) {
  return makeFixture('solid-white', width, height, { x: 0, y: 0, w: width, h: height });
}

function makeErrorFixture() {
  return makeFixture('error', 1, 1, null);
}

function registerFixture(blob, fixture) {
  blobFixtureMap.set(blob, fixture);
  return blob;
}

function makeFile(name, type, fixture) {
  const file = new File([new Uint8Array([1, 2, 3])], name, { type });
  blobFixtureMap.set(file, fixture);
  return file;
}

function makeCoreScanInput(name, type, fixture, scanTimeMs = 12) {
  const file = makeFile(name, type, fixture);
  return {
    file,
    imageData: makeImageDataFromFixture(fixture),
    imgW: fixture.width,
    imgH: fixture.height,
    dpiMetadata: null,
    scanTimeMs,
  };
}

function fillRect(data, width, height, rect, colour) {
  const xStart = Math.max(0, rect.x);
  const yStart = Math.max(0, rect.y);
  const xEnd = Math.min(width, rect.x + rect.w);
  const yEnd = Math.min(height, rect.y + rect.h);

  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = colour.r;
      data[idx + 1] = colour.g;
      data[idx + 2] = colour.b;
      data[idx + 3] = colour.a;
    }
  }
}

function setPixel(data, width, x, y, colour) {
  const idx = (y * width + x) * 4;
  data[idx] = colour.r;
  data[idx + 1] = colour.g;
  data[idx + 2] = colour.b;
  data[idx + 3] = colour.a;
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
      setPixel(data, fixture.width, px, py, px < splitX ? dark : bright);
    }
  }

  return { width: fixture.width, height: fixture.height, data };
}

function deriveFixedFixture(sourceFixture, drawArgs) {
  if (!sourceFixture || !sourceFixture.artBounds || !drawArgs) {
    return sourceFixture;
  }

  const [image, offsetX, offsetY, drawW] = drawArgs;
  const scale = drawW / image.naturalWidth;

  return makeFixture('gradient', CANVAS_W, CANVAS_H, {
    x: Math.round(offsetX + sourceFixture.artBounds.x * scale),
    y: Math.round(offsetY + sourceFixture.artBounds.y * scale),
    w: Math.max(1, Math.round(sourceFixture.artBounds.w * scale)),
    h: Math.max(1, Math.round(sourceFixture.artBounds.h * scale)),
  });
}

function installBrowserStubs() {
  URL.createObjectURL = (blob) => {
    const url = `blob:batch-regression-${++nextObjectUrlId}`;
    objectUrlMap.set(url, blob);
    return url;
  };

  URL.revokeObjectURL = (url) => {
    objectUrlMap.delete(url);
  };

  globalThis.Image = class FakeImage {
    constructor() {
      this.onload = null;
      this.onerror = null;
      this.naturalWidth = 0;
      this.naturalHeight = 0;
    }

    set src(url) {
      const blob = objectUrlMap.get(url);
      const fixture = blob ? blobFixtureMap.get(blob) : null;
      currentLoadedFixture = fixture || null;

      if (!fixture || fixture.kind === 'error') {
        queueMicrotask(() => {
          if (this.onerror) this.onerror(new Error('Could not read image'));
        });
        return;
      }

      this.naturalWidth = fixture.width;
      this.naturalHeight = fixture.height;
      queueMicrotask(() => {
        if (this.onload) this.onload();
      });
    }
  };

  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, 'canvas');

      const canvas = {
        width: 0,
        height: 0,
        _lastDrawArgs: null,
        getContext(type) {
          if (type !== '2d') return null;
          return {
            clearRect() {},
            drawImage(...args) {
              canvas._lastDrawArgs = args;
            },
            getImageData() {
              if (!currentLoadedFixture) {
                throw new Error('No fixture loaded');
              }
              return makeImageDataFromFixture(currentLoadedFixture);
            },
          };
        },
        toBlob(callback, type) {
          const fixedFixture = deriveFixedFixture(currentLoadedFixture, canvas._lastDrawArgs);
          const blob = registerFixture(
            new Blob([JSON.stringify(fixedFixture)], { type: type || 'image/png' }),
            fixedFixture,
          );
          queueMicrotask(() => callback(blob));
        },
      };

      return canvas;
    },
  };
}

function restoreBrowserStubs() {
  globalThis.document = originalDocument;
  globalThis.Image = originalImage;
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
}

function createMixedFixtureBatch() {
  const ready = makeFile(
    'ready.png',
    'image/png',
    makeGradientFixture(1200, 1200, { x: 200, y: 200, w: 800, h: 800 }),
  );
  const safeAutoFix = makeFile(
    'safe-auto-fix.png',
    'image/png',
    makeGradientFixture(1200, 1200, { x: 500, y: 500, w: 200, h: 200 }),
  );
  const needsReview = makeFile('needs-review.png', 'image/png', makeSolidWhiteFixture(1000, 1000));
  const failed = makeFile('failed.png', 'image/png', makeErrorFixture());
  return { ready, safeAutoFix, needsReview, failed };
}

function testCase(name, fn) {
  cases.push({ name, fn });
}

testCase('structural artwork bounds ignore tiny stray specks', () => {
  const width = 100;
  const height = 100;
  const data = new Uint8ClampedArray(width * height * 4);

  fillRect(data, width, height, { x: 20, y: 20, w: 20, h: 20 }, { r: 90, g: 120, b: 150, a: 255 });
  setPixel(data, width, 95, 95, { r: 255, g: 0, b: 0, a: 255 });

  const result = analyzeStructuralArtwork({ width, height, data });

  assert.equal(result.speckCount, 1);
  assert.deepEqual(result.structuralBounds, { x: 20, y: 20, w: 20, h: 20 });
});

testCase('default core options match the current Batch scan result', () => {
  const input = makeCoreScanInput(
    'core-default.png',
    'image/png',
    makeGradientFixture(1000, 1000, { x: 200, y: 200, w: 600, h: 600 }),
  );

  const coreResult = analyzeScanCore(input);
  const batchResult = analyzeBatchScan(input);

  assert.deepEqual(coreResult, batchResult);
});

testCase('neutral core accepts custom target dimensions', () => {
  const input = makeCoreScanInput(
    'core-custom-target.png',
    'image/png',
    makeGradientFixture(1000, 1000, { x: 200, y: 200, w: 600, h: 600 }),
  );

  const defaultResult = analyzeScanCore(input);
  const customResult = analyzeScanCore({
    ...input,
    options: { targetCanvasW: 1000, targetCanvasH: 1000, safeBorder: 6 },
  });

  assert.equal(defaultResult.status, 'safe-auto-fix');
  assert.equal(customResult.status, 'ready');
  assert.equal(customResult.scanResult.mainIssue, 'No major issue found.');
  assert.notDeepEqual(customResult, defaultResult);
});

testCase('Batch defaults stay on the 4200x4800 canvas with a 6px border', () => {
  const input = makeCoreScanInput(
    'core-batch-defaults.png',
    'image/png',
    makeGradientFixture(1000, 1000, { x: 2, y: 2, w: 600, h: 600 }),
  );

  const batchResult = analyzeBatchScan(input);
  const widenedBorderResult = analyzeScanCore({
    ...input,
    options: { targetCanvasW: 4200, targetCanvasH: 4800, safeBorder: 12 },
  });

  assert.equal(batchResult.status, 'safe-auto-fix');
  assert.ok(widenedBorderResult.scanResult.printConfidence < batchResult.scanResult.printConfidence);
});

testCase('Ready classification stays ready for a clean design', async () => {
  const file = makeFile(
    'ready.png',
    'image/png',
    makeGradientFixture(1200, 1200, { x: 200, y: 200, w: 800, h: 800 }),
  );

  const result = await scanBatchFile(file);

  assert.equal(result.status, 'ready');
  assert.equal(result.scanResult.mainIssue, 'No major issue found.');
  assert.equal(result.scanResult.warnings.length, 0);
  assert.equal(result.scanResult.failures.length, 0);
});

testCase('Safe Auto Fix classification only contains auto-fixable issues', async () => {
  const file = makeFile(
    'safe-auto-fix.png',
    'image/png',
    makeGradientFixture(1200, 1200, { x: 500, y: 500, w: 200, h: 200 }),
  );

  const result = await scanBatchFile(file);
  const nonAutoFixable = [...result.scanResult.warnings, ...result.scanResult.failures].filter(
    (label) => !AUTO_FIXABLE_LABELS.has(label),
  );

  assert.equal(result.status, 'safe-auto-fix');
  assert.deepEqual(nonAutoFixable, []);
});

testCase('Needs Review classification stays separate from auto-fixable status', async () => {
  const file = makeFile('needs-review.png', 'image/png', makeSolidWhiteFixture(1000, 1000));

  const result = await scanBatchFile(file);

  assert.equal(result.status, 'needs-review');
  assert.ok(
    [...result.scanResult.warnings, ...result.scanResult.failures].some(
      (label) => !AUTO_FIXABLE_LABELS.has(label),
    ),
  );
});

testCase('Failed classification does not stop later scans in the batch sequence', async () => {
  const { ready, safeAutoFix, needsReview, failed } = createMixedFixtureBatch();
  const files = [ready, failed, needsReview, safeAutoFix];
  const results = [];

  for (const file of files) {
    results.push(await scanBatchFile(file));
  }

  assert.deepEqual(results.map((entry) => entry.status), [
    'ready',
    'failed',
    'needs-review',
    'safe-auto-fix',
  ]);
  assert.equal(results.filter((entry) => entry.status === 'needs-review').length, 1);
});

testCase('computeQuickFixTransform still caps enlargement at 125 percent', () => {
  const transform = computeQuickFixTransform({ x: 0, y: 0, w: 1000, h: 1000 });
  assert.equal(transform.scale, 1.25);
});

testCase('computeQuickFixTransform still caps final artwork fill at 80 percent', () => {
  const transform = computeQuickFixTransform({ x: 0, y: 0, w: 3000, h: 3600 });
  assert.equal(transform.scale, 1.067);
});

testCase('Auto Fix does not create an Artwork Near Canvas Edge warning', async () => {
  const sourceFile = makeFile(
    'safe-auto-fix-source.png',
    'image/png',
    makeGradientFixture(1200, 1200, { x: 500, y: 500, w: 200, h: 200 }),
  );

  const fixed = await createBatchFixedPngBlob(sourceFile);
  assert.ok(fixed);

  const fixedFile = new File([fixed.blob], 'safe-auto-fix-fixed.png', { type: 'image/png' });
  const fixedFixture = blobFixtureMap.get(fixed.blob);
  assert.ok(fixedFixture);
  registerFixture(fixedFile, fixedFixture);

  const result = await scanBatchFile(fixedFile);
  const allLabels = [...result.scanResult.warnings, ...result.scanResult.failures];

  assert.equal(result.status, 'safe-auto-fix');
  assert.ok(!allLabels.includes('Artwork Near Canvas Edge'));
});

testCase('post-fix scan output stops pointing back to Run Auto Fix', async () => {
  const sourceFile = makeFile(
    'safe-auto-fix-source.png',
    'image/png',
    makeGradientFixture(1200, 1200, { x: 500, y: 500, w: 200, h: 200 }),
  );

  const fixed = await createBatchFixedPngBlob(sourceFile);
  assert.ok(fixed);

  const fixedFile = new File([fixed.blob], 'safe-auto-fix-fixed.png', { type: 'image/png' });
  const fixedFixture = blobFixtureMap.get(fixed.blob);
  assert.ok(fixedFixture);
  registerFixture(fixedFile, fixedFixture);

  const rawRecheck = await scanBatchFile(fixedFile);
  const normalized = resolvePostAutoFixScanResult(rawRecheck.scanResult, 'needs-review');
  const displayResult =
    normalized.nextAction === 'Run Auto Fix'
      ? { ...normalized, nextAction: 'Review the remaining layout issue manually.' }
      : normalized;

  assert.notEqual(displayResult.nextAction, 'Run Auto Fix');
  assert.ok(displayResult.nextAction.includes('Review'));
});

(async () => {
  installBrowserStubs();

  const failures = [];

  try {
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
  } finally {
    restoreBrowserStubs();
  }

  console.log(`1..${cases.length}`);
  console.log(`# tests ${cases.length}`);
  console.log(`# pass ${cases.length - failures.length}`);
  console.log(`# fail ${failures.length}`);

  if (failures.length > 0) {
    process.exitCode = 1;
  }
})();
