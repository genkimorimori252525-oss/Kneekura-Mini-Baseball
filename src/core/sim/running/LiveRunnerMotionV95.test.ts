import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../../model/geometry';
import { createLiveRunnerMotionV1, type LiveRunnerMotionInputV1, type LiveRunnerMotionV1 } from './LiveRunnerMotionV1';
import { createLiveLocomotionProfileV84, liveAccelerationDistanceV84, liveAccelerationTimeV84 } from '../locomotion/LiveLocomotionV84';
import { getRunnerRouteLength } from './RunnerRoute';

const v = (x: number, z: number): Vec2 => ({ x, z });
const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
const input = (patch: Partial<LiveRunnerMotionInputV1> = {}): LiveRunnerMotionInputV1 => ({
  position: v(0, 0), bases: [{ base: 1, position: v(27.432, 0) }],
  topSpeedMps: 8, accelerationMps2: 5, brakingMps2: 9,
  terminalMode: 'first-base-overrun', ...patch,
});
const motion = (patch: Partial<LiveRunnerMotionInputV1> = {}): LiveRunnerMotionV1 => {
  const result = createLiveRunnerMotionV1(input(patch)); expect(result).not.toBeNull(); return result!;
};

describe('first-base physical overrun V95', () => {
  it('reaches the bag disk at the propulsion time, and brakes only after crossing its center', () => {
    const m = motion(), bag = input().bases[0].position, touch = m.touches[0];
    const profile = createLiveLocomotionProfileV84(input());
    const accelerationDistance = liveAccelerationDistanceV84(profile, 0, 8);
    const expected = liveAccelerationTimeV84(profile, 0, 8) + (27.432 - .28 - accelerationDistance) / 8;
    expect(touch.elapsedSeconds).toBeCloseTo(expected, 10);
    expect(distance(touch.position, bag)).toBeLessThanOrEqual(.28);
    expect(distance(m.sampleAtElapsedSeconds(touch.elapsedSeconds - 1e-7).position, bag)).toBeGreaterThan(.28);
    expect(m.sampleAtElapsedSeconds(touch.elapsedSeconds).speedMps).toBeCloseTo(8, 10);
    expect(m.speedSegments.filter(s => s.startElapsedSeconds < touch.centerElapsedSeconds - 1e-10)
      .every(s => s.accelerationMps2 >= 0)).toBe(true);
    expect(touch.elapsedSeconds).toBeLessThan(createLiveRunnerMotionV1(input({ terminalMode: 'stop' }))!.touches[0].elapsedSeconds);
  });

  it('moves beyond first, dissipates real velocity, reverses at zero speed, and returns to the bag', () => {
    const m = motion(), phases = m.firstBaseOverrunV95!;
    expect(phases).toBeDefined();
    expect(phases.overrunDistanceMeters).toBeCloseTo(8 ** 2 / 18, 10);
    expect(phases.brakingEndElapsedSeconds - phases.baseCenterElapsedSeconds).toBeCloseTo(8 / 9, 10);
    expect(phases.returnStartElapsedSeconds).toBe(phases.brakingEndElapsedSeconds);
    expect(phases.returnEndElapsedSeconds).toBe(m.durationSeconds);
    expect(m.lengthMeters).toBeCloseTo(27.432 + 2 * 8 ** 2 / 18, 10);
    expect(getRunnerRouteLength(m.route)).toBeCloseTo(m.lengthMeters, 10);
    const braking = m.sampleAtElapsedSeconds(phases.baseCenterElapsedSeconds + .25);
    expect(braking.position.x).toBeGreaterThan(27.432);
    expect(braking.velocity.x).toBeCloseTo(8 - 9 * .25, 10);
    expect(m.sampleAtElapsedSeconds(phases.brakingEndElapsedSeconds).position).toEqual(phases.stopPosition);
    expect(m.sampleAtElapsedSeconds(phases.brakingEndElapsedSeconds).speedMps).toBeCloseTo(0, 10);
    expect(m.sampleAtElapsedSeconds(phases.brakingEndElapsedSeconds + .1).velocity.x).toBeLessThan(0);
    expect(distance(m.sampleAtElapsedSeconds(phases.returnTouchElapsedSeconds).position, input().bases[0].position)).toBeLessThanOrEqual(.28);
    expect(m.sampleAtElapsedSeconds(m.durationSeconds + 10)).toMatchObject({ position: v(27.432, 0), velocity: v(0, 0), speedMps: 0 });
    expect(m.touches).toHaveLength(2);
    const returned = m.touches[1];
    expect(returned.base).toBe(1);
    expect(returned.elapsedSeconds).toBe(phases.returnTouchElapsedSeconds);
    expect(returned.centerElapsedSeconds).toBe(m.durationSeconds);
    expect(returned.centerDistanceMeters).toBe(m.lengthMeters);
    expect(distance(returned.position, input().bases[0].position)).toBeLessThanOrEqual(.28);
    expect(distance(m.sampleAtElapsedSeconds(returned.elapsedSeconds - 1e-7).position, input().bases[0].position)).toBeGreaterThan(.28);
  });

  it('has continuous actual position and velocity at every speed and reversal boundary', () => {
    const m = motion();
    for (const s of m.speedSegments) {
      const t = s.endElapsedSeconds;
      const before = m.sampleAtElapsedSeconds(t - 1e-7), at = m.sampleAtElapsedSeconds(t), after = m.sampleAtElapsedSeconds(t + 1e-7);
      expect(distance(before.position, after.position)).toBeLessThan(2e-6);
      expect(distance(before.velocity, after.velocity)).toBeLessThan(2e-6);
      expect(distance(at.position, before.position)).toBeLessThan(1e-6);
    }
    for (let t = .001; t < m.durationSeconds; t += .031) {
      expect(m.elapsedSecondsAtDistanceMeters(m.sampleAtElapsedSeconds(t).distanceMeters)).toBeCloseTo(t, 7);
    }
  });

  it('does not manufacture a re-entry when a short overrun never leaves the base disk', () => {
    const m = motion({ bases: [{ base: 1, position: v(.5, 0) }] });
    expect(m.firstBaseOverrunV95!.overrunDistanceMeters).toBeLessThan(.28);
    expect(m.touches).toHaveLength(1);
  });

  it('retains incoming movement, both approach sides, translation and ability differences', () => {
    for (const sign of [-1, 1]) {
      const start = v(2, sign * .8), bag = v(21.397, 19.397), direction = { x: bag.x - start.x, z: bag.z - start.z };
      const scale = 3 / Math.hypot(direction.x, direction.z), velocity = v(direction.x * scale, direction.z * scale);
      const m = motion({ position: start, velocity, bases: [{ base: 1, position: bag }] });
      expect(m.sampleAtElapsedSeconds(0).velocity).toEqual(velocity);
      expect(distance(m.sampleAtElapsedSeconds(m.touches[0].centerElapsedSeconds).position, bag)).toBeLessThan(1e-8);
      expect(distance(m.sampleAtElapsedSeconds(m.durationSeconds).position, bag)).toBe(0);
      for (const touch of m.touches) expect(distance(touch.position, bag)).toBeLessThanOrEqual(.28);
    }
    const slow = motion({ topSpeedMps: 6 }), weakBrake = motion({ brakingMps2: 3 });
    expect(slow.touches[0].elapsedSeconds).toBeGreaterThan(motion().touches[0].elapsedSeconds);
    expect(weakBrake.touches[0].elapsedSeconds).toBeCloseTo(motion().touches[0].elapsedSeconds, 10);
    expect(weakBrake.firstBaseOverrunV95!.overrunDistanceMeters).toBeGreaterThan(motion().firstBaseOverrunV95!.overrunDistanceMeters);
  });

  it('keeps the established stop behavior when the mode is absent or explicitly stop', () => {
    const plain = input(); delete (plain as { terminalMode?: string }).terminalMode;
    const a = createLiveRunnerMotionV1(plain)!, b = createLiveRunnerMotionV1(input({ terminalMode: 'stop' }))!;
    expect(a.route).toEqual(b.route); expect(a.speedSegments).toEqual(b.speedSegments); expect(a.touches).toEqual(b.touches);
    expect(a.firstBaseOverrunV95).toBeUndefined();
    expect(a.sampleAtElapsedSeconds(a.durationSeconds).position).toEqual(v(27.432, 0));
  });

  it('can commit to second during the overrun without replacing the current position or velocity', () => {
    const original = motion(), phases = original.firstBaseOverrunV95!;
    for (const elapsed of [phases.baseCenterElapsedSeconds + .1, phases.brakingEndElapsedSeconds - .1,
      phases.returnStartElapsedSeconds + .1]) {
      const actual = original.sampleAtElapsedSeconds(elapsed);
      const next = createLiveRunnerMotionV1(input({ position: actual.position, velocity: actual.velocity,
        bases: [{ base: 2, position: v(27.432, 27.432) }], terminalMode: 'stop' }));
      expect(next).not.toBeNull();
      expect(next!.sampleAtElapsedSeconds(0)).toMatchObject({ position: actual.position, velocity: actual.velocity });
      expect(distance(next!.sampleAtElapsedSeconds(1e-7).position, actual.position)).toBeLessThan(1e-6);
      expect(distance(next!.sampleAtElapsedSeconds(1e-7).velocity, actual.velocity)).toBeLessThan(1e-5);
      expect(next!.firstBaseOverrunV95).toBeUndefined();
    }
  });

  it('does not permit overrun to silently apply to other bags or a through-base rounding route', () => {
    expect(() => motion({ bases: [{ base: 2, position: v(27.432, 0) }] })).toThrow(/first base/);
    expect(() => motion({ bases: [{ base: 1, position: v(27.432, 0) }, { base: 2, position: v(27.432, 27.432) }] })).toThrow(/first base/);
    expect(() => motion({ terminalMode: 'anything' as 'stop' })).toThrow(/terminal mode/);
  });

  it('is deterministic, leaves input data unchanged and returns null for infeasible incoming state', () => {
    const authored = input(), before = JSON.stringify(authored), a = createLiveRunnerMotionV1(authored)!, b = createLiveRunnerMotionV1(authored)!;
    expect(a.route).toEqual(b.route); expect(a.speedSegments).toEqual(b.speedSegments); expect(a.firstBaseOverrunV95).toEqual(b.firstBaseOverrunV95);
    expect(JSON.stringify(authored)).toBe(before);
    expect(createLiveRunnerMotionV1(input({ velocity: v(9, 0) }))).toBeNull();
    // This late straight sprint is feasible because it does not manufacture a stop on the bag.
    expect(createLiveRunnerMotionV1(input({ position: v(27.3, 0), velocity: v(8, 0) }))).not.toBeNull();
  });
});
