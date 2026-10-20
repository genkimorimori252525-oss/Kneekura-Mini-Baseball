import { expect, it } from 'vitest';
import { createReferenceBatKinematicsV1, type ReferenceBatKinematicsInputV1 } from './ReferenceBatKinematicsV1';
import { DEFAULT_IMPACT_TRAJECTORY_V1, DEFAULT_WHOLE_ARC_TRAJECTORY_V1, createImpactAdjustedReferenceMotionV1, validateImpactTrajectorySettingsV1,
  withReferenceImpactTrajectoryV1 } from './ReferenceBatImpactTrajectoryV1';
import { IDENTITY_QUATERNION, quaternionFromAxisAngle, rotateVectorByQuaternion } from '../pitching/BaseballOrientation';
import type { Vec3 } from '../../model/geometry';

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

const tiltedReference = (side: number): ReferenceBatKinematicsInputV1 => {
  const input = reference(side);
  return { ...input, playbackRate: 1.7,
    frames: input.frames.map((f, i) => ({ ...f, grip: { ...f.grip, y: f.grip.y + i * .04 },
      orientation: quaternionFromAxisAngle({ x: 0, y: 0, z: 1 }, .25 * Math.sin(i / 40 * Math.PI)) })),
    transform: { rotation: quaternionFromAxisAngle({ x: 0, y: 1, z: 0 }, .35), translation: { x: 1, y: .2, z: 2 }, scale: 1.25 } };
};
const expectVectorNear = (actual: Vec3, expected: Vec3) => {
  for (const key of ['x', 'y', 'z'] as const) expect(actual[key]).toBeCloseTo(expected[key], 10);
};

it('sets absolute down/level/upper contact angles for both sides, including target zero on an originally tilted arc', () => {
  for (const side of [1, -1]) for (const level of [1, 2, 3, 4] as const) {
    const input = tiltedReference(side), base = createReferenceBatKinematicsV1(input),
      changed = createReferenceBatKinematicsV1(withReferenceImpactTrajectoryV1(input, 200_000, { ...DEFAULT_WHOLE_ARC_TRAJECTORY_V1, level })),
      original = base.sampleAtSourceTick(200_000), contact = changed.sampleAtSourceTick(200_000), v = contact.sweetSpotVelocity;
    expect(Math.atan2(original.sweetSpotVelocity.y, Math.hypot(original.sweetSpotVelocity.x, original.sweetSpotVelocity.z))).not.toBe(0);
    expect(Math.atan2(v.y, Math.hypot(v.x, v.z)) * 180 / Math.PI).toBeCloseTo(DEFAULT_WHOLE_ARC_TRAJECTORY_V1.angleDegreesByLevel[level - 1], 10);
    expect(contact.sweetSpot).toEqual(original.sweetSpot);
    expect(contact.tick).toBe(original.tick); expect(contact.sourceTick).toBe(original.sourceTick);
    expect(norm(v)).toBeCloseTo(norm(original.sweetSpotVelocity), 10);
    expect(changed.sampleAtSourceTick(0).state.pose).not.toEqual(base.sampleAtSourceTick(0).state.pose);
    expect(changed.sampleAtSourceTick(400_000).state.pose).not.toEqual(base.sampleAtSourceTick(400_000).state.pose);
  }
});
it('applies one rigid rotation to the entire arc and analytic derivatives while retaining every speed bound and source datum', () => {
  const input = tiltedReference(-1), before = JSON.stringify(input), base = createReferenceBatKinematicsV1(input),
    changed = createReferenceBatKinematicsV1(withReferenceImpactTrajectoryV1(input, 200_000, DEFAULT_WHOLE_ARC_TRAJECTORY_V1)),
    contact = base.sampleAtSourceTick(200_000), pivot = contact.sweetSpot, v = contact.sweetSpotVelocity,
    h = Math.hypot(v.x, v.z), axis = { x: -v.z / h, y: 0, z: v.x / h }, theta = -Math.atan2(v.y, h);
  // Independent Rodrigues rotation checks the global transform without using
  // the production quaternion construction or the production adjusted samples.
  const rotate = (p: Vec3): Vec3 => {
    const c = Math.cos(theta), sine = Math.sin(theta), dot = axis.x * p.x + axis.y * p.y + axis.z * p.z;
    return { x: p.x * c + (axis.y * p.z - axis.z * p.y) * sine + axis.x * dot * (1 - c),
      y: p.y * c + (axis.z * p.x - axis.x * p.z) * sine + axis.y * dot * (1 - c),
      z: p.z * c + (axis.x * p.y - axis.y * p.x) * sine + axis.z * dot * (1 - c) };
  };
  const point = (p: Vec3) => { const r = rotate(difference(p, pivot)); return { x: pivot.x + r.x, y: pivot.y + r.y, z: pivot.z + r.z }; };
  for (const tick of [0, 10_000, 77_123.25, 100_000, 199_999.75, 200_000, 260_000, 333_777.125, 400_000, 500_000]) {
    for (const side of ['incoming', 'outgoing'] as const) {
      const a = base.sampleAtSourceTick(tick, side), b = changed.sampleAtSourceTick(tick, side);
      expectVectorNear(b.state.pose.grip, point(a.state.pose.grip)); expectVectorNear(b.state.pose.tip, point(a.state.pose.tip));
      expectVectorNear(b.sweetSpot, point(a.sweetSpot)); expectVectorNear(b.state.linearVelocity, rotate(a.state.linearVelocity));
      expectVectorNear(b.state.angularVelocity, rotate(a.state.angularVelocity)); expectVectorNear(b.sweetSpotVelocity, rotate(a.sweetSpotVelocity));
      for (const basis of [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }])
        expectVectorNear(rotateVectorByQuaternion(basis, b.orientation), rotate(rotateVectorByQuaternion(basis, a.orientation)));
      expect(norm(difference(b.state.pose.tip, b.state.pose.grip))).toBeCloseTo(base.batLengthM, 10);
      expect(norm(b.sweetSpotVelocity)).toBeCloseTo(norm(a.sweetSpotVelocity), 10);
      expect(norm(b.state.linearVelocity)).toBeCloseTo(norm(a.state.linearVelocity), 10);
      expect(norm(b.state.angularVelocity)).toBeCloseTo(norm(a.state.angularVelocity), 10);
      expect(b.tick).toBe(a.tick); expect(b.sourceTick).toBe(a.sourceTick);
    }
  }
  for (const key of ['maximumSweetSpotSpeedUpperBoundMps', 'maximumSweetSpotSpeedMps', 'maximumGripSpeedMps', 'maximumAngularSpeedRadPerSecond'] as const)
    expect(changed[key]).toBe(base[key]);
  const at = changed.sampleAtSourceTick(177_123.25), dt = .1, a = changed.sampleContinuous(at.tick - dt), b = changed.sampleContinuous(at.tick + dt), d = difference(b.sweetSpot, a.sweetSpot);
  expect(norm(difference({ x: d.x * 1e6 / (2 * dt), y: d.y * 1e6 / (2 * dt), z: d.z * 1e6 / (2 * dt) }, at.sweetSpotVelocity))).toBeLessThan(1e-7);
  expect(changed.sample(Math.round(at.tick))).toEqual(changed.sampleContinuous(Math.round(at.tick)));
  expect(() => changed.sample(at.tick)).toThrow(/observation tick/);
  expect(JSON.stringify(input)).toBe(before);
});
it('admits short measured clips without a local window and keeps legacy JSON validation strict', () => {
  const original = tiltedReference(1), input = { ...original, frames: original.frames.slice(0, 11) },
    whole = withReferenceImpactTrajectoryV1(input, 50_000, DEFAULT_WHOLE_ARC_TRAJECTORY_V1);
  expect(() => createReferenceBatKinematicsV1(whole)).not.toThrow();
  expect(() => createReferenceBatKinematicsV1(withReferenceImpactTrajectoryV1(input, 50_000, { ...DEFAULT_IMPACT_TRAJECTORY_V1, level: 4 }))).toThrow(/window/);
  expect(DEFAULT_IMPACT_TRAJECTORY_V1).not.toHaveProperty('method');
  expect(validateImpactTrajectorySettingsV1(JSON.parse(JSON.stringify(DEFAULT_IMPACT_TRAJECTORY_V1)))).toEqual(DEFAULT_IMPACT_TRAJECTORY_V1);
  expect(validateImpactTrajectorySettingsV1(JSON.parse(JSON.stringify(DEFAULT_WHOLE_ARC_TRAJECTORY_V1)))).toEqual(DEFAULT_WHOLE_ARC_TRAJECTORY_V1);
  for (const method of ['whole-arc-offset', 'local-offset', '', null])
    expect(() => validateImpactTrajectorySettingsV1({ ...DEFAULT_IMPACT_TRAJECTORY_V1, method })).toThrow(/impact trajectory/);
  expect(() => validateImpactTrajectorySettingsV1({ ...DEFAULT_IMPACT_TRAJECTORY_V1, method: undefined })).toThrow(/inert data/);
  expect(() => createReferenceBatKinematicsV1({ ...whole, impactTrajectory: { ...whole.impactTrajectory!, method: 'invented' } } as unknown as ReferenceBatKinematicsInputV1)).toThrow(/impact trajectory/);
});
