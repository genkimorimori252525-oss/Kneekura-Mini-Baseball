import type { EmotionResult } from '../EmotionTypes';
import { attempt, integer, obj, fail } from '../EmotionValidation';
import { cloneExecutionData } from '../execution/ExecutionValidation';
import { planAerodynamicCourseAwareSwingV1 } from '../../../sim/pitching/AerodynamicCourseAwareSwingV1';
import { shiftSwingKinematicsTrajectoryV1 } from '../../../sim/contact/SwingKinematicsV1';
import type { BattingCommitment, BattingExecutionProposal, BattingExecutionRequest, BattingSource } from './BattingTypes';
import { coreCall, readBattingRequest, readBattingDecisionValues, readBattingRepertoireValues, numberValue } from './BattingValidation';
import { resolveMotorStart, selectPredictionAt } from './BattingTiming';
import { assertSwingSpeedEnvelope } from './BattingSpeedEnvelope';

export type BattingExecutionValues = Readonly<{
 decision: BattingSource['decisionModel'];
 motor: Pick<BattingSource,'motorLatencyTicks'|'technicalTimingOffsetTicks'|'maximumSweetSpotSpeedMps'>;
 repertoire: Pick<BattingSource,'repertoireId'|'repertoireVersion'|'profiles'>;
}>;
export type BattingExecutionCalculationInput = Readonly<{ nominalRequest: BattingExecutionRequest; effectiveValues: BattingExecutionValues }>;
export type BattingExecutionCalculation = BattingExecutionCalculationInput & Readonly<{
 algorithm: 'batting-execution-calculation-v1'; scheduledTick: number;
 status: BattingExecutionProposal['status']; commitment: BattingCommitment | null;
}>;
function nominalValues(s:BattingSource):BattingExecutionValues {
 return {decision:s.decisionModel,motor:{motorLatencyTicks:s.motorLatencyTicks,technicalTimingOffsetTicks:s.technicalTimingOffsetTicks,
  maximumSweetSpotSpeedMps:s.maximumSweetSpotSpeedMps},repertoire:{repertoireId:s.repertoireId,repertoireVersion:s.repertoireVersion,profiles:s.profiles}};
}
function readValues(raw:unknown):BattingExecutionValues {
 const p='batting.effectiveValues',v=obj(raw,['decision','motor','repertoire'],p);
 const motor=obj(v.motor,['motorLatencyTicks','technicalTimingOffsetTicks','maximumSweetSpotSpeedMps'],p+'.motor');
 if(integer(motor.motorLatencyTicks,p+'.motor.motorLatencyTicks')===0)fail('INVALID_INPUT',p+'.motor.motorLatencyTicks');
 integer(motor.technicalTimingOffsetTicks,p+'.motor.technicalTimingOffsetTicks',true);
 numberValue(motor.maximumSweetSpotSpeedMps,p+'.motor.maximumSweetSpotSpeedMps',true);
 const decision=readBattingDecisionValues(v.decision,p+'.decision'),repertoire=readBattingRepertoireValues(v.repertoire,p+'.repertoire');
 // Effective parameter IDs retain the independently accepted model-value domain.
 for(const id of [decision.modelId,decision.version,repertoire.repertoireId,repertoire.repertoireVersion,
  ...repertoire.profiles.flatMap(row=>[row.profile.profileId,row.profile.version])]) {
  if(id!==id.trim())fail('INVALID_INPUT',p+'.parameterIdentity');
 }
 return {decision,motor:motor as BattingExecutionValues['motor'],repertoire};
}
/** Commit using observer predictions only; actual pitch geometry cannot enter this calculation.
 * Effective values are separate arguments: never an altered v1 Source or owner claim. */
function calculate(request:BattingExecutionRequest,values:BattingExecutionValues):Pick<BattingExecutionProposal,'scheduledTick'|'status'|'commitment'> {
  const s=request.source,accepted=request.acceptedExecution.proposal;
  const scheduled=accepted.inputs.swingDecision,now=request.currentFrame.time.tick;
  const shell={scheduledTick:scheduled.tick};
  if(scheduled.status==='MISSED_WINDOW')return {...shell,status:'MISSED_WINDOW',commitment:null};
  if(now!==scheduled.tick)return {...shell,status:now<scheduled.tick?'WAITING':'MISSED_COMMITMENT',commitment:null};
  const prediction=selectPredictionAt(s.predictions,now);
  if(s.directive!=='TAKE' && prediction===null)return {...shell,status:'NO_OBSERVATION',commitment:null};
  if(s.directive!=='TAKE' && prediction!.validUntilTick<now)return {...shell,status:'STALE_PREDICTION',commitment:null};
  const score=s.directive==='TAKE'?null:Math.max(0,Math.min(1,prediction!.swingScore+
   (accepted.inputs.swingAggression-accepted.request.baseline.swingAggression)*values.decision.aggressionWeight));
  const shouldSwing=s.directive==='SWING' || (s.directive==='AUTO' && score!>=values.decision.threshold);
  const base:BattingCommitment={action:shouldSwing?'SWING':'TAKE',decisionTick:now,predictionId:s.directive==='TAKE'?null:prediction!.predictionId,
   adjustedSwingScore:score,profileId:null,profileVersion:null,preferredStartTick:null,motorStartTick:null,motorDelayTicks:0,
   technicalTimingOffsetTicks:values.motor.technicalTimingOffsetTicks,trajectory:null};
  if(!shouldSwing)return {...shell,status:'READY',commitment:base};
  const profile=values.repertoire.profiles.filter(x=>x.minimumAggression<=accepted.inputs.swingAggression).at(-1)!.profile;
  const planned=coreCall('batting.plan',()=>planAerodynamicCourseAwareSwingV1({predictedTrajectory:prediction!.trajectory,
   plateZ:s.plateZ,strikeZone:s.strikeZone,handedness:s.handedness,batterCenterOfMass:s.centerOfMass,physical:s.batPhysical,profile}));
  if(planned===null)return {...shell,status:'UNRESOLVED_PREDICTION',commitment:null};
  const preferred=coreCall('batting.technicalTiming',()=>shiftSwingKinematicsTrajectoryV1(planned.swingPlan.trajectory,values.motor.technicalTimingOffsetTicks));
  const motorStartTick=resolveMotorStart(preferred.startTick,now,s.bodyReadyTick,values.motor.motorLatencyTicks);
  if(motorStartTick>s.latestMotorStartTick)return {...shell,status:'MOTOR_WINDOW_MISSED',commitment:null};
  const motorDelayTicks=motorStartTick-preferred.startTick;
  const trajectory=coreCall('batting.motorTiming',()=>shiftSwingKinematicsTrajectoryV1(preferred,motorDelayTicks));
  assertSwingSpeedEnvelope(trajectory,values.motor.maximumSweetSpotSpeedMps);
  cloneExecutionData(trajectory,'batting.trajectory');
  return {...shell,status:'READY',commitment:{...base,profileId:profile.profileId,profileVersion:profile.version,
   preferredStartTick:preferred.startTick,motorStartTick,motorDelayTicks,trajectory}};
 }

/** Legacy shape, validation and results remain unchanged. */
export function prepareBattingExecution(input:unknown):EmotionResult<BattingExecutionProposal> {
 return attempt(()=>{
  const request=readBattingRequest(input);
  return {algorithm:'emotion-batting-consumer-v1' as const,request,...calculate(request,nominalValues(request.source))};
 });
}
/** Pure explicit execution seam. Native ownership and original intent/geometry admission are separate. */
export function calculateBattingExecution(input:unknown):EmotionResult<BattingExecutionCalculation> {
 return attempt(()=>{
  const raw=obj(cloneExecutionData(input,'batting.calculation'),['nominalRequest','effectiveValues'],'batting.calculation');
  const nominalRequest=readBattingRequest(raw.nominalRequest),effectiveValues=readValues(raw.effectiveValues);
  return {algorithm:'batting-execution-calculation-v1' as const,nominalRequest,effectiveValues,...calculate(nominalRequest,effectiveValues)};
 });
}
export { calculateBattingObservation } from './BattingObservationCalculation';
