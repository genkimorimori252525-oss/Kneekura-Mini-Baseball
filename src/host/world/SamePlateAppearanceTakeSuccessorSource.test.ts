import { expect, it, vi } from 'vitest';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaTakeSuccessorSourceInput } from './SamePlateAppearanceTakeSuccessor';
import { createRequire } from 'node:module';
import { readSamePaSuccessorTakePitchFromSqlite as readPitch } from './SamePlateAppearanceTakeSuccessorFromSqlite';
import { withSamePaContinuationReadPhase } from './SamePlateAppearanceContinuationFromSqlite';
import * as continuation from './SamePlateAppearanceContinuationFromSqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
const ref = (owner: string, id = owner) => ({ owner, sourceId: id, sourceHash: hash(id), snapshotHash: hash('result:' + id) });
/** Existing ContinuousPitchFixtures nominal values; parser-only identities do
 * not claim a physical cut, ready body, Native Source or calibration proof. */
const action = () => ({ sourceId: 'next-action', sourceVersion: 'fixture-only-v1', capability: 'same_pa_next_take_action_v1',
  viewReference: ref('pa_continuation_v1_execution_views'), previousPitchReference: ref('pa_dispatch_v1_pitch_actions'),
  timingReference: ref('world_pitch_timing_baselines'), releaseReference: ref('world_player_release_baselines'),
  pitchResponseReference: ref('world_pitch_fatigue_policies'), batterModelReference: ref('world_player_batting_models'),
  nominalPitch: { delivery: { matchSeed: 19, moundReference: { x: 0, y: 0, z: 18 }, outingId: 'outing-1', readyAtUs: 0,
    timingIntent: { deliveryMode: 'NORMAL', cadenceIntent: 'STANDARD' }, physics: { velocity: { x: 0, y: 0, z: -30 }, spin: { x: 0, y: 100, z: 0 } } },
    flight: { durationUs: 1_500_000, acceleration: { x: 0, y: 0, z: 0 } },
    batter: { action: { kind: 'take' }, plateZ: 0, strikeZone: { centerX: 0, halfWidth: 0.2, lowerY: 1.4, upperY: 1.8 }, ballRadiusMeters: 0.0366 } } });
it('NT01 next TAKE action pins current owners and accepts no supplied timeline World cut or posture proof', () => {
  const s = action(); expect(samePaTakeSuccessorSourceInput(s)).toEqual(s);
  for (const extra of [{ world: {} }, { bodyCut: {} }, { timeline: {} }, { cachedPosture: {} }, { stage: 'owned_append' }]) {
    expect(() => samePaTakeSuccessorSourceInput({ ...s, ...extra })).toThrow();
  }
  expect(() => samePaTakeSuccessorSourceInput({ ...s, viewReference: ref('reserved_pa_execution_views') })).toThrow();
  expect(() => samePaTakeSuccessorSourceInput({ ...s, previousPitchReference: ref('physical_pitch_progress_actions') })).toThrow();
  const swing = structuredClone(s); swing.nominalPitch.batter.action.kind = 'swing'; expect(() => samePaTakeSuccessorSourceInput(swing)).toThrow();
});
it('NT02 retained setup requires ten distinct participants and exactly32 independently pinned response rows', () => {
  const participants = Array.from({ length: 10 }, (_, i) => {
    const playerId = 'player-' + i, routes = i === 0 ? ['batter_observation', 'batter_decision', 'batter_motor', 'batter_swing']
      : i === 1 ? ['pitch_delivery', 'defender_observation', 'defender_decision', 'defender_locomotion'] : ['defender_observation', 'defender_decision', 'defender_locomotion'];
    return { member: { playerId, bindingHash: hash('binding:' + i), personHash: hash('person:' + i), baselineSourceId: 'baseline:' + i,
      reservedRevision: 0, reservedStateHash: hash('reserved:' + i), projectedStateHash: hash('projected:' + i) },
      calibrationReferences: routes.map(route => ({ route, calibrationReference: ref('pa_continuation_v1_execution_calibrations', playerId + ':' + route) })) };
  });
  const s = { sourceId: 'setup', sourceVersion: 'fixture-only-v1', capability: 'same_pa_retained_take_setup_v1', actionReference: ref('pa_take_successor_v1_action_plans'),
    postureReference: ref('batting_observation_v1_postures'), nextPhysicalPitchSourceId: 'next-pitch', participantInputs: participants };
  expect(samePaTakeSuccessorSourceInput(s)).toEqual(s);
  expect(() => samePaTakeSuccessorSourceInput({ ...s, participantInputs: participants.slice(1) })).toThrow();
  const missing = structuredClone(s); missing.participantInputs[0].calibrationReferences.pop(); expect(() => samePaTakeSuccessorSourceInput(missing)).toThrow();
  const duplicate = structuredClone(s); duplicate.participantInputs[0].calibrationReferences.push(duplicate.participantInputs[0].calibrationReferences[0]); expect(() => samePaTakeSuccessorSourceInput(duplicate)).toThrow();
  expect(() => samePaTakeSuccessorSourceInput({ ...s, physicalReady: true })).toThrow();
});

it('NT03 rejects invalid historical pitch references inside the phase and requires original main owners', () => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  const pin = ref('pa_take_successor_v1_pitch_actions') as Parameters<typeof readPitch>[1];
  const phase = <T>(body: () => T) => withSqliteReadTransaction(db, () => withSamePaContinuationReadPhase(db, body));
  try {
    expect(() => phase(() => {
      expect(() => readPitch(db, { ...pin, owner: 'pa_take_successor_v1_setups' } as unknown as typeof pin)).toThrow(/invalid/);
      expect(() => readPitch(db, pin)).toThrow(/expired/);
    })).toThrow(/^(?:same-PA continuation phase|lifecycle proof) expired$/);
    expect(() => phase(() => readPitch(db, pin))).toThrow(/pitch missing/);
    db.exec("ATTACH DATABASE ':memory:' AS peer");
    expect(() => phase(() => readPitch(db, pin))).toThrow(/original main owners/);
    db.exec('DETACH DATABASE peer');
    expect(() => phase(() => readPitch(db, pin))).toThrow(/pitch missing/);
  } finally { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); }
});

it('NT04 checks the Native owner boundary before a completed historical pitch memo hit', () => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  const pin = ref('pa_take_successor_v1_pitch_actions') as Parameters<typeof readPitch>[1];
  // Only the completed-memo return is stubbed. This checks public hit ordering,
  // not bundle authentication; saved cp11 comparison covers the real full replay.
  const completed = Object.freeze({ kind: 'explicit-completed-proof-boundary' });
  const originalMemo = continuation.memoSamePaContinuationRead;
  vi.spyOn(continuation, 'memoSamePaContinuationRead').mockImplementation(((connection, key, read) =>
    key.startsWith('successor-take-pitch:') ? completed : originalMemo(connection, key, read)) as typeof originalMemo);
  try {
    expect(() => withSqliteReadTransaction(db, () => withSamePaContinuationReadPhase(db, () => {
      expect(readPitch(db, pin)).toBe(completed);
      db.exec("ATTACH DATABASE ':memory:' AS peer");
      expect(() => readPitch(db, pin)).toThrow(/original main owners/);
      expect(() => readPitch(db, pin)).toThrow(/expired/);
    }))).toThrow(/^(?:same-PA continuation phase|lifecycle proof) expired$/);
  } finally { vi.restoreAllMocks(); if (db.isTransaction) db.exec('ROLLBACK'); db.close(); }
});
