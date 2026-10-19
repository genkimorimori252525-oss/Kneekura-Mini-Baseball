import { expect, it } from 'vitest';
import { createReferenceBatKinematicsV1, type ReferenceBatKinematicsInputV1 } from './ReferenceBatKinematicsV1';
import { DEFAULT_IMPACT_TRAJECTORY_V1, createImpactAdjustedReferenceMotionV1, validateImpactTrajectorySettingsV1,
  withReferenceImpactTrajectoryV1 } from './ReferenceBatImpactTrajectoryV1';
import { IDENTITY_QUATERNION } from '../pitching/BaseballOrientation';

const reference = (side = 1): ReferenceBatKinematicsInputV1 => ({
  provenance: { clipId: 'obp-research-test', sourceSha256: '1'.repeat(64) },
  frames: Array.from({ length: 41 }, (_, i) => ({ tick: i * 10_000,
    grip: { x: side * (i / 100 - .2) * 5, y: .8, z: (i / 100 - .2) * 15 }, orientation: IDENTITY_QUATERNION })),
  batLengthM: .84, sweetSpotT: .8, sourceTicksPerSecond: 1e6, startTick: 1e6, ticksPerSecond: 1e6, playbackRate: 1,
  transform: { rotation: IDENTITY_QUATERNION, translation: { x: 1, y: 0, z: 2 }, scale: 1 },
});
const norm = (v: { x: number; y: number; z: number }) => Math.hypot(v.x, v.y, v.z);
const difference = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const motion = (level: 1 | 2 | 3 | 4 = 4, side = 1) => {
  const input = reference(side), base = createReferenceBatKinematicsV1(input),
    adjustedInput = withReferenceImpactTrajectoryV1(input, 200_000, { ...DEFAULT_IMPACT_TRAJECTORY_V1, level });
  return { input, base, adjusted: createImpactAdjustedReferenceMotionV1(adjustedInput, base), adjustedInput };
};

it('omission and zero-angle controls retain the identical legacy motion object and all samples', () => {
  const { input, base, adjusted } = motion(2);
  expect(adjusted).toBe(base); expect(createImpactAdjustedReferenceMotionV1(input, base)).toBe(base);
  for (const at of [0, 1e6, 1_100_001.25, 1_200_000, 1_260_000, 1_500_000]) expect(adjusted.sampleContinuous(at)).toEqual(base.sampleContinuous(at));
});
it('keeps every pose and derivative exactly unchanged outside its compact measured-clock window', () => {
  const { base, adjusted } = motion();
  for (const at of [0, 1e6, 1_099_999.125, 1_100_000, 1_260_000, 1_260_000.125, 1_400_000, 2e6])
    expect(adjusted.sampleContinuous(at)).toEqual(base.sampleContinuous(at));
  for (const at of [100_000, 260_000]) for (const side of ['incoming','outgoing'] as const)
    expect(adjusted.sampleAtSourceTick(at,side)).toEqual(base.sampleAtSourceTick(at,side));
});
it('preserves contact time/sweet spot, rigid length, and original input while raising/lowering incoming motion', () => {
  for (const side of [1, -1]) for (const level of [1, 3, 4] as const) {
    const { input, base, adjusted } = motion(level, side), before = JSON.stringify(input), original = base.sampleAtSourceTick(200_000), at = adjusted.sampleAtSourceTick(200_000);
    expect(at.tick).toBe(original.tick); expect(at.sourceTick).toBe(original.sourceTick); expect(at.sweetSpot).toEqual(original.sweetSpot);
    const attack = Math.atan2(at.sweetSpotVelocity.y, Math.hypot(at.sweetSpotVelocity.x, at.sweetSpotVelocity.z)) * 180 / Math.PI;
    expect(attack).toBeCloseTo(DEFAULT_IMPACT_TRAJECTORY_V1.angleDegreesByLevel[level - 1], 10);
    expect(Math.sign(at.sweetSpotVelocity.x)).toBe(side);
    for (let t = 1_101_000; t < 1_260_000; t += 1_337) {
      const s = adjusted.sampleContinuous(t);
      expect(norm(difference(s.state.pose.tip, s.state.pose.grip))).toBeCloseTo(.84, 12);
    }
    expect(JSON.stringify(input)).toBe(before);
  }
});
it('uses analytic velocities, with continuous position/velocity/acceleration at window boundaries', () => {
  const { base, adjusted } = motion();
  for (const t of [1_100_100, 1_135_313.5, 1_199_999, 1_200_000, 1_240_011, 1_259_900]) {
    const dt = .5, a = adjusted.sampleContinuous(t - dt), b = adjusted.sampleContinuous(t + dt), at = adjusted.sampleContinuous(t),
      finiteVelocity = difference(b.sweetSpot, a.sweetSpot);
    expect(norm(difference({ x: finiteVelocity.x * 1e6 / (2 * dt), y: finiteVelocity.y * 1e6 / (2 * dt), z: finiteVelocity.z * 1e6 / (2 * dt) }, at.sweetSpotVelocity))).toBeLessThan(1e-6);
  }
  for (const t of [1_100_000, 1_260_000]) {
    const dt = .1, a = adjusted.sampleContinuous(t - dt), b = adjusted.sampleContinuous(t + dt), original = base.sampleContinuous(t);
    expect(norm(difference(a.sweetSpotVelocity, original.sweetSpotVelocity))).toBeLessThan(1e-6);
    expect(norm(difference(b.sweetSpotVelocity, original.sweetSpotVelocity))).toBeLessThan(1e-6);
    expect(norm(difference(a.sweetSpotVelocity, b.sweetSpotVelocity)) * 1e6 / (2 * dt)).toBeLessThan(.01);
  }
});
it('bounds the entire transformed speed, supports fractional sampling and scales the measured window with playback rate', () => {
  const { adjusted } = motion();
  // The real integration path constructs its base with the same playback rate.
  const fastBaseInput = { ...reference(), playbackRate: 2 }, fastBase = createReferenceBatKinematicsV1(fastBaseInput),
    fast = createImpactAdjustedReferenceMotionV1(withReferenceImpactTrajectoryV1(fastBaseInput, 200_000, { ...DEFAULT_IMPACT_TRAJECTORY_V1, level: 4 }), fastBase);
  for (let t = 1_100_000.125; t < 1_260_000; t += 31.337) {
    const s = adjusted.sampleContinuous(t);
    expect(norm(s.sweetSpotVelocity)).toBeLessThanOrEqual(adjusted.maximumSweetSpotSpeedMps);
    expect(norm(s.state.linearVelocity)).toBeLessThanOrEqual(adjusted.maximumGripSpeedMps);
    expect(norm(s.state.angularVelocity)).toBeLessThanOrEqual(adjusted.maximumAngularSpeedRadPerSecond);
  }
  expect(fast.sampleContinuous(1_050_000)).toEqual(fastBase.sampleContinuous(1_050_000));
  expect(fast.sampleContinuous(1_130_000)).toEqual(fastBase.sampleContinuous(1_130_000));
  expect(fast.maximumSweetSpotSpeedMps).toBeCloseTo(adjusted.maximumSweetSpotSpeedMps * 2, 8);
});
it('rejects malformed controls, unmeasured windows, non-horizontal contact and invalid contact clocks', () => {
  for (const patch of [{ level: 0 }, { level: 5 }, { angleDegreesByLevel: [-10, 0, 10] }, { angleDegreesByLevel: [-10, 0, 10, NaN] },
    { angleDegreesByLevel: [-10, 0, 10, 31] }, { beforeSeconds: 0 }, { afterSeconds: .31 }, { invented: true }])
    expect(() => validateImpactTrajectorySettingsV1({ ...DEFAULT_IMPACT_TRAJECTORY_V1, ...patch })).toThrow();
  const { input, base } = motion();
  expect(() => withReferenceImpactTrajectoryV1(input, NaN, DEFAULT_IMPACT_TRAJECTORY_V1)).toThrow(/contact source/);
  expect(() => createImpactAdjustedReferenceMotionV1(withReferenceImpactTrajectoryV1(input, 50_000, { ...DEFAULT_IMPACT_TRAJECTORY_V1, level: 4 }), base)).toThrow(/window/);
  expect(() => createImpactAdjustedReferenceMotionV1(withReferenceImpactTrajectoryV1(input, 500_000, DEFAULT_IMPACT_TRAJECTORY_V1), base)).toThrow(/contact lies/);
  let invoked=false;
  expect(()=>withReferenceImpactTrajectoryV1(Object.defineProperty({...input},'frames',{enumerable:true,get(){invoked=true;return input.frames;}}),200_000,DEFAULT_IMPACT_TRAJECTORY_V1)).toThrow(/accessors/);
  expect(invoked).toBe(false);
});
