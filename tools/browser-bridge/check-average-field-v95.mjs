import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2), values = new Map();
for (let i = 0; i < args.length; i += 2) {
  if (!args[i].startsWith('--') || !args[i + 1] || args[i + 1].startsWith('--')) throw Error('Expected --option value pairs.');
  if (values.has(args[i])) throw Error('Duplicate option ' + args[i]);
  values.set(args[i], args[i + 1]);
}
const allowed = ['--output', '--cases', '--seeds', '--parks', '--sides', '--variants', '--max-seconds'];
for (const key of values.keys()) if (!allowed.includes(key)) throw Error('Unknown option ' + key);
const list = (key, fallback) => (values.get(key) ?? fallback).split(',');
const request = {
  caseIds: list('--cases', 'RF_ground_pull,RF_ground_line,SS_ground'),
  seeds: list('--seeds', '711,2025').map(Number), parks: list('--parks', '110').map(Number),
  sides: list('--sides', 'R,L'), variants: list('--variants', 'baseline,throw_yaw_left,throw_yaw_right'),
  ...(values.has('--max-seconds') ? { maxPlaySeconds: Number(values.get('--max-seconds')) } : {}),
};
const output = resolve(values.get('--output') ?? 'docs/verification/releases/v95/average-field');
await mkdir(output, { recursive: true });
const sources = ['src/integration/browser/LiveFieldAverageHarnessV95.ts', 'src/integration/browser/LiveFieldInputV95.ts',
  'src/core/sim/fielding/LiveFieldPlayV1.ts', 'src/core/sim/fielding/LiveThrowDirectionV1.ts',
  'src/core/sim/fielding/LiveFieldPlayDiagnosticsV1.ts', 'src/core/sim/fielding/LiveDefenseControlEstimateV95.ts',
  'src/core/sim/running/LiveRunnerMotionV1.ts', 'src/core/sim/locomotion/LiveLocomotionV84.ts',
  'tools/browser-bridge/check-average-field-v95.mjs'];
const sourceSha256 = Object.fromEntries(await Promise.all(sources.map(async path => [path,
  createHash('sha256').update(await readFile(path)).digest('hex')])));
await writeFile(resolve(output, 'planned.json'), JSON.stringify({ status: 'PLANNED_NOT_COMPLETE', request, sourceSha256 }, null, 2) + '\n');
await writeFile(resolve(output, 'trials.ndjson'), '');
const bundled = await build({ entryPoints: ['src/integration/browser/LiveFieldAverageHarnessV95.ts'], bundle: true,
  write: false, format: 'cjs', platform: 'node', target: 'es2022', logLevel: 'silent' }), module = { exports: {} };
new Function('module', 'exports', 'require', bundled.outputFiles[0].text)(module, module.exports, createRequire(import.meta.url));
let attempted = 0;
const report = module.exports.runAverageFieldMatrixV95(request, trial => {
  attempted++;
  appendFileSync(resolve(output, 'trials.ndjson'), JSON.stringify(trial) + '\n');
  console.log(JSON.stringify({ attempted, caseId: trial.caseId, seed: trial.seed, bats: trial.bats,
    park: trial.parkRadiusMeters, variant: trial.variant, status: trial.status, end: trial.end?.reason,
    anomalies: trial.anomalies?.length, error: trial.error }));
});
const sourceSha256After = Object.fromEntries(await Promise.all(sources.map(async path => [path,
  createHash('sha256').update(await readFile(path)).digest('hex')])));
const sourceStable = JSON.stringify(sourceSha256) === JSON.stringify(sourceSha256After),
  structuralPass = report.structuralPass && sourceStable,
  bundleSha256 = createHash('sha256').update(bundled.outputFiles[0].text).digest('hex');
await writeFile(resolve(output, 'report.json'), JSON.stringify({ ...report, structuralPass, sourceStable, sourceSha256,
  sourceSha256After, bundleSha256 }, null, 2) + '\n');
await writeFile(resolve(output, 'summary.json'), JSON.stringify({ structuralPass,
  reviewRequired: report.reviewRequired,
  mlbCalibrationClaim: report.mlbCalibrationClaim, rfGroundOpportunityRateClaim: report.rfGroundOpportunityRateClaim,
  denominators: report.denominators, observations: report.observations, failures: report.failures, pairs: report.pairs,
  sourceStable, sourceSha256, sourceSha256After, bundleSha256 }, null, 2) + '\n');
console.log(JSON.stringify({ structuralPass, sourceStable, reviewRequired: report.reviewRequired, mlbCalibrationClaim: report.mlbCalibrationClaim,
  denominators: report.denominators, observations: report.observations, output }));
if (!structuralPass) process.exitCode = 1;
