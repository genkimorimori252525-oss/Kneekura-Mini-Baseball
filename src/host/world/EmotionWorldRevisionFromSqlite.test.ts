import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openSqliteWorldControlStore } from './SqliteWorldControlStore';
import { request, value } from '../../core/world/psychology/execution/ExecutionFixtures.test-support';
import { prepareEmotionExecution } from '../../core/world/psychology/execution/ExecutionPreparation';
import { acceptEmotionExecution } from '../../core/world/psychology/execution/ExecutionAcceptance';
const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
const modules = import.meta.glob('./EmotionWorldRevisionFromSqlite.ts');
const implementation = async () => {
  const load = modules['./EmotionWorldRevisionFromSqlite.ts'];
  expect(load, 'ACTUAL_EMOTION_WORLD_REVISION_OWNER_MISSING').toBeTypeOf('function');
  return await load() as typeof import('./EmotionWorldRevisionFromSqlite');
};
const fixture = () => {
  const dir = mkdtempSync(join(tmpdir(), 'emotion-world-author-')), path = join(dir, 'world.sqlite'), db = new Native(path);
  db.exec('CREATE TABLE world_season_heads(career_id TEXT,revision INTEGER);CREATE TABLE world_club_heads(career_id TEXT,club_id TEXT,revision INTEGER)');
  db.prepare('INSERT INTO world_season_heads VALUES(?,0)').run('career');
  db.prepare('INSERT INTO world_club_heads VALUES(?,?,0)').run('career', 'club');
  const owner = openSqliteWorldControlStore(path);
  owner.initialize({ careerId: 'career', worldRevision: 0, control: { schemaVersion: 1, revision: 0, controllerId: 'fixture-controller',
    controlledClubId: null, domainIds: ['BATTING'], manualDomainIds: [] } });
  return { db, owner, close() { owner.close(); db.close(); rmSync(dir, { recursive: true, force: true }); } };
};
const proof = <T>(db: import('node:sqlite').DatabaseSync, fn: () => T) => {
  db.exec('PRAGMA query_only=1'); try { return fn(); } finally { db.exec('PRAGMA query_only=0'); }
};
const acceptance = () => {
  const raw = structuredClone(request());
  const frame = { ...raw.frame, worldRevision: 0 };
  const input = { ...raw, frame, baseline: { ...raw.baseline, frame } };
  return value(acceptEmotionExecution(input, value(prepareEmotionExecution(input))));
};
it('EW01 reads the existing normal World owner and appends only its exact emotion revision event', async () => {
  const api = await implementation(), f = fixture();
  try {
    f.db.exec('BEGIN IMMEDIATE');
    const before = proof(f.db, () => api.readEmotionWorldRevisionFromSqlite(f.db, 'career'))!;
    expect(before.head).toEqual(f.owner.readHead('career'));
    const changes = Number(f.db.prepare('SELECT total_changes() n').get()!.n), accepted = acceptance();
    const after = api.appendEmotionWorldRevisionFromSqlite(f.db, before, accepted);
    expect(after.head.worldRevision).toBe(1); expect(after.head.control).toEqual(before.head.control);
    expect(Number(f.db.prepare('SELECT total_changes() n').get()!.n) - changes).toBe(2);
    f.db.exec('COMMIT'); expect(f.owner.readHead('career')).toEqual(after.head);
    const row = f.db.prepare('SELECT * FROM world_decision_revision_events').get()!;
    expect(row.source_kind).toBe('EMOTION_EXECUTION'); expect(row.source_event_id).toBe(accepted.executionId);
  } finally { if (f.db.isTransaction) f.db.exec('ROLLBACK'); f.close(); }
});
it('EW02 stale World or changed Core acceptance rejects before any effect', async () => {
  const api = await implementation(), f = fixture();
  try {
    f.db.exec('BEGIN IMMEDIATE'); const before = proof(f.db, () => api.readEmotionWorldRevisionFromSqlite(f.db, 'career'))!;
    const count = f.db.prepare('SELECT total_changes() n').get()!.n;
    for (const changed of [{ ...acceptance(), afterWorldRevision: 9 }, { ...acceptance(), expectedFrame: { ...acceptance().expectedFrame, worldRevision: 1 } }]) {
      expect(() => api.appendEmotionWorldRevisionFromSqlite(f.db, before, changed)).toThrow();
      expect(f.db.prepare('SELECT total_changes() n').get()!.n).toBe(count);
    }
    api.appendEmotionWorldRevisionFromSqlite(f.db, before, acceptance());
    const committedCount = f.db.prepare('SELECT total_changes() n').get()!.n;
    expect(() => api.appendEmotionWorldRevisionFromSqlite(f.db, before, acceptance())).toThrow();
    expect(f.db.prepare('SELECT total_changes() n').get()!.n).toBe(committedCount);
    f.db.exec('ROLLBACK');
  } finally { if (f.db.isTransaction) f.db.exec('ROLLBACK'); f.close(); }
});
it('EW03 missing World head is pending only with no orphan event, and read never installs schema', async () => {
  const api = await implementation(), f = fixture(), empty = new Native(':memory:');
  try {
    empty.exec('BEGIN'); expect(proof(empty, () => api.readEmotionWorldRevisionFromSqlite(empty, 'career'))).toBeNull();
    expect(empty.prepare('SELECT * FROM sqlite_master').all()).toEqual([]); empty.exec('ROLLBACK');
    f.db.prepare('DELETE FROM world_control_heads').run(); f.db.prepare('INSERT INTO world_decision_revision_events VALUES(?,1,?,?,?)').run('career', 'OTHER', 'orphan', '{future opaque');
    f.db.exec('BEGIN'); expect(() => proof(f.db, () => api.readEmotionWorldRevisionFromSqlite(f.db, 'career'))).toThrow(/orphan/); f.db.exec('ROLLBACK');
  } finally { if (f.db.isTransaction) f.db.exec('ROLLBACK'); if (empty.isTransaction) empty.exec('ROLLBACK'); empty.close(); f.close(); }
});
it('EW04 shadow alias partial namespace and noncontiguous extent reject without repairs', async () => {
  const api = await implementation();
  for (const sql of ['DROP TABLE world_decision_revision_events', 'ALTER TABLE world_control_heads RENAME TO World_Control_Heads_Alias',
    'CREATE TEMP TABLE world_control_heads(career_id TEXT)', 'CREATE TRIGGER extra AFTER UPDATE ON world_control_heads BEGIN SELECT 1; END',
    "UPDATE world_control_heads SET world_revision=2; INSERT INTO world_decision_revision_events VALUES('career',2,'OTHER','future','{opaque')"]) {
    const f = fixture(); try { f.db.exec(sql); f.db.exec('BEGIN'); expect(() => proof(f.db, () => api.readEmotionWorldRevisionFromSqlite(f.db, 'career'))).toThrow(); f.db.exec('ROLLBACK'); }
    finally { if (f.db.isTransaction) f.db.exec('ROLLBACK'); f.close(); }
  }
});
it('EW05 historical emotion frame recovers original control after a later genuine control change', async () => {
  const api = await implementation(), f = fixture();
  try {
    f.db.exec('BEGIN IMMEDIATE'); const original = proof(f.db, () => api.readEmotionWorldRevisionFromSqlite(f.db, 'career'))!;
    api.appendEmotionWorldRevisionFromSqlite(f.db, original, acceptance()); f.db.exec('COMMIT');
    f.owner.changeControl({ careerId: 'career', expectedWorldRevision: 1, change: { expectedRevision: 0, controlledClubId: 'club', manualDomainIds: ['BATTING'] } });
    f.db.exec('BEGIN'); const historical = proof(f.db, () => api.readHistoricalEmotionWorldRevisionFromSqlite(f.db, 'career', 0));
    expect(historical).toEqual(original);
    expect(proof(f.db, () => api.readHistoricalEmotionWorldRevisionFromSqlite(f.db, 'career', 1))).toEqual({ ...original, head: { ...original.head, worldRevision: 1 } });
    expect(proof(f.db, () => api.readHistoricalEmotionWorldRevisionFromSqlite(f.db, 'career', 2))!.head.control.revision).toBe(1);
    f.db.exec('ROLLBACK');
  } finally { if (f.db.isTransaction) f.db.exec('ROLLBACK'); f.close(); }
});
