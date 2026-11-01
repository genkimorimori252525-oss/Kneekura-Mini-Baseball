import {cloneInert} from '../../adjudication/OfficialWindowPolicy';
import type {Vec3} from '../../model/geometry';
import {createReferenceBatKinematicsV1,type ReferenceBatKinematicsInputV1} from '../../sim/contact/ReferenceBatKinematicsV1';
import {referenceWorldTickAtSourceV121} from '../../sim/contact/ReferenceBatMotorV121';
import {enumerateObservedReactiveYawV255,planObservedReactiveRegistrationV161,type ObservedReactiveRegistrationInputV161} from '../../sim/contact/ObservedDirectionRegistrationV153';
import {observeBattedBallSpinV123} from '../../sim/contact/BattedBallSpinObservationV123';
import {evaluateObservedContactFrameZeroV255} from './ObservedContactFrameRegistrationV243';
import type {SpinAimTechniqueV243} from './PredictedContactFrameAimV243';
type Input=Readonly<{version:'observed_yaw_contact_frame_trial_v255';registration:ObservedReactiveRegistrationInputV161;baselineReference:ReferenceBatKinematicsInputV1;cutoffTick:number;bats:'R'|'L';technique:SpinAimTechniqueV243;thresholds:Readonly<{minimumComponent:number;minimumImprovement:number}>;directionMode:'REACTIVE'|'MANUAL'|'V251'}>;
const scope='NOMINAL_SOURCE_TICK_AND_PREDICTED_CONTACT_WORLD_TICK_ONLY' as const,maximum=.02;
const fields=(v:unknown,k:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
const same=(a:unknown,b:unknown):boolean=>Object.is(a,b)||!!a&&!!b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&same((a as Record<string,unknown>)[k],(b as Record<string,unknown>)[k]));
const distance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v)}return v};
/** These two samples do not certify the interval between them. */
export function measureYawCenterBoundsV255(baseline:ReferenceBatKinematicsInputV1,candidate:ReferenceBatKinematicsInputV1,sourceTick:number,contactWorldTick:number) {
 try{const a=createReferenceBatKinematicsV1(baseline),b=createReferenceBatKinematicsV1(candidate),aStart=a.motionStartTickV133??baseline.startTick,bStart=b.motionStartTickV133??candidate.startTick,aEnd=a.motionThroughTickV133??referenceWorldTickAtSourceV121(baseline,baseline.frames.at(-1)!.tick),bEnd=b.motionThroughTickV133??referenceWorldTickAtSourceV121(candidate,candidate.frames.at(-1)!.tick);
  if(!Number.isFinite(sourceTick)||!Number.isFinite(contactWorldTick)||sourceTick<baseline.frames[0].tick||sourceTick>baseline.frames.at(-1)!.tick||sourceTick<candidate.frames[0].tick||sourceTick>candidate.frames.at(-1)!.tick||contactWorldTick<aStart||contactWorldTick>bEnd||contactWorldTick<bStart||contactWorldTick>aEnd)return {status:'UNRESOLVED' as const,reason:'TICK_OUTSIDE_MOTION',proofScope:scope};
  const nominalDistanceM=distance(a.sampleAtSourceTick(sourceTick).sweetSpot,b.sampleAtSourceTick(sourceTick).sweetSpot),predictedContactDistanceM=distance(a.sampleContinuous(contactWorldTick).sweetSpot,b.sampleContinuous(contactWorldTick).sweetSpot);
  if(!Number.isFinite(nominalDistanceM)||!Number.isFinite(predictedContactDistanceM))return {status:'UNRESOLVED' as const,reason:'NONFINITE_DISTANCE',proofScope:scope};
  return {status:nominalDistanceM<=maximum&&predictedContactDistanceM<=maximum?'WITHIN' as const:'OUTSIDE' as const,nominalDistanceM,predictedContactDistanceM,proofScope:scope};
 }catch(error){return {status:'UNRESOLVED' as const,reason:'MOTION_EVALUATION_FAILED:'+String(error instanceof Error?error.message:error),proofScope:scope}}
}
const component=(r:Extract<ReturnType<typeof evaluateObservedContactFrameZeroV255>,{status:'FOUND'}>,technique:SpinAimTechniqueV243,bats:'R'|'L')=>{
 const o=observeBattedBallSpinV123({velocityMps:r.response.exitVelocity,spinRadPerSecond:r.response.exitSpin,bats});if(o.basisStatus!=='DEFINED')return null;if(technique==='BACKSPIN')return o.backspinSignedRadPerSecond;if(technique==='TOPSPIN')return -o.backspinSignedRadPerSecond;const slice=o.rightCurvingSpinRadPerSecond*(bats==='R'?1:-1);return technique==='SLICE'?slice:-slice;
};
/** Experimental finite yaw set only; no execution, human calibration or whole-window bound. */
export function planObservedYawContactFrameV255(raw:Input){
 const assumptions={additionalTangentDelta:'ZERO' as const,actualFutureUsed:false as const,humanCalibration:'NOT_MEASURED' as const,earnedQualification:false as const,globalOptimumGuaranteed:false as const,proofScope:scope};
 const empty=(status:'HOLD'|'UNRESOLVED',reason:string)=>freeze({version:'observed_yaw_contact_frame_result_v255' as const,status,reason,reference:null,selectedYawDegrees:null,candidates:[],assumptions});
 let input:Input;try{input=cloneInert(raw)}catch{return empty('UNRESOLVED','INVALID_DECLARATION')}
 if(!fields(input,['version','registration','baselineReference','cutoffTick','bats','technique','thresholds','directionMode'])||input.version!=='observed_yaw_contact_frame_trial_v255'||!['REACTIVE','MANUAL','V251'].includes(input.directionMode)||!['R','L'].includes(input.bats)||!['BACKSPIN','TOPSPIN','HOOK','SLICE'].includes(input.technique)||!fields(input.thresholds,['minimumComponent','minimumImprovement'])||![input.thresholds.minimumComponent,input.thresholds.minimumImprovement].every(v=>Number.isFinite(v)&&v>=0))return empty('UNRESOLVED','INVALID_DECLARATION');
 if(input.directionMode==='MANUAL')return empty('HOLD','MANUAL_DIRECTION_NOT_DESIGNED');
 if(input.directionMode==='V251')return empty('HOLD','V251_BASELINE_NOT_SUPPORTED');
 let registrations:ReturnType<typeof enumerateObservedReactiveYawV255>;try{registrations=enumerateObservedReactiveYawV255(input.registration)}catch(error){return empty('UNRESOLVED','INVALID_REGISTRATION:'+String(error instanceof Error?error.message:error))}
 if(!registrations.some(x=>x.reference&&same(x.reference,input.baselineReference)))return empty('UNRESOLVED','BASELINE_NOT_IN_ORIGINAL_YAW_SET');
 let selectedV161:ReturnType<typeof planObservedReactiveRegistrationV161>;try{selectedV161=planObservedReactiveRegistrationV161(input.registration)}catch(error){return empty('UNRESOLVED','V161_BASELINE_UNAVAILABLE:'+String(error instanceof Error?error.message:error))}
 if(!selectedV161.reference)return empty('UNRESOLVED','V161_BASELINE_UNAVAILABLE');
 if(!same(selectedV161.reference,input.baselineReference))return empty('UNRESOLVED','BASELINE_DIFFERS_FROM_V161');
 const make=(reference:ReferenceBatKinematicsInputV1)=>({registration:{...input.registration,reference},cutoffTick:input.cutoffTick,bats:input.bats,technique:input.technique,thresholds:input.thresholds});
 const baseline=evaluateObservedContactFrameZeroV255(make(input.baselineReference));if(baseline.status!=='FOUND')return empty('UNRESOLVED','BASELINE_'+baseline.reason);const normalComponent=component(baseline,input.technique,input.bats);if(normalComponent===null)return empty('UNRESOLVED','BASELINE_FLIGHT_UNDEFINED');
 const nominalTick=referenceWorldTickAtSourceV121(input.baselineReference,input.registration.contactSourceTick);
 const candidates=registrations.map(entry=>{const yawDegrees=entry.candidate.yawDegrees,reference=entry.reference;
  if(!reference)return {yawDegrees,reference:null,status:entry.candidate.status==='UNRESOLVED'?'UNRESOLVED' as const:'REJECTED' as const,reason:entry.candidate.reason,bounds:null,prediction:null,component:null,improvement:null};
  const nominal=measureYawCenterBoundsV255(input.baselineReference,reference,input.registration.contactSourceTick,nominalTick);if(nominal.status!=='WITHIN')return {yawDegrees,reference,status:nominal.status==='OUTSIDE'?'REJECTED' as const:'UNRESOLVED' as const,reason:nominal.status==='OUTSIDE'?'NOMINAL_CENTER_OUTSIDE_2CM':nominal.reason,bounds:nominal,prediction:null,component:null,improvement:null};
  const prediction=evaluateObservedContactFrameZeroV255(make(reference));if(prediction.status!=='FOUND')return {yawDegrees,reference,status:prediction.status,reason:prediction.reason,bounds:nominal,prediction,component:null,improvement:null};
  const bounds=measureYawCenterBoundsV255(input.baselineReference,reference,input.registration.contactSourceTick,prediction.atTick);if(bounds.status!=='WITHIN')return {yawDegrees,reference,status:bounds.status==='OUTSIDE'?'REJECTED' as const:'UNRESOLVED' as const,reason:bounds.status==='OUTSIDE'?'CONTACT_CENTER_OUTSIDE_2CM':bounds.reason,bounds,prediction,component:null,improvement:null};
  const value=component(prediction,input.technique,input.bats);if(value===null)return {yawDegrees,reference,status:'UNRESOLVED' as const,reason:'FLIGHT_FRAME_UNDEFINED',bounds,prediction,component:null,improvement:null};
  const improvement=value-normalComponent;if(!Number.isFinite(improvement))return {yawDegrees,reference,status:'UNRESOLVED' as const,reason:'NONFINITE_IMPROVEMENT',bounds,prediction,component:null,improvement:null};
  return {yawDegrees,reference,status:'EVALUATED' as const,reason:value<input.thresholds.minimumComponent?'BELOW_MINIMUM_COMPONENT':improvement<input.thresholds.minimumImprovement?'BELOW_MINIMUM_IMPROVEMENT':'ELIGIBLE',bounds,prediction,component:value,improvement};
 });
 const selected=candidates.filter(c=>c.reason==='ELIGIBLE'&&c.component!==null).sort((a,b)=>b.component!-a.component!||Math.abs(a.yawDegrees)-Math.abs(b.yawDegrees)||a.yawDegrees-b.yawDegrees)[0];
 if(selected)return freeze({version:'observed_yaw_contact_frame_result_v255' as const,status:'PLANNED' as const,reason:'EXPLICIT_UNCALIBRATED_PREDICTION',reference:selected.reference,selectedYawDegrees:selected.yawDegrees,normalComponent,candidates,assumptions});
 const unresolved=candidates.some(c=>c.status==='UNRESOLVED');return freeze({version:'observed_yaw_contact_frame_result_v255' as const,status:unresolved?'UNRESOLVED' as const:'NO_TARGET' as const,reason:unresolved?'CANDIDATE_UNRESOLVED':'NO_CANDIDATE_MEETS_DECLARED_THRESHOLDS',reference:null,selectedYawDegrees:null,normalComponent,candidates,assumptions});
}
