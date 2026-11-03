import { readFileSync as read, writeFileSync as write } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const sha = bytes => createHash('sha256').update(bytes).digest('hex'), json = path => JSON.parse(read(path, 'utf8'));
const root = 'docs/verification/spin-trial-v124/', snapshot = json(root + 'source-snapshot-v132.json');
for (const [path, expected] of Object.entries(snapshot.inputs)) assert.equal(sha(read(path)), expected, path);
const passes = { guard29: 'fb9f58c588e84125a2e1219d84e28409', nativeOrdinary: 'fe54f05a35524529b15a15dd8bdbb863',
  nativeQualified: 'c6074d7cee9b4b1fa5b23d3ad9601ab5', cohort100: 'f828fc236a4249bcaef5afe7233824ec',
  cohort300: '9f6b1681cf314da690f46ac65746d2e6', ablation: 'f85bc024bc3c480ba37bd3e7ed0096b7',
  finalType: 'f253cc8e75c64f3dbe98a2a34f8321e9', browserPreservation: 'c2f3bee5becf48aa84d422c59db69ff1' };
const failures = { originalOwnership: '592d0f53b2a2421f9136d79e68fe9a92', guardRed: '140120b0dc2f4249a98e0c034911c8b4',
  unusedImport: '7a1cd03e16c641dd9f3795ca078d4c4f', diagnosticVmEnvironment: 'dbc4454bcd86490db633a1d2e074ec8b' };
for (const [status, entries] of [['PASS', passes], ['FAIL', failures]]) for (const [name, id] of Object.entries(entries)) {
  const r = json('docs/ai-continuity/verification-receipts/MB-20261026-TRAITS-SPIN-CONTINUATION-V123_' + id + '.json');
  assert.equal(r.result, status, name); assert.equal(sha(read(r.output_path)), r.output_sha256, name);
  if (status === 'PASS') assert.equal(r.exit_code, 0, name);
  if (['nativeOrdinary', 'nativeQualified', 'ablation'].includes(name)) assert.match(read(r.output_path, 'utf8'), /Tests\s+1 passed \(1\)/);
  if (name === 'guard29') assert.match(read(r.output_path, 'utf8'), /Tests\s+29 passed \(29\)/);
}
const preserved = json(root + 'preservation-v125.json');
assert.equal(preserved.pass, true); assert.equal(preserved.unchangedBrowserInputs, 195); assert.equal(preserved.protectedArtifacts, 15);
const ablation = json('docs/verification/post-goal-maker-spray-v122/ablation-user-inside-01/summary.json');
assert.equal(ablation.baselinePassed, true); assert.equal(ablation.executions, 7);
assert.equal(ablation.observations.length, 7); assert.equal(new Set(ablation.observations.map(r => r.sourceDescriptorSha256)).size, 1);
const scope = json('docs/verification/traits-spin-continuation-v123/IMPLEMENTATION-SCOPE.json');
assert.equal(scope.signature.currentScope, 'FOUNDATION_ONLY');
assert.equal(scope.signature.automaticNaming, 'DEFERRED_TO_PENNANT_IMPLEMENTATION');
const report = { pass: true, boundary: 'LISTED_COMPONENTS_TWO_NATIVE_IN_FLIGHT_GATES_AND_PRIVATE_DIAGNOSIS_NOT_WHOLE_GOAL',
  sourceSnapshot: 'source-snapshot-v132.json', listedSources: Object.keys(snapshot.inputs).length, passes, retainedFailures: failures,
  nativeNoSpinAdoptionContactProviderlessReplay: 'PASS', nativeQualifiedBackspinSelectionContactProviderlessReplay: 'PASS',
  allConnectionsClosedProcessRestartTest: false, nativeFirstPitchAdoption: 'NOT_VERIFIED',
  cohortBoundary: 'SYNTHETIC_AUTHOR_PROTOCOL_ONLY', naturalMasteryRateCalibrated: false,
  ablationBoundary: 'EXACT_JSON_BASELINE_THEN_SEVEN_LOCAL_COUNTERFACTUALS_NOT_PRODUCT_FIX',
  currentBrowserVersion: 124, protectedArtifacts: 15, unchangedBrowserInputs: 195,
  normalObservationBudgetMs: 180000, functionalNativeBudgetMs: 1200000, performancePass: false,
  sourceCommitPushMergeDeploy: false, goalComplete: false };
write(root + 'native-spin-v132-integrity.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
