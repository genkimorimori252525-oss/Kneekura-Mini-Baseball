import { receivedMainOnly } from './ActualReceivedUmpireDefenderSchema';
type Db = Pick<import('node:sqlite').DatabaseSync,'prepare'|'exec'|'isTransaction'>;
const identity = 'source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,physical_pitch_source_id TEXT NOT NULL,player_id TEXT NOT NULL';
const scope = 'runtime_source_id TEXT NOT NULL,received_enrollment_source_id TEXT NOT NULL,origin_process_source_id TEXT NOT NULL,received_replan_source_id TEXT NOT NULL,renewal_enrollment_source_id TEXT NOT NULL';
const archive = 'source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL';
export const renewalOwnerSchemas = Object.freeze({
  actual_received_umpire_renewal_enrollments: `CREATE TABLE actual_received_umpire_renewal_enrollments(${identity},${scope},${archive},UNIQUE(received_enrollment_source_id),UNIQUE(origin_process_source_id),UNIQUE(physical_pitch_source_id,player_id))`,
  actual_received_umpire_renewal_decisions: `CREATE TABLE actual_received_umpire_renewal_decisions(${identity},${scope},${archive},UNIQUE(renewal_enrollment_source_id))`,
  actual_received_umpire_renewal_motors: `CREATE TABLE actual_received_umpire_renewal_motors(${identity},${scope},renewal_decision_source_id TEXT NOT NULL,${archive},UNIQUE(renewal_enrollment_source_id),UNIQUE(renewal_decision_source_id))`,
  actual_received_umpire_renewal_heads: `CREATE TABLE actual_received_umpire_renewal_heads(renewal_enrollment_source_id TEXT PRIMARY KEY,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,physical_pitch_source_id TEXT NOT NULL,player_id TEXT NOT NULL,
    runtime_source_id TEXT NOT NULL,received_enrollment_source_id TEXT NOT NULL,origin_process_source_id TEXT NOT NULL,received_replan_source_id TEXT NOT NULL,stage INTEGER NOT NULL,owner TEXT NOT NULL,source_id TEXT NOT NULL UNIQUE,
    renewal_decision_source_id TEXT,renewal_motor_source_id TEXT,adoption_source_id TEXT,physical_predecessor_source_id TEXT NOT NULL,physical_predecessor_revision INTEGER NOT NULL,UNIQUE(physical_pitch_source_id,player_id))`,
  actual_received_umpire_renewal_admissions: `CREATE TABLE actual_received_umpire_renewal_admissions(renewal_enrollment_source_id TEXT NOT NULL,sequence INTEGER NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,physical_pitch_source_id TEXT NOT NULL,player_id TEXT NOT NULL,
    runtime_source_id TEXT NOT NULL,received_enrollment_source_id TEXT NOT NULL,origin_process_source_id TEXT NOT NULL,received_replan_source_id TEXT NOT NULL,owner TEXT NOT NULL,source_id TEXT NOT NULL,source_version TEXT NOT NULL,
    legacy_prefix_digest TEXT NOT NULL,received_prefix_digest TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_hash TEXT NOT NULL,previous_receipt_hash TEXT,receipt_hash TEXT NOT NULL,PRIMARY KEY(renewal_enrollment_source_id,sequence),UNIQUE(owner,source_id))`,
});
export type RenewalOwnerTable = keyof typeof renewalOwnerSchemas;
export const renewalOwnerTables = Object.freeze(Object.keys(renewalOwnerSchemas) as RenewalOwnerTable[]);
const norm = (s: string) => s.replace(/\s+/g,' ').trim();
const constraints: Record<RenewalOwnerTable, readonly (readonly string[])[]> = {
  actual_received_umpire_renewal_enrollments: [['source_id'],['received_enrollment_source_id'],['origin_process_source_id'],['physical_pitch_source_id','player_id']],
  actual_received_umpire_renewal_decisions: [['source_id'],['renewal_enrollment_source_id']],
  actual_received_umpire_renewal_motors: [['source_id'],['renewal_enrollment_source_id'],['renewal_decision_source_id']],
  actual_received_umpire_renewal_heads: [['renewal_enrollment_source_id'],['source_id'],['physical_pitch_source_id','player_id']],
  actual_received_umpire_renewal_admissions: [['renewal_enrollment_source_id','sequence'],['owner','source_id']],
};
export const renewalOwnerSchema = (db: Pick<Db,'prepare'>): 'pristine'|'installed' => {
  receivedMainOnly(db);
  const rows = db.prepare("SELECT type,name,tbl_name,sql FROM main.sqlite_master WHERE lower(name) GLOB 'actual_received_umpire_renewal_*' OR lower(tbl_name) GLOB 'actual_received_umpire_renewal_*' ORDER BY name").all();
  if (!rows.length) return 'pristine';
  const tables = rows.filter(r=>r.type==='table');
  if (tables.length!==5 || tables.some(r=>!renewalOwnerTables.includes(r.name as RenewalOwnerTable))
    || renewalOwnerTables.some(t=>tables.filter(r=>r.name===t&&typeof r.sql==='string'&&norm(r.sql)===norm(renewalOwnerSchemas[t])).length!==1)
    || rows.some(r=>r.type!=='table'&&(r.type!=='index'||r.sql!==null||!renewalOwnerTables.includes(r.tbl_name as RenewalOwnerTable)))) throw new Error('received renewal owner schema differs');
  const encode = (x: readonly unknown[]) => JSON.stringify(x.map(v=>JSON.stringify(v)).sort());
  for (const table of renewalOwnerTables) {
    const primary = db.prepare(`PRAGMA main.table_info(${table})`).all().filter(c=>Number(c.pk)>0).sort((a,b)=>Number(a.pk)-Number(b.pk)).map(c=>c.name);
    const indexes = db.prepare(`PRAGMA main.index_list(${table})`).all();
    const unique = indexes.filter(i=>i.unique===1&&i.partial===0&&(i.origin==='pk'||i.origin==='u')).map(i=>db.prepare('SELECT name FROM pragma_index_info(?) ORDER BY seqno').all(i.name).map(c=>c.name));
    if (JSON.stringify(primary)!==JSON.stringify(constraints[table][0]) || indexes.length!==constraints[table].length || encode(unique)!==encode(constraints[table])) throw new Error('received renewal owner index schema differs');
  }
  return 'installed';
};
export const installRenewalOwnerSchema = (db: Db) => {
  if (!db.isTransaction) throw new Error('received renewal schema requires owner transaction');
  if (renewalOwnerSchema(db)==='installed') return;
  for (const sql of Object.values(renewalOwnerSchemas)) db.exec(sql);
  if (renewalOwnerSchema(db)!=='installed') throw new Error('received renewal schema installation failed');
};
