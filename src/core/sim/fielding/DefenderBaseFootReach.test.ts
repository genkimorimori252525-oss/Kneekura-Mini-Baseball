import { describe, expect, it } from 'vitest';
import type { BaseTouchRegion } from '../running/BaseTouch';
import {
  findDefenderFootBaseContactTick,
} from './DefenderBaseContact';
import type {
  DefenderBodyKinematicsSegment,
} from './DefenderBodyKinematics';
import {
  planDefenderBaseFootReachPrimitive,
} from './DefenderBaseFootReach';
import {
  sampleDefenderPhysicalPrimitiveSegment,
} from './DefenderPhysicalPrimitive';

const body: DefenderBodyKinematicsSegment = {
  startTick: 1_000_000,
  endTick: 2_000_000,
  ticksPerSecond: 1_000_000,
  startPosition: { x: 2.2, y: 1, z: 0 },
  startVelocity: { x: 0, y: 0, z: 0 },
  acceleration: { x: 0, y: 0, z: 0 },
};

const base: BaseTouchRegion = {
  center: { x: 3, z: 0 },
  halfSize: { x: 0.2, z: 0.2 },
  rotationRadians: 0,
};

const state = {
  tick: 1_000_000,
  offset: { x: 0.4, y: -1, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
} as const;

const parameters = {
  footRadiusMeters: 0.12,
  maximumLegReachMeters: 1.5,
  maxRelativeReachSpeedMps: 3,
  maxRelativeReachAccelerationMps2: 4,
} as const;

describe('DefenderBaseFootReach', () => {
  it('builds a bounded foot primitive that reaches the requested base target', () => {
    const primitive = planDefenderBaseFootReachPrimitive({
      body,
      footState: state,
      role: 'left_foot',
      targetTick: 2_000_000,
      base,
      baseLocalContactPoint: { x: 0, z: 0 },
      baseSurfaceHeightMeters: 0,
      parameters,
    });

    expect(primitive).not.toBeNull();
    expect(primitive?.role).toBe('left_foot');

    const target = sampleDefenderPhysicalPrimitiveSegment(
      primitive as NonNullable<typeof primitive>,
      2_000_000,
    );
    expect(target.center.x).toBeCloseTo(3, 12);
    expect(target.center.y).toBeCloseTo(0, 12);
    expect(target.center.z).toBeCloseTo(0, 12);
  });

  it('lets the existing base-contact solver determine first entry into the finite base', () => {
    const primitive = planDefenderBaseFootReachPrimitive({
      body,
      footState: state,
      role: 'right_foot',
      targetTick: 2_000_000,
      base,
      baseLocalContactPoint: { x: 0, z: 0 },
      baseSurfaceHeightMeters: 0,
      parameters,
    });
    if (primitive === null) {
      throw new Error('fixture must produce a reachable foot primitive');
    }

    expect(findDefenderFootBaseContactTick(
      primitive,
      base,
      0,
      primitive.startTick,
      primitive.endTick,
    )).toBe(1_707_107);
  });

  it('returns null rather than stretching beyond maximum leg reach', () => {
    expect(planDefenderBaseFootReachPrimitive({
      body,
      footState: state,
      role: 'left_foot',
      targetTick: 2_000_000,
      base: {
        ...base,
        center: { x: 5, z: 0 },
      },
      baseLocalContactPoint: { x: 0, z: 0 },
      baseSurfaceHeightMeters: 0,
      parameters,
    })).toBeNull();
  });

  it('returns null when required relative acceleration is physically unavailable', () => {
    expect(planDefenderBaseFootReachPrimitive({
      body,
      footState: state,
      role: 'left_foot',
      targetTick: 1_100_000,
      base,
      baseLocalContactPoint: { x: 0, z: 0 },
      baseSurfaceHeightMeters: 0,
      parameters: {
        ...parameters,
        maxRelativeReachAccelerationMps2: 1,
      },
    })).toBeNull();
  });

  it('returns null when terminal relative foot speed exceeds calibration', () => {
    expect(planDefenderBaseFootReachPrimitive({
      body,
      footState: state,
      role: 'left_foot',
      targetTick: 1_500_000,
      base,
      baseLocalContactPoint: { x: 0, z: 0 },
      baseSurfaceHeightMeters: 0,
      parameters: {
        ...parameters,
        maxRelativeReachSpeedMps: 0.5,
      },
    })).toBeNull();
  });

  it('rejects a requested foot target outside the finite base rectangle', () => {
    expect(() => planDefenderBaseFootReachPrimitive({
      body,
      footState: state,
      role: 'left_foot',
      targetTick: 2_000_000,
      base,
      baseLocalContactPoint: { x: 0.21, z: 0 },
      baseSurfaceHeightMeters: 0,
      parameters,
    })).toThrow(
      'baseLocalContactPoint must lie inside the base rectangle',
    );
  });
});
