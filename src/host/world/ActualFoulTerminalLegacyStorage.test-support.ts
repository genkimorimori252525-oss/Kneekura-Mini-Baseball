// Frozen constructor-admission dependency from c751ccd. The SQL and schema
// checker below are verbatim historical code, including its old normalization.
// Current projection code is re-exported only for the untouched legacy entry
// point's unexecuted post-admission branch; the capable-schema refusal occurs
// before that factory is invoked. This fixture qualifies admission only.
import type { DatabaseSync } from 'node:sqlite';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
export { foulTerminalApplicationEvidenceFromSqlite } from './ActualFoulTerminalApplicationEvidenceFromSqlite';
const same = (actual: unknown, expected: unknown, message: string): void => {
  if (json(actual) !== json(expected)) throw new Error(message);
};
export const foulTerminalApplicationTableSql = `CREATE TABLE IF NOT EXISTS main.actual_foul_terminal_applications(
  source_id TEXT PRIMARY KEY,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,application_id TEXT NOT NULL UNIQUE,
  physical_pitch_source_id TEXT NOT NULL UNIQUE,physical_end_source_id TEXT NOT NULL UNIQUE,official_obligation_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,proposal_json TEXT NOT NULL,proposal_hash TEXT NOT NULL,result_json TEXT,
  UNIQUE(game_id,play_id),CHECK((status='QUEUED' AND result_json IS NULL)
    OR (status='OFFICIAL_APPLIED_PENDING_POST_PLAY' AND result_json IS NOT NULL)))`;
const table = 'actual_foul_terminal_applications';
const columnNames = ['source_id','game_id','play_id','application_id','physical_pitch_source_id','physical_end_source_id',
  'official_obligation_key','status','source_json','source_hash','proposal_json','proposal_hash','result_json'] as const;
const compactSchema = (sql: string) => sql.replace(/\s+/g,'').replace(/^CREATETABLE(?:IFNOTEXISTS)?(?:main\.)?/i,'');
/** Validate installed constraints as well as the columns; no migration or DDL. */
export const assertFoulTerminalApplicationStorage = (db: DatabaseSync): boolean => {
  const schema = db.prepare('SELECT type,sql FROM main.sqlite_master WHERE name=?').all(table);
  if (!schema.length) return false;
  if (schema.length !== 1 || schema[0].type !== 'table' || typeof schema[0].sql !== 'string'
    || compactSchema(schema[0].sql) !== compactSchema(foulTerminalApplicationTableSql)) {
    throw new Error('foul terminal queue schema or constraints differ');
  }
  const columns = db.prepare('PRAGMA main.table_info(actual_foul_terminal_applications)').all();
  same(columns.map(c => [c.name,c.type,c.notnull,c.pk,c.dflt_value]), columnNames.map((name,i) =>
    [name,name === 'play_id' ? 'INTEGER' : 'TEXT',i === 0 || name === 'result_json' ? 0 : 1,i === 0 ? 1 : 0,null]),
  'foul terminal queue column shape differs');
  const indexes = db.prepare('PRAGMA main.index_list(actual_foul_terminal_applications)').all().filter(row => row.unique === 1);
  const keys = indexes.map(index => {
    if (index.partial !== 0 || !['pk','u'].includes(String(index.origin)) || typeof index.name !== 'string') {
      throw new Error('foul terminal queue unique constraint differs');
    }
    return db.prepare('PRAGMA main.index_info("'+index.name.replaceAll('"','""')+'")').all().map(row => row.name);
  });
  same(keys.map(json).sort(), [['source_id'],['application_id'],['game_id','play_id'],['physical_pitch_source_id'],
    ['physical_end_source_id'],['official_obligation_key']].map(json).sort(), 'foul terminal queue uniqueness differs');
  return true;
};
