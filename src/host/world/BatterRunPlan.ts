import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { buildBatterSwingExitRecoveryTrajectory } from '../../core/sim/running/BatterSwingExitRecoveryTrajectory';
import { buildBatterRunnerWorldTimeline } from '../../core/sim/running/BatterRunnerWorldTimeline';
import { getRunnerRouteLength,sampleRunnerRoute,type RunnerRoute } from '../../core/sim/running/RunnerRoute';
import type { RunnerMotionIntent } from '../../core/sim/running/RunnerMotion';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields,samePaText as id,samePaReferenceValid as ref,type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { DurableBatterSwingExitState } from './SqliteBatterSwingExitStateStore';
export type BatterRunIntent=Readonly<{playerId:string;personId:string;route:RunnerRoute;intent:RunnerMotionIntent;endTick:number}>;
export type AcceptedBatterRunPlan=BatterRunIntent&Readonly<{
  sourceId:string;sourceVersion:string;capability:'same_pa_batter_run_plan_v1';
  viewReference:SamePaReference<'pa_lifecycle_v1_execution_views'>;
  physicalPitchReference:SamePaReference<'pa_physical_v1_launches'>;
  exitStateReference:SamePaReference<'world_batter_swing_exit_states'>;
  completedRecoveryReference?:SamePaReference<'pa_physical_v1_field_steps'>;
  provenance:Readonly<{sourceRecordId:string;sourceVersion:string}>;
}>;
const tick=(n:number)=>Number.isSafeInteger(n)&&n>=0;
const vector=(v:unknown)=>fields(v,['x','z'])&&Object.values(v).every(Number.isFinite);
const intentInput=(s:BatterRunIntent,kind:'advance'|'hold'='advance')=>{
  if(!id(s.playerId)||!id(s.personId)||!fields(s.intent,['kind','issuedTick'])||s.intent.kind!==kind||!tick(s.intent.issuedTick)||!tick(s.endTick)
    ||s.endTick<=s.intent.issuedTick||!fields(s.route,['segments'])||!Array.isArray(s.route.segments)||s.route.segments.length!==1
    ||s.route.segments.some(r=>r.kind!=='line'||!fields(r,['kind','start','end'])||!vector(r.start)||!vector(r.end)))throw new Error('invalid original straight batter-run intent');
  getRunnerRouteLength(s.route);
};
export const batterRunPlanInput=(raw:unknown,sourceId?:string):AcceptedBatterRunPlan=>{
  const s=cloneInert(raw) as AcceptedBatterRunPlan;
  if(!fields(s,['sourceId','sourceVersion','capability','viewReference','physicalPitchReference','exitStateReference','playerId','personId','route','intent','endTick','provenance',...(Object.hasOwn(s,'completedRecoveryReference')?['completedRecoveryReference']:[])])
    ||!id(s.sourceId)||!id(s.sourceVersion)||sourceId!==undefined&&s.sourceId!==sourceId||s.capability!=='same_pa_batter_run_plan_v1'
    ||!ref(s.viewReference,'pa_lifecycle_v1_execution_views')||!ref(s.physicalPitchReference,'pa_physical_v1_launches')||!ref(s.exitStateReference,'world_batter_swing_exit_states')
    ||Object.hasOwn(s,'completedRecoveryReference')&&!ref(s.completedRecoveryReference,'pa_physical_v1_field_steps')
    ||!fields(s.provenance,['sourceRecordId','sourceVersion'])||!Object.values(s.provenance).every(id))throw new Error('invalid accepted batter-run plan Source');
  intentInput(s);return freeze(s);
};
type Exit=Pick<DurableBatterSwingExitState,'playerId'|'personId'|'state'|'root'|'firstBaseCenter'|'model'>;
/** Composition of accepted intention, existing kinematics and existing kernels.
 * A trajectory is a plan. Its samples are never evidence that a body executed. */
const prepareBatterPlan=(exit:Exit,raw:BatterRunIntent|null,kind:'advance'|'hold')=>{
  if(raw===null)return freeze({kind:'pending' as const,reason:'accepted_batter_run_intent_missing' as const,motionExecuted:false as const});
  const intent=cloneInert(raw);intentInput(intent,kind);
  const start=sampleRunnerRoute(intent.route,0).position,length=getRunnerRouteLength(intent.route);
  const firstDistance=Math.hypot(exit.firstBaseCenter.x-start.x,exit.firstBaseCenter.z-start.z),first=sampleRunnerRoute(intent.route,firstDistance).position;
  const close=(a:number,b:number)=>Math.abs(a-b)<=Number.EPSILON*Math.max(1,Math.abs(a),Math.abs(b))*32;
  if(intent.playerId!==exit.playerId||intent.personId!==exit.personId||start.x!==exit.root.position.x||start.z!==exit.root.position.z
    ||firstDistance<=0||firstDistance>=length||!close(first.x,exit.firstBaseCenter.x)||!close(first.z,exit.firstBaseCenter.z))
    throw new Error('batter-run original identity, route origin or first-base crossing differs');
  const recovery=buildBatterSwingExitRecoveryTrajectory(exit.state,intent.route,exit.model.source.parameters);
  const timeline=buildBatterRunnerWorldTimeline({playerId:exit.playerId,route:intent.route,recovery,postLaunchIntent:intent.intent,
    runnerMotionParameters:exit.model.runnerModel.source.motion,endTick:intent.endTick});
  for(const segment of timeline.postLaunchTrajectory.segments){
    const duration=segment.endElapsedSeconds-segment.startElapsedSeconds,end=segment.startRouteDistanceMeters+segment.startSpeedMps*duration+0.5*segment.accelerationMps2*duration*duration;
    if(segment.bodyMode!=='upright'||segment.startRouteDistanceMeters<0||end>length)throw new Error('batter-run finite upright route coverage exhausted');
  }
  return freeze({kind:'prepared' as const,timeline,motionExecuted:false as const,physicalBinding:recovery.transition.recoverySeconds===0
    ?'owned_static_pose_straight_motion' as const:'swing_recovery_pose_binding_required' as const});
};
export const prepareBatterRunPlan=(exit:Exit,raw:BatterRunIntent|null)=>prepareBatterPlan(exit,raw,'advance');
/** A separate accepted caught-response owner may request hold. This does not
 * broaden or replace the original one-plan-per-pitch advance Source. */
export const prepareBatterCatchHoldPlan=(exit:Exit,raw:BatterRunIntent)=>prepareBatterPlan(exit,raw,'hold');
