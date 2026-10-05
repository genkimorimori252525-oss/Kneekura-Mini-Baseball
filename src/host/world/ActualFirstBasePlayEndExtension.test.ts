import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { createRequire } from 'node:module';
import { appendFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { resumeActualFirstBasePlayEndFixture } from './ActualFirstBasePlayEndResume.test-support';
import { clearKnownFirstBaseTrapOnDisposableCopy, requireOriginalArtifactFutureDecision } from './ActualFirstBaseArtifactGuards.test-support';
import { actualDefensiveDecisionLiveWorkFromSqlite } from './SqliteActualDefensiveDecisionLiveWork';
import { actualFirstBaseEndArchiveEncoding, openSqliteActualFirstBasePlayEndStore } from './SqliteActualFirstBasePlayEndStore';
import { actualFirstBaseUmpireEvidenceFromSqlite, openSqliteActualFirstBaseUmpireStore } from './SqliteActualFirstBaseUmpireStore';
import { actualCommunicationEvidenceFromSqlite, openSqliteActualCommunicationStore } from './SqliteActualCommunicationStore';
import { battedWorldFieldExecutionEvidenceFromSqlite, openSqliteBattedWorldFieldExecutionStore, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { actualFirstBaseUmpirePhysicalPrefixIdentity } from './ActualFirstBaseUmpirePhysicalIdentity';
import { ownedScheduledMotionArchiveHash, ownedScheduledWholeHistoryArchiveEncoding } from './OwnedScheduledMotionArchive';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const phase = (message: string) => {
  console.info(message);
  if (process.env.BASEBALL_FIRST_PLAY_PHASE_LOG) appendFileSync(process.env.BASEBALL_FIRST_PLAY_PHASE_LOG, `${new Date().toISOString()} ${message}\n`);
};

it.runIf(!!process.env.BASEBALL_FIRST_PLAY_COMMITTED_DB)('authenticates the preserved real delayed-call chain, retains a second pending defender, rolls back corrupt closure and durably ends with unchanged original identities', async () => {
  const originalPath = process.env.BASEBALL_FIRST_PLAY_COMMITTED_DB;
  if (!originalPath) throw new Error('explicit preserved committed-chain artifact is required');
  const path = join(mkdtempSync(join(tmpdir(), 'native-first-base-final-extension-')), 'state.sqlite');
  const { DatabaseSync, backup } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const original = new DatabaseSync(originalPath, { readOnly: true });
  try { await backup(original, path); } finally { original.close(); }
  phase(`copied committed chain ${path}`);
  const x = resumeActualFirstBasePlayEndFixture(path); let closed = false;
  try {
    expect(x.f.db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    expect(x.f.db.prepare('PRAGMA database_list').all().find(r => r.name === 'main')!.file).toBe(path);
    for (const table of ['actual_first_base_play_ends', 'actual_live_play_fences']) {
      if (x.f.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)) {
        expect(x.f.db.prepare(`SELECT * FROM ${table}`).all()).toEqual([]);
      }
    }
    // Only this fresh disposable copy may remove the exact inherited test trap.
    // An absent trap is valid when the snapshot predates its creation.
    phase(`artifact trap: ${clearKnownFirstBaseTrapOnDisposableCopy(x.f.db)}`);
    const physicalRows = () => x.f.db.prepare('SELECT * FROM batted_world_field_executions ORDER BY revision').all();
    const originalPhysical = physicalRows();
    expect(originalPhysical).toHaveLength(10);
    const informationRows = () => ['actual_first_base_umpire_observations', 'actual_first_base_umpire_calls', 'actual_call_communications']
      .map(table => ({ table, rows: x.f.db.prepare(`SELECT * FROM ${table} ORDER BY source_id`).all() }));
    const originalInformation = informationRows();
    const ownUmpire = actualFirstBaseUmpireEvidenceFromSqlite(x.f.db), ownPhysical = battedWorldFieldExecutionEvidenceFromSqlite(x.f.db);
    x.f.db.exec('BEGIN');
    const call = ownUmpire.readCall('operative-call')!, waiting = ownUmpire.readCall('scheduled-operative-call')!;
    const final = ownPhysical.read('actual-post-call-quantizer-tail')!, due = ownPhysical.read('actual-call-due-cut')!;
    const communication = actualCommunicationEvidenceFromSqlite(x.f.db).read('call-information')!;
    const references = ownUmpire.importReferences(call.source.sourceId)!;
    const originalPrefix = x.prefix();
    const identity = actualFirstBaseUmpirePhysicalPrefixIdentity(originalPrefix, battedWorldFieldPhysicalPrefix({ ...originalPrefix, custodyPolicy: 'release_exclusive_v1' }));
    x.f.db.exec('COMMIT');
    phase('authenticated original physical, umpire and communication owners');
    expect(waiting.schedule.kind).toBe('scheduled'); expect(call.schedule.kind).toBe('called');
    if (call.schedule.kind !== 'called') throw new Error('actual operative call missing');
    const observed = call.observation, physicalHash = ownedScheduledMotionArchiveHash(x.race);
    expect(observed.setup.calibration!.callDelaySeconds).toBeGreaterThan(0);
    expect(call.schedule.calledAtElapsedSeconds).toBe(observed.availability.elapsedSeconds + observed.setup.calibration!.callDelaySeconds);
    expect(observed.ruleEvidenceHash).toBe(physicalHash);
    expect(call.currentExecutionHash).toBe(ownedScheduledMotionArchiveHash(due));
    expect(x.f.db.prepare('SELECT snapshot_hash FROM batted_world_field_executions WHERE source_id=?').get(x.race.source.sourceId)!.snapshot_hash).toBe(physicalHash);
    expect(x.f.db.prepare('SELECT snapshot_hash FROM batted_world_field_executions WHERE source_id=?').get(due.source.sourceId)!.snapshot_hash).toBe(call.currentExecutionHash);
    expect(observed.physicalPrefixHash).toBe(identity.physicalPrefixHash); expect(observed.physicalPrefixHashConvention).toBe(identity.physicalPrefixHashConvention);
    expect(references.ruleEvidence.snapshotHash).toBe(physicalHash); expect(references.ruleEvidence.sourceHash).toBe(hash(x.race.source));
    expect(communication.source.currentExecutionSourceId).toBe(final.source.sourceId);
    expect(communication.recipients).toHaveLength(10); expect(communication.recipients.every(r => r.kind === 'scheduled')).toBe(true);
    // Reuse the genuine pending home-2 Source already admitted by the Positive
    // gate. Its original rule cut and deadlines remain frozen; no third actor is
    // introduced to obtain a new future date.
    x.f.db.exec('BEGIN');
    const futureDecision = requireOriginalArtifactFutureDecision(
      actualDefensiveDecisionLiveWorkFromSqlite(x.f.db).read('scheduled-decision-home-2'), {
        physicalPitchSourceId: x.pitchId, baseFieldSourceId: x.baseField.source.sourceId,
        ruleExecutionSourceId: x.race.source.sourceId, throughTick: final.execution.field.motion.world.moment.ball.tick,
        defenderIds: x.runtime.membership.participants.filter(p => p.role === 'defender').map(p => p.playerId),
      });
    x.f.db.exec('COMMIT');
    const futurePlayer = x.runtime.membership.participants.find(p => p.playerId === futureDecision.work.playerId)!;
    phase('authenticated existing second defender future decision at its original rule cut');
    const request = { sourceId: 'physical-end', sourceVersion: 'fixture-v1', runtimeSourceId: x.runtime.source.sourceId,
      baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: final.source.sourceId,
      ruleConsumptionSourceId: 'rule-consumption', umpireCallSourceId: call.source.sourceId, communicationSourceId: communication.source.sourceId };
    const ends = x.f.track(openSqliteActualFirstBasePlayEndStore(path, { readAcceptedEnd: id => id === request.sourceId ? request : null }));
    x.f.db.exec(`CREATE TRIGGER corrupt_sealed_dependency AFTER INSERT ON actual_live_play_fences BEGIN
      UPDATE batted_world_field_executions SET snapshot_hash='changed-during-seal' WHERE source_id='actual-post-call-quantizer-tail'; END;`);
    phase('starting actual post-seal mutation rollback check');
    const fault = witnessSqliteWrite('INSERT INTO actual_live_play_fences VALUES(?,?,?,?)', db =>
      db.prepare('SELECT snapshot_hash FROM batted_world_field_executions WHERE source_id=?')
        .get(final.source.sourceId)!.snapshot_hash === 'changed-during-seal');
    try {
      expect(() => ends.accept(request.sourceId)).toThrow(/archive|identity|original|owner|snapshot|admitted source/);
      expect(fault.wasReached()).toBe(true);
    } finally { fault.close(); x.f.db.exec('DROP TRIGGER corrupt_sealed_dependency;'); }
    expect(x.f.db.prepare('SELECT * FROM actual_first_base_play_ends').all()).toEqual([]);
    expect(x.f.db.prepare('SELECT * FROM actual_live_play_fences').all()).toEqual([]);
    expect(physicalRows()).toEqual(originalPhysical);
    phase('actual mutation rolled back; starting physical end acceptance');
    const ended = ends.accept(request.sourceId);
    phase('physical end accepted');
    expect(ended.kind).toBe('ended'); expect(ended.registry.resolution).toMatchObject({ kind: 'ended', reason: 'all_offense_terminal' });
    expect(ended.wholeHistory.end).toEqual({ kind: 'unestablished' });
    expect(ended.wholeHistoryHash).toBe(ownedScheduledWholeHistoryArchiveEncoding(ended.wholeHistory, x.pitchId, x.runtime.gameId).hash);
    expect(ended.firstBaseEvidenceApplicability).toMatchObject({ version: 'owned_first_base_evidence_applicability_v1', rule: references.ruleEvidence,
      call: references.call, from: observed.availability, through: ended.exactEnd, coverage: 'no_new_rule_relevant_physical_or_base_facts',
      fence: { owner: 'actual_first_base_play_ends', sourceId: request.sourceId } });
    expect(ended.firstBaseEvidenceApplicability.physicalSuffix.map(r => r.sourceId)).toEqual([due.source.sourceId, final.source.sourceId]);
    expect(ended.generation.producerIds).toHaveLength(70); expect(ended.generation.bodyBaseHistoryHashes).toHaveLength(40);
    expect(ended.exactEnd.elapsedSeconds).toBe(ended.generation.boundary.lastIncludedElapsedSeconds);
    expect(ended.exactEnd.elapsedSeconds).toBeGreaterThan(call.schedule.calledAtElapsedSeconds);
    expect(ended.registry.frontier.physical).toHaveLength(10); expect(ended.futureWork.controllers).toHaveLength(10);
    expect(ended.futureWork.communication).toHaveLength(10); expect(ended.futureWork.communication.every(r => r.dueTick > ended.playEnd.tick)).toBe(true);
    expect(ended.futureWork.controllerDecisions).toEqual([futureDecision]);
    expect(futureDecision.work.deadlines.decision.tick).toBeGreaterThan(ended.playEnd.tick);
    const producerId = x.runtime.membership.producers.find(p => p.domain === 'actor_decision' && p.playerId === futurePlayer.playerId)!.producerId;
    expect(ended.registry.registry.sources.find(s => s.sourceId === producerId)).toMatchObject({ decisions: futureDecision.work.source.decisions,
      queue: { nextPendingTick: futureDecision.work.deadlines.decision.tick } });
    expect(ended.registry.frontier.actors.find(a => a.actorId === futurePlayer.playerId)).toEqual({ actorId: futurePlayer.playerId,
      kind: 'decision_pending', dueTick: futureDecision.work.deadlines.decision.tick });
    expect(ended.operativeRetirement).toMatchObject({ kind: 'retired', causeCallSourceId: call.source.sourceId });
    const late: AcceptedBattedWorldFieldExecution = { ...x.race.source, sourceId: 'forbidden-late-rule-source', previousExecutionSourceId: final.source.sourceId };
    const physicalWriter = x.f.track(openSqliteBattedWorldFieldExecutionStore(path, { read: battedWorldFieldEvidenceFromSqlite(x.f.db).read },
      { readAcceptedExecution: id => id === late.sourceId ? late : null }));
    expect(() => physicalWriter.accept(late.sourceId)).toThrow(/sealed|terminal/);
    expect(physicalRows()).toEqual(originalPhysical); expect(informationRows()).toEqual(originalInformation);
    const endHash = actualFirstBaseEndArchiveEncoding(ended).hash, callHash = hash(call), observedHash = hash(observed), communicationHash = hash(communication);
    x.f.close(); closed = true; phase('closed all original connections; authenticating reopened owners and retry');
    const reopened = openSqliteActualFirstBasePlayEndStore(path), umpire = openSqliteActualFirstBaseUmpireStore(path), information = openSqliteActualCommunicationStore(path);
    try {
      expect(actualFirstBaseEndArchiveEncoding(reopened.read(request.sourceId)!).hash).toBe(endHash);
      expect(actualFirstBaseEndArchiveEncoding(reopened.accept(request.sourceId)).hash).toBe(endHash);
      expect(hash(umpire.readCall(call.source.sourceId))).toBe(callHash); expect(hash(umpire.readObservation(observed.source.sourceId))).toBe(observedHash);
      expect(hash(information.read(communication.source.sourceId))).toBe(communicationHash);
    } finally { reopened.close(); umpire.close(); information.close(); }
    phase(`terminal verified closed physical end ${path}`);
  } finally { if (!closed) { if (x.f.db.isTransaction) x.f.db.exec('ROLLBACK'); x.f.close(); } }
}, 7_200_000);
