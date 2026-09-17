import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../../model/geometry';
import type { RunnerMotionState } from './RunnerMotion';
import type { RunnerRoute } from './RunnerRoute';
import {
  sampleRunnerPhysicalTouchPoint,
  type RunnerBodyContactParameters,
} from './RunnerBodyContact';

const v = (x: number, z: number): Vec2 => ({ x, z });

const route: RunnerRoute = {
  segments: [{ kind: 'line', start: v(0, 0), end: v(20, 0) }],
};

const parameters: RunnerBodyContactParameters = {
  uprightLeadMeters: 0.25,
  slideLeadMeters: 1.2,
};

const motion = (
  overrides: Partial<RunnerMotionState> = {},
): RunnerMotionState => ({
  tick: 2_000_000,
  routeDistanceMeters: 5,
  speedMps: 4,
  driveDirection: 1,
  bodyMode: 'upright',
  ...overrides,
});

describe('sampleRunnerPhysicalTouchPoint', () => {
  it('projects an upright runner to a leading foot contact point rather than the body center', () => {
    expect(sampleRunnerPhysicalTouchPoint(motion(), route, parameters)).toEqual({
      kind: 'foot',
      routeDistanceMeters: 5.25,
      position: v(5.25, 0),
      velocity: v(4, 0),
    });
  });

  it('projects a sliding runner farther forward to a leading hand contact point', () => {
    expect(
      sampleRunnerPhysicalTouchPoint(
        motion({ bodyMode: 'sliding', driveDirection: 0 }),
        route,
        parameters,
      ),
    ).toEqual({
      kind: 'hand',
      routeDistanceMeters: 6.2,
      position: v(6.2, 0),
      velocity: v(4, 0),
    });
  });

  it('places the leading contact point behind route progress when retreating', () => {
    expect(
      sampleRunnerPhysicalTouchPoint(
        motion({ speedMps: -4, driveDirection: -1 }),
        route,
        parameters,
      ),
    ).toEqual({
      kind: 'foot',
      routeDistanceMeters: 4.75,
      position: v(4.75, 0),
      velocity: v(-4, 0),
    });
  });

  it('uses route tangent at the contact point on a curved path', () => {
    const arcRoute: RunnerRoute = {
      segments: [{
        kind: 'arc',
        center: v(0, 0),
        radiusMeters: 2,
        startAngleRadians: 0,
        sweepRadians: Math.PI / 2,
      }],
    };
    const routeDistanceMeters = Math.PI / 2 - 0.25;
    const result = sampleRunnerPhysicalTouchPoint(
      motion({ routeDistanceMeters, speedMps: 3 }),
      arcRoute,
      parameters,
    );

    expect(result.kind).toBe('foot');
    expect(result.routeDistanceMeters).toBeCloseTo(Math.PI / 2, 12);
    expect(result.position.x).toBeCloseTo(Math.SQRT2, 12);
    expect(result.position.z).toBeCloseTo(Math.SQRT2, 12);
    expect(result.velocity.x).toBeCloseTo(-3 * Math.SQRT1_2, 12);
    expect(result.velocity.z).toBeCloseTo(3 * Math.SQRT1_2, 12);
  });

  it('does not silently clamp a physical contact point beyond the finite route', () => {
    expect(() => sampleRunnerPhysicalTouchPoint(
      motion({ routeDistanceMeters: 19.9, speedMps: 4 }),
      route,
      parameters,
    )).toThrow('distanceMeters must lie on the runner route');
  });
});
