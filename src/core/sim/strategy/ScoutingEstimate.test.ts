import { describe, expect, it } from 'vitest';
import {
  buildScoutingEstimate,
} from './ScoutingEstimate';

const prior = {
  directionDistribution: {
    pull: 1 / 3,
    middle: 1 / 3,
    opposite: 1 / 3,
  },
  trajectoryDistribution: {
    ground: 0.4,
    line: 0.2,
    fly: 0.3,
    popup: 0.1,
  },
} as const;

const parameters = {
  priorWeight: 2,
  recencyDecayPerObservation: 0.2,
} as const;

describe('ScoutingEstimate', () => {
  it('returns the prior with maximum uncertainty when no observations exist', () => {
    expect(buildScoutingEstimate({
      observations: [],
      currentSequence: 100,
      prior,
      parameters,
    })).toEqual({
      directionDistribution:
        prior.directionDistribution,
      trajectoryDistribution:
        prior.trajectoryDistribution,
      uncertainty: 1,
      effectiveSampleSize: 0,
      sampleAgeObservations: null,
      observationCount: 0,
    });
  });

  it('updates from observed batted balls without any true-tendency input', () => {
    const result = buildScoutingEstimate({
      observations: [
        {
          direction: 'pull',
          trajectory: 'ground',
          observedAtSequence: 99,
        },
        {
          direction: 'pull',
          trajectory: 'line',
          observedAtSequence: 100,
        },
      ],
      currentSequence: 100,
      prior,
      parameters,
    });

    expect(result.directionDistribution.pull)
      .toBeGreaterThan(1 / 3);
    expect(result.trajectoryDistribution.ground)
      .toBeGreaterThan(0);
    expect(result.uncertainty).toBeLessThan(1);
    expect(result.effectiveSampleSize)
      .toBeGreaterThan(0);
    expect(result.observationCount).toBe(2);
  });

  it('lets different observation histories produce different estimates for the same unseen hitter truth', () => {
    const pullHistory = buildScoutingEstimate({
      observations: [
        {
          direction: 'pull',
          trajectory: 'ground',
          observedAtSequence: 10,
        },
        {
          direction: 'pull',
          trajectory: 'ground',
          observedAtSequence: 11,
        },
      ],
      currentSequence: 11,
      prior,
      parameters,
    });
    const oppositeHistory = buildScoutingEstimate({
      observations: [
        {
          direction: 'opposite',
          trajectory: 'fly',
          observedAtSequence: 10,
        },
        {
          direction: 'opposite',
          trajectory: 'fly',
          observedAtSequence: 11,
        },
      ],
      currentSequence: 11,
      prior,
      parameters,
    });

    expect(pullHistory.directionDistribution.pull)
      .toBeGreaterThan(
        oppositeHistory.directionDistribution.pull,
      );
    expect(oppositeHistory.directionDistribution.opposite)
      .toBeGreaterThan(
        pullHistory.directionDistribution.opposite,
      );
  });

  it('downweights old observations relative to recent ones', () => {
    const recentPull = buildScoutingEstimate({
      observations: [{
        direction: 'pull',
        trajectory: 'ground',
        observedAtSequence: 100,
      }],
      currentSequence: 100,
      prior,
      parameters,
    });
    const oldPull = buildScoutingEstimate({
      observations: [{
        direction: 'pull',
        trajectory: 'ground',
        observedAtSequence: 90,
      }],
      currentSequence: 100,
      prior,
      parameters,
    });

    expect(recentPull.directionDistribution.pull)
      .toBeGreaterThan(
        oldPull.directionDistribution.pull,
      );
    expect(recentPull.effectiveSampleSize)
      .toBeGreaterThan(oldPull.effectiveSampleSize);
    expect(oldPull.sampleAgeObservations).toBe(10);
  });

  it('rejects observations from the future', () => {
    expect(() => buildScoutingEstimate({
      observations: [{
        direction: 'middle',
        trajectory: 'line',
        observedAtSequence: 101,
      }],
      currentSequence: 100,
      prior,
      parameters,
    })).toThrow(
      'observedAtSequence must not exceed currentSequence',
    );
  });
});
