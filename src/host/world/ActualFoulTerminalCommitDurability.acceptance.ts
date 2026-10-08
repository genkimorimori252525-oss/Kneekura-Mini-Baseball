import { createRequire } from 'node:module';
import { expect,it } from 'vitest';
import { prepareLegacyPendingCopy,extendPrivateTerminalCheck,rawCensus,schemaCensus,fileHash } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { prepareRetainedTerminalAcknowledgementCopy } from './ActualFoulTerminalAcknowledgementRetained.test-support';
import { observeTerminalWorkloadConnectionChanges } from './ActualFoulTerminalRoleWorkloadFixture.test-support';
import { openSqliteActualFoulTerminalApplicationRunner } from './SqliteActualFoulTerminalApplicationRunner';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite')as typeof import('node:sqlite');
const sourceId='terminal-application';
const exercise=(operation:'apply'|'acknowledge',commitThenThrow=false)=>{
 const f=operation==='apply'?prepareLegacyPendingCopy():prepareRetainedTerminalAcknowledgementCopy('applied');
 const db=new DatabaseSync(f.path);let runner:ReturnType<typeof openSqliteActualFoulTerminalApplicationRunner>|undefined;
 const prototype=DatabaseSync.prototype,descriptor=Object.getOwnPropertyDescriptor(prototype,'exec')!,exec=descriptor.value as InstanceType<typeof DatabaseSync>['exec'];
 let witness:ReturnType<typeof witnessSqliteWrite>|undefined,writes=0,fired=false,writer:InstanceType<typeof DatabaseSync>|undefined;
 try{
  if(operation==='acknowledge')extendPrivateTerminalCheck(db);
  runner=openSqliteActualFoulTerminalApplicationRunner(f.path);
  const original=runner.read(sourceId);expect(original?.status).toBe(operation==='apply'?'QUEUED':'OFFICIAL_APPLIED_PENDING_POST_PLAY');
  if(!original)throw new Error('genuine original terminal owner missing');
  const before=rawCensus(db),schema=schemaCensus(db),unrelated=rawCensus(db,['matches','applications','actual_foul_terminal_applications']);
  const expectedWrites=operation==='apply'?3:1;
  witness=witnessSqliteWrite(/(?:INSERT INTO|UPDATE) (?:main\.)?(?:applications|matches|actual_foul_terminal_applications)\b/,connection=>{writes++;writer=connection;return true;});
  Object.defineProperty(prototype,'exec',{...descriptor,value:function(this:InstanceType<typeof DatabaseSync>,sql:string){
   if(this===writer&&writes===expectedWrites&&!fired&&sql==='COMMIT'){
    fired=true;Reflect.apply(exec,this,[commitThenThrow?'COMMIT':'ROLLBACK']);
    if(commitThenThrow)throw new Error('TEST_COMMITTED_BEFORE_THROW');return;
   }return Reflect.apply(exec,this,[sql]);
  }});
  let error:unknown,returned:unknown;try{returned=runner[operation](sourceId);}catch(caught){error=caught;}
  expect(witness.wasReached()).toBe(true);expect(writes).toBe(expectedWrites);expect(fired).toBe(true);
  if(!commitThenThrow)expect(rawCensus(db)).toEqual(before);
  expect(schemaCensus(db)).toEqual(schema);expect(rawCensus(db,['matches','applications','actual_foul_terminal_applications'])).toEqual(unrelated);
  expect(error,operation==='apply'?'APPLY_COMMIT_ROLLBACK_FALSE_SUCCESS':'ACK_COMMIT_ROLLBACK_FALSE_SUCCESS').toBeDefined();expect(returned).toBeUndefined();
  expect(()=>runner!.read(sourceId)).toThrow(/closed/);
  Object.defineProperty(prototype,'exec',descriptor);witness.close();
  const accounting=observeTerminalWorkloadConnectionChanges();let retry:ReturnType<typeof openSqliteActualFoulTerminalApplicationRunner>|undefined;
  try{
   retry=openSqliteActualFoulTerminalApplicationRunner(f.path);const saved=retry[operation](sourceId);
   expect(saved.status).toBe(operation==='apply'?'OFFICIAL_APPLIED_PENDING_POST_PLAY':'OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY');
   expect(saved.source).toEqual(original.source);expect(saved.proposal).toEqual(original.proposal);
   expect(retry.read(sourceId)).toEqual(saved);expect(rawCensus(db,['matches','applications','actual_foul_terminal_applications'])).toEqual(unrelated);
   expect(schemaCensus(db)).toEqual(schema);accounting.assertChanges(commitThenThrow?0:expectedWrites);
  }finally{accounting.close();retry?.close();}
  if('producer'in f)expect(fileHash(f.producer.sourcePath)).toBe(f.producer.sourceSha256);
  else expect(fileHash(f.retainedPath)).toBe(f.retainedSha256);
 }finally{Object.defineProperty(prototype,'exec',descriptor);witness?.close();runner?.close();db.close();}
};
it('CP-F04 fresh genuine application detects replaced COMMIT and permits a clean new-handle retry',()=>exercise('apply'),1_100_000);
it('CP-F05 fresh genuine acknowledgement detects replaced COMMIT and permits a clean new-handle retry',()=>exercise('acknowledge'),1_100_000);
it('CP-F06 real acknowledgement committed before throw retires the handle and preserves durable retry',()=>exercise('acknowledge',true),1_100_000);
