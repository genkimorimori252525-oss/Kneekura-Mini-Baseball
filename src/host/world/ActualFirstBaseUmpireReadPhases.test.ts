import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedWorldFieldEvidenceFromSqlite, openSqliteBattedWorldFieldStore } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite, openSqliteBattedWorldFieldExecutionStore } from './SqliteBattedWorldFieldExecutionStore';
import { openSqliteActualFirstBaseUmpireStore } from './SqliteActualFirstBaseUmpireStore';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';

// Reuse the tiny physical-traversal fixture's real SQLite field/execution owners.
// Only lower physical sampling and Umpire domain outputs are replaced. This checks
// phase lifetime, raw authentication and WAL isolation, not Native game physics.
const state = vi.hoisted(() => ({ response: null as any, bases: null as any, fields: 0, executions: 0,
  between: null as null | (() => void), accepted: null as null | (() => void) }));
vi.mock('./PhysicalPitchEvidenceFromSqlite', () => ({ readOriginalPhysicalPitchPrefixFromSqlite: () => [
  { source: { sourceId: 'pitch' }, frame: { gameId: 'game' } },
] }));
vi.mock('./SqliteBattedContactResponseStore', () => ({ battedContactResponseEvidenceFromSqlite: () => ({ read: () => state.response, current: () => {} }) }));
vi.mock('./SqliteBattedWorldBaseGeometryStore', () => ({ battedWorldBaseGeometryEvidenceFromSqlite: () => ({ read: () => state.bases, current: () => {} }) }));
vi.mock('../../core/sim/ball/BattedWorldFieldMotion', async importOriginal => ({
  ...await importOriginal<typeof import('../../core/sim/ball/BattedWorldFieldMotion')>(),
  createBattedWorldFieldGeometry: () => ({ tinyGeometry: true }),
  deriveInitialBattedWorldFieldMotion: () => { state.fields++; return { motion: { cursor: null } }; },
}));
vi.mock('./SqliteBattedWorldContinuationStore', () => ({ battedWorldResponseInput: () => ({}) }));
vi.mock('./SqliteBattedWorldMotionStore', () => ({ battedWorldMotionCommandsInput: (v: unknown) => v, battedWorldMotionPrimitiveCommands: () => [] }));
vi.mock('./WholePlayPhysicalHistoryFromPrefix', () => ({ wholePlayPhysicalHistoryFromPrefix: () => {
  state.executions++; return { fixture: 'tiny-authenticated-history' };
} }));
vi.mock('./ActualFirstBaseUmpire', async importOriginal => ({
  ...await importOriginal<typeof import('./ActualFirstBaseUmpire')>(),
  sampleActualFirstBaseUmpireObservation: (source: any, setup: any, current: any) => {
    state.between?.();
    return { source, setup, gameId: 'game', physicalPitchSourceId: 'pitch', playId: 1, batterRunnerId: 'batter', outsAtStart: 0,
      clock: { originTick: 0, ticksPerSecond: 1000 }, availability: { originTick: 0, tick: 1000, elapsedSeconds: 1 },
      ruleEvidenceRevision: 2, ruleEvidenceHash: 'rule', physicalPrefixHash: JSON.stringify(current),
      perception: { kind: 'pending', reason: 'calibration_unavailable' }, eventEvidence: null };
  },
  deriveActualFirstBaseUmpireCall: (source: any, observation: any, current: any) => ({ source, observation,
    currentExecutionHash: JSON.stringify(current), advancedThrough: { originTick: 0, tick: 1000, elapsedSeconds: 1 },
    schedule: { kind: 'pending', reason: 'calibration_unavailable' }, onFieldCall: null }),
}));

const { DatabaseSync: Sqlite } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const setup = { sourceId: 'setup', sourceVersion: 'v1', gameId: 'game', physicalPitchSourceId: 'pitch', umpireId: 'umpire', pose: null, attention: null, calibration: null };
const observation = { sourceId: 'observation', sourceVersion: 'v1', setupSourceId: 'setup', ruleExecutionSourceId: 'two' };
const call = { sourceId: 'call', sourceVersion: 'v1', observationSourceId: 'observation', currentExecutionSourceId: 'two' };
const resetCounts = () => { state.fields = 0; state.executions = 0; };
const counts = () => [state.fields, state.executions];
beforeEach(() => {
  resetCounts(); state.between = null; state.accepted = null;
  const initialBall = { tick: 0 }, flight = { source: { sourceId: 'flight', physicalPitchSourceId: 'pitch', searchDurationTicks: 0 }, flight: { initialBall } };
  state.response = freeze({ source: { sourceId: 'response', sourceVersion: 'v1' }, model: { gameId: 'game' },
    touch: { worldContact: { source: { previousContactSourceId: null }, flight, result: { kind: 'airborne', throughTick: 0, ball: initialBall } } },
    result: { kind: 'airborne', ball: initialBall } });
  state.bases = freeze({ source: { sourceId: 'bases', flightSourceId: 'flight' }, flight, fixture: { game_id: 'game' }, geometry: {} });
});
const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'umpire-read-phases-')), path = join(directory, 'state.sqlite');
  const fieldsStore = openSqliteBattedWorldFieldStore(path, { read: () => state.response }, { read: () => state.bases });
  const executionStore = openSqliteBattedWorldFieldExecutionStore(path, fieldsStore);
  const db = new Sqlite(path), fields = battedWorldFieldEvidenceFromSqlite(db), executions = battedWorldFieldExecutionEvidenceFromSqlite(db);
  const owner = openSqliteActualFirstBaseUmpireStore(path, { readAcceptedSetup: () => setup,
    readAcceptedObservation: () => { state.accepted?.(); return observation; }, readAcceptedCall: () => { state.accepted?.(); return call; } });
  db.exec("CREATE TABLE physical_pitch_progress_actions(source_id TEXT,game_id TEXT,play_id INTEGER); INSERT INTO physical_pitch_progress_actions VALUES('pitch','game',1); CREATE TABLE mutation_witness(value TEXT);");
  const geometrySource = { sourceId: 'geometry', sourceVersion: 'v1', baseGeometrySourceId: 'bases', baseModels: {} } as any;
  const geometry = fields.deriveGeometry(geometrySource);
  db.prepare('INSERT INTO batted_world_field_geometries VALUES(?,?,?,?,?,?,?)').run('geometry', 'bases', 'game', json(geometrySource), hash(geometrySource), json(geometry), hash(geometry));
  const source = { sourceId: 'field', sourceVersion: 'v1', responseSourceId: 'response', geometrySourceId: 'geometry',
    previousFieldSourceId: null, availableAtTick: 0, throughTick: 0, commands: [] };
  const field = fields.derive(source);
  db.prepare('INSERT INTO batted_world_field_actions VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('field', 'pitch', 'response', 'geometry', null, 1, 'game', json(source), hash(source), json(field), hash(field));
  db.prepare('INSERT INTO batted_world_field_heads VALUES(?,?,?,?,?)').run('pitch', 'response', 'geometry', 'field', 1);
  for (const [index, sourceId] of ['one', 'two'].entries()) {
    const executionSource = { sourceId, sourceVersion: 'v1', baseFieldSourceId: 'field', previousExecutionSourceId: index ? 'one' : null, action: { kind: 'whole_play_history' as const } };
    const value = executions.derive(executionSource);
    db.prepare('INSERT INTO batted_world_field_executions VALUES(?,?,?,?,?,?,?,?,?,?)').run(sourceId, 'pitch', 'field', index ? 'one' : null, index + 1, 'game', json(executionSource), hash(executionSource), json(value), hash(value));
    db.prepare('INSERT OR REPLACE INTO batted_world_field_execution_heads VALUES(?,?,?,?)').run('pitch', 'field', sourceId, index + 1);
  }
  let writer: DatabaseSync | null = null;
  const witness = witnessSqliteWrite('INSERT INTO actual_first_base_umpire_setups VALUES (?,?,?,?,?,?,?,?,?,?,?)', connection => {
    writer = connection; return true;
  });
  try { owner.acceptSetup('setup'); expect(witness.wasReached()).toBe(true); } finally { witness.close(); }
  resetCounts();
  return { db, path, owner, writer: writer!, close() { state.between = null; state.accepted = null; db.close(); owner.close(); executionStore.close(); fieldsStore.close(); rmSync(directory, { recursive: true, force: true }); } };
};

it('authenticates each physical node once per unchanged phase and starts independent reads fresh', () => {
  const x = fixture(); try {
    const stages: Record<string, number[]> = {};
    const observed = x.owner.observe('observation'); stages.observe = counts(); resetCounts();
    const called = x.owner.advanceCall('call'); stages.call = counts(); resetCounts();
    expect(x.owner.readObservation('observation')).toEqual(observed); stages.readObservation = counts(); resetCounts();
    expect(x.owner.readCall('call')).toEqual(called); stages.readCall = counts(); resetCounts();
    expect(x.owner.advanceCall('call')).toEqual(called); stages.retry = counts(); resetCounts();
    expect(x.owner.readCall('call')).toEqual(called); stages.independentRead = counts();
    expect(stages).toEqual({ observe: [3, 6], call: [3, 6], readObservation: [1, 2], readCall: [1, 2], retry: [2, 4], independentRead: [1, 2] });
    resetCounts();
    expect(x.owner.readAvailableCall('call', { originTick: 0, tick: 1000, elapsedSeconds: 1 })).toBeNull();
    expect(counts()).toEqual([1, 2]);
  } finally { x.close(); }
});

it('runs the accepted callback outside the prior read snapshot and reauthenticates after it', () => {
  const x = fixture(); try {
    state.accepted = () => {
      expect(x.writer.isTransaction).toBe(false);
      expect(x.writer.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
      x.writer.exec("INSERT INTO mutation_witness VALUES('accepted callback')");
    };
    x.owner.observe('observation'); x.owner.advanceCall('call');
    expect(x.db.prepare('SELECT count(*) AS n FROM mutation_witness').get()!.n).toBe(2);
    state.accepted = () => {
      expect(x.writer.isTransaction).toBe(false);
      expect(x.writer.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
      x.writer.exec("UPDATE batted_world_field_executions SET snapshot_hash='corrupt' WHERE source_id='one'");
    };
    expect(() => x.owner.advanceCall('call')).toThrow(/snapshot/);
    expect(x.writer.isTransaction).toBe(false);
    expect(x.db.prepare('SELECT snapshot_hash FROM batted_world_field_executions WHERE source_id=?').get('one')!.snapshot_hash).toBe('corrupt');
    expect(x.db.prepare('SELECT count(*) AS n FROM actual_first_base_umpire_calls').get()!.n).toBe(1);
  } finally { x.close(); }
});

it('pins one public read to its WAL snapshot and sees peer corruption on the next independent read', () => {
  const x = fixture(); try {
    x.owner.observe('observation'); const original = x.owner.advanceCall('call');
    expect(x.db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    state.between = () => {
      state.between = null;
      expect(x.writer.isTransaction).toBe(true);
      x.db.exec("UPDATE batted_world_field_executions SET snapshot_hash='corrupt' WHERE source_id='one'");
    };
    expect(x.owner.readCall('call')).toEqual(original);
    expect(() => x.owner.readCall('call')).toThrow(/snapshot/);
    expect(x.writer.isTransaction).toBe(false);
  } finally { x.close(); }
});

it('starts prewrite from fresh dependencies after a committed peer change following preflight', () => {
  const x = fixture(), descriptor = Object.getOwnPropertyDescriptor(Sqlite.prototype, 'exec')!;
  const original = descriptor.value as DatabaseSync['exec']; let changed = false;
  try {
    Object.defineProperty(Sqlite.prototype, 'exec', { ...descriptor, value: function(this: DatabaseSync, sql: string) {
      if (this === x.writer && sql === 'BEGIN IMMEDIATE' && !changed) {
        changed = true;
        x.db.exec("UPDATE batted_world_field_executions SET snapshot_hash='peer-corrupt' WHERE source_id='one'");
      }
      return original.call(this, sql);
    } });
    expect(() => x.owner.observe('observation')).toThrow(/snapshot/); expect(changed).toBe(true);
    expect(x.db.prepare('SELECT count(*) AS n FROM actual_first_base_umpire_observations').get()!.n).toBe(0);
    expect(x.db.prepare('SELECT snapshot_hash FROM batted_world_field_executions WHERE source_id=?').get('one')!.snapshot_hash).toBe('peer-corrupt');
    expect(x.writer.isTransaction).toBe(false);
  } finally { Object.defineProperty(Sqlite.prototype, 'exec', descriptor); x.close(); }
});

it.each(['observation', 'call'] as const)('reauthenticates after the %s INSERT and rolls back a trigger mutation', kind => {
  const x = fixture(); let witness: ReturnType<typeof witnessSqliteWrite> | undefined;
  try {
    if (kind === 'call') x.owner.observe('observation');
    const table = kind === 'call' ? 'actual_first_base_umpire_calls' : 'actual_first_base_umpire_observations';
    const before = x.db.prepare('SELECT * FROM batted_world_field_executions ORDER BY revision').all();
    x.db.exec(`CREATE TRIGGER corrupt_physical AFTER INSERT ON ${table} BEGIN
      UPDATE batted_world_field_executions SET snapshot_hash='corrupt' WHERE source_id='one'; END;`);
    witness = witnessSqliteWrite(`INSERT INTO ${table} VALUES (?,?,?,?,?,?,?,?,?,?,?)`, writer => {
      expect(writer.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
      return writer.prepare('SELECT snapshot_hash FROM batted_world_field_executions WHERE source_id=?').get('one')!.snapshot_hash === 'corrupt';
    });
    const accept = () => kind === 'call' ? x.owner.advanceCall('call') : x.owner.observe('observation');
    expect(accept).toThrow(/snapshot/); expect(witness.wasReached()).toBe(true);
    witness.close(); witness = undefined;
    expect(x.db.prepare('SELECT * FROM batted_world_field_executions ORDER BY revision').all()).toEqual(before);
    expect(x.db.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n).toBe(0);
    expect(x.writer.isTransaction).toBe(false);
    expect(x.writer.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    x.db.exec('DROP TRIGGER corrupt_physical'); expect(accept().source.sourceId).toBe(kind);
  } finally { witness?.close(); x.close(); }
});

it('rejects a writer-local mutation between sibling reads and clears failed phase state', () => {
  const x = fixture(); try {
    x.owner.observe('observation'); const original = x.owner.advanceCall('call');
    state.between = () => x.writer.exec("INSERT INTO mutation_witness VALUES('during read')");
    expect(() => x.owner.readCall('call')).toThrow(/read.?only/i);
    expect(x.db.prepare('SELECT count(*) AS n FROM mutation_witness').get()!.n).toBe(0);
    expect(x.writer.isTransaction).toBe(false);
    expect(x.writer.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    state.between = null;
    expect(x.owner.readCall('call')).toEqual(original);
  } finally { x.close(); }
});
