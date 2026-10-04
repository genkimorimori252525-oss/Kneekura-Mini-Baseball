import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { beforeEach, expect, it, vi } from 'vitest';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedWorldFieldExecutionEvidenceFromSqlite, openSqliteBattedWorldFieldExecutionStore } from './SqliteBattedWorldFieldExecutionStore';
const state = vi.hoisted(() => ({ base: null as any, rootReads: 0, replays: 0 }));
vi.mock('./SqliteBattedWorldFieldStore', () => ({ battedWorldFieldEvidenceFromSqlite: () => ({
  read: () => { state.rootReads++; return state.base; }, scope: () => [state.base],
}) }));
vi.mock('./SqliteBattedWorldContinuationStore', () => ({ battedWorldResponseInput: () => ({}) }));
vi.mock('./WholePlayPhysicalHistoryFromPrefix', () => ({ wholePlayPhysicalHistoryFromPrefix: () => {
  state.replays++; return { fixture: 'tiny-authenticated-history' };
} }));
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
beforeEach(() => {
  state.rootReads = 0; state.replays = 0;
  state.base = { source: { sourceId: 'field', sourceVersion: 'v1' }, revision: 1,
    response: { model: { gameId: 'game' }, touch: { worldContact: { flight: { source: { physicalPitchSourceId: 'pitch' } } } } },
    geometry: { geometry: {} }, field: { motion: {} } };
});
const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'physical-read-pair-')), path = join(directory, 'state.sqlite');
  // Public store creates the real owner schema only. No physical fixture runs.
  const store = openSqliteBattedWorldFieldExecutionStore(path, { read: () => state.base });
  const db = new DatabaseSync(path), owner = battedWorldFieldExecutionEvidenceFromSqlite(db);
  db.exec('CREATE TABLE batted_world_field_actions (source_id TEXT, physical_pitch_source_id TEXT)');
  const source = { sourceId: 'one', sourceVersion: 'v1', baseFieldSourceId: 'field', previousExecutionSourceId: null, action: { kind: 'whole_play_history' as const } };
  const value = owner.derive(source);
  db.prepare('INSERT INTO batted_world_field_executions VALUES (?,?,?,?,?,?,?,?,?,?)').run('one', 'pitch', 'field', null, 1, 'game', json(source), hash(source), json(value), hash(value));
  db.prepare('INSERT INTO batted_world_field_execution_heads VALUES (?,?,?,?)').run('pitch', 'field', 'one', 1);
  state.rootReads = 0; state.replays = 0;
  return { db, path, owner, store, value, close() { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); store.close(); rmSync(directory, { recursive: true, force: true }); } };
};
it('returns the value and exact fully authenticated prefix from a single replay, without changing public store shape', () => {
  const x = fixture(); try {
    const pair = x.owner.readWithExecutions('one')!;
    expect(json(pair.value)).toBe(json(x.value)); expect(json(pair.executions)).toBe(json([x.value]));
    expect(pair.value).toBe(pair.executions.at(-1)); expect([state.rootReads, state.replays]).toEqual([1, 1]);
    expect(json(x.owner.read('one'))).toBe(json(pair.value)); expect([state.rootReads, state.replays]).toEqual([2, 2]);
    expect(x.store).not.toHaveProperty('readWithExecutions');
  } finally { x.close(); }
});
it('returns null for a missing identity and keeps identity, input, root, metadata and snapshot validation', () => {
  const x = fixture(); try {
    expect(x.owner.readWithExecutions('missing')).toBeNull();
    expect(() => x.owner.readWithExecutions(' ')).toThrow(/invalid/);
    x.db.exec('BEGIN');
    x.db.prepare('UPDATE batted_world_field_executions SET source_id=?').run('moved');
    expect(() => x.owner.readWithExecutions('one')).toThrow(/identity ownership/); x.db.exec('ROLLBACK; BEGIN');
    x.db.prepare('UPDATE batted_world_field_executions SET source_json=?').run(json({ ...x.value.source, unexpected: true }));
    expect(() => x.owner.readWithExecutions('one')).toThrow(/invalid/); x.db.exec('ROLLBACK');
    const base = state.base; state.base = null;
    expect(() => x.owner.readWithExecutions('one')).toThrow(/original field is missing/); state.base = base;
    x.db.exec('BEGIN'); x.db.prepare('UPDATE batted_world_field_execution_heads SET revision=2').run();
    expect(() => x.owner.readWithExecutions('one')).toThrow(/head/); x.db.exec('ROLLBACK; BEGIN');
    x.db.prepare('UPDATE batted_world_field_executions SET snapshot_hash=?').run('corrupt');
    expect(() => x.owner.readWithExecutions('one')).toThrow(/snapshot/); x.db.exec('ROLLBACK');
  } finally { x.close(); }
});
it('freshly authenticates each call, rejects same-connection corruption and observes peer WAL corruption after the pinned snapshot ends', () => {
  const x = fixture(), peer = new DatabaseSync(x.path); try {
    expect(x.db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    expect(x.db.prepare('PRAGMA database_list').all().find(r => r.name === 'main')!.file).toBe(x.path);
    x.db.exec('BEGIN'); const first = x.owner.readWithExecutions('one')!;
    expect(json(x.owner.readWithExecutions('one'))).toBe(json(first)); expect(state.replays).toBe(2);
    x.db.prepare('UPDATE batted_world_field_executions SET snapshot_hash=?').run('local-corruption');
    expect(() => x.owner.readWithExecutions('one')).toThrow(/snapshot/); x.db.exec('ROLLBACK; BEGIN');
    expect(json(x.owner.readWithExecutions('one'))).toBe(json(first));
    peer.prepare('UPDATE batted_world_field_executions SET snapshot_hash=?').run('peer-corruption');
    expect(json(x.owner.readWithExecutions('one'))).toBe(json(first)); x.db.exec('COMMIT; BEGIN');
    expect(() => x.owner.readWithExecutions('one')).toThrow(/snapshot/);
  } finally { peer.close(); x.close(); }
});
