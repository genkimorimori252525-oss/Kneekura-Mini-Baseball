import { expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import * as locomotion from './SqliteActualLocomotionStore';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { runnerInputFactory, runnerDecisionInputNativeFixture, readOnlyRunnerInputSnapshot,
  openRunnerInputReadConnection, type RunnerDecisionInputSource } from './ActualRunnerDecisionInputContracts.test-support';

const beforeRead = (db: DatabaseSync) => ({ rows: readOnlyRunnerInputSnapshot(db),
  changes: db.prepare('SELECT total_changes() AS n').get()!.n, transaction: db.isTransaction });
const assertUnchanged = (db: DatabaseSync, before: ReturnType<typeof beforeRead>) => {
  expect(readOnlyRunnerInputSnapshot(db)).toEqual(before.rows);
  expect(db.prepare('SELECT total_changes() AS n').get()!.n).toBe(before.changes);
  expect(db.isTransaction).toBe(before.transaction);
};
const readWithoutWrites = <T>(db: DatabaseSync, work: () => T): T => {
  const before = beforeRead(db), value = work(); assertUnchanged(db, before); return value;
};
const rejectWithoutWrites = (db: DatabaseSync, work: () => unknown) => {
  const before = beforeRead(db);
  expect(work).toThrow();
  // Keep this outside toThrow: a write-guard assertion must not satisfy rejection.
  assertUnchanged(db, before);
};

// Run only after the separate public-baseline prerequisite and its repair gates.
// This gate is deliberately limited to input readiness, not selected motion or PlayEnd.
it('authenticates real runner inputs on the caller connection and reopens without creating decisions or motors', () => {
  const x = runnerDecisionInputNativeFixture(), db = x.f.db;
  let reopened: ReturnType<typeof openRunnerInputReadConnection> | undefined;
  let committed: ReturnType<typeof openRunnerInputReadConnection> | undefined;
  try {
    expect(x.originalMatch.ruleProfileId).toBe('npb-2026');
    expect(db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file).toBe(x.path);
    expect(db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    expect(x.field.field.motion.actors).toHaveLength(55);
    expect(x.observation.receipt.results).toHaveLength(11);
    expect(x.observation.receipt.at).toEqual(x.self.at);
    expect(x.publicKnowledge.recipient.playerId).toBe(x.self.playerId);
    expect(x.publicKnowledge.recipient.personId).toBe(x.self.personId);
    expect(x.publicKnowledge.known).toMatchObject({ startingBase: 1, normalNextBase: 2, outs: 0 });
    expect(x.model.source.motion).toEqual(x.runner.parameters);
    expect(x.model.person.personId).toBe(x.self.personId);
    expect(x.observation.knowledge.knownContext).toBeNull();
    expect(x.publicKnowledge.liveContext).toEqual({ status: 'pending', knownContext: null,
      force: 'unavailable', tagUp: 'unavailable', consumedSignals: [] });
    const factory = runnerInputFactory(locomotion);
    expect(factory, 'missing Native runner decision-input consumer after genuine fixture prerequisites').toBeTypeOf('function');
    // Baselines precede construction, and every later factory/derive call is guarded.
    const own = readWithoutWrites(db, () => factory!(db));
    const value = readWithoutWrites(db, () => own.derive(x.source, true));
    expect(value).toEqual({ version: 'owned_runner_decision_input_v1', source: x.source,
      playerId: x.self.playerId, personId: x.self.personId, motionRevision: x.runner.motionRevision,
      at: x.self.at, dependencyHashes: x.dependencyHashes, status: 'pending',
      pendingReasons: ['runner_live_context_unavailable'], decisionInput: null, decision: null, motor: null });
    expect(readWithoutWrites(db, () => own.derive(x.source))).toEqual(value);
    for (const key of ['knownContext', 'forcedToAdvance', 'tagUp', 'perceivedCues', 'communications', 'intent',
      'route', 'bodyPose', 'result', 'decisionTick', 'settledForPlay']) {
      rejectWithoutWrites(db, () => own.derive({ ...x.source, [key]: key === 'forcedToAdvance' ? false : { injected: true } } as RunnerDecisionInputSource));
    }
    for (const key of ['playerId', 'physicalPitchSourceId', 'fieldSourceId', 'observationSourceId',
      'publicKnowledgeSourceId', 'decisionMotionModelSourceId'] as const) {
      rejectWithoutWrites(db, () => own.derive({ ...x.source, [key]: 'foreign-or-missing' }));
    }
    for (const key of ['controller', 'motionIntent', 'playEnd', 'ruleResult', 'operativeRetirement', 'registry']) expect(value).not.toHaveProperty(key);

    // A valid accepted different-player model must fail the join, not a missing-ID lookup.
    const otherSource = { ...x.model.source, sourceId: 'runner-input-other-player-model', playerId: x.actor.binding.playerId,
      careerId: x.actor.binding.careerId, personLinkSourceId: x.actor.binding.personLinkSourceId, acceptedAtDay: x.actor.binding.gameDay };
    x.modelSources.set(otherSource.sourceId, otherSource);
    const other = x.models.accept(otherSource.sourceId);
    expect(x.models.read(otherSource.sourceId)).toEqual(other);
    expect(other.source.playerId).not.toBe(x.self.playerId);
    rejectWithoutWrites(db, () => own.derive({ ...x.source, decisionMotionModelSourceId: otherSource.sourceId }));

    // An outer caller transaction must survive both successful and rejected reads.
    // A separately opened read connection still sees committed bytes; the adapter
    // on this connection must see the uncommitted dependency mutation instead.
    const beforeTransaction = readOnlyRunnerInputSnapshot(db);
    expect(db.isTransaction).toBe(false); db.exec('BEGIN IMMEDIATE');
    try {
      const inTransaction = readWithoutWrites(db, () => factory!(db));
      expect(readWithoutWrites(db, () => inTransaction.derive(x.source, true))).toEqual(value);
      expect(db.isTransaction).toBe(true);
      db.prepare("UPDATE world_player_runner_decision_motion_models SET snapshot_hash='uncommitted-runner-input-corruption' WHERE source_id=?")
        .run(x.model.source.sourceId);
      expect(db.prepare('SELECT snapshot_hash FROM world_player_runner_decision_motion_models WHERE source_id=?').get(x.model.source.sourceId)!.snapshot_hash)
        .toBe('uncommitted-runner-input-corruption');
      rejectWithoutWrites(db, () => inTransaction.derive(x.source));
      expect(db.isTransaction).toBe(true);
      committed = openRunnerInputReadConnection(x.path);
      const committedDb = committed, committedReader = readWithoutWrites(committedDb, () => factory!(committedDb));
      expect(readWithoutWrites(committedDb, () => committedReader.derive(x.source))).toEqual(value);
    } finally {
      committed?.close(); committed = undefined;
      if (db.isTransaction) db.exec('ROLLBACK');
    }
    expect(db.isTransaction).toBe(false);
    expect(readOnlyRunnerInputSnapshot(db)).toEqual(beforeTransaction);
    expect(readWithoutWrites(db, () => own.derive(x.source, true))).toEqual(value);

    // A second genuinely accepted exact cut, still before the +125,000 phase.
    const laterFieldSource = { ...x.field.source, sourceId: 'runner-input-field-later',
      previousFieldSourceId: x.field.source.sourceId, throughTick: x.at + 110_000 };
    x.sources.set(laterFieldSource.sourceId, laterFieldSource);
    const laterField = x.fields.accept(laterFieldSource.sourceId);
    expect(laterField.field.motion.world.moment.elapsedSeconds).toBe(0.11);
    expect(laterField.field.motion.actors).toHaveLength(55);
    rejectWithoutWrites(db, () => own.derive({ ...x.source, fieldSourceId: laterField.source.sourceId }));
    expect(readWithoutWrites(db, () => own.derive(x.source))).toEqual(value);
    rejectWithoutWrites(db, () => own.derive(x.source, true));
    const nextSource = { ...x.observationSource, sourceId: 'runner-input-observation-2',
      previousObservationSourceId: x.observationSource.sourceId, baseFieldSourceId: laterField.source.sourceId };
    x.observationSources.set(nextSource.sourceId, nextSource);
    const next = x.history.accept(nextSource.sourceId);
    expect(next.history).toEqual([x.observationSource, nextSource]);
    const latestSource = { ...x.source, sourceId: 'runner-input-latest', observationSourceId: nextSource.sourceId,
      fieldSourceId: laterField.source.sourceId };
    const latest = readWithoutWrites(db, () => own.derive(latestSource, true));
    expect(latest.status).toBe('pending'); expect(latest.decisionInput).toBeNull(); expect(latest.at).toEqual(next.receipt.at);
    expect(readWithoutWrites(db, () => own.derive(x.source))).toEqual(value);
    rejectWithoutWrites(db, () => own.derive(x.source, true));
    // Advance only the observation head, keeping the exact field current.
    // This isolates sensory-history currentness from physical-head currentness.
    const newestObservationSource = { ...nextSource, sourceId: 'runner-input-observation-3',
      previousObservationSourceId: nextSource.sourceId };
    x.observationSources.set(newestObservationSource.sourceId, newestObservationSource);
    const newestObservation = x.history.accept(newestObservationSource.sourceId);
    expect(newestObservation.history).toEqual([x.observationSource, nextSource, newestObservationSource]);
    expect(newestObservation.source.baseFieldSourceId).toBe(next.source.baseFieldSourceId);
    expect(newestObservation.receipt.at).toEqual(next.receipt.at);
    readWithoutWrites(db, () => battedWorldFieldEvidenceFromSqlite(db).current(laterField));
    expect(readWithoutWrites(db, () => own.derive(latestSource))).toEqual(latest);
    rejectWithoutWrites(db, () => own.derive(latestSource, true));
    const newestSource = { ...latestSource, sourceId: 'runner-input-newest', observationSourceId: newestObservationSource.sourceId };
    const newest = readWithoutWrites(db, () => own.derive(newestSource, true));
    expect(newest.status).toBe('pending'); expect(newest.decisionInput).toBeNull();
    expect(newest.at).toEqual(latest.at); expect(newest.source).toEqual(newestSource);
    const finalRows = readOnlyRunnerInputSnapshot(db);
    x.closeHandles(); expect(() => db.prepare('SELECT 1')).toThrow();
    reopened = openRunnerInputReadConnection(x.path);
    const reopenedDb = reopened, reopenedReader = readWithoutWrites(reopenedDb, () => factory!(reopenedDb));
    expect(readWithoutWrites(reopenedDb, () => reopenedReader.derive(x.source))).toEqual(value);
    rejectWithoutWrites(reopenedDb, () => reopenedReader.derive(x.source, true));
    rejectWithoutWrites(reopenedDb, () => reopenedReader.derive({ ...x.source, fieldSourceId: laterField.source.sourceId }));
    readWithoutWrites(reopenedDb, () => battedWorldFieldEvidenceFromSqlite(reopenedDb).current(laterField));
    expect(readWithoutWrites(reopenedDb, () => reopenedReader.derive(latestSource))).toEqual(latest);
    rejectWithoutWrites(reopenedDb, () => reopenedReader.derive(latestSource, true));
    expect(readWithoutWrites(reopenedDb, () => reopenedReader.derive(newestSource, true))).toEqual(newest);
    expect(readOnlyRunnerInputSnapshot(reopenedDb)).toEqual(finalRows);
  } finally { try { committed?.close(); reopened?.close(); } finally { x.close(); } }
}, 180_000);

it.each(['future_day', 'foreign_clock'] as const)('rejects an authentically accepted %s model before exposing pending readiness', modelVariant => {
  const x = runnerDecisionInputNativeFixture({ modelVariant });
  try {
    // The owner accepts both valid baselines; the consumer must validate their
    // compatibility with this physical recipient, day and clock before pending.
    expect(x.models.read(x.model.source.sourceId)).toEqual(x.model);
    expect(x.model.source.playerId).toBe(x.self.playerId); expect(x.model.person.personId).toBe(x.self.personId);
    if (modelVariant === 'future_day') {
      expect(x.model.source.acceptedAtDay).toBe(x.self.gameDay + 1);
      expect(x.model.source.motion.ticksPerSecond).toBe(x.self.ticksPerSecond);
    } else {
      expect(x.model.source.acceptedAtDay).toBe(x.self.gameDay);
      expect(x.model.source.motion.ticksPerSecond).toBe(x.self.ticksPerSecond * 2);
    }
    const factory = runnerInputFactory(locomotion);
    expect(factory, 'missing Native runner decision-input consumer after valid incompatible model acceptance').toBeTypeOf('function');
    const own = readWithoutWrites(x.f.db, () => factory!(x.f.db));
    rejectWithoutWrites(x.f.db, () => own.derive(x.source));
    rejectWithoutWrites(x.f.db, () => own.derive(x.source, true));
  } finally { x.close(); }
}, 180_000);
