import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, readlinkSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { actorHash as hash } from '../../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualFirstBaseClosedEvidenceFromSqlite } from '../../../src/host/world/SqliteActualFirstBasePlayEndStore';
import { battedWorldFieldEvidenceFromSqlite } from '../../../src/host/world/SqliteBattedWorldFieldStore';
import { withSqliteReadTransaction } from '../../../src/host/world/SqliteReadTransaction.test-support';
import { getRuleProfile, NPB_2026_RULE_PROFILE } from '../../../src/core/rules/RuleProfile';
import { verifyActualLiveOfficialArtifact } from '../../../src/host/world/ActualLiveOfficialArtifact.test-support';
import { verifyActualRoleWorkloadArtifact } from '../../../src/host/world/ActualRoleWorkloadArtifact.test-support';
import { verifyActualLiveNextActorArtifact } from '../../../src/host/world/ActualLiveNextActorArtifact.test-support';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fileHash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const pinnedJson = (path: string, expectedHash: string) => {
  const bytes = readFileSync(path), sha256 = createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha256, expectedHash, 'preceding fresh JSON pin differs');
  return { value: JSON.parse(bytes.toString('utf8')), sha256 };
};
const inputPath = process.env.BASEBALL_FRESH_INPUT_MANIFEST!, expected = process.env.BASEBALL_FRESH_INPUT_SHA256!;
const m = pinnedJson(inputPath, expected).value;
assert.equal(m.schema, 'fresh_published_closed_continuation_input_v1');
assert.deepEqual(m.origin, { kind: 'published_closed_snapshot', notRawProducerAdmission: true, historicalReceiptsInherited: false });
assert.equal(hash(getRuleProfile(NPB_2026_RULE_PROFILE.id)), m.ruleProfileSha256);
const phase = process.env.BASEBALL_FRESH_PHASE!, directory = resolve(process.env.BASEBALL_FRESH_OUTPUT!);
const freshRead = (name: string) => {
  const path = join(directory, `${name}-receipt.json`), captured = pinnedJson(path, process.env.BASEBALL_FRESH_PREDECESSOR_RECEIPT_SHA256!);
  const receipt = captured.value;
  assert.equal(receipt.schema, 'fresh_closed_input_phase_receipt_v1'); assert.equal(receipt.phase, name);
  assert.equal(receipt.inputManifestSha256, expected); assert.equal(receipt.sourceCommit, m.sourceCommit);
  assert.equal(receipt.historicalReceiptsInherited, false); assert.equal(receipt.originalConstructionProven, false);
  return { path, receipt, sha256: captured.sha256 };
};
const closed = (path: string) => {
  assert(!existsSync(`${path}-wal`) || statSync(`${path}-wal`).size === 0, 'nonempty WAL');
  assert.deepEqual(readdirSync('/proc/self/fd').flatMap(fd => {
    try { const target = readlinkSync(`/proc/self/fd/${fd}`); return [path, `${path}-wal`, `${path}-shm`].includes(target) ? [target] : []; }
    catch { return []; }
  }), [], 'SQLite handles remain open');
};
const progress = (message: string) => console.info(phase, message);
let result: unknown, sourcePath = m.input.path, predecessorReceiptSha256: string | null = null;
if (phase === 'reauthenticate') {
  assert.equal(fileHash(sourcePath), m.input.sha256); closed(sourcePath);
  const captured = pinnedJson(join(directory, 'raw-preflight.json'), process.env.BASEBALL_FRESH_PREDECESSOR_RECEIPT_SHA256!);
  const raw = captured.value; predecessorReceiptSha256 = captured.sha256;
  assert.equal(raw.inputManifestSha256, expected); assert.equal(raw.nativeReauthenticated, false);
  const db = new DatabaseSync(sourcePath, { readOnly: true });
  try {
    result = withSqliteReadTransaction(db, () => {
      const end = actualFirstBaseClosedEvidenceFromSqlite(db).read(m.physicalEndSourceId); assert(end);
      const field = battedWorldFieldEvidenceFromSqlite(db).read(end.source.baseFieldSourceId); assert(field);
      const frame = field.response.touch.worldContact.flight.physicalPitch.frame;
      assert.equal(frame.match.ruleProfileId, 'npb-2026'); assert.equal(frame.match.playId, 7);
      assert.equal(frame.batterActor!.binding.playerId, 'away-1');
      return { physicalEndSourceId: end.source.sourceId, gameId: end.gameId, playId: end.playId,
        nativePersistedEndReauthenticated: true, nativeEndHash: hash(end), registeredRuleProfileId: frame.match.ruleProfileId };
    });
  } finally { db.close(); }
} else if (phase === 'official') {
  const prior = freshRead('reauthenticate'); predecessorReceiptSha256 = prior.sha256;
  assert.equal(prior.receipt.result.nativePersistedEndReauthenticated, true);
  result = await verifyActualLiveOfficialArtifact({ sourcePath, destinationPath: join(directory, 'official.sqlite'),
    physicalEndSourceId: m.physicalEndSourceId, faultChecks: true, progress });
  const r = result as Awaited<ReturnType<typeof verifyActualLiveOfficialArtifact>>;
  assert.deepEqual(r.faultEvidence, { adjudicationDependencyAfterInsert: true, officialApplicationAfterInsert: true });
  assert.equal(r.allConnectionsClosedReopened, true); assert.equal(r.exactlyOnceOfficialApplication, true);
} else if (phase === 'role') {
  const prior = freshRead('official'); predecessorReceiptSha256 = prior.sha256;
  sourcePath = prior.receipt.result.destinationPath; assert.equal(fileHash(sourcePath), prior.receipt.result.destinationSha256);
  result = await verifyActualRoleWorkloadArtifact({ sourcePath, destinationPath: join(directory, 'role.sqlite'),
    closureSourceId: prior.receipt.result.closureSourceId, faultChecks: true, progress });
  const r = result as Awaited<ReturnType<typeof verifyActualRoleWorkloadArtifact>>;
  assert.equal(r.settlement.kind, 'complete'); assert.equal(r.participantCount, 10); assert.equal(r.exactlyOnce, true);
  assert.equal(r.playableArtifactRecoveryActivities, 0); assert.equal(r.playableHeadsEqualFrozenAfter, true);
  assert.deepEqual(r.acceptedInputManifest.assessments.map(a => a.effortUnits), m.fixtureInputs.roleEffortUnits);
  assert.deepEqual(r.faultEvidence, { assessmentAfterInsert: true, freezeAfterInsert: true, workloadAfterInsert: true,
    staleCurrentHeadRejected: true, interruptedAfterFirstInsert: true });
} else if (phase === 'next') {
  const prior = freshRead('role'); predecessorReceiptSha256 = prior.sha256;
  sourcePath = prior.receipt.result.destinationPath; assert.equal(fileHash(sourcePath), prior.receipt.result.destinationSha256);
  result = await verifyActualLiveNextActorArtifact({ sourcePath, destinationPath: join(directory, 'next.sqlite'),
    closureSourceId: prior.receipt.result.settlement.closureSourceId, nextBatterPlayerId: m.nextBatterPlayerId,
    executeNextPitch: true, nextTake: m.nextTake, faultChecks: true, progress });
  const r = result as Awaited<ReturnType<typeof verifyActualLiveNextActorArtifact>>;
  assert.equal(r.actor!.source.playerId, 'away-2'); assert.equal(r.nextPitch!.frame.match.ruleProfileId, 'npb-2026');
  assert.equal(r.nextPitch!.frame.match.playId, 8); assert.equal(r.nextPitch!.progressRevision, 1);
  assert.deepEqual(r.nextPitch!.result.pitch.resolution.timeline.status, { kind: 'active', count: { balls: 0, strikes: 1 } });
  assert.equal(r.nextPitch!.source.request.batter.action.kind, 'take'); assert.equal(r.nextPitchExecuted, true);
  assert.deepEqual(r.faultEvidence, { wrongActivationRejected: true, actorReadinessAfterInsert: true });
} else throw new Error('unsupported fresh continuation phase');
closed(sourcePath); assert.equal(fileHash(m.input.path), m.input.sha256);
const output = result as { destinationPath?: string; destinationSha256?: string; allConnectionsClosedReopened?: boolean };
if (output.destinationPath) { closed(output.destinationPath); assert.equal(fileHash(output.destinationPath), output.destinationSha256); }
writeFileSync(join(directory, `${phase}-receipt.json`), `${JSON.stringify({ schema: 'fresh_closed_input_phase_receipt_v1',
  phase, at: new Date().toISOString(), sourceCommit: m.sourceCommit, inputManifestSha256: expected,
  input: { path: sourcePath, sha256: fileHash(sourcePath), predecessorReceiptSha256,
    predecessorTerminalSha256: process.env.BASEBALL_FRESH_PREDECESSOR_TERMINAL_SHA256 }, result,
  historicalReceiptsInherited: false, originalConstructionProven: false, originalSealRollbackProven: false,
  elapsedWorldRecoveryProven: false, geometryRedObserved: false }, null, 2)}\n`, { flag: 'wx' });
