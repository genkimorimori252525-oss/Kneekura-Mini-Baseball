import { createRequire } from 'node:module';
import { expect,it } from 'vitest';
import { prepareTerminalCompletionCopy } from './ActualFoulTerminalCompletionFixture.test-support';
import { prepareTerminalCompletedCopy } from './ActualFoulTerminalCompletedFixture.test-support';
import { foulTerminalPostPlayCompletionEvidenceFromSqlite } from './ActualFoulTerminalPostPlayCompletionEvidenceFromSqlite';
import { openSqliteActualFoulTerminalApplicationRunner } from './SqliteActualFoulTerminalApplicationRunner';
import { rawCensus,schemaCensus,fileHash } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { observeTerminalWorkloadConnectionChanges } from './ActualFoulTerminalRoleWorkloadFixture.test-support';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite')as typeof import('node:sqlite');
it('CP-E01 each original workload effect and scoring or plan absence blocks completed reads without repair',()=>{
 const f=prepareTerminalCompletedCopy();try{
  const owner=foulTerminalPostPlayCompletionEvidenceFromSqlite(f.db),saved=withSqliteReadTransaction(f.db,()=>owner.read(f.sourceId));
  expect(saved).not.toBeNull();if(!saved)throw new Error('genuine completed prerequisite missing');
  const effects=saved.result.completion.workloadReference.participantEffects;expect(effects).toHaveLength(10);
  const faults=[...effects.map(e=>({table:'world_player_workload_activities',key:'source_id',id:e.activitySourceId})),
   {table:'actual_role_workload_settlements',key:'closure_source_id',id:f.sourceId},
   {table:'official_scoring_applications',key:'scoring_application_id',id:saved.result.completion.scoringReference.scoringApplicationId}];
  const original=rawCensus(f.db),schema=schemaCensus(f.db);let witnessed=0;
  // Explicit negative fault injection only. Each missing row is rolled back;
  // no deletion is used to manufacture any successful fixture or later input.
  for(const fault of faults){f.db.exec('BEGIN IMMEDIATE');try{
   expect(f.db.prepare(`DELETE FROM ${fault.table} WHERE ${fault.key}=?`).run(fault.id).changes).toBe(1);witnessed++;
   const damaged=rawCensus(f.db),changes=f.db.prepare('SELECT total_changes() AS n').get();
   expect(()=>owner.read(f.sourceId)).toThrow(/workload|activity|effect|history|revision|scoring|settlement|plan|AFTER/i);
   expect(rawCensus(f.db)).toEqual(damaged);expect(schemaCensus(f.db)).toEqual(schema);
   expect(f.db.prepare('SELECT total_changes() AS n').get()).toEqual(changes);
  }finally{f.db.exec('ROLLBACK');}expect(rawCensus(f.db)).toEqual(original);}
  expect(witnessed).toBe(12);expect(withSqliteReadTransaction(f.db,()=>owner.read(f.sourceId))).toEqual(saved);
  expect(fileHash(f.input.artifact.path)).toBe(f.input.artifact.sha256);
 }finally{f.db.close();}
},1_100_000);
it('CP-E02 genuine acknowledged completion rejects altered reference timing venue and defender inputs before writes',()=>{
 const f=prepareTerminalCompletionCopy();try{
  const source=f.source,first=source.worldSetup.defenders[0];
  const cases=[{...source,terminalReference:{...source.terminalReference,proposalHash:'0'.repeat(64)}},
   {...source,nextStartedAtTick:0},
   {...source,worldSetup:{...source.worldSetup,baseCenters:{...source.worldSetup.baseCenters,first:{...source.worldSetup.baseCenters.first,x:source.worldSetup.baseCenters.first.x+1}}}},
   {...source,worldSetup:{...source.worldSetup,defenders:[{...first,playerId:'unaccepted-player'},...source.worldSetup.defenders.slice(1)]}},
   {...source,worldSetup:{...source.worldSetup,defenders:[first,...source.worldSetup.defenders.slice(1).map(d=>({...d,registeredPosition:first.registeredPosition}))]}}];
  expect(source.nextStartedAtTick).toBeGreaterThan(0);const before=rawCensus(f.db),schema=schemaCensus(f.db),changes=f.db.prepare('SELECT total_changes() AS n').get();
  for(const candidate of cases)withSqliteReadTransaction(f.db,()=>expect(()=>foulTerminalPostPlayCompletionEvidenceFromSqlite(f.db).prepare(candidate))
   .toThrow(/reference|closure|same-half|venue|defender|participant|original/i));
  expect(rawCensus(f.db)).toEqual(before);expect(schemaCensus(f.db)).toEqual(schema);expect(f.db.prepare('SELECT total_changes() AS n').get()).toEqual(changes);
  expect(fileHash(f.input.artifact.path)).toBe(f.input.artifact.sha256);
 }finally{f.db.close();}
},1_100_000);
it('CP-F07 every actual completion UPDATE detects original mutate-restore writes and rolls all mirrors back',()=>{
 const f=prepareTerminalCompletionCopy();try{
  const before=rawCensus(f.db),schema=schemaCensus(f.db);
  const original=JSON.parse(String(f.db.prepare('SELECT proposal_json FROM actual_foul_terminal_applications WHERE source_id=?').get(f.sourceId)!.proposal_json));
  const actor=original.participants[0].binding,head=f.db.prepare('SELECT career_id,player_id FROM world_player_workload_heads WHERE career_id=? AND player_id=?').get(actor.careerId,actor.playerId)!;
  for(const boundary of [1,2,3]){
   let writes=0,fired=false;const runner=openSqliteActualFoulTerminalApplicationRunner(f.path,{readAcceptedPostPlaySetup:()=>f.source});
   const witness=witnessSqliteWrite(/UPDATE main\.(?:applications|matches|actual_foul_terminal_applications)\b/,writer=>{
    writes++;expect(writer.isTransaction).toBe(true);if(writes===boundary){
     writer.prepare('UPDATE world_player_workload_heads SET revision=revision+1 WHERE career_id=? AND player_id=?').run(head.career_id,head.player_id);
     writer.prepare('UPDATE world_player_workload_heads SET revision=revision-1 WHERE career_id=? AND player_id=?').run(head.career_id,head.player_id);fired=true;
    }return true;
   });
   try{expect(()=>runner.completePostPlay(f.source.sourceId)).toThrow(/write accounting|changed|differ|retired/i);expect(fired).toBe(true);expect(witness.wasReached()).toBe(true);expect(writes).toBe(3);}
   finally{witness.close();runner.close();}
   expect(rawCensus(f.db)).toEqual(before);expect(schemaCensus(f.db)).toEqual(schema);
  }
  const accounting=observeTerminalWorkloadConnectionChanges();let retry:ReturnType<typeof openSqliteActualFoulTerminalApplicationRunner>|undefined;
  try{retry=openSqliteActualFoulTerminalApplicationRunner(f.path,{readAcceptedPostPlaySetup:()=>f.source});
   expect(retry.completePostPlay(f.source.sourceId).status).toBe('POST_PLAY_COMPLETED_CONTINUING');accounting.assertChanges(3);
  }finally{accounting.close();retry?.close();}
  expect(schemaCensus(f.db)).toEqual(schema);expect(fileHash(f.input.artifact.path)).toBe(f.input.artifact.sha256);
 }finally{f.db.close();}
},1_100_000);
it('CP-F08 a real peer change before BEGIN is rejected before completion writes and restored original remains readable',()=>{
 const f=prepareTerminalCompletionCopy(),prototype=DatabaseSync.prototype,descriptor=Object.getOwnPropertyDescriptor(prototype,'exec')!,exec=descriptor.value as InstanceType<typeof DatabaseSync>['exec'];
 let runner:ReturnType<typeof openSqliteActualFoulTerminalApplicationRunner>|undefined,fired=false,writes=0;
 const match=f.db.prepare('SELECT match_id,durable_revision FROM matches').get()!;
 const witness=witnessSqliteWrite(/UPDATE main\.(?:applications|matches|actual_foul_terminal_applications)\b/,()=>{writes++;return true;});
 try{
  const before=rawCensus(f.db),schema=schemaCensus(f.db);
  runner=openSqliteActualFoulTerminalApplicationRunner(f.path,{readAcceptedPostPlaySetup:()=>f.source});
  Object.defineProperty(prototype,'exec',{...descriptor,value:function(this:InstanceType<typeof DatabaseSync>,sql:string){
   if(!fired&&sql==='BEGIN IMMEDIATE'&&this.prepare('PRAGMA database_list').all().find(r=>r.name==='main')?.file===f.path){
    // Test-only invalid peer drift, never presented as legitimate progress.
    f.db.prepare('UPDATE matches SET durable_revision=durable_revision+100 WHERE match_id=?').run(match.match_id);fired=true;
   }return Reflect.apply(exec,this,[sql]);
  }});
  expect(()=>runner!.completePostPlay(f.source.sourceId)).toThrow(/dependencies changed before writer acquisition|differ/);
  expect(fired).toBe(true);expect(writes).toBe(0);expect(witness.wasReached()).toBe(false);
  expect(f.db.prepare('SELECT durable_revision FROM matches WHERE match_id=?').get(match.match_id)!.durable_revision).toBe(Number(match.durable_revision)+100);
  Object.defineProperty(prototype,'exec',descriptor);witness.close();runner.close();runner=undefined;
  f.db.prepare('UPDATE matches SET durable_revision=? WHERE match_id=?').run(match.durable_revision,match.match_id);
  expect(rawCensus(f.db)).toEqual(before);expect(schemaCensus(f.db)).toEqual(schema);
  runner=openSqliteActualFoulTerminalApplicationRunner(f.path);expect(runner.read(f.sourceId)?.status).toBe('OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY');
  expect(rawCensus(f.db)).toEqual(before);expect(fileHash(f.input.artifact.path)).toBe(f.input.artifact.sha256);
 }finally{Object.defineProperty(prototype,'exec',descriptor);witness.close();runner?.close();f.db.close();}
},1_100_000);
