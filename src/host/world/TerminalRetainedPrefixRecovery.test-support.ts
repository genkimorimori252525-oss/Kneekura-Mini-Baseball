import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {closeSync,constants,copyFileSync,existsSync,fsyncSync,lstatSync,mkdirSync,openSync,readFileSync,realpathSync,statSync,writeFileSync} from 'node:fs';
import {dirname,isAbsolute,join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {cloneInert} from '../../core/adjudication/OfficialWindowPolicy';
import {actorHash as hash,actorJson as json} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import {foulTerminalNextPlayReadinessFromSqlite} from './FoulTerminalNextPlayReadiness';
import {readOriginalPhysicalPitchPrefixFromSqlite,readPhysicalPitchProgressFromSqlite} from './PhysicalPitchEvidenceFromSqlite';
import {readActualRoleWorkloadState} from './ActualRoleWorkloadState';
import {withBattedVenueLegalReadSnapshot} from './SqliteBattedVenueLegalPolicyStore';
import {withSqliteReadTransaction} from './SqliteReadTransaction.test-support';
import {fileHash,rawCensus,schemaCensus} from './ActualFoulTerminalAcknowledgementCutover.test-support';
import {assertContinuationRows,materializeContinuationTake,terminalContinuationFixtureIds as ids,terminalContinuationGame} from './TerminalContinuationFixtureInputs.test-support';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite')as typeof import('node:sqlite');
type Pin=Readonly<{path:string;sha256:string}>;
export type RetainedRecoveryInput=Readonly<{version:'terminal_retained_prefix_recovery_v1';nativeReleased:boolean;sourceTree:string;
 failed:Readonly<{config:Pin;input:Pin;terminal:Pin;tuple:Pin}>;admission:Readonly<{config:Pin;terminal:Pin;report:Pin;receipt:Pin}>;recipe:Pin;
 destinationDirectory:string;tracePath:string;receiptPath:string}>;
type TupleRow=Readonly<{path:string;exists:boolean;sha256?:string;stat?:Readonly<{dev:number;ino:number;size:number;mtimeNs:number;ctimeNs:number}>}>;
const same=(a:unknown,b:unknown,label:string)=>assert.equal(json(a),json(b),label);
const fields=(v:unknown,keys:string[])=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&json(Object.keys(v).sort())===json(keys.sort());
const validPin=(p:Pin)=>fields(p,['path','sha256'])&&typeof p.path==='string'&&isAbsolute(p.path)&&/^[a-f0-9]{64}$/.test(p.sha256);
export const captureRetainedRecoveryInput=(raw:RetainedRecoveryInput):RetainedRecoveryInput=>{
 const x=cloneInert(raw);assert(fields(x,['version','nativeReleased','sourceTree','failed','admission','recipe','destinationDirectory','tracePath','receiptPath'])
 &&x.version==='terminal_retained_prefix_recovery_v1'&&typeof x.nativeReleased==='boolean'&&/^[a-f0-9]{40}$/.test(x.sourceTree),'retained recovery controls differ');
 assert(fields(x.failed,['config','input','terminal','tuple'])&&fields(x.admission,['config','terminal','report','receipt'])&&[...Object.values(x.failed),...Object.values(x.admission),x.recipe].every(validPin),'retained recovery metadata pins differ');
 assert([x.destinationDirectory,x.tracePath,x.receiptPath].every(v=>typeof v==='string'&&isAbsolute(v))&&dirname(x.tracePath)===x.destinationDirectory&&dirname(x.receiptPath)===x.destinationDirectory&&x.tracePath!==x.receiptPath,'retained recovery output paths differ');return x;
};
export const validateRetainedRecoveryTuple=(raw:readonly TupleRow[]):readonly TupleRow[]=>{
 const rows=cloneInert(raw);assert(Array.isArray(rows)&&rows.length===4,'retained recovery requires the complete tuple');
 const main=rows[0]?.path;assert(typeof main==='string'&&isAbsolute(main),'retained recovery tuple path differs');
 for(const[i,suffix]of ['','-wal','-shm','-journal'].entries()){
  const row:TupleRow=rows[i];assert(row?.path===main+suffix&&row.exists===(i<3),'retained recovery main WAL SHM must exist and journal must be absent');
  assert(fields(row,i<3?['path','exists','sha256','stat']:['path','exists']),'retained recovery tuple fields differ');
  if(i<3)assert(/^[a-f0-9]{64}$/.test(row.sha256!)&&fields(row.stat,['dev','ino','size','mtimeNs','ctimeNs'])&&Number.isSafeInteger(row.stat!.size)&&row.stat!.size>0,'retained recovery requires nonempty pinned tuple files');
 }return rows;
};
/** Only conservation, never an original-owner proof. */
export const assertRetainedTakeOnly=(before:Parameters<typeof assertContinuationRows>[0],after:Parameters<typeof assertContinuationRows>[1]):void=>{
 assertContinuationRows(before,after,'physical_k');const additions=after.flatMap((table,i)=>table.rows.filter(row=>!before[i].rows.some(old=>old.__ack_rowid===row.__ack_rowid)).map(row=>({table:table.table,row})));
 assert(additions.length===2,'retained recovery requires exactly one action and one head');
 const action=additions.find(a=>a.table==='physical_pitch_progress_actions')?.row,head=additions.find(a=>a.table==='physical_pitch_progress_heads')?.row;
 assert(action?.source_id===ids.takeIds[0]&&action.game_id==='game-1'&&action.play_id===8&&action.progress_revision===1
  &&head?.game_id==='game-1'&&head.play_id===8&&head.revision===1&&head.last_source_id===ids.takeIds[0],'retained recovery physical prefix differs');
};
const labels=['metadata','copy_tuple','baseline_census','recovered_census','readiness','original_prefix','retained_pitch','current_workload','proof_census','checkpoint','checkpoint_census','close','reopen_census','input_preservation']as const;
export const createRetainedRecoveryTrace=(path:string,now:()=>number=()=>performance.now())=>{
 const fd=openSync(path,'wx',0o600);try{const directory=openSync(dirname(path),'r');try{fsyncSync(directory);}finally{closeSync(directory);}}catch(error){closeSync(fd);throw error;}let count=0,bytes=0,closed=false,summary:{path:string;sha256:string;events:number}|undefined;
 const append=(row:Record<string,unknown>)=>{assert(!closed,'recovery trace is closed');const encoded=JSON.stringify({sequence:count,...row})+'\n';assert(count<128&&bytes+Buffer.byteLength(encoded)<=65536,'recovery trace budget exceeded');writeFileSync(fd,encoded);fsyncSync(fd);count++;bytes+=Buffer.byteLength(encoded);};
 const span=<T>(label:typeof labels[number],body:()=>T):T=>{
  assert(labels.includes(label),'recovery trace label differs');const start=now(),spanId=count;append({event:'start',spanId,label});
  let value:T;try{value=body();}catch(error){try{append({event:'failed',spanId,label,error:error instanceof Error?error.message.slice(0,500):'non-Error owner failure'});}catch(logging){throw new AggregateError([error,logging],'owner and recovery trace failed',{cause:error});}throw error;}
  append({event:'complete',spanId,label,elapsedMs:now()-start});return value;
 };
 return{span,close(){if(!closed){closed=true;try{fsyncSync(fd);}finally{closeSync(fd);}summary={path,sha256:fileHash(path),events:count};}return summary!;}};
};
const pin=(p:Pin)=>{assert(validPin(p)&&realpathSync(p.path)===p.path&&lstatSync(p.path).isFile(),'retained recovery pin is not canonical');assert.equal(fileHash(p.path),p.sha256,'retained recovery pinned bytes changed');};
const readPin=<T=any>(p:Pin):T=>{pin(p);return cloneInert(JSON.parse(readFileSync(p.path,'utf8')))as T;};
const closedFile=(path:string)=>{for(const suffix of ['-wal','-shm','-journal'])assert(!existsSync(path+suffix),'retained recovery requires a closed output');};
const identity=(path:string)=>{const s=statSync(path,{bigint:true});return{dev:String(s.dev),ino:String(s.ino),size:String(s.size),mtimeNs:String(s.mtimeNs),ctimeNs:String(s.ctimeNs)};};
const captureTuple=(rows:readonly TupleRow[])=>rows.map(r=>{
 assert(existsSync(r.path)===r.exists,'retained recovery tuple existence changed');if(!r.exists)return{path:r.path,exists:false};
 pin({path:r.path,sha256:r.sha256!});assert.equal(Number(statSync(r.path).size),r.stat!.size,'retained recovery tuple size changed');return{path:r.path,exists:true,sha256:r.sha256!,identity:identity(r.path)};
});
const durableJson=(path:string,value:unknown)=>{const fd=openSync(path,'wx',0o600);try{writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fsyncSync(fd);}finally{closeSync(fd);}const directory=openSync(dirname(path),'r');try{fsyncSync(directory);}finally{closeSync(directory);}};

/** One necessary original-owner readback, never a pitch writer or initializer.
 * Input authority is the complete failed main/WAL/SHM tuple. Checkpointing is
 * confined to its exclusive copy and conserves the committed SQL view exactly. */
export const recoverRetainedTerminalPrefix=(raw:RetainedRecoveryInput)=>{
 const input=captureRetainedRecoveryInput(raw);assert(input.nativeReleased===true,'retained recovery has not been reviewed and released');
 assert(!existsSync(input.destinationDirectory),'retained recovery output already exists');mkdirSync(input.destinationDirectory,{mode:0o700});const outputParent=openSync(dirname(input.destinationDirectory),'r');try{fsyncSync(outputParent);}finally{closeSync(outputParent);}assert(realpathSync(input.destinationDirectory)===input.destinationDirectory,'retained recovery output directory aliases');
 const trace=createRetainedRecoveryTrace(input.tracePath);let primary:unknown,failed=false;let db:InstanceType<typeof DatabaseSync>|undefined,baseline:InstanceType<typeof DatabaseSync>|undefined;
 try{
  const admitted=trace.span('metadata',()=>{
   const fc=readPin(input.failed.config),fi=readPin(input.failed.input),ft=readPin(input.failed.terminal),tuple=readPin(input.failed.tuple),ac=readPin(input.admission.config),at=readPin(input.admission.terminal),ar=readPin(input.admission.report),a=readPin(input.admission.receipt),recipe=readPin(input.recipe);
   assert(fc.released===true&&fc.stage==='physical_k'&&fc.sourceIdentity.src===a.sourceTree&&ft.status==='failed'&&ft.configSha256===input.failed.config.sha256&&ft.originalChildExit===-15&&ft.failures.some((e:any)=>String(e.error).includes('wall budget exceeded')),'retained recovery failed-stage provenance differs');
   same(ft.before,ft.after,'retained recovery failed-stage inputs changed');same(ft.remainingOwnedProcesses,[],'retained recovery failed processes remain');
   assert(fc.artifactEnvironment.TERMINAL_CONTINUATION_INPUT===input.failed.input.path&&fi.version==='terminal_continuation_run_v1'&&fi.nativeReleased===true&&fi.stage==='physical_k'&&fi.sourceTree===a.sourceTree,'retained recovery failed run differs');
   same(fi.predecessorReceipt,input.admission.receipt,'retained recovery A0 predecessor differs');same(fi.recipe,input.recipe,'retained recovery recipe lineage differs');
   assert(tuple.kind==='interrupted-output-unqualified'&&tuple.terminalSha256===input.failed.terminal.sha256&&tuple.configSha256===input.failed.config.sha256&&tuple.source===ft.before.source.sha256&&tuple.successReceiptExists===false,'retained recovery tuple provenance differs');same(tuple.remainingOwnedProcesses,[],'retained recovery tuple processes remain');
   assert(ac.stage==='admission'&&at.status==='passed'&&at.configSha256===input.admission.config.sha256&&at.originalChildExit===0&&at.tests.passedCases===1&&at.tests.expectedFailedCases===0&&at.tests.reportSha256===input.admission.report.sha256&&ar.numPassedTests===1&&ar.numFailedTests===0,'retained recovery A0 qualification differs');
   same(at.before,at.after,'retained recovery A0 inputs changed');same(at.failures,[],'retained recovery A0 failed');same(at.remainingOwnedProcesses,[],'retained recovery A0 processes remain');
   assert(a.version==='terminal_continuation_stage_v1'&&a.stage==='admission'&&a.allHandlesClosed===true&&a.reopened===true&&a.originalRowsPreserved===true&&a.recipeHash===input.recipe.sha256&&a.twoPriorCompletionLineage===false&&a.sourceTree===ac.sourceIdentity.src,'retained recovery A0 receipt differs');
   same(recipe.ids,ids,'retained recovery fixture IDs differ');same(recipe.game,terminalContinuationGame,'retained recovery nine-inning policy differs');
   const rows=validateRetainedRecoveryTuple(tuple.tuple);assert(rows[0].path===fi.destinationPath&&rows[0].sha256===a.output.sha256,'retained recovery failed main/A0 identity differs');closedFile(a.output.path);pin(a.output);return{a,recipe,rows,originalTuple:captureTuple(rows)};
  });
  const outputPath=join(input.destinationDirectory,'game.sqlite'),baselinePath=join(input.destinationDirectory,'admission.sqlite');
  trace.span('copy_tuple',()=>{
   for(const row of admitted.rows.filter(r=>r.exists)){const suffix=row.path.slice(admitted.rows[0].path.length);copyFileSync(row.path,outputPath+suffix,constants.COPYFILE_EXCL);assert.equal(fileHash(outputPath+suffix),row.sha256);}
   copyFileSync(admitted.a.output.path,baselinePath,constants.COPYFILE_EXCL);assert.equal(fileHash(baselinePath),admitted.a.output.sha256);same(captureTuple(admitted.rows),admitted.originalTuple,'retained recovery input changed during copy');
  });
  const prior=trace.span('baseline_census',()=>{baseline=new DatabaseSync(baselinePath);try{return withSqliteReadTransaction(baseline,()=>({rows:rawCensus(baseline!),schema:schemaCensus(baseline!)}));}finally{baseline.close();baseline=undefined;}});
  const baselineCensusPath=join(input.destinationDirectory,'baseline-census.json');durableJson(baselineCensusPath,prior);
  db=new DatabaseSync(outputPath);
  const proof=withSqliteReadTransaction(db,()=>withBattedVenueLegalReadSnapshot(db!,()=>{
   const before=trace.span('recovered_census',()=>({rows:rawCensus(db!),schema:schemaCensus(db!)}));same(before.schema,prior.schema,'retained recovery schema differs from A0');assertRetainedTakeOnly(prior.rows,before.rows);durableJson(join(input.destinationDirectory,'committed-census.json'),before);
   const ready=trace.span('readiness',()=>foulTerminalNextPlayReadinessFromSqlite(db!).read(ids.terminalSourceId)),archive=ready.archive,p=archive.proposal,c=archive.result.completion;
   assert(c.version==='actual_foul_terminal_post_play_completion_v1','retained recovery original terminal version differs');
   same({sourceId:ids.terminalSourceId,completionId:c.completionId,snapshotHash:c.snapshotHash,applicationId:p.source.applicationId,durableRevision:archive.result.official.receipt.durableRevision},admitted.a.ownerReceipts.terminal,'retained recovery original terminal differs from A0');
   const original=trace.span('original_prefix',()=>readOriginalPhysicalPitchPrefixFromSqlite(db!,p.physicalPitchSourceId));assert(original[0]?.source.sourceId===ids.recipePitchSourceId&&hash(original[0].source)===p.originalPhysicalPitchPrefix[0].sourceHash,'retained recovery accepted original recipe differs');
   const prefix=trace.span('retained_pitch',()=>readPhysicalPitchProgressFromSqlite(db!,'game-1',8));assert(prefix.length===1,'retained recovery requires exactly one actual pitch');const pitch=prefix[0],actor=pitch.frame.batterActor;assert(actor&&pitch.progressRevision===1&&pitch.frame.initialWorld===null&&pitch.frame.activationApplicationId===p.source.applicationId,'retained recovery actor activation differs');
   same({sourceId:actor.source.sourceId,snapshotHash:hash(actor)},admitted.a.ownerReceipts.originalActor,'retained recovery authenticated actor differs from A0');same(actor.match,c.activation.nextMatchState,'retained recovery actor Match differs');same(actor.world,c.nextWorld,'retained recovery actor World differs');
   same(pitch.source,materializeContinuationTake(original[0].source,actor,pitch.frame.workload,[]),'retained recovery exact TAKE Source differs');
   const timeline=pitch.result.pitch.resolution.timeline;assert(timeline.status.kind==='active'&&timeline.status.count.balls===0&&timeline.status.count.strikes===1&&timeline.playId===8,'retained recovery actual first strike differs');
   same(trace.span('current_workload',()=>readActualRoleWorkloadState(db!,'career-a','p2')),pitch.frame.workload,'retained recovery current pitcher workload differs');
   trace.span('proof_census',()=>{same(rawCensus(db!),before.rows,'retained recovery owner reads changed rows');same(schemaCensus(db!),before.schema,'retained recovery owner reads changed storage');});
   return{rows:before.rows,schema:before.schema,ownerReceipts:{terminal:admitted.a.ownerReceipts.terminal,originalActor:admitted.a.ownerReceipts.originalActor,readinessReference:ready.reference,
    physical:{sourceId:pitch.source.sourceId,sourceHash:hash(pitch.source),snapshotHash:hash(pitch),progressRevision:1,count:{balls:0,strikes:1},lastEventTick:timeline.lastEventTick},workload:{revision:pitch.frame.workload.revision,snapshotHash:hash(pitch.frame.workload)}}};
  }));
  const checkpoint=trace.span('checkpoint',()=>{const rows=db!.prepare('PRAGMA wal_checkpoint(TRUNCATE)').all();assert(rows.length===1&&rows[0].busy===0&&rows[0].log===0&&rows[0].checkpointed===0,'retained recovery checkpoint did not complete');return rows;});
  trace.span('checkpoint_census',()=>withSqliteReadTransaction(db!,()=>{const current={rows:rawCensus(db!),schema:schemaCensus(db!)};same(current.rows,proof.rows,'retained recovery checkpoint changed rows');same(current.schema,proof.schema,'retained recovery checkpoint changed schema');durableJson(join(input.destinationDirectory,'checkpoint-census.json'),current);}));
  trace.span('close',()=>{db!.close();db=undefined;closedFile(outputPath);const output=openSync(outputPath,'r');try{fsyncSync(output);}finally{closeSync(output);}const directory=openSync(input.destinationDirectory,'r');try{fsyncSync(directory);}finally{closeSync(directory);}});
  trace.span('reopen_census',()=>{db=new DatabaseSync(outputPath);try{withSqliteReadTransaction(db,()=>{const current={rows:rawCensus(db!),schema:schemaCensus(db!)};same(current.rows,proof.rows,'retained recovery reopened committed rows differ');same(current.schema,proof.schema,'retained recovery reopened schema differs');durableJson(join(input.destinationDirectory,'reopened-census.json'),current);});}finally{db.close();db=undefined;}closedFile(outputPath);});
  trace.span('input_preservation',()=>{same(captureTuple(admitted.rows),admitted.originalTuple,'retained recovery original tuple changed');closedFile(admitted.a.output.path);pin(admitted.a.output);for(const p of [...Object.values(input.failed),...Object.values(input.admission),input.recipe])pin(p);});
  const traceReceipt=trace.close(),receipt={version:'terminal_retained_prefix_recovery_receipt_v1',sourceTree:input.sourceTree,failedStage:input.failed,admission:input.admission,recipe:input.recipe,
   inputTuple:admitted.originalTuple,output:{path:outputPath,sha256:fileHash(outputPath)},allHandlesClosed:true,reopened:true,originalTuplePreserved:true,originalRowsPreserved:true,
   fileByteSemantics:'input main+nonempty WAL+SHM; SQLite checkpoint on exclusive copy only; output closed main; committed rows and schema conserved',checkpoint,
   rawEvidence:['baseline-census.json','committed-census.json','checkpoint-census.json','reopened-census.json'].map(name=>{const path=join(input.destinationDirectory,name);return{path,sha256:fileHash(path)};}),rowCensusHash:hash(proof.rows),schemaCensusHash:hash(proof.schema),ownerReceipts:proof.ownerReceipts,trace:traceReceipt,aggregateP1Credit:0};durableJson(input.receiptPath,receipt);return receipt;
 }catch(error){failed=true;primary=error;throw error;}finally{const errors:unknown[]=[];for(const resource of [db,baseline])if(resource)try{resource.close();}catch(error){errors.push(error);}try{trace.close();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(failed?[primary,...errors]:errors,'retained recovery cleanup failed',{cause:failed?primary:errors[0]});}
};
