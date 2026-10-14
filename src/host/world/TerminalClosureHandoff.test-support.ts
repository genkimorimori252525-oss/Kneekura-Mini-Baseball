import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {closeSync,constants,copyFileSync,existsSync,fsyncSync,lstatSync,mkdirSync,openSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {dirname,isAbsolute,join} from 'node:path';
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
import {openSqlitePhysicalPitchProgressStore} from './SqlitePhysicalPitchProgressStore';
import {openSqlitePhysicalPlayClosureStore} from './SqlitePhysicalPlayClosureStore';
import {foulTerminalNextPlayReadinessFromSqlite} from './FoulTerminalNextPlayReadiness';
import {readPhysicalPitchProgressFromSqlite} from './PhysicalPitchEvidenceFromSqlite';
import {withBattedVenueLegalReadSnapshot} from './SqliteBattedVenueLegalPolicyStore';
import {withSqliteReadTransaction} from './SqliteReadTransaction.test-support';
import {fileHash,rawCensus,schemaCensus} from './ActualFoulTerminalAcknowledgementCutover.test-support';
import {createPitchStepTrace,assertPitchStepResult} from './TerminalContinuationPitchStep.test-support';
import {assertContinuationRows,materializeContinuationClosure,terminalContinuationFixtureIds as ids,terminalContinuationGame,type TerminalContinuationStageReceipt} from './TerminalContinuationFixtureInputs.test-support';
export {closureContinuationReceiptFields} from './TerminalContinuationFixtureInputs.test-support';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite')as typeof import('node:sqlite');
type Pin=Readonly<{path:string;sha256:string}>;
export type TerminalClosureHandoffInput=Readonly<{version:'terminal_closure_handoff_v1';nativeReleased:boolean;sourceTree:string;qualifiedPhysical:Pin;recipe:Pin;destinationDirectory:string;tracePath:string;receiptPath:string}>;
const same=(a:unknown,b:unknown,label:string)=>assert.equal(json(a),json(b),label);
const fields=(v:unknown,names:string[])=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&json(Object.keys(v).sort())===json(names.sort());
const validPin=(p:Pin)=>fields(p,['path','sha256'])&&typeof p.path==='string'&&isAbsolute(p.path)&&/^[a-f0-9]{64}$/.test(p.sha256);
export const captureClosureHandoffInput=(raw:TerminalClosureHandoffInput)=>{
 const v=cloneInert(raw);assert(fields(v,['version','nativeReleased','sourceTree','qualifiedPhysical','recipe','destinationDirectory','tracePath','receiptPath'])&&v.version==='terminal_closure_handoff_v1'&&typeof v.nativeReleased==='boolean'&&/^[a-f0-9]{40}$/.test(v.sourceTree)&&validPin(v.qualifiedPhysical)&&validPin(v.recipe),'closure handoff controls differ');
 assert([v.destinationDirectory,v.tracePath,v.receiptPath].every(p=>typeof p==='string'&&isAbsolute(p))&&dirname(v.tracePath)===v.destinationDirectory&&dirname(v.receiptPath)===v.destinationDirectory&&v.tracePath!==v.receiptPath,'closure handoff paths differ');return v;
};
export const validateClosurePhysicalInput=(raw:unknown)=>{
 const m=cloneInert(raw)as any;assert(m?.version==='terminal_continuation_pitch_step_qualified_input_v1'&&m.step==='take_2'&&m.qualified===true&&m.allHandlesClosed===true&&m.reopened===true&&m.originalRowsPreserved===true&&m.aggregateP1Credit===0&&validPin(m.artifact),'closure requires the qualified split-pitch input');
 assert(m.physical?.sourceId===ids.takeIds[2]&&m.physical.progressRevision===3&&m.physical.status==='strikeout'&&m.physical.count===null,'closure requires the actual qualified K');return m;
};
const pin=(p:Pin)=>{assert(validPin(p)&&realpathSync(p.path)===p.path&&lstatSync(p.path).isFile(),'closure handoff pin is not canonical');assert.equal(fileHash(p.path),p.sha256,'closure handoff pinned bytes changed');};
const readPin=<T=any>(p:Pin):T=>{pin(p);return cloneInert(JSON.parse(readFileSync(p.path,'utf8')))as T;};
const closed=(path:string)=>{for(const suffix of ['-wal','-shm','-journal'])assert(!existsSync(path+suffix),'closure handoff requires a closed artifact');};
const syncDir=(path:string)=>{const fd=openSync(path,'r');try{fsyncSync(fd);}finally{closeSync(fd);}};
const save=(path:string,value:unknown)=>{const fd=openSync(path,'wx',0o600);try{writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fsyncSync(fd);}finally{closeSync(fd);}syncDir(dirname(path));};
/** A new receipt arm consumes the actual split-pitch lineage. It never creates
 * or claims a successful aggregate P1 receipt. Existing closure owners alone
 * derive and enqueue the proposal; later stage owners remain unchanged. */
export const runTerminalClosureHandoff=(raw:TerminalClosureHandoffInput)=>{
 const input=captureClosureHandoffInput(raw);assert(input.nativeReleased===true,'closure handoff has not been reviewed and released');assert(!existsSync(input.destinationDirectory),'closure handoff output already exists');mkdirSync(input.destinationDirectory,{mode:0o700});syncDir(dirname(input.destinationDirectory));assert(realpathSync(input.destinationDirectory)===input.destinationDirectory,'closure handoff output aliases');
 const trace=createPitchStepTrace(input.tracePath),resources:{close():void}[]=[],track=<T extends{close():void}>(r:T)=>{resources.push(r);return r;};const closeAll=()=>{const errors:unknown[]=[];while(resources.length)try{resources.pop()!.close();}catch(e){errors.push(e);}if(errors.length)throw new AggregateError(errors,'closure handoff handle cleanup failed');};let failed=false,primary:unknown;
 try{
  const prior=trace.span('metadata',()=>{
   const m=validateClosurePhysicalInput(readPin(input.qualifiedPhysical)),q=m.qualification,config=readPin(q.config),terminal=readPin(q.terminal),report=readPin(q.report),receipt=readPin(q.receipt),recipe=readPin(input.recipe);
   assert(terminal.status==='passed'&&terminal.configSha256===q.config.sha256&&terminal.originalChildExit===0&&terminal.tests.passedCases===1&&terminal.tests.expectedFailedCases===0&&terminal.tests.reportSha256===q.report.sha256&&report.numPassedTests===1&&report.numFailedTests===0&&config.cases.filter((c:any)=>c.status==='passed').length===1&&config.cases.find((c:any)=>c.status==='passed').name.startsWith('PS-N02 '),'closure physical qualification differs');
   same(terminal.before,terminal.after,'closure predecessor gate inputs changed');same(terminal.failures,[],'closure predecessor failed');same(terminal.remainingOwnedProcesses,[],'closure predecessor processes remain');assert(terminal.tests.skipped.every((c:any)=>c.credit===0),'closure predecessor skipped credit differs');
   assert(receipt.version==='terminal_continuation_pitch_step_receipt_v1'&&receipt.step==='take_2'&&receipt.sourceTree===m.sourceTree&&m.sourceTree===config.sourceIdentity.src&&receipt.allHandlesClosed===true&&receipt.reopened===true&&receipt.originalRowsPreserved===true&&receipt.aggregateP1Credit===0,'closure physical receipt differs');
   same(receipt.output,m.artifact,'closure physical artifact differs');same(receipt.ownerReceipts.physical,m.physical,'closure physical receipt identity differs');same(receipt.recipe,input.recipe,'closure recipe lineage differs');same(recipe.ids,ids,'closure explicit Source IDs differ');same(recipe.game,terminalContinuationGame,'closure nine-inning policy differs');closed(m.artifact.path);pin(m.artifact);return{m,receipt,recipe};
  });
  const outputPath=join(input.destinationDirectory,'game.sqlite');trace.span('copy',()=>{copyFileSync(prior.m.artifact.path,outputPath,constants.COPYFILE_EXCL);assert.equal(fileHash(outputPath),prior.m.artifact.sha256);});
  const db=track(new DatabaseSync(outputPath)),before=rawCensus(db),schema=schemaCensus(db),read=<T>(body:()=>T)=>withSqliteReadTransaction(db,()=>withBattedVenueLegalReadSnapshot(db,body));same(hash(before),prior.receipt.rowCensusHash,'closure predecessor rows differ');same(hash(schema),prior.receipt.schemaCensusHash,'closure predecessor schema differs');save(join(input.destinationDirectory,'before-census.json'),{rows:before,schema});
  const prepared=read(()=>{
   const ready=trace.span('readiness',()=>foulTerminalNextPlayReadinessFromSqlite(db).read(ids.terminalSourceId)),p=ready.archive.proposal,c=ready.archive.result.completion;
   same({sourceId:ids.terminalSourceId,completionId:c.completionId,snapshotHash:c.snapshotHash,applicationId:p.source.applicationId,durableRevision:ready.archive.result.official.receipt.durableRevision},prior.m.originalTerminal,'closure original terminal lineage differs');
   const prefix=trace.span('prefix',()=>readPhysicalPitchProgressFromSqlite(db,'game-1',8));assertPitchStepResult(prefix,'take_2');const physical=prefix[2],actor=physical.frame.batterActor;assert(actor);same({sourceId:actor.source.sourceId,snapshotHash:hash(actor)},prior.m.originalActor,'closure original actor lineage differs');assert(hash(physical.source)===prior.m.physical.sourceHash&&hash(physical)===prior.m.physical.snapshotHash,'closure actual physical K differs');
   assert(c.version==='actual_foul_terminal_post_play_completion_v1','closure setup lineage differs');const source=materializeContinuationClosure(physical,c.source.worldSetup,prior.recipe.game);return{p,prefix,physical,source};
  });
  const owner=trace.span('open_owners',()=>{
   const links=track(openSqlitePlayerPersonLinkStore(outputPath)),official=track(new SqliteOfficialStateStore(outputPath)),binding=prepared.p.participants[0].binding;
   const participation=track(new SqliteOfficialParticipationStore(outputPath,{readGame:gameId=>gameId===prepared.p.gameId?{careerId:binding.careerId,competitionEditionId:binding.competitionEditionId,gameDay:binding.gameDay,homeClubId:prior.recipe.game.homeClubId,awayClubId:prior.recipe.game.awayClubId,fixtureEventId:binding.fixtureEventId}:null,readRoster:()=>null,readPersonLink:(playerId,sourceId)=>{const link=links.readLink(sourceId);return link?.playerId===playerId?{sourceId,personId:link.personId}:null;}}));
   const initialWorlds=track(openSqliteOfficialInitialWorldStore(outputPath,{matches:official,participation})),workload=track(openSqlitePlayerWorkloadRecoveryStore(outputPath,links)),timing=track(openSqlitePlayerPitchTimingStore(outputPath,links)),release=track(openSqlitePlayerReleaseGeometryStore(outputPath,links)),policies=track(openSqlitePitchFatiguePolicyStore(outputPath));
   const pitches=track(openSqlitePhysicalPitchProgressStore(outputPath,{matches:official,initialWorlds,participation,runtime:{workload,timing,release,policies,effortPolicies:{readAcceptedPolicy:id=>id===prepared.physical.source.effortPolicy.sourceId?prepared.physical.source.effortPolicy:null}}}));
   const closure=track(openSqlitePhysicalPlayClosureStore(outputPath,{physicalPitches:pitches,initialWorlds,participation,personLinks:links},{readAcceptedClosure:id=>id===prepared.source.sourceId?prepared.source:null}));same(rawCensus(db),before,'closure opening existing owners wrote rows');same(schemaCensus(db),schema,'closure opening existing owners changed storage');assert.equal(closure.read(ids.closureSourceId),null,'closure predecessor already owns a queue');return closure;
  });
  const queued=trace.span('accept',()=>{const result=owner.enqueue(ids.closureSourceId);trace.returnedClosure('enqueue',result);return result;});assert(queued.status==='PENDING');
  trace.span('retry',()=>{const rows=rawCensus(db),result=owner.enqueue(ids.closureSourceId);trace.returnedClosure('retry',result);same(result,queued,'closure enqueue retry differs');same(rawCensus(db),rows,'closure enqueue retry wrote rows');});
  const after=trace.span('readback',()=>{same(owner.read(ids.closureSourceId),queued,'closure original queue readback differs');same(queued.source,prepared.source,'closure accepted Source differs');const rows=rawCensus(db);assertContinuationRows(before,rows,'closure_queued');same(schemaCensus(db),schema,'closure queue changed storage');save(join(input.destinationDirectory,'after-census.json'),{rows,schema});return rows;});
  trace.span('close',()=>{closeAll();closed(outputPath);const fd=openSync(outputPath,'r');try{fsyncSync(fd);}finally{closeSync(fd);}syncDir(input.destinationDirectory);});
  trace.span('reopen',()=>{const reopened=track(new DatabaseSync(outputPath));withSqliteReadTransaction(reopened,()=>{const rows=rawCensus(reopened),current=schemaCensus(reopened);same(rows,after,'closure reopened rows differ');same(current,schema,'closure reopened schema differs');save(join(input.destinationDirectory,'reopened-census.json'),{rows,schema:current});});closeAll();closed(outputPath);});
  trace.span('preserve',()=>{closed(prior.m.artifact.path);pin(prior.m.artifact);pin(input.qualifiedPhysical);pin(input.recipe);for(const p of Object.values(prior.m.qualification)as Pin[])pin(p);});const traceReceipt=trace.close();
  const receipt:TerminalContinuationStageReceipt={version:'terminal_continuation_stage_v2',stage:'closure_queued',sourceTree:input.sourceTree,input:prior.m.artifact,output:{path:outputPath,sha256:fileHash(outputPath)},recipeHash:input.recipe.sha256,predecessorReceiptHash:prior.m.qualification.receipt.sha256,allHandlesClosed:true,reopened:true,originalRowsPreserved:true,twoPriorCompletionLineage:false,
   splitPhysicalOrigin:{kind:'qualified_single_pitch_chain',qualifiedInput:input.qualifiedPhysical,physicalReceipt:prior.m.qualification.receipt,aggregateP1Credit:0},ownerReceipts:{terminal:prior.m.originalTerminal,originalActor:prior.m.originalActor,
    physical:{playId:8,sourceIds:ids.takeIds,sourceHashes:prepared.prefix.map(p=>hash(p.source)),snapshotHashes:prepared.prefix.map(hash),status:'strikeout'},closure:{sourceId:queued.source.sourceId,status:queued.status,sourceHash:hash(queued.source),proposalHash:hash(queued.proposal)}}};
  save(join(input.destinationDirectory,'conservation.json'),{trace:traceReceipt,rowCensusHash:hash(after),schemaCensusHash:hash(schema),rawEvidence:['before-census.json','after-census.json','reopened-census.json'].map(name=>{const path=join(input.destinationDirectory,name);return{path,sha256:fileHash(path)};})});save(input.receiptPath,receipt);return receipt;
 }catch(error){failed=true;primary=error;throw error;}finally{const errors:unknown[]=[];try{closeAll();}catch(e){errors.push(e);}try{trace.close();}catch(e){errors.push(e);}if(errors.length)throw new AggregateError(failed?[primary,...errors]:errors,'closure handoff cleanup failed',{cause:failed?primary:errors[0]});}
};
