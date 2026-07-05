import { analyzeSingleScan } from './singleScanAdapter';
import {
  buildSingleScanShadowLegacySnapshot,
  compareSingleScanParity,
  toSingleScanParitySnapshot,
  type SingleScanShadowSnapshotInput,
} from './singleScanParity';

export type SingleScanShadowParityInput = SingleScanShadowSnapshotInput;

export function logSingleScanShadowParity(input: SingleScanShadowParityInput): void {
  if (!input.file || !input.targetCanvasW || !input.targetCanvasH) return;

  const adapterResult = analyzeSingleScan({
    file: input.file,
    imageData: input.imageData,
    imgW: input.imgW,
    imgH: input.imgH,
    dpiMetadata: input.dpiMetadata,
    scanTimeMs: input.scanTimeMs,
    options: {
      targetCanvasW: input.targetCanvasW,
      targetCanvasH: input.targetCanvasH,
      safeBorder: input.safeBorder,
    },
  });

  const legacyParitySnapshot = buildSingleScanShadowLegacySnapshot(input);
  const adapterParitySnapshot = toSingleScanParitySnapshot(adapterResult);
  const parityDiffs = compareSingleScanParity(legacyParitySnapshot, adapterParitySnapshot);

  if (process.env.NODE_ENV === 'development' && parityDiffs.length > 0) {
    console.warn('[Single Scan Shadow] Adapter parity differences', parityDiffs);
  }
}
