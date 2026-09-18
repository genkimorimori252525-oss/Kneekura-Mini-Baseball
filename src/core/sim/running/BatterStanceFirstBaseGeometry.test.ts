import { describe, expect, it } from 'vitest';
import type { BaseTouchRegion } from './BaseTouch';
import type { RunnerBodyContactParameters } from './RunnerBodyContact';
import type {
  RunnerMotionIntent,
  RunnerMotionParameters,
  RunnerMotionState,
} from './RunnerMotion';
import { findRunnerBaseTouchTick } from './RunnerBaseTouch';
import {
  createBatterRunnerFirstBaseFrame,
  createBatterRunnerFirstBaseRoute,
  createBatterStanceGeometry,
  getBatterRunnerDistanceToFirstBase,
  resolveBatterStanceWorldPosition,
} from './BatterStanceFirstBaseGeometry';

const FEET_TO_METERS = 0.3048;
const INCHES_TO_METERS = 0.0254;
const basePathMeters = 90 * FEET_TO_METERS;
const diagonalCoordinate = basePathMeters / Math.SQRT2;

const frame = createBatterRunnerFirstBaseFrame({
  homePlateReferencePoint: { x: 0, z: 0 },
  firstBaseCenter: {
    x: diagonalCoordinate,
    z: diagonalCoordinate,
  },
  towardPitcherUnit: { x: 0, z: 1 },
  towardFirstBaseSideUnit: { x: 1, z: 0 },
  homePlateHalfWidthMeters: (17 * INCHES_TO_METERS) / 2,
});

// Representative box-center-style horizontal stance fixture:
// 6 in from plate to the box + half of a 4 ft box width.
// This is test data, not a universal player default.
const distanceOffPlateMeters = (
  6 * INCHES_TO_METERS
  + 2 * FEET_TO_METERS
);

const leftStance = createBatterStanceGeometry(
  'left',
  distanceOffPlateMeters,
  0.45,
);
const rightStance = createBatterStanceGeometry(
  'right',
  distanceOffPlateMeters,
  0.45,
);

describe('batter stance to first-base geometry', () => {
  it('mirrors equal left/right stance geometry to opposite sides of home plate', () => {
    const left = resolveBatterStanceWorldPosition(frame, leftStance);
    const right = resolveBatterStanceWorldPosition(frame, rightStance);

    expect(left.x).toBeGreaterThan(0);
    expect(right.x).toBeLessThan(0);
    expect(left.z).toBeCloseTo(right.z, 12);
    expect(left.x).toBeCloseTo(-right.x, 12);
  });

  it('derives a shorter first-base distance for the mirrored left-handed fixture', () => {
    const leftDistance = getBatterRunnerDistanceToFirstBase(
      frame,
      leftStance,
    );
    const rightDistance = getBatterRunnerDistanceToFirstBase(
      frame,
      rightStance,
    );

    expect(leftDistance).toBeLessThan(rightDistance);
    expect(rightDistance - leftDistance).toBeGreaterThan(1);
  });

  it('produces an earlier exact first-base touch from identical running physics solely because the left route is shorter', () => {
    const leftRoute = createBatterRunnerFirstBaseRoute(
      frame,
      leftStance,
      3,
    );
    const rightRoute = createBatterRunnerFirstBaseRoute(
      frame,
      rightStance,
      3,
    );
    const base: BaseTouchRegion = {
      center: frame.firstBaseCenter,
      halfSize: { x: 0.2, z: 0.2 },
      rotationRadians: 0,
    };
    const start: RunnerMotionState = {
      tick: 0,
      routeDistanceMeters: 0,
      speedMps: 0,
      driveDirection: 0,
      bodyMode: 'upright',
    };
    const intent: RunnerMotionIntent = {
      kind: 'advance',
      issuedTick: 0,
    };
    const motion: RunnerMotionParameters = {
      ticksPerSecond: 1_000_000,
      reactionDelayTicks: 0,
      accelerationMps2: 4,
      brakingMps2: 4,
      slideDecelerationMps2: 5,
      topSpeedMps: 8.5,
    };
    const body: RunnerBodyContactParameters = {
      uprightLeadMeters: 0.25,
      slideLeadMeters: 0.6,
    };

    const leftTouch = findRunnerBaseTouchTick(
      start,
      intent,
      leftRoute,
      base,
      5_000_000,
      motion,
      body,
    );
    const rightTouch = findRunnerBaseTouchTick(
      start,
      intent,
      rightRoute,
      base,
      5_000_000,
      motion,
      body,
    );

    expect(leftTouch).not.toBeNull();
    expect(rightTouch).not.toBeNull();
    expect(leftTouch as number).toBeLessThan(rightTouch as number);
  });

  it('rejects a non-orthogonal field frame instead of silently distorting handedness', () => {
    expect(() => createBatterRunnerFirstBaseFrame({
      homePlateReferencePoint: { x: 0, z: 0 },
      firstBaseCenter: { x: 20, z: 20 },
      towardPitcherUnit: { x: 0, z: 1 },
      towardFirstBaseSideUnit: { x: 0.1, z: 1 },
      homePlateHalfWidthMeters: 0.2,
    })).toThrow('batter field-frame axes must be orthonormal');
  });
});
