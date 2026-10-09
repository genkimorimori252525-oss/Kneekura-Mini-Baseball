import type { DatabaseSync } from 'node:sqlite';
const identity = 'source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,career_id TEXT NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,enrollment_source_id TEXT NOT NULL,actor_source_id TEXT NOT NULL,first_pitch_source_id TEXT NOT NULL';
const archive = 'source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL';
const table = (name: string, extra: string, keys: readonly string[]) =>
  `CREATE TABLE ${name}(${identity},${extra},${archive},${keys.map(key => `UNIQUE(${key})`).join(',')})`;
/** Distinct repeated-episode owners. Previously accepted prefix and pitch schemas stay exact. */
export const samePaLifecycleSchema = Object.freeze({
  pa_lifecycle_v1_work_prefixes: table('pa_lifecycle_v1_work_prefixes', 'anchor_view_source_id TEXT NOT NULL,event_set_hash TEXT NOT NULL,coverage_hash TEXT NOT NULL', ['enrollment_source_id,event_set_hash']),
  pa_lifecycle_v1_total_assessments: table('pa_lifecycle_v1_total_assessments', 'prefix_source_id TEXT NOT NULL,player_id TEXT NOT NULL,baseline_source_id TEXT NOT NULL', ['prefix_source_id,player_id']),
  pa_lifecycle_v1_execution_calibrations: table('pa_lifecycle_v1_execution_calibrations', 'view_source_id TEXT NOT NULL,player_id TEXT NOT NULL,route TEXT NOT NULL,nominal_parameter_identity TEXT NOT NULL', ['view_source_id,player_id,route,nominal_parameter_identity']),
  pa_lifecycle_v1_execution_views: table('pa_lifecycle_v1_execution_views', 'prefix_source_id TEXT NOT NULL,assessment_set_hash TEXT NOT NULL', ['enrollment_source_id,prefix_source_id']),
  pa_lifecycle_v1_outcomes: table('pa_lifecycle_v1_outcomes', 'physical_pitch_source_id TEXT NOT NULL,official_head_source_id TEXT NOT NULL', ['enrollment_source_id,physical_pitch_source_id']),
  pa_lifecycle_v1_resets: table('pa_lifecycle_v1_resets', 'outcome_source_id TEXT NOT NULL', ['enrollment_source_id,outcome_source_id']),
} as const);
type TableName = keyof typeof samePaLifecycleSchema;
const names = Object.freeze(Object.keys(samePaLifecycleSchema) as TableName[]);
const indexes: Readonly<Record<TableName, readonly (readonly string[])[]>> = Object.freeze({
  pa_lifecycle_v1_work_prefixes: [['source_id'], ['enrollment_source_id','event_set_hash']],
  pa_lifecycle_v1_total_assessments: [['source_id'], ['prefix_source_id','player_id']],
  pa_lifecycle_v1_execution_calibrations: [['source_id'], ['view_source_id','player_id','route','nominal_parameter_identity']],
  pa_lifecycle_v1_execution_views: [['source_id'], ['enrollment_source_id','prefix_source_id']],
  pa_lifecycle_v1_outcomes: [['source_id'], ['enrollment_source_id','physical_pitch_source_id']],
  pa_lifecycle_v1_resets: [['source_id'], ['enrollment_source_id','outcome_source_id']],
});
const fail = (): never => { throw new Error('same-PA lifecycle storage is partial or malformed'); };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Only six exact tables and their exact automatic indexes are accepted. */
export const assertSamePaLifecycleStorage = (db: Pick<DatabaseSync, 'prepare'>): boolean => {
  const catalog = (schema: 'main' | 'temp') => db.prepare(`SELECT type,name,tbl_name,sql FROM ${schema}.sqlite_master WHERE lower(name) GLOB 'pa_lifecycle_v1_*' OR lower(tbl_name) GLOB 'pa_lifecycle_v1_*'`).all();
  if (catalog('temp').length) fail();
  const rows = catalog('main'); if (!rows.length) return false;
  const expected = new Set<string>();
  for (const name of names) {
    const owned = rows.filter(row => row.name === name);
    if (owned.length !== 1 || owned[0].type !== 'table' || owned[0].tbl_name !== name || owned[0].sql !== samePaLifecycleSchema[name]) fail();
    expected.add(name);
    const ddlColumns = samePaLifecycleSchema[name].slice(samePaLifecycleSchema[name].indexOf('(') + 1).split(',')
      .filter(value => /^[a-z_]+ (TEXT|INTEGER)/.test(value)).map(value => value.split(' '));
    const columns = db.prepare(`PRAGMA main.table_xinfo(${name})`).all();
    if (columns.length !== ddlColumns.length || columns.some((column, i) => column.cid !== i || column.name !== ddlColumns[i][0]
      || column.type !== ddlColumns[i][1] || column.notnull !== (i === 0 ? 0 : 1) || column.dflt_value !== null
      || column.pk !== (i === 0 ? 1 : 0) || column.hidden !== 0)) fail();
    const actualIndexes = db.prepare(`PRAGMA main.index_list(${name})`).all();
    if (actualIndexes.length !== indexes[name].length) fail();
    for (const [i, keys] of indexes[name].entries()) {
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
  }
  if (rows.length !== expected.size || rows.some(row => !expected.has(String(row.name)))) fail();
  return true;
};
