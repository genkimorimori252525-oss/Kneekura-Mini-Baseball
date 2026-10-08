import type { DatabaseSync } from 'node:sqlite';

/** These additive owners do not alter the frozen same_pa_* namespace. */
export const reservedPaSchema = Object.freeze({
  reserved_pa_work_prefixes: 'CREATE TABLE reserved_pa_work_prefixes(source_id TEXT PRIMARY KEY,enrollment_source_id TEXT NOT NULL,career_id TEXT NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,actor_source_id TEXT NOT NULL,first_pitch_source_id TEXT NOT NULL,physical_revision INTEGER NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(enrollment_source_id,physical_revision))',
  reserved_pa_total_assessments: 'CREATE TABLE reserved_pa_total_assessments(source_id TEXT PRIMARY KEY,enrollment_source_id TEXT NOT NULL,career_id TEXT NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,actor_source_id TEXT NOT NULL,first_pitch_source_id TEXT NOT NULL,prefix_source_id TEXT NOT NULL,player_id TEXT NOT NULL,baseline_source_id TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(enrollment_source_id,prefix_source_id,player_id))',
  reserved_pa_execution_views: 'CREATE TABLE reserved_pa_execution_views(source_id TEXT PRIMARY KEY,enrollment_source_id TEXT NOT NULL,career_id TEXT NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,actor_source_id TEXT NOT NULL,first_pitch_source_id TEXT NOT NULL,prefix_source_id TEXT NOT NULL,assessment_set_hash TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(enrollment_source_id,prefix_source_id,assessment_set_hash))',
} as const);
const names = Object.keys(reservedPaSchema) as (keyof typeof reservedPaSchema)[];
const fail = (): never => { throw new Error('same-PA provisional claim storage is partial or malformed'); };
/** Read-only census: only all-absent is pristine. Never install or repair. */
export const assertReservedPaStorage = (db: Pick<DatabaseSync, 'prepare'>): boolean => {
  const catalog = (schema: 'main' | 'temp') => db.prepare(`SELECT type,name,tbl_name,sql FROM ${schema}.sqlite_master WHERE lower(name) GLOB 'reserved_pa_*' OR lower(tbl_name) IN (${names.map(() => '?').join(',')})`).all(...names);
  if (catalog('temp').length) fail();
  const rows = catalog('main'); if (!rows.length) return false;
  for (const name of names) {
    const owned = rows.filter(row => String(row.name).toLowerCase() === name);
    if (owned.length !== 1 || owned[0].name !== name || owned[0].type !== 'table' || owned[0].sql !== reservedPaSchema[name]) fail();
  }
  if (rows.some(row => row.type === 'index' ? row.sql !== null || !String(row.name).startsWith('sqlite_autoindex_')
    : row.type !== 'table' || !names.includes(row.name as keyof typeof reservedPaSchema))) fail();
  return true;
};
