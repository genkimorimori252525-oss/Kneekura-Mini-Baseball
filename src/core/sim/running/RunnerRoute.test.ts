import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../../model/geometry';
import {
  getRunnerRouteLength,
  sampleRunnerRoute,
  type RunnerRoute,
} from './RunnerRoute';

const v = (x: number, z: number): Vec2 => ({ x, z });

describe('RunnerRoute', () => {
  it('samples position and unit tangent on a straight route', () => {
    const route: RunnerRoute = {
      segments: [{ kind: 'line', start: v(0, 0), end: v(3, 4) }],
    };

    expect(getRunnerRouteLength(route)).toBeCloseTo(5, 12);
    expect(sampleRunnerRoute(route, 2.5)).toEqual({
      position: v(1.5, 2),
      tangent: v(0.6, 0.8),
      segmentIndex: 0,
      distanceMeters: 2.5,
    });
  });

  it('rejects sampling outside the finite authoritative route instead of clamping', () => {
    const route: RunnerRoute = {
      segments: [{ kind: 'line', start: v(0, 0), end: v(5, 0) }],
    };

    expect(() => sampleRunnerRoute(route, -0.001)).toThrow('distanceMeters must lie on the runner route');
    expect(() => sampleRunnerRoute(route, 5.001)).toThrow('distanceMeters must lie on the runner route');
  });

  it('samples a quarter-circle base-rounding arc analytically', () => {
    const route: RunnerRoute = {
      segments: [{
        kind: 'arc',
        center: v(0, 0),
        radiusMeters: 2,
        startAngleRadians: 0,
        sweepRadians: Math.PI / 2,
      }],
    };

    const total = getRunnerRouteLength(route);
    const sample = sampleRunnerRoute(route, total / 2);

    expect(total).toBeCloseTo(Math.PI, 12);
    expect(sample.position.x).toBeCloseTo(Math.SQRT2, 12);
    expect(sample.position.z).toBeCloseTo(Math.SQRT2, 12);
    expect(sample.tangent.x).toBeCloseTo(-Math.SQRT1_2, 12);
    expect(sample.tangent.z).toBeCloseTo(Math.SQRT1_2, 12);
  });

  it('supports a continuous line-arc-line route through a rounded base path', () => {
    const route: RunnerRoute = {
      segments: [
        { kind: 'line', start: v(0, 0), end: v(3, 0) },
        {
          kind: 'arc',
          center: v(2, 0),
          radiusMeters: 1,
          startAngleRadians: 0,
          sweepRadians: Math.PI / 2,
        },
        { kind: 'line', start: v(2, 1), end: v(1, 1) },
      ],
    };

    const arcStart = sampleRunnerRoute(route, 3);
    const arcEnd = sampleRunnerRoute(route, 3 + Math.PI / 2);
    const afterArc = sampleRunnerRoute(route, 3 + Math.PI / 2 + 0.5);

    expect(arcStart.position.x).toBeCloseTo(3, 12);
    expect(arcStart.position.z).toBeCloseTo(0, 12);
    expect(arcEnd.position.x).toBeCloseTo(2, 12);
    expect(arcEnd.position.z).toBeCloseTo(1, 12);
    expect(afterArc.position.x).toBeCloseTo(1.5, 12);
    expect(afterArc.position.z).toBeCloseTo(1, 12);
    expect(afterArc.tangent).toEqual(v(-1, 0));
  });

  it('rejects discontinuous route segments', () => {
    const route: RunnerRoute = {
      segments: [
        { kind: 'line', start: v(0, 0), end: v(1, 0) },
        { kind: 'line', start: v(1.01, 0), end: v(2, 0) },
      ],
    };

    expect(() => getRunnerRouteLength(route)).toThrow('runner route segments must be continuous');
  });
});
