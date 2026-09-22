import type { EmotionResult } from '../EmotionTypes';
import { attempt } from '../EmotionValidation';
import { cloneExecutionData } from '../execution/ExecutionValidation';
import { planAerodynamicCourseAwareSwingV1 } from '../../../sim/pitching/AerodynamicCourseAwareSwingV1';
import { shiftSwingKinematicsTrajectoryV1 } from '../../../sim/contact/SwingKinematicsV1';
import type { BattingCommitment, BattingExecutionProposal } from './BattingTypes';
import { coreCall, readBattingRequest } from './BattingValidation';
import { resolveMotorStart, selectPredictionAt } from './BattingTiming';
import { assertSwingSpeedEnvelope } from './BattingSpeedEnvelope';

/** Commit using observer predictions only; actual pitch geometry cannot enter this function. */
export function prepareBattingExecution(input:unknown):EmotionResult<BattingExecutionProposal> {
 return attempt(()=>{
  const request=readBattingRequest(input),s=request.source,accepted=request.acceptedExecution.proposal;
  const scheduled=accepted.inputs.swingDecision,now=request.currentFrame.time.tick;
  const shell={algorithm:'emotion-batting-consumer-v1' as const,request,scheduledTick:scheduled.tick};
  if(scheduled.status==='MISSED_WINDOW')return {...shell,status:'MISSED_WINDOW',commitment:null};
  if(now!==scheduled.tick)return {...shell,status:now<scheduled.tick?'WAITING':'MISSED_COMMITMENT',commitment:null};
  const prediction=selectPredictionAt(s.predictions,now);
  if(s.directive!=='TAKE' && prediction===null)return {...shell,status:'NO_OBSERVATION',commitment:null};
  if(s.directive!=='TAKE' && prediction!.validUntilTick<now)return {...shell,status:'STALE_PREDICTION',commitment:null};
  const score=s.directive==='TAKE'?null:Math.max(0,Math.min(1,prediction!.swingScore+
   (accepted.inputs.swingAggression-accepted.request.baseline.swingAggression)*s.decisionModel.aggressionWeight));
  const shouldSwing=s.directive==='SWING' || (s.directive==='AUTO' && score!>=s.decisionModel.threshold);
  const base:BattingCommitment={action:shouldSwing?'SWING':'TAKE',decisionTick:now,predictionId:s.directive==='TAKE'?null:prediction!.predictionId,
   adjustedSwingScore:score,profileId:null,profileVersion:null,preferredStartTick:null,motorStartTick:null,motorDelayTicks:0,
   technicalTimingOffsetTicks:s.technicalTimingOffsetTicks,trajectory:null};
  if(!shouldSwing)return {...shell,status:'READY',commitment:base};
  const profile=s.profiles.filter(x=>x.minimumAggression<=accepted.inputs.swingAggression).at(-1)!.profile;
  const planned=coreCall('batting.plan',()=>planAerodynamicCourseAwareSwingV1({predictedTrajectory:prediction!.trajectory,
   plateZ:s.plateZ,strikeZone:s.strikeZone,handedness:s.handedness,batterCenterOfMass:s.centerOfMass,physical:s.batPhysical,profile}));
  if(planned===null)return {...shell,status:'UNRESOLVED_PREDICTION',commitment:null};
  const preferred=coreCall('batting.technicalTiming',()=>shiftSwingKinematicsTrajectoryV1(planned.swingPlan.trajectory,s.technicalTimingOffsetTicks));
  const motorStartTick=resolveMotorStart(preferred.startTick,now,s.bodyReadyTick,s.motorLatencyTicks);
  if(motorStartTick>s.latestMotorStartTick)return {...shell,status:'MOTOR_WINDOW_MISSED',commitment:null};
  const motorDelayTicks=motorStartTick-preferred.startTick;
  const trajectory=coreCall('batting.motorTiming',()=>shiftSwingKinematicsTrajectoryV1(preferred,motorDelayTicks));
  assertSwingSpeedEnvelope(trajectory,s.maximumSweetSpotSpeedMps);
  cloneExecutionData(trajectory,'batting.trajectory');
  return {...shell,status:'READY',commitment:{...base,profileId:profile.profileId,profileVersion:profile.version,
   preferredStartTick:preferred.startTick,motorStartTick,motorDelayTicks,trajectory}};
 });
}
