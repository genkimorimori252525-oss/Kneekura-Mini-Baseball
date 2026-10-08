type Db = Pick<import('node:sqlite').DatabaseSync, 'prepare' | 'exec' | 'isTransaction'>;
const identity = 'source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,physical_pitch_source_id TEXT NOT NULL,player_id TEXT NOT NULL';
const archive = 'source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL';
/** Fixed owner identities. These never enter the legacy v1 admission enum. */
export const receivedOwnerSchemas = Object.freeze({
  actual_received_umpire_defender_enrollments: `CREATE TABLE actual_received_umpire_defender_enrollments(${identity},runtime_source_id TEXT NOT NULL,
    call_source_id TEXT NOT NULL,origin_communication_source_id TEXT NOT NULL,legacy_prefix_count INTEGER NOT NULL,legacy_prefix_digest TEXT NOT NULL,
    ${archive},UNIQUE(physical_pitch_source_id,player_id),UNIQUE(runtime_source_id,player_id))`,
  actual_received_umpire_defender_policy_availabilities: `CREATE TABLE actual_received_umpire_defender_policy_availabilities(${identity},
    enrollment_source_id TEXT NOT NULL UNIQUE,policy_data_source_id TEXT NOT NULL,observation_source_id TEXT NOT NULL,current_execution_source_id TEXT NOT NULL,${archive})`,
  actual_received_umpire_defender_replans: `CREATE TABLE actual_received_umpire_defender_replans(${identity},enrollment_source_id TEXT NOT NULL,
    call_source_id TEXT NOT NULL,origin_communication_source_id TEXT NOT NULL,origin_process_source_id TEXT NOT NULL,previous_source_id TEXT,
    policy_source_id TEXT,revision INTEGER NOT NULL,${archive},UNIQUE(enrollment_source_id,revision),UNIQUE(physical_pitch_source_id,player_id,revision))`,
  actual_received_umpire_defender_replan_heads: `CREATE TABLE actual_received_umpire_defender_replan_heads(physical_pitch_source_id TEXT NOT NULL,
    player_id TEXT NOT NULL,enrollment_source_id TEXT NOT NULL UNIQUE,source_id TEXT NOT NULL UNIQUE,origin_process_source_id TEXT NOT NULL,
    call_source_id TEXT NOT NULL,origin_communication_source_id TEXT NOT NULL,revision INTEGER NOT NULL,PRIMARY KEY(physical_pitch_source_id,player_id))`,
  actual_received_umpire_defender_admissions: `CREATE TABLE actual_received_umpire_defender_admissions(enrollment_source_id TEXT NOT NULL,sequence INTEGER NOT NULL,
    game_id TEXT NOT NULL,play_id INTEGER NOT NULL,physical_pitch_source_id TEXT NOT NULL,player_id TEXT NOT NULL,runtime_source_id TEXT NOT NULL,
    owner TEXT NOT NULL,source_id TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_hash TEXT NOT NULL,legacy_prefix_count INTEGER NOT NULL,
    legacy_prefix_digest TEXT NOT NULL,previous_receipt_hash TEXT,receipt_hash TEXT NOT NULL,PRIMARY KEY(enrollment_source_id,sequence),UNIQUE(owner,source_id))`,
});
export type ReceivedOwnerTable = keyof typeof receivedOwnerSchemas;
export const receivedOwnerTables = Object.freeze(Object.keys(receivedOwnerSchemas) as ReceivedOwnerTable[]);
const normalized = (value: string) => value.replace(/\s+/g, ' ').trim();
export const receivedMainOnly = (db: Pick<Db, 'prepare'>): void => {
  if (db.prepare('PRAGMA database_list').all().some(row => row.name !== 'main' && row.name !== 'temp')
    || db.prepare("SELECT name FROM temp.sqlite_master WHERE type IN ('table','view') LIMIT 1").get()) {
    throw new Error('received defender requires main-only authority schema');
  }
};
/** Inspection is inert. Partial or altered namespace state is never repaired. */
export const receivedOwnerSchema = (db: Pick<Db, 'prepare'>): 'pristine' | 'installed' => {
  receivedMainOnly(db);
  const rows = db.prepare("SELECT type,name,tbl_name,sql FROM main.sqlite_master WHERE lower(name) GLOB 'actual_received_umpire_defender_*' OR lower(tbl_name) GLOB 'actual_received_umpire_defender_*' ORDER BY name").all();
  if (!rows.length) return 'pristine';
  const own = rows.filter(row => row.type === 'table');
  if (own.length !== receivedOwnerTables.length || own.some(row => !receivedOwnerTables.includes(row.name as ReceivedOwnerTable))
    || receivedOwnerTables.some(table => own.filter(row => row.name === table && typeof row.sql === 'string'
      && normalized(row.sql) === normalized(receivedOwnerSchemas[table])).length !== 1)
    || rows.some(row => row.type !== 'table' && (row.type !== 'index' || row.sql !== null
      || !receivedOwnerTables.includes(row.tbl_name as ReceivedOwnerTable)))) throw new Error('received defender owner schema differs');
  const constraints: Readonly<Record<ReceivedOwnerTable, readonly (readonly string[])[]>> = {
    actual_received_umpire_defender_enrollments: [['source_id'], ['physical_pitch_source_id','player_id'], ['runtime_source_id','player_id']],
    actual_received_umpire_defender_policy_availabilities: [['source_id'], ['enrollment_source_id']],
    actual_received_umpire_defender_replans: [['source_id'], ['enrollment_source_id','revision'], ['physical_pitch_source_id','player_id','revision']],
    actual_received_umpire_defender_replan_heads: [['physical_pitch_source_id','player_id'], ['enrollment_source_id'], ['source_id']],
    actual_received_umpire_defender_admissions: [['enrollment_source_id','sequence'], ['owner','source_id']],
  };
  for (const table of receivedOwnerTables) {
    const primary = db.prepare(`PRAGMA main.table_info(${table})`).all().filter(column => Number(column.pk)>0)
      .sort((left,right)=>Number(left.pk)-Number(right.pk)).map(column=>column.name);
    const indexes = db.prepare(`PRAGMA main.index_list(${table})`).all();
    const unique = indexes.filter(index=>index.unique===1&&index.partial===0&&(index.origin==='pk'||index.origin==='u'))
      .map(index=>db.prepare('SELECT name FROM pragma_index_info(?) ORDER BY seqno').all(index.name).map(column=>column.name));
    const expected=constraints[table], encode=(items:readonly unknown[])=>JSON.stringify(items.map(item=>JSON.stringify(item)).sort());
    if(JSON.stringify(primary)!==JSON.stringify(expected[0])||indexes.length!==expected.length||encode(unique)!==encode(expected))
      throw new Error('received defender owner index constraints schema differs');
  }
  return 'installed';
};
/** Internal first-enrollment setup. The caller owns rollback and current admission. */
export const installReceivedOwnerSchema = (db: Db): void => {
  if (!db.isTransaction) throw new Error('received defender schema installation requires a write transaction');
  if (receivedOwnerSchema(db) === 'installed') return;
  for (const sql of Object.values(receivedOwnerSchemas)) db.exec(sql);
  if (receivedOwnerSchema(db) !== 'installed') throw new Error('received defender schema installation failed');
};
