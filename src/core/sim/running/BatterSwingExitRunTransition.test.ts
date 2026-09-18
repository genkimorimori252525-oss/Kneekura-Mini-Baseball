import { describe, expect, it } from 'vitest';
import type { BaseTouchRegion } from './BaseTouch';
import {
  createBatterRunnerFirstBaseFrame,
  createBatterRunnerFirstBaseRoute,
  createBatterStanceGeometry,
} from './BatterStanceFirstBaseGeometry';
import {
  createRunnerMotionStateFromSwingExitTransition,
  resolveBatterSwingExitRunTransition,
} from './BatterSwingExitRunTransition';
import type {
  RunnerMotionIntent,
  RunnerMotionParameters,
} from './RunnerMotion';
import { findRunnerBaseTouchTick } from './RunnerBaseTouch';
import { sampleRunnerRoute } from './RunnerRoute';

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

const route = createBatterRunnerFirstBaseRoute(
  frame,
  createBatterStanceGeometry(
    'left',
    6 * INCHES_TO_METERS + 2 * FEET_TO_METERS,
    0.45,
  ),
  3,
);

const routeTangent = sampleRunnerRoute(route, 0).tangent;
const lateralUnit = {
  x: -routeTangent.z,
  z: routeTangent.x,
};

const parameters = {
  ticksPerSecond: 1_000_000,
  maximumBodyTurnRateRadiansPerSecond: Math.PI,
  lateralVelocityDampingMps2: 3,
  backwardVelocityBrakingMps2: 4,
} as const;

describe('batter swing-exit run transition', () => {
  it('launches immediately when body orientation and residual velocity are already route-aligned', () => {
    const result = resolveBatterSwingExitRunTransition(
      {
        tick: 1_500_000,
        planarVelocity: {
          x: routeTangent.x * 1.2,
          z: routeTangent.z * 1.2,
        },
        bodyForwardUnit: routeTangent,
      },
      route,
      parameters,
    );

    expect(result).toMatchObject({
      launchTick: 1_500_000,
      launchRouteDistanceMeters: 0,
      initialRouteSpeedMps: 1.2,
      requiredTurnRadians: 0,
      turnRecoverySeconds: 0,
      lateralRecoverySeconds: 0,
      backwardRecoverySeconds: 0,
      recoverySeconds: 0,
    });
  });

  it('requires mechanical recovery for a sideways follow-through with lateral residual velocity', () => {
    const result = resolveBatterSwingExitRunTransition(
      {
        tick: 1_500_000,
        planarVelocity: {
          x: lateralUnit.x * 1.2,
          z: lateralUnit.z * 1.2,
        },
        bodyForwardUnit: lateralUnit,
      },
      route,
      parameters,
    );

    expect(result.requiredTurnRadians).toBeCloseTo(Math.PI / 2, 12);
    expect(result.turnRecoverySeconds).toBeCloseTo(0.5, 12);
    expect(result.lateralRecoverySeconds).toBeCloseTo(0.4, 12);
    expect(result.recoverySeconds).toBeCloseTo(0.5, 12);
    expect(result.launchTick).toBe(2_000_000);
    expect(result.launchRouteDistanceMeters).toBeCloseTo(0, 12);
    expect(result.initialRouteSpeedMps).toBeCloseTo(0, 12);
  });

  it('retains positive route momentum while recovery removes only off-axis motion', () => {
    const result = resolveBatterSwingExitRunTransition(
      {
        tick: 1_500_000,
        planarVelocity: {
          x: routeTangent.x * 1.0 + lateralUnit.x * 0.9,
          z: routeTangent.z * 1.0 + lateralUnit.z * 0.9,
        },
        bodyForwardUnit: lateralUnit,
      },
      route,
      parameters,
    );

    expect(result.recoverySeconds).toBeCloseTo(0.5, 12);
    expect(result.launchRouteDistanceMeters).toBeCloseTo(0.5, 12);
    expect(result.initialRouteSpeedMps).toBeCloseTo(1.0, 12);
  });

  it('changes exact first-base touch time using only swing-exit body state', () => {
    const aligned = resolveBatterSwingExitRunTransition(
      {
        tick: 1_500_000,
        planarVelocity: {
          x: routeTangent.x * 1.2,
          z: routeTangent.z * 1.2,
        },
        bodyForwardUnit: routeTangent,
      },
      route,
      parameters,
    );
    const sideways = resolveBatterSwingExitRunTransition(
      {
        tick: 1_500_000,
        planarVelocity: {
          x: lateralUnit.x * 1.2,
          z: lateralUnit.z * 1.2,
        },
        bodyForwardUnit: lateralUnit,
      },
      route,
      parameters,
    );

    const base: BaseTouchRegion = {
      center: frame.firstBaseCenter,
      halfSize: { x: 0.2, z: 0.2 },
      rotationRadians: 0,
    };
    const intentFor = (issuedTick: number): RunnerMotionIntent => ({
      kind: 'advance',
      issuedTick,
    });
    const motion: RunnerMotionParameters = {
      ticksPerSecond: 1_000_000,
      reactionDelayTicks: 0,
      accelerationMps2: 4,
      brakingMps2: 4,
      slideDecelerationMps2: 5,
      topSpeedMps: 8.5,
    };
    const body = {
      uprightLeadMeters: 0.25,
      slideLeadMeters: 0.6,
    } as const;

    const alignedTouch = findRunnerBaseTouchTick(
      createRunnerMotionStateFromSwingExitTransition(aligned),
      intentFor(aligned.launchTick),
      route,
      base,
      5_000_000,
      motion,
      body,
    );
    const sidewaysTouch = findRunnerBaseTouchTick(
      createRunnerMotionStateFromSwingExitTransition(sideways),
      intentFor(sideways.launchTick),
      route,
      base,
      5_000_000,
      motion,
      body,
    );

    expect(alignedTouch).not.toBeNull();
    expect(sidewaysTouch).not.toBeNull();
    expect(alignedTouch as number).toBeLessThan(sidewaysTouch as number);
  });

  it('rejects a non-unit body-forward direction', () => {
    expect(() => resolveBatterSwingExitRunTransition(
      {
        tick: 1_500_000,
        planarVelocity: { x: 0, z: 0 },
        bodyForwardUnit: { x: 1, z: 1 },
      },
      route,
      parameters,
    )).toThrow('bodyForwardUnit must be a unit vector');
  });
});
