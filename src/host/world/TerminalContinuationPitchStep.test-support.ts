import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {closeSync,constants,copyFileSync,existsSync,fsyncSync,lstatSync,mkdirSync,openSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {dirname,isAbsolute,join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {cloneInert} from '../../core/adjudication/OfficialWindowPolicy';
import {actorHash as hash,actorJson as json} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import {SqliteOfficialStateStore} from '../SqliteOfficialStateStore';
import {SqliteOfficialParticipationStore} from './SqliteOfficialParticipationStore';
import {openSqliteOfficialInitialWorldStore} from './SqliteOfficialInitialWorldStore';
import {openSqlitePlayerPersonLinkStore} from './SqlitePlayerPersonLinkStore';
import {openSqlitePlayerWorkloadRecoveryStore} from './SqlitePlayerWorkloadRecoveryStore';
import {openSqlitePlayerPitchTimingStore} from './SqlitePlayerPitchTimingStore';
import {openSqlitePlayerReleaseGeometryStore} from './SqlitePlayerReleaseGeometryStore';
import {openSqlitePitchFatiguePolicyStore} from './SqlitePitchFatiguePolicyStore';
import type {DurablePhysicalPlayClosure} from './SqlitePhysicalPlayClosureStore';
import {openSqlitePhysicalPitchProgressStore,type DurablePhysicalPitch} from './SqlitePhysicalPitchProgressStore';
import {foulTerminalNextPlayReadinessFromSqlite} from './FoulTerminalNextPlayReadiness';
import {readPhysicalPitchProgressFromSqlite,readOriginalPhysicalPitchPrefixFromSqlite} from './PhysicalPitchEvidenceFromSqlite';
import {readActualRoleWorkloadState} from './ActualRoleWorkloadState';
import {withBattedVenueLegalReadSnapshot} from './SqliteBattedVenueLegalPolicyStore';
import {withSqliteReadTransaction} from './SqliteReadTransaction.test-support';
import {fileHash,rawCensus,schemaCensus} from './ActualFoulTerminalAcknowledgementCutover.test-support';
import {materializeContinuationTake,terminalContinuationFixtureIds as ids,terminalContinuationGame} from './TerminalContinuationFixtureInputs.test-support';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite')as typeof import('node:sqlite');
type Pin=Readonly<{path:string;sha256:string}>;
export type TerminalPitchStep='take_1'|'take_2';
export type TerminalPitchStepInput=Readonly<{version:'terminal_continuation_pitch_step_v1';nativeReleased:boolean;step:TerminalPitchStep;sourceTree:string;predecessor:Pin;recipe:Pin;destinationDirectory:string;tracePath:string;receiptPath:string}>;
const same=(a:unknown,b:unknown,label:string)=>assert.equal(json(a),json(b),label);
const fields=(v:unknown,names:string[])=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&json(Object.keys(v).sort())===json(names.sort());
const validPin=(p:Pin)=>fields(p,['path','sha256'])&&typeof p.path==='string'&&isAbsolute(p.path)&&/^[a-f0-9]{64}$/.test(p.sha256);
const target=(step:TerminalPitchStep)=>step==='take_1'?2:3;
export const capturePitchStepInput=(raw:TerminalPitchStepInput):TerminalPitchStepInput=>{
 const v=cloneInert(raw);assert(fields(v,['version','nativeReleased','step','sourceTree','predecessor','recipe','destinationDirectory','tracePath','receiptPath'])&&v.version==='terminal_continuation_pitch_step_v1'&&typeof v.nativeReleased==='boolean'&&['take_1','take_2'].includes(v.step)&&/^[a-f0-9]{40}$/.test(v.sourceTree)&&validPin(v.predecessor)&&validPin(v.recipe),'pitch step controls differ');
 assert([v.destinationDirectory,v.tracePath,v.receiptPath].every(p=>typeof p==='string'&&isAbsolute(p))&&dirname(v.tracePath)===v.destinationDirectory&&dirname(v.receiptPath)===v.destinationDirectory&&v.tracePath!==v.receiptPath,'pitch step paths differ');return v;
};
export const validatePitchStepPredecessor=(step:TerminalPitchStep,raw:unknown)=>{
 const m=cloneInert(raw)as any,n=target(step)-1;assert(['take_1','take_2'].includes(step)&&m&&m.qualified===true&&m.allHandlesClosed===true&&m.reopened===true&&m.originalRowsPreserved===true&&m.aggregateP1Credit===0&&validPin(m.artifact),'pitch step requires a qualified closed predecessor');
 assert(step==='take_1'?m.version==='terminal_retained_one_pitch_qualified_input_v1':m.version==='terminal_continuation_pitch_step_qualified_input_v1'&&m.step==='take_1','pitch step predecessor stage differs');
 assert(m.physical?.sourceId===ids.takeIds[n-1]&&m.physical.progressRevision===n&&m.physical.count?.balls===0&&m.physical.count.strikes===n,'pitch step predecessor prefix differs');return m;
};
type Census=ReturnType<typeof rawCensus>;
export const assertPitchStepRows=(before:Census,after:Census,step:TerminalPitchStep)=>{
 const n=target(step);same(before.map(t=>t.table),after.map(t=>t.table),'pitch step changed owner inventory');let added=0,heads=0;
 for(const[i,old]of before.entries()){
  const next=after[i];for(const row of old.rows){const candidates=next.rows.filter(r=>r.__ack_rowid===row.__ack_rowid);assert(candidates.length===1,'pitch step removed or duplicated an original row');const current=candidates[0];
   if(old.table==='physical_pitch_progress_heads'&&row.game_id==='game-1'&&row.play_id===8){heads++;assert(row.revision===n-1&&row.last_source_id===ids.takeIds[n-2]&&current.revision===n&&current.last_source_id===ids.takeIds[n-1],'pitch step head revision differs');same({...current,revision:row.revision,last_source_id:row.last_source_id},row,'pitch step changed head identity');}
   else same(current,row,'pitch step changed an original row');}
  for(const row of next.rows)if(!old.rows.some(r=>r.__ack_rowid===row.__ack_rowid)){added++;assert(old.table==='physical_pitch_progress_actions'&&row.source_id===ids.takeIds[n-1]&&row.game_id==='game-1'&&row.play_id===8&&row.progress_revision===n,'pitch step added an unrelated row');}
 }assert(added===1&&heads===1,'pitch step requires one action and one existing head advance');
};
export const assertPitchStepResult=(prefix:readonly DurablePhysicalPitch[],step:TerminalPitchStep)=>{
 const n=target(step);assert(prefix.length===n,'pitch step prefix length differs');for(const[i,p]of prefix.entries()){
  const timeline=p.result.pitch.resolution.timeline;assert(p.source.sourceId===ids.takeIds[i]&&p.progressRevision===i+1&&timeline.playId===8,'pitch step physical identity differs');
  if(i===2)assert(timeline.status.kind==='strikeout','pitch step requires actual physical K');
  else assert(timeline.status.kind==='active'&&timeline.status.count.balls===0&&timeline.status.count.strikes===i+1,'pitch step requires the actual next called strike');
 }
};
const syncDir=(path:string)=>{const fd=openSync(path,'r');try{fsyncSync(fd);}finally{closeSync(fd);}};
const durableJson=(path:string,value:unknown)=>{const fd=openSync(path,'wx',0o600);try{writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fsyncSync(fd);}finally{closeSync(fd);}syncDir(dirname(path));};
const labels=['metadata','copy','readiness','recipe','prefix','current_workload','open_owners','accept','retry','readback','close','reopen','preserve']as const;
export const createPitchStepTrace=(path:string)=>{
 const fd=openSync(path,'wx',0o600);try{syncDir(dirname(path));}catch(error){closeSync(fd);throw error;}let events=0,bytes=0,closed=false,receipt:{path:string;sha256:string;events:number}|undefined;
 const append=(value:unknown)=>{assert(!closed,'pitch step trace is closed');const line=JSON.stringify({sequence:events,...value as object})+'\n';assert(events<128&&bytes+Buffer.byteLength(line)<=65536,'pitch step trace budget exceeded');writeFileSync(fd,line);fsyncSync(fd);events++;bytes+=Buffer.byteLength(line);};
 return{span<T>(label:typeof labels[number],body:()=>T):T{assert(labels.includes(label),'pitch step trace label differs');const spanId=events,start=performance.now();append({event:'start',spanId,label});let value:T;
  try{value=body();}catch(error){try{append({event:'failed',spanId,label,error:error instanceof Error?error.message.slice(0,500):'owner failure'});}catch(logging){throw new AggregateError([error,logging],'pitch owner and trace failed',{cause:error});}throw error;}
  append({event:'complete',spanId,label,elapsedMs:performance.now()-start});return value;},
 returned(operation:'accept'|'retry',raw:DurablePhysicalPitch){const p=cloneInert(raw);assert(['accept','retry'].includes(operation)&&ids.takeIds.includes(p.source.sourceId as typeof ids.takeIds[number])&&[2,3].includes(p.progressRevision),'pitch returned-write observation differs');append({event:'owner_returned',operation,sourceId:p.source.sourceId,sourceHash:hash(p.source),snapshotHash:hash(p),progressRevision:p.progressRevision});},
 returnedClosure(operation:'enqueue'|'retry',raw:DurablePhysicalPlayClosure){const value=cloneInert(raw);assert(['enqueue','retry'].includes(operation)&&value.source.sourceId===ids.closureSourceId&&value.status==='PENDING','closure returned observation differs');append({event:'closure_returned',operation,sourceId:value.source.sourceId,sourceHash:hash(value.source),proposalHash:hash(value.proposal),status:value.status});},
 close(){if(!closed){closed=true;try{fsyncSync(fd);}finally{closeSync(fd);}receipt={path,sha256:fileHash(path),events};}return receipt!;}};
};
const pin=(p:Pin)=>{assert(validPin(p)&&realpathSync(p.path)===p.path&&lstatSync(p.path).isFile(),'pitch step pin is not canonical');assert.equal(fileHash(p.path),p.sha256,'pitch step pinned bytes changed');};
const readPin=<T=any>(p:Pin):T=>{pin(p);return cloneInert(JSON.parse(readFileSync(p.path,'utf8')))as T;};
const closedFile=(path:string)=>{for(const suffix of ['-wal','-shm','-journal'])assert(!existsSync(path+suffix),'pitch step requires a closed artifact');};
/** One new owner-accepted pitch from the actual preceding closed result. No
 * closure/scoring/workload writer, initializer, recipe tuning or P1 restart. */
export const runTerminalContinuationPitchStep=(raw:TerminalPitchStepInput)=>{
 const input=capturePitchStepInput(raw);assert(input.nativeReleased===true,'pitch step has not been reviewed and released');assert(!existsSync(input.destinationDirectory),'pitch step requires new private output');mkdirSync(input.destinationDirectory,{mode:0o700});syncDir(dirname(input.destinationDirectory));assert(realpathSync(input.destinationDirectory)===input.destinationDirectory,'pitch step output aliases');
 const trace=createPitchStepTrace(input.tracePath),resources:{close():void}[]=[],track=<T extends{close():void}>(r:T)=>{resources.push(r);return r;};
 const closeAll=()=>{const errors:unknown[]=[];while(resources.length)try{resources.pop()!.close();}catch(e){errors.push(e);}if(errors.length)throw new AggregateError(errors,'pitch step handle cleanup failed');};let failed=false,primary:unknown;
 try{
  const prior=trace.span('metadata',()=>{
   const m=validatePitchStepPredecessor(input.step,readPin(input.predecessor)),q=m.qualification,config=readPin(q.config),terminal=readPin(q.terminal),report=readPin(q.report),receipt=readPin(q.receipt),recipe=readPin(input.recipe);
   assert(terminal.status==='passed'&&terminal.configSha256===q.config.sha256&&terminal.originalChildExit===0&&terminal.tests.passedCases===1&&terminal.tests.expectedFailedCases===0&&terminal.tests.reportSha256===q.report.sha256&&report.numPassedTests===1&&report.numFailedTests===0,'pitch predecessor qualification differs');
   same(terminal.before,terminal.after,'pitch predecessor gate inputs changed');same(terminal.failures,[],'pitch predecessor failed');same(terminal.remainingOwnedProcesses,[],'pitch predecessor processes remain');assert(terminal.tests.skipped.every((v:any)=>v.credit===0),'pitch predecessor skipped credit differs');
   assert(m.sourceTree===config.sourceIdentity.src&&receipt.sourceTree===m.sourceTree&&receipt.allHandlesClosed===true&&receipt.reopened===true&&receipt.originalRowsPreserved===true&&receipt.aggregateP1Credit===0,'pitch predecessor source or closure differs');
   assert(input.step==='take_1'?receipt.version==='terminal_retained_prefix_recovery_receipt_v1':receipt.version==='terminal_continuation_pitch_step_receipt_v1'&&receipt.step==='take_1','pitch predecessor receipt kind differs');
   same(receipt.output,m.artifact,'pitch predecessor artifact differs');same(receipt.recipe,input.recipe,'pitch predecessor recipe differs');same(receipt.ownerReceipts.physical,m.physical,'pitch predecessor physical receipt differs');same(recipe.ids,ids,'pitch step Source IDs differ');same(recipe.game,terminalContinuationGame,'pitch step nine-inning policy differs');closedFile(m.artifact.path);pin(m.artifact);return{m,receipt,recipe};
  });
  const outputPath=join(input.destinationDirectory,'game.sqlite');trace.span('copy',()=>{copyFileSync(prior.m.artifact.path,outputPath,constants.COPYFILE_EXCL);assert.equal(fileHash(outputPath),prior.m.artifact.sha256);});
  const db=track(new DatabaseSync(outputPath)),before=rawCensus(db),schema=schemaCensus(db),read=<T>(body:()=>T)=>withSqliteReadTransaction(db,()=>withBattedVenueLegalReadSnapshot(db,body));
  durableJson(join(input.destinationDirectory,'before-census.json'),{rows:before,schema});same(hash(before),prior.receipt.rowCensusHash,'pitch step closed predecessor rows differ');same(hash(schema),prior.receipt.schemaCensusHash,'pitch step closed predecessor schema differs');
  const prepared=read(()=>{
   const ready=trace.span('readiness',()=>foulTerminalNextPlayReadinessFromSqlite(db).read(ids.terminalSourceId)),p=ready.archive.proposal,c=ready.archive.result.completion;
   same({sourceId:ids.terminalSourceId,completionId:c.completionId,snapshotHash:c.snapshotHash,applicationId:p.source.applicationId,durableRevision:ready.archive.result.official.receipt.durableRevision},prior.m.originalTerminal,'pitch step original terminal lineage differs');
   const original=trace.span('recipe',()=>readOriginalPhysicalPitchPrefixFromSqlite(db,p.physicalPitchSourceId));assert(original[0]?.source.sourceId===ids.recipePitchSourceId&&hash(original[0].source)===p.originalPhysicalPitchPrefix[0].sourceHash,'pitch step accepted original recipe differs');
   const prefix=trace.span('prefix',()=>readPhysicalPitchProgressFromSqlite(db,'game-1',8));assert(prefix.length===target(input.step)-1,'pitch step incoming physical prefix differs');const last=prefix.at(-1)!,actor=last.frame.batterActor;assert(actor);same({sourceId:actor.source.sourceId,snapshotHash:hash(actor)},prior.m.originalActor,'pitch step original actor lineage differs');
   assert(last.source.sourceId===prior.m.physical.sourceId&&hash(last.source)===prior.m.physical.sourceHash&&hash(last)===prior.m.physical.snapshotHash,'pitch step authenticated predecessor differs');
   const workload=trace.span('current_workload',()=>readActualRoleWorkloadState(db,'career-a','p2'));assert(workload);const source=materializeContinuationTake(original[0].source,actor,workload,prefix);assert(source.sourceId===ids.takeIds[target(input.step)-1],'pitch step new Source differs');return{ready,p,actor,prefix,source};
  });
  const pitches=trace.span('open_owners',()=>{
   const links=track(openSqlitePlayerPersonLinkStore(outputPath)),official=track(new SqliteOfficialStateStore(outputPath)),binding=prepared.p.participants[0].binding;
   const participation=track(new SqliteOfficialParticipationStore(outputPath,{readGame:gameId=>gameId===prepared.p.gameId?{careerId:binding.careerId,competitionEditionId:binding.competitionEditionId,gameDay:binding.gameDay,homeClubId:prior.recipe.game.homeClubId,awayClubId:prior.recipe.game.awayClubId,fixtureEventId:binding.fixtureEventId}:null,readRoster:()=>null,readPersonLink:(playerId,sourceId)=>{const link=links.readLink(sourceId);return link?.playerId===playerId?{sourceId,personId:link.personId}:null;}}));
   const initialWorlds=track(openSqliteOfficialInitialWorldStore(outputPath,{matches:official,participation})),workload=track(openSqlitePlayerWorkloadRecoveryStore(outputPath,links)),timing=track(openSqlitePlayerPitchTimingStore(outputPath,links)),release=track(openSqlitePlayerReleaseGeometryStore(outputPath,links)),policies=track(openSqlitePitchFatiguePolicyStore(outputPath));
   const owner=track(openSqlitePhysicalPitchProgressStore(outputPath,{matches:official,initialWorlds,participation,runtime:{workload,timing,release,policies,effortPolicies:{readAcceptedPolicy:id=>id===prepared.source.effortPolicy.sourceId?prepared.source.effortPolicy:null}}},{readAcceptedAction:id=>id===prepared.source.sourceId?prepared.source:null}));
   same(rawCensus(db),before,'pitch step opening existing owners wrote rows');same(schemaCensus(db),schema,'pitch step opening existing owners changed schema');return owner;
  });
  const accepted=trace.span('accept',()=>{const result=pitches.accept(prepared.source.sourceId,prepared.prefix.length);trace.returned('accept',result);return result;});
  trace.span('retry',()=>{const rows=rawCensus(db),result=pitches.accept(prepared.source.sourceId,prepared.prefix.length);trace.returned('retry',result);same(result,accepted,'pitch step retry result differs');same(rawCensus(db),rows,'pitch step retry wrote rows');});
  const result=trace.span('readback',()=>read(()=>{
   const prefix=readPhysicalPitchProgressFromSqlite(db,'game-1',8);assertPitchStepResult(prefix,input.step);const last=prefix.at(-1)!;same(last,accepted,'pitch step original readback differs from returned write');same(last.source,prepared.source,'pitch step original new Source differs');const rows=rawCensus(db);assertPitchStepRows(before,rows,input.step);same(schemaCensus(db),schema,'pitch step changed schema');durableJson(join(input.destinationDirectory,'after-census.json'),{rows,schema});return{last,rows};
  }));
  trace.span('close',()=>{closeAll();closedFile(outputPath);const fd=openSync(outputPath,'r');try{fsyncSync(fd);}finally{closeSync(fd);}syncDir(input.destinationDirectory);});
  trace.span('reopen',()=>{const reopened=track(new DatabaseSync(outputPath));withSqliteReadTransaction(reopened,()=>{const rows=rawCensus(reopened),currentSchema=schemaCensus(reopened);same(rows,result.rows,'pitch step reopened rows differ');same(currentSchema,schema,'pitch step reopened schema differs');durableJson(join(input.destinationDirectory,'reopened-census.json'),{rows,schema:currentSchema});});closeAll();closedFile(outputPath);});
  trace.span('preserve',()=>{closedFile(prior.m.artifact.path);pin(prior.m.artifact);pin(input.predecessor);pin(input.recipe);for(const p of Object.values(prior.m.qualification)as Pin[])pin(p);});
  const timeline=result.last.result.pitch.resolution.timeline,traceReceipt=trace.close(),physical={sourceId:result.last.source.sourceId,sourceHash:hash(result.last.source),snapshotHash:hash(result.last),progressRevision:result.last.progressRevision,count:timeline.status.kind==='active'?timeline.status.count:null,status:timeline.status.kind,lastEventTick:timeline.lastEventTick};
  const receipt={version:'terminal_continuation_pitch_step_receipt_v1',step:input.step,sourceTree:input.sourceTree,predecessor:input.predecessor,input:prior.m.artifact,output:{path:outputPath,sha256:fileHash(outputPath)},recipe:input.recipe,originalFailedStage:prior.m.originalFailedStage,aggregateP1Credit:0,
   allHandlesClosed:true,reopened:true,originalRowsPreserved:true,rowCensusHash:hash(result.rows),schemaCensusHash:hash(schema),ownerReceipts:{terminal:prior.m.originalTerminal,originalActor:prior.m.originalActor,physical},trace:traceReceipt,
   rawEvidence:['before-census.json','after-census.json','reopened-census.json'].map(name=>{const path=join(input.destinationDirectory,name);return{path,sha256:fileHash(path)};})};durableJson(input.receiptPath,receipt);return receipt;
 }catch(error){failed=true;primary=error;throw error;}finally{const errors:unknown[]=[];try{closeAll();}catch(e){errors.push(e);}try{trace.close();}catch(e){errors.push(e);}if(errors.length)throw new AggregateError(failed?[primary,...errors]:errors,'pitch step cleanup failed',{cause:failed?primary:errors[0]});}
};
