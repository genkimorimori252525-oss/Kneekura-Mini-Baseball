import type { DatabaseSync } from 'node:sqlite';
import { assertFoulTerminalApplicationStorage } from './ActualFoulTerminalApplicationEvidenceFromSqlite';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

const layouts = [
  ['actual_role_workload_assessments', `CREATE TABLE actual_role_workload_assessments(source_id TEXT PRIMARY KEY,closure_source_id TEXT NOT NULL,
    career_id TEXT NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,player_id TEXT NOT NULL,
    source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,
    UNIQUE(career_id,game_id,play_id,player_id))`, [['source_id'], ['career_id', 'game_id', 'play_id', 'player_id']]],
  ['actual_role_workload_settlements', `CREATE TABLE actual_role_workload_settlements(closure_source_id TEXT PRIMARY KEY,career_id TEXT NOT NULL,
    game_id TEXT NOT NULL,play_id INTEGER NOT NULL,plan_json TEXT NOT NULL,plan_hash TEXT NOT NULL,UNIQUE(career_id,game_id,play_id))`,
    [['closure_source_id'], ['career_id', 'game_id', 'play_id']]],
  ['world_player_workload_policies', `CREATE TABLE world_player_workload_policies (
    career_id TEXT NOT NULL, policy_id TEXT NOT NULL, version TEXT NOT NULL, policy_json TEXT NOT NULL,
    PRIMARY KEY(career_id, policy_id, version))`, [['career_id', 'policy_id', 'version']]],
  ['world_player_workload_baselines', `CREATE TABLE world_player_workload_baselines (
    source_id TEXT PRIMARY KEY, career_id TEXT NOT NULL, player_id TEXT NOT NULL,
    source_json TEXT NOT NULL, initial_json TEXT NOT NULL, UNIQUE(career_id, player_id))`, [['source_id'], ['career_id', 'player_id']]],
  ['world_player_workload_heads', `CREATE TABLE world_player_workload_heads (
    career_id TEXT NOT NULL, player_id TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision >= 0),
    state_json TEXT NOT NULL, PRIMARY KEY(career_id, player_id))`, [['career_id', 'player_id']]],
  ['world_player_workload_activities', `CREATE TABLE world_player_workload_activities (
    source_id TEXT PRIMARY KEY, career_id TEXT NOT NULL, player_id TEXT NOT NULL,
    before_revision INTEGER NOT NULL CHECK(before_revision >= 0), after_revision INTEGER NOT NULL CHECK(after_revision > before_revision),
    source_json TEXT NOT NULL, before_json TEXT NOT NULL, after_json TEXT NOT NULL,
    UNIQUE(career_id, player_id, after_revision))`, [['source_id'], ['career_id', 'player_id', 'after_revision']]],
] as const;
const compact = (sql: string) => sql.replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"|\s+/g,
  token => token[0] === "'" || token[0] === '"' ? token : '').replace(/^CREATETABLE(?:IFNOTEXISTS)?(?:main\.)?/i, '');
/** Read-only admission. An acknowledged receipt never grants CREATE authority. */
export const assertFoulTerminalWorkloadStorage = (db: DatabaseSync) => {
  if (db.prepare('PRAGMA main.user_version').get()!.user_version !== 3 || !assertFoulTerminalApplicationStorage(db, 'acknowledgement')) {
    throw new Error('terminal workload requires existing v3 acknowledged storage');
  }
  const databases = db.prepare('PRAGMA database_list').all();
  if (databases.some(row => row.name !== 'main' && row.name !== 'temp')
    || db.prepare("SELECT name FROM temp.sqlite_master WHERE type IN ('table','view') LIMIT 1").get()) throw new Error('terminal workload requires main-only storage');
  for (const [table, sql, keys] of layouts) {
    const rows = db.prepare('SELECT type,sql FROM main.sqlite_master WHERE name=?').all(table);
    if (rows.length !== 1 || rows[0].type !== 'table' || compact(String(rows[0].sql)) !== compact(sql)) throw new Error('terminal workload required layout differs: ' + table);
    const unique = db.prepare('PRAGMA main.index_list(' + table + ')').all().filter(index => index.unique === 1).map(index => {
      if (index.partial !== 0 || !['pk', 'u'].includes(String(index.origin))) throw new Error('terminal workload unique layout differs: ' + table);
      return db.prepare('PRAGMA main.index_info("' + String(index.name).replaceAll('"', '""') + '")').all().map(column => column.name);
    });
    if (json(unique.map(json).sort()) !== json(keys.map(json).sort())) throw new Error('terminal workload unique keys differ: ' + table);
  }
};
