import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../../model/geometry';
import { createLiveRunnerMotionV1 } from './LiveRunnerMotionV1';
import { createLiveRunnerSlideV115, type LiveRunnerSlideInputV115 } from './LiveRunnerSlideV115';

const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
const input = (patch: Partial<LiveRunnerSlideInputV115> = {}): LiveRunnerSlideInputV115 => ({
  position: { x: 0, z: 0 }, velocity: { x: 3, z: 0 }, bases: [{ base: 2, position: { x: 27.432, z: 0 } }],
  topSpeedMps: 8, accelerationMps2: 5, heightMeters: 1.8, style: 'feet_first',
  frictionCoefficient: .5, gravityMps2: 9.81, recoverySeconds: .9, ...patch,
});
const slide = (patch: Partial<LiveRunnerSlideInputV115> = {}) => {
  const result = createLiveRunnerSlideV115(input(patch));
  expect(result).not.toBeNull();
  return result!;
};

describe('LiveRunnerSlideV115', () => {
  it('inherits exact running state and dissipates speed with authored friction', () => {
    const m = slide(), running = createLiveRunnerMotionV1({ ...input(), terminalMode: 'through' })!;
    expect(m.sampleAtElapsedSeconds(0)).toEqual(running.sampleAtElapsedSeconds(0));
    const { fromSeconds, stopSeconds } = m.slideV115;
    expect(m.sampleAtElapsedSeconds(fromSeconds)).toEqual(running.sampleAtElapsedSeconds(fromSeconds));
    const launch = m.sampleAtElapsedSeconds(fromSeconds);
    for (const fraction of [.1, .4, .9, 1]) {
      const elapsed = fromSeconds + fraction * (stopSeconds - fromSeconds);
      expect(m.sampleAtElapsedSeconds(elapsed).speedMps).toBeCloseTo(Math.max(0, launch.speedMps - .5 * 9.81 * (elapsed - fromSeconds)), 10);
    }
  });

  it('touches with the real forward limb before the COM, then retains the bag through recovery', () => {
    const m = slide(), { touchSeconds, stopSeconds, recoveryEndSeconds } = m.slideV115, bag = input().bases[0].position;
    const touchBody = m.sampleBodyAtElapsedSeconds(touchSeconds);
    expect(distance(touchBody.contactPoint, bag)).toBeLessThanOrEqual(.28 + 1e-10);
    expect(distance(m.sampleBodyAtElapsedSeconds(touchSeconds - 1e-5).contactPoint, bag)).toBeGreaterThan(.28);
    expect(m.sampleAtElapsedSeconds(touchSeconds).position.x).toBeLessThan(bag.x - .28);
    expect(m.touches[0].elapsedSeconds).toBe(touchSeconds);
    expect(m.touches[0].position).toEqual(touchBody.contactPoint);
    for (const t of [touchSeconds, (touchSeconds + stopSeconds) / 2, stopSeconds, (stopSeconds + recoveryEndSeconds) / 2, recoveryEndSeconds]) {
      expect(distance(m.sampleBodyAtElapsedSeconds(t).contactPoint, bag)).toBeLessThanOrEqual(.28 + 1e-10);
    }
    expect(m.sampleBodyAtElapsedSeconds(stopSeconds + .1).phase).toBe('recover');
    expect(m.sampleBodyAtElapsedSeconds(recoveryEndSeconds).phase).toBe('stand');
    expect(m.sampleAtElapsedSeconds(recoveryEndSeconds).position).toEqual(bag);
  });

  it('keeps position, velocity, and body pose continuous at launch, stop, and recovery end', () => {
    const m = slide();
    for (const t of [m.slideV115.fromSeconds, m.slideV115.stopSeconds, m.slideV115.recoveryEndSeconds]) {
      const before = m.sampleAtElapsedSeconds(t - 1e-7), after = m.sampleAtElapsedSeconds(t + 1e-7);
      expect(distance(before.position, after.position)).toBeLessThan(2e-6);
      expect(distance(before.velocity, after.velocity)).toBeLessThan(2e-5);
      const a = m.sampleBodyAtElapsedSeconds(t - 1e-7), b = m.sampleBodyAtElapsedSeconds(t + 1e-7);
      expect(distance(a.head.position, b.head.position)).toBeLessThan(2e-6);
      expect(Math.abs(a.head.heightMeters - b.head.heightMeters)).toBeLessThan(2e-6);
      expect(distance(a.contactPoint, b.contactPoint)).toBeLessThan(2e-6);
    }
    expect(m.speedSegments.every(s => s.endElapsedSeconds > s.startElapsedSeconds)).toBe(true);
    for (const s of m.speedSegments) {
      expect(m.elapsedSecondsAtDistanceMeters(s.endDistanceMeters)).toBeCloseTo(s.endElapsedSeconds, 8);
    }
  });

  it('rejects first-base feet-first and admits first-base head-first', () => {
    const bases = [{ base: 1, position: { x: 27.432, z: 0 } }];
    expect(() => slide({ bases })).toThrow(/first base/);
    expect(slide({ bases, style: 'head_first' }).slideV115.style).toBe('head_first');
  });

  it('keeps rotated ground geometry and distance/time inversion consistent', () => {
    for (const angle of [.3, 1.2, 2.4, 4.1, 5.8]) {
      const c = Math.cos(angle), s = Math.sin(angle), origin = { x: 3, z: -4 },
        bag = { x: origin.x + c * 27.432, z: origin.z + s * 27.432 },
        m = slide({ position: origin, velocity: { x: 3 * c, z: 3 * s }, bases: [{ base: 3, position: bag }] });
      expect(m.sampleAtElapsedSeconds(0).velocity).toEqual({ x: 3 * c, z: 3 * s });
      expect(distance(m.touches[0].position, bag)).toBeLessThanOrEqual(.28);
      for (let t = .01; t < m.durationSeconds; t += .043) {
        expect(m.elapsedSecondsAtDistanceMeters(m.sampleAtElapsedSeconds(t).distanceMeters)).toBeCloseTo(t, 7);
      }
      expect(m.sampleAtElapsedSeconds(m.durationSeconds).position).toEqual(bag);
    }
  });

  it('cannot recover faster than the authored propulsion or braking envelope', () => {
    const authored = input({ recoverySeconds: .001 }), m = slide({ recoverySeconds: .001 });
    for (const segment of m.speedSegments.filter(s => s.startElapsedSeconds >= m.slideV115.stopSeconds)) {
      expect(Math.abs(segment.accelerationMps2)).toBeLessThanOrEqual(authored.accelerationMps2 + 1e-12);
    }
    expect(m.slideV115.recoveryEndSeconds - m.slideV115.stopSeconds).toBeGreaterThan(.001);
  });

  it('reports analytic body velocities including the downward launch and upward recovery', () => {
    const m = slide({ style: 'head_first' }), { fromSeconds, stopSeconds, recoveryEndSeconds, maximumBodySpeedMps } = m.slideV115;
    // Stay inside each analytic segment: the triangular recovery has a finite
    // acceleration change at its midpoint, where a centered derivative is O(dt).
    for (const elapsed of [fromSeconds + .1, stopSeconds + .4 * (recoveryEndSeconds - stopSeconds)]) {
      const dt = 1e-6, before = m.sampleBodyAtElapsedSeconds(elapsed - dt), at = m.sampleBodyAtElapsedSeconds(elapsed),
        after = m.sampleBodyAtElapsedSeconds(elapsed + dt);
      for (const part of ['hip', 'torso', 'head'] as const) {
        expect(at[part].velocity.x).toBeCloseTo((after[part].position.x - before[part].position.x) / (2 * dt), 7);
        expect(at[part].velocity.z).toBeCloseTo((after[part].position.z - before[part].position.z) / (2 * dt), 7);
        expect(at[part].heightVelocityMps).toBeCloseTo((after[part].heightMeters - before[part].heightMeters) / (2 * dt), 7);
        expect(Math.hypot(at[part].velocity.x, at[part].velocity.z, at[part].heightVelocityMps)).toBeLessThanOrEqual(maximumBodySpeedMps);
      }
    }
    expect(m.sampleBodyAtElapsedSeconds(fromSeconds + .1).head.heightVelocityMps).toBeLessThan(0);
    expect(m.sampleBodyAtElapsedSeconds((stopSeconds + recoveryEndSeconds) / 2).head.heightVelocityMps).toBeGreaterThan(0);
  });

  it('admits short stature and a .2m reach with real limb contact before COM disk entry', () => {
    for (const patch of [{ heightMeters: 1.1 }, { reachMeters: .2 }]) {
      const m = slide(patch), bag = input().bases[0].position,
        { fromSeconds, touchSeconds, stopSeconds, recoveryEndSeconds, reachMeters } = m.slideV115;
      if ('heightMeters' in patch) expect(reachMeters).toBeCloseTo(.528, 12);
      else expect(reachMeters).toBe(.2);
      expect(m.sampleAtElapsedSeconds(touchSeconds).position.x).toBeLessThan(bag.x - .28);
      expect(distance(m.sampleBodyAtElapsedSeconds(touchSeconds).contactPoint, bag)).toBeLessThanOrEqual(.28);
      const stop = m.sampleAtElapsedSeconds(stopSeconds);
      expect(stop.position.x).toBeLessThan(bag.x);
      expect(distance(stop.position, bag)).toBeLessThan(.28);
      expect(stop.speedMps).toBeCloseTo(0, 12);
      for (const t of [touchSeconds, stopSeconds, (stopSeconds + recoveryEndSeconds) / 2, recoveryEndSeconds]) {
        expect(distance(m.sampleBodyAtElapsedSeconds(t).contactPoint, bag)).toBeLessThanOrEqual(.28);
      }
      for (const t of [fromSeconds, stopSeconds, recoveryEndSeconds]) {
        const before = m.sampleAtElapsedSeconds(t - 1e-7), after = m.sampleAtElapsedSeconds(t + 1e-7);
        expect(distance(before.position, after.position)).toBeLessThan(2e-6);
        expect(distance(before.velocity, after.velocity)).toBeLessThan(2e-5);
        expect(distance(m.sampleBodyAtElapsedSeconds(t - 1e-7).contactPoint,
          m.sampleBodyAtElapsedSeconds(t + 1e-7).contactPoint)).toBeLessThan(2e-6);
      }
    }
  });

  it('preserves stature, reach, friction, and motor ability differences without mutating input', () => {
    const authored = input(), before = JSON.stringify(authored);
    createLiveRunnerSlideV115(authored);
    expect(JSON.stringify(authored)).toBe(before);
    expect(slide({ style: 'head_first' }).slideV115.reachMeters).toBeGreaterThan(slide().slideV115.reachMeters);
    expect(slide({ heightMeters: 2 }).slideV115.reachMeters).toBeGreaterThan(slide({ heightMeters: 1.5 }).slideV115.reachMeters);
    expect(slide({ reachMeters: .83 }).slideV115.reachMeters).toBe(.83);
    expect(slide({ frictionCoefficient: .3 }).slideV115.fromSeconds).toBeLessThan(slide({ frictionCoefficient: .7 }).slideV115.fromSeconds);
    expect(slide({ topSpeedMps: 6 }).slideV115.touchSeconds).toBeGreaterThan(slide({ topSpeedMps: 9 }).slideV115.touchSeconds);
    const m = slide();
    for (let t = 0; t < m.durationSeconds; t += .037) {
      const a = m.sampleBodyAtElapsedSeconds(t), b = m.sampleBodyAtElapsedSeconds(t + 1e-6);
      expect(distance(a.contactPoint, b.contactPoint) / 1e-6).toBeLessThanOrEqual(m.slideV115.maximumContactSpeedMps + 1e-5);
    }
  });

  it('rejects late stopping, incompatible headings, multiple bases, and invalid physical controls', () => {
    expect(createLiveRunnerSlideV115(input({ position: { x: 26, z: 0 }, velocity: { x: 8, z: 0 } }))).toBeNull();
    expect(createLiveRunnerSlideV115(input({ velocity: { x: 0, z: 8 } }))).toBeNull();
    expect(() => createLiveRunnerSlideV115(input({ bases: [...input().bases, { base: 3, position: { x: 0, z: 27 } }] }))).toThrow(/single/);
    for (const patch of [{ heightMeters: 0 }, { frictionCoefficient: 0 }, { gravityMps2: NaN }, { recoverySeconds: 0 }, { reachMeters: Infinity }]) {
      expect(() => createLiveRunnerSlideV115(input(patch))).toThrow(/finite positive/);
    }
  });
});
