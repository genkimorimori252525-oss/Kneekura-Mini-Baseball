import { expect, it } from 'vitest';
import { AUTHORED_OBSERVED_DIRECTION_MOTOR_V153, validateObservedDirectionMotorV153, createDirectionMotorPredictionV153, limitDirectionExecutionV153 } from './LiveDirectionMotorV153';
import { createReferenceBatKinematicsV1, type ReferenceBatKinematicsInputV1 } from '../../core/sim/contact/ReferenceBatKinematicsV1';

it('canonicalizes an explicit policy and rejects hidden settings', () => {
  expect(validateObservedDirectionMotorV153({sourceId:'test',version:'observed_direction_motor_v153'})).toEqual({version:'observed_direction_motor_v153',sourceId:'test'});
  expect(Object.isFrozen(validateObservedDirectionMotorV153(AUTHORED_OBSERVED_DIRECTION_MOTOR_V153))).toBe(true);
  for(const raw of [null,{...AUTHORED_OBSERVED_DIRECTION_MOTOR_V153,seed:1},{...AUTHORED_OBSERVED_DIRECTION_MOTOR_V153,sourceId:''}])
    expect(()=>validateObservedDirectionMotorV153(raw)).toThrow(/direction motor/);
});

it('slows an over-limit actual motor after planning while retaining its spatial path and known hold', () => {
  const q={w:1,x:0,y:0,z:0},input:ReferenceBatKinematicsInputV1={provenance:{clipId:'synthetic-limit',sourceSha256:'a'.repeat(64)},
    frames:[0,100000,200000].map((tick,i)=>({tick,grip:{x:i*.5,y:1,z:0},orientation:q})),
    batLengthM:1,sweetSpotT:.8,sourceTicksPerSecond:1e6,startTick:1_200_000,ticksPerSecond:1e6,playbackRate:1,
    executionInterpolationV122:'cubic-c1',executionEnvelopeV133:{version:'reference_bat_envelope_v133',sourceId:'test-fixed-hold',
      preparation:{durationSeconds:.1,grip:{x:-.1,y:1,z:0},orientation:q},recovery:{durationSeconds:.1,grip:{x:1.1,y:1,z:0},orientation:q}},
    transform:{rotation:q,translation:{x:0,y:0,z:0},scale:1}},before=structuredClone(input),
    limited=limitDirectionExecutionV153(input,{maximumSweetSpotSpeedMps:3}),motion=createReferenceBatKinematicsV1(limited.reference),
    original=createReferenceBatKinematicsV1(input);
  expect(limited.temporalScale).toBeGreaterThan(0);expect(limited.temporalScale).toBeLessThan(1);
  expect(motion.maximumSweetSpotSpeedMps).toBeLessThanOrEqual(3);
  expect(limited.reference.frames).toEqual(input.frames);expect(limited.reference.transform).toEqual(input.transform);
  expect(motion.sampleContinuous(1_000_000).state.pose).toEqual(original.sampleContinuous(1_000_000).state.pose);
  expect(motion.sampleAtSourceTick(100000).sweetSpot).toEqual(original.sampleAtSourceTick(100000).sweetSpot);
  expect(input).toEqual(before);
});

it('transports only the observed derivative to the perceived arrival anchor', () => {
  const rawPrediction={position:{x:0,y:1,z:.15},arrivalAfterReleaseSeconds:.4,estimatedVelocity:{x:1,y:-2,z:-35},estimatedAcceleration:{x:2,y:-10,z:4}};
  const input={rawPrediction,perceivedPosition:{x:.1,y:.9,z:.15},perceivedArrivalSeconds:.5,originTick:1_000_000,ticksPerSecond:1_000_000,availableTick:1_140_000};
  const before=structuredClone(input),p=createDirectionMotorPredictionV153(input)!;
  expect(p.anchorTick).toBe(1_500_000);expect(p.position).toEqual(input.perceivedPosition);
  expect(p.availableTick).toBe(1_140_000);
  expect(p.velocity.x).toBeCloseTo(1.2,12);expect(p.velocity.y).toBe(-3);expect(p.velocity.z).toBeCloseTo(-34.6,12);
  expect(p.acceleration).toEqual(rawPrediction.estimatedAcceleration);expect(input).toEqual(before);
  expect(createDirectionMotorPredictionV153({...input,rawPrediction:null})).toBeNull();
});
