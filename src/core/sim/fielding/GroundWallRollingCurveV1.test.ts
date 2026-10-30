import { expect, it } from 'vitest';
import { createGroundWallRollingCurveV1 } from './GroundWallRollingCurveV1';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';
import type { AeroGroundBallPhysicsV1 } from '../ball/VersionedBattedBallPhysics';

const fixture = () => {
  const physics: AeroGroundBallPhysicsV1 = { kind: 'aero_ground_v1', air: { ticksPerSecond: 1e6, integrationStepTicks: 4000,
    gravityY: -9.81, aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground: { ticksPerSecond: 1e6, gravityMps2: 9.81,
    radiusM: .0366, inertiaRatio: .378, restingVerticalSpeedMps: .15, material: { restitution: .4, slidingFriction: .25,
      rollingDecelerationMps2: 1, normalSpinDecayPerSecond: .5 } } };
  const originTick = 100_000, elapsedSeconds = .125, radius = physics.ground.radiusM;
  return { initial: { originTick, elapsedSeconds, ball: { tick: originTick + 125_000,
    position: { x: 0, y: radius, z: 10 }, velocity: { x: 2, y: 0, z: 0 }, spin: { x: 0, y: 3, z: -2 / radius } } },
    throughElapsedSeconds: elapsedSeconds + 3, profile: physics, fenceCenter: { x: 0, y: 0, z: 0 }, nominalContactRadiusMeters: 10,
    maximumCompressionMeters: .002 };
};
it('keeps the actual adopted position and rolls around the supported curved wall using ground friction', () => {
  const input = fixture(), curve = createGroundWallRollingCurveV1(input), r = curve.evaluateAt(input.initial.elapsedSeconds + 1);
  expect(curve.kind).toBe('compliant_ground_wall_arc_source_v1');
  expect(curve.evaluateAt(input.initial.elapsedSeconds).moment).toEqual(input.initial);
  expect(r.moment.ball.position.x).toBeCloseTo(10 * Math.sin(.15), 11);
  expect(r.moment.ball.position.z).toBeCloseTo(10 * Math.cos(.15), 11);
  expect(Math.hypot(r.moment.ball.velocity.x, r.moment.ball.velocity.z)).toBeCloseTo(1, 12);
  expect(Math.hypot(r.moment.ball.position.x, r.moment.ball.position.z)).toBeCloseTo(10, 12);
  expect(curve.evaluateAt(input.initial.elapsedSeconds + 2).phase).toBe('resting');
  expect(curve.support.radialCoordinateCorrected).toBe(false);
  expect(curve).not.toHaveProperty('descriptor');
});
it('preserves explicit physical wall compression and phase across observation partitions', () => {
  const original = fixture(), input = { ...original, initial: { ...original.initial, ball: { ...original.initial.ball,
    position: { ...original.initial.ball.position, z: 10.001 } } } }, before = JSON.stringify(input);
  const full = createGroundWallRollingCurveV1(input), split = createGroundWallRollingCurveV1(input);
  split.evaluateAt(.4); split.evaluateAt(.8);
  expect(split.evaluateAt(1.25)).toEqual(full.evaluateAt(1.25));
  expect(full.support.signedGapMeters).toBe(10 - 10.001);
  expect(full.evaluateAt(input.initial.elapsedSeconds).moment.ball.position).toEqual(input.initial.ball.position);
  expect(JSON.stringify(input)).toBe(before);
});
it('refuses separated or excessively compressed balls, missing floor contact, and a radial moving basis', () => {
  const input = fixture();
  for (const position of [{ x: 0, y: input.profile.ground.radiusM, z: 9.999 }, { x: 0, y: input.profile.ground.radiusM, z: 10.01 },
    { x: 0, y: input.profile.ground.radiusM + .0001, z: 10 }])
    expect(() => createGroundWallRollingCurveV1({ ...input, initial: { ...input.initial, ball: { ...input.initial.ball, position } } })).toThrow();
  expect(() => createGroundWallRollingCurveV1({ ...input, initial: { ...input.initial,
    ball: { ...input.initial.ball, velocity: { x: 2, y: 0, z: -.01 } } } })).toThrow();
});
it('keeps the public basis, cells and both cached and freshly evaluated samples immutable', () => {
  const curve = createGroundWallRollingCurveV1(fixture()), before = curve.evaluateAt(1.234567);
  expect(() => Object.assign(curve.initial.ball.position, { z: 5 })).toThrow();
  expect(() => Object.assign(curve.cells[0], { maximumPositionSpeedMps: 999 })).toThrow();
  expect(() => Object.assign(curve.evaluateAt(.125).moment.ball.velocity, { x: 999 })).toThrow();
  expect(() => Object.assign(before.moment.ball.spin, { y: 999 })).toThrow();
  expect(curve.evaluateAt(1.234567)).toEqual(before);
});
