import { request, value, change } from '../execution/ExecutionFixtures.test-support';
import { prepareEmotionExecution } from '../execution/ExecutionPreparation';
import { acceptEmotionExecution } from '../execution/ExecutionAcceptance';
import type { EmotionDecisionEffects, EmotionKind } from '../EmotionTypes';
import type { BattingExecutionRequest } from './BattingTypes';
import type { AerodynamicPitchTrajectory } from '../../../sim/pitching/AerodynamicPitchTrajectory';
import { REFERENCE_BASEBALL_AERODYNAMICS } from '../../../sim/ball/BaseballAerodynamics';
import { REALISTIC_BASEBALL_RIGID_BODY } from '../../../sim/contact/RigidBatBallContact';
import { EVIDENCE_BOUNDED_SWING_COURSE_PROFILE_V1 } from '../../../sim/pitching/CourseAwareSwingKinematicsV1';
export { value, change };
export function flight(x=0):AerodynamicPitchTrajectory {
 return {start:{tick:0,position:{x,y:0.87,z:15},velocity:{x:0,y:0,z:-40},spin:{x:0,y:0,z:0}},endTick:800000,
  parameters:{ticksPerSecond:1000000,integrationStepTicks:2000,gravityY:0,aerodynamics:{...REFERENCE_BASEBALL_AERODYNAMICS,airDensityKgM3:0}}};
}
/** Synthetic fixtures are not a player calibration or an observation generator. */
export function fixture(active:EmotionKind|null=null,effects:Partial<EmotionDecisionEffects>={}):BattingExecutionRequest {
 const base=change(request(active,effects),d=>{
  d.baseline.swingDecision={tick:160000,earliestTick:110000,latestTick:450000};d.appraisal.model.impactTickScale=1000000;
 });
 const emotion=value(prepareEmotionExecution(base));const acceptedExecution=value(acceptEmotionExecution(base,emotion));
 const currentFrame={...base.frame,snapshotId:'batting-current',worldRevision:11,time:{tick:emotion.inputs.swingDecision.tick,sequence:0}};
 return {currentFrame,currentEmotion:emotion.appraisal.state,acceptedExecution,source:{sourceId:'batter-source',revision:3,
  frame:structuredClone(currentFrame),validUntilTick:600000,ballId:'ball-1',playId:200,pitchOrdinal:0,ticksPerSecond:1000000,count:{balls:0,strikes:0},timelineNextSequence:0,
  bodyReadyTick:100000,motorLatencyTicks:20000,latestMotorStartTick:500000,technicalTimingOffsetTicks:0,
  handedness:'R',centerOfMass:{x:-0.78,y:1,z:-0.16},batPhysical:{massKg:0.9,centerOfMassT:0.58,
   transverseMomentOfInertiaKgM2:0.055,axialMomentOfInertiaKgM2:0.0005,
   radiusProfile:{knots:[{t:0,radiusM:0.025},{t:0.55,radiusM:0.031},{t:1,radiusM:0.033}]}},
  ball:REALISTIC_BASEBALL_RIGID_BODY,plateZ:0,strikeZone:{centerX:0,halfWidth:0.2159,lowerY:0.5,upperY:1.1},maximumSweetSpotSpeedMps:50,
  repertoireId:'test-repertoire',repertoireVersion:'test-v1',profiles:[
   {minimumAggression:0,profile:{...EVIDENCE_BOUNDED_SWING_COURSE_PROFILE_V1,profileId:'controlled'}},
   {minimumAggression:0.7,profile:{...EVIDENCE_BOUNDED_SWING_COURSE_PROFILE_V1,profileId:'strong',baseContactSweetSpotSpeedMps:35}}],
  directive:'AUTO',decisionModel:{modelId:'synthetic-decision',version:'test-v1',threshold:0.5,aggressionWeight:0.5},
  predictions:[{predictionId:'coarse',observedTick:110000,availableTick:120000,validUntilTick:450000,trajectory:flight(0.5),swingScore:0.8},
   {predictionId:'refined',observedTick:140000,availableTick:150000,validUntilTick:450000,trajectory:flight(),swingScore:0.8}]}};
}
