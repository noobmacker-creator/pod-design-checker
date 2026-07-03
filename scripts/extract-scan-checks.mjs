import fs from 'fs';

const src = fs.readFileSync('app/page.tsx', 'utf8');
const start = src.indexOf('function detectStraySpecks');
const end = src.indexOf('export default function Page()');
let chunk = src.slice(start, end);

chunk = chunk.replace(/^function detectStraySpecks/m, 'export function detectStraySpecks');

const funcs = [
  'getWhiteEdgeHaloCheck',
  'getSemiTransparencyRiskCheck',
  'getCutOffEdgeRiskCheck',
  'getLowContrastRiskCheck',
  'getTinyTextRiskCheck',
  'getCompressionArtifactRiskCheck',
  'getEmptyPaddingRiskCheck',
  'getPixelationRiskCheck',
  'getUnevenPaddingRiskCheck',
  'getOversizedArtworkRiskCheck',
  'getSolidBackgroundBoxRiskCheck',
];

for (const f of funcs) {
  chunk = chunk.replace(new RegExp(`^function ${f}`, 'm'), `export function ${f}`);
}

const testStart = chunk.indexOf('type StraySpeckTestResult');
const testEnd = chunk.indexOf('if (typeof window');
if (testStart >= 0 && testEnd >= 0) {
  chunk = chunk.slice(0, testStart) + chunk.slice(testEnd);
}

const header = "import type { CheckItem, CheckStatus } from './podCheckerTypes';\n\n";
fs.writeFileSync('app/lib/imageScanChecks.ts', header + chunk.trim() + '\n');
console.log('written app/lib/imageScanChecks.ts');
