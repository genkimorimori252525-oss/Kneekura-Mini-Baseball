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
  buildBatterRunnerWorldTimeline,
  sampleBatterRunnerWorldTimeline,
} from './BatterRunnerWorldTimeline';
import {
  advanceRunnerMotion,
  type RunnerMotionParameters,
} from './RunnerMotion';
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

const transitionParameters = {
  ticksPerSecond: 1_000_000,
  maximumBodyTurnRateRadiansPerSecond: Math.PI,
  lateralRealignmentAccelerationMps2: 3,
  backwardRecoveryAccelerationMps2: 4,
} as const;

const runnerParameters: RunnerMotionParameters = {
  ticksPerSecond: 1_000_000,
  reactionDelayTicks: 0,
  accelerationMps2: 4,
  brakingMps2: 4,
  slideDecelerationMps2: 5,
  topSpeedMps: 8.5,
};

const recovery = () => buildBatterSwingExitRecoveryTrajectory(
  {
    tick: 1_500_000,
    planarVelocity: {
      x: tangent.x * 1.0 + lateral.x * 0.9,
      z: tangent.z * 1.0 + lateral.z * 0.9,
    },
    bodyForwardUnit: lateral,
  },
  route,
  transitionParameters,
);

const timeline = () => {
  const currentRecovery = recovery();
  return buildBatterRunnerWorldTimeline({
    playerId: 'batter',
    route,
    recovery: currentRecovery,
    postLaunchIntent: {
      kind: 'advance',
      issuedTick: currentRecovery.transition.launchTick,
    },
    runnerMotionParameters: runnerParameters,
    endTick: currentRecovery.transition.launchTick + 2_000_000,
  });
};

describe('unified batter-runner world timeline', () => {
  it('delegates recovery ticks to the authoritative swing-exit trajectory', () => {
    const built = timeline();
    const tick = 1_800_000;
    const direct = projectBatterSwingExitRecoveryRunnerWorldState(
      'batter',
      sampleBatterSwingExitRecoveryTrajectory(
        built.recovery,
        tick,
      ),
    );
    const sampled = sampleBatterRunnerWorldTimeline(
      built,
      tick,
    );

    expect(sampled.phase).toBe('swing_exit_recovery');
    expect(sampled.world).toEqual(direct);
  });

  it('keeps launchTick owned by recovery and changes ownership only on the following tick', () => {
    const built = timeline();
    const launchTick = built.recovery.transition.launchTick;

    const launch = sampleBatterRunnerWorldTimeline(
      built,
      launchTick,
    );
    const directLaunch = projectBatterSwingExitRecoveryRunnerWorldState(
      'batter',
      sampleBatterSwingExitRecoveryTrajectory(
        built.recovery,
        launchTick,
      ),
    );

    expect(launch.phase).toBe('swing_exit_recovery');
    expect(launch.world).toEqual(directLaunch);

    const next = sampleBatterRunnerWorldTimeline(
      built,
      launchTick + 1,
    );
    expect(next.phase).toBe('runner_motion');

    expect(Math.hypot(
      next.world.position.x - launch.world.position.x,
      next.world.position.z - launch.world.position.z,
    )).toBeLessThan(0.001);
  });

  it('matches independently advanced RunnerMotion exactly after launch', () => {
    const built = timeline();
    const launchTick = built.recovery.transition.launchTick;
    const tick = launchTick + 750_000;

    const launchState = createRunnerMotionStateFromSwingExitTransition(
      built.recovery.transition,
    );
    const directMotion = advanceRunnerMotion(
      launchState,
      built.postLaunchIntent,
      tick - launchTick,
      built.runnerMotionParameters,
    );
    const directWorld = projectRunnerWorldState(
      'batter',
      directMotion,
      route,
    );
    const sampled = sampleBatterRunnerWorldTimeline(
      built,
      tick,
    );

    expect(sampled.phase).toBe('runner_motion');
    expect(sampled.world).toEqual(directWorld);
  });

  it('rejects sampling outside the configured authoritative interval', () => {
    const built = timeline();

    expect(() => sampleBatterRunnerWorldTimeline(
      built,
      built.startTick - 1,
    )).toThrow(
      'batter-runner timeline sample tick must lie inside the timeline interval',
    );
    expect(() => sampleBatterRunnerWorldTimeline(
      built,
      built.endTick + 1,
    )).toThrow(
      'batter-runner timeline sample tick must lie inside the timeline interval',
    );
  });

  it('rejects an intent issued before physical launch', () => {
    const currentRecovery = recovery();

    expect(() => buildBatterRunnerWorldTimeline({
      playerId: 'batter',
      route,
      recovery: currentRecovery,
      postLaunchIntent: {
        kind: 'advance',
        issuedTick: currentRecovery.transition.launchTick - 1,
      },
      runnerMotionParameters: runnerParameters,
      endTick: currentRecovery.transition.launchTick + 1_000_000,
    })).toThrow(
      'post-launch runner intent must not be issued before launchTick',
    );
  });

  it('rejects incompatible clock rates and end-before-launch timelines', () => {
    const currentRecovery = recovery();

    expect(() => buildBatterRunnerWorldTimeline({
      playerId: 'batter',
      route,
      recovery: currentRecovery,
      postLaunchIntent: {
        kind: 'advance',
        issuedTick: currentRecovery.transition.launchTick,
      },
      runnerMotionParameters: {
        ...runnerParameters,
        ticksPerSecond: 500_000,
      },
      endTick: currentRecovery.transition.launchTick + 1_000_000,
    })).toThrow(
      'recovery and RunnerMotion must use the same ticksPerSecond',
    );

    expect(() => buildBatterRunnerWorldTimeline({
      playerId: 'batter',
      route,
      recovery: currentRecovery,
      postLaunchIntent: {
        kind: 'advance',
        issuedTick: currentRecovery.transition.launchTick,
      },
      runnerMotionParameters: runnerParameters,
      endTick: currentRecovery.transition.launchTick - 1,
    })).toThrow(
      'batter-runner timeline endTick must not precede launchTick',
    );
  });
});
