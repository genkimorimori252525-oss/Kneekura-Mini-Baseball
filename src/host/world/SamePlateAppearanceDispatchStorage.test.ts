import { createRequire } from 'node:module';
import { expect, test } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';

const { DatabaseSync: NativeDatabase } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const modules = import.meta.glob('./SamePlateAppearanceDispatchStorage.ts');
const implementation = async () => {
  const load = modules['./SamePlateAppearanceDispatchStorage.ts'];
  expect(load, 'dispatch namespace implementation missing').toBeTypeOf('function');
  return await load() as {
    paDispatchSchema: Readonly<Record<string, string>>;
    assertPaDispatchStorage(db: Pick<DatabaseSync, 'prepare'>): boolean;
  };
};
const tableNames = ['action_plans', 'execution_calibrations', 'consumer_sets', 'episodes', 'rights',
  'consumer_actions', 'pitch_actions', 'pitch_heads', 'consumptions', 'episode_admissions'].map(n => `pa_dispatch_v1_${n}`);
const catalog = (db: DatabaseSync) => db.prepare('SELECT * FROM sqlite_master ORDER BY name').all();
const withDb = (body: (db: DatabaseSync) => void) => { const db = new NativeDatabase(':memory:'); try { body(db); } finally { db.close(); } };

test('DS01 an absent dispatch namespace remains pristine without schema or data writes', async () => {
  const api = await implementation();
  withDb(db => {
    db.exec('CREATE TABLE same_pa_fixture(value TEXT); CREATE TABLE reserved_pa_fixture(value TEXT)');
    const before = catalog(db), version = db.prepare('PRAGMA schema_version').get();
    expect(api.assertPaDispatchStorage(db)).toBe(false);
    expect(catalog(db)).toEqual(before); expect(db.prepare('PRAGMA schema_version').get()).toEqual(version);
  });
});

test('DS02 the frozen ten-table namespace authenticates every column and automatic index', async () => {
  const api = await implementation();
  expect(Object.keys(api.paDispatchSchema)).toEqual(tableNames); expect(Object.isFrozen(api.paDispatchSchema)).toBe(true);
  withDb(db => {
    Object.values(api.paDispatchSchema).forEach(sql => db.exec(sql));
    const before = catalog(db); expect(api.assertPaDispatchStorage(db)).toBe(true); expect(catalog(db)).toEqual(before);
    const action = db.prepare('PRAGMA table_info(pa_dispatch_v1_action_plans)').all().map(r => r.name);
    expect(action).toEqual(['source_id', 'source_version', 'career_id', 'game_id', 'play_id', 'enrollment_source_id',
      'first_pitch_source_id', 'view_source_id', 'source_json', 'source_hash', 'snapshot_json', 'snapshot_hash']);
    expect(db.prepare('PRAGMA index_info(sqlite_autoindex_pa_dispatch_v1_action_plans_2)').all().map(r => r.name))
      .toEqual(['enrollment_source_id', 'first_pitch_source_id']);
    expect(db.prepare('PRAGMA index_info(sqlite_autoindex_pa_dispatch_v1_execution_calibrations_2)').all().map(r => r.name))
      .toEqual(['view_source_id', 'player_id', 'route', 'nominal_parameter_identity']);
  });
});

test('DS03 partial extra malformed view trigger and case-alias namespaces reject without repair', async () => {
  const api = await implementation();
  const rejected = [
    (db: DatabaseSync) => db.exec(api.paDispatchSchema[tableNames[0]]),
    (db: DatabaseSync) => db.exec('CREATE TABLE pa_dispatch_v1_extra(value TEXT)'),
    (db: DatabaseSync) => db.exec('CREATE TABLE pa_dispatch_v1_action_plans(value TEXT)'),
    (db: DatabaseSync) => db.exec('CREATE VIEW pa_dispatch_v1_action_plans AS SELECT 1 AS value'),
    (db: DatabaseSync) => db.exec('CREATE TABLE outside(value TEXT); CREATE TRIGGER pa_dispatch_v1_trigger AFTER INSERT ON outside BEGIN SELECT 1; END'),
    (db: DatabaseSync) => db.exec('CREATE TABLE PA_DISPATCH_V1_ACTION_PLANS(value TEXT)'),
  ];
  for (const setup of rejected) withDb(db => {
    setup(db); const before = catalog(db);
    expect(() => api.assertPaDispatchStorage(db)).toThrow('dispatch storage is partial or malformed'); expect(catalog(db)).toEqual(before);
  });
});

test('DS04 a complete namespace rejects foreign indexes attached triggers and temporary shadows', async () => {
  const api = await implementation();
  const rejected = [
    'CREATE INDEX foreign_index ON pa_dispatch_v1_action_plans(source_id)',
    'CREATE TRIGGER foreign_trigger AFTER INSERT ON pa_dispatch_v1_action_plans BEGIN SELECT 1; END',
    'CREATE TEMP TABLE pa_dispatch_v1_action_plans(value TEXT)',
    'CREATE TEMP VIEW PA_DISPATCH_V1_RIGHTS AS SELECT 1 AS value',
    'CREATE TEMP TRIGGER foreign_temp_trigger AFTER INSERT ON main.pa_dispatch_v1_action_plans BEGIN SELECT 1; END',
  ];
  for (const sql of rejected) withDb(db => {
    Object.values(api.paDispatchSchema).forEach(ddl => db.exec(ddl)); db.exec(sql);
    const before = catalog(db); expect(() => api.assertPaDispatchStorage(db)).toThrow('dispatch storage is partial or malformed');
    expect(catalog(db)).toEqual(before);
  });
});

test('DS05 canonical keys reject alternate Sources and constrain the sole pitch revision', async () => {
  const api = await implementation();
  withDb(db => {
    Object.values(api.paDispatchSchema).forEach(sql => db.exec(sql));
    const row = ['action', 'v1', 'career', 'game', 1, 'enrollment', 'pitch', 'view', '{}', 'hash', '{}', 'hash'];
    const insert = db.prepare(`INSERT INTO pa_dispatch_v1_action_plans VALUES (${row.map(() => '?').join(',')})`);
    insert.run(...row); expect(() => insert.run('alternate', ...row.slice(1))).toThrow('UNIQUE');
    expect(() => db.prepare('INSERT INTO pa_dispatch_v1_pitch_heads VALUES (?,?,?,?,?,?,?,?)')
      .run('enrollment', 'career', 'game', 1, 'pitch', 2, 'pitch', 'hash')).toThrow('CHECK');
  });
});
