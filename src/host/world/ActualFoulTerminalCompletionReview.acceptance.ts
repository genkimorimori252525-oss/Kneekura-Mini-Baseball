import { createRequire } from 'node:module';
import { constants,copyFileSync,mkdtempSync,readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect,it } from 'vitest';
import { prepareTerminalCompletionCopy } from './ActualFoulTerminalCompletionFixture.test-support';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { foulTerminalCompletedOfficial } from '../OfficialTerminalPostPlayCompletion';
import { observeTerminalWorkloadConnectionChanges } from './ActualFoulTerminalRoleWorkloadFixture.test-support';
import { rawCensus,schemaCensus,fileHash } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { noSettledCheckpointSidecars } from './ActualFoulTerminalSettledCheckpoint.test-support';
import { openSqliteActualFoulTerminalApplicationRunner } from './SqliteActualFoulTerminalApplicationRunner';
import { foulTerminalPostPlayCompletionEvidenceFromSqlite } from './ActualFoulTerminalPostPlayCompletionEvidenceFromSqlite';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite')as typeof import('node:sqlite');
const removeHeadPrimaryKey=(db:InstanceType<typeof DatabaseSync>)=>{
 const before=rawCensus(db);db.exec('BEGIN IMMEDIATE');try{
 db.exec(`ALTER TABLE world_player_workload_heads RENAME TO __invalid_old_heads;
 CREATE TABLE world_player_workload_heads(career_id TEXT NOT NULL,player_id TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>=0),state_json TEXT NOT NULL);
 INSERT INTO world_player_workload_heads(rowid,career_id,player_id,revision,state_json) SELECT rowid,career_id,player_id,revision,state_json FROM __invalid_old_heads;
 DROP TABLE __invalid_old_heads;COMMIT;`);}catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error;}
 expect(rawCensus(db)).toEqual(before);
};
it('CP-F01 actual three completion updates roll back when COMMIT is replaced and retire the runner',()=>{
 const f=prepareTerminalCompletionCopy(),prototype=DatabaseSync.prototype,descriptor=Object.getOwnPropertyDescriptor(prototype,'exec')!;
 const exec=descriptor.value as InstanceType<typeof DatabaseSync>['exec'];let writes=0,fired=false,writer:InstanceType<typeof DatabaseSync>|undefined;
 let runner:ReturnType<typeof openSqliteActualFoulTerminalApplicationRunner>|undefined;
 const witness=witnessSqliteWrite(/UPDATE main\.(?:applications|matches|actual_foul_terminal_applications)\b/,connection=>{writes++;writer=connection;return true;});
 const intercepted={...descriptor,value:function(this:InstanceType<typeof DatabaseSync>,sql:string){if(this===writer&&writes===3&&!fired&&sql==='COMMIT'){
  fired=true;return Reflect.apply(exec,this,['ROLLBACK']);}return Reflect.apply(exec,this,[sql]);}};
 Object.defineProperty(prototype,'exec',intercepted);
 try{
  const before=rawCensus(f.db),schema=schemaCensus(f.db);runner=openSqliteActualFoulTerminalApplicationRunner(f.path,{readAcceptedPostPlaySetup:()=>f.source});
  let error:unknown,returned:unknown;try{returned=runner.completePostPlay(f.source.sourceId);}catch(caught){error=caught;}
  expect(witness.wasReached()).toBe(true);expect(writes).toBe(3);expect(fired).toBe(true);
  expect(rawCensus(f.db)).toEqual(before);expect(schemaCensus(f.db)).toEqual(schema);
  expect(error,'COMMIT_ROLLBACK_FALSE_SUCCESS').toBeDefined();expect(returned).toBeUndefined();
  expect(()=>runner!.read(f.sourceId)).toThrow(/closed/);expect(fileHash(f.input.artifact.path)).toBe(f.input.artifact.sha256);
  Object.defineProperty(prototype,'exec',descriptor);witness.close();
  const accounting=observeTerminalWorkloadConnectionChanges();let retry:ReturnType<typeof openSqliteActualFoulTerminalApplicationRunner>|undefined;
  try{
   retry=openSqliteActualFoulTerminalApplicationRunner(f.path,{readAcceptedPostPlaySetup:()=>f.source});
   const completed=retry.completePostPlay(f.source.sourceId);expect(completed.status).toBe('POST_PLAY_COMPLETED_CONTINUING');
   const official=foulTerminalCompletedOfficial(completed.result.official,completed.result.completion),p=completed.proposal;
   const expected=before.map(table=>({...table,rows:table.rows.map(row=>table.table==='applications'&&row.application_id===p.source.applicationId?{...row,result_json:json(official)}:
    table.table==='matches'&&row.match_id===p.gameId?{...row,activation_json:json({activation:completed.result.completion.activation,nextWorld:completed.result.completion.nextWorld})}:
    table.table==='actual_foul_terminal_applications'&&row.source_id===f.sourceId?{...row,status:'POST_PLAY_COMPLETED_CONTINUING',result_json:json(completed.result)}:row)}));
   expect(rawCensus(f.db)).toEqual(expected);expect(schemaCensus(f.db)).toEqual(schema);accounting.assertChanges(3);
  }finally{accounting.close();retry?.close();}

 }finally{Object.defineProperty(prototype,'exec',descriptor);witness.close();runner?.close();f.db.close();}
},1_100_000);
it('CP-F02 fresh completion rejects genuine workload rows after the head primary key is removed',()=>{
 const f=prepareTerminalCompletionCopy();try{
  removeHeadPrimaryKey(f.db);const before=rawCensus(f.db),schema=schemaCensus(f.db),changes=f.db.prepare('SELECT total_changes() AS n').get();
  let error:unknown;f.db.exec('BEGIN');try{foulTerminalPostPlayCompletionEvidenceFromSqlite(f.db).prepare(f.source);}catch(caught){error=caught;}finally{f.db.exec('ROLLBACK');}
  expect(rawCensus(f.db)).toEqual(before);expect(schemaCensus(f.db)).toEqual(schema);expect(f.db.prepare('SELECT total_changes() AS n').get()).toEqual(changes);
  expect(error,'TERMINAL_WORKLOAD_SCHEMA_BYPASS').toBeDefined();expect(String(error)).toMatch(/workload|schema/);
 }finally{f.db.close();}
},1_100_000);
it('CP-F03 historical completion rejects genuine workload rows after the head primary key is removed',()=>{
 const inputPath=process.env.TERMINAL_POSTPLAY_COMPLETED_INPUT;expect(inputPath).toBeDefined();
 expect(fileHash(inputPath!)).toBe('8e798309de01e607e5a9bf12c5f85074eeca1bc0588a5c4a3094fad02232bfa1');
 const input=JSON.parse(readFileSync(inputPath!,'utf8'));expect(input.version).toBe('terminal_completed_fixture_candidate_v1');
 for(const key of ['config','terminal','report','receipt','artifact'])expect(fileHash(input[key].path)).toBe(input[key].sha256);
 const terminal=JSON.parse(readFileSync(input.terminal.path,'utf8'));expect(terminal.status).toBe('passed');expect(terminal.configSha256).toBe(input.config.sha256);
 expect(terminal.failures).toEqual([]);expect(terminal.remainingOwnedProcesses).toEqual([]);expect(terminal.before).toEqual(terminal.after);
 noSettledCheckpointSidecars(input.artifact.path);const directory=mkdtempSync(join(tmpdir(),'terminal-completion-schema-fault-')),path=join(directory,'fault.sqlite');
 copyFileSync(input.artifact.path,path,constants.COPYFILE_EXCL);expect(fileHash(path)).toBe(input.artifact.sha256);
 const db=new DatabaseSync(path);try{
  removeHeadPrimaryKey(db);const before=rawCensus(db),schema=schemaCensus(db),changes=db.prepare('SELECT total_changes() AS n').get();
  let error:unknown;db.exec('BEGIN');try{foulTerminalPostPlayCompletionEvidenceFromSqlite(db).read('terminal-application');}catch(caught){error=caught;}finally{db.exec('ROLLBACK');}
  expect(rawCensus(db)).toEqual(before);expect(schemaCensus(db)).toEqual(schema);expect(db.prepare('SELECT total_changes() AS n').get()).toEqual(changes);
  expect(error,'TERMINAL_COMPLETED_WORKLOAD_SCHEMA_BYPASS').toBeDefined();expect(String(error)).toMatch(/workload|schema/);
  expect(fileHash(input.artifact.path)).toBe(input.artifact.sha256);
 }finally{db.close();}
},1_100_000);
