import { describe, expect, it } from 'vitest';
import {
  planDefenderRoute,
} from './DefenderRoutePlan';

const calibration = {
  maximumLateralDetourMeters: 3,
} as const;

describe('DefenderRoutePlan', () => {
  it('uses a direct route at full efficiency', () => {
    expect(planDefenderRoute({
      start: { x: 0, z: 0 },
      target: { x: 10, z: 0 },
      routeEfficiency: 1,
      preferredSide: 1,
      calibration,
    })).toEqual({
      start: { x: 0, z: 0 },
      target: { x: 10, z: 0 },
      waypoints: [{ x: 10, z: 0 }],
      directDistanceMeters: 10,
      plannedDistanceMeters: 10,
      lateralDetourMeters: 0,
    });
  });

  it('adds a deterministic perpendicular detour as efficiency falls', () => {
    const result = planDefenderRoute({
      start: { x: 0, z: 0 },
      target: { x: 10, z: 0 },
      routeEfficiency: 0,
      preferredSide: 1,
      calibration,
    });

    expect(result.waypoints).toEqual([
      { x: 5, z: 3 },
      { x: 10, z: 0 },
    ]);
    expect(result.lateralDetourMeters).toBe(3);
    expect(result.plannedDistanceMeters)
      .toBeGreaterThan(result.directDistanceMeters);
  });

  it('changes approach side without changing total route length', () => {
    const left = planDefenderRoute({
      start: { x: 1, z: 2 },
      target: { x: 9, z: 6 },
      routeEfficiency: 0.4,
      preferredSide: -1,
      calibration,
    });
    const right = planDefenderRoute({
      start: { x: 1, z: 2 },
      target: { x: 9, z: 6 },
      routeEfficiency: 0.4,
      preferredSide: 1,
      calibration,
    });

    expect(left.plannedDistanceMeters)
      .toBeCloseTo(right.plannedDistanceMeters, 12);
    expect(left.waypoints[0]).not.toEqual(
      right.waypoints[0],
    );
  });

  it('does not alter the final target point', () => {
    const result = planDefenderRoute({
      start: { x: -4, z: 8 },
      target: { x: 11, z: 19 },
      routeEfficiency: 0.2,
      preferredSide: 1,
      calibration,
    });

    expect(result.waypoints.at(-1))
      .toEqual({ x: 11, z: 19 });
  });

  it('rejects invalid efficiency, side, and calibration', () => {
    expect(() => planDefenderRoute({
      start: { x: 0, z: 0 },
      target: { x: 1, z: 0 },
      routeEfficiency: 1.1,
      preferredSide: 1,
      calibration,
    })).toThrow(
      'routeEfficiency must be finite and within [0, 1]',
    );

    expect(() => planDefenderRoute({
      start: { x: 0, z: 0 },
      target: { x: 1, z: 0 },
      routeEfficiency: 0.5,
      preferredSide: 0 as 1,
      calibration,
    })).toThrow(
      'preferredSide must be -1 or 1',
    );

    expect(() => planDefenderRoute({
      start: { x: 0, z: 0 },
      target: { x: 1, z: 0 },
      routeEfficiency: 0.5,
      preferredSide: 1,
      calibration: {
        maximumLateralDetourMeters: -1,
      },
    })).toThrow(
      'maximumLateralDetourMeters must be finite and non-negative',
    );
  });
});
