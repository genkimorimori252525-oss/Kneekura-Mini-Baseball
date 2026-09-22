import { request, change, value } from '../execution/ExecutionFixtures.test-support';
import { prepareEmotionExecution } from '../execution/ExecutionPreparation';
import { acceptEmotionExecution } from '../execution/ExecutionAcceptance';
import type { EmotionDecisionEffects, EmotionKind } from '../EmotionTypes';
import type { FieldingExecutionRequest, ReplanSource, ThrowSource } from './FieldingTypes';
export { change, value };
export function fixture(kind:'THROW'|'REPLAN'='THROW',active:EmotionKind|null=null,effects:Partial<EmotionDecisionEffects>={}):FieldingExecutionRequest {
 const base=request(active,effects),proposal=value(prepareEmotionExecution(base));
 const accepted=value(acceptEmotionExecution(base,proposal));
 const tick=kind==='THROW'?proposal.inputs.throwIntent.tick:proposal.inputs.defenseReplan.tick;
 const frame={...base.frame,snapshotId:'current-physical',worldRevision:11,time:{tick,sequence:0}};
 const shared={sourceId:'fielding-source',revision:1,frame:structuredClone(frame),observationTick:100,validUntilTick:1000};
 const source:ThrowSource|ReplanSource=kind==='THROW'?{...shared,kind,ballId:'ball',holderId:frame.scope.playerId,securedPossessionTick:100,
  origin:{x:0,y:1.5,z:0},holderVelocity:{x:0,y:0,z:0},receiverId:'receiver',target:{x:20,y:1.5,z:0},
  armStrength:0.75,throwingAccuracy:0.8,transferAbility:0.5,
  transfer:{minimumTransferDelayTicks:10,maximumTransferDelayTicks:30,fixedGripOffsetTicks:0},
  repertoireId:'physical-throw',repertoireVersion:'test',physicalSpeedCeilingMps:40,profiles:[
   {profileId:'controlled',minimumAggression:0,motorDurationTicks:20,calibration:{minimumReleaseSpeedMps:10,maximumReleaseSpeedMps:30,minimumTargetErrorMeters:0.02,maximumTargetErrorMeters:0.1}},
   {profileId:'strong',minimumAggression:0.7,motorDurationTicks:25,calibration:{minimumReleaseSpeedMps:20,maximumReleaseSpeedMps:40,minimumTargetErrorMeters:0.02,maximumTargetErrorMeters:0.2}}],randomSeed:100
 }:{...shared,kind,lastDecisionTick:90,triggers:[{kind:'coverage_need_changed',perceivedAt:100}],candidates:[
  {intent:{kind:'base_cover',base:1},localPriority:0.9,evidenceAvailableAt:100,evidenceKinds:['perceived-cover']},
  {intent:{kind:'hold'},localPriority:0.1,evidenceAvailableAt:100,evidenceKinds:['pre-play']}],
  ballTarget:null,baseTargets:{1:{x:10,z:0},2:{x:10,z:10},3:{x:0,z:10},4:{x:0,z:0}},
  body:{tick,position:{x:0,z:0},velocity:{x:0,z:0}},previousTarget:null,firstStepAbility:0.5,
  firstStep:{minimumFirstStepDelayTicks:10,maximumFirstStepDelayTicks:30,fixedMotorOffsetTicks:0},
  motion:{ticksPerSecond:1000,maxIntegrationStepTicks:10,accelerationMps2:4,brakingMps2:5,topSpeedMps:8,arrivalRadiusMeters:0.01},endTick:500};
 return {currentFrame:frame,currentEmotion:proposal.appraisal.state,acceptedExecution:accepted,source};
}
