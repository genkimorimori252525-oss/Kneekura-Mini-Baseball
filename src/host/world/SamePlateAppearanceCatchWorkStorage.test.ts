import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';

const { DatabaseSync: NativeDatabase } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const modules = import.meta.glob('./SamePlateAppearanceCatchWorkStorage.ts');
const implementation = async () => {
  const load = modules['./SamePlateAppearanceCatchWorkStorage.ts'];
  expect(load, 'catch work namespace implementation missing').toBeTypeOf('function');
  return await load() as {
    samePaCatchWorkSchema: string;
    assertSamePaCatchWorkStorage(db: Pick<DatabaseSync, 'prepare'>): boolean;
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
const failure = 'same-PA catch work storage is partial or malformed';

test('CW-S01 absent catch work storage stays absent beside existing owner namespaces', async () => {
  const api = await implementation();
  withDb(db => {
    db.exec('CREATE TABLE pa_lifecycle_v1_fixture(value TEXT); CREATE TABLE same_pa_fixture(value TEXT)');
    const before = state(db);
    expect(api.assertSamePaCatchWorkStorage(db)).toBe(false);
    expect(state(db)).toEqual(before);
  });
});

test('CW-S02 the exact single table authenticates its ordered columns and automatic keys without writes', async () => {
  const api = await implementation();
  withDb(db => {
    db.exec(api.samePaCatchWorkSchema);
    const before = state(db);
    expect(api.assertSamePaCatchWorkStorage(db)).toBe(true);
    expect(state(db)).toEqual(before);
    expect(db.prepare('PRAGMA main.table_xinfo(pa_catch_v1_work)').all().map(column => column.name)).toEqual([
      'source_id', 'source_version', 'career_id', 'game_id', 'play_id', 'enrollment_source_id', 'actor_source_id',
      'first_pitch_source_id', 'physical_pitch_source_id', 'physical_operation_identity', 'action_source_id',
      'view_source_id', 'source_json', 'source_hash', 'snapshot_json', 'snapshot_hash',
    ]);
    expect(db.prepare('PRAGMA main.index_info(sqlite_autoindex_pa_catch_v1_work_1)').all().map(column => column.name)).toEqual(['source_id']);
    expect(db.prepare('PRAGMA main.index_info(sqlite_autoindex_pa_catch_v1_work_2)').all().map(column => column.name))
      .toEqual(['enrollment_source_id', 'view_source_id']);
  });
});

test('CW-S03 partial, extra, view and case-alias namespaces reject without repair', async () => {
  const api = await implementation();
  for (const sql of [
    'CREATE TABLE pa_catch_v1_extra(value TEXT)',
    'CREATE TABLE pa_catch_v1_work(value TEXT)',
    'CREATE VIEW pa_catch_v1_work AS SELECT 1 AS value',
    api.samePaCatchWorkSchema.replace('pa_catch_v1_work', 'PA_CATCH_V1_WORK'),
    'CREATE TABLE outside(value TEXT); CREATE TRIGGER pa_catch_v1_trigger AFTER INSERT ON outside BEGIN SELECT 1; END',
  ]) withDb(db => {
    db.exec(sql); const before = state(db);
    expect(() => api.assertSamePaCatchWorkStorage(db)).toThrow(failure);
    expect(state(db)).toEqual(before);
  });
});

test('CW-S04 exact storage rejects attached extra objects and temporary shadows', async () => {
  const api = await implementation();
  for (const sql of [
    'CREATE TABLE pa_catch_v1_extra(value TEXT)',
    'CREATE INDEX foreign_index ON pa_catch_v1_work(action_source_id)',
    'CREATE TRIGGER foreign_trigger AFTER INSERT ON pa_catch_v1_work BEGIN SELECT 1; END',
    'CREATE TEMP TABLE pa_catch_v1_work(value TEXT)',
    'CREATE TEMP VIEW PA_CATCH_V1_WORK AS SELECT 1 AS value',
    'CREATE TEMP TRIGGER foreign_temp_trigger AFTER INSERT ON main.pa_catch_v1_work BEGIN SELECT 1; END',
  ]) withDb(db => {
    db.exec(api.samePaCatchWorkSchema); db.exec(sql); const before = state(db);
    expect(() => api.assertSamePaCatchWorkStorage(db)).toThrow(failure);
    expect(state(db)).toEqual(before);
  });
  withDb(db => {
    db.exec('CREATE TEMP TABLE PA_CATCH_V1_WORK(value TEXT)'); const before = state(db);
    expect(() => api.assertSamePaCatchWorkStorage(db)).toThrow(failure);
    expect(state(db)).toEqual(before);
  });
});

test('CW-S05 changed column and automatic index contracts reject', async () => {
  const api = await implementation();
  for (const sql of [
    api.samePaCatchWorkSchema.replace('action_source_id TEXT NOT NULL', 'action_source_id TEXT'),
    api.samePaCatchWorkSchema.replace('play_id INTEGER NOT NULL', 'play_id TEXT NOT NULL'),
    api.samePaCatchWorkSchema.replace('snapshot_hash TEXT NOT NULL', "snapshot_hash TEXT NOT NULL DEFAULT ''"),
    api.samePaCatchWorkSchema.replace('source_id TEXT PRIMARY KEY', 'source_id TEXT PRIMARY KEY COLLATE NOCASE'),
    api.samePaCatchWorkSchema.replace('UNIQUE(enrollment_source_id,view_source_id)', 'UNIQUE(view_source_id,enrollment_source_id)'),
    api.samePaCatchWorkSchema.replace(',UNIQUE(enrollment_source_id,view_source_id)', ''),
  ]) withDb(db => {
    db.exec(sql); const before = state(db);
    expect(() => api.assertSamePaCatchWorkStorage(db)).toThrow(failure);
    expect(state(db)).toEqual(before);
  });
});

test('CW-S06 one enrollment view owns a receipt while a newer view may retain the same physical cut and action', async () => {
  const api = await implementation();
  withDb(db => {
    db.exec(api.samePaCatchWorkSchema);
    const row = ['receipt', 'v1', 'career', 'game', 1, 'enrollment', 'actor', 'first-pitch', 'pitch',
      'physical-operation', 'action', 'view', '{}', 'source-hash', '{}', 'snapshot-hash'];
    const insert = db.prepare(`INSERT INTO pa_catch_v1_work VALUES (${row.map(() => '?').join(',')})`);
    insert.run(...row);
    expect(() => insert.run('alias', ...row.slice(1))).toThrow('UNIQUE');
    const next = [...row]; next[0] = 'next-receipt'; next[11] = 'next-view';
    insert.run(...next);
    expect(db.prepare('SELECT COUNT(*) AS count FROM pa_catch_v1_work').get()!.count).toBe(2);
  });
});
