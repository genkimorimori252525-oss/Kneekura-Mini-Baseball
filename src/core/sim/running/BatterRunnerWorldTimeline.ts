import type {
  BaserunnerWorldState,
} from '../../model/CanonicalWorldSnapshot';
import {
  projectBatterSwingExitRecoveryRunnerWorldState,
  sampleBatterSwingExitRecoveryTrajectory,
  type BatterSwingExitRecoveryTrajectory,
} from './BatterSwingExitRecoveryTrajectory';
import {
  createRunnerMotionStateFromSwingExitTransition,
} from './BatterSwingExitRunTransition';
import {
  advanceRunnerMotion,
  type RunnerMotionIntent,
  type RunnerMotionParameters,
  type RunnerMotionState,
} from './RunnerMotion';
import {
  projectRunnerWorldState,
} from './RunnerWorldProjection';
import type { RunnerRoute } from './RunnerRoute';

export type BatterRunnerWorldTimelinePhase =
  | 'swing_exit_recovery'
  | 'runner_motion';

export type BatterRunnerWorldTimeline = Readonly<{
  playerId: string;
  route: RunnerRoute;
  recovery: BatterSwingExitRecoveryTrajectory;
  postLaunchIntent: RunnerMotionIntent;
  runnerMotionParameters: RunnerMotionParameters;
  launchState: RunnerMotionState;
  startTick: number;
  endTick: number;
}>;

export type BatterRunnerWorldTimelineInput = Readonly<{
  playerId: string;
  route: RunnerRoute;
  recovery: BatterSwingExitRecoveryTrajectory;
  postLaunchIntent: RunnerMotionIntent;
  runnerMotionParameters: RunnerMotionParameters;
  endTick: number;
}>;

export type BatterRunnerWorldTimelineSample = Readonly<{
  tick: number;
  phase: BatterRunnerWorldTimelinePhase;
  world: BaserunnerWorldState;
}>;

const EPSILON = 1e-12;
const BOUNDARY_TOLERANCE = 1e-9;

const worldBoundaryMatches = (
  first: BaserunnerWorldState,
  second: BaserunnerWorldState,
): boolean => (
  Math.abs(first.position.x - second.position.x) <= BOUNDARY_TOLERANCE
  && Math.abs(first.position.z - second.position.z) <= BOUNDARY_TOLERANCE
  && Math.abs(first.velocity.x - second.velocity.x) <= BOUNDARY_TOLERANCE
  && Math.abs(first.velocity.z - second.velocity.z) <= BOUNDARY_TOLERANCE
);

export const buildBatterRunnerWorldTimeline = (
  input: BatterRunnerWorldTimelineInput,
): BatterRunnerWorldTimeline => {
  if (input.playerId.length === 0) {
    throw new Error('playerId must not be empty');
  }
  if (!Number.isSafeInteger(input.endTick) || input.endTick < 0) {
    throw new Error(
      'batter-runner timeline endTick must be a non-negative safe integer',
    );
  }

  const launchTick = input.recovery.transition.launchTick;
  if (input.endTick < launchTick) {
    throw new Error(
      'batter-runner timeline endTick must not precede launchTick',
    );
  }
  if (
    input.runnerMotionParameters.ticksPerSecond
    !== input.recovery.ticksPerSecond
  ) {
    throw new Error(
      'recovery and RunnerMotion must use the same ticksPerSecond',
    );
  }
  if (
    !Number.isSafeInteger(input.postLaunchIntent.issuedTick)
    || input.postLaunchIntent.issuedTick < 0
  ) {
    throw new Error(
      'post-launch runner intent issuedTick must be a non-negative safe integer',
    );
  }
  if (input.postLaunchIntent.issuedTick < launchTick) {
    throw new Error(
      'post-launch runner intent must not be issued before launchTick',
    );
  }

  const launchState = createRunnerMotionStateFromSwingExitTransition(
    input.recovery.transition,
  );
  if (
    Math.abs(launchState.speedMps)
    - input.runnerMotionParameters.topSpeedMps
    > EPSILON
  ) {
    throw new Error(
      'RunnerMotion topSpeedMps must not be lower than inherited launch speed',
    );
  }

  const recoveryLaunchWorld = (
    projectBatterSwingExitRecoveryRunnerWorldState(
      input.playerId,
      sampleBatterSwingExitRecoveryTrajectory(
        input.recovery,
        launchTick,
      ),
    )
  );
  const runnerLaunchWorld = projectRunnerWorldState(
    input.playerId,
    launchState,
    input.route,
  );
  if (!worldBoundaryMatches(
    recoveryLaunchWorld,
    runnerLaunchWorld,
  )) {
    throw new Error(
      'recovery launch boundary must match the post-launch RunnerRoute',
    );
  }

  return {
    playerId: input.playerId,
    route: input.route,
    recovery: input.recovery,
    postLaunchIntent: input.postLaunchIntent,
    runnerMotionParameters: input.runnerMotionParameters,
    launchState,
    startTick: input.recovery.startTick,
    endTick: input.endTick,
  };
};

export const sampleBatterRunnerWorldTimeline = (
  timeline: BatterRunnerWorldTimeline,
  tick: number,
): BatterRunnerWorldTimelineSample => {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new Error(
      'batter-runner timeline sample tick must be a non-negative safe integer',
    );
  }
  if (tick < timeline.startTick || tick > timeline.endTick) {
    throw new Error(
      'batter-runner timeline sample tick must lie inside the timeline interval',
    );
  }

  const launchTick = timeline.recovery.transition.launchTick;
  if (tick <= launchTick) {
    const recoverySample = sampleBatterSwingExitRecoveryTrajectory(
      timeline.recovery,
      tick,
    );
    return {
      tick,
      phase: 'swing_exit_recovery',
      world: projectBatterSwingExitRecoveryRunnerWorldState(
        timeline.playerId,
        recoverySample,
      ),
    };
  }

  const motion = advanceRunnerMotion(
    timeline.launchState,
    timeline.postLaunchIntent,
    tick - launchTick,
    timeline.runnerMotionParameters,
  );

  return {
    tick,
    phase: 'runner_motion',
    world: projectRunnerWorldState(
      timeline.playerId,
      motion,
      timeline.route,
    ),
  };
};
