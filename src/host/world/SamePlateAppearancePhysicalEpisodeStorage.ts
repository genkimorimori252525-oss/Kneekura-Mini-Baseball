import type { DatabaseSync } from 'node:sqlite';
export const physicalEpisodeTables = Object.freeze({
  action: 'pa_physical_v1_action_plans', right: 'pa_physical_v1_rights', fieldCalibration:'pa_physical_v1_field_calibrations',
  consumer: 'pa_physical_v1_pitch_consumers', launch: 'pa_physical_v1_launches', cut: 'pa_physical_v1_cuts',
  commitment: 'pa_physical_v1_commitments', resolution: 'pa_physical_v1_resolutions', fieldRoot: 'pa_physical_v1_field_roots', fieldStep: 'pa_physical_v1_field_steps',
  head: 'pa_physical_v1_heads', consumption: 'pa_physical_v1_consumptions', admission: 'pa_physical_v1_admissions',
} as const);
export type SamePaPhysicalTableKind = keyof typeof physicalEpisodeTables;
export type SamePaPhysicalTable = typeof physicalEpisodeTables[SamePaPhysicalTableKind];
const identities = 'source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,enrollment_source_id TEXT NOT NULL,career_id TEXT NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,physical_pitch_source_id TEXT NOT NULL,pitch_ordinal INTEGER NOT NULL CHECK(pitch_ordinal>=3),operation_ordinal INTEGER NOT NULL CHECK(operation_ordinal>=0),view_source_id TEXT NOT NULL,previous_owner TEXT NOT NULL,previous_source_id TEXT NOT NULL,canonical_key TEXT NOT NULL UNIQUE';
const archive = 'source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL';
const rows = Object.values(physicalEpisodeTables).filter(name => name !== physicalEpisodeTables.head);
export const samePaPhysicalEpisodeSchema: Readonly<Record<SamePaPhysicalTable, string>> = Object.freeze(Object.fromEntries([
  ...rows.map(name => [name, `CREATE TABLE ${name}(${identities},${archive})`]),
  [physicalEpisodeTables.head, `CREATE TABLE ${physicalEpisodeTables.head}(enrollment_source_id TEXT PRIMARY KEY,career_id TEXT NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,pitch_ordinal INTEGER NOT NULL CHECK(pitch_ordinal>=3),launch_source_id TEXT NOT NULL,operation_ordinal INTEGER NOT NULL CHECK(operation_ordinal>=0),last_owner TEXT NOT NULL,last_source_id TEXT NOT NULL,last_snapshot_hash TEXT NOT NULL)`],
]) as Record<SamePaPhysicalTable, string>);
const fail = (): never => { throw new Error('same-PA physical episode namespace is partial or malformed'); };
/** This family is disjoint from all protected/v1 owners. No repair or extra
 * index/trigger/view/temp object is accepted. */
export const assertSamePaPhysicalEpisodeStorage = (db: Pick<DatabaseSync, 'prepare'>): boolean => {
  const catalog = (schema: 'main' | 'temp') => db.prepare(`SELECT type,name,tbl_name,sql FROM ${schema}.sqlite_master WHERE lower(name) GLOB 'pa_physical_v1_*' OR lower(tbl_name) GLOB 'pa_physical_v1_*'`).all();
  if (catalog('temp').length) fail(); const found = catalog('main'); if (!found.length) return false;
  const expected = new Set<string>();
  for (const [name, ddl] of Object.entries(samePaPhysicalEpisodeSchema)) {
    const table = found.filter(r => r.name === name); if (table.length !== 1 || table[0].type !== 'table' || table[0].tbl_name !== name || table[0].sql !== ddl) fail();
    expected.add(name);
    const declarations = ddl.slice(ddl.indexOf('(') + 1).split(',').filter(s => /^[a-z_]+ (TEXT|INTEGER)/.test(s)).map(s => s.split(' '));
    const columns = db.prepare(`PRAGMA main.table_xinfo(${name})`).all();
    if (columns.length !== declarations.length || columns.some((r, i) => r.cid !== i || r.name !== declarations[i][0] || r.type !== declarations[i][1]
      || r.notnull !== (i === 0 ? 0 : 1) || r.dflt_value !== null || r.pk !== (i === 0 ? 1 : 0) || r.hidden !== 0)) fail();
    const keys = name === physicalEpisodeTables.head ? [['enrollment_source_id']] : [['source_id'], ['canonical_key']];
    const indexes = db.prepare(`PRAGMA main.index_list(${name})`).all(); if (indexes.length !== keys.length) fail();
    keys.forEach((key, i) => {
      const id = `sqlite_autoindex_${name}_${i + 1}`, index = indexes.filter(r => r.name === id), row = found.filter(r => r.name === id); expected.add(id);
      if (index.length !== 1 || index[0].unique !== 1 || index[0].origin !== (i === 0 ? 'pk' : 'u') || index[0].partial !== 0
        || row.length !== 1 || row[0].type !== 'index' || row[0].tbl_name !== name || row[0].sql !== null) fail();
      const info = db.prepare(`PRAGMA main.index_xinfo(${id})`).all();
      if (JSON.stringify(info.filter(r => r.key === 1).map(r => r.name)) !== JSON.stringify(key) || info.length !== key.length + 1
        || info.some(r => r.coll !== 'BINARY' || r.desc !== 0) || info.at(-1)?.cid !== -1 || info.at(-1)?.key !== 0) fail();
    });
  }
  if (found.length !== expected.size || found.some(r => !expected.has(String(r.name)))) fail(); return true;
};
