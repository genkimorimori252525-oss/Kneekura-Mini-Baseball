import {it,expect} from 'vitest';
import {planObservedDirectionRegistrationV153,certificates,firstPredictedContact,predictedBall} from '../../sim/contact/ObservedDirectionRegistrationV153';
import {REALISTIC_BASEBALL_RIGID_BODY,createRigidBatStateFromBatterSwingState,type RigidBatPhysicalProperties} from '../../sim/contact/RigidBatBallContact';
import {createReferenceBatKinematicsV1,type ReferenceBatKinematicsInputV1} from '../../sim/contact/ReferenceBatKinematicsV1';
import {referenceWorldTickAtSourceV121} from '../../sim/contact/ReferenceBatMotorV121';
import {resolveWoodBatSpeedProfileBallContact} from '../../sim/contact/WoodBatSpeedResponseProfile';
import {NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1} from '../../sim/contact/WoodBatProductionProfileV1';
import {quaternionFromAxisAngle} from '../../sim/pitching/BaseballOrientation';
import {planObservedContactFrameRegistrationV243,composePredictedContactFrameReferenceV243} from './ObservedContactFrameRegistrationV243';
const reference:ReferenceBatKinematicsInputV1={provenance:{clipId:'synthetic',sourceSha256:'3'.repeat(64)},frames:[0,100000,200000,300000].map((tick,index)=>({tick,grip:{x:-.672,y:1,z:index-2},orientation:quaternionFromAxisAngle({x:0,y:0,z:1},-Math.PI/2)})),batLengthM:.84,sweetSpotT:.8,sourceTicksPerSecond:1000000,startTick:1000000,ticksPerSecond:1000000,playbackRate:1,transform:{rotation:{x:0,y:0,z:0,w:1},translation:{x:0,y:0,z:0},scale:1},executionInterpolationV122:'cubic-c1'};
const bat:RigidBatPhysicalProperties={massKg:.88,centerOfMassT:.65,transverseMomentOfInertiaKgM2:.046,axialMomentOfInertiaKgM2:.00035,radiusProfile:{knots:[{t:0,radiusM:.03},{t:1,radiusM:.03}]}};
const normalInput={reference,contactSourceTick:150000,prediction:{anchorTick:1000000,availableTick:1000000,position:{x:0,y:1,z:6},velocity:{x:0,y:0,z:-40},acceleration:{x:0,y:0,z:0}},desiredFieldAngleDegrees:0,batPhysical:bat,ballPhysical:REALISTIC_BASEBALL_RIGID_BODY};
it('uses existing predicted contact and retains normal source, clock and zero-spin assumption',()=>{
 const selected=planObservedDirectionRegistrationV153(normalInput);expect(selected.reference).not.toBeNull();
 const {desiredFieldAngleDegrees,...base}=normalInput,input={registration:{...base,reference:selected.reference!},cutoffTick:1000000,bats:'R' as const,technique:'TOPSPIN' as const,thresholds:{minimumComponent:0,minimumImprovement:0}};
 const before=structuredClone(input),result=planObservedContactFrameRegistrationV243(input);expect(input).toEqual(before);expect(result.baseline?.response).toEqual(selected.diagnostics.predictedContact?.response);expect(result.assumptions).toMatchObject({incidentSpin:'ZERO_OPERATIONAL_ASSUMPTION',actualFutureUsed:false});
 expect(result.candidates).toHaveLength(25);expect('diagnostics' in result&&result.diagnostics).toMatchObject({selection:'CERTIFIED_ELIGIBLE_CANDIDATES_ONLY',globalOptimumGuaranteed:false});expect(planObservedContactFrameRegistrationV243(input)).toEqual(result);if(result.reference){expect(result.reference).toEqual(input.registration.reference);expect(result.diagnostics).toMatchObject({selection:'CERTIFIED_ELIGIBLE_CANDIDATES_ONLY',globalOptimumGuaranteed:false});expect(result.candidates.every(c=>c.exclusionReason===null||typeof c.exclusionReason==='string')).toBe(true);expect(result.reference.frames).toEqual(input.registration.reference.frames);expect(result.reference.transform.rotation).toEqual(input.registration.reference.transform.rotation);expect(result.reference.startTick).toBe(input.registration.reference.startTick);}
},60000);
it('rejects undelivered prediction without calculating any candidate',()=>{
 const {desiredFieldAngleDegrees,...registration}=normalInput;const result=planObservedContactFrameRegistrationV243({registration,cutoffTick:999999,bats:'R',technique:'HOOK',thresholds:{minimumComponent:0,minimumImprovement:0}});expect(result).toMatchObject({status:'NO_TARGET',reason:'PREDICTION_NOT_DELIVERED',reference:null,candidates:[]});
});

it('rejects actual-future extra fields and a predicted miss without fabricating contact',()=>{
 const {desiredFieldAngleDegrees,...registration}=normalInput,base={registration,cutoffTick:1000000,bats:'R' as const,technique:'HOOK' as const,thresholds:{minimumComponent:0,minimumImprovement:0}};
 expect(planObservedContactFrameRegistrationV243({...base,actualFuture:{spin:999}} as typeof base)).toMatchObject({status:'NO_TARGET',reason:'INVALID_INPUT_FIELDS'});
 const missing={...registration,prediction:{...registration.prediction,position:{x:100,y:100,z:100}}};expect(planObservedContactFrameRegistrationV243({...base,registration:missing})).toMatchObject({status:'NO_TARGET',reference:null});
});

it('rejects nonfinite prediction and planning after motion start',()=>{
 const {desiredFieldAngleDegrees,...registration}=normalInput,base={registration,cutoffTick:1000000,bats:'R' as const,technique:'HOOK' as const,thresholds:{minimumComponent:0,minimumImprovement:0}};
 expect(planObservedContactFrameRegistrationV243({...base,registration:{...registration,prediction:{...registration.prediction,velocity:{x:NaN,y:0,z:0}}}})).toMatchObject({status:'NO_TARGET',reason:'INVALID_DECLARATION'});
 const chosen=planObservedDirectionRegistrationV153(normalInput).reference!;expect(planObservedContactFrameRegistrationV243({...base,registration:{...registration,reference:chosen},cutoffTick:1000001})).toMatchObject({status:'NO_TARGET',reason:'NORMAL_PLANNING_AFTER_MOTION_START'});
});

it('selects a nonzero certified candidate with predeclared component and improvement of one',()=>{
 const selected=planObservedDirectionRegistrationV153(normalInput);expect(selected.reference).not.toBeNull();const {desiredFieldAngleDegrees,...base}=normalInput;
 const input={registration:{...base,reference:selected.reference!},cutoffTick:1000000,bats:'R' as const,technique:'TOPSPIN' as const,thresholds:{minimumComponent:1,minimumImprovement:1}};
 const result=planObservedContactFrameRegistrationV243(input);expect(result.status,JSON.stringify({reason:result.reason,normal:'normalComponent' in result?result.normalComponent:null,candidates:result.candidates.map(c=>({ordinal:c.ordinal,component:c.component,exclusion:c.exclusionReason,prediction:c.prediction.status}))})).toBe('PLANNED');if(result.status!=='PLANNED')return;
 const chosen=result.candidates.find(c=>c.ordinal===result.selectedOrdinal)!;expect(chosen.norm).toBeGreaterThan(0);expect(chosen.component!).toBeGreaterThanOrEqual(1);expect(chosen.component!-result.normalComponent).toBeGreaterThanOrEqual(1);expect(chosen.improvement).toBeGreaterThanOrEqual(1);
 const composed=composePredictedContactFrameReferenceV243(input.registration.reference,result.delta),motion=createReferenceBatKinematicsV1(composed),through=motion.motionThroughTickV133??referenceWorldTickAtSourceV121(composed,composed.frames.at(-1)!.tick),found=firstPredictedContact(input.registration,motion,input.registration.prediction.availableTick,through,.03);expect(found.status).toBe('FOUND');if(found.status!=='FOUND')return;
 const ball=predictedBall(input.registration,found.atTick),rigid=createRigidBatStateFromBatterSwingState(motion.sampleContinuous(found.atTick).state,input.registration.batPhysical),response=resolveWoodBatSpeedProfileBallContact(ball,rigid,input.registration.ballPhysical,NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1);expect(chosen.prediction).toMatchObject({status:'FOUND',atTick:found.atTick,response});
 expect(result.reference).toEqual(input.registration.reference);expect(result.diagnostics).toMatchObject({selection:'CERTIFIED_ELIGIBLE_CANDIDATES_ONLY',globalOptimumGuaranteed:false});expect(chosen.exclusionReason).toBeNull();expect(result.candidates.every(c=>c.exclusionReason===null||typeof c.exclusionReason==='string')).toBe(true);expect(result.reference.frames).toEqual(input.registration.reference.frames);expect(result.reference.transform.rotation).toEqual(input.registration.reference.transform.rotation);expect(result.reference.startTick).toBe(input.registration.reference.startTick);expect(result.reference.provenance).toEqual(input.registration.reference.provenance);
},60000);

it('regenerates the same translated target as shared reference creation while held poses and clock remain fixed',()=>{
 const first=reference.frames[0],last=reference.frames[reference.frames.length-1],source={...reference,executionEnvelopeV133:{version:'reference_bat_envelope_v133' as const,sourceId:'explicit-fixture',preparation:{durationSeconds:.1,grip:first.grip,orientation:first.orientation},recovery:{durationSeconds:.1,grip:last.grip,orientation:last.orientation}}};
 const before=structuredClone(source),delta={x:.01,y:-.005,z:.007},candidate=composePredictedContactFrameReferenceV243(source,delta),manual={...source,transform:{...source.transform,translation:{x:source.transform.translation.x+delta.x,y:source.transform.translation.y+delta.y,z:source.transform.translation.z+delta.z}}},normal=createReferenceBatKinematicsV1(source),actual=createReferenceBatKinematicsV1(candidate),expected=createReferenceBatKinematicsV1(manual);
 expect(candidate).toEqual(manual);expect(composePredictedContactFrameReferenceV243(source,{x:0,y:0,z:0})).toBe(source);
 for(const tick of [normal.motionStartTickV133!,950000,1100000,1350000,normal.motionThroughTickV133!]){const a=actual.sampleContinuous(tick),b=expected.sampleContinuous(tick);expect(a.state).toEqual(b.state);expect(a.sweetSpot).toEqual(b.sweetSpot);expect(a.tick).toBe(b.tick)}
 expect(actual.sampleContinuous(normal.motionStartTickV133!).state.pose).toEqual(normal.sampleContinuous(normal.motionStartTickV133!).state.pose);expect(actual.sampleContinuous(normal.motionThroughTickV133!).state.pose).toEqual(normal.sampleContinuous(normal.motionThroughTickV133!).state.pose);
 expect(actual.motionThroughTickV133).toBe(normal.motionThroughTickV133);expect(certificates(actual)).toEqual(certificates(expected));expect(certificates(actual)).not.toEqual(certificates(normal));expect(source).toEqual(before);
});
it('rejects a declared motor limit that the existing certificate exceeds',()=>{
 const selected=planObservedDirectionRegistrationV153(normalInput),{desiredFieldAngleDegrees,...base}=normalInput;
 const result=planObservedContactFrameRegistrationV243({registration:{...base,reference:selected.reference!,limits:{maximumSweetSpotSpeedMps:.0001}},cutoffTick:1000000,bats:'R',technique:'TOPSPIN',thresholds:{minimumComponent:1,minimumImprovement:1}});
 expect(result).toMatchObject({status:'NO_TARGET',reason:'NORMAL_EXPLICIT_LIMIT:maximumSweetSpotSpeedMps',reference:null,assumptions:{fallback:'RETAIN_NORMAL_UNMODIFIED'}});
});
