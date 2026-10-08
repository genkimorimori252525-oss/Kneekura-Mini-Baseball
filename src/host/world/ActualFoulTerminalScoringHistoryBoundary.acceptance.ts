import { expect,it } from 'vitest';
import { prepareTerminalCompletedCopy } from './ActualFoulTerminalCompletedFixture.test-support';
import { readPhysicalClosureScoringHistory } from './PhysicalPlayClosureEvidenceFromSqlite';
import { rawCensus,schemaCensus } from './ActualFoulTerminalAcknowledgementCutover.test-support';
it('CP-H02 the complete genuine scoring-history read interval rejects an actual mutate-restore after row selection',()=>{
 const f=prepareTerminalCompletedCopy(),db=f.db,prepare=db.prepare,own=Object.getOwnPropertyDescriptor(db,'prepare');let fired=false;
 try{
  const row=db.prepare('SELECT game_id,result_json FROM actual_foul_terminal_applications WHERE source_id=?').get(f.sourceId)!;
  const saved=JSON.parse(String(row.result_json)),before=rawCensus(db),schema=schemaCensus(db),changes=Number(db.prepare('SELECT total_changes() AS n').get()!.n);
  Object.defineProperty(db,'prepare',{configurable:true,writable:true,value:function(sql:string){
   const statement=Reflect.apply(prepare,db,[sql]);
   if(sql.startsWith("SELECT * FROM applications WHERE match_id=? AND json_extract(result_json,'$.receipt.durableRevision')")){
    const all=statement.all;Object.defineProperty(statement,'all',{configurable:true,writable:true,value:(...args:unknown[])=>{
     const rows=Reflect.apply(all,statement,args);if(!fired){
      const setting=Reflect.apply(prepare,db,['PRAGMA query_only']).get()!.query_only;db.exec('PRAGMA query_only=0');
      Reflect.apply(prepare,db,['UPDATE matches SET durable_revision=durable_revision+1 WHERE match_id=?']).run(row.game_id);
      Reflect.apply(prepare,db,['UPDATE matches SET durable_revision=durable_revision-1 WHERE match_id=?']).run(row.game_id);
      db.exec('PRAGMA query_only='+setting);fired=true;
     }return rows;
    }});
   }return statement;
  }});
  let error:unknown;db.exec('BEGIN');try{readPhysicalClosureScoringHistory(db,{gameId:String(row.game_id),officialRevision:saved.official.receipt.durableRevision});}
  catch(caught){error=caught;}finally{db.exec('ROLLBACK');}
  expect(fired).toBe(true);expect(error,'HISTORY_READ_INTERVAL_MUTATION_ACCEPTED').toBeDefined();
  if(own)Object.defineProperty(db,'prepare',own);else Reflect.deleteProperty(db,'prepare');
  expect(rawCensus(db)).toEqual(before);expect(schemaCensus(db)).toEqual(schema);expect(Number(db.prepare('SELECT total_changes() AS n').get()!.n)-changes).toBe(2);
 }finally{if(own)Object.defineProperty(db,'prepare',own);else Reflect.deleteProperty(db,'prepare');db.close();}
},1_100_000);
