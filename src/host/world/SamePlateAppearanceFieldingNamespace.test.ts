import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { playerFieldingModelEvidenceFromSqlite } from './SqlitePlayerFieldingModelStore';
const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
const modules = import.meta.glob('./SamePlateAppearanceFieldingNamespace.test-support.ts');
const implementation = async () => {
  const load = modules['./SamePlateAppearanceFieldingNamespace.test-support.ts'];
  expect(load, 'FIELDING_PRISTINE_CLASSIFICATION_MISSING').toBeTypeOf('function');
  return (await load() as { classifyFieldingNamespace: (db: import('node:sqlite').DatabaseSync) => 'present' | 'pristine' }).classifyFieldingNamespace;
};
const schema = `CREATE TABLE world_player_fielding_models(source_id TEXT PRIMARY KEY,career_id TEXT NOT NULL,player_id TEXT NOT NULL,
  person_link_source_id TEXT NOT NULL,accepted_at_day INTEGER NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(career_id,player_id))`;
const inspect = <T>(db: import('node:sqlite').DatabaseSync, fn: () => T): T => {
  const before = db.prepare('SELECT * FROM main.sqlite_master ORDER BY name').all(), count = db.prepare('SELECT total_changes() n').get()!.n;
  db.exec('PRAGMA query_only=ON;BEGIN');
  try { return fn(); } finally { db.exec('ROLLBACK;PRAGMA query_only=OFF');
    expect(db.prepare('SELECT * FROM main.sqlite_master ORDER BY name').all()).toEqual(before); expect(db.prepare('SELECT total_changes() n').get()!.n).toBe(count); }
};
it('FN01 absent fielding namespace differs from installed empty normal-owner history without effects', async () => {
  const classify = await implementation(), db = new Native(':memory:');
  try { expect(inspect(db, () => classify(db))).toBe('pristine'); db.exec(schema); expect(inspect(db, () => classify(db))).toBe('present');
    expect(() => inspect(db, () => playerFieldingModelEvidenceFromSqlite(db).selectAtDay('career', 'player', 10))).toThrow('accepted Player fielding baseline is missing');
  } finally { db.close(); }
});
it('FN02 fielding aliases partial views and attached or shadow owners reject', async () => {
  const classify = await implementation();
  for (const sql of [schema.replace('world_player_fielding_models', 'World_Player_Fielding_Models'),
    'CREATE TABLE world_player_fielding_models(source_id TEXT)', 'CREATE TABLE world_player_fielding_models_removed(source_id TEXT)',
    'CREATE VIEW world_player_fielding_models AS SELECT 1 n', 'CREATE TEMP TABLE world_player_fielding_models(source_id TEXT)', "ATTACH ':memory:' AS peer"]) {
    const db = new Native(':memory:'); try { db.exec(sql); expect(() => inspect(db, () => classify(db))).toThrow(); } finally { db.close(); }
  }
});
it('FN03 moved model indexes body reference links and duplicate typed raw claims cannot hide missing fielding ownership', async () => {
  const classify = await implementation();
  for (const [indexed, raw] of [['original', '{invalid'], [null, '{"source":{"fieldingModelSourceId":"first"},"source":{"fieldingModelSourceId":"original"}}'],
    [null, '{"source":{"fieldingModelRef":{"sourceId":"original","sourceVersion":"v1"}}}'],
    [null, '{"reference":{"ow\\u006eer":"world_player_fielding_models","sourceId":"original"}}']] as const) {
    const db = new Native(':memory:'); try { db.exec('CREATE TABLE moved(fielding_model_source_id TEXT,source_json TEXT)');
      db.prepare('INSERT INTO moved VALUES(?,?)').run(indexed, raw); expect(() => inspect(db, () => classify(db))).toThrow(/surviving.*claim/);
    } finally { db.close(); }
  }
});
it('FN04 null body-fielding references and unrelated opaque JSON do not invent a model claim', async () => {
  const classify = await implementation(), db = new Native(':memory:');
  try { db.exec('CREATE TABLE unrelated(source_json TEXT)');
    db.prepare('INSERT INTO unrelated VALUES(?)').run('{"source":{"fieldingModelRef":null},"owner":["world_player_fielding_models"]}');
    db.prepare('INSERT INTO unrelated VALUES(?)').run('{invalid future payload'); expect(inspect(db, () => classify(db))).toBe('pristine');
  } finally { db.close(); }
});
