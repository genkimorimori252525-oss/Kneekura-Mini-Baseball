import type { Vec3 } from '../../../model/geometry';
import { attempt, fail, integer, obj, text } from '../EmotionValidation';
import { cloneExecutionData } from '../execution/ExecutionValidation';
import { coreCall, numberValue } from './BattingValidation';
import { finalizeBattingMotorPlanV1, readObservedBattingMotorInputV1, type BattingMotorPlanInputV1 } from './BattingMotorPlanV1';
import { findAerodynamicPitchPlateCrossing } from '../../../sim/pitching/AerodynamicPitchTrajectory';
import { planCourseAwareSwingKinematicsV1, resolvePreferredContactDepthV1, resolveSwingCourseCoordinatesV1 } from '../../../sim/pitching/CourseAwareSwingKinematicsV1';

export type ObservedSpinAimTrialInputV226 = Readonly<{version:'observed_spin_aim_trial_v226';base:BattingMotorPlanInputV1;
 selectedProfile:Readonly<{profileId:string;version:string}>;pair:Readonly<{anchor:Vec3;target:Vec3}>;transform:'PLATE_XY_TRANSLATION_V1';
 trace:Readonly<{sourceId:string;observationIds:readonly string[];cutoffTick:number;coordinateSystem:'NATIVE_RBOX_METERS_V1'}>}>;

/** Explicit uncalibrated trial. Evidence IDs are caller-declared metadata;
 * this pure seam is neither Native authority nor a skill qualification. */
export function calculateObservedSpinAimTrialV226(raw:unknown) {
 return attempt(()=>{
  const path='batting.observedSpinAimV226',v=obj(cloneExecutionData(raw,path),['version','base','selectedProfile','pair','transform','trace'],path);
  if(v.version!=='observed_spin_aim_trial_v226'||v.transform!=='PLATE_XY_TRANSLATION_V1')fail('INVALID_INPUT',path+'.versionOrTransform');
  const base=readObservedBattingMotorInputV1(v.base);
  if(base.geometry.handedness!=='R')fail('INVALID_INPUT',path+'.rightHandedCoordinateDomain');
  const profileRef=obj(v.selectedProfile,['profileId','version'],path+'.selectedProfile'),
   profileId=text(profileRef.profileId,path+'.profileId'),version=text(profileRef.version,path+'.profileVersion');
  const selected=base.repertoire.profiles.find(p=>p.profile.profileId===profileId&&p.profile.version===version&&p.minimumAggression<=base.aggression);
  if(!selected)fail('INVALID_INPUT',path+'.profileUnavailable');
  if(base.repertoire.sampledProfiles?.some(p=>p.profileId===profileId))fail('INVALID_INPUT',path+'.measuredProfileUnsupported');
  const pair=obj(v.pair,['anchor','target'],path+'.pair'),vector=(value:unknown,label:string):Vec3=>{
   const data=obj(value,['x','y','z'],path+'.'+label);return {x:numberValue(data.x,path+'.'+label+'.x'),y:numberValue(data.y,path+'.'+label+'.y'),z:numberValue(data.z,path+'.'+label+'.z')};};
  const anchor=vector(pair.anchor,'anchor'),target=vector(pair.target,'target');if(anchor.z!==target.z)fail('INVALID_INPUT',path+'.deltaZ');
  const dx=numberValue(target.x-anchor.x,path+'.deltaX'),dy=numberValue(target.y-anchor.y,path+'.deltaY');
  const meta=obj(v.trace,['sourceId','observationIds','cutoffTick','coordinateSystem'],path+'.trace'),sourceId=text(meta.sourceId,path+'.trace.sourceId');
  if(meta.coordinateSystem!=='NATIVE_RBOX_METERS_V1'||!Array.isArray(meta.observationIds)||meta.observationIds.length<1||meta.observationIds.length>3
    ||meta.observationIds.some(id=>typeof id!=='string'||!id.length||id!==id.trim())||new Set(meta.observationIds).size!==meta.observationIds.length)fail('INVALID_INPUT',path+'.trace.observations');
  const cutoff=integer(meta.cutoffTick,path+'.trace.cutoffTick');
  if(cutoff<base.forecast.availableTick||cutoff>base.decisionTick)fail('INVALID_INPUT',path+'.trace.cutoff');
  const neutralPlate=coreCall(path+'.plate',()=>findAerodynamicPitchPlateCrossing(base.forecast.trajectory,base.geometry.plateZ));
  if(!neutralPlate||neutralPlate.tick<=base.decisionTick)fail('INVALID_INPUT',path+'.plateCrossingUnavailableOrPast');
  const translate=(position:Vec3):Vec3=>({x:dx===0?position.x:numberValue(position.x+dx,path+'.aimX'),
   y:dy===0?position.y:numberValue(position.y+dy,path+'.aimY'),z:position.z});
  const aimedPlate=translate(neutralPlate.position),course=coreCall(path+'.course',()=>resolveSwingCourseCoordinatesV1(aimedPlate,base.geometry.strikeZone,base.geometry.handedness)),
   depth=coreCall(path+'.depth',()=>resolvePreferredContactDepthV1(course,selected.profile)),contactZ=numberValue(base.geometry.centerOfMass.z+depth,path+'.contactZ'),
   neutralContact=coreCall(path+'.contact',()=>findAerodynamicPitchPlateCrossing(base.forecast.trajectory,contactZ));
  if(!neutralContact||neutralContact.tick<=base.decisionTick)fail('INVALID_INPUT',path+'.contactCrossingUnavailableOrPast');
  const aimedContact=translate(neutralContact.position),swing=coreCall(path+'.swing',()=>planCourseAwareSwingKinematicsV1({handedness:base.geometry.handedness,
   batterCenterOfMass:base.geometry.centerOfMass,targetBallCenterAtPlate:aimedPlate,targetBallCenterAtContact:aimedContact,
   strikeZone:base.geometry.strikeZone,contactTick:neutralContact.tick,ticksPerSecond:base.forecast.trajectory.parameters.ticksPerSecond,profile:selected.profile}));
  if(swing.preferredContactDepthM!==depth)fail('INVALID_INPUT',path+'.contactDepthMismatch');
  const plan=finalizeBattingMotorPlanV1(base,selected.profile,swing.trajectory);
  return {plan,trace:{authority:'UNCALIBRATED_EXPLICIT_TRIAL' as const,futureTransferProven:false as const,sourceId,
   observationIds:[...meta.observationIds] as string[],observationIdentity:'CALLER_DECLARED_NOT_AUTHENTICATED' as const,cutoffTick:cutoff,
   coordinateSystem:'NATIVE_RBOX_METERS_V1' as const,transform:'PLATE_XY_TRANSLATION_V1' as const,
   domain:'COURSE_AWARE_ONLY' as const,anchor,target,delta:{x:dx,y:dy,z:0},neutralPlate:neutralPlate.position,aimedPlate,
   plateTick:neutralPlate.tick,neutralContact:neutralContact.position,aimedContact,contactTick:neutralContact.tick,contactDepthM:depth}};
 });
}
