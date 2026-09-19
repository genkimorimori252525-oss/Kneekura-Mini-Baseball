import { describe, expect, it } from 'vitest';
import type {
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
import {
  asRuleProfileId,
} from '../../model/RuleProfileRef';
import {
  resolveBatBallContact,
  type BatterSwingState,
  type PitchWorldState,
} from '../contact/BatBallContact';
import {
  buildBatterSwingExitRecoveryTrajectory,
} from '../running/BatterSwingExitRecoveryTrajectory';
import {
  buildBatterRunnerWorldTimeline,
} from '../running/BatterRunnerWorldTimeline';
import type {
  RunnerRoute,
} from '../running/RunnerRoute';
import {
  createCanonicalPlateAppearanceTimeline,
  recordBatBallContact,
  recordFairBattedBall,
} from './CanonicalPlateAppearanceTimeline';
import {
  assertBatterRunnerTimelineMatchesPlateAppearance,
} from './GroundBallRunnerEvidenceBinding';

const fixture = () => {
  const match: CanonicalMatchState = {
    ruleProfileId: asRuleProfileId('npb-2026'),
    inning: 1,
    half: 'top',
    outs: 0,
    balls: 0,
    strikes: 0,
    bases: {
      first: null,
      second: null,
      third: null,
    },
    score: {
      away: 0,
      home: 0,
    },
    playId: 8,
  };
  const pitch: PitchWorldState = {
    tick: 20_000_000,
    position: { x: 0, y: 1, z: 0.06 },
    velocity: { x: 0, y: -1.5, z: -35 },
    spin: { x: 0, y: 0, z: 0 },
  };
  const swing: BatterSwingState = {
    pose: {
      grip: { x: -0.42, y: 1, z: 0 },
      tip: { x: 0.42, y: 1, z: 0 },
    },
    linearVelocity: { x: 0, y: -7, z: 17 },
    angularVelocity: { x: 0, y: 0, z: 0 },
  };
  const contact = resolveBatBallContact(pitch, swing);
  if (contact === null) {
    throw new Error('fixture must create contact');
  }
  const timeline = recordFairBattedBall(
    recordBatBallContact(
      createCanonicalPlateAppearanceTimeline(
        match,
        contact.tick - 100_000,
      ),
      contact,
    ),
    contact.tick + 1,
  );

  const route: RunnerRoute = {
    segments: [{
      kind: 'line',
      start: { x: 0, z: 0 },
      end: { x: 35, z: 0 },
    }],
  };
  const recovery = buildBatterSwingExitRecoveryTrajectory(
    {
      tick: contact.tick,
      planarVelocity: { x: 1, z: 0 },
      bodyForwardUnit: { x: 1, z: 0 },
    },
    route,
    {
      ticksPerSecond: 1_000_000,
      maximumBodyTurnRateRadiansPerSecond: Math.PI,
      lateralRealignmentAccelerationMps2: 3,
      backwardRecoveryAccelerationMps2: 4,
    },
  );
  const runner = buildBatterRunnerWorldTimeline({
    playerId: 'batter',
    route,
    recovery,
    postLaunchIntent: {
      kind: 'advance',
      issuedTick: recovery.transition.launchTick,
    },
    runnerMotionParameters: {
      ticksPerSecond: 1_000_000,
      reactionDelayTicks: 0,
      accelerationMps2: 4,
      brakingMps2: 4,
      slideDecelerationMps2: 5,
      topSpeedMps: 8,
    },
    endTick: recovery.transition.launchTick + 6_000_000,
  });

  return { timeline, runner };
};

describe('GroundBallRunnerEvidenceBinding', () => {
  it('accepts a batter-runner timeline rooted at the authoritative contact tick', () => {
    const { timeline, runner } = fixture();

    expect(() =>
      assertBatterRunnerTimelineMatchesPlateAppearance(
        timeline,
        runner,
      )
    ).not.toThrow();
  });

  it('rejects a runner timeline whose public start tick belongs to another play', () => {
    const { timeline, runner } = fixture();

    expect(() =>
      assertBatterRunnerTimelineMatchesPlateAppearance(
        timeline,
        {
          ...runner,
          startTick: runner.startTick + 1,
        },
      )
    ).toThrow(
      'batter-runner timeline must start at the authoritative bat-ball contact tick',
    );
  });

  it('rejects a runner timeline with a forged internal recovery origin', () => {
    const { timeline, runner } = fixture();

    expect(() =>
      assertBatterRunnerTimelineMatchesPlateAppearance(
        timeline,
        {
          ...runner,
          recovery: {
            ...runner.recovery,
            startTick: runner.recovery.startTick + 1,
          },
        },
      )
    ).toThrow(
      'batter-runner timeline must start at the authoritative bat-ball contact tick',
    );
  });

  it('rejects a forged launch boundary inside an otherwise matching timeline', () => {
    const { timeline, runner } = fixture();

    expect(() =>
      assertBatterRunnerTimelineMatchesPlateAppearance(
        timeline,
        {
          ...runner,
          launchState: {
            ...runner.launchState,
            tick: runner.launchState.tick + 1,
          },
        },
      )
    ).toThrow(
      'batter-runner timeline launch boundary must remain internally canonical',
    );
  });
});