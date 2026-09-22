import { chooseDefensiveIntentCandidate, type DefensiveIntent } from '../../../sim/fielding/DefensiveDecision';
import { findNextDefensiveReplanTick } from '../../../sim/fielding/DefensiveReplan';
import { resolveDefenderFirstStepTiming } from '../../../sim/fielding/DefenderFirstStepTiming';
import { buildDefenderMotionTrajectory, sampleDefenderMotionSegment, type DefenderMotionState } from '../../../sim/fielding/DefenderMotion';
import { fail, fraction, integer, list, obj, text } from '../EmotionValidation';
import { cloneExecutionData } from '../execution/ExecutionValidation';
import type { ReplanSource, DefensivePhysicalPlan, FieldingStatus } from './FieldingTypes';
import { callCore, finite, member, nullableVec2, positive, positiveTick, vec2 } from './FieldingPrimitives';

const triggers=['batted_ball_recognized','teammate_commitment_recognized','catch_outcome_recognized',
 'ball_direction_change_recognized','throw_start_recognized','runner_motion_recognized','communication_received','coverage_need_changed'] as const;
function validateIntent(raw:unknown,p:string):void {
 if(raw===null || typeof raw!=='object' || Array.isArray(raw))fail('INVALID_INPUT',p);
 const v=raw as Record<string,unknown>;
 const kind=member(v.kind,['ball_handler','base_cover','relay','backup','deep_coverage','hold'],p+'.kind');
 obj(v,kind==='base_cover'?['kind','base']:['relay','backup','deep_coverage'].includes(kind)?['kind','target']:['kind'],p);
 if(kind==='base_cover')member(v.base,[1,2,3,4],p+'.base');
 else if(['relay','backup','deep_coverage'].includes(kind))vec2(v.target,p+'.target');
}
export function validateReplanSource(s:ReplanSource):void {
 const p='fielding.source',now=s.frame.time.tick;
 obj(s,['sourceId','revision','frame','observationTick','validUntilTick','kind','lastDecisionTick','triggers',
  'candidates','ballTarget','baseTargets','body','previousTarget','firstStepAbility','firstStep','motion','endTick'],p);
 if(s.lastDecisionTick!==null && integer(s.lastDecisionTick,p+'.lastDecisionTick')>now)fail('INVALID_INPUT',p+'.lastDecisionTick');
 list(s.triggers,(raw,path)=>{const v=obj(raw,['kind','perceivedAt'],path);member(v.kind,triggers,path+'.kind');
  if(integer(v.perceivedAt,path+'.perceivedAt')>s.observationTick)fail('INVALID_INPUT',path+'.perceivedAt');return raw;},p+'.triggers');
 const candidates=list(s.candidates,(raw,path)=>{
  const v=obj(raw,['intent','localPriority','evidenceAvailableAt','evidenceKinds'],path);
  validateIntent(v.intent,path+'.intent');finite(v.localPriority,path+'.localPriority',0);
  if(integer(v.evidenceAvailableAt,path+'.evidenceAvailableAt')>s.observationTick)fail('INVALID_INPUT',path+'.evidenceAvailableAt');
  const kinds=list(v.evidenceKinds,text,path+'.evidenceKinds');
  if(!kinds.length || new Set(kinds).size!==kinds.length)fail('INVALID_INPUT',path+'.evidenceKinds');return raw;
 },p+'.candidates');
 if(!candidates.length)fail('INVALID_INPUT',p+'.candidates');
 nullableVec2(s.ballTarget,p+'.ballTarget');nullableVec2(s.previousTarget,p+'.previousTarget');
 obj(s.baseTargets,['1','2','3','4'],p+'.baseTargets');
 for(const b of [1,2,3,4] as const)vec2(s.baseTargets[b],p+'.baseTargets.'+b);
 const body=obj(s.body,['tick','position','velocity'],p+'.body');
 if(integer(body.tick,p+'.body.tick')!==now)fail('INCONSISTENT_STATE',p+'.body.tick');
 vec2(body.position,p+'.body.position');const velocity=vec2(body.velocity,p+'.body.velocity');
 const motion=obj(s.motion,['ticksPerSecond','maxIntegrationStepTicks','accelerationMps2','brakingMps2','topSpeedMps','arrivalRadiusMeters'],p+'.motion');
 positiveTick(motion.ticksPerSecond,p+'.motion.ticksPerSecond');positiveTick(motion.maxIntegrationStepTicks,p+'.motion.maxIntegrationStepTicks');
 for(const k of ['accelerationMps2','brakingMps2','topSpeedMps'])positive(motion[k],p+'.motion.'+k);
 finite(motion.arrivalRadiusMeters,p+'.motion.arrivalRadiusMeters',0);
 if(Math.hypot(velocity.x,velocity.z)>s.motion.topSpeedMps+1e-9)fail('INVALID_INPUT',p+'.body.velocity');
 fraction(s.firstStepAbility,p+'.firstStepAbility');
 const step=obj(s.firstStep,['minimumFirstStepDelayTicks','maximumFirstStepDelayTicks','fixedMotorOffsetTicks'],p+'.firstStep');
 for(const k of Object.keys(step))integer(step[k],p+'.firstStep.'+k);
 if(s.firstStep.minimumFirstStepDelayTicks>s.firstStep.maximumFirstStepDelayTicks)fail('INVALID_INPUT',p+'.firstStep.range');
 const end=integer(s.endTick,p+'.endTick');if(end<now || end>s.validUntilTick)fail('INVALID_INPUT',p+'.endTick');
 // A resource budget for one proposal, not a physical/time calibration. Caller splits longer forecasts.
 if(Math.ceil((end-now)/s.motion.maxIntegrationStepTicks)+1>4096)fail('INVALID_INPUT',p+'.integrationBudget');
}
function targetFor(intent:DefensiveIntent,s:ReplanSource) {
 switch(intent.kind){
  case 'hold':return null;
  case 'ball_handler':if(s.ballTarget===null)fail('INVALID_INPUT','fielding.source.missingPerceivedBall');return s.ballTarget;
  case 'base_cover':return s.baseTargets[intent.base];
  case 'backup':case 'relay':case 'deep_coverage':return intent.target;
 }
}
export function planEmotionReplan(s:ReplanSource,commitmentTick:number):Readonly<{status:FieldingStatus;plan:DefensivePhysicalPlan|null}> {
 const triggerTick=findNextDefensiveReplanTick(s.lastDecisionTick,s.triggers);
 if(triggerTick===null)return {status:'NO_NEW_TRIGGER',plan:null};
 const selected=chooseDefensiveIntentCandidate(s.candidates),target=targetFor(selected.intent,s);
 const timing=callCore('fielding.firstStep',()=>resolveDefenderFirstStepTiming(commitmentTick,s.firstStepAbility,s.firstStep));
 if(timing.movementStartTick>s.validUntilTick)return {status:'MISSED_WINDOW',plan:null};
 const split=Math.min(s.endTick,timing.movementStartTick);
 const before=callCore('fielding.previousMotion',()=>buildDefenderMotionTrajectory(s.body,s.previousTarget,split-commitmentTick,s.motion));
 const next:DefenderMotionState=before.length?sampleDefenderMotionSegment(before[before.length-1],split):s.body;
 const after=callCore('fielding.nextMotion',()=>buildDefenderMotionTrajectory(next,target,s.endTick-split,s.motion));
 const segments=[...before,...after];
 const endState=segments.length?sampleDefenderMotionSegment(segments[segments.length-1],s.endTick):s.body;
 const plan:DefensivePhysicalPlan={kind:'REPLAN',triggerTick,commitmentTick,movementStartTick:timing.movementStartTick,selected,target,segments,endState};
 cloneExecutionData(plan,'fielding.defensivePlan');
 return {status:'READY',plan};
}
