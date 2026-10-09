import type { EmotionState } from '../EmotionTypes';
import { compareTime, fail, fraction, integer, list, obj, same, text } from '../EmotionValidation';
import { restoreEmotionState } from '../EmotionState';
import { acceptEmotionExecution } from '../execution/ExecutionAcceptance';
import { cloneExecutionData, readFrame } from '../execution/ExecutionValidation';
import type { EmotionExecutionAcceptance, ExecutionFrame } from '../execution/ExecutionTypes';
import type { BattingExecutionRequest, BattingSource } from './BattingTypes';
import type { AerodynamicPitchTrajectory } from '../../../sim/pitching/AerodynamicPitchTrajectory';
import { sampleAerodynamicPitchTrajectory } from '../../../sim/pitching/AerodynamicPitchTrajectory';
import { calculateBaseballAerodynamics } from '../../../sim/ball/BaseballAerodynamics';
import { sampleBatRadius, sampleBatEffectiveMass } from '../../../sim/contact/RigidBatBallContact';
import { EVIDENCE_BOUNDED_SWING_COURSE_PROFILE_V1, resolvePreferredContactDepthV1 } from '../../../sim/pitching/CourseAwareSwingKinematicsV1';
import { normalizeQuaternion } from '../../../sim/pitching/BaseballOrientation';
import { selectPredictionAt } from './BattingTiming';

/** Translate existing physical-owner validation errors into this boundary's structured rejection. */
export function coreCall<T>(path:string,run:()=>T):T {
 try { return run(); } catch(error) {
  if(!(error instanceof Error))throw error;
  fail('INVALID_INPUT',path+'.physicalContract');
 }
}
export function numberValue(v:unknown,path:string,positive=false):number {
 if(typeof v!=='number' || !Number.isFinite(v) || (positive && v<=0))fail('INVALID_INPUT',path);return v;
}
export function shape(v:unknown,required:readonly string[],optional:readonly string[],path:string):Record<string,unknown> {
 if(v===null || typeof v!=='object')fail('INVALID_INPUT',path);
 return obj(v,[...required,...optional.filter(k=>Object.hasOwn(v,k))],path);
}
function vector(v:unknown,path:string):void {
 const x=obj(v,['x','y','z'],path);for(const k of ['x','y','z'])numberValue(x[k],path+'.'+k);
}
export function readFlight(v:unknown,ticksPerSecond:number,path:string):AerodynamicPitchTrajectory {
 const x=shape(v,['start','endTick','parameters'],['releaseOrientation'],path);
 const start=obj(x.start,['tick','position','velocity','spin'],path+'.start');
 const first=integer(start.tick,path+'.start.tick'),end=integer(x.endTick,path+'.endTick');
 for(const k of ['position','velocity','spin'])vector(start[k],path+'.start.'+k);
 const p=obj(x.parameters,['ticksPerSecond','integrationStepTicks','gravityY','aerodynamics'],path+'.parameters');
 const rate=integer(p.ticksPerSecond,path+'.rate'),step=integer(p.integrationStepTicks,path+'.step');
 if(rate!==ticksPerSecond || rate<=0 || step<=0 || end<first || (end-first)/step>100000)
  fail('INVALID_INPUT',path+'.clockOrBudget');
 numberValue(p.gravityY,path+'.gravityY');
 const aero=shape(p.aerodynamics,['ballMassKg','ballRadiusM','airDensityKgM3','windVelocityMps','dragCoefficient'],
  ['coefficientProfile','airKinematicViscosityM2PerSecond','spinDecay'],path+'.aerodynamics');
 vector(aero.windVelocityMps,path+'.wind');
 if(x.releaseOrientation!==undefined){const q=obj(x.releaseOrientation,['x','y','z','w'],path+'.orientation');for(const k of ['x','y','z','w'])numberValue(q[k],path+'.orientation.'+k);}
 const result=x as unknown as AerodynamicPitchTrajectory;
 if(result.releaseOrientation)coreCall(path+'.orientation',()=>normalizeQuaternion(result.releaseOrientation!));
 coreCall(path,()=>calculateBaseballAerodynamics(result.start.velocity,result.start.spin,result.parameters.aerodynamics));
 const sample=coreCall(path,()=>sampleAerodynamicPitchTrajectory(result,Math.min(end,first+step)));
 cloneExecutionData(sample,path+'.sample');return result;
}
export function checkedEmotion(v:unknown):EmotionState {
 const restored=restoreEmotionState(v);if(!restored.ok)fail(restored.reason.code,restored.reason.path);return restored.value;
}
export function checkedExecution(v:unknown):EmotionExecutionAcceptance {
 const receipt=obj(v,['kind','executionId','expectedFrame','afterWorldRevision','beforeEmotionRevision','afterEmotionRevision','proposal'],'batting.acceptedExecution');
 const prior=obj(receipt.proposal,['boundary','algorithmVersion','request','appraisal','inputs','runner'],'batting.prior');
 const checked=acceptEmotionExecution(prior.request,prior);if(!checked.ok)fail(checked.reason.code,checked.reason.path);
 if(!same(checked.value,receipt))fail('REPLAY_MISMATCH','batting.acceptedExecution');return checked.value;
}
export function bindCurrentFrame(current:ExecutionFrame,old:ExecutionFrame,minimumRevision:number):void {
 if(!same(current.scope,old.scope))fail('SCOPE_MISMATCH','batting.currentFrame.scope');
 if(current.contextId!==old.contextId || current.snapshotId===old.snapshotId)fail('INCONSISTENT_STATE','batting.currentFrame.context');
 if(current.worldRevision<minimumRevision || compareTime(current.time,old.time)<0)fail('STALE_REVISION','batting.currentFrame');
}
function readSource(raw:unknown,frame:ExecutionFrame):BattingSource {
 const p='batting.source',v=obj(raw,['sourceId','revision','frame','validUntilTick','ballId','playId','pitchOrdinal','ticksPerSecond','count','timelineNextSequence',
  'bodyReadyTick','motorLatencyTicks','latestMotorStartTick','technicalTimingOffsetTicks','handedness','centerOfMass','batPhysical','ball',
  'plateZ','strikeZone','maximumSweetSpotSpeedMps','repertoireId','repertoireVersion','profiles','directive','decisionModel','predictions'],p);
 for(const k of ['sourceId','ballId','repertoireId','repertoireVersion'])text(v[k],p+'.'+k);
 for(const k of ['revision','validUntilTick','playId','pitchOrdinal','ticksPerSecond','bodyReadyTick','motorLatencyTicks','latestMotorStartTick'])integer(v[k],p+'.'+k);
 integer(v.technicalTimingOffsetTicks,p+'.technicalTimingOffsetTicks',true);
 const s=v as unknown as BattingSource;
 integer(s.timelineNextSequence,p+'.timelineNextSequence');
 const count=obj(s.count,['balls','strikes'],p+'.count');integer(count.balls,p+'.balls');integer(count.strikes,p+'.strikes');
 if(s.count.balls>3 || s.count.strikes>2)fail('INVALID_INPUT',p+'.count');
 if(!same(readFrame(s.frame,p+'.frame'),frame) || s.validUntilTick<frame.time.tick || s.ticksPerSecond<=0)fail('INCONSISTENT_STATE',p+'.frameOrValidity');
 if(s.handedness!=='R' && s.handedness!=='L')fail('INVALID_INPUT',p+'.handedness');
 if(!['AUTO','TAKE','SWING'].includes(s.directive))fail('INVALID_INPUT',p+'.directive');
 vector(s.centerOfMass,p+'.centerOfMass');numberValue(s.plateZ,p+'.plateZ');numberValue(s.maximumSweetSpotSpeedMps,p+'.speedCeiling',true);
 const zone=obj(s.strikeZone,['centerX','halfWidth','lowerY','upperY'],p+'.zone');
 for(const k of Object.keys(zone))numberValue(zone[k],p+'.zone.'+k);
 if(s.strikeZone.halfWidth<=0 || s.strikeZone.upperY<=s.strikeZone.lowerY)fail('INVALID_INPUT',p+'.zone');
 const ball=obj(s.ball,['massKg','radiusM','rotationalInertiaFactor'],p+'.ball');for(const k of Object.keys(ball))numberValue(ball[k],p+'.ball.'+k,true);
 const bat=shape(s.batPhysical,['massKg','centerOfMassT','transverseMomentOfInertiaKgM2','axialMomentOfInertiaKgM2','radiusProfile'],['normalEffectiveMassProfile'],p+'.bat');
 for(const k of ['massKg','transverseMomentOfInertiaKgM2','axialMomentOfInertiaKgM2'])numberValue(bat[k],p+'.bat.'+k,true);
 fraction(bat.centerOfMassT,p+'.bat.centerOfMassT');coreCall(p+'.radius',()=>sampleBatRadius(s.batPhysical.radiusProfile,0.5));
 if(s.batPhysical.normalEffectiveMassProfile)coreCall(p+'.massProfile',()=>sampleBatEffectiveMass(s.batPhysical.normalEffectiveMassProfile!,0.5));
 readBattingDecisionValues(s.decisionModel,p);
 readBattingRepertoireValues({repertoireId:s.repertoireId,repertoireVersion:s.repertoireVersion,profiles:s.profiles},p);
 const predictions=list(s.predictions,(row,q)=>{
  const r=obj(row,['predictionId','observedTick','availableTick','validUntilTick','trajectory','swingScore'],q);
  text(r.predictionId,q+'.id');for(const k of ['observedTick','availableTick','validUntilTick'])integer(r[k],q+'.'+k);fraction(r.swingScore,q+'.swingScore');
  const trajectory=readFlight(r.trajectory,s.ticksPerSecond,q+'.trajectory');
  if((r.validUntilTick as number)<(r.availableTick as number) || trajectory.start.tick>(r.observedTick as number))fail('INVALID_INPUT',q+'.chronology');
  if(trajectory.parameters.aerodynamics.ballMassKg!==s.ball.massKg || trajectory.parameters.aerodynamics.ballRadiusM!==s.ball.radiusM)fail('INVALID_INPUT',q+'.ballIdentity');
  return row as BattingSource['predictions'][number];
 },p+'.predictions');
 if(predictions.length>64)fail('INVALID_INPUT',p+'.predictionBudget');selectPredictionAt(predictions,frame.time.tick);
 return s;
}
export function readBattingRequest(input:unknown):BattingExecutionRequest {
 const copy=cloneExecutionData(input,'batting'),v=obj(copy,['currentFrame','currentEmotion','acceptedExecution','source'],'batting');
 const currentFrame=readFrame(v.currentFrame,'batting.currentFrame'),currentEmotion=checkedEmotion(v.currentEmotion),acceptedExecution=checkedExecution(v.acceptedExecution);
 bindCurrentFrame(currentFrame,acceptedExecution.expectedFrame,acceptedExecution.afterWorldRevision);
 if(!same(currentEmotion,acceptedExecution.proposal.appraisal.state))fail('STALE_REVISION','batting.currentEmotion');
 return {currentFrame,currentEmotion,acceptedExecution,source:readSource(v.source,currentFrame)};
}

/** Shared value validation; these values are calculations, never authenticated model Sources. */
export function readBattingDecisionValues(raw:unknown,p:string):BattingSource['decisionModel'] {
 const model=obj(raw,['modelId','version','threshold','aggressionWeight'],p+'.decisionModel');
 text(model.modelId,p+'.modelId');text(model.version,p+'.modelVersion');fraction(model.threshold,p+'.threshold');fraction(model.aggressionWeight,p+'.aggressionWeight');
 return model as BattingSource['decisionModel'];
}
export function readBattingRepertoireValues(raw:unknown,p:string):Pick<BattingSource,'repertoireId'|'repertoireVersion'|'profiles'> {
 const v=obj(raw,['repertoireId','repertoireVersion','profiles'],p);
 text(v.repertoireId,p+'.repertoireId');text(v.repertoireVersion,p+'.repertoireVersion');
 const profiles=list(v.profiles,(row,q)=>{
  const r=obj(row,['minimumAggression','profile'],q);fraction(r.minimumAggression,q+'.minimumAggression');
  const profile=obj(r.profile,Object.keys(EVIDENCE_BOUNDED_SWING_COURSE_PROFILE_V1),q+'.profile');
  text(profile.profileId,q+'.profileId');text(profile.version,q+'.version');
  coreCall(q,()=>resolvePreferredContactDepthV1({heightNormalized:0,insideOutsideNormalized:0},r.profile as BattingSource['profiles'][number]['profile']));return row as BattingSource['profiles'][number];
 },p+'.profiles');
 if(!profiles.length || profiles.length>32 || profiles[0].minimumAggression!==0)fail('INVALID_INPUT',p+'.profiles');
 const ids=new Set<string>();
 for(let i=0;i<profiles.length;i++){
  const r=profiles[i];if(ids.has(r.profile.profileId) || (i>0 && r.minimumAggression<=profiles[i-1].minimumAggression)
   || r.profile.batLengthM!==profiles[0].profile.batLengthM || r.profile.sweetSpotT!==profiles[0].profile.sweetSpotT)
   fail('INVALID_INPUT',p+'.repertoire');ids.add(r.profile.profileId);
 }
 return v as Pick<BattingSource,'repertoireId'|'repertoireVersion'|'profiles'>;
}
