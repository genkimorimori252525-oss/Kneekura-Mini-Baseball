import type {
  CanonicalMatchState,
} from '../model/CanonicalMatchState';
import {
  asRuleProfileId,
} from '../model/RuleProfileRef';
import {
  DeterministicRng,
} from '../rng/DeterministicRng';
import {
  closeAppealWindow,
  createAppealWindow,
} from '../rules/AppealWindow';
import {
  createDefensiveAppealAttemptFact,
  createFlyBallFirstFielderTouchFact,
  createRunnerBaseDepartureFact,
} from '../rules/PhysicalRuleFacts';
import {
  evaluateTagUpCompliance,
} from '../rules/TagUpCompliance';
import {
  resolveTagUpAppeal,
} from '../rules/TagUpAppealRule';
import {
  applyBattedBallReadPredictionError,
} from '../sim/fielding/BattedBallReadSkill';
import {
  buildRunnerMotionTrajectory,
  sampleRunnerMotionTrajectory,
} from '../sim/running/RunnerMotion';
import {
  createFixedSeedRegressionCorpus,
  type FixedSeedRegressionScenario,
} from './FixedSeedRegressionCorpus';
import {
  runFixedSeedRegressionCorpus,
  type FixedSeedCorpusRunResult,
  type FixedSeedScenarioBuilderRegistry,
} from './FixedSeedRegressionRunner';

const startingMatchState = (
  playId: number,
): CanonicalMatchState => ({
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
  playId,
});

export const P9_FIXED_SEED_BASELINE_CORPUS =
  createFixedSeedRegressionCorpus([
    {
      scenarioId: 'p9-fielding-read-seed-20260919',
      matchSeed: 20260919,
      startingMatchState: startingMatchState(1),
      scenarioBuilderId:
        'p9:fielding:batted-ball-read:v1',
      evidenceClass: 'fielding',
      expectedFingerprint: '0d6e8aefd4601e9a',
    },
    {
      scenarioId: 'p9-baserunning-retreat-20260920',
      matchSeed: 20260920,
      startingMatchState: startingMatchState(2),
      scenarioBuilderId:
        'p9:baserunning:runner-motion:v1',
      evidenceClass: 'baserunning',
      expectedFingerprint: '8c3db4d6447bcad5',
    },
    {
      scenarioId: 'p9-rules-tag-up-appeal-20260921',
      matchSeed: 20260921,
      startingMatchState: startingMatchState(3),
      scenarioBuilderId:
        'p9:rules:tag-up-appeal:v1',
      evidenceClass: 'rules',
      expectedFingerprint: 'd49f585e4b33fb17',
    },
  ]);

const buildFieldingReadEvidence = (
  scenario: FixedSeedRegressionScenario,
): unknown => applyBattedBallReadPredictionError(
  {
    estimate: {
      position: { x: 10, y: 3, z: 20 },
      velocity: { x: 4, y: -1, z: 8 },
    },
    sourceObservedAt: 900_000,
    predictedAt: 1_000_000,
    confidence: 0.82,
  },
  0.72,
  new DeterministicRng(scenario.matchSeed),
  {
    minimumPositionErrorMeters: 0.02,
    maximumPositionErrorMeters: 1.2,
    minimumVelocityErrorMps: 0.05,
    maximumVelocityErrorMps: 2.5,
  },
);

const buildRunnerMotionEvidence = (
  scenario: FixedSeedRegressionScenario,
): unknown => {
  const intentKind = (
    scenario.matchSeed % 2 === 0
      ? 'retreat'
      : 'advance'
  ) as 'retreat' | 'advance';

  const trajectory = buildRunnerMotionTrajectory(
    {
      tick: 1_000_000,
      routeDistanceMeters: 0.5,
      speedMps: 1.25,
      driveDirection: 1,
      bodyMode: 'upright',
    },
    {
      kind: intentKind,
      issuedTick: 1_000_000,
    },
    800_000,
    {
      ticksPerSecond: 1_000_000,
      reactionDelayTicks: 200_000,
      accelerationMps2: 4,
      brakingMps2: 4,
      slideDecelerationMps2: 5,
      topSpeedMps: 8,
    },
  );

  return {
    intentKind,
    sampleAt1350000: sampleRunnerMotionTrajectory(
      trajectory,
      1_350_000,
    ),
    endState: trajectory.endState,
  };
};

const buildTagUpAppealEvidence = (
  _scenario: FixedSeedRegressionScenario,
): unknown => {
  const compliance = evaluateTagUpCompliance({
    runnerId: 'runner-second',
    originBase: 2,
    firstTouch: createFlyBallFirstFielderTouchFact(
      'center-fielder',
      1_000_000,
    ),
    departure: createRunnerBaseDepartureFact(
      'runner-second',
      2,
      990_000,
    ),
    retouch: null,
  });
  const appeal =
    createDefensiveAppealAttemptFact(
      'shortstop',
      'runner-second',
      2,
      'tag_up_early_departure',
      1_300_000,
    );
  const appealWindow = closeAppealWindow(
    createAppealWindow(1_000_000),
    1_500_000,
    'next_pitch_or_play',
  );

  return {
    compliance,
    appealResult: resolveTagUpAppeal({
      compliance,
      appeal,
      window: appealWindow,
    }),
  };
};

export const P9_FIXED_SEED_BASELINE_BUILDERS:
  FixedSeedScenarioBuilderRegistry = {
    'p9:fielding:batted-ball-read:v1':
      buildFieldingReadEvidence,
    'p9:baserunning:runner-motion:v1':
      buildRunnerMotionEvidence,
    'p9:rules:tag-up-appeal:v1':
      buildTagUpAppealEvidence,
  };

export const runP9FixedSeedBaseline = (
): FixedSeedCorpusRunResult => (
  runFixedSeedRegressionCorpus(
    P9_FIXED_SEED_BASELINE_CORPUS,
    P9_FIXED_SEED_BASELINE_BUILDERS,
  )
);