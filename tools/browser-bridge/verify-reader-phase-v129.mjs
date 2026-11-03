import { readFileSync as read, writeFileSync as write } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = path => JSON.parse(read(path, 'utf8'));
const root = 'docs/verification/spin-trial-v124/';
const snapshot = json(root + 'source-snapshot-v129.json');
for (const [path, expected] of Object.entries(snapshot.inputs)) assert.equal(sha(read(path)), expected, path);
const passes = { readersAndRegressions: '88d38e0f7c274f12a34102520ad2c16b', type: 'da11f3db761b454abce39b9d92f819b5',
  artifactPreservation: '289c03d51cc24d99a33fde86096b786f' };
const failures = { originalEnrollmentRed: 'aec72a1b371c46408cf830aa31f5887a', originalDispatchRed: '24ef22ccb8404499afcc694873045a12',
  censusRed: '89e1c306834c4855b9d41b453689763f', censusReviewRed: '8a5ce76899fb43378d1804cba0a93aaf',
  native180Timeout: '5ada052915dd48598b96ca75cbdfeaa4', noIntentCpuCapture: 'ed170300c8d341b59cdfb96e0bf0175f',
  noPinnedIntentCpuCapture: '218bb9933a1746e2a7a9633422c628e9', intentionalSecondTakeCpuInterruption: '662d81eaf46746808a2d81418c97d214',
  censusNative180Timeout: '429180a77adb4d8283d5874397c510e2', intentionalLaunchCpuInterruption: '698530c514cc4d48ba9e704f47fb4406' };
for (const [status, entries] of [['PASS', passes], ['FAIL', failures]]) for (const [name, id] of Object.entries(entries)) {
  const receipt = json('docs/ai-continuity/verification-receipts/MB-20261026-TRAITS-SPIN-CONTINUATION-V123_' + id + '.json');
  assert.equal(receipt.task_id, 'MB-20261026-TRAITS-SPIN-CONTINUATION-V123', name);
  assert.equal(receipt.result, status, name); assert.equal(sha(read(receipt.output_path)), receipt.output_sha256, name);
  if (status === 'PASS') assert.equal(receipt.exit_code, 0, name);
  if (name === 'readersAndRegressions') assert.match(read(receipt.output_path, 'utf8'), /Tests\s+107 passed \(107\)/);
}
const summary = json(root + 'second-cut-pinned-cpu-v128-summary.json');
assert.equal(summary.capture.nativeAdmission, false);
assert.equal(sha(read(root + 'second-cut-pinned-cpu-v128/' + summary.file)), summary.sha256);
const launch = json(root + 'launch-cpu-v129-summary.json');
assert.equal(launch.capture.nativeAdmission, false);
assert.equal(sha(read(root + 'launch-cpu-v129/' + launch.file)), launch.sha256);
const preservation = json(root + 'preservation-v125.json');
assert.equal(preservation.pass, true); assert.equal(preservation.unchangedBrowserInputs, 195); assert.equal(preservation.protectedArtifacts, 15);
const scope = json('docs/verification/traits-spin-continuation-v123/IMPLEMENTATION-SCOPE.json');
assert.equal(scope.signature.currentScope, 'FOUNDATION_ONLY');
assert.equal(scope.signature.automaticNaming, 'DEFERRED_TO_PENNANT_IMPLEMENTATION');
const report = { pass: true, boundary: 'LIMITED_NATIVE_READER_COMPONENT_GATES_NOT_MATCH_CONTACT_ADOPTION',
  sourceSnapshot: 'source-snapshot-v129.json', listedSources: Object.keys(snapshot.inputs).length, passes, retainedFailures: failures,
  tests: 107, newCensusTests: 13, genericMetadataFreshReadUnchanged: true, nativeActorDefendersPreserved: 9,
  actualMatchAdoptionContactReplay: 'NOT_VERIFIED', wholeMatchPerformanceImprovement: 'NOT_VERIFIED',
  currentBrowserVersion: 124, unchangedBrowserInputs: 195, protectedArtifacts: 15,
  signatureAutomaticNaming: scope.signature.automaticNaming, postGoalMakerWork: 'QUEUED_BY_HUMAN_ORDER',
  sourceCommitPushMergeDeploy: false, goalComplete: false };
write(root + 'reader-phase-v129-integrity.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
