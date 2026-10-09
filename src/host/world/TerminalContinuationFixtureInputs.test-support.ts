import assert from 'node:assert/strict';
import {isAbsolute} from 'node:path';
import {cloneInert} from '../../core/adjudication/OfficialWindowPolicy';
import {physicalPitchActionInput} from './PhysicalPitchEvidenceFromSqlite';
import type {AcceptedPhysicalPitchActionSource,DurablePhysicalPitch} from './SqlitePhysicalPitchProgressStore';
import type {DurablePhysicalPlateAppearanceActor,AcceptedPhysicalPlateAppearanceActor} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type {PlayerWorkloadRecoveryState} from '../../core/world/development/PlayerWorkloadRecovery';
import type {AcceptedPhysicalPlayClosure,PhysicalPlayClosureResult} from './SqlitePhysicalPlayClosureStore';
import {actorJson as json,actorFreeze as freeze} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

// Explicit fixture-only values copied from the already accepted original TAKE
// recipe. These are checks on fixture input, never new production defaults.
export const terminalContinuationFixtureIds=freeze({
 terminalSourceId:'terminal-application',originalActorSourceId:'fixture-next-terminal-batter',recipePitchSourceId:'pitch-0',
 takeIds:['terminal-continuation-k-take-0','terminal-continuation-k-take-1','terminal-continuation-k-take-2'] as const,
 closureSourceId:'terminal-continuation-k-close',applicationId:'terminal-continuation-k-application',
 scoringApplicationId:'terminal-continuation-k-score',snapshotId:'terminal-continuation-k-rule',
 nextActorSourceId:'terminal-continuation-bunt-actor',nextActorPlayerId:'away-3',
});
export const terminalContinuationGame=freeze({seasonId:'league-season-1',homeClubId:'club-a',awayClubId:'club-b',
 policy:{version:'fixture-v1',minimumInnings:9,maximumInnings:9,tiesAllowed:true}});
const same=(a:unknown,b:unknown,label:string)=>assert.equal(json(a),json(b),label);
const tick=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const digest=(v:unknown,size=64)=>typeof v==='string'&&new RegExp('^[a-f0-9]{'+size+'}$').test(v);
const fields=(v:unknown,keys:string[])=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&json(Object.keys(v).sort())===json(keys.sort());
export const materializeContinuationTake=(rawRecipe:AcceptedPhysicalPitchActionSource,rawActor:DurablePhysicalPlateAppearanceActor,
 rawWorkload:PlayerWorkloadRecoveryState,rawPrefix:readonly DurablePhysicalPitch[]):AcceptedPhysicalPitchActionSource=>{
 const recipe=cloneInert(rawRecipe),actor=cloneInert(rawActor),workload=cloneInert(rawWorkload),prefix=cloneInert(rawPrefix),ids=terminalContinuationFixtureIds;
 physicalPitchActionInput(recipe,ids.recipePitchSourceId);
 assert('initialWorldSourceId'in recipe&&recipe.initialWorldSourceId==='initial-world'&&!('battingIntent'in recipe)&&!('prePitchRunner'in recipe),'fixture original TAKE recipe origin differs');
 same(recipe.request,{workloadRevision:0,policySourceId:'response',delivery:{careerId:'career-a',playerId:'p2',gameDay:10,matchSeed:19,moundReference:{x:0,y:0,z:18},outingId:'outing-1',readyAtUs:0,
  timingIntent:{deliveryMode:'NORMAL',cadenceIntent:'STANDARD'},physics:{velocity:{x:0,y:0,z:-30},spin:{x:0,y:100,z:0}}},flight:{durationUs:1500000,acceleration:{x:0,y:0,z:0}},
  batter:{action:{kind:'take'},plateZ:0,strikeZone:{centerX:0,halfWidth:.2,lowerY:1.4,upperY:1.8},ballRadiusMeters:.0366}},'fixture straight TAKE recipe differs');
 same(recipe.effortPolicy,{sourceId:'effort',sourceVersion:'fixture-v1',policyId:'effort',version:'v1',availableAtDay:1,effortUnitsPerPhysicalPitch:2},'fixture effort policy differs');
 same(actor.source,{sourceId:ids.originalActorSourceId,sourceVersion:'fixture-v1',gameId:'game-1',playerId:'away-2',activationApplicationId:'terminal-match-application'},'fixture accepted actor differs');
 assert(recipe.gameId===actor.source.gameId&&recipe.sourceVersion==='fixture-v1'&&actor.officialRevision===1&&actor.match.playId===8&&actor.match.inning===1&&actor.match.half==='top'
  &&actor.match.outs===1&&actor.match.balls===0&&actor.match.strikes===0&&Object.values(actor.match.bases).every(x=>x===null),'fixture actor is not the accepted one-out activation');
 same(actor.world.defenders.filter(d=>d.registeredPosition==='P').map(d=>d.playerId),['p2'],'fixture P differs');
 assert(workload.careerId==='career-a'&&workload.playerId==='p2'&&tick(workload.revision)&&tick(actor.world.tick),'fixture current workload or clock differs');
 assert(prefix.length<3,'fixture already has all three pitches');
 for(const [i,p]of prefix.entries()){
  assert(p.source.sourceId===ids.takeIds[i]&&p.progressRevision===i+1&&p.frame.initialWorld===null&&p.frame.activationApplicationId==='terminal-match-application','fixture physical predecessor identity differs');
  same(p.frame.match,actor.match,'fixture physical predecessor Match differs');same(p.frame.batterActor,actor,'fixture physical predecessor actor differs');
  same(p.frame.workload,workload,'fixture physical predecessor workload differs');
  const timeline=p.result.pitch.resolution.timeline;
  assert(timeline.playId===actor.match.playId&&timeline.status.kind==='active'&&timeline.status.count.balls===0&&timeline.status.count.strikes===i+1
   &&tick(timeline.lastEventTick)&&timeline.lastEventTick>=(i?prefix[i-1].result.pitch.resolution.timeline.lastEventTick:actor.world.tick),'fixture actual preceding TAKE did not produce the required next strike');
 }
 const {initialWorldSourceId:_initial,...base}=recipe;
 return freeze(physicalPitchActionInput({...base,sourceId:ids.takeIds[prefix.length],activationApplicationId:'terminal-match-application',request:{...base.request,workloadRevision:workload.revision,
  delivery:{...base.request.delivery,readyAtUs:prefix.at(-1)?.result.pitch.resolution.timeline.lastEventTick??actor.world.tick}}},ids.takeIds[prefix.length]));
};
export const materializeContinuationClosure=(rawPitch:DurablePhysicalPitch,rawSetup:AcceptedPhysicalPlayClosure['worldSetup'],rawGame:AcceptedPhysicalPlayClosure['game']):AcceptedPhysicalPlayClosure=>{
 const pitch=cloneInert(rawPitch),setup=cloneInert(rawSetup),game=cloneInert(rawGame),ids=terminalContinuationFixtureIds,timeline=pitch.result.pitch.resolution.timeline;
 assert(pitch.source.sourceId===ids.takeIds[2]&&pitch.progressRevision===3&&pitch.frame.match.playId===8&&pitch.frame.match.outs===1
  &&pitch.frame.initialWorld===null&&pitch.frame.activationApplicationId==='terminal-match-application'&&timeline.status.kind==='strikeout','fixture requires actual ordinary physical strikeout');
 assert(Object.values(pitch.frame.match.bases).every(x=>x===null),'fixture original bases differ');same(game,terminalContinuationGame,'fixture nine-inning policy differs');
 assert(tick(timeline.lastEventTick)&&tick(timeline.lastEventTick+3),'fixture closure chronology is unsafe');
 return freeze({sourceId:ids.closureSourceId,sourceVersion:'fixture-v1',physicalPitchSourceId:pitch.source.sourceId,applicationId:ids.applicationId,
  scoringApplicationId:ids.scoringApplicationId,snapshotId:ids.snapshotId,ruleTick:timeline.lastEventTick+1,closureTick:timeline.lastEventTick+2,nextStartedAtTick:timeline.lastEventTick+3,
  batterRunnerId:null,worldSetup:setup,game});
};
export const materializeContinuationNextActor=(raw:PhysicalPlayClosureResult):AcceptedPhysicalPlateAppearanceActor=>{
 const completed=cloneInert(raw),ids=terminalContinuationFixtureIds,official=completed.official;
 assert(completed.sourceId===ids.closureSourceId&&completed.gameId==='game-1'&&completed.playId===8&&'activation'in official&&!('result'in official),'fixture ordinary completed predecessor differs');
 assert(official.receipt.applicationId===ids.applicationId&&official.receipt.previousPlayId===8&&official.receipt.durableRevision===2
  &&official.activation.applicationId===ids.applicationId&&official.activation.nextMatchState.playId===9&&official.activation.nextMatchState.outs===2
  &&official.activation.nextMatchState.inning===1&&official.activation.nextMatchState.half==='top','fixture second-out receipt differs');
 same(official.receipt.appliedMatchState,official.activation.nextMatchState,'fixture completed Match differs');
 return freeze({sourceId:ids.nextActorSourceId,sourceVersion:'fixture-v1',gameId:'game-1',playerId:ids.nextActorPlayerId,activationApplicationId:ids.applicationId});
};
export const terminalContinuationStages=['admission','physical_k','closure_queued','closure_completed','next_actor']as const;
export type TerminalContinuationStage=typeof terminalContinuationStages[number];
export type SplitPhysicalOrigin=Readonly<{kind:'qualified_single_pitch_chain';qualifiedInput:Readonly<{path:string;sha256:string}>;physicalReceipt:Readonly<{path:string;sha256:string}>;aggregateP1Credit:0}>;
export type TerminalContinuationStageReceipt=Readonly<{
 stage:TerminalContinuationStage;sourceTree:string;
 input:Readonly<{path:string;sha256:string}>;output:Readonly<{path:string;sha256:string}>;recipeHash:string;predecessorReceiptHash:string|null;
 allHandlesClosed:true;reopened:true;originalRowsPreserved:true;ownerReceipts:Readonly<Record<string,unknown>>;twoPriorCompletionLineage:boolean;
}> & (Readonly<{version:'terminal_continuation_stage_v1'}>|Readonly<{version:'terminal_continuation_stage_v2';splitPhysicalOrigin:SplitPhysicalOrigin}>);
export const closureContinuationReceiptFields=(prior:TerminalContinuationStageReceipt|null)=>prior?.version==='terminal_continuation_stage_v2'
 ? {version:'terminal_continuation_stage_v2' as const,splitPhysicalOrigin:prior.splitPhysicalOrigin}:{version:'terminal_continuation_stage_v1' as const};
export const validateContinuationPredecessor=(stage:TerminalContinuationStage,raw:unknown):TerminalContinuationStageReceipt|null=>{
 assert(terminalContinuationStages.includes(stage),'fixture stage differs');
 if(stage==='admission'){assert(raw===null,'fixture admission has no predecessor receipt');return null;}
 const r=cloneInert(raw)as TerminalContinuationStageReceipt,split=r?.version==='terminal_continuation_stage_v2';
 assert(fields(r,['version','stage','sourceTree','input','output','recipeHash','predecessorReceiptHash','allHandlesClosed','reopened','originalRowsPreserved','ownerReceipts','twoPriorCompletionLineage',...(split?['splitPhysicalOrigin']:[])])
  &&(r.version==='terminal_continuation_stage_v1'||split)&&r.stage===terminalContinuationStages[terminalContinuationStages.indexOf(stage)-1]
  &&digest(r.sourceTree,40)&&digest(r.recipeHash)&&r.allHandlesClosed===true&&r.reopened===true&&r.originalRowsPreserved===true
  &&r.twoPriorCompletionLineage===(r.stage==='next_actor')&&r.ownerReceipts&&typeof r.ownerReceipts==='object'&&!Array.isArray(r.ownerReceipts),'fixture closed predecessor receipt differs');
 if(r.version==='terminal_continuation_stage_v2'){const origin=r.splitPhysicalOrigin;assert(['closure_queued','closure_completed','next_actor'].includes(r.stage)&&fields(origin,['kind','qualifiedInput','physicalReceipt','aggregateP1Credit'])&&origin.kind==='qualified_single_pitch_chain'&&origin.aggregateP1Credit===0,'fixture split-pitch provenance differs');if(r.stage==='closure_queued')assert(r.predecessorReceiptHash===origin.physicalReceipt.sha256,'fixture split-pitch receipt link differs');for(const p of [origin.qualifiedInput,origin.physicalReceipt])assert(fields(p,['path','sha256'])&&isAbsolute(p.path)&&digest(p.sha256),'fixture split-pitch input pin differs');}
 assert(r.stage==='admission'?r.predecessorReceiptHash===null:digest(r.predecessorReceiptHash),'fixture predecessor receipt link missing');
 for(const p of [r.input,r.output])assert(fields(p,['path','sha256'])&&typeof p.path==='string'&&isAbsolute(p.path)&&digest(p.sha256),'fixture artifact pin differs');
 assert(r.input.path!==r.output.path,'fixture stages must have separate closed artifacts');return freeze(r);
};

type Census=readonly Readonly<{table:unknown;rows:readonly Record<string,unknown>[]}>[];
/** Preservation oracle only. Real owner readers still authenticate each allowed
 * new/changed row; this helper never grants a successful owner proof. */
export const assertContinuationRows=(before:Census,after:Census,stage:TerminalContinuationStage):void=>{
 const ids=terminalContinuationFixtureIds;
 const mutable=(table:unknown,row:Record<string,unknown>)=>stage==='closure_completed'&&(
  table==='matches'&&row.match_id==='game-1'||table==='world_player_workload_heads'&&row.career_id==='career-a'&&row.player_id==='p2'
  ||table==='physical_play_closures'&&row.source_id===ids.closureSourceId);
 const addition=(table:unknown,row:Record<string,unknown>)=>{
  if(stage==='physical_k')return table==='physical_pitch_progress_actions'&&ids.takeIds.includes(row.source_id as typeof ids.takeIds[number])&&row.game_id==='game-1'&&row.play_id===8
   ||table==='physical_pitch_progress_heads'&&row.game_id==='game-1'&&row.play_id===8;
  if(stage==='closure_queued')return table==='physical_play_closures'&&row.source_id===ids.closureSourceId&&row.game_id==='game-1'&&row.play_id===8
   ||table==='physical_closure_game_policies'&&row.game_id==='game-1';
  if(stage==='closure_completed')return table==='applications'&&row.application_id===ids.applicationId&&row.match_id==='game-1'
   ||table==='official_scoring_applications'&&row.scoring_application_id===ids.scoringApplicationId&&row.official_application_id===ids.applicationId
   ||table==='official_pitch_workload_policies'&&row.source_id==='effort'&&row.policy_id==='effort'
   ||table==='official_pitch_workload_sources'&&row.game_id==='game-1'&&row.played_play_id===8&&row.player_id==='p2'
   ||table==='world_player_workload_activities'&&row.career_id==='career-a'&&row.player_id==='p2'
    &&typeof row.source_json==='string'&&JSON.parse(row.source_json).evidenceId===ids.applicationId;
  return stage==='next_actor'&&table==='physical_plate_appearance_actors'&&row.source_id===ids.nextActorSourceId&&row.game_id==='game-1'&&row.play_id===9&&row.player_id===ids.nextActorPlayerId;
 };
 same(before.map(t=>t.table),after.map(t=>t.table),'fixture stage changed the owner inventory');
 for(const [i,old]of before.entries()){
  const next=after[i];
  for(const row of old.rows){const matches=next.rows.filter(r=>r.__ack_rowid===row.__ack_rowid);assert(matches.length===1,'fixture removed or duplicated an original row');
   if(!mutable(old.table,row))same(matches[0],row,'fixture changed an original row outside the stage');
   else for(const key of Object.keys(row).filter(k=>old.table==='matches'?!['durable_revision','state_json','activation_json'].includes(k):old.table==='physical_play_closures'?!['status','result_json'].includes(k):!['revision','state_json'].includes(k)))same(matches[0][key],row[key],'fixture changed an immutable owner key');}
  for(const row of next.rows)if(!old.rows.some(r=>r.__ack_rowid===row.__ack_rowid))assert(addition(old.table,row),'fixture inserted an unrelated row');
 }
};
