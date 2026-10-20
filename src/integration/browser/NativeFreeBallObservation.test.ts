import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { createCanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { resolveAndRecordAerodynamicRigidPitchAgainstBatter, type AerodynamicRigidPitchAgainstBatterInput } from '../../core/sim/pitching/AerodynamicRigidPitchAgainstBatter';
import { REALISTIC_BASEBALL_RIGID_BODY } from '../../core/sim/contact/RigidBatBallContact';
import { REFERENCE_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { observeNativeAerodynamicPitch } from './NativeAerodynamicObserver';
import { observeNativeFreeBallContinuation } from './NativeFreeBallObservation';

function fixture() {
  const before = createCanonicalPlateAppearanceTimeline({ ruleProfileId: asRuleProfileId('npb-2026'),
    inning: 1, half: 'top', outs: 0, balls: 0, strikes: 0, bases: { first: null, second: null, third: null },
    score: { away: 0, home: 0 }, playId: 7 }, 0);
  const parameters = { ticksPerSecond: 1_000_000, integrationStepTicks: 1_000, gravityY: -9.81,
    aerodynamics: REFERENCE_BASEBALL_AERODYNAMICS };
  const pitch: AerodynamicRigidPitchAgainstBatterInput = {
    trajectory: { start: { tick: 1_000, position: { x: 0, y: 1, z: 0.2 },
      velocity: { x: 0, y: 0, z: -60 }, spin: { x: 30, y: 90, z: 10 } }, endTick: 7_000, parameters },
    action: { kind: 'swing', swing: { startTick: 1_000, endTick: 7_000, ticksPerSecond: 1_000_000,
      stateAtStart: { pose: { grip: { x: -0.42, y: 1, z: 0 }, tip: { x: 0.42, y: 1, z: 0 } },
        linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 } },
      physical: { massKg: 0.9, centerOfMassT: 0.6, transverseMomentOfInertiaKgM2: 0.06,
        axialMomentOfInertiaKgM2: 0.00055, radiusProfile: { knots: [{ t: 0, radiusM: 0.033 }, { t: 1, radiusM: 0.033 }] } } } },
    ball: REALISTIC_BASEBALL_RIGID_BODY,
    parameterResolver: () => ({ normalRestitution: 0.5, tangentialRestitution: 0.3, frictionCoefficient: 0.2 }),
  };
  const resolution = resolveAndRecordAerodynamicRigidPitchAgainstBatter(before, pitch);
  const observation = observeNativeAerodynamicPitch({ timelineBefore: before, pitch, resolution,
    batterHandedness: 'L', pitcherHandedness: 'R', actorsAtTick: () => ({ defenders: [], runners: [] }) });
  const ground = { radiusM: parameters.aerodynamics.ballRadiusM, inertiaRatio: REALISTIC_BASEBALL_RIGID_BODY.rotationalInertiaFactor,
    gravityMps2: -parameters.gravityY, ticksPerSecond: parameters.ticksPerSecond, restingVerticalSpeedMps: 0.15,
    material: { restitution: 0.4, slidingFriction: 0.3, rollingDecelerationMps2: 0.8, normalSpinDecayPerSecond: 0.5 } };
  if (!observation.rigidContact) throw new Error('real contact fixture required');
  return { observation, aerodynamics: parameters, ground, throughTick: observation.rigidContact.tick + 8_000_000 };
}

it('connects genuine rigid impact to real aero/ground motion and preserves the official pending boundary', () => {
  const input = fixture(), before = JSON.stringify(input.observation);
  const result = observeNativeFreeBallContinuation(input);
  expect(result.samples[0].ball.velocity).toEqual(input.observation.rigidContact!.exitVelocity);
  expect(result.samples[0].ball.spin).toEqual(input.observation.rigidContact!.exitSpin);
  expect(result.samples[0].orientation).toEqual(input.observation.spinFrames.at(-1)!.orientationMaterialToWorld);
  expect(result.groundContacts.length).toBeGreaterThan(0);
  expect(result.requiresOfficialLiveBallResolution).toBe(true);
  expect(result.officialResult).toBeNull();
  expect(JSON.stringify(input.observation)).toBe(before);
});

it('rejects altered canonical impact or fabricated contact orientation rather than depicting a different ball', () => {
  const input = fixture();
  const altered = { ...input.observation, rigidContact: { ...input.observation.rigidContact!,
    exitVelocity: { ...input.observation.rigidContact!.exitVelocity, x: input.observation.rigidContact!.exitVelocity.x + 1 } } };
  expect(() => observeNativeFreeBallContinuation({ ...input, observation: altered })).toThrow();
  expect(() => observeNativeFreeBallContinuation({ ...input, orientationAtContact: { w: 1, x: 0, y: 0, z: 0 } })).toThrow();
});
