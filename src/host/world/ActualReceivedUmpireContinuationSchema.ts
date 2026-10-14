import { receivedMainOnly } from './ActualReceivedUmpireDefenderSchema';
type Db=Pick<import('node:sqlite').DatabaseSync,'prepare'>;
export const receivedContinuationTable='actual_received_umpire_continuations' as const;
export const receivedContinuationSql=`CREATE TABLE actual_received_umpire_continuations(source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,physical_pitch_source_id TEXT NOT NULL,player_id TEXT NOT NULL,renewal_enrollment_source_id TEXT NOT NULL UNIQUE,adoption_source_id TEXT NOT NULL UNIQUE,revision INTEGER NOT NULL,source_hash TEXT NOT NULL,snapshot_hash TEXT NOT NULL,receipt_hash TEXT NOT NULL)`;
export const receivedContinuationSchema=(db:Db):'pristine'|'installed'=>{
  receivedMainOnly(db);
  const rows=db.prepare("SELECT type,name,tbl_name,sql FROM main.sqlite_master WHERE lower(name) GLOB 'actual_received_umpire_continuation*' OR lower(tbl_name) GLOB 'actual_received_umpire_continuation*' ORDER BY name").all();
  if(!rows.length)return 'pristine';
  const tables=rows.filter(r=>r.type==='table'),norm=(s:string)=>s.replace(/\s+/g,' ').trim();
  if(tables.length!==1||tables[0].name!==receivedContinuationTable||typeof tables[0].sql!=='string'||norm(tables[0].sql)!==norm(receivedContinuationSql)
    ||rows.length!==4||rows.some(r=>r.type!=='table'&&(r.type!=='index'||r.sql!==null||r.tbl_name!==receivedContinuationTable)))throw new Error('received continuation owner schema differs');
  const indexes=db.prepare('PRAGMA main.index_list(actual_received_umpire_continuations)').all();
  const keys=indexes.map(i=>{if(i.unique!==1||i.partial!==0||!['pk','u'].includes(String(i.origin)))throw new Error('received continuation index schema differs');return db.prepare('SELECT name FROM pragma_index_info(?) ORDER BY seqno').all(i.name).map(c=>c.name);});
  if(JSON.stringify(keys.map(k=>JSON.stringify(k)).sort())!==JSON.stringify([['source_id'],['renewal_enrollment_source_id'],['adoption_source_id']].map(k=>JSON.stringify(k)).sort()))throw new Error('received continuation index schema differs');
  return 'installed';
};
export const installReceivedContinuationSchema=(db:Db&Pick<import('node:sqlite').DatabaseSync,'exec'|'isTransaction'>)=>{
  if(!db.isTransaction)throw new Error('received continuation schema requires owner transaction');
  if(receivedContinuationSchema(db)==='pristine')db.exec(receivedContinuationSql);
  if(receivedContinuationSchema(db)!=='installed')throw new Error('received continuation schema installation failed');
};
