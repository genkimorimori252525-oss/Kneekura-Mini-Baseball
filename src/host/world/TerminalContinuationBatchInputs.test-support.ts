import assert from 'node:assert/strict';
import {cloneInert} from '../../core/adjudication/OfficialWindowPolicy';
import type {PlayerWorkloadRecoveryState} from '../../core/world/development/PlayerWorkloadRecovery';
import {physicalPitchActionInput} from './PhysicalPitchEvidenceFromSqlite';
import type {AcceptedPhysicalPitchActionSource,DurablePhysicalPitch} from './SqlitePhysicalPitchProgressStore';
import type {DurablePhysicalPlateAppearanceActor} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import {actorJson as json,actorFreeze as freeze} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import {captureTerminalStraightTakeRecipe,terminalContinuationFixtureIds as priorIds} from './TerminalContinuationFixtureInputs.test-support';

/** Explicit fixture Sources for the first new-PA two-strike prefix. No batting
 * order, calibration, game policy or original world is generated here. */
export const terminalContinuationBuntPrefixIds=freeze(['terminal-continuation-bunt-take-0','terminal-continuation-bunt-take-1']as const);
const same=(a:unknown,b:unknown,message:string)=>assert.equal(json(a),json(b),message);
const tick=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
export const materializeContinuationBuntPrefixTake=(rawRecipe:AcceptedPhysicalPitchActionSource,rawActor:DurablePhysicalPlateAppearanceActor,
 rawWorkload:PlayerWorkloadRecoveryState,rawPrefix:readonly DurablePhysicalPitch[]):AcceptedPhysicalPitchActionSource=>{
 const recipe=captureTerminalStraightTakeRecipe(rawRecipe),actor=cloneInert(rawActor),workload=cloneInert(rawWorkload),prefix=cloneInert(rawPrefix);
 same(actor.source,{sourceId:priorIds.nextActorSourceId,sourceVersion:'fixture-v1',gameId:'game-1',playerId:'away-3',activationApplicationId:priorIds.applicationId},'batch requires the explicit accepted away-3 actor');
 assert(actor.officialRevision===2&&actor.match.playId===9&&actor.match.outs===2&&actor.match.inning===1&&actor.match.half==='top'&&actor.match.balls===0&&actor.match.strikes===0&&Object.values(actor.match.bases).every(v=>v===null),'batch actor is not the actual second-completion activation');
 assert(recipe.gameId===actor.source.gameId&&tick(actor.world.tick),'batch actor game or clock differs');same(actor.world.defenders.filter(d=>d.registeredPosition==='P').map(d=>d.playerId),['p2'],'batch accepted pitcher differs');
 assert(workload.careerId==='career-a'&&workload.playerId==='p2'&&workload.revision===2,'batch requires actual post-completion pitcher workload');assert(prefix.length<2,'batch already has both preceding TAKEs');
 for(const [i,p]of prefix.entries()){
  assert(p.source.sourceId===terminalContinuationBuntPrefixIds[i]&&p.progressRevision===i+1&&p.frame.initialWorld===null&&p.frame.activationApplicationId===priorIds.applicationId,'batch physical predecessor identity differs');
  same(p.frame.match,actor.match,'batch physical predecessor Match differs');same(p.frame.batterActor,actor,'batch physical predecessor actor differs');same(p.frame.workload,workload,'batch physical predecessor workload differs');
  const timeline=p.result.pitch.resolution.timeline;assert(timeline.playId===9&&timeline.status.kind==='active'&&timeline.status.count.balls===0&&timeline.status.count.strikes===i+1&&tick(timeline.lastEventTick)&&timeline.lastEventTick>=(i?prefix[i-1].result.pitch.resolution.timeline.lastEventTick:actor.world.tick),'batch requires actual chronological preceding strikes');
 }
 const {initialWorldSourceId:_initial,...base}=recipe,sourceId=terminalContinuationBuntPrefixIds[prefix.length];
 return freeze(physicalPitchActionInput({...base,sourceId,activationApplicationId:priorIds.applicationId,request:{...base.request,workloadRevision:workload.revision,delivery:{...base.request.delivery,readyAtUs:prefix.at(-1)?.result.pitch.resolution.timeline.lastEventTick??actor.world.tick}}},sourceId));
};
