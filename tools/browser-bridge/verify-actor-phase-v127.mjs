import { readFileSync as read, writeFileSync as write } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const sha = bytes => createHash('sha256').update(bytes).digest('hex'), json = path => JSON.parse(read(path, 'utf8'));
const root = 'docs/verification/spin-trial-v124/', snapshot = json(root + 'source-snapshot-v127-final.json');
for (const [path, expected] of Object.entries(snapshot.inputs)) assert.equal(sha(read(path)), expected, path);
const receipts = { guards: 'f7d6697672d64e1588aea648b38cde35', actorBinding: 'f3d26e37e2664037aa0c618250d004b6',
  missingBaseline: 'e79aca933ac34384bb45727cb8717391', type: '0b5af0f1d11843d286af969e4ab16b78',
  artifactPreservation: 'aacf181f54a9480791dbaca9836468b2' };
const failures = { originalNativeTimeout: '889444f31ab64b649780b3c7d76c4c99', qualifiedNativeTimeout: 'a8f2151f13e04b7f94d88b2c17c31c7e',
  guardNativeTimeout: '56e0018c26bf407aae469d4702154084', lightGuardNativeTimeout: '1d19f727f3474698b1ce7da696813362',
  stagedNativePartial: '50ef4883fe914d1291c90b6472a55d18', guardRed: 'fd0459f712824b71848c6e181656b12a',
  reviewRed: '396313bd06ba44638d324ff528afdb1c', cpuStartInterrupted: 'c605911dc4db4295886c5521aa7a5aea',
  cpuEnrollmentInterrupted: 'ba8d595de121408b9450b54eb0a77518', cpuFirstTakeInterrupted: 'c71ef454f68d4668879460a351bd9e0f',
  commandPathError: '60766217bf6547a68584f0c7c2e9fd1d' };
for (const [status, entries] of [['PASS', receipts], ['FAIL', failures]]) for (const [name, id] of Object.entries(entries)) {
  const receipt = json('docs/ai-continuity/verification-receipts/MB-20261026-TRAITS-SPIN-CONTINUATION-V123_' + id + '.json');
  assert.equal(receipt.result, status, name); assert.equal(sha(read(receipt.output_path)), receipt.output_sha256, name);
  if (status === 'PASS') assert.equal(receipt.exit_code, 0, name);
}
const stages = name => read(root + name, 'utf8').trim().split('\n').map(line => JSON.parse(line));
const actorStages = stages('actor-binding-v127.ASB127-stages.jsonl');
for (const name of ['native-actor-binding-ready', 'cross-scope-and-repertoire-rejected', 'closed-reopened-native-binding-ready']) {
  assert(actorStages.some(stage => stage.name === name), name);
}
for (let index = 0; index < 3; index++) assert(actorStages.some(stage => stage.name === 'native-actor-contact-settled-' + index));
const partialStages = stages('ordinary-staged-v127.SPN03-stages.jsonl');
assert(partialStages.some(stage => stage.name === 'native-action-calibrations-ready'));
assert(!partialStages.some(stage => stage.name === 'fixture-ready'));
for (const name of ['actor-start-cpu-v127', 'actor-enrollment-cpu-v127', 'actor-first-take-cpu-v127']) {
  const summary = json(root + name + '-summary.json'); assert.equal(summary.capture.nativeAdmission, false);
  assert.equal(sha(read(root + name + '/' + summary.file)), summary.sha256);
}
const scope = json('docs/verification/traits-spin-continuation-v123/IMPLEMENTATION-SCOPE.json');
assert.equal(scope.scopeQuestionsResolved, true); assert.equal(scope.signature.currentScope, 'FOUNDATION_ONLY');
assert.equal(scope.signature.automaticNaming, 'DEFERRED_TO_PENNANT_IMPLEMENTATION');
const preservation = json(root + 'preservation-v125.json');
assert.equal(preservation.pass, true); assert.equal(preservation.unchangedBrowserInputs, 195); assert.equal(preservation.protectedArtifacts, 15);
const report = { pass: true, boundary: 'SAME_ACTOR_PRE_ENROLLMENT_BINDING_AND_DB_REOPEN_NOT_MATCH_CONTACT_ADOPTION',
  sourceSnapshot: 'source-snapshot-v127-final.json', listedSources: Object.keys(snapshot.inputs).length,
  receipts, retainedFailures: failures, nativePracticeContacts: 3, qualifiedTechnique: 'BACKSPIN', defenders: 9,
  calibration: 'EXPLICIT_SYNTHETIC_FIXTURE_NOT_HUMAN_MASTERY_RATE', actorMatchAdoption: 'NOT_VERIFIED',
  wholeMatchPerformanceImprovement: 'NOT_VERIFIED', currentBrowserVersion: 124, unchangedBrowserInputs: 195,
  signatureAutomaticNaming: 'DEFERRED_TO_PENNANT_IMPLEMENTATION', sourceCommitPushMergeDeploy: false, goalComplete: false };
write(root + 'actor-phase-v127-integrity.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
