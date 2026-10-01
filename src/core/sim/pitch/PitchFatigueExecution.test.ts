import { expect, it } from 'vitest';
import { applyPitchFatigueToExecution } from './PitchFatigueExecution';
import { createCanonicalPitchRelease, createPitchTrajectoryFromRelease } from './CanonicalPitchRelease';
import { resolveTakenPitchPhysicalResult } from '../pitching/TakenPitchPhysicalResult';

const policy = { policyId: 'fixture-response', version: 'v1', availableAtDay: 1,
  motionDurationScaleAtFullFatigue: 1.5, velocityRetentionAtFullFatigue: 0.5, spinRetentionAtFullFatigue: 0.75 };
const timing = { baseStartIntervalUs: 10_000_000, normalMotionToReleaseUs: 600_000, followThroughUs: 200_000,
  quickSpeedFactor: 1.8, cadenceExecutionControl: 0.8, cadenceTimingKnowledge: 0.8, quickRepeatability: 0.8, naturalVariationUs: 50_000,
  normalPhaseWeights: { gather: 2, transition: 3, stride: 5 }, quickPhaseWeights: { gather: 1, transition: 2, stride: 3 } };
const physics = { velocity: { x: 0, y: 0, z: -30 }, spin: { x: 0, y: 100, z: 0 } };
it('preserves fresh execution and derives slower physical motion and plate crossing from fatigue', () => {
  const fresh = applyPitchFatigueToExecution(timing, physics, 0, policy, 10);
  expect(fresh).toEqual({ timingProfile: timing, physics });
  const tired = applyPitchFatigueToExecution(timing, physics, 0.6, policy, 10);
  expect(tired.timingProfile.normalMotionToReleaseUs).toBe(780_000);
  expect(tired.timingProfile.followThroughUs).toBe(260_000);
  expect(tired.physics.velocity.z).toBe(-21); expect(tired.physics.spin.y).toBe(85);
  const crossed = [fresh, tired].map((execution) => resolveTakenPitchPhysicalResult({
    trajectory: createPitchTrajectoryFromRelease(createCanonicalPitchRelease({ releaseUs: 0 },
      { x: 0, y: 1.5, z: 18 }, execution.physics), { x: 0, y: 0, z: 0 }, 1_500_000),
    plateZ: 0, strikeZone: { centerX: 0, halfWidth: 0.2, lowerY: 1.4, upperY: 1.6 }, ballRadiusMeters: 0.0366 }));
  expect(crossed[1]!.crossing.tick).toBeGreaterThan(crossed[0]!.crossing.tick);
  expect(crossed.map((result) => result!.kind)).toEqual(['called_strike', 'called_strike']);
  expect(timing.normalMotionToReleaseUs).toBe(600_000); expect(physics.velocity.z).toBe(-30);
});
it('rejects invalid fatigue, future/invalid response calibration, unsafe durations and malformed physics', () => {
  for (const fatigue of [-0.1, 1.1, Number.NaN]) expect(() => applyPitchFatigueToExecution(timing, physics, fatigue, policy, 10)).toThrow();
  for (const bad of [{ ...policy, availableAtDay: 11 }, { ...policy, motionDurationScaleAtFullFatigue: 0.9 },
    { ...policy, velocityRetentionAtFullFatigue: -1 }, { ...policy, spinRetentionAtFullFatigue: 1.1 },
    { ...policy, extra: 1 }]) expect(() => applyPitchFatigueToExecution(timing, physics, 0.5, bad, 10)).toThrow();
  expect(() => applyPitchFatigueToExecution(timing, physics, 1, { ...policy, motionDurationScaleAtFullFatigue: Number.MAX_VALUE }, 10)).toThrow();
  expect(() => applyPitchFatigueToExecution(timing, { ...physics, velocity: { x: 0, y: 0, z: Number.NaN } }, 0.5, policy, 10)).toThrow();
});
