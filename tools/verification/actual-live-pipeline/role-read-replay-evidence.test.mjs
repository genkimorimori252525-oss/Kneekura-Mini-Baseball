import assert from 'node:assert/strict';
import test from 'node:test';
import { assertRoleReadReplayInput, assertRoleReadReplayEvidence } from './role-read-replay-evidence.mjs';
import { assertReplayedRoleEvidence, assertReplayedRoleStageProvenance } from './inherited-role-evidence.mjs';
import { fixture, inputFixture, clone, digest, CHANGES } from './role-read-replay-fixture.test-support.mjs';

test('invented original role provenance remains complete and independently admissible', () => {
  const x = fixture(); assert.doesNotThrow(() => assertReplayedRoleStageProvenance(x.roleEvidence));
  assert.equal(x.config.expectedSettlementSha256, digest(x.roleEvidence.roleReceipt.settlement));
});
test('ordinary role-to-next equality still rejects the proposed four-file transition', () => {
  assert.throws(() => assertReplayedRoleEvidence(fixture().roleEvidence), /production Source continuity/);
});
test('admits the exact bounded role-read input without executing any helper', () => assert.doesNotThrow(() => assertRoleReadReplayInput(inputFixture())));
test('admits two role-read observations matching the sealed settlement DTO', () => assert.doesNotThrow(() => assertRoleReadReplayEvidence(fixture())));
const reject = (route, name, mutate) => test(`${route} rejects ${name}`, () => {
  const x = route === 'input' ? inputFixture() : fixture(), before = clone(x); mutate(x);
  x.roleEvidence.config = clone(x.config); x.roleEvidence.currentSourceManifest = clone(x.currentSourceManifest);
  assert.notDeepStrictEqual(x, before, 'rejection must change its fixture');
  assert.throws(() => route === 'input' ? assertRoleReadReplayInput(x) : assertRoleReadReplayEvidence(x));
});
for (const route of ['input', 'receipt']) {
  reject(route, 'an unsupported transition purpose', x => { x.config.roleSourceTransition.purpose = 'unreviewed'; });
  reject(route, 'a missing reviewed production file', x => { x.config.roleSourceTransition.changedProductionFiles.pop(); });
  reject(route, 'an additional production file', x => { x.currentSourceManifest.files.push({ path: 'src/unrelated-current-owner.ts', sha256: '0'.repeat(64) }); });
  reject(route, 'a repinned unreviewed after hash', x => {
    const row = x.config.roleSourceTransition.changedProductionFiles[0]; row.afterSha256 = '0'.repeat(64);
    x.currentSourceManifest.files.find(value => value.path === row.path).sha256 = row.afterSha256;
  });
  reject(route, 'a different original role Source', x => { x.config.roleSourceTransition.fromSourceIdentity.sourceCommit = '0'.repeat(40); });
  reject(route, 'a false original role INSERT witness', x => { x.roleEvidence.roleReceipt.faultEvidence.workloadAfterInsert = false; });
  reject(route, 'a changed original official/replay binding', x => { x.roleEvidence.readReplayEvidence.receipt.originalOfficialBinding.files.receipt.sha256 = '0'.repeat(64); });
  reject(route, 'an unobserved current Source', x => { x.observed.currentSourceFilesUnchanged = false; });
  reject(route, 'a missing sealed settlement digest', x => { delete x.config.expectedSettlementSha256; });
  reject(route, 'a wrong digest despite complete role JSON', x => { x.config.expectedSettlementSha256 = '0'.repeat(64); });
  reject(route, 'changed observed control bytes', x => { x.observed.controlHashes.launcher = '0'.repeat(64); });
}
for (const field of ['receipt', 'stageTerminal', 'supervisorTerminal', 'outerTerminal', 'replayConfig', 'replaySourceManifest'])
  reject('receipt', `a publication projection replacing ${field}`, x => { x[field].publicationProjection = true; });
reject('receipt', 'a foreign role binding in the replay receipt', x => { x.receipt.originalRoleBinding.files.receipt.sha256 = '0'.repeat(64); });
reject('receipt', 'an inherited role fault relabeled as newly executed', x => { x.receipt.newlyExecutedDomainFaults = ['workloadAfterInsert']; });
reject('receipt', 'a changed settlement even when both pass digests are repinned', x => {
  for (const pass of x.receipt.passes) { pass.observation.settlement.participants[0].after.fatigue += 0.1; pass.observationSha256 = digest(pass.observation); }
});
reject('receipt', 'a missing original participant', x => { x.receipt.passes[0].observation.settlement.participants.pop(); });
reject('receipt', 'a changed durable assessment snapshot', x => { x.receipt.passes[0].observation.settlement.assessmentHashes[0].hash = '0'.repeat(64); });
reject('receipt', 'an unapplied role effect', x => { x.receipt.passes[0].observation.settlement.participants[0].applied = false; });
reject('receipt', 'a changed current head', x => { x.receipt.passes[0].observation.currentHeads[0].revision++; });
reject('receipt', 'a changed playable workload census', x => { x.receipt.passes[0].observation.artifact.rowCounts.world_player_workload_activities++; });
reject('receipt', 'a nonempty artifact WAL', x => { x.observed.artifactWalBytes = 1; });
reject('receipt', 'a wrong independently observed artifact hash', x => { x.observed.artifactSha256 = '0'.repeat(64); });
reject('receipt', 'a changed replay byte pin', x => { x.observed.hashes.receipt = '0'.repeat(64); });
reject('receipt', 'a wrong pass observation digest', x => { x.receipt.passes[0].observationSha256 = '0'.repeat(64); });
reject('receipt', 'a reused connection', x => { x.receipt.passes[1].connectionId = x.receipt.passes[0].connectionId; });
reject('receipt', 'an open transaction', x => { x.receipt.passes[0].transactionClosed = false; });
reject('receipt', 'an open connection', x => { x.receipt.passes[1].connectionClosed = false; });
reject('receipt', 'a role write', x => { x.receipt.passes[0].totalChanges = 1; });
reject('receipt', 'a new next helper', x => { x.receipt.executed.nextHelperCalls = 1; });
reject('receipt', 'a false preservation flag', x => { x.receipt.checks.originalEvidenceUnchanged = false; });
reject('receipt', 'a missing actual supervisor exit', x => { delete x.outerTerminal.supervisorExitCode; });
reject('receipt', 'an unreaped process group', x => { x.outerTerminal.remainingExecutionGroup = [123]; });
reject('receipt', 'a missing supervisor receipt audit', x => { x.supervisorTerminal.sourceInputAndReceiptAudit.preservedPhaseReceipts = []; });
reject('receipt', 'the role effect counted as a fresh helper', x => { x.stageTerminal.counts.roleCompleted = 1; });
reject('receipt', 'a different review-only consumer production hash', x => {
  x.currentSourceManifest.files.find(row => row.path === CHANGES[1].path).sha256 = '0'.repeat(64);
});
