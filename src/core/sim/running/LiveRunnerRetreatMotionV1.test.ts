import { expect, it } from 'vitest';
import { createLiveRunnerRetreatMotionV1 } from './LiveRunnerRetreatMotionV1';
const bases = { 1: { x: 0, z: 0 }, 2: { x: 27.432, z: 0 }, 3: { x: 27.432, z: 27.432 }, 4: { x: 0, z: 27.432 } };
it('brakes actual outward momentum before reversing and physically retouches origin', () => {
  const motion = createLiveRunnerRetreatMotionV1({ position: { x: 12, z: 0 }, velocity: { x: 6, z: 0 },
    bases, originBase: 1, lastTouchedBase: 1, topSpeedMps: 8, accelerationMps2: 5 })!;
  expect(motion.sampleAtElapsedSeconds(0)).toMatchObject({ position: { x: 12, z: 0 }, velocity: { x: 6, z: 0 } });
  expect(motion.sampleAtElapsedSeconds(.3).velocity.x).toBeCloseTo(3.3, 12);
  expect(motion.sampleAtElapsedSeconds(2 / 3).velocity.x).toBe(0);
  expect(motion.sampleAtElapsedSeconds(.8).velocity.x).toBeLessThan(0);
  expect(motion.touches.at(-1)!.base).toBe(1);
  expect(motion.sampleAtElapsedSeconds(motion.durationSeconds)).toMatchObject({ position: bases[1], velocity: { x: 0, z: 0 } });
});
it('records an actually crossed bag during braking before returning through passed bases in reverse order', () => {
  const motion = createLiveRunnerRetreatMotionV1({ position: { x: 26, z: 0 }, velocity: { x: 6, z: 0 },
    bases, originBase: 1, lastTouchedBase: 1, topSpeedMps: 8, accelerationMps2: 5 })!;
  expect(motion.touches.map(t => t.base)).toEqual([2, 2, 1]);
  expect(motion.touches[0].elapsedSeconds).toBeLessThan(2 / 3);
  expect(motion.touches[1].elapsedSeconds).toBeGreaterThan(2 / 3);
});
it('returns a previously scoring runner through third and second before first', () => {
  const motion = createLiveRunnerRetreatMotionV1({ position: bases[4], velocity: { x: 0, z: 0 },
    bases, originBase: 1, lastTouchedBase: 4, topSpeedMps: 8, accelerationMps2: 5 })!;
  expect(motion.touches.map(t => t.base)).toEqual([3, 2, 1]);
});
it('preserves continuous position and velocity at the stopping join, within configured speed and longitudinal braking limits', () => {
  const motion = createLiveRunnerRetreatMotionV1({ position: { x: 12, z: 1 }, velocity: { x: 6, z: 1 },
    bases, originBase: 1, lastTouchedBase: 1, topSpeedMps: 8, accelerationMps2: 5 })!, join = Math.hypot(6, 1) / 9,
    before = motion.sampleAtElapsedSeconds(join - 1e-7), after = motion.sampleAtElapsedSeconds(join + 1e-7);
  expect(Math.hypot(before.position.x - after.position.x, before.position.z - after.position.z)).toBeLessThan(1e-10);
  expect(Math.hypot(before.velocity.x - after.velocity.x, before.velocity.z - after.velocity.z)).toBeLessThan(1.5e-6);
  for (let t = 0; t < motion.durationSeconds; t += .017) expect(motion.sampleAtElapsedSeconds(t).speedMps).toBeLessThanOrEqual(8 + 1e-12);
  for (let t = .01; t < join; t += .017) {
    const a = motion.sampleAtElapsedSeconds(t - .001).velocity, b = motion.sampleAtElapsedSeconds(t + .001).velocity;
    expect(Math.hypot(b.x - a.x, b.z - a.z) / .002).toBeCloseTo(9, 9);
  }
});

it('uses authored braking and inverts distance and time through the stop and return', () => {
  const motion = createLiveRunnerRetreatMotionV1({ position: { x: 12, z: 0 }, velocity: { x: 6, z: 0 },
    bases, originBase: 1, lastTouchedBase: 1, topSpeedMps: 8, accelerationMps2: 5, brakingMps2: 3 })!;
  expect(motion.speedSegments[0].accelerationMps2).toBe(-3);
  expect(motion.sampleAtElapsedSeconds(1)).toMatchObject({ position: { x: 16.5, z: 0 }, velocity: { x: 3, z: 0 } });
  expect(motion.sampleAtElapsedSeconds(2)).toMatchObject({ position: { x: 18, z: 0 }, velocity: { x: 0, z: 0 } });
  for (let t = .01; t < motion.durationSeconds; t += .037)
    expect(motion.elapsedSecondsAtDistanceMeters(motion.sampleAtElapsedSeconds(t).distanceMeters)).toBeCloseTo(t, 8);
});
