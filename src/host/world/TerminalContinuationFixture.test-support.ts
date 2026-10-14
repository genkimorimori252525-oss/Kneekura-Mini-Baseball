import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {constants,copyFileSync,existsSync,lstatSync,mkdirSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {dirname,isAbsolute} from 'node:path';
import {cloneInert} from '../../core/adjudication/OfficialWindowPolicy';
import {SqliteOfficialStateWriter} from '../SqliteOfficialStateWriter';
import {SqliteOfficialStateStore} from '../SqliteOfficialStateStore';
import {SqliteOfficialParticipationStore} from './SqliteOfficialParticipationStore';
import {openSqliteOfficialInitialWorldStore} from './SqliteOfficialInitialWorldStore';
import {openSqlitePlayerPersonLinkStore} from './SqlitePlayerPersonLinkStore';
import {openSqlitePlayerWorkloadRecoveryStore} from './SqlitePlayerWorkloadRecoveryStore';
import {openSqlitePlayerPitchTimingStore} from './SqlitePlayerPitchTimingStore';
import {openSqlitePlayerReleaseGeometryStore} from './SqlitePlayerReleaseGeometryStore';
import {openSqlitePitchFatiguePolicyStore} from './SqlitePitchFatiguePolicyStore';
import {openSqlitePhysicalPitchProgressStore,type AcceptedPhysicalPitchActionSource} from './SqlitePhysicalPitchProgressStore';
import {openSqlitePhysicalPlayClosureStore,type AcceptedPhysicalPlayClosure,type DurablePhysicalPlayClosure} from './SqlitePhysicalPlayClosureStore';
import {openSqlitePhysicalPlateAppearanceActorStore} from './SqlitePhysicalPlateAppearanceActorStore';
import {readOriginalPhysicalPitchPrefixFromSqlite,readPhysicalPitchProgressFromSqlite} from './PhysicalPitchEvidenceFromSqlite';
import {readPhysicalPlateAppearanceActorFromSqlite,actorJson as json,actorHash as hash} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import {readActualRoleWorkloadState} from './ActualRoleWorkloadState';
import {foulTerminalPostPlayCompletionEvidenceFromSqlite} from './ActualFoulTerminalPostPlayCompletionEvidenceFromSqlite';
import {foulTerminalNextPlayReadinessFromSqlite} from './FoulTerminalNextPlayReadiness';
import {readPhysicalClosureScoringHistory,assertPriorPhysicalClosureCompleted,readPhysicalClosureProposal,assertPhysicalClosureStages,readPhysicalClosureWorkload} from './PhysicalPlayClosureEvidenceFromSqlite';
import {fileHash,rawCensus,schemaCensus} from './ActualFoulTerminalAcknowledgementCutover.test-support';
import {withSqliteReadTransaction} from './SqliteReadTransaction.test-support';
import {withBattedWorldPhysicalReadTraversal} from './SqliteBattedWorldFieldExecutionStore';
import {assertContinuationRows,materializeContinuationTake,materializeContinuationClosure,materializeContinuationNextActor,
 terminalContinuationFixtureIds as ids,terminalContinuationGame,terminalContinuationStages,validateContinuationPredecessor,closureContinuationReceiptFields,
 type TerminalContinuationStage,type TerminalContinuationStageReceipt} from './TerminalContinuationFixtureInputs.test-support';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Pin=Readonly<{path:string;sha256:string}>;
export type TerminalContinuationRun=Readonly<{version:'terminal_continuation_run_v1';nativeReleased:boolean;stage:TerminalContinuationStage;
 recipe:Pin;predecessorReceipt:Pin|null;destinationPath:string;receiptPath:string;sourceTree:string}>;
type Recipe=Readonly<{version:'terminal_continuation_fixture_recipe_v1';actorCheckpoint:Pin;ids:typeof ids;game:typeof terminalContinuationGame;
 straightTakeAuthority:Readonly<{kind:'original_terminal_physical_prefix';terminalSourceId:'terminal-application';physicalPitchSourceId:'pitch-0'}>}>;
const same=(a:unknown,b:unknown,label:string)=>assert.equal(json(a),json(b),label);
const closed=(path:string)=>{for(const suffix of ['-wal','-shm','-journal'])assert(!existsSync(path+suffix),'continuation requires a closed artifact');};
const pin=(p:Pin)=>{assert(p&&json(Object.keys(p).sort())===json(['path','sha256'])&&isAbsolute(p.path)&&realpathSync(p.path)===p.path&&lstatSync(p.path).isFile()&&/^[a-f0-9]{64}$/.test(p.sha256),'continuation pin is invalid');assert.equal(fileHash(p.path),p.sha256,'continuation pin changed');};
const readPin=<T>(p:Pin):T=>{pin(p);return cloneInert(JSON.parse(readFileSync(p.path,'utf8'))) as T;};
/** Metadata admission is deliberately independent from Native owner proof. */
const actorCheckpoint=(p:Pin)=>{
 const m=readPin<{version:string;qualified:boolean;qualification:Record<'config'|'terminal'|'report'|'receipt',Pin>;artifact:Pin}>(p);
 assert(m.version==='terminal_next_actor_checkpoint_input_v1'&&m.qualified===true,'continuation actor checkpoint is not qualified');
 const c=readPin<any>(m.qualification.config),t=readPin<any>(m.qualification.terminal),r=readPin<any>(m.qualification.report),receipt=readPin<any>(m.qualification.receipt);
 assert(t.status==='passed'&&t.configSha256===m.qualification.config.sha256&&t.stage===c.stage&&t.originalChildExit===0,'continuation actor qualification differs');
 same(t.before,t.after,'continuation actor qualification inputs changed');same(t.failures,[],'continuation actor qualification failed');same(t.remainingOwnedProcesses,[],'continuation actor processes remain');
 assert(t.tests.passedCases===1&&t.tests.expectedFailedCases===0&&t.tests.reportSha256===m.qualification.report.sha256&&r.numPassedTests===1&&r.numFailedTests===0,'continuation actor case attribution differs');
 assert(receipt.version==='terminal_next_actor_checkpoint_v1'&&receipt.mode==='actor_checkpoint'&&receipt.actorSourceId===ids.originalActorSourceId
  &&receipt.acceptedActorPlayerId==='away-2'&&receipt.pitchSourceId===null&&receipt.exactlyOnceActor===true&&receipt.exactlyOncePitch===false&&receipt.reopened===true&&receipt.allHandlesClosed===true,'continuation actor receipt differs');
 same(m.artifact,{path:receipt.destinationPath,sha256:receipt.destinationSha256},'continuation actor artifact identity differs');return m.artifact;
};

/** New test-only construction over a closed existing game. Never invokes an
 * initial fixture, initializeMatch, calibration initializer, batted producer or
 * alternate original reader. Every actual write is an existing owner's call. */
export const runTerminalContinuationStage=(raw:TerminalContinuationRun,progress:(message:string)=>void=()=>{}):TerminalContinuationStageReceipt=>{
 const run=cloneInert(raw);
 same(Object.keys(run).sort(),['version','nativeReleased','stage','recipe','predecessorReceipt','destinationPath','receiptPath','sourceTree'].sort(),'continuation run fields differ');
 assert(run.version==='terminal_continuation_run_v1'&&run.nativeReleased===true&&terminalContinuationStages.includes(run.stage)
  &&/^[a-f0-9]{40}$/.test(run.sourceTree),'continuation Native stage has not been reviewed and released');
 const recipe=readPin<Recipe>(run.recipe);same(Object.keys(recipe).sort(),['version','actorCheckpoint','ids','game','straightTakeAuthority'].sort(),'continuation recipe fields differ');assert(recipe.version==='terminal_continuation_fixture_recipe_v1','continuation fixture recipe differs');
 same(recipe.ids,ids,'continuation explicit Source IDs differ');same(recipe.game,terminalContinuationGame,'continuation accepted policy differs');
 same(recipe.straightTakeAuthority,{kind:'original_terminal_physical_prefix',terminalSourceId:ids.terminalSourceId,physicalPitchSourceId:ids.recipePitchSourceId},'continuation TAKE authority differs');
 const first=actorCheckpoint(recipe.actorCheckpoint),prior=validateContinuationPredecessor(run.stage,run.predecessorReceipt?readPin(run.predecessorReceipt):null);
 if(prior){assert(prior.recipeHash===run.recipe.sha256&&prior.sourceTree===run.sourceTree,'continuation preceding recipe/source differs');}
 const input=prior?.output??first;closed(input.path);pin(input);
 assert(isAbsolute(run.destinationPath)&&isAbsolute(run.receiptPath)&&run.destinationPath!==input.path&&!existsSync(run.destinationPath)&&!existsSync(run.receiptPath),'continuation requires new private output paths');
 mkdirSync(dirname(run.destinationPath),{recursive:true});assert(realpathSync(dirname(run.destinationPath))===dirname(run.destinationPath),'continuation output directory aliases');
 copyFileSync(input.path,run.destinationPath,constants.COPYFILE_EXCL);assert.equal(fileHash(run.destinationPath),input.sha256);
 const resources:{close():void}[]=[],track=<T extends {close():void}>(r:T):T=>{resources.push(r);return r;};
 const closeAll=()=>{const errors:unknown[]=[];while(resources.length)try{resources.pop()!.close();}catch(e){errors.push(e);}if(errors.length)throw new AggregateError(errors,'continuation handle cleanup failed');};
 let primary:unknown,failed=false;
 const openBase=()=>{
  const db=track(new DatabaseSync(run.destinationPath)),before=rawCensus(db),schema=schemaCensus(db);
  let readDepth=0;
  const read=<T>(fn:()=>T):T=>readDepth?fn():withSqliteReadTransaction(db,()=>withBattedWorldPhysicalReadTraversal(db,()=>{readDepth++;try{return fn();}finally{readDepth--;}}));
  const original=read(()=>foulTerminalPostPlayCompletionEvidenceFromSqlite(db).read(ids.terminalSourceId));
  assert(original&&original.status==='POST_PLAY_COMPLETED_CONTINUING'&&original.result.completion.version==='actual_foul_terminal_post_play_completion_v1','continuation original terminal is not the retained v1 completion');
  const p=original.proposal,c=original.result.completion;
  const actor=read(()=>readPhysicalPlateAppearanceActorFromSqlite(db,ids.originalActorSourceId));assert(actor);
  same(actor.source,{sourceId:ids.originalActorSourceId,sourceVersion:'fixture-v1',gameId:'game-1',playerId:'away-2',activationApplicationId:p.source.applicationId},'continuation original accepted actor differs');
  assert(actor.match.playId===8&&actor.officialRevision===1&&actor.match.outs===1&&actor.match.inning===1&&actor.match.half==='top','continuation original actor frame differs');
  same(actor.world,c.nextWorld,'continuation original actor World differs');
  const originalPrefix=read(()=>readOriginalPhysicalPitchPrefixFromSqlite(db,p.physicalPitchSourceId)),straight=originalPrefix[0];
  assert(straight?.source.sourceId===ids.recipePitchSourceId&&straight.source.request.batter.action.kind==='take','continuation original straight TAKE missing');
  assert(p.originalPhysicalPitchPrefix[0].sourceHash===hash(straight.source),'continuation recipe Source hash differs');
  same(p.applicationBody.game&&{seasonId:p.applicationBody.game.seasonId,homeClubId:p.applicationBody.game.homeClubId,awayClubId:p.applicationBody.game.awayClubId,policy:p.applicationBody.game.policy},recipe.game,'continuation original nine-inning policy differs');
  return {db,before,schema,read,original,p,c,actor,straight};
 };
 const open=()=>{
  const base=openBase(),{db,before,schema,read,original,p,c,actor,straight}=base,binding=p.participants[0].binding;
  const links=track(openSqlitePlayerPersonLinkStore(run.destinationPath)),official=track(new SqliteOfficialStateStore(run.destinationPath));
  const participation=track(new SqliteOfficialParticipationStore(run.destinationPath,{readGame:gameId=>gameId===p.gameId?{careerId:binding.careerId,competitionEditionId:binding.competitionEditionId,gameDay:binding.gameDay,
   homeClubId:recipe.game.homeClubId,awayClubId:recipe.game.awayClubId,fixtureEventId:binding.fixtureEventId}:null,readRoster:()=>null,
   readPersonLink:(playerId,sourceId)=>{const link=links.readLink(sourceId);return link?.playerId===playerId?{sourceId,personId:link.personId}:null;}}));
  const initialWorlds=track(openSqliteOfficialInitialWorldStore(run.destinationPath,{matches:official,participation}));
  const workload=track(openSqlitePlayerWorkloadRecoveryStore(run.destinationPath,links)),timing=track(openSqlitePlayerPitchTimingStore(run.destinationPath,links)),
   release=track(openSqlitePlayerReleaseGeometryStore(run.destinationPath,links)),policies=track(openSqlitePitchFatiguePolicyStore(run.destinationPath));
  const actions=new Map<string,AcceptedPhysicalPitchActionSource>(),closures=new Map<string,AcceptedPhysicalPlayClosure>();
  const pitches=track(openSqlitePhysicalPitchProgressStore(run.destinationPath,{matches:official,initialWorlds,participation,runtime:{workload,timing,release,policies,
   effortPolicies:{readAcceptedPolicy:id=>id===straight.source.effortPolicy.sourceId?straight.source.effortPolicy:null}}},{readAcceptedAction:id=>actions.get(id)??null}));
  const closure=track(openSqlitePhysicalPlayClosureStore(run.destinationPath,{physicalPitches:pitches,initialWorlds,participation,personLinks:links},{readAcceptedClosure:id=>closures.get(id)??null}));
  same(rawCensus(db),before,'continuation opening existing owners wrote rows');same(schemaCensus(db),schema,'continuation opening existing owners changed storage');
  return {db,before,schema,read,original,p,c,actor,straight,links,official,participation,initialWorlds,workload,actions,closures,pitches,closure};
 };
 const ownedClosure=(x:ReturnType<typeof openBase>):DurablePhysicalPlayClosure|null=>{
  const owned=readPhysicalClosureProposal(x.db,ids.closureSourceId);if(!owned)return null;
  assertPhysicalClosureStages(x.db,owned.proposal);let result:DurablePhysicalPlayClosure['result']=null;
  if(owned.row.status==='COMPLETED'){const workload=readPhysicalClosureWorkload(x.db,owned.proposal);assert(workload,'continuation completed workload missing');
   result={sourceId:owned.source.sourceId,gameId:owned.proposal.application.matchId,playId:owned.proposal.application.match.playId,official:owned.proposal.expectedOfficial,scoring:owned.proposal.expectedScoring,workload};
   same(JSON.parse(owned.row.result_json!),result,'continuation completed closure mirror differs');}
  return {source:owned.source,proposal:owned.proposal,status:owned.row.status as 'PENDING'|'COMPLETED',result};
 };
 const inspect=(x:ReturnType<typeof openBase>,stage:TerminalContinuationStage)=>x.read(()=>{
  const {db,read,actor,c}=x;
  const result:Record<string,unknown>={terminal:{sourceId:ids.terminalSourceId,completionId:c.completionId,snapshotHash:c.snapshotHash,applicationId:x.p.source.applicationId,durableRevision:1},originalActor:{sourceId:actor.source.sourceId,snapshotHash:hash(actor)}};
  const history=read(()=>readPhysicalPitchProgressFromSqlite(db,'game-1',8));
  if(stage==='admission')assert.equal(history.length,0,'continuation actor checkpoint already has a new pitch');
  else{
   assert.equal(history.length,3,'continuation ordinary physical prefix length differs');same(history.map(v=>v.source.sourceId),ids.takeIds,'continuation physical Sources differ');
   assert(history[2].result.pitch.resolution.timeline.status.kind==='strikeout','continuation physical outcome is not K');
   const initial=history[0].frame.workload;for(let i=0;i<3;i++)same(history[i].source,materializeContinuationTake(x.straight.source,actor,initial,history.slice(0,i)),'continuation archived TAKE differs');
   result.physical={playId:8,sourceIds:ids.takeIds,sourceHashes:history.map(v=>hash(v.source)),snapshotHashes:history.map(hash),status:'strikeout'};
  }
  const completed=['closure_completed','next_actor'].includes(stage),queued=stage==='closure_queued';
  if(queued||completed){
   const saved=ownedClosure(x);assert(saved&&saved.status===(completed?'COMPLETED':'PENDING'),'continuation ordinary closure stage differs');
   same(saved.source,materializeContinuationClosure(history[2],c.source.worldSetup,recipe.game),'continuation ordinary closure Source differs');
   result.closure={sourceId:saved.source.sourceId,status:saved.status,sourceHash:hash(saved.source),proposalHash:hash(saved.proposal)};
   if(completed){const done=saved.result;assert(done);materializeContinuationNextActor(done);
    assert(done.scoring.record.classification==='strikeout'&&done.workload.activity.kind==='MATCH'&&done.workload.activity.effortUnits===6,'continuation exact K scoring/workload differs');
    assert(done.workload.before.revision===history[0].frame.workload.revision&&done.workload.after.revision===done.workload.before.revision+1,'continuation workload revision differs');
    same(read(()=>readActualRoleWorkloadState(db,'career-a','p2')),done.workload.after,'continuation current pitcher workload differs');
    same(new SqliteOfficialStateWriter(db).getMatch('game-1')?.matchState,done.official.receipt.appliedMatchState,'continuation durable Match differs');
    const earlier=read(()=>readPhysicalClosureScoringHistory(db,{gameId:'game-1',officialRevision:2}));assert.equal(earlier.length,2);
    same(earlier.map(v=>v.applicationId),[x.p.source.applicationId,ids.applicationId],'continuation two scored applications differ');
    result.official={applicationId:ids.applicationId,receiptHash:hash(done.official.receipt),durableRevision:2,playId:9,outs:2};
    result.scoring={scoringApplicationId:ids.scoringApplicationId,rowHash:hash(db.prepare('SELECT * FROM official_scoring_applications WHERE scoring_application_id=?').get(ids.scoringApplicationId))};
    result.workload={sourceEventId:done.workload.activity.sourceEventId,beforeRevision:done.workload.before.revision,afterRevision:done.workload.after.revision,activityHash:hash(done.workload.activity),afterHash:hash(done.workload.after)};
   }
  }else assert.equal(ownedClosure(x),null,'continuation closure appeared before its queued stage');
  if(stage==='next_actor'){
   const next=read(()=>readPhysicalPlateAppearanceActorFromSqlite(db,ids.nextActorSourceId));assert(next);const done=ownedClosure(x)!.result!;
   same(next.source,materializeContinuationNextActor(done),'continuation explicit next actor differs');assert(next.binding.side==='AWAY'&&next.match.playId===9&&next.match.outs===2,'continuation next actor frame differs');
   read(()=>assertPriorPhysicalClosureCompleted(db,ids.applicationId));
   assert.equal(read(()=>readPhysicalPitchProgressFromSqlite(db,'game-1',9)).length,0,'continuation exceeded the next-actor milestone');
   result.nextActor={sourceId:next.source.sourceId,playerId:next.source.playerId,snapshotHash:hash(next),activationApplicationId:ids.applicationId};
   result.priorCompletedSources=[ids.terminalSourceId,ids.closureSourceId];
  }else assert.equal(read(()=>readPhysicalPlateAppearanceActorFromSqlite(db,ids.nextActorSourceId)),null,'continuation next actor appeared early');
  return result;
 });
 try{
  const x=open(),previousStage=prior?.stage??'admission';progress('authenticating '+previousStage+' closed predecessor');
  const previousOwners=inspect(x,previousStage);if(prior)same(previousOwners,prior.ownerReceipts,'continuation preceding owner receipts differ');
  if(['admission','physical_k','closure_queued'].includes(run.stage))x.read(()=>foulTerminalNextPlayReadinessFromSqlite(x.db).read(ids.terminalSourceId));
  if(run.stage==='physical_k'){
   for(let i=0;i<3;i++){
    const prefix=x.read(()=>readPhysicalPitchProgressFromSqlite(x.db,'game-1',8)),workload=x.read(()=>readActualRoleWorkloadState(x.db,'career-a','p2'));assert(workload);
    const source=materializeContinuationTake(x.straight.source,x.actor,workload,prefix);x.actions.set(source.sourceId,source);
    progress('accepting explicit physical TAKE '+i);const pitch=x.pitches.accept(source.sourceId,i),rows=rawCensus(x.db);
    same(x.pitches.accept(source.sourceId,i),pitch,'continuation physical retry differs');same(rawCensus(x.db),rows,'continuation physical retry wrote rows');
   }
  }else if(run.stage==='closure_queued'){
   const head=x.read(()=>readPhysicalPitchProgressFromSqlite(x.db,'game-1',8)).at(-1);assert(head);
   const source=materializeContinuationClosure(head,x.c.source.worldSetup,recipe.game);x.closures.set(source.sourceId,source);progress('freezing ordinary physical closure proposal');
   const saved=x.closure.enqueue(source.sourceId),rows=rawCensus(x.db);assert(saved.status==='PENDING');same(x.closure.enqueue(source.sourceId),saved,'continuation queue retry differs');same(rawCensus(x.db),rows,'continuation queue retry wrote rows');
  }else if(run.stage==='closure_completed'){
   progress('resuming ordinary official scoring effort and workload owners');const result=x.closure.resume(ids.closureSourceId),rows=rawCensus(x.db);
   same(x.closure.resume(ids.closureSourceId),result,'continuation completion retry differs');same(rawCensus(x.db),rows,'continuation completion retry wrote rows');
  }else if(run.stage==='next_actor'){
   const completed=x.closure.read(ids.closureSourceId);assert(completed?.status==='COMPLETED'&&completed.result);
   const source=materializeContinuationNextActor(completed.result),actors=track(openSqlitePhysicalPlateAppearanceActorStore(run.destinationPath,{matches:x.official,initialWorlds:x.initialWorlds,participation:x.participation},
    {readAcceptedActor:id=>id===source.sourceId?source:null}));
   progress('accepting explicitly selected away-3 from the second completed play');const actor=actors.accept(source.sourceId),rows=rawCensus(x.db);same(actors.accept(source.sourceId),actor,'continuation actor retry differs');same(rawCensus(x.db),rows,'continuation actor retry wrote rows');
  }
  const owners=inspect(x,run.stage),after=rawCensus(x.db);assertContinuationRows(x.before,after,run.stage);same(schemaCensus(x.db),x.schema,'continuation stage changed storage');
  closeAll();closed(run.destinationPath);progress('all stage handles closed; reopening real owners');
  const reopened=openBase();same(inspect(reopened,run.stage),owners,'continuation reopened owner receipts differ');same(rawCensus(reopened.db),after,'continuation reopened readers wrote rows');same(schemaCensus(reopened.db),x.schema,'continuation reopened storage differs');
  closeAll();closed(run.destinationPath);closed(input.path);pin(input);pin(run.recipe);if(run.predecessorReceipt)pin(run.predecessorReceipt);
  const receipt:TerminalContinuationStageReceipt={...closureContinuationReceiptFields(prior),stage:run.stage,sourceTree:run.sourceTree,input,output:{path:run.destinationPath,sha256:fileHash(run.destinationPath)},recipeHash:run.recipe.sha256,
   predecessorReceiptHash:run.predecessorReceipt?.sha256??null,allHandlesClosed:true,reopened:true,originalRowsPreserved:true,ownerReceipts:owners,twoPriorCompletionLineage:run.stage==='next_actor'};
  mkdirSync(dirname(run.receiptPath),{recursive:true});writeFileSync(run.receiptPath,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});return receipt;
 }catch(error){failed=true;primary=error;throw error;}finally{
  try{closeAll();}catch(cleanup){throw new AggregateError(failed?[primary,cleanup]:[cleanup],'continuation failed to close owned handles',{cause:failed?primary:cleanup});}
 }
};
