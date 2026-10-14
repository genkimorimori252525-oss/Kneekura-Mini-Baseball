import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import * as runtime from './BatterRunnerRuntime';
import { runnerDecisionMotionModelFixture } from './PlayerRunnerDecisionMotionModelContracts.test-support';
import { openSqlitePlayerRunnerDecisionMotionModelStore, type DurablePlayerRunnerDecisionMotionModel } from './SqlitePlayerRunnerDecisionMotionModelStore';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { buildBatterSwingExitRecoveryTrajectory } from '../../core/sim/running/BatterSwingExitRecoveryTrajectory';
import type { BatterSwingExitRunTransitionParameters } from '../../core/sim/running/BatterSwingExitRunTransition';

type Source = { sourceId: string; sourceVersion: string; capability: 'batter_run_transition_model_v1'; careerId: string; playerId: string;
  personLinkSourceId: string; acceptedAtDay: number; runnerModelReference: { owner: 'world_player_runner_decision_motion_models'; sourceId: string; sourceHash: string; snapshotHash: string };
  parameters: BatterSwingExitRunTransitionParameters };
type Value = { source: Source; runnerModel: DurablePlayerRunnerDecisionMotionModel };
type Store = { accept(id: string): Value; read(id: string): Value | null; close(): void };
const open = (): ((path: string, authority?: { readAcceptedModel(id: string): Source | null }) => Store) => {
  const factory = (runtime as unknown as { openSqlitePlayerBatterRunTransitionModelStore?: unknown }).openSqlitePlayerBatterRunTransitionModelStore;
  expect(factory, 'accepted batter-run transition model Native owner is missing').toBeTypeOf('function');
  return factory as ReturnType<typeof open>;
};
const setup = () => {
  const f = runnerDecisionMotionModelFixture();
  const runner = f.track(openSqlitePlayerRunnerDecisionMotionModelStore(f.path, f.authority)).accept(f.source.sourceId);
  const source: Source = { sourceId: 'batter-run-model', sourceVersion: 'explicit-core-fixture-v1', capability: 'batter_run_transition_model_v1',
    careerId: runner.source.careerId, playerId: runner.source.playerId, personLinkSourceId: runner.source.personLinkSourceId,
    acceptedAtDay: runner.source.acceptedAtDay, runnerModelReference: { owner: 'world_player_runner_decision_motion_models', sourceId: runner.source.sourceId,
      sourceHash: hash(runner.source), snapshotHash: hash(runner) },
    parameters: { ticksPerSecond: runner.source.motion.ticksPerSecond, maximumBodyTurnRateRadiansPerSecond: Math.PI,
      lateralRealignmentAccelerationMps2: 4, backwardRecoveryAccelerationMps2: 3 } };
  const sources = new Map([[source.sourceId, source]]);
  return { ...f, runner, source, sources, accepted: { readAcceptedModel: (id: string) => sources.get(id) ?? null } };
};
it('BRM01 binds explicit recovery parameters to the original runner model and feeds the existing recovery law', () => {
  const factory = open(), f = setup();
  try {
    const store = f.track(factory(f.path, f.accepted)), value = store.accept(f.source.sourceId);
    expect(value).toEqual({ source: f.source, runnerModel: f.runner });
    const recovery = buildBatterSwingExitRecoveryTrajectory({ tick: 100, planarVelocity: { x: 0, z: 0 }, bodyForwardUnit: { x: 0, z: 1 } },
      { segments: [{ kind: 'line', start: { x: 0, z: 0 }, end: { x: 30, z: 0 } }] }, value.source.parameters);
    expect(recovery.transition.requiredTurnRadians).toBe(Math.PI / 2);
    expect(recovery.transition.turnRecoverySeconds).toBe(0.5);
    expect(value.runnerModel.source.motion).toEqual(f.runner.source.motion);
  } finally { f.close(); }
});
it('BRM02 preserves close/reopen authority-free replay and exact row conservation on retry', () => {
  const factory = open(), f = setup(); let reopened: Store | undefined;
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  try {
    const value = f.track(factory(f.path, f.accepted)).accept(f.source.sourceId);
    const rows = f.db.prepare('SELECT rowid,* FROM main.world_player_batter_run_transition_models').all(); f.closeHandles();
    reopened = factory(f.path);
    expect(reopened.read(f.source.sourceId)).toEqual(value); expect(reopened.accept(f.source.sourceId)).toEqual(value);
    const db = new DatabaseSync(f.path);
    try { expect(db.prepare('SELECT rowid,* FROM main.world_player_batter_run_transition_models').all()).toEqual(rows); } finally { db.close(); }
  } finally { reopened?.close(); f.close(); }
});
it('BRM03 rolls back a real insertion when its original runner model changes in the writer transaction', () => {
  const factory = open(), f = setup();
  try {
    const store = f.track(factory(f.path, f.accepted));
    const rows = f.db.prepare('SELECT rowid,* FROM world_player_runner_decision_motion_models').all();
    f.db.exec(`CREATE TRIGGER corrupt_runner_after_batter_model AFTER INSERT ON world_player_batter_run_transition_models
      BEGIN UPDATE world_player_runner_decision_motion_models SET source_hash='damaged' WHERE source_id='runner-model'; END`);
    expect(() => store.accept(f.source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT * FROM world_player_batter_run_transition_models').all()).toEqual([]);
    expect(f.db.prepare('SELECT rowid,* FROM world_player_runner_decision_motion_models').all()).toEqual(rows);
    f.db.exec('DROP TRIGGER corrupt_runner_after_batter_model'); expect(store.accept(f.source.sourceId).runnerModel).toEqual(f.runner);
  } finally { f.close(); }
});
it.each(['clock', 'person', 'future', 'parameter'] as const)('BRM04 rejects %s mismatch without an accepted receipt', fault => {
  const factory = open(), f = setup();
  try {
    const original = structuredClone(f.source), source: Source = { ...original,
      personLinkSourceId: fault === 'person' ? 'foreign' : original.personLinkSourceId,
      acceptedAtDay: fault === 'future' ? original.acceptedAtDay - 1 : original.acceptedAtDay,
      parameters: { ...original.parameters,
        ticksPerSecond: original.parameters.ticksPerSecond + (fault === 'clock' ? 1 : 0),
        lateralRealignmentAccelerationMps2: fault === 'parameter' ? 0 : original.parameters.lateralRealignmentAccelerationMps2 } };
    f.sources.set(source.sourceId, source); const store = f.track(factory(f.path, f.accepted));
    expect(() => store.accept(source.sourceId)).toThrow(); expect(store.read(source.sourceId)).toBeNull();
  } finally { f.close(); }
});
it('BRM05 rejects a changed accepted Source on retry and a hidden relocated archive claim', () => {
  const factory = open(), f = setup();
  try {
    const store = f.track(factory(f.path, f.accepted)), value = store.accept(f.source.sourceId);
    f.sources.set(f.source.sourceId, { ...f.source, parameters: { ...f.source.parameters, maximumBodyTurnRateRadiansPerSecond: 1 } });
    expect(() => store.accept(f.source.sourceId)).toThrow(); expect(store.read(f.source.sourceId)).toEqual(value);
    f.db.prepare("UPDATE main.world_player_batter_run_transition_models SET source_id='relocated'").run();
    expect(() => store.read(f.source.sourceId)).toThrow();
  } finally { f.close(); }
});
it('BRM06 rejects altered canonical archive bytes even with a matching last-key interpretation', () => {
  const factory = open(), f = setup();
  try {
    const store = f.track(factory(f.path, f.accepted)); store.accept(f.source.sourceId);
    const duplicate = json(f.source).replace('{', '{"sourceId":"foreign",');
    f.db.prepare('UPDATE main.world_player_batter_run_transition_models SET source_json=?').run(duplicate);
    expect(() => store.read(f.source.sourceId)).toThrow();
  } finally { f.close(); }
});
it('BRM07 rejects a lookalike owner schema before accepting a model', () => {
  const factory = open(), f = setup();
  try {
    f.db.exec('CREATE TABLE world_player_batter_run_transition_models(source_id TEXT PRIMARY KEY,ownership_key TEXT,source_json TEXT,source_hash TEXT,snapshot_json TEXT,snapshot_hash TEXT)');
    expect(() => factory(f.path, f.accepted)).toThrow(/schema/);
    expect(f.db.prepare('SELECT * FROM world_player_batter_run_transition_models').all()).toEqual([]);
  } finally { f.close(); }
});
it('BRM08 refuses to recreate a missing original when a typed swing-exit child still claims it', () => {
  const factory = open(), f = setup();
  try {
    f.db.exec('CREATE TABLE world_batter_swing_exit_states(source_json TEXT,snapshot_json TEXT)');
    f.db.prepare('INSERT INTO world_batter_swing_exit_states VALUES (?,?)').run(json({ transitionModelReference: { owner: 'world_player_batter_run_transition_models', sourceId: f.source.sourceId, sourceHash: hash(f.source), snapshotHash: 'a'.repeat(64) } }), '{}');
    expect(() => factory(f.path, f.accepted)).toThrow(/surviving typed dependent claim/);
    expect(f.db.prepare("SELECT 1 FROM sqlite_master WHERE name='world_player_batter_run_transition_models'").get()).toBeUndefined();
  } finally { f.close(); }
});
