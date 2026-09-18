import { describe, expect, it } from 'vitest';
import type { BaseTouchRegion } from '../sim/running/BaseTouch';
import type { RunnerBodyContactParameters } from '../sim/running/RunnerBodyContact';
import {
  buildBatterSwingExitRecoveryTrajectory,
} from '../sim/running/BatterSwingExitRecoveryTrajectory';
import {
  buildBatterRunnerWorldTimeline,
  findBatterRunnerPostLaunchBaseTouchTick,
} from '../sim/running/BatterRunnerWorldTimeline';
import type {
  RunnerMotionParameters,
} from '../sim/running/RunnerMotion';
import type { RunnerRoute } from '../sim/running/RunnerRoute';
import {
  createControlledBaseContactFact,
  createRunnerBaseTouchFact,
} from './PhysicalRuleFacts';
import {
  createBatterRunnerFirstBaseTouchFactFromTimeline,
  resolveBatterRunnerFirstBaseFromTimeline,
  resolveGroundBallFirstBaseRuleFromTimeline,
} from './BatterRunnerFirstBasePhysicalAdapter';

const route: RunnerRoute = {
  segments: [{
    kind: 'line',
    start: { x: 0, z: 0 },
    end: { x: 35, z: 0 },
  }],
};

const recoveryParameters = {
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
  topSpeedMps: 8,
};

const firstBase: BaseTouchRegion = {
  center: { x: 27, z: 0 },
  halfSize: { x: 0.2, z: 0.2 },
  rotationRadians: 0,
};

const bodyParameters: RunnerBodyContactParameters = {
  uprightLeadMeters: 0.25,
  slideLeadMeters: 0.6,
};

const timeline = () => {
  const recovery = buildBatterSwingExitRecoveryTrajectory(
    {
      tick: 1_000_000,
      planarVelocity: { x: 1, z: 0 },
      bodyForwardUnit: { x: 1, z: 0 },
    },
    route,
    recoveryParameters,
  );

  return buildBatterRunnerWorldTimeline({
    playerId: 'batter',
    route,
    recovery,
    postLaunchIntent: {
      kind: 'advance',
      issuedTick: recovery.transition.launchTick,
    },
    runnerMotionParameters: runnerParameters,
    endTick: recovery.transition.launchTick + 4_500_000,
  });
};

describe('BatterRunnerFirstBasePhysicalAdapter', () => {
  it('creates the existing RunnerBaseTouchFact from the exact unified-timeline touch tick', () => {
    const built = timeline();
    const exactTick = findBatterRunnerPostLaunchBaseTouchTick(
      built,
      firstBase,
      bodyParameters,
    );
    expect(exactTick).not.toBeNull();

    expect(createBatterRunnerFirstBaseTouchFactFromTimeline({
      timeline: built,
      firstBase,
      bodyParameters,
    })).toEqual(createRunnerBaseTouchFact(
      'batter',
      1,
      exactTick as number,
    ));
  });

  it('delegates one-tick-earlier defender control to the existing OUT semantics', () => {
    const built = timeline();
    const touchTick = findBatterRunnerPostLaunchBaseTouchTick(
      built,
      firstBase,
      bodyParameters,
    ) as number;

    expect(resolveBatterRunnerFirstBaseFromTimeline({
      timeline: built,
      firstBase,
      bodyParameters,
      defenderControl: createControlledBaseContactFact(
        'first-baseman',
        1,
        touchTick - 1,
      ),
    })).toMatchObject({
      kind: 'out',
      runnerId: 'batter',
      outTick: touchTick - 1,
      runnerTouchTick: touchTick,
    });
  });

  it('delegates one-tick-earlier runner touch to the existing SAFE semantics', () => {
    const built = timeline();
    const touchTick = findBatterRunnerPostLaunchBaseTouchTick(
      built,
      firstBase,
      bodyParameters,
    ) as number;

    expect(resolveBatterRunnerFirstBaseFromTimeline({
      timeline: built,
      firstBase,
      bodyParameters,
      defenderControl: createControlledBaseContactFact(
        'first-baseman',
        1,
        touchTick + 1,
      ),
    })).toMatchObject({
      kind: 'safe',
      runnerId: 'batter',
      touchTick,
      defenderControlTick: touchTick + 1,
    });
  });

  it('preserves exact simultaneous physical truth instead of inventing precedence', () => {
    const built = timeline();
    const touchTick = findBatterRunnerPostLaunchBaseTouchTick(
      built,
      firstBase,
      bodyParameters,
    ) as number;

    expect(resolveBatterRunnerFirstBaseFromTimeline({
      timeline: built,
      firstBase,
      bodyParameters,
      defenderControl: createControlledBaseContactFact(
        'first-baseman',
        1,
        touchTick,
      ),
    })).toEqual({
      kind: 'simultaneous',
      runnerId: 'batter',
      base: 1,
      tick: touchTick,
    });
  });

  it('feeds the same physical touch fact into the existing two-out ground-ball scoring path', () => {
    const built = timeline();
    const touchTick = findBatterRunnerPostLaunchBaseTouchTick(
      built,
      firstBase,
      bodyParameters,
    ) as number;
    const homeTouch = createRunnerBaseTouchFact(
      'r3',
      4,
      touchTick - 100_000,
    );

    const result = resolveGroundBallFirstBaseRuleFromTimeline({
      timeline: built,
      firstBase,
      bodyParameters,
      outsAtStart: 2,
      defenderControl: createControlledBaseContactFact(
        'first-baseman',
        1,
        touchTick - 1,
      ),
      homeTouches: [homeTouch],
    });

    expect(result.physicalFacts.batterRunnerTouch).toEqual(
      createRunnerBaseTouchFact('batter', 1, touchTick),
    );
    expect(result.correctRuleResult).toMatchObject({
      kind: 'resolved',
      outsAfter: 3,
      thirdOut: true,
      runsScored: [],
      runsSuppressed: [homeTouch],
    });
  });
});
