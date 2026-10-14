import type { DatabaseSync } from 'node:sqlite';

import { initialBallTables } from './SamePlateAppearanceInitialBallSource';
const name = initialBallTables.setup;
const identity = 'source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,career_id TEXT NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,enrollment_source_id TEXT NOT NULL,actor_source_id TEXT NOT NULL,first_pitch_source_id TEXT NOT NULL';
const work = 'view_source_id TEXT NOT NULL';
const archive = 'source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL';
/** Explicit plate-umpire actions are journaled once; neither advances physical time. */
const setupSchema = `CREATE TABLE ${name}(${identity},${work},${archive},UNIQUE(enrollment_source_id))`;
export const samePaInitialBallSchema = { [initialBallTables.setup]: setupSchema, [initialBallTables.play]: setupSchema.replaceAll(initialBallTables.setup, initialBallTables.play) };
const indexes: readonly (readonly string[])[] = [['source_id'], ['enrollment_source_id']];
const fail = (): never => { throw new Error('same-PA initial ball storage is partial or malformed'); };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Only the exact work table and its exact automatic indexes are accepted. */
export const assertSamePaInitialBallStorage = (db: Pick<DatabaseSync, 'prepare'>): boolean => {
  const catalog = (schema: 'main' | 'temp') => db.prepare(`SELECT type,name,tbl_name,sql FROM ${schema}.sqlite_master WHERE lower(name) GLOB 'pa_initial_ball_v1_*' OR lower(tbl_name) GLOB 'pa_initial_ball_v1_*'`).all();
  if (catalog('temp').length) fail();
  const rows = catalog('main'); if (!rows.length) return false;
  const allExpected = new Set<string>();
  for (const name of Object.values(initialBallTables)) {
  const schema = samePaInitialBallSchema[name];
  const owned = rows.filter(row => row.name === name);
  if (owned.length !== 1 || owned[0].type !== 'table' || owned[0].tbl_name !== name || owned[0].sql !== schema) fail();
  const expected = new Set<string>([name]);
  const ddlColumns = schema.slice(schema.indexOf('(') + 1).split(',')
    .filter(value => /^[a-z_]+ (TEXT|INTEGER)/.test(value)).map(value => value.split(' '));
  const columns = db.prepare(`PRAGMA main.table_xinfo(${name})`).all();
  if (columns.length !== ddlColumns.length || columns.some((column, i) => column.cid !== i || column.name !== ddlColumns[i][0]
    || column.type !== ddlColumns[i][1] || column.notnull !== (i === 0 ? 0 : 1) || column.dflt_value !== null
    || column.pk !== (i === 0 ? 1 : 0) || column.hidden !== 0)) fail();
  const actualIndexes = db.prepare(`PRAGMA main.index_list(${name})`).all();
  if (actualIndexes.length !== indexes.length) fail();
  for (const [i, keys] of indexes.entries()) {
    const indexName = `sqlite_autoindex_${name}_${i + 1}`;
    expected.add(indexName);
    const row = rows.filter(value => value.name === indexName), index = actualIndexes.filter(value => value.name === indexName);
    if (row.length !== 1 || row[0].type !== 'index' || row[0].tbl_name !== name || row[0].sql !== null || index.length !== 1
      || index[0].unique !== 1 || index[0].origin !== (i === 0 ? 'pk' : 'u') || index[0].partial !== 0) fail();
    const info = db.prepare(`PRAGMA main.index_xinfo(${indexName})`).all();
    if (!same(info.filter(value => value.key === 1).map(value => value.name), keys)
      || info.length !== keys.length + 1 || info.some(value => value.desc !== 0 || value.coll !== 'BINARY')
      || info.at(-1)?.cid !== -1 || info.at(-1)?.key !== 0) fail();
  }
  for (const name of expected) allExpected.add(name);
  }
  if (rows.length !== allExpected.size || rows.some(row => !allExpected.has(String(row.name)))) fail();
  return true;
};
