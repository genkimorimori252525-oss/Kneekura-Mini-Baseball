import type { BattingSource, BattingCommitment, BattingRepertoireValues } from './BattingTypes';
import type { EmotionResult } from '../EmotionTypes';
import { attempt, obj, integer, fraction, fail } from '../EmotionValidation';
import { cloneExecutionData } from '../execution/ExecutionValidation';
import { coreCall, readFlight, readBattingRepertoireValues, readBattingPhysicalValues, numberValue } from './BattingValidation';
import { resolveMotorStart } from './BattingTiming';
import { assertSwingSpeedEnvelope } from './BattingSpeedEnvelope';
import { planMeasuredBattingTrajectoryV1,registrationForMeasuredRepertoireV137 } from './MeasuredBattingTrajectoryV1';
import { planAerodynamicCourseAwareSwingV1 } from '../../../sim/pitching/AerodynamicCourseAwareSwingV1';
import { shiftSwingKinematicsTrajectoryV1, type SwingKinematicsTrajectoryV1 } from '../../../sim/contact/SwingKinematicsV1';
import { createReferenceBatKinematicsV1 } from '../../../sim/contact/ReferenceBatKinematicsV1';

type Geometry = Pick<BattingSource, 'handedness'|'centerOfMass'|'batPhysical'|'plateZ'|'strikeZone'|'bodyReadyTick'|'latestMotorStartTick'>;
type Motor = Pick<BattingSource, 'motorLatencyTicks'|'technicalTimingOffsetTicks'|'maximumSweetSpotSpeedMps'>;
type Forecast = Pick<BattingSource['predictions'][number], 'observedTick'|'availableTick'|'validUntilTick'|'trajectory'>;
type Motion = Pick<BattingCommitment, 'profileId'|'profileVersion'|'preferredStartTick'|'motorStartTick'|'motorDelayTicks'|'technicalTimingOffsetTicks'|'trajectory'|'sampledTrajectoryV1'>;
export type BattingMotorPlanInputV1 = Readonly<{
  decisionTick: number; aggression: number; geometry: Geometry; motor: Motor;
  repertoire: BattingRepertoireValues; forecast: Forecast;
}>;
export type BattingMotorPlanV1 = Readonly<
  {status:'READY';motion:Motion} | {status:'UNRESOLVED_PREDICTION'|'MOTOR_WINDOW_MISSED';motion:null}
>;

/** Shared by actual execution and observed initial-pitch preparation. Inputs
 * here have already passed their Core/owner validators. This plans a motor;
 * it neither chooses SWING/TAKE nor issues a physical control or event. */
export function planBattingMotorV1(input:BattingMotorPlanInputV1,
  selectedProfile?:Readonly<{profileId:string;version:string}>):BattingMotorPlanV1 {
  const {geometry:s,repertoire,forecast,aggression}=input;
  // A qualified repertoire planner may select an existing profile. Execution
  // and envelopes below remain the same single controller for every intent.
  const profile=selectedProfile?repertoire.profiles.find(x=>x.profile.profileId===selectedProfile.profileId
    &&x.profile.version===selectedProfile.version&&x.minimumAggression<=aggression)?.profile
    :repertoire.profiles.filter(x=>x.minimumAggression<=aggression).at(-1)!.profile;
  if(!profile)fail('INVALID_INPUT','batting.selectedProfile.unavailable');
  const planned=coreCall('batting.plan',()=>planAerodynamicCourseAwareSwingV1({predictedTrajectory:forecast.trajectory,
    plateZ:s.plateZ,strikeZone:s.strikeZone,handedness:s.handedness,batterCenterOfMass:s.centerOfMass,physical:s.batPhysical,profile}));
  if(planned===null)return {status:'UNRESOLVED_PREDICTION',motion:null};
  return finalizeBattingMotorPlanV1(input,profile,planned.swingPlan.trajectory);
}

/** Shared timing, window, measured registration and speed validation for an
 * already planned trajectory. No Source or physical result is accepted here. */
export function finalizeBattingMotorPlanV1(input:BattingMotorPlanInputV1,
  profile:BattingRepertoireValues['profiles'][number]['profile'],plannedTrajectory:SwingKinematicsTrajectoryV1):BattingMotorPlanV1 {
  const {geometry:s,motor,repertoire,decisionTick:now}=input;
  const preferred=coreCall('batting.technicalTiming',()=>shiftSwingKinematicsTrajectoryV1(plannedTrajectory,motor.technicalTimingOffsetTicks));
  const measured=repertoire.sampledProfiles?.find(p=>p.profileId===profile.profileId);
  if(measured){
    const sampled=coreCall('batting.measuredPlanning',()=>planMeasuredBattingTrajectoryV1(measured,s.handedness,preferred,
      registrationForMeasuredRepertoireV137(repertoire.repertoireVersion)));
    const motorStartTick=resolveMotorStart(sampled.startTick,now,s.bodyReadyTick,motor.motorLatencyTicks);
    if(motorStartTick>s.latestMotorStartTick)return {status:'MOTOR_WINDOW_MISSED',motion:null};
    const motorDelayTicks=motorStartTick-sampled.startTick,sampledTrajectoryV1={...sampled,startTick:motorStartTick};
    const motion=coreCall('batting.measuredMotor',()=>createReferenceBatKinematicsV1(sampledTrajectoryV1));
    if(motion.maximumSweetSpotSpeedMps>motor.maximumSweetSpotSpeedMps)fail('INVALID_INPUT','batting.measuredMotor.speedEnvelope.exceeded');
    return {status:'READY',motion:{profileId:profile.profileId,profileVersion:profile.version,preferredStartTick:sampled.startTick,
      motorStartTick,motorDelayTicks,technicalTimingOffsetTicks:motor.technicalTimingOffsetTicks,trajectory:null,sampledTrajectoryV1}};
  }
  const motorStartTick=resolveMotorStart(preferred.startTick,now,s.bodyReadyTick,motor.motorLatencyTicks);
  if(motorStartTick>s.latestMotorStartTick)return {status:'MOTOR_WINDOW_MISSED',motion:null};
  const motorDelayTicks=motorStartTick-preferred.startTick;
  const trajectory=coreCall('batting.motorTiming',()=>shiftSwingKinematicsTrajectoryV1(preferred,motorDelayTicks));
  assertSwingSpeedEnvelope(trajectory,motor.maximumSweetSpotSpeedMps);
  cloneExecutionData(trajectory,'batting.trajectory');
  return {status:'READY',motion:{profileId:profile.profileId,profileVersion:profile.version,preferredStartTick:preferred.startTick,
    motorStartTick,motorDelayTicks,technicalTimingOffsetTicks:motor.technicalTimingOffsetTicks,trajectory}};
}

/** Validate the original observed input without assuming its default profile
 * is executable. A qualified alternative still uses these same validators. */
export function readObservedBattingMotorInputV1(raw:unknown):BattingMotorPlanInputV1 {
    const p='batting.motorPreparation',v=obj(cloneExecutionData(raw,p),['decisionTick','aggression','geometry','motor','repertoire','forecast'],p);
    const now=integer(v.decisionTick,p+'.decisionTick'),aggression=fraction(v.aggression,p+'.aggression');
    const g=obj(v.geometry,['handedness','centerOfMass','batPhysical','plateZ','strikeZone','bodyReadyTick','latestMotorStartTick'],p+'.geometry');
    if(g.handedness!=='R'&&g.handedness!=='L')fail('INVALID_INPUT',p+'.handedness');
    const vector=obj(g.centerOfMass,['x','y','z'],p+'.centerOfMass');Object.values(vector).forEach(n=>numberValue(n,p+'.centerOfMass'));
    numberValue(g.plateZ,p+'.plateZ');integer(g.bodyReadyTick,p+'.bodyReadyTick');integer(g.latestMotorStartTick,p+'.latestMotorStartTick');
    readBattingPhysicalValues(g.batPhysical,p+'.bat');
    const zone=obj(g.strikeZone,['centerX','halfWidth','lowerY','upperY'],p+'.strikeZone');
    Object.values(zone).forEach(n=>numberValue(n,p+'.strikeZone'));
    if(Number(zone.halfWidth)<=0||Number(zone.upperY)<=Number(zone.lowerY))fail('INVALID_INPUT',p+'.strikeZone');
    const motor=obj(v.motor,['motorLatencyTicks','technicalTimingOffsetTicks','maximumSweetSpotSpeedMps'],p+'.motor');
    if(integer(motor.motorLatencyTicks,p+'.motorLatencyTicks')===0)fail('INVALID_INPUT',p+'.motorLatencyTicks');
    integer(motor.technicalTimingOffsetTicks,p+'.technicalTimingOffsetTicks',true);numberValue(motor.maximumSweetSpotSpeedMps,p+'.maximumSweetSpotSpeedMps',true);
    const forecast=obj(v.forecast,['observedTick','availableTick','validUntilTick','trajectory'],p+'.forecast');
    const observed=integer(forecast.observedTick,p+'.observedTick'),available=integer(forecast.availableTick,p+'.availableTick'),until=integer(forecast.validUntilTick,p+'.validUntilTick');
    if(observed>available||available>now||until<now)fail('INVALID_INPUT',p+'.unavailableOrExpiredForecast');
    const trajectory=forecast.trajectory as Forecast['trajectory'];
    const flight=readFlight(trajectory,trajectory?.parameters?.ticksPerSecond,p+'.forecast.trajectory');
    if(flight.start.tick>observed||flight.parameters.ticksPerSecond<=0)fail('INVALID_INPUT',p+'.forecast.clock');
    const repertoire=readBattingRepertoireValues(v.repertoire,p+'.repertoire');
    return {decisionTick:now,aggression,geometry:g as Geometry,motor:motor as Motor,repertoire,forecast:{observedTick:observed,availableTick:available,validUntilTick:until,trajectory:flight}};
}
/** Validated pure preparation boundary. No score, emotion acceptance, actual
 * trajectory, contact outcome or execution receipt is accepted as a shortcut. */
export function calculateObservedBattingMotorPlanV1(raw:unknown):EmotionResult<BattingMotorPlanV1> {
  return attempt(()=>planBattingMotorV1(readObservedBattingMotorInputV1(raw)));
}
