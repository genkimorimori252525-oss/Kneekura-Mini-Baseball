import { describe, expect, it } from 'vitest';
import type {
  CanonicalGroundBallFirstBaseOutcome,
} from '../sim/plateAppearance/GroundBallProductionOutcomeCoordinator';
import {
  aggregateProductionOutcomeObservations,
  observeGroundBallProductionOutcomeForValidation,
} from './ProductionOutcomeStatisticsBridge';

const completedOut = (): CanonicalGroundBallFirstBaseOutcome => ({
  kind: 'completed',
  classification: 'batter_runner_out_before_first',
  canonicalResult: {
    playEnd: {
      kind: 'play_end',
      tick: 120,
      reason: 'live_action_complete',
    },
    outsAfter: 1,
    basesAfter: {
      first: null,
      second: null,
      third: null,
    },
    scoredRunnerIds: [],
    officialOutcome: {
      kind: 'supported',
      classification: 'batter_runner_out_before_first',
    },
  },
  pickup: null as never,
  transfer: null as never,
  throwExecution: null as never,
  physicalRace: null as never,
  completion: null as never,
});

const nonterminal = (): CanonicalGroundBallFirstBaseOutcome => ({
  kind: 'live_ball_continues',
  reason: 'first_base_race_non_terminal',
  pickup: null,
  transfer: null,
  throwExecution: null,
  physicalRace: null,
});

describe('ProductionOutcomeStatisticsBridge', () => {
  it('observes supported production truth without reclassifying it probabilistically', () => {
    expect(
      observeGroundBallProductionOutcomeForValidation(
        completedOut(),
      ),
    ).toEqual({
      kind: 'supported',
      outcome: {
        classification: 'out',
        runsAllowed: 0,
        extraBasesAllowed: 0,
      },
    });
  });

  it('keeps unsupported/nonterminal production outcomes explicit instead of guessing a hit bucket', () => {
    expect(
      observeGroundBallProductionOutcomeForValidation(
        nonterminal(),
      ),
    ).toEqual({
      kind: 'unsupported',
      reason: 'play_not_terminal',
    });
  });

  it('aggregates only supported production observations and reports exclusions separately', () => {
    const observations = [
      observeGroundBallProductionOutcomeForValidation(
        completedOut(),
      ),
      observeGroundBallProductionOutcomeForValidation(
        nonterminal(),
      ),
      observeGroundBallProductionOutcomeForValidation(
        nonterminal(),
      ),
    ];

    const result = aggregateProductionOutcomeObservations(
      observations,
    );

    expect(result).toMatchObject({
      observedSamples: 3,
      supportedSamples: 1,
      unsupportedSamples: 2,
      unsupportedReasons: {
        play_not_terminal: 2,
      },
      statistics: {
        samples: 1,
        outs: 1,
        hits: 0,
        singles: 0,
        doubles: 0,
        triples: 0,
        homeRuns: 0,
      },
    });
  });
});