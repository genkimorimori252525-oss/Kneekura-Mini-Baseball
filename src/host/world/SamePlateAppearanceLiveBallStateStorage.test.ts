import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';

const { DatabaseSync: NativeDatabase } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const modules = import.meta.glob('./SamePlateAppearanceLiveBallStateStorage.ts');
const implementation = async () => {
  const load = modules['./SamePlateAppearanceLiveBallStateStorage.ts'];
  expect(load, 'live-ball action namespace implementation missing').toBeTypeOf('function');
  return await load() as {
    samePaLiveBallStateSchema: string;
    assertSamePaLiveBallStateStorage(db: Pick<DatabaseSync, 'prepare'>): boolean;
  };
};
const withDb = (body: (db: DatabaseSync) => void) => {
  const db = new NativeDatabase(':memory:');
  try { body(db); } finally { db.close(); }
};
const state = (db: DatabaseSync) => ({
  main: db.prepare('SELECT * FROM main.sqlite_master ORDER BY name').all(),
  temp: db.prepare('SELECT * FROM temp.sqlite_master ORDER BY name').all(),
  mainVersion: db.prepare('PRAGMA main.schema_version').get(),
  tempVersion: db.prepare('PRAGMA temp.schema_version').get(),
  changes: db.prepare('SELECT total_changes() AS changes').get(),
});
const failure = 'same-PA live-ball state storage is partial or malformed';

test('LB-S01 absent live-ball action storage stays absent beside existing owner namespaces', async () => {
  const api = await implementation();
  withDb(db => {
    db.exec('CREATE TABLE pa_lifecycle_v1_fixture(value TEXT); CREATE TABLE same_pa_fixture(value TEXT)');
    const before = state(db);
    expect(api.assertSamePaLiveBallStateStorage(db)).toBe(false);
    expect(state(db)).toEqual(before);
  });
});

test('LB-S02 the exact single table authenticates its ordered columns and automatic keys without writes', async () => {
  const api = await implementation();
  withDb(db => {
    db.exec(api.samePaLiveBallStateSchema);
    const before = state(db);
    expect(api.assertSamePaLiveBallStateStorage(db)).toBe(true);
    expect(state(db)).toEqual(before);
    expect(db.prepare('PRAGMA main.table_xinfo(pa_live_ball_v1_actions)').all().map(column => column.name)).toEqual([
      'source_id', 'source_version', 'career_id', 'game_id', 'play_id', 'enrollment_source_id', 'actor_source_id',
      'first_pitch_source_id', 'physical_pitch_source_id', 'physical_operation_identity', 'assignment_source_id',
      'view_source_id', 'source_json', 'source_hash', 'snapshot_json', 'snapshot_hash',
    ]);
    expect(db.prepare('PRAGMA main.index_info(sqlite_autoindex_pa_live_ball_v1_actions_1)').all().map(column => column.name)).toEqual(['source_id']);
    expect(db.prepare('PRAGMA main.index_info(sqlite_autoindex_pa_live_ball_v1_actions_2)').all().map(column => column.name))
      .toEqual(['enrollment_source_id', 'view_source_id']);
  });
});

test('LB-S03 partial, extra, view and case-alias namespaces reject without repair', async () => {
  const api = await implementation();
  for (const sql of [
    'CREATE TABLE pa_live_ball_v1_extra(value TEXT)',
    'CREATE TABLE pa_live_ball_v1_actions(value TEXT)',
    'CREATE VIEW pa_live_ball_v1_actions AS SELECT 1 AS value',
    api.samePaLiveBallStateSchema.replace('pa_live_ball_v1_actions', 'PA_LIVE_BALL_V1_ACTIONS'),
    'CREATE TABLE outside(value TEXT); CREATE TRIGGER pa_live_ball_v1_trigger AFTER INSERT ON outside BEGIN SELECT 1; END',
  ]) withDb(db => {
    db.exec(sql); const before = state(db);
    expect(() => api.assertSamePaLiveBallStateStorage(db)).toThrow(failure);
    expect(state(db)).toEqual(before);
  });
});

test('LB-S04 exact storage rejects attached extra objects and temporary shadows', async () => {
  const api = await implementation();
  for (const sql of [
    'CREATE TABLE pa_live_ball_v1_extra(value TEXT)',
    'CREATE INDEX foreign_index ON pa_live_ball_v1_actions(assignment_source_id)',
    'CREATE TRIGGER foreign_trigger AFTER INSERT ON pa_live_ball_v1_actions BEGIN SELECT 1; END',
    'CREATE TEMP TABLE pa_live_ball_v1_actions(value TEXT)',
    'CREATE TEMP VIEW PA_LIVE_BALL_V1_ACTIONS AS SELECT 1 AS value',
    'CREATE TEMP TRIGGER foreign_temp_trigger AFTER INSERT ON main.pa_live_ball_v1_actions BEGIN SELECT 1; END',
  ]) withDb(db => {
    db.exec(api.samePaLiveBallStateSchema); db.exec(sql); const before = state(db);
    expect(() => api.assertSamePaLiveBallStateStorage(db)).toThrow(failure);
    expect(state(db)).toEqual(before);
  });
  withDb(db => {
    db.exec('CREATE TEMP TABLE PA_LIVE_BALL_V1_ACTIONS(value TEXT)'); const before = state(db);
    expect(() => api.assertSamePaLiveBallStateStorage(db)).toThrow(failure);
    expect(state(db)).toEqual(before);
  });
});

test('LB-S05 changed column and automatic index contracts reject', async () => {
  const api = await implementation();
  for (const sql of [
    api.samePaLiveBallStateSchema.replace('assignment_source_id TEXT NOT NULL', 'assignment_source_id TEXT'),
    api.samePaLiveBallStateSchema.replace('play_id INTEGER NOT NULL', 'play_id TEXT NOT NULL'),
    api.samePaLiveBallStateSchema.replace('snapshot_hash TEXT NOT NULL', "snapshot_hash TEXT NOT NULL DEFAULT ''"),
    api.samePaLiveBallStateSchema.replace('source_id TEXT PRIMARY KEY', 'source_id TEXT PRIMARY KEY COLLATE NOCASE'),
    api.samePaLiveBallStateSchema.replace('UNIQUE(enrollment_source_id,view_source_id)', 'UNIQUE(view_source_id,enrollment_source_id)'),
    api.samePaLiveBallStateSchema.replace(',UNIQUE(enrollment_source_id,view_source_id)', ''),
  ]) withDb(db => {
    db.exec(sql); const before = state(db);
    expect(() => api.assertSamePaLiveBallStateStorage(db)).toThrow(failure);
    expect(state(db)).toEqual(before);
  });
});

test('LB-S06 one enrollment view owns a receipt while a newer view may retain the same physical cut and action', async () => {
  const api = await implementation();
  withDb(db => {
    db.exec(api.samePaLiveBallStateSchema);
    const row = ['receipt', 'v1', 'career', 'game', 1, 'enrollment', 'actor', 'first-pitch', 'pitch',
      'physical-operation', 'action', 'view', '{}', 'source-hash', '{}', 'snapshot-hash'];
    const insert = db.prepare(`INSERT INTO pa_live_ball_v1_actions VALUES (${row.map(() => '?').join(',')})`);
    insert.run(...row);
    expect(() => insert.run('alias', ...row.slice(1))).toThrow('UNIQUE');
    const next = [...row]; next[0] = 'next-receipt'; next[11] = 'next-view';
    insert.run(...next);
    expect(db.prepare('SELECT COUNT(*) AS count FROM pa_live_ball_v1_actions').get()!.count).toBe(2);
  });
});
