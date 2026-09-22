import type { EmotionResult } from '../EmotionTypes';
import { attempt, fail, integer, list, obj, same, text } from '../EmotionValidation';
import { cloneExecutionData, readFrame, safeTickSum } from '../execution/ExecutionValidation';
import { resolveAndRecordAerodynamicRigidPitchAgainstBatter } from '../../../sim/pitching/AerodynamicRigidPitchAgainstBatter';
import { createRigidBatSwingWindowFromKinematicsV1 } from '../../../sim/pitching/AerodynamicRigidBatSwingingPitchPhysicalResult';
import { NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1 } from '../../../sim/contact/WoodBatProductionProfileV1';
import { resolveWoodBatSpeedResponse } from '../../../sim/contact/WoodBatSpeedResponseProfile';
import type { CanonicalPlateAppearanceTimeline } from '../../../sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import type { BattingPhysicalRequest, BattingPhysicalResolution, BattingSource } from './BattingTypes';
import { checkedBattingAcceptance } from './BattingAcceptance';
import { bindCurrentFrame, checkedEmotion, coreCall, readFlight } from './BattingValidation';

/** Validate the current cursor. Authenticity of historical payloads belongs to the canonical-state owner. */
function readTimeline(input:unknown,s:BattingSource,flightStart:number):CanonicalPlateAppearanceTimeline {
 const p='batting.physical.timeline',v=obj(input,['playId','startedAtTick','lastEventTick','nextSequence','status','events'],p);
 for(const k of ['playId','startedAtTick','lastEventTick','nextSequence'])integer(v[k],p+'.'+k);
 const status=obj(v.status,['kind','count'],p+'.status'),count=obj(status.count,['balls','strikes'],p+'.count');
 if(v.playId!==s.playId || status.kind!=='active' || !same(count,s.count) || v.nextSequence!==s.timelineNextSequence)
  fail('STALE_REVISION',p+'.cursorOrCount');
 let tick=v.startedAtTick as number;
 const events=list(v.events,(item,q)=>{
  const event=obj(item,['tick','sequence','kind','payload'],q);integer(event.tick,q+'.tick');integer(event.sequence,q+'.sequence');text(event.kind,q+'.kind');
  if((event.tick as number)<tick)fail('INCONSISTENT_STATE',q+'.chronology');tick=event.tick as number;return event;
 },p+'.events');
 if(events.length!==v.nextSequence || events.some((e,i)=>e.sequence!==i) || tick!==v.lastEventTick
  || (v.lastEventTick as number)>flightStart)fail('STALE_REVISION',p+'.historyCursor');
 safeTickSum(v.nextSequence as number,2,p+'.nextSequence');
 return v as unknown as CanonicalPlateAppearanceTimeline;
}
// Existing physical owners may emit optional object fields with undefined values.
// Normalize ONLY freshly computed trusted output, never relax external-input validation.
function omitAbsentCoreFields<T>(value:T):T {
 if(Array.isArray(value))return value.map(omitAbsentCoreFields) as T;
 if(value===null || typeof value!=='object')return value;
 return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,omitAbsentCoreFields(v)])) as T;
}
/** Resolve the frozen commitment against actual flight, not a new perception or another emotion appraisal.
 * A forecast may contain future contact/count events. The scheduler must revalidate and commit them at
 * their physical ticks; returning this proposal is not permission to advance the entire world now. */
export function resolveBattingExecution(input:unknown):EmotionResult<BattingPhysicalResolution> {
 return attempt(()=>{
  const copy=cloneExecutionData(input,'batting.physical'),v=obj(copy,['currentFrame','currentEmotion','accepted','sourceId','revision',
   'ballId','playId','pitchOrdinal','actualTrajectory','timeline'],'batting.physical');
  const accepted=checkedBattingAcceptance(v.accepted),s=accepted.proposal.request.source,commitment=accepted.proposal.commitment!;
  const currentFrame=readFrame(v.currentFrame,'batting.physical.frame'),currentEmotion=checkedEmotion(v.currentEmotion);
  bindCurrentFrame(currentFrame,accepted.expectedFrame,accepted.afterWorldRevision);
  if(!same(currentEmotion,accepted.proposal.request.currentEmotion))fail('STALE_REVISION','batting.physical.currentEmotion');
  const motorTick=commitment.motorStartTick??commitment.decisionTick;
  if(currentFrame.time.tick!==motorTick)fail('INCONSISTENT_STATE','batting.physical.motorCommitmentTick');
  if(s.validUntilTick<motorTick)fail('STALE_REVISION','batting.physical.bodySourceValidity');
  text(v.sourceId,'batting.physical.sourceId');integer(v.revision,'batting.physical.revision');
  if(v.ballId!==s.ballId || v.playId!==s.playId || v.pitchOrdinal!==s.pitchOrdinal)fail('SCOPE_MISMATCH','batting.physical.pitchIdentity');
  const actualTrajectory=readFlight(v.actualTrajectory,s.ticksPerSecond,'batting.physical.actualTrajectory');
  if(actualTrajectory.parameters.aerodynamics.ballMassKg!==s.ball.massKg || actualTrajectory.parameters.aerodynamics.ballRadiusM!==s.ball.radiusM)
   fail('INVALID_INPUT','batting.physical.ballIdentity');
  if(actualTrajectory.start.tick>commitment.decisionTick || actualTrajectory.endTick<motorTick)
   fail('INVALID_INPUT','batting.physical.interval');
  const timeline=readTimeline(v.timeline,s,actualTrajectory.start.tick);
  const request:BattingPhysicalRequest={currentFrame,currentEmotion,accepted,sourceId:v.sourceId as string,revision:v.revision as number,
   ballId:s.ballId,playId:s.playId,pitchOrdinal:s.pitchOrdinal,actualTrajectory,timeline};
  const computed=coreCall('batting.physical.resolution',()=>commitment.action==='TAKE'
   ?resolveAndRecordAerodynamicRigidPitchAgainstBatter(timeline,{action:{kind:'take'},trajectory:actualTrajectory,
     plateZ:s.plateZ,strikeZone:s.strikeZone,ballRadiusMeters:s.ball.radiusM})
   :resolveAndRecordAerodynamicRigidPitchAgainstBatter(timeline,{action:{kind:'swing',swing:createRigidBatSwingWindowFromKinematicsV1(commitment.trajectory!,s.batPhysical)},
     trajectory:actualTrajectory,ball:s.ball,parameterResolver:kinematics=>resolveWoodBatSpeedResponse(NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1,kinematics.normalApproachSpeedMps)}));
  const resolution=omitAbsentCoreFields(computed);
  if(resolution.kind!=='unresolved' && resolution.timeline.lastEventTick<motorTick)fail('INCONSISTENT_STATE','batting.physical.backdatedResult');
  cloneExecutionData(resolution,'batting.physical.result');
  return {kind:'BattingPhysicalForecast',request,actionKey:accepted.actionKey,expectedFrame:currentFrame,emotionRevision:currentEmotion.revision,
   contactResponse:'nathan-2012-47-impact-fit-v1',commitment,resolution};
 });
}
