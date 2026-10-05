import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualFirstBasePlayEndEvidenceFromSqlite } from './ActualFirstBasePlayEndEvidenceFromSqlite';
import { battedWorldFieldEvidenceFromSqlite, openSqliteBattedWorldFieldStore } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite, openSqliteBattedWorldFieldExecutionStore } from './SqliteBattedWorldFieldExecutionStore';

// Tiny owner-boundary tests. Field/execution SQLite ownership, source parsing,
// archive hashes and historical bounds are real. Only lower physical/model work
// and unrelated PlayEnd membership plumbing are replaced. No Native fixture runs.
const state = vi.hoisted(() => ({ response: null as any, bases: null as any, fields: 0, executions: 0,
  consume: null as null | ((db: DatabaseSync, current: boolean) => any),
  between: null as null | ((db: DatabaseSync) => void), modes: [] as boolean[] }));
vi.mock('./SqliteBattedContactResponseStore', () => ({ battedContactResponseEvidenceFromSqlite: () => ({
  read: () => state.response, current: () => {},
}) }));
vi.mock('./SqliteBattedWorldBaseGeometryStore', () => ({ battedWorldBaseGeometryEvidenceFromSqlite: () => ({
  read: () => state.bases, current: () => {},
}) }));
vi.mock('../../core/sim/ball/BattedWorldFieldMotion', async importOriginal => ({
  ...await importOriginal<typeof import('../../core/sim/ball/BattedWorldFieldMotion')>(),
  createBattedWorldFieldGeometry: () => ({ tinyGeometry: true }),
  deriveInitialBattedWorldFieldMotion: () => { state.fields++; return { motion: { cursor: null } }; },
}));
vi.mock('./SqliteBattedWorldContinuationStore', () => ({ battedWorldResponseInput: () => ({}) }));
vi.mock('./SqliteBattedWorldMotionStore', () => ({ battedWorldMotionCommandsInput: (v: unknown) => v,
  battedWorldMotionPrimitiveCommands: () => [] }));
vi.mock('./WholePlayPhysicalHistoryFromPrefix', () => ({ wholePlayPhysicalHistoryFromPrefix: () => {
  state.executions++; return { fixture: 'tiny-authenticated-history' };
} }));
vi.mock('./SqliteActualLivePlayRuntimeStore', () => ({ actualLiveRuntimeEvidenceFromSqlite: (db: DatabaseSync) => ({
  read: () => ({ source: { physicalPitchSourceId: 'pitch' }, gameId: 'game', playId: 1, originalPitchHash: 'pitch-hash',
    membership: { scopeId: 'scope', participants: [], producers: [] } }),
  admissions: () => { state.between?.(db); state.consume!(db, false); return []; },
}) }));
vi.mock('./ActualLivePlayEvidenceFromSqlite', () => ({ actualLivePlayEvidenceFromSqlite: (db: DatabaseSync) => {
  const deriveWithPhysicalPrefix = (_source: unknown, current = false) => {
    state.modes.push(current); const prefix = state.consume!(db, current);
    return { prefix, value: { scope: { gameId: 'game', playId: 1, originalPitchHash: 'pitch-hash', scopeId: 'scope',
      participation: 'supported_empty_base', participants: [], producers: [], physicalReferences: [] } } };
  };
  return { deriveWithPhysicalPrefix, derive: (source: unknown, current = false) => deriveWithPhysicalPrefix(source, current).value };
}, actualLivePlayMotorAdopted: () => false }));

const { DatabaseSync: Sqlite, constants } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const request = { sourceId: 'end', sourceVersion: 'v1', runtimeSourceId: 'runtime', baseFieldSourceId: 'field',
  executionSourceId: 'two', ruleConsumptionSourceId: 'rule', umpireCallSourceId: 'call', communicationSourceId: 'communication' };
beforeEach(() => {
  state.fields = 0; state.executions = 0; state.between = null; state.modes = [];
  const initialBall = { tick: 0 }, flight = { source: { sourceId: 'flight', physicalPitchSourceId: 'pitch', searchDurationTicks: 0 }, flight: { initialBall } };
  state.response = freeze({ source: { sourceId: 'response', sourceVersion: 'v1' }, model: { gameId: 'game' },
    touch: { worldContact: { source: { previousContactSourceId: null }, flight, result: { kind: 'airborne', throughTick: 0, ball: initialBall } } },
    result: { kind: 'airborne', ball: initialBall } });
  state.bases = freeze({ source: { sourceId: 'bases', flightSourceId: 'flight' }, flight, fixture: { game_id: 'game' }, geometry: {} });
  state.consume = (db, current) => {
    const fields = battedWorldFieldEvidenceFromSqlite(db), executions = battedWorldFieldExecutionEvidenceFromSqlite(db);
    const baseField = fields.read('field')!;
    const prefix = { baseField, fields: fields.scope(baseField, 'field'), executions: executions.scope(baseField, 'two') };
    if (current) { fields.current(baseField); executions.current(prefix.executions.at(-1)!); }
    return prefix;
  };
});
const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'physical-root-traversal-')), path = join(directory, 'state.sqlite');
  const fieldsStore = openSqliteBattedWorldFieldStore(path, { read: () => state.response }, { read: () => state.bases });
  const executionStore = openSqliteBattedWorldFieldExecutionStore(path, fieldsStore);
  const db = new Sqlite(path), fields = battedWorldFieldEvidenceFromSqlite(db), executions = battedWorldFieldExecutionEvidenceFromSqlite(db);
  db.exec('CREATE TABLE actual_live_play_runtimes(source_id TEXT); CREATE TABLE actual_live_play_admissions(source_id TEXT); CREATE TABLE mutation_witness(value TEXT)');
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
  state.fields = 0; state.executions = 0;
  const owner = actualFirstBasePlayEndEvidenceFromSqlite(db);
  return { db, path, owner, fields, executions, close() { state.between = null; if (db.isTransaction) db.exec('ROLLBACK'); db.close(); executionStore.close(); fieldsStore.close(); rmSync(directory, { recursive: true, force: true }); } };
};
const pending = (x: ReturnType<typeof fixture>, current = false) => {
  const result = x.owner.derive(request, current);
  expect(result).toEqual({ source: request, kind: 'pending', playEnd: null, pendingReasons: ['current_first_base_rule_coverage_pending'] });
  return result;
};

it('derives each immutable field/execution node once across sibling reads in one unchanged operation', () => {
  const x = fixture(); try {
    x.db.exec('BEGIN'); pending(x);
    expect([state.fields, state.executions]).toEqual([1, 2]);
    expect(x.db.isTransaction).toBe(true);
  } finally { x.close(); }
});
it('starts a fresh traversal for every independent derive, even within the same transaction', () => {
  const x = fixture(); try {
    x.db.exec('BEGIN'); pending(x); pending(x);
    expect([state.fields, state.executions]).toEqual([2, 4]);
  } finally { x.close(); }
});
it('does not retain results for plain owner reads or for an operation without an active transaction', () => {
  const x = fixture(); try {
    // The existing nontransactional root deliberately reads the physical prefix a third time.
    pending(x); expect(state.executions).toBe(6);
    state.executions = 0; x.db.exec('BEGIN'); x.executions.read('two'); x.executions.read('two'); expect(state.executions).toBe(4);
  } finally { x.close(); }
});
it.each([
  "INSERT INTO mutation_witness VALUES('changed')",
  'CREATE TABLE main.schema_change(value TEXT)',
  'CREATE TEMP TABLE schema_change(value TEXT)',
  'ROLLBACK; BEGIN',
  'SAVEPOINT child; CREATE TEMP VIEW batted_world_field_executions AS SELECT * FROM main.batted_world_field_executions; ROLLBACK TO child; RELEASE child',
])('rejects an intervening mutation without returning retained evidence: %s', sql => {
  const x = fixture(); try {
    x.db.exec('BEGIN'); state.between = db => db.exec(sql);
    expect(() => x.owner.derive(request)).toThrow(/read.?only|transaction|savepoint|changed/i);
    expect(x.db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  } finally { x.close(); }
});
it('rejects TEMP DDL prepared before the traversal rather than relying on prepare-time inspection', () => {
  const x = fixture(); try {
    const mutation = x.db.prepare('CREATE TEMP VIEW batted_world_field_executions AS SELECT * FROM main.batted_world_field_executions');
    x.db.exec('BEGIN'); state.between = () => { mutation.run(); };
    expect(() => x.owner.derive(request)).toThrow(/read.?only|schema|changed/i);
  } finally { x.close(); }
});
it.each([0, 1])('restores the prior query_only=%s setting after success and after the original error', setting => {
  const x = fixture(), original = new Error('original sibling failure'); try {
    x.db.exec(`BEGIN; PRAGMA query_only=${setting}`); pending(x);
    expect(x.db.prepare('PRAGMA query_only').get()!.query_only).toBe(setting);
    state.between = () => { throw original; };
    expect(() => x.owner.derive(request)).toThrow(original);
    expect(x.db.prepare('PRAGMA query_only').get()!.query_only).toBe(setting);
    state.between = null; pending(x);
  } finally { x.close(); }
});
it('preserves the connection authorizer instead of replacing a policy it cannot restore', () => {
  const x = fixture(); try {
    x.db.setAuthorizer(code => code === constants.SQLITE_DELETE ? constants.SQLITE_DENY : constants.SQLITE_OK);
    x.db.exec('BEGIN'); pending(x);
    expect(() => x.db.prepare('DELETE FROM mutation_witness')).toThrow(/authorized/i);
  } finally { x.close(); }
});
it('keeps the pinned WAL snapshot and freshly rejects peer corruption in the next transaction', () => {
  const x = fixture(), peer = new Sqlite(x.path); try {
    x.db.exec('BEGIN'); state.between = () => { state.between = null; peer.prepare("UPDATE batted_world_field_executions SET snapshot_hash='corrupt' WHERE source_id='one'").run(); };
    pending(x); x.db.exec('COMMIT; BEGIN');
    expect(() => x.owner.derive(request)).toThrow(/snapshot/);
  } finally { peer.close(); x.close(); }
});
it('still checks current heads after historical authentication and keeps modes distinct', () => {
  const x = fixture(); try {
    x.db.exec('BEGIN'); pending(x); x.db.exec('COMMIT');
    x.db.prepare('UPDATE batted_world_field_execution_heads SET revision=99').run();
    x.db.exec('BEGIN'); expect(() => x.owner.derive(request, true)).toThrow(/head/);
    expect(state.modes).toEqual([false, true]);
  } finally { x.close(); }
});
it('clears inner traversal state without losing the outer read-only setting or original result', () => {
  const x = fixture(); try {
    x.db.exec('BEGIN'); state.between = () => { state.between = null; pending(x); };
    pending(x); expect(state.executions).toBe(4);
    expect(x.db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  } finally { x.close(); }
});
it.each(['partial', 'changed-version'] as const)('does not let a %s caller field borrow an authenticated execution prefix', change => {
  const x = fixture(); try {
    x.db.exec('BEGIN'); state.between = () => {
      const original = x.fields.read('field')!;
      const supplied = change === 'partial' ? { source: original.source }
        : { ...original, source: { ...original.source, sourceVersion: 'foreign-v2' } };
      expect(() => x.executions.scope(supplied as any, 'one')).toThrow();
    };
    pending(x);
  } finally { x.close(); }
});
