import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {closeSync,fsyncSync,openSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {it} from 'vitest';
import {runTerminalContinuationStage,type TerminalContinuationRun} from '../../../src/host/world/TerminalContinuationFixture.test-support';
import {actorHash,actorJson} from '../../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import {createReturnedOwnerObservation} from './ReturnedOwnerObservation.test-support';
import {assertReturnedNextActor,installNextActorObservationHook} from './TerminalNextActorObservation.test-support';
const fileHash=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
it('AO-N01 accepts explicit away-3 with fsynced actual actor returns and two completed ancestors',()=>{
 const path=process.env.TERMINAL_CONTINUATION_INPUT;assert(path,'reviewed next actor input required');const input=JSON.parse(readFileSync(path,'utf8'))as TerminalContinuationRun;
 assert(input.nativeReleased===true&&input.stage==='next_actor','only the reviewed explicit next actor may run');
 const directory=dirname(input.destinationPath),observer=createReturnedOwnerObservation(directory),resources:(()=>void)[]=[];let failed=false,primary:unknown;
 try{
  observer.checkpoint('starting existing explicit away-3 actor stage');
  resources.push(installNextActorObservationHook(observer));
  const receipt=runTerminalContinuationStage(input,message=>observer.checkpoint(message));assert(receipt.version==='terminal_continuation_stage_v2'&&receipt.stage==='next_actor'&&receipt.splitPhysicalOrigin.aggregateP1Credit===0&&receipt.twoPriorCompletionLineage===true,'actual next actor stage receipt differs');
  observer.checkpoint('existing driver returned its closed v2 next actor receipt');const trace=observer.close();
  const records=readFileSync(trace.path,'utf8').trim().split('\n').map(line=>JSON.parse(line));const returned=records.filter(row=>row.event==='owner_returned').map(row=>{assert(fileHash(row.result.path)===row.result.sha256,'returned observation bytes changed');return{operation:row.operation,value:JSON.parse(readFileSync(row.result.path,'utf8'))};});assertReturnedNextActor(returned);
  const actor=returned[0].value;assert(actorHash(actor)===(receipt.ownerReceipts.nextActor as any).snapshotHash,'returned actor and closed driver receipt differ');assert(actorJson(receipt.ownerReceipts.priorCompletedSources)===actorJson(['terminal-application','terminal-continuation-k-close']),'closed two-prior lineage differs');
  const receiptFd=openSync(input.receiptPath,'r');try{fsyncSync(receiptFd);}finally{closeSync(receiptFd);}
  const resultPath=join(directory,'returned-owner-receipt.json'),resultFd=openSync(resultPath,'wx',0o600);try{writeFileSync(resultFd,actorJson({version:'terminal_next_actor_returned_observations_v1',sourceTree:receipt.sourceTree,trace,closedReceipt:{path:input.receiptPath,sha256:fileHash(input.receiptPath)},ownerReturnCount:returned.length,actorResultSha256:actorHash(actor),twoPriorCompletionLineage:true,separateActualOwnerReturns:true})+'\n');fsyncSync(resultFd);}finally{closeSync(resultFd);}const dirFd=openSync(directory,'r');try{fsyncSync(dirFd);}finally{closeSync(dirFd);}
 }catch(error){failed=true;primary=error;throw error;}finally{const errors:unknown[]=[];while(resources.length)try{resources.pop()!();}catch(error){errors.push(error);}try{observer.close();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(failed?[primary,...errors]:errors,'next actor observer cleanup failed',{cause:failed?primary:errors[0]});}
},3_500_000);
