import type {Vec3} from '../../core/model/geometry';
import {cloneInert} from '../../core/adjudication/OfficialWindowPolicy';
import {planObservedContactFrameRegistrationV243} from '../../core/decision/batting/ObservedContactFrameRegistrationV243';
import {evaluateRobustContactFrameAimV247,type RobustEvaluationV247} from '../../core/decision/batting/RobustContactFrameAimV247';
import {firstPredictedContact,predictedBall,certificates,SEARCH_EVALUATIONS,type ObservedReactiveRegistrationInputV161} from '../../core/sim/contact/ObservedDirectionRegistrationV153';
import {referenceWorldTickAtSourceV121,referenceElapsedSecondsV121} from '../../core/sim/contact/ReferenceBatMotorV121';
import {resolveMotorStart} from '../../core/world/psychology/batting/BattingTiming';
import {createReferenceBatKinematicsV1} from '../../core/sim/contact/ReferenceBatKinematicsV1';
import {createRigidBatStateFromBatterSwingState} from '../../core/sim/contact/RigidBatBallContact';
import {resolveWoodBatSpeedProfileBallContact} from '../../core/sim/contact/WoodBatSpeedResponseProfile';
import {NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1} from '../../core/sim/contact/WoodBatProductionProfileV1';
import {observeBattedBallSpinV123} from '../../core/sim/contact/BattedBallSpinObservationV123';
import {buildLiveBatReferenceExecutionV247,type LiveBatReferenceRecipeV247} from './LiveBatReferenceExecutionV247';

type NominalInput=Parameters<typeof planObservedContactFrameRegistrationV243>[0];
type Input=Readonly<{recipe:LiveBatReferenceRecipeV247;registration:ObservedReactiveRegistrationInputV161;cutoffTick:number;bats:NominalInput['bats'];technique:NominalInput['technique'];thresholds:NominalInput['thresholds'];sigma:Readonly<{timingSeconds:number;aim:Vec3}>;maximumEvaluations:number;maximumSearchSamples:number}>;
const fields=['recipe','registration','cutoffTick','bats','technique','thresholds','sigma','maximumEvaluations','maximumSearchSamples'];
const exact=(a:unknown,b:unknown):boolean=>{
 if(Object.is(a,b))return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const ak=Object.keys(a).sort(),bk=Object.keys(b).sort();return ak.length===bk.length&&ak.every((k,i)=>k===bk[i]&&exact((a as Record<string,unknown>)[k],(b as Record<string,unknown>)[k]));
};
/** Explicit finite operational experiment, never actual draw or a calibrated probability. */
export function planLiveRobustContactFrameV247(input:Input){
 const assumptions={actualFutureUsed:false,incidentSpin:'ZERO_OPERATIONAL_ASSUMPTION',lateObservationIncluded:false,randomSweetSpotVariationIncluded:false,axisOnly:true,calibrated:false,earnedQualification:false} as const;
 input=cloneInert(input);
 if(!input||Object.keys(input).sort().join('|')!==[...fields].sort().join('|'))throw Error('invalid robust prediction input fields');
 const recipeKeys=['originTick','decisionTick','decisionTimeSeconds','nominalArrivalSeconds','technicalTimingOffsetSeconds','latencySeconds','startMode','contactSourceTick','rampSeconds','reference','normalCenter','limits','impactTrajectory'];
 const referenceKeys=['provenance','frames','batLengthM','sweetSpotT','sourceTicksPerSecond','ticksPerSecond','playbackRate','rotation','motorRampSecondsV121','executionInterpolationV122','executionEnvelopeV133'];
 if(Object.keys(input.recipe).some(k=>!recipeKeys.includes(k))||Object.keys(input.recipe.reference).some(k=>!referenceKeys.includes(k)))throw Error('invalid robust recipe fields');
 const keysEqual=(x:unknown,keys:string[])=>!!x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join('|')===keys.sort().join('|');
 if(!keysEqual(input.sigma,['timingSeconds','aim'])||!keysEqual(input.sigma.aim,['x','y','z'])||!keysEqual(input.recipe.normalCenter,['x','y','z'])||!keysEqual(input.thresholds,['minimumComponent','minimumImprovement']))throw Error('invalid robust nested declaration');
 // Budget reserves the entire nominal 25-point pass before it starts; the
 // following budget is for whole scenario-reference evaluations only.
 if(!Number.isSafeInteger(input.maximumEvaluations)||input.maximumEvaluations<25||!Number.isSafeInteger(input.maximumSearchSamples)||input.maximumSearchSamples<25*SEARCH_EVALUATIONS)return {status:'UNRESOLVED' as const,reason:'EVALUATION_BUDGET_INSUFFICIENT',assumptions,contactSearchCalls:0,contactSearchSamples:0,nominalSearchSampleCount:'UNAVAILABLE' as const};
 try{const r=input.recipe.reference,n=input.registration.reference;
  const expectedCenter=createReferenceBatKinematicsV1(n).sampleAtSourceTick(input.registration.contactSourceTick).sweetSpot;
  const recipe=input.recipe,tps=r.ticksPerSecond,offset=Math.max(.055,recipe.nominalArrivalSeconds+recipe.technicalTimingOffsetSeconds)-referenceElapsedSecondsV121((recipe.contactSourceTick-r.frames[0].tick)/1e6/r.playbackRate,recipe.rampSeconds),planned=recipe.originTick+Math.max(0,Math.round(offset*tps)),latency=Math.ceil((recipe.latencySeconds??0)*tps);
  const start=recipe.startMode==='ENVELOPE'?Math.max(planned,recipe.decisionTick+latency+Math.ceil(r.executionEnvelopeV133!.preparation.durationSeconds*tps)):recipe.startMode==='MOTOR'?resolveMotorStart(planned,recipe.decisionTick,recipe.originTick,latency):recipe.latencySeconds===undefined?planned:Math.max(planned,recipe.originTick+Math.ceil((recipe.decisionTimeSeconds+recipe.latencySeconds)*tps));
  if(!Object.is(n.transform.scale,1)||!Object.is(r.sourceTicksPerSecond,1000000)||recipe.startMode!==(r.executionEnvelopeV133?'ENVELOPE':'MOTOR')||!exact(r.provenance,n.provenance)||!exact(r.frames,n.frames)||!Object.is(r.batLengthM,n.batLengthM)||!Object.is(r.sweetSpotT,n.sweetSpotT)||!exact(r.rotation,n.transform.rotation)||!Object.is(r.sourceTicksPerSecond,n.sourceTicksPerSecond)||!Object.is(r.ticksPerSecond,n.ticksPerSecond)||!Object.is(r.playbackRate,n.playbackRate)||!Object.is(r.motorRampSecondsV121,n.motorRampSecondsV121)||!Object.is(recipe.rampSeconds,n.motorRampSecondsV121??0)||!exact(r.executionEnvelopeV133,n.executionEnvelopeV133)||!exact(recipe.impactTrajectory===undefined?undefined:{...recipe.impactTrajectory,contactSourceTick:recipe.contactSourceTick},n.impactTrajectory)||!Object.is(r.executionInterpolationV122,n.executionInterpolationV122)||!exact(recipe.normalCenter,expectedCenter)||recipe.contactSourceTick!==input.registration.contactSourceTick||recipe.decisionTick!==input.cutoffTick||recipe.originTick+Math.round(recipe.decisionTimeSeconds*tps)!==recipe.decisionTick||input.registration.prediction.availableTick!==input.cutoffTick||!Object.is(recipe.originTick+recipe.nominalArrivalSeconds*tps,input.registration.prediction.anchorTick)||start!==n.startTick||!exact(recipe.limits,input.registration.limits??{}))throw Error('inconsistent nominal recipe and registration');
 }catch{throw Error('inconsistent nominal recipe and registration');}
 const nominal=planObservedContactFrameRegistrationV243({registration:input.registration,cutoffTick:input.cutoffTick,bats:input.bats,technique:input.technique,thresholds:input.thresholds});
 const candidates=nominal.candidates.filter(c=>c.exclusionReason===null).map(c=>({ordinal:c.ordinal,delta:c.delta,norm:c.norm}));
 const evaluated=[...('failedBaseline' in nominal?[nominal.failedBaseline]:nominal.baseline?[nominal.baseline]:[]),...nominal.candidates.filter(c=>c.ordinal!==0).map(c=>c.prediction)];
 const measured=evaluated.filter(e=>e.searchEvaluations!==undefined),unknown=evaluated.filter(e=>'searchSamplesUnknown' in e&&e.searchSamplesUnknown),nominalContactSearchCalls=measured.length+unknown.length,nominalContactSearchSamples=unknown.length?null:measured.reduce((n,e)=>n+e.searchEvaluations!,0);
 if(!candidates.length)return {status:nominal.reason.includes('UNRESOLVED')||('failedBaseline' in nominal&&nominal.failedBaseline?.status==='UNRESOLVED')?'UNRESOLVED' as const:'NO_TARGET' as const,reason:nominal.reason,nominal,assumptions,contactSearchCalls:0,contactSearchSamples:0,nominalContactSearchCalls,nominalContactSearchSamples};
 const reservedCalls=25+9*(1+candidates.length),reservedSamples=reservedCalls*SEARCH_EVALUATIONS;
 if(input.maximumEvaluations<reservedCalls||input.maximumSearchSamples<reservedSamples)return {status:'UNRESOLVED' as const,reason:'EVALUATION_BUDGET_INSUFFICIENT',nominal,assumptions,contactSearchCalls:0,contactSearchSamples:0,nominalContactSearchCalls,nominalContactSearchSamples,reservedCalls,reservedSamples};
 const limits=input.registration.limits??{},keys=['maximumSweetSpotSpeedMps','maximumGripAccelerationMps2','maximumAngularAccelerationRadPerSecond2','maximumSweetSpotAccelerationMps2'] as const;
 let contactSearchCalls=0,contactSearchSamples=0,scenarioSearchSamplesUnknown=false;
 const result=evaluateRobustContactFrameAimV247({sigma:input.sigma,candidates,thresholds:input.thresholds,maximumEvaluations:input.maximumEvaluations-25,evaluate:(scenario,delta):RobustEvaluationV247=>{
  try{const built=buildLiveBatReferenceExecutionV247(input.recipe,{timingSeconds:scenario.timingSeconds,aim:scenario.aim},delta),motion=built.motion,cert=certificates(motion);
   for(const key of keys){const limit=limits[key],value=cert[key];if(limit!==undefined&&value===null)return {status:'UNRESOLVED',reason:'MISSING_CERTIFICATE:'+key};if(limit!==undefined&&value!==null&&value>limit)return {status:'MISS',reason:'EXPLICIT_LIMIT:'+key};}
   const reference=built.reference,r={...input.registration,reference},from=motion.motionStartTickV133??reference.startTick,through=motion.motionThroughTickV133??referenceWorldTickAtSourceV121(reference,reference.frames[reference.frames.length-1].tick);
   if(input.cutoffTick>from||r.prediction.availableTick>from)return {status:'UNRESOLVED',reason:'PREDICTION_AFTER_MOTION_START'};
   const radius=Math.max(...r.batPhysical.radiusProfile.knots.map(k=>k.radiusM));contactSearchCalls++;let found:ReturnType<typeof firstPredictedContact>;try{found=firstPredictedContact(r,motion,r.prediction.availableTick,through,radius);}catch(error){scenarioSearchSamplesUnknown=true;throw error;}contactSearchSamples+=found.evaluations;
   if(found.status!=='FOUND')return {status:'UNRESOLVED',reason:found.reason};
   const ball=predictedBall(r,found.atTick),bat=createRigidBatStateFromBatterSwingState(motion.sampleContinuous(found.atTick).state,r.batPhysical),response=resolveWoodBatSpeedProfileBallContact(ball,bat,r.ballPhysical,NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1);
   if(!response)return {status:'MISS',reason:'NO_CLOSING_RESPONSE'};
   const o=observeBattedBallSpinV123({velocityMps:response.exitVelocity,spinRadPerSecond:response.exitSpin,bats:input.bats});if(o.basisStatus!=='DEFINED')return {status:'UNRESOLVED',reason:'UNDEFINED_FLIGHT_FRAME'};
   const slice=o.rightCurvingSpinRadPerSecond*(input.bats==='R'?1:-1),component=input.technique==='BACKSPIN'?o.backspinSignedRadPerSecond:input.technique==='TOPSPIN'?-o.backspinSignedRadPerSecond:input.technique==='SLICE'?slice:-slice;
   return Number.isFinite(component)?{status:'FOUND',component}:{status:'UNRESOLVED',reason:'NONFINITE_COMPONENT'};
  }catch(error){return {status:'UNRESOLVED',reason:'REFERENCE_OR_SEARCH_FAILED:'+String(error instanceof Error?error.message:error)};}
 }});
 return {...result,nominal,assumptions,contactSearchCalls,contactSearchSamples:scenarioSearchSamplesUnknown?null:contactSearchSamples,nominalContactSearchCalls,nominalContactSearchSamples,reservedCalls,reservedSamples};
}
