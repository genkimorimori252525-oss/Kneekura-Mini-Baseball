import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {actorJson as json} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import {assertFoulTerminalApplicationStorage,foulTerminalFinalCompletionTableSql} from './ActualFoulTerminalApplicationStorage';
import {physicalStoreTransactionBoundary} from './PhysicalStoreTransactionBoundary';

/** Explicit fixture preparation on a separately owned private copy only.
 * No production open/read/complete calls this function. It changes the CHECK
 * capability while retaining every existing terminal row and row identity. */
export const installFinalCompletionCapabilityOnPrivateCopy=(db:DatabaseSync)=>{
 assert(!db.isTransaction,'final capability fixture must own its transaction');
 assert(assertFoulTerminalApplicationStorage(db,'completion'),'final capability fixture requires existing completion storage');
 const table='actual_foul_terminal_applications',definition=db.prepare("SELECT sql FROM main.sqlite_master WHERE type='table' AND name=?").get(table)!;
 const rows=()=>db.prepare('SELECT rowid AS __cap_rowid,* FROM main.'+table+' ORDER BY rowid').all(),before=rows();
 if(String(definition.sql).includes("'POST_PLAY_COMPLETED_FINAL'")){assertFoulTerminalApplicationStorage(db,'finalCompletion');return{installed:false,rowsPreserved:true,rowCount:before.length};}
 const otherSchema=()=>db.prepare('SELECT type,name,tbl_name,sql FROM main.sqlite_master WHERE tbl_name<>? ORDER BY type,name').all(table);
 const schema=otherSchema(),version=db.prepare('PRAGMA main.user_version').get()!.user_version;
 assert(!schema.some(row=>typeof row.sql==='string'&&/\bactual_foul_terminal_applications\b/i.test(row.sql)),'final capability fixture cannot rewrite dependent schema');
 for(const row of db.prepare("SELECT name FROM main.sqlite_master WHERE type='table'").all()){
  const name=String(row.name).replaceAll('"','""');assert(!db.prepare('PRAGMA main.foreign_key_list("'+name+'")').all().some(key=>key.table===table),'final capability fixture cannot rewrite foreign references');
 }
 const old='terminal_completion_old_'+randomUUID().replaceAll('-',''),columns=db.prepare('PRAGMA main.table_info('+table+')').all().map(c=>String(c.name));
 return physicalStoreTransactionBoundary(db,'explicit final capability fixture').write(()=>{
  assertFoulTerminalApplicationStorage(db,'completion');assert(json(rows())===json(before)&&json(otherSchema())===json(schema),'final capability fixture changed before its owned write');
  db.exec('ALTER TABLE main.'+table+' RENAME TO '+old);db.exec(foulTerminalFinalCompletionTableSql);
  db.exec('INSERT INTO main.'+table+' (rowid,'+columns.join(',')+') SELECT rowid,'+columns.join(',')+' FROM main.'+old);
  db.exec('DROP TABLE main.'+old);assertFoulTerminalApplicationStorage(db,'finalCompletion');
  assert(json(rows())===json(before)&&json(otherSchema())===json(schema)&&db.prepare('PRAGMA main.user_version').get()!.user_version===version,'final capability fixture did not preserve rows/schema/version');
  return{installed:true,rowsPreserved:true,rowCount:before.length};
 });
};
