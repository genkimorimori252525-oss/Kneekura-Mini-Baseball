import { createRequire } from 'node:module';
import { expect,it } from 'vitest';
import * as storage from './ActualFoulTerminalApplicationStorage';
// Isolated Native schema fixtures only; no original artifact is read or edited.
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const finalSql=storage.foulTerminalCompletionTableSql.replace("OR (status='POST_PLAY_COMPLETED_CONTINUING' AND result_json IS NOT NULL)))",
 "OR (status='POST_PLAY_COMPLETED_CONTINUING' AND result_json IS NOT NULL)\n    OR (status='POST_PLAY_COMPLETED_FINAL' AND result_json IS NOT NULL)))");
const withDb=(sql:string,fn:(db:InstanceType<typeof DatabaseSync>)=>void)=>{const db=new DatabaseSync(':memory:');try{db.exec(sql);fn(db);}finally{db.close();}};
const check=storage.assertFoulTerminalApplicationStorage as (db:InstanceType<typeof DatabaseSync>,required?:string)=>boolean;
it('BF-S01 declares exact final schema and accepts explicitly enumerated supersets without writes',()=>{
 expect((storage as any).foulTerminalFinalCompletionTableSql,'FINAL_SCHEMA_MISSING').toBe(finalSql);
 withDb(finalSql,db=>{const before=db.prepare('SELECT * FROM sqlite_master').all();for(const mode of [undefined,'acknowledgement','completion','finalCompletion'])expect(check(db,mode)).toBe(true);expect(db.prepare('SELECT * FROM sqlite_master').all()).toEqual(before);});
});
it('BF-S02 final requirement rejects older storage and never upgrades it',()=>{
 for(const sql of [storage.foulTerminalApplicationTableSql,storage.foulTerminalAcknowledgementTableSql,storage.foulTerminalCompletionTableSql])withDb(sql,db=>{
 const before=db.prepare('SELECT * FROM sqlite_master').all();expect(()=>check(db,'finalCompletion'),'FINAL_STORAGE_REQUIREMENT_MISSING').toThrow(/final.*prerequisite/);expect(db.prepare('SELECT * FROM sqlite_master').all()).toEqual(before);});
});
it('BF-S03 rejects Native case aliases views triggers temp shadows and malformed constraints',()=>{
 for(const sql of [finalSql.replaceAll('actual_foul_terminal_applications','ACTUAL_FOUL_TERMINAL_APPLICATIONS'),
 "CREATE VIEW actual_foul_terminal_applications AS SELECT 'x' AS source_id",finalSql.replace('source_id TEXT PRIMARY KEY','source_id TEXT'),
 finalSql.replace("status='POST_PLAY_COMPLETED_FINAL' AND result_json IS NOT NULL","status='POST_PLAY_COMPLETED_FINAL' AND result_json IS NULL"),
 finalSql+";CREATE TRIGGER terminal_alias AFTER UPDATE ON actual_foul_terminal_applications BEGIN SELECT 1; END",
 finalSql+";CREATE TEMP TABLE ACTUAL_FOUL_TERMINAL_APPLICATIONS(source_id TEXT)"])withDb(sql,db=>expect(()=>check(db,'finalCompletion')).toThrow());
});
