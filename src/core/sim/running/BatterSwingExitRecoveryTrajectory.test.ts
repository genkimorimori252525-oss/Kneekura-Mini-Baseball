import { describe, expect, it } from 'vitest';
import {
  createBatterRunnerFirstBaseFrame,
  createBatterRunnerFirstBaseRoute,
  createBatterStanceGeometry,
} from './BatterStanceFirstBaseGeometry';
import {
  buildBatterSwingExitRecoveryTrajectory,
  projectBatterSwingExitRecoveryRunnerWorldState,
  sampleBatterSwingExitRecoveryTrajectory,
} from './BatterSwingExitRecoveryTrajectory';
import {
  createRunnerMotionStateFromSwingExitTransition,
} from './BatterSwingExitRunTransition';
import { projectRunnerWorldState } from './RunnerWorldProjection';
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

const routeStart = sampleRunnerRoute(route, 0);
const tangent = routeStart.tangent;
const lateral = {
  x: -tangent.z,
  z: tangent.x,
};

const parameters = {
  ticksPerSecond: 1_000_000,
  maximumBodyTurnRateRadiansPerSecond: Math.PI,
  lateralRealignmentAccelerationMps2: 3,
  backwardRecoveryAccelerationMps2: 4,
} as const;

const dot = (
  first: { x: number; z: number },
  second: { x: number; z: number },
): number => first.x * second.x + first.z * second.z;

describe('batter swing-exit recovery world trajectory', () => {
  it('moves off the route during sideways recovery and returns to the route line at launch', () => {
    const trajectory = buildBatterSwingExitRecoveryTrajectory(
      {
        tick: 1_500_000,
        planarVelocity: {
          x: lateral.x * 1.2,
          z: lateral.z * 1.2,
        },
        bodyForwardUnit: lateral,
      },
      route,
      parameters,
    );

    const middle = sampleBatterSwingExitRecoveryTrajectory(
      trajectory,
      1_800_000,
    );
    const middleOffset = {
      x: middle.position.x - routeStart.position.x,
      z: middle.position.z - routeStart.position.z,
    };
    expect(Math.abs(dot(middleOffset, lateral))).toBeGreaterThan(0.1);

    const launch = sampleBatterSwingExitRecoveryTrajectory(
      trajectory,
      trajectory.transition.launchTick,
    );
    const launchOffset = {
      x: launch.position.x - routeStart.position.x,
      z: launch.position.z - routeStart.position.z,
    };

    expect(dot(launchOffset, lateral)).toBeCloseTo(0, 10);
    expect(dot(launch.velocity, lateral)).toBeCloseTo(0, 10);
    expect(launch.bodyForwardUnit.x).toBeCloseTo(tangent.x, 10);
    expect(launch.bodyForwardUnit.z).toBeCloseTo(tangent.z, 10);
  });

  it('allows backward recovery to move behind the start but returns to the route origin at launch', () => {
    const trajectory = buildBatterSwingExitRecoveryTrajectory(
      {
        tick: 1_500_000,
        planarVelocity: {
          x: -tangent.x * 1.6,
          z: -tangent.z * 1.6,
        },
        bodyForwardUnit: tangent,
      },
      route,
      parameters,
    );

    const middle = sampleBatterSwingExitRecoveryTrajectory(
      trajectory,
      1_800_000,
    );
    const middleOffset = {
      x: middle.position.x - routeStart.position.x,
      z: middle.position.z - routeStart.position.z,
    };
    expect(dot(middleOffset, tangent)).toBeLessThan(0);

    const launch = sampleBatterSwingExitRecoveryTrajectory(
      trajectory,
      trajectory.transition.launchTick,
    );
    expect(launch.position.x).toBeCloseTo(routeStart.position.x, 10);
    expect(launch.position.z).toBeCloseTo(routeStart.position.z, 10);
    expect(dot(launch.velocity, tangent)).toBeCloseTo(0, 10);
  });

  it('matches the existing RunnerMotion launch boundary with no position or velocity snap', () => {
    const trajectory = buildBatterSwingExitRecoveryTrajectory(
      {
        tick: 1_500_000,
        planarVelocity: {
          x: tangent.x * 1.0 + lateral.x * 0.9,
          z: tangent.z * 1.0 + lateral.z * 0.9,
        },
        bodyForwardUnit: lateral,
      },
      route,
      parameters,
    );
    const launchSample = sampleBatterSwingExitRecoveryTrajectory(
      trajectory,
      trajectory.transition.launchTick,
    );
    const runnerLaunch = createRunnerMotionStateFromSwingExitTransition(
      trajectory.transition,
    );
    const projected = projectRunnerWorldState(
      'batter',
      runnerLaunch,
      route,
    );

    expect(launchSample.position.x).toBeCloseTo(projected.position.x, 10);
    expect(launchSample.position.z).toBeCloseTo(projected.position.z, 10);
    expect(launchSample.velocity.x).toBeCloseTo(projected.velocity.x, 10);
    expect(launchSample.velocity.z).toBeCloseTo(projected.velocity.z, 10);

    expect(projectBatterSwingExitRecoveryRunnerWorldState(
      'batter',
      launchSample,
    )).toEqual({
      playerId: 'batter',
      position: launchSample.position,
      velocity: launchSample.velocity,
    });
  });

  it('rejects a recovery trajectory whose launch would leave the initial straight route segment', () => {
    const shortRoute = {
      segments: [{
        kind: 'line' as const,
        start: routeStart.position,
        end: {
          x: routeStart.position.x + tangent.x * 0.2,
          z: routeStart.position.z + tangent.z * 0.2,
        },
      }],
    };

    expect(() => buildBatterSwingExitRecoveryTrajectory(
      {
        tick: 1_500_000,
        planarVelocity: {
          x: tangent.x * 1.0 + lateral.x * 0.9,
          z: tangent.z * 1.0 + lateral.z * 0.9,
        },
        bodyForwardUnit: lateral,
      },
      shortRoute,
      parameters,
    )).toThrow(
      'swing-exit recovery progress exceeds the finite runner route',
    );
  });
});