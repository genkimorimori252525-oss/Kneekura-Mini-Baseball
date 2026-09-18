import { describe, expect, it } from 'vitest';
import {
  createDefensiveRatings,
} from '../../model/DefensiveRatings';
import type {
  PlayerPerceivedWorldState,
} from '../perception/PlayerPerceivedWorldState';
import type {
  DefensiveDecisionInput,
  DefensiveKnownContext,
} from './DefensiveDecision';
import {
  createRatedTeamCoveragePlan,
  type RatedDefenderCoverageInput,
} from './RatedTeamCoveragePlan';

const ratings = (
  position: 'P' | '1B',
  suitability: number,
) => createDefensiveRatings({
  positionSuitability: {
    P: position === 'P' ? suitability : 0.5,
    C: 0.5,
    '1B': position === '1B' ? suitability : 0.5,
    '2B': 0.5,
    '3B': 0.5,
    SS: 0.5,
    LF: 0.5,
    CF: 0.5,
    RF: 0.5,
  },
  firstStep: 0.5,
  acceleration: 0.5,
  battedBallRead: 0.5,
  routeEfficiency: 0.5,
  catching: 0.5,
  transfer: 0.5,
  armStrength: 0.5,
  throwingAccuracy: 0.5,
  situationalAwareness: 0.5,
  tagSkill: 0.5,
});

const world = (
  observerId: string,
  withBall: boolean,
): PlayerPerceivedWorldState<DefensiveKnownContext> => ({
  observerId,
  observationTime: 1_200_000,
  attention: {
    target: { kind: 'ball' },
    focusedSinceTick: 1_000_000,
  },
  ball: withBall ? {
    estimate: {
      position: { x: 6, y: 0.5, z: 8 },
      velocity: { x: 2, y: -1, z: 3 },
    },
    sourceObservedAt: 1_150_000,
    predictedAt: 1_200_000,
    confidence: 0.9,
  } : null,
  players: [],
  communications: [],
  knownContext: {
    outs: 0,
    occupiedBases: [],
  },
});

const input = (
  playerId: string,
  registeredPosition:
    RatedDefenderCoverageInput['decisionInput']['self']['registeredPosition'],
  ballPriority: number,
  withBall: boolean,
): DefensiveDecisionInput => ({
  perceivedWorld: world(playerId, withBall),
  self: {
    playerId,
    registeredPosition,
    position: { x: 0, z: 0 },
  },
  prePlayPlan: {
    ballPursuitPriority: ballPriority,
    baseCoverPriorities: [],
    relayPriority: 0,
    backupPriority: 0,
    deepCoveragePriority: 0,
    holdPriority: 0.1,
  },
  perceivedCues: [],
  minimumCueConfidence: 0.5,
  communicationTrust: 1,
});

const filler = (
  playerId: string,
  registeredPosition:
    RatedDefenderCoverageInput['decisionInput']['self']['registeredPosition'],
): RatedDefenderCoverageInput => ({
  decisionInput: input(
    playerId,
    registeredPosition,
    0,
    false,
  ),
  ratings: createDefensiveRatings({
    positionSuitability: {
      P: 0.5,
      C: 0.5,
      '1B': 0.5,
      '2B': 0.5,
      '3B': 0.5,
      SS: 0.5,
      LF: 0.5,
      CF: 0.5,
      RF: 0.5,
    },
    firstStep: 0.5,
    acceleration: 0.5,
    battedBallRead: 0.5,
    routeEfficiency: 0.5,
    catching: 0.5,
    transfer: 0.5,
    armStrength: 0.5,
    throwingAccuracy: 0.5,
    situationalAwareness: 0.5,
    tagSkill: 0.5,
  }),
});

const calibration = {
  roleSensitivity: {
    ball_handler: 1,
    base_cover: 0.6,
    relay: 0.7,
    backup: 0.4,
    deep_coverage: 0.8,
    hold: 0,
  },
  minimumSuitabilityFactor: 0.5,
} as const;

describe('RatedTeamCoveragePlan', () => {
  it('builds the team plan from each defenders locally generated candidates', () => {
    const defenders: readonly RatedDefenderCoverageInput[] = [
      {
        decisionInput: input('p', 'P', 0.7, true),
        ratings: ratings('P', 1),
      },
      {
        decisionInput: input('1b', '1B', 0.8, true),
        ratings: ratings('1B', 0),
      },
      filler('c', 'C'),
      filler('2b', '2B'),
      filler('3b', '3B'),
      filler('ss', 'SS'),
      filler('lf', 'LF'),
      filler('cf', 'CF'),
      filler('rf', 'RF'),
    ];

    const plan = createRatedTeamCoveragePlan({
      defenders,
      requireBallHandler: true,
      positionSuitabilityCalibration:
        calibration,
    });

    expect(
      plan.assignments.find(
        (assignment) => assignment.intent.kind === 'ball_handler',
      )?.playerId,
    ).toBe('p');
  });

  it('cannot invent a ball-handler candidate for a defender whose perceived world has no ball', () => {
    const defenders: readonly RatedDefenderCoverageInput[] = [
      {
        decisionInput: input('p', 'P', 1, false),
        ratings: ratings('P', 1),
      },
      {
        decisionInput: input('1b', '1B', 0.8, true),
        ratings: ratings('1B', 1),
      },
      filler('c', 'C'),
      filler('2b', '2B'),
      filler('3b', '3B'),
      filler('ss', 'SS'),
      filler('lf', 'LF'),
      filler('cf', 'CF'),
      filler('rf', 'RF'),
    ];

    const plan = createRatedTeamCoveragePlan({
      defenders,
      requireBallHandler: true,
      positionSuitabilityCalibration:
        calibration,
    });

    expect(
      plan.assignments.find(
        (assignment) => assignment.intent.kind === 'ball_handler',
      )?.playerId,
    ).toBe('1b');
  });
});
