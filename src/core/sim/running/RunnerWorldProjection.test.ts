import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../../model/geometry';
import type { RunnerMotionState } from './RunnerMotion';
import type { RunnerRoute } from './RunnerRoute';
import { projectRunnerWorldState } from './RunnerWorldProjection';

const v = (x: number, z: number): Vec2 => ({ x, z });

const motion = (overrides: Partial<RunnerMotionState> = {}): RunnerMotionState => ({
  tick: 3_000_000,
  routeDistanceMeters: 5,
  speedMps: 4,
  driveDirection: 1,
  bodyMode: 'upright',
  ...overrides,
});

describe('projectRunnerWorldState', () => {
  it('projects signed runner motion onto a straight canonical world route', () => {
    const route: RunnerRoute = {
      segments: [{ kind: 'line', start: v(0, 0), end: v(20, 0) }],
    };

    expect(projectRunnerWorldState('runner-7', motion(), route)).toEqual({
      playerId: 'runner-7',
      position: v(5, 0),
      velocity: v(4, 0),
    });
  });

  it('projects position and tangent velocity on an authoritative base-rounding arc', () => {
    const route: RunnerRoute = {
      segments: [{
        kind: 'arc',
        center: v(0, 0),
        radiusMeters: 2,
        startAngleRadians: 0,
        sweepRadians: Math.PI / 2,
      }],
    };
    const result = projectRunnerWorldState(
      'runner-8',
      motion({ routeDistanceMeters: Math.PI / 2, speedMps: 2 }),
      route,
    );

    expect(result.playerId).toBe('runner-8');
    expect(result.position.x).toBeCloseTo(Math.SQRT2, 12);
    expect(result.position.z).toBeCloseTo(Math.SQRT2, 12);
    expect(result.velocity.x).toBeCloseTo(-Math.SQRT2, 12);
    expect(result.velocity.z).toBeCloseTo(Math.SQRT2, 12);
  });

  it('normalizes signed zero in retreat velocity for stable canonical snapshots', () => {
    const route: RunnerRoute = {
      segments: [{ kind: 'line', start: v(0, 0), end: v(20, 0) }],
    };
    const result = projectRunnerWorldState(
      'runner-9',
      motion({ speedMps: -3, driveDirection: -1 }),
      route,
    );

    expect(Object.is(result.velocity.z, -0)).toBe(false);
    expect(result.velocity).toEqual(v(-3, 0));
  });
});
