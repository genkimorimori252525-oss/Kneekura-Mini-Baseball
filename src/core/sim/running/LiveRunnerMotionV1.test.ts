import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../../model/geometry';
import { getRunnerRouteLength, sampleRunnerRoute, type RunnerRouteSegment } from './RunnerRoute';
import { createLiveRunnerMotionV1, type LiveRunnerMotionInputV1, type LiveRunnerMotionV1 } from './LiveRunnerMotionV1';

const v = (x: number, z: number): Vec2 => ({ x, z });
const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
const length = (s: RunnerRouteSegment) => s.kind === 'line' ? distance(s.start, s.end) : s.radiusMeters * Math.abs(s.sweepRadians);
const input = (patch: Partial<LiveRunnerMotionInputV1> = {}): LiveRunnerMotionInputV1 => ({
  position: v(0, 0), bases: [{ base: 1, position: v(27.432, 0) }], topSpeedMps: 8,
  accelerationMps2: 5, roundingRadiusMeters: 4.5, lateralAccelerationMps2: 7.5, ...patch,
});
const motion = (patch: Partial<LiveRunnerMotionInputV1> = {}): LiveRunnerMotionV1 => {
  const result = createLiveRunnerMotionV1(input(patch)); expect(result).not.toBeNull(); return result!;
};

describe('LiveRunnerMotionV1', () => {
  it('uses declining propulsion bands and stronger braking for a stop-to-stop straight leg', () => {
    const m = motion();
    expect(m.lengthMeters).toBeCloseTo(27.432, 10);
    // Independently integrate the authored 0-2, 2-5.2, 5.2-8 m/s bands.
    const accelerationDistance = 2 ** 2 / 10 + (5.2 ** 2 - 2 ** 2) / 7 + (8 ** 2 - 5.2 ** 2) / 3.5;
    const accelerationTime = 2 / 5 + 3.2 / 3.5 + 2.8 / 1.75;
    expect(m.durationSeconds).toBeCloseTo(accelerationTime + (27.432 - accelerationDistance - 8 ** 2 / 18) / 8 + 8 / 9, 10);
    expect(m.sampleAtElapsedSeconds(.5).position.x).toBeCloseTo(.6175, 12);
    expect(m.sampleAtElapsedSeconds(.5).speedMps).toBeCloseTo(2.35, 12);
    expect(m.sampleAtElapsedSeconds(2).speedMps).toBeCloseTo(6.4, 12);
    expect(m.speedSegments.map(s => s.accelerationMps2)).toEqual([5, 3.5, 1.75, 0, -9]);
    expect(m.sampleAtElapsedSeconds(m.durationSeconds)).toMatchObject({ position: v(27.432, 0), velocity: v(0, 0), speedMps: 0 });
  });

  it('has a continuous route and velocity through the actual bag center', () => {
    const bag = v(27.432, 0), m = motion({ bases: [{ base: 1, position: bag }, { base: 2, position: v(27.432, 27.432) }] });
    const touch = m.touches[0], at = m.sampleAtElapsedSeconds(touch.centerElapsedSeconds);
    expect(distance(at.position, bag)).toBeLessThan(1e-8);
    expect(at.speedMps).toBeGreaterThan(0);
    expect(distance(touch.position, bag)).toBeLessThanOrEqual(.28);
    expect(touch.elapsedSeconds).toBeLessThan(touch.centerElapsedSeconds);
    const before = m.sampleAtElapsedSeconds(touch.centerElapsedSeconds - 1e-6);
    const after = m.sampleAtElapsedSeconds(touch.centerElapsedSeconds + 1e-6);
    expect(distance(before.position, after.position)).toBeLessThan(2e-5);
    expect(distance(before.velocity, after.velocity)).toBeLessThan(2e-5);
    let traversed = 0;
    for (let i = 0; i < m.route.segments.length - 1; i++) {
      traversed += length(m.route.segments[i]);
      expect(distance(sampleRunnerRoute(m.route, traversed - 1e-7).tangent,
        sampleRunnerRoute(m.route, traversed + 1e-7).tangent)).toBeLessThan(1e-6);
    }
  });

  it('caps each circular segment by lateral acceleration and stops only at the final base', () => {
    const m = motion({ bases: [{ base: 1, position: v(27.432, 0) }, { base: 2, position: v(27.432, 27.432) }, { base: 3, position: v(0, 27.432) }] });
    for (let t = 0; t < m.durationSeconds; t += .005) {
      const s = m.sampleAtElapsedSeconds(t), part = m.route.segments[sampleRunnerRoute(m.route, s.distanceMeters).segmentIndex];
      expect(s.speedMps).toBeLessThanOrEqual(8 + 1e-9);
      if (part.kind === 'arc') expect(s.speedMps ** 2 / part.radiusMeters).toBeLessThanOrEqual(7.5 + 1e-8);
    }
    for (const touch of m.touches.slice(0, -1)) expect(m.sampleAtElapsedSeconds(touch.centerElapsedSeconds).speedMps).toBeGreaterThan(0);
    expect(m.sampleAtElapsedSeconds(m.durationSeconds + 100).speedMps).toBe(0);
    expect(getRunnerRouteLength(m.route)).toBeCloseTo(m.lengthMeters, 10);
  });

  it('preserves the position and velocity when a moving runner commits a second base', () => {
    const old = motion(), now = old.sampleAtElapsedSeconds(1.8);
    const m = motion({ position: now.position, velocity: now.velocity,
      bases: [{ base: 1, position: v(27.432, 0) }, { base: 2, position: v(27.432, 27.432) }] });
    expect(m.sampleAtElapsedSeconds(0)).toMatchObject({ position: now.position, velocity: now.velocity, speedMps: now.speedMps, distanceMeters: 0 });
    const justAfter = m.sampleAtElapsedSeconds(1e-7);
    expect(distance(justAfter.position, now.position)).toBeLessThan(1e-6);
    expect(distance(justAfter.velocity, now.velocity)).toBeLessThan(1e-5);
  });

  it('works for both turn directions and translated, rotated diamonds', () => {
    for (const sign of [-1, 1]) {
      const origin = v(3, -4), bag = v(3 + 19.397, -4 + 19.397), target = v(bag.x - sign * 19.397, bag.z + sign * 19.397);
      const m = motion({ position: origin, bases: [{ base: 1, position: bag }, { base: 2, position: target }] });
      expect(distance(m.sampleAtElapsedSeconds(m.touches[0].centerElapsedSeconds).position, bag)).toBeLessThan(1e-8);
      expect(m.sampleAtElapsedSeconds(m.durationSeconds).position).toEqual(target);
    }
  });

  it('rejects infeasible immediate braking rather than resetting current speed', () => {
    expect(createLiveRunnerMotionV1(input({ position: v(27.3, 0), velocity: v(8, 0) }))).toBeNull();
  });

  it('does not loop past future bags or accept a late looping turn commitment', () => {
    const first = v(27.432, 0), second = v(27.432, 27.432);
    const m = motion({ bases: [{ base: 1, position: first }, { base: 2, position: second }] });
    expect(m.lengthMeters).toBeLessThan(2 * 27.432 + 4.5);
    for (let t = 0; t < m.touches[0].centerElapsedSeconds; t += .01) {
      expect(distance(m.sampleAtElapsedSeconds(t).position, second)).toBeGreaterThan(.28);
    }
    expect(createLiveRunnerMotionV1(input({ position: v(27.4, 0), velocity: v(8, 0),
      bases: [{ base: 1, position: first }, { base: 2, position: second }] }))).toBeNull();
  });

  it('uses authored radius/lateral ability to cap turning without changing run acceleration', () => {
    const bases = [{ base: 1, position: v(27.432, 0) }, { base: 2, position: v(27.432, 27.432) }];
    const tight = motion({ bases, roundingRadiusMeters: 1, lateralAccelerationMps2: 2 });
    const wide = motion({ bases, roundingRadiusMeters: 4, lateralAccelerationMps2: 2 });
    expect(tight.sampleAtElapsedSeconds(tight.touches[0].centerElapsedSeconds).speedMps).toBeCloseTo(Math.sqrt(2), 8);
    expect(wide.sampleAtElapsedSeconds(wide.touches[0].centerElapsedSeconds).speedMps).toBeCloseTo(Math.sqrt(8), 8);
    for (const m of [tight, wide]) for (const s of m.speedSegments)
      expect([0, 5, 3.5, 1.75, -9]).toContain(s.accelerationMps2);
  });

  it('keeps short triangular stop legs and arbitrary moving headings continuous', () => {
    const short = motion({ bases: [{ base: 1, position: v(1, 0) }] });
    const peak = Math.sqrt((1 - .4 + 4 / 7) / (1 / 7 + 1 / 18));
    expect(short.durationSeconds).toBeCloseTo(.4 + (peak - 2) / 3.5 + peak / 9, 10);
    const m = motion({ velocity: v(3, 1) });
    const first = m.sampleAtElapsedSeconds(1e-7);
    expect(distance(first.velocity, v(3, 1))).toBeLessThan(1e-5);
    expect(distance(first.position, v(0, 0))).toBeLessThan(1e-6);
  });

  it('is deterministic and does not mutate authored inputs', () => {
    const authored = input({ velocity: v(2, 0), bases: [{ base: 1, position: v(27.432, 0) }, { base: 2, position: v(27.432, 27.432) }] });
    const before = JSON.stringify(authored), a = createLiveRunnerMotionV1(authored)!, b = createLiveRunnerMotionV1(authored)!;
    expect(a.route).toEqual(b.route);
    expect(a.speedSegments).toEqual(b.speedSegments);
    expect(a.touches).toEqual(b.touches);
    expect(JSON.stringify(authored)).toBe(before);
  });

  it('honors explicit braking and retains acceleration and speed ability differences', () => {
    const authored = motion({ brakingMps2: 3 });
    expect(authored.speedSegments.at(-1)!.accelerationMps2).toBe(-3);
    expect(authored.durationSeconds).toBeGreaterThan(motion().durationSeconds);
    expect(motion({ accelerationMps2: 3 }).durationSeconds).toBeGreaterThan(motion().durationSeconds);
    expect(motion({ topSpeedMps: 6 }).durationSeconds).toBeGreaterThan(motion().durationSeconds);
  });

  it('inverts finite path distance and time throughout acceleration, cruise and braking', () => {
    const m = motion({ bases: [{ base: 1, position: v(27.432, 0) }, { base: 2, position: v(27.432, 27.432) }] });
    for (let t = .001; t < m.durationSeconds; t += .037) {
      expect(m.elapsedSecondsAtDistanceMeters(m.sampleAtElapsedSeconds(t).distanceMeters)).toBeCloseTo(t, 8);
    }
    expect(() => m.sampleAtElapsedSeconds(Number.NaN)).toThrow(/finite/);
    expect(() => m.elapsedSecondsAtDistanceMeters(-1)).toThrow(/finite route/);
  });

  it('keeps derived rotated velocities inside their scalar cap and replans without boundary exceptions', () => {
    for (let degrees = 0; degrees < 360; degrees += 5) {
      const radians = degrees * Math.PI / 180, cosine = Math.cos(radians), sine = Math.sin(radians),
        rotate = (x: number, z: number) => v(3 + cosine * x - sine * z, -4 + sine * x + cosine * z),
        bases = [{ base: 1, position: rotate(100, 0) }, { base: 2, position: rotate(100, 100) }],
        m = motion({ position: rotate(0, 0), bases });
      for (const elapsed of [4, m.touches[0].centerElapsedSeconds - .2, m.touches[0].centerElapsedSeconds + .2]) {
        const sampled = m.sampleAtElapsedSeconds(elapsed);
        expect(Math.hypot(sampled.velocity.x, sampled.velocity.z)).toBeLessThanOrEqual(sampled.speedMps);
        expect(sampled.speedMps).toBeLessThanOrEqual(8);
        expect(() => createLiveRunnerMotionV1(input({ position: sampled.position, velocity: sampled.velocity,
          bases: elapsed < m.touches[0].centerElapsedSeconds ? bases : bases.slice(1) }))).not.toThrow();
      }
      const sampled = m.sampleAtElapsedSeconds(4), next = createLiveRunnerMotionV1(input({ position: sampled.position, velocity: sampled.velocity, bases }));
      expect(next).not.toBeNull();
      expect(next!.sampleAtElapsedSeconds(0).velocity).toEqual(sampled.velocity);
    }
  });

  it('retains an infeasible incoming velocity as a null result without clamping or throwing', () => {
    expect(createLiveRunnerMotionV1(input({ velocity: v(8 + 2 * Number.EPSILON * 8, 0) }))).toBeNull();
  });
});
