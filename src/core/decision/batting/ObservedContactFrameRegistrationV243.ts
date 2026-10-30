import {cloneInert} from '../../adjudication/OfficialWindowPolicy';
import type {Vec3} from '../../model/geometry';
import {createReferenceBatKinematicsV1,type ReferenceBatKinematicsInputV1} from '../../sim/contact/ReferenceBatKinematicsV1';
import {referenceWorldTickAtSourceV121} from '../../sim/contact/ReferenceBatMotorV121';
import {firstPredictedContact,predictedBall,certificates,type ObservedReactiveRegistrationInputV161} from '../../sim/contact/ObservedDirectionRegistrationV153';
import {createRigidBatStateFromBatterSwingState,measureRigidBatBallGeometry} from '../../sim/contact/RigidBatBallContact';
import {resolveWoodBatSpeedProfileBallContact} from '../../sim/contact/WoodBatSpeedResponseProfile';
import {NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1} from '../../sim/contact/WoodBatProductionProfileV1';
import {observeBattedBallSpinV123} from '../../sim/contact/BattedBallSpinObservationV123';
import {createPredictedContactFrameCandidatesV243,selectPredictedContactFrameCandidateV243,type SpinAimTechniqueV243} from './PredictedContactFrameAimV243';
const keys=['maximumSweetSpotSpeedMps','maximumGripAccelerationMps2','maximumAngularAccelerationRadPerSecond2','maximumSweetSpotAccelerationMps2'] as const;
const fields=(v:unknown,required:readonly string[],optional:readonly string[]=[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
const vec=(v:unknown):v is Vec3=>fields(v,['x','y','z'])&&Object.values(v as Vec3).every(Number.isFinite);
const add=(a:Vec3,b:Vec3):Vec3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
/** Rebuild the same nominal registration with a translated measured-arc target; held world poses remain Source data. */
export function composePredictedContactFrameReferenceV243(reference:ReferenceBatKinematicsInputV1,delta:Vec3):ReferenceBatKinematicsInputV1 {
 if(!vec(delta))throw Error('invalid motion translation');if(delta.x===0&&delta.y===0&&delta.z===0)return reference;
 return {...reference,transform:{...reference.transform,translation:add(reference.transform.translation,delta)}};
}
type Input=Readonly<{registration:ObservedReactiveRegistrationInputV161;cutoffTick:number;bats:'R'|'L';technique:SpinAimTechniqueV243;thresholds:Readonly<{minimumComponent:number;minimumImprovement:number}>}>;
type Evaluation=Readonly<{status:'FOUND';atTick:number;normal:Vec3;response:NonNullable<ReturnType<typeof resolveWoodBatSpeedProfileBallContact>>;searchEvaluations:number}>|Readonly<{status:'UNRESOLVED'|'REJECTED';reason:string}>;
/** Stateless caller-declared prediction only; real future/contact/spin cannot be supplied. */
export function planObservedContactFrameRegistrationV243(raw:Input){
 const assumptions={incidentSpin:'ZERO_OPERATIONAL_ASSUMPTION' as const,actualFutureUsed:false as const,calibrated:false as const,earnedQualification:false as const,fallback:'RETAIN_NORMAL_UNMODIFIED' as const,application:'TRANSLATE_MEASURED_TARGET_REGENERATE_HELD_ENVELOPE' as const};
 const empty=(reason:string)=>({status:'NO_TARGET' as const,reason,reference:null,baseline:null,candidates:[],assumptions});
 if(!fields(raw,['registration','cutoffTick','bats','technique','thresholds']))return empty('INVALID_INPUT_FIELDS');
 let input:Input;try{input=cloneInert(raw)}catch{return empty('INVALID_DECLARATION')}const r=input.registration,p=r?.prediction;
 if(!fields(r,['reference','contactSourceTick','prediction','batPhysical','ballPhysical'],['limits'])||!fields(p,['anchorTick','availableTick','position','velocity','acceleration'])||![p.position,p.velocity,p.acceleration].every(vec)||!Number.isSafeInteger(p.availableTick)||p.availableTick<0||!Number.isSafeInteger(input.cutoffTick)||input.cutoffTick<0||!Number.isFinite(p.anchorTick)||p.anchorTick<0||p.anchorTick>Number.MAX_SAFE_INTEGER||!Number.isFinite(r.contactSourceTick)||!['R','L'].includes(input.bats)||!['BACKSPIN','TOPSPIN','HOOK','SLICE'].includes(input.technique)||!fields(input.thresholds,['minimumComponent','minimumImprovement'])||![input.thresholds.minimumComponent,input.thresholds.minimumImprovement].every(x=>Number.isFinite(x)&&x>=0))return empty('INVALID_DECLARATION');
 if(p.availableTick>input.cutoffTick)return empty('PREDICTION_NOT_DELIVERED');
 if(!r.reference||!Array.isArray(r.reference.frames))return empty('INVALID_REFERENCE');
 if(r.reference.aimCorrectionV121!==undefined)return empty('NORMAL_ALREADY_HAS_AIM_CORRECTION');
 if(!r.reference.frames.length||r.contactSourceTick<r.reference.frames[0].tick||r.contactSourceTick>r.reference.frames[r.reference.frames.length-1].tick)return empty('CONTACT_SOURCE_TICK_OUTSIDE_CLIP');
 if(r.limits&&(!fields(r.limits,[],keys)||!Object.values(r.limits).every(x=>Number.isFinite(x)&&x>0)))return empty('INVALID_LIMITS');
 let normalMotion:ReturnType<typeof createReferenceBatKinematicsV1>;try{normalMotion=createReferenceBatKinematicsV1(r.reference)}catch(error){return empty('NORMAL_PREDICTION_EVALUATION_FAILED:'+String(error instanceof Error?error.message:error))}
 const clipThrough=referenceWorldTickAtSourceV121(r.reference,r.reference.frames[r.reference.frames.length-1].tick),fixedThrough=normalMotion.motionThroughTickV133??clipThrough,fixedFrom=normalMotion.motionStartTickV133??r.reference.startTick,radius=Math.max(...r.batPhysical.radiusProfile.knots.map(k=>k.radiusM));
 function evaluate(reference:ReferenceBatKinematicsInputV1,delta:Vec3):Evaluation {
  try{const composed=composePredictedContactFrameReferenceV243(reference,delta),motion=delta.x===0&&delta.y===0&&delta.z===0?normalMotion:createReferenceBatKinematicsV1(composed),from=motion.motionStartTickV133??reference.startTick,through=fixedThrough,certificate=certificates(motion);
  if(from!==fixedFrom||(motion.motionThroughTickV133??clipThrough)!==fixedThrough)return {status:'UNRESOLVED',reason:'MOTION_CLOCK_CHANGED'};
  if(input.cutoffTick>from)return {status:'UNRESOLVED',reason:'PLANNING_AFTER_MOTION_START'};
  if(p.availableTick>from||through<from)return {status:'UNRESOLVED',reason:'PREDICTION_AFTER_MOTION_OR_CONTACT_BEFORE_START'};
  if(p.availableTick<from&&reference.executionEnvelopeV133===undefined)return {status:'UNRESOLVED',reason:'MISSING_AUTHORED_HELD_PREFIX'};
  for(const key of keys){const limit=r.limits?.[key],actual=certificate[key];if(limit!==undefined&&(actual===null||actual>limit))return actual===null?{status:'UNRESOLVED',reason:'MISSING_CERTIFICATE:'+key}:{status:'REJECTED',reason:'EXPLICIT_LIMIT:'+key};}
  const contact=firstPredictedContact(r,motion,p.availableTick,through,radius);if(contact.status!=='FOUND')return {status:'UNRESOLVED',reason:contact.reason};
  const ball=predictedBall(r,contact.atTick),bat=createRigidBatStateFromBatterSwingState(motion.sampleContinuous(contact.atTick).state,r.batPhysical),geometry=measureRigidBatBallGeometry(ball,bat,r.ballPhysical),response=resolveWoodBatSpeedProfileBallContact(ball,bat,r.ballPhysical,NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1);
  if(!geometry.normal)return {status:'UNRESOLVED',reason:'DEGENERATE_CONTACT_NORMAL'};if(!response)return {status:'REJECTED',reason:'NO_CLOSING_RESPONSE'};
  return {status:'FOUND',atTick:contact.atTick,normal:geometry.normal,response,searchEvaluations:contact.evaluations};
  }catch(error){return {status:'UNRESOLVED',reason:'PREDICTION_EVALUATION_FAILED:'+String(error instanceof Error?error.message:error)}}
 }
 const baseline=evaluate(r.reference,{x:0,y:0,z:0});if(baseline.status!=='FOUND')return empty('NORMAL_'+baseline.reason);
 const frame=createPredictedContactFrameCandidatesV243({normal:baseline.normal,normalExitVelocity:baseline.response.exitVelocity,bats:input.bats,technique:input.technique});if(frame.status!=='READY')return {...empty(frame.reason),baseline};
 function component(result:Extract<Evaluation,{status:'FOUND'}>):number|null {
  const o=observeBattedBallSpinV123({velocityMps:result.response.exitVelocity,spinRadPerSecond:result.response.exitSpin,bats:input.bats});if(o.basisStatus!=='DEFINED')return null;
  if(input.technique==='BACKSPIN')return o.backspinSignedRadPerSecond;if(input.technique==='TOPSPIN')return -o.backspinSignedRadPerSecond;
  const slice=o.rightCurvingSpinRadPerSecond*(input.bats==='R'?1:-1);return input.technique==='SLICE'?slice:-slice;
 }
 const normalComponent=component(baseline);if(normalComponent===null)return {...empty('NORMAL_FLIGHT_FRAME_UNDEFINED'),baseline};
 const candidates=frame.candidates.map(c=>{const reference=r.reference;
  const prediction=c.ordinal===0?baseline:evaluate(reference,c.delta),value=prediction.status==='FOUND'?component(prediction):null,exclusionReason=prediction.status!=='FOUND'?prediction.reason:value===null?'UNDEFINED_FLIGHT_FRAME':value<input.thresholds.minimumComponent?'BELOW_MINIMUM_COMPONENT':value-normalComponent<input.thresholds.minimumImprovement?'BELOW_MINIMUM_IMPROVEMENT':null;return {...c,prediction,component:value,improvement:value===null?null:value-normalComponent,exclusionReason,reference};});
 const diagnostics={selection:'CERTIFIED_ELIGIBLE_CANDIDATES_ONLY' as const,globalOptimumGuaranteed:false as const,unresolvedCount:candidates.filter(c=>c.prediction.status==='UNRESOLVED'||c.prediction.status==='FOUND'&&c.component===null).length,rejectedCount:candidates.filter(c=>c.prediction.status==='REJECTED').length,excludedCount:candidates.filter(c=>c.exclusionReason!==null).length};
 const selectable=candidates.filter((c):c is typeof c&{component:number}=>c.component!==null),selected=selectPredictedContactFrameCandidateV243({normalComponent,minimumComponent:input.thresholds.minimumComponent,minimumImprovement:input.thresholds.minimumImprovement,candidates:selectable});
 if(!selected)return {status:'NO_TARGET' as const,reason:candidates.some(c=>c.prediction.status==='UNRESOLVED')?'CANDIDATE_SEARCH_UNRESOLVED':'NO_CANDIDATE_MEETS_DECLARED_THRESHOLDS',reference:null,baseline,normalComponent,candidates,diagnostics,assumptions};
 return {status:'PLANNED' as const,reason:'EXPLICIT_UNCALIBRATED_PREDICTION',reference:selected.reference,selectedOrdinal:selected.ordinal,delta:selected.delta,baseline,normalComponent,candidates,diagnostics,assumptions};
}
