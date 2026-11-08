import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {simulateLivePitchV1,type LivePitchInputV1} from './LivePitchV1';
import {LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,LIVE_MATCH_PHYSICS_V1} from './LiveBaseballMatchV1';
import {AUTHORED_OBSERVED_DIRECTION_MOTOR_V153 as motorPolicy} from './LiveDirectionMotorV153';
import {AUTHORED_LIVE_BATTER_OBSERVATION_V151 as observationPolicy} from './LiveBatterObservationV151';
import {AUTHORED_PLAY_RANDOMNESS_V152 as playPolicy} from '../../core/rng/LiveRandomStreamsV152';

// Authored integration control, not the private player's profile or willingness.
const clips=JSON.parse(readFileSync('docs/demos/measured-bat-motions.json','utf8')).clips;
const fixture=():LivePitchInputV1=>({originTick:1_000_000,seed:31,randomnessV152:playPolicy,
  batterObservationV151:observationPolicy,batterDirectionMotorV153:motorPolicy,
  battingDirectionRequestV149:{version:'batting_direction_request_v149',sourceId:'v161-reactive-control',mode:'AUTO'},
  batter:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,heightMeters:1.8,bats:'R',maximumSweetSpotSpeedMps:50,
    targetSweetSpotSpeedMps:30,motorLatencySeconds:.04,zoneJudgmentStdMeters:.02,
    swingDecision:{approach:'SWING',threshold:0,aggressionWeight:1},
    swingPolicyV121:{version:'swing_policy_v121',sourceId:'SYNTHETIC_V161_POLICY',effort:.8,compactness:.3,
      controlPriority:.5,effortVariation:.1,twoStrikeEffortDelta:-.2,twoStrikeCompactnessDelta:.4,
      maximumClockAccelerationPerSecond:40}},
  pitcher:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,commandStdMeters:.06,minimumSpinRatio:.8},measuredClips:clips,
  batting:'balanced',pitchType:'fastball',location:'zone',physics:LIVE_MATCH_PHYSICS_V1});

it('gives explicit unconfigured AUTO an observed contact plan while retaining a reactive intent without an angle target',()=>{
  const source=fixture(),before=structuredClone(source),result=simulateLivePitchV1(source),motor=result.diagnostics.directionMotorV153!;
  expect(result.diagnostics.swingOffered).toBe(true);
  expect(result.diagnostics.battingDirectionV149!.direction).toMatchObject({kind:'REACTIVE',aim:null,pullAngleDegrees:null,fieldAngleDegrees:null});
  expect(motor.status).toBe('PLANNED');
  expect(motor.nominalPlan).toMatchObject({version:'observed_reactive_registration_v161',nominalIntent:'REACTIVE',nominalFieldAngleDegrees:null,residualDegrees:null});
  const plan = motor.nominalPlan;
  if (!plan || plan.version !== 'observed_reactive_registration_v161') throw new Error('expected V161 nominal plan');
  expect(plan.predictedContact).not.toBeNull();
  expect(motor.executionErrorsAppliedAfterPlan).toBe(true);
  expect(source).toEqual(before);
});

it('keeps the complete reactive nominal plan fixed when only execution errors change',()=>{
  const source=fixture(),first=simulateLivePitchV1(source),changed=simulateLivePitchV1({...source,
    randomnessV152:{...playPolicy,overrides:{batterExecution:12345}}});
  expect(first.diagnostics.directionMotorV153!.status).toBe('PLANNED');
  expect(changed.diagnostics.directionMotorV153!.nominalPlan).toStrictEqual(first.diagnostics.directionMotorV153!.nominalPlan);
  expect(changed.diagnostics.aimErrorMeters).not.toEqual(first.diagnostics.aimErrorMeters);
  expect(changed.frames.map(frame=>frame.bat)).not.toEqual(first.frames.map(frame=>frame.bat));
  expect(changed.sampleBatAtTick(source.originTick)).toStrictEqual(first.sampleBatAtTick(source.originTick));
},30_000);

it('retains the existing physical route when the direction request is omitted',()=>{
  const {battingDirectionRequestV149:_request,...source}=fixture(),{batterDirectionMotorV153:_policy,...control}=source,
    one=simulateLivePitchV1(source),two=simulateLivePitchV1(control);
  expect(one.diagnostics.directionMotorV153).toMatchObject({status:'NOT_APPLIED',reason:'REACTIVE_NO_ANGLE_TARGET',nominalPlan:null});
  expect(one.frames).toStrictEqual(two.frames);
  expect(one.contact).toStrictEqual(two.contact);
  expect(one.contactMoment).toStrictEqual(two.contactMoment);
});
