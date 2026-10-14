import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect,it } from 'vitest';
import { actorHash as hash,actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { rawCensus,schemaCensus,fileHash } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { prepareTerminalCompletionCopy } from './ActualFoulTerminalCompletionFixture.test-support';
import { noSettledCheckpointSidecars } from './ActualFoulTerminalSettledCheckpoint.test-support';
import { observeTerminalWorkloadConnectionChanges } from './ActualFoulTerminalRoleWorkloadFixture.test-support';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { openSqliteActualFoulTerminalApplicationRunner } from './SqliteActualFoulTerminalApplicationRunner';
import { openSqliteActualFoulTerminalApplicationStore } from './SqliteActualFoulTerminalApplicationStore';
import { SqliteOfficialStateWriter } from '../SqliteOfficialStateWriter';
import { foulTerminalCompletedOfficial } from '../OfficialTerminalPostPlayCompletion';

it('CP-G02 genuine continuing completion updates exactly three mirrors and preserves callback-free retry and reopen',()=>{
 const f=prepareTerminalCompletionCopy();let db:typeof f.db|undefined=f.db;
 let runner:ReturnType<typeof openSqliteActualFoulTerminalApplicationRunner>|undefined,queue:ReturnType<typeof openSqliteActualFoulTerminalApplicationStore>|undefined;
 let accounting:ReturnType<typeof observeTerminalWorkloadConnectionChanges>|undefined;
 try{
  const before=rawCensus(db),schema=schemaCensus(db),terminal=db.prepare('SELECT * FROM actual_foul_terminal_applications WHERE source_id=?').get(f.sourceId)!;
  const old=JSON.parse(String(terminal.result_json));let callbacks=0,allow=true;
  accounting=observeTerminalWorkloadConnectionChanges();
  runner=openSqliteActualFoulTerminalApplicationRunner(f.path,{readAcceptedPostPlaySetup:id=>{callbacks++;if(!allow)throw new Error('COMPLETED_RETRY_CALLED_AUTHORITY');return id===f.source.sourceId?f.source:null;}});
  const witnessed:{table:string;connection:typeof f.db}[]=[],witnesses=['applications','matches','actual_foul_terminal_applications'].map(table=>
   witnessSqliteWrite(new RegExp('UPDATE main\\.'+table+'\\b'),connection=>{expect(connection.isTransaction).toBe(true);witnessed.push({table,connection});return true;}));
  let result;
  try{result=runner.completePostPlay(f.source.sourceId);}finally{for(const witness of witnesses.reverse())witness.close();}
  expect(result.status).toBe('POST_PLAY_COMPLETED_CONTINUING');expect(result.result.sourceId).toBe(f.sourceId);
  expect(result.result.official).toEqual(old.official);expect(result.result.acknowledgement).toEqual(old.acknowledgement);
  expect(json(result.source)).toBe(terminal.source_json);expect(json(result.proposal)).toBe(terminal.proposal_json);
  const completion=result.result.completion;
  if('finalResult'in completion)throw new Error('v1 fixture unexpectedly finalized');
  expect(result.result.completion.source).toEqual(f.source);expect(result.result.completion.controllerRetirement.retired).toHaveLength(10);
  expect(result.result.completion.workloadReference.participantEffects).toHaveLength(10);
  const {snapshotHash,...payload}=result.result.completion;expect(snapshotHash).toBe(hash(payload));
  expect(callbacks).toBeGreaterThan(0);allow=false;const callbackCount=callbacks;
  expect(witnessed.map(w=>w.table)).toEqual(['applications','matches','actual_foul_terminal_applications']);
  expect(new Set(witnessed.map(w=>w.connection)).size).toBe(1);accounting.assertChanges(3);accounting.checkpoint();
  const official=foulTerminalCompletedOfficial(old.official,result.result.completion),p=result.proposal;
  expect(Object.keys(official).sort()).toEqual(['activation','completion','nextWorld','pendingPostPlay','receipt']);
  expect(Object.keys(result.result).sort()).toEqual(['acknowledgement','completion','official','sourceId']);
  const expected=before.map(table=>({...table,rows:table.rows.map(row=>table.table==='applications'&&row.application_id===p.source.applicationId?{...row,result_json:json(official)}:
   table.table==='matches'&&row.match_id===p.gameId?{...row,activation_json:json({activation:completion.activation,nextWorld:completion.nextWorld})}:
   table.table==='actual_foul_terminal_applications'&&row.source_id===f.sourceId?{...row,status:'POST_PLAY_COMPLETED_CONTINUING',result_json:json(result.result)}:row)}));
  expect(rawCensus(db)).toEqual(expected);expect(schemaCensus(db)).toEqual(schema);
  const match=new SqliteOfficialStateWriter(db).getMatch(p.gameId)!;
  expect(match.durableRevision).toBe(old.official.receipt.durableRevision);expect(match.matchState).toEqual(old.official.receipt.appliedMatchState);
  expect(match.activation).toEqual(completion.activation);expect(match.nextWorld).toEqual(completion.nextWorld);expect(match.pendingPostPlay).toBeUndefined();
  expect(runner.read(f.sourceId)).toEqual(result);expect(runner.apply(f.sourceId)).toEqual(result);expect(runner.acknowledge(f.sourceId)).toEqual(result);
  expect(runner.completePostPlay(f.source.sourceId)).toEqual(result);
  queue=openSqliteActualFoulTerminalApplicationStore(f.path,{readAcceptedApplication:()=>{throw new Error('COMPLETED_ENQUEUE_CALLED_AUTHORITY');}});
  expect(queue.enqueue(f.sourceId)).toEqual(result);expect(callbacks).toBe(callbackCount);
  expect(rawCensus(db)).toEqual(expected);expect(schemaCensus(db)).toEqual(schema);accounting.assertUnchanged();accounting.close();accounting=undefined;
  queue.close();queue=undefined;runner.close();runner=undefined;db.close();db=undefined;noSettledCheckpointSidecars(f.path);
  accounting=observeTerminalWorkloadConnectionChanges();
  const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite')as typeof import('node:sqlite');db=new DatabaseSync(f.path);
  runner=openSqliteActualFoulTerminalApplicationRunner(f.path);expect(runner.completePostPlay(f.source.sourceId)).toEqual(result);
  expect(rawCensus(db)).toEqual(expected);expect(schemaCensus(db)).toEqual(schema);accounting.assertUnchanged();accounting.close();accounting=undefined;
  runner.close();runner=undefined;db.close();db=undefined;noSettledCheckpointSidecars(f.path);noSettledCheckpointSidecars(f.input.artifact.path);
  expect(fileHash(f.input.artifact.path)).toBe(f.input.artifact.sha256);
  writeFileSync(join(f.directory,'completed-terminal-receipt.json'),JSON.stringify({version:'terminal_continuing_completion_qualified_candidate_v1',
   path:f.path,sha256:fileHash(f.path),sourceArtifact:f.input.artifact,sourceId:f.sourceId,setupSource:f.source,
   completionId:result.result.completion.completionId,snapshotHash:result.result.completion.snapshotHash,rowsHash:hash(expected),schemaHash:hash(schema),
   unchangedOfficialRevision:old.official.receipt.durableRevision,exactUpdates:3,callbackFreeRetry:true,nextActor:false,nextPitch:false},null,2),{flag:'wx'});
 }finally{try{accounting?.close();}finally{try{queue?.close();}finally{try{runner?.close();}finally{db?.close();}}}}
},1_200_000);
