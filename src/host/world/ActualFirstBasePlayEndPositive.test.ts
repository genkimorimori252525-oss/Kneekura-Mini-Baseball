import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { ownedScheduledMotionTiming as phase } from './OwnedScheduledMotionTiming.test-support';
import { installOwnedScheduledDecision } from './OwnedScheduledMotionDecisionFixtures.test-support';
import { actualDefensiveDecisionLiveWorkFromSqlite } from './SqliteActualDefensiveDecisionLiveWork';
import { actualPlayersKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { ownedMotionKnownWorkFromSqlite } from './OwnedMotionKnownWorkFromSqlite';
import { battedWorldFieldExecutionEvidenceFromSqlite, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { resumeActualFirstBasePlayEndFixture } from './ActualFirstBasePlayEndResume.test-support';
import { actualFirstBasePlayEndFixture } from './ActualFirstBasePlayEndFixtures.test-support';
import { openSqliteActualFirstBasePlayEndStore } from './SqliteActualFirstBasePlayEndStore';
import { openSqliteActualLiveRuleConsumptionStore } from './SqliteActualLiveRuleConsumptionStore';
import { openSqliteActualFirstBaseUmpireStore, actualFirstBaseUmpireEvidenceFromSqlite } from './SqliteActualFirstBaseUmpireStore';
import { actualFirstBaseUmpirePhysicalPrefixIdentity } from './ActualFirstBaseUmpirePhysicalIdentity';
import { openSqliteActualCommunicationStore } from './SqliteActualCommunicationStore';
import { openSqliteBattedWorldFieldExecutionStore } from './SqliteBattedWorldFieldExecutionStore';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { ownedScheduledMotionArchiveHash, ownedScheduledWholeHistoryArchiveEncoding } from './OwnedScheduledMotionArchive';
import { playerObservationCalibrationFixture } from '../../core/sim/perception/PlayerObservationCalibrationFixtures.test-support';
import type { AcceptedActualFirstBaseUmpireSetup } from './ActualFirstBaseUmpire';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

it('closes the original genuine V1-D chain with operative OUT, future reception and moving actors, then fences new work and reopens unchanged', async () => {
  const path = join(mkdtempSync(join(tmpdir(), 'native-first-base-positive-')), 'state.sqlite');
  const replay = process.env.BASEBALL_FIRST_PLAY_REPLAY_DB;
  console.info('native-first-base-positive-database', path, 'input', replay ?? 'fresh original pitch');
  phase('positive:original-chain', 'begin');
  if (replay) {
    const { DatabaseSync, backup } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    const original = new DatabaseSync(replay, { readOnly: true });
    try { await backup(original, path); } finally { original.close(); }
  } else {
    const original = actualFirstBasePlayEndFixture(path);
    original.executions.accept(original.source.sourceId); original.f.close();
  }
  phase('positive:original-chain', 'end');
  const x = resumeActualFirstBasePlayEndFixture(path); let closed = false;
  phase('positive:reopened-original-chain', 'point');
  try {
    expect(x.f.db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    expect(x.f.db.prepare('PRAGMA database_list').all().find(r => r.name === 'main')!.file).toBe(path);
    const physicalRows = () => x.f.db.prepare('SELECT * FROM batted_world_field_executions ORDER BY revision').all();
    const before = physicalRows(), p = playerObservationCalibrationFixture(), tps = x.baseField.response.touch.worldContact.flight.source.execution.ballFlightParameters.ticksPerSecond, center = x.baseField.geometry.geometry.baseGeometry.bases.first.region.center;
    // A second real defender already owns a future decision when the runner is
    // retired. Its explicit fixture calibration is accepted by the normal
    // model/observation/plan/decision owners before either later physical cut.
    const originalDeciders = x.f.db.prepare('SELECT player_id FROM actual_defensive_decisions').all().map(r => r.player_id);
    const futurePlayer = x.runtime.membership.participants.find(p => p.role === 'defender' && !originalDeciders.includes(p.playerId))!;
    const secondDefender = installOwnedScheduledDecision(x, futurePlayer.playerId, x.race.source.sourceId, 100);
    expect(secondDefender.decision.receipt.lifecycle.status).toBe('pending_decision');
    phase('positive:future-second-defender', 'point');
    const originalFutureDecision = actualDefensiveDecisionLiveWorkFromSqlite(x.f.db).read(secondDefender.decision.source.sourceId)!;
    const acknowledgement = { sourceId: 'rule-consumption', sourceVersion: 'fixture-v1', capability: 'actual_first_base_rule_consumption_v1' as const,
      captureExecutionSourceId: 'field-race-capture-confirmed', ruleExecutionSourceId: x.race.source.sourceId };
    x.f.track(openSqliteActualLiveRuleConsumptionStore(path, { readAcceptedConsumption: id => id === acknowledgement.sourceId ? acknowledgement : null })).accept(acknowledgement.sourceId);
    const setup: AcceptedActualFirstBaseUmpireSetup = { sourceId: 'play-end-umpire-setup', sourceVersion: 'fixture-v1', gameId: x.runtime.gameId,
      physicalPitchSourceId: x.pitchId, umpireId: 'umpire-1', pose: { version: 'static_first_base_view_v1', position: { ...center, y: 20 },
        forward: { x: 0, y: -1, z: 0 }, validFromElapsedSeconds: 0, validThroughElapsedSeconds: 10 }, attention: { control: 1, touch: 1 },
      calibration: { version: 'first_base_timing_triangular_v1', perceptionAbility: 0.8, callDelaySeconds: 2 / tps,
        geometryParameters: { ...p.geometryParameters, fullQualityHalfAngleRadians: Math.PI - .01, maxVisibleHalfAngleRadians: Math.PI,
          fullQualityDistanceMeters: 100, maxObservableDistanceMeters: 1000, fullQualityRelativeSpeedMps: 100000, maxRelativeSpeedMps: 1000000 },
        qualityParameters: p.qualityParameters,
        timingErrorParameters: { minimumDetectionQuality: .1, minimumTimeErrorSeconds: 0, maximumTimeErrorSeconds: 0 } } };
    const observation = { sourceId: 'play-end-umpire-observation', sourceVersion: 'fixture-v1', setupSourceId: setup.sourceId, ruleExecutionSourceId: x.race.source.sourceId };
    const sources = new Map<string, AcceptedBattedWorldFieldExecution>();
    const physicalWriter = x.f.track(openSqliteBattedWorldFieldExecutionStore(path, { read: battedWorldFieldEvidenceFromSqlite(x.f.db).read },
      { readAcceptedExecution: id => sources.get(id) ?? null }));
    const extendBucket = (sourceId: string, previous: string, throughTick: number) => {
      const prefix = { baseField: x.baseField, fields: battedWorldFieldEvidenceFromSqlite(x.f.db).scope(x.baseField, x.baseField.source.sourceId),
        executions: battedWorldFieldExecutionEvidenceFromSqlite(x.f.db).scope(x.baseField, previous) };
      const ids = x.runtime.membership.participants.map(player => player.playerId);
      const source: AcceptedBattedWorldFieldExecution = { sourceId, sourceVersion: 'fixture-v1', baseFieldSourceId: x.baseField.source.sourceId,
        previousExecutionSourceId: previous, action: { kind: 'owned_motion_v2', checkpoint: { kind: 'retained_quantizer_bucket_v1', throughTick },
          knownWork: ownedMotionKnownWorkFromSqlite(x.f.db, x.pitchId, ids),
          contributions: actualPlayersKinematicsFromPrefix(ids, prefix).map(self => ({ kind: 'retained', playerId: self.playerId, command: self.activeCommand })) } };
      sources.set(sourceId, source); return physicalWriter.accept(sourceId);
    };
    const waitingSource = { sourceId: 'scheduled-operative-call', sourceVersion: 'fixture-v1', observationSourceId: observation.sourceId, currentExecutionSourceId: x.race.source.sourceId };
    const calls = new Map([[waitingSource.sourceId, waitingSource]]);
    const umpires = x.f.track(openSqliteActualFirstBaseUmpireStore(path, { readAcceptedSetup: () => setup,
      readAcceptedObservation: () => observation, readAcceptedCall: id => calls.get(id) ?? null }));
    umpires.acceptSetup(setup.sourceId); const observed = umpires.observe(observation.sourceId), waiting = umpires.advanceCall(waitingSource.sourceId);
    expect(waiting.schedule.kind).toBe('scheduled');
    const due = extendBucket('actual-call-due-cut', x.race.source.sourceId, x.race.execution.field.motion.world.moment.ball.tick + 3);
    const callSource = { ...waitingSource, sourceId: 'operative-call', currentExecutionSourceId: due.source.sourceId };
    calls.set(callSource.sourceId, callSource); const call = umpires.advanceCall(callSource.sourceId);
    const final = extendBucket('actual-post-call-quantizer-tail', due.source.sourceId, due.execution.field.motion.world.moment.ball.tick + 1);
    expect(call.schedule).toMatchObject({ kind: 'called', call: 'out' });
    phase('positive:actual-delayed-call-and-tail', 'point');
    const physicalHash = ownedScheduledMotionArchiveHash(x.race), actualPrefix = x.prefix();
    const identity = actualFirstBaseUmpirePhysicalPrefixIdentity(actualPrefix, battedWorldFieldPhysicalPrefix({ ...actualPrefix, custodyPolicy: 'release_exclusive_v1' }));
    expect(observed.ruleEvidenceHash).toBe(physicalHash);
    expect(call.currentExecutionHash).toBe(ownedScheduledMotionArchiveHash(due));
    if (call.schedule.kind !== 'called') throw new Error('delayed operative call');
    expect(call.schedule.calledAtElapsedSeconds).toBe(observed.availability.elapsedSeconds + setup.calibration!.callDelaySeconds);
    expect(call.advancedThrough.elapsedSeconds).toBeGreaterThanOrEqual(call.schedule.calledAtElapsedSeconds);
    expect(x.f.db.prepare('SELECT snapshot_hash FROM batted_world_field_executions WHERE source_id=?').get(x.race.source.sourceId)!.snapshot_hash).toBe(physicalHash);
    expect(observed.physicalPrefixHash).toBe(identity.physicalPrefixHash);
    expect(observed.physicalPrefixHashConvention).toBe(identity.physicalPrefixHashConvention);
    const references = actualFirstBaseUmpireEvidenceFromSqlite(x.f.db).importReferences(call.source.sourceId)!;
    expect(references.ruleEvidence.snapshotHash).toBe(physicalHash); expect(references.ruleEvidence.sourceHash).toBe(hash(x.race.source));
    const model = { sourceId: 'call-reception-model', sourceVersion: 'fixture-v1', gameId: x.runtime.gameId, physicalPitchSourceId: x.pitchId,
      parameters: { version: 'fixed_receiver_conditions_v1' as const, timing: 'exact_sent_plus_core_delay_ticks_v1' as const,
        receivers: x.runtime.membership.participants.map(player => ({ playerId: player.playerId, conditions: { propagationDelayTicks: 100,
          recognitionBaseDelayTicks: 0, maxAdditionalRecognitionDelayTicks: 0, audibility: 1, recognition: 1, attention: 1, minimumRecognizableQuality: .5 } })) } };
    const communicationSource = { sourceId: 'call-information', sourceVersion: 'fixture-v1', callSourceId: call.source.sourceId,
      modelSourceId: model.sourceId, currentExecutionSourceId: final.source.sourceId, previousCommunicationSourceId: null };
    const communications = x.f.track(openSqliteActualCommunicationStore(path, { readAcceptedModel: () => model, readAcceptedCommunication: () => communicationSource }));
    communications.acceptModel(model.sourceId); const communication = communications.accept(communicationSource.sourceId);
    expect(communication.recipients).toHaveLength(10); expect(communication.recipients.every(r => r.kind === 'scheduled')).toBe(true);
    const request = { sourceId: 'physical-end', sourceVersion: 'fixture-v1', runtimeSourceId: x.runtime.source.sourceId,
      baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: final.source.sourceId, ruleConsumptionSourceId: acknowledgement.sourceId,
      umpireCallSourceId: call.source.sourceId, communicationSourceId: communication.source.sourceId };
    const ends = x.f.track(openSqliteActualFirstBasePlayEndStore(path, { readAcceptedEnd: id => id === request.sourceId ? request : null }));
    const beforeSeal = physicalRows();
    phase('positive:future-communication-admitted', 'point');
    const witness = witnessSqliteWrite('INSERT INTO actual_live_play_fences VALUES(?,?,?,?)', db =>
      db.prepare("SELECT snapshot_hash FROM batted_world_field_executions WHERE source_id='actual-post-call-quantizer-tail'").get()?.snapshot_hash === 'changed-during-seal');
    x.f.db.exec(`CREATE TRIGGER corrupt_sealed_dependency AFTER INSERT ON actual_live_play_fences BEGIN
      UPDATE batted_world_field_executions SET snapshot_hash='changed-during-seal' WHERE source_id='actual-post-call-quantizer-tail'; END;`);
    try {
      expect(() => ends.accept(request.sourceId)).toThrow(/archive|identity|original|owner|snapshot|admitted source/);
      expect(witness.wasReached()).toBe(true);
    } finally { witness.close(); x.f.db.exec('DROP TRIGGER corrupt_sealed_dependency;'); }
    expect(x.f.db.prepare('SELECT * FROM actual_first_base_play_ends').all()).toEqual([]);
    expect(x.f.db.prepare('SELECT * FROM actual_live_play_fences').all()).toEqual([]);
    expect(physicalRows()).toEqual(beforeSeal);
    phase('positive:witnessed-seal-rollback', 'point');
    const ended = ends.accept(request.sourceId);
    phase('positive:committed-physical-end', 'point');
    expect(ended.kind).toBe('ended'); expect(ended.registry.resolution).toMatchObject({ kind: 'ended', reason: 'all_offense_terminal' });
    expect(ended.wholeHistory.end).toEqual({ kind: 'unestablished' });
    expect(ended.wholeHistoryHash).toBe(ownedScheduledWholeHistoryArchiveEncoding(ended.wholeHistory, x.pitchId, x.runtime.gameId).hash);
    expect(ended.firstBaseEvidenceApplicability).toMatchObject({ version: 'owned_first_base_evidence_applicability_v1',
      rule: references.ruleEvidence, call: references.call, from: observed.availability, through: ended.exactEnd,
      coverage: 'no_new_rule_relevant_physical_or_base_facts', fence: { owner: 'actual_first_base_play_ends', sourceId: request.sourceId } });
    expect(ended.firstBaseEvidenceApplicability.physicalSuffix.map(r => r.sourceId)).toEqual([due.source.sourceId, final.source.sourceId]);
    expect(ended.generation.producerIds).toHaveLength(70); expect(ended.generation.bodyBaseHistoryHashes).toHaveLength(40);
    expect(ended.exactEnd.elapsedSeconds).toBe(ended.generation.boundary.lastIncludedElapsedSeconds);
    expect(ended.registry.frontier.physical).toHaveLength(10);
    expect(ended.futureWork.controllers).toHaveLength(10); expect(ended.futureWork.communication).toHaveLength(10);
    expect(ended.futureWork.communication.every(r => r.dueTick > ended.playEnd.tick)).toBe(true);
    expect(ended.futureWork.controllerDecisions).toEqual([originalFutureDecision]);
    expect(ended.futureWork.controllerDecisions![0].work.deadlines.decision.tick).toBeGreaterThan(ended.playEnd.tick);
    const decisionProducerId = x.runtime.membership.producers.find(p => p.domain === 'actor_decision' && p.playerId === futurePlayer.playerId)!.producerId;
    expect(ended.registry.registry.sources.find(s => s.sourceId === decisionProducerId)).toMatchObject({
      decisions: originalFutureDecision.work.source.decisions, queue: { nextPendingTick: originalFutureDecision.work.deadlines.decision.tick } });
    expect(ended.registry.frontier.actors.find(a => a.actorId === futurePlayer.playerId)).toEqual({ actorId: futurePlayer.playerId,
      kind: 'decision_pending', dueTick: originalFutureDecision.work.deadlines.decision.tick });
    expect(ended.registry.frontier.actors.filter(a => a.actorId !== futurePlayer.playerId).every(a => a.kind === 'acting')).toBe(true);
    expect(ended.operativeRetirement).toMatchObject({ kind: 'retired', causeCallSourceId: call.source.sourceId });
    const late = { ...x.race.source, sourceId: 'forbidden-late-rule-source', previousExecutionSourceId: final.source.sourceId };
    sources.set(late.sourceId, late);
    const afterPhysical = physicalRows();
    expect(() => physicalWriter.accept(late.sourceId)).toThrow(/sealed|terminal/);
    expect(physicalRows()).toEqual(afterPhysical);
    expect(physicalRows().slice(0, before.length)).toEqual(before);
    const callHash = hash(call), observedHash = hash(observed), endHash = hash({ ...ended, wholeHistory: ended.wholeHistoryHash });
    expect(hash(umpires.readCall(call.source.sourceId))).toBe(callHash);
    expect(umpires.readCall(waiting.source.sourceId)).toEqual(waiting);
    expect(hash(umpires.readObservation(observed.source.sourceId))).toBe(observedHash);
    x.f.close(); closed = true;
    const reopened = openSqliteActualFirstBasePlayEndStore(path), reopenedUmpire = openSqliteActualFirstBaseUmpireStore(path);
    try {
      const saved = reopened.read(request.sourceId)!;
      expect(hash({ ...saved, wholeHistory: saved.wholeHistoryHash })).toBe(endHash);
      const retry = reopened.accept(request.sourceId);
      expect(hash({ ...retry, wholeHistory: retry.wholeHistoryHash })).toBe(endHash);
      expect(hash(reopenedUmpire.readCall(call.source.sourceId))).toBe(callHash);
      expect(hash(reopenedUmpire.readObservation(observed.source.sourceId))).toBe(observedHash);
    } finally { reopened.close(); reopenedUmpire.close(); }
    phase('positive:closed-reopened-and-retried', 'point');
    if (process.env.BASEBALL_FIRST_PLAY_OUTPUT_DB) {
      const { DatabaseSync, backup } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
      const original = new DatabaseSync(path, { readOnly: true });
      try { await backup(original, process.env.BASEBALL_FIRST_PLAY_OUTPUT_DB); } finally { original.close(); }
      phase('positive:reusable-ended-backup', 'point');
    }
  } finally { if (!closed) x.f.close(); }
}, 3_600_000);
