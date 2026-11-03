import assert from 'node:assert/strict';
import { test } from 'vitest';
import { fixture, value } from './BattingFixtures.test-support';
import { measuredFixture } from './MeasuredBattingFixtures.test-support';
import { prepareBattingExecution } from './BattingCommitment';
import { calculateObservedBattingMotorPlanV1, type BattingMotorPlanInputV1 } from './BattingMotorPlanV1';

function input(measured=true):BattingMotorPlanInputV1 {
  const r=measured?measuredFixture():fixture(),s=r.source,p=s.predictions[1];
  return {decisionTick:r.currentFrame.time.tick,aggression:r.acceptedExecution.proposal.inputs.swingAggression,
    geometry:{handedness:s.handedness,centerOfMass:s.centerOfMass,batPhysical:s.batPhysical,plateZ:s.plateZ,
      strikeZone:s.strikeZone,bodyReadyTick:s.bodyReadyTick,latestMotorStartTick:s.latestMotorStartTick},
    motor:{motorLatencyTicks:s.motorLatencyTicks,technicalTimingOffsetTicks:s.technicalTimingOffsetTicks,maximumSweetSpotSpeedMps:s.maximumSweetSpotSpeedMps},
    repertoire:{repertoireId:s.repertoireId,repertoireVersion:s.repertoireVersion,profiles:s.profiles,...(s.sampledProfiles?{sampledProfiles:s.sampledProfiles}:{})},
    forecast:{observedTick:p.observedTick,availableTick:p.availableTick,validUntilTick:p.validUntilTick,trajectory:p.trajectory}};
}

for(const measured of [true,false])test(`observed motor preparation shares actual ${measured?'measured':'legacy'} execution timing/geometry without choosing an action`,()=>{
  const i=input(measured),before=structuredClone(i),result=value(calculateObservedBattingMotorPlanV1(i));
  assert.equal(result.status,'READY');if(result.status!=='READY')assert.fail();
  const commitment=value(prepareBattingExecution(measured?measuredFixture():fixture())).commitment!;
  const {action,decisionTick,predictionId,adjustedSwingScore,...motion}=commitment;
  assert.deepEqual(result.motion,motion);assert.deepEqual(i,before);assert.ok(Object.isFrozen(result.motion));
  assert.equal(Object.hasOwn(result,'action'),false);
});

test('motor preparation refuses unavailable/expired perception and actual-flight or score shortcuts',()=>{
  for(const patch of [
    (i:any)=>i.forecast.availableTick=i.decisionTick+1,
    (i:any)=>i.forecast.validUntilTick=i.decisionTick-1,
    (i:any)=>i.forecast.observedTick=i.forecast.availableTick+1,
    (i:any)=>i.actualTrajectory=i.forecast.trajectory,
    (i:any)=>i.forecast.swingScore=1,
    (i:any)=>i.aggression=1.1,
    (i:any)=>i.motor.motorLatencyTicks=0,
    (i:any)=>i.geometry.batPhysical.massKg=-1,
    (i:any)=>i.geometry.strikeZone.upperY=i.geometry.strikeZone.lowerY,
    (i:any)=>i.geometry.handedness='L',
  ]){const i=structuredClone(input());patch(i);assert.equal(calculateObservedBattingMotorPlanV1(i).ok,false);}
});

test('delayed motor onset keeps original keys and registration, and missed deadline produces no trajectory',()=>{
  const i=structuredClone(input()),a=value(calculateObservedBattingMotorPlanV1(i));assert.equal(a.status,'READY');if(a.status!=='READY')assert.fail();
  Object.assign(i.geometry,{bodyReadyTick:a.motion.motorStartTick!+30000});
  const b=value(calculateObservedBattingMotorPlanV1(i));if(b.status!=='READY')assert.fail();
  assert.equal(b.motion.motorDelayTicks,30000);assert.deepEqual(b.motion.sampledTrajectoryV1!.frames,a.motion.sampledTrajectoryV1!.frames);
  assert.deepEqual(b.motion.sampledTrajectoryV1!.transform,a.motion.sampledTrajectoryV1!.transform);
  Object.assign(i.geometry,{latestMotorStartTick:b.motion.motorStartTick!-1});
  assert.deepEqual(value(calculateObservedBattingMotorPlanV1(i)),{status:'MOTOR_WINDOW_MISSED',motion:null});
});

test('measured motor preparation rejects speed excess instead of rescaling original motion',()=>{
  const i=structuredClone(input());Object.assign(i.motor,{maximumSweetSpotSpeedMps:1});
  assert.equal(calculateObservedBattingMotorPlanV1(i).ok,false);
});
