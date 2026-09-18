import { describe, expect, it } from 'vitest';
import {
  aggregateValidationOutcomes,
} from './BatchValidationStatistics';

describe('BatchValidationStatistics', () => {
  it('aggregates canonical validation outcomes without introducing baseball-result logic', () => {
    const result = aggregateValidationOutcomes([
      {
        classification: 'out',
        runsAllowed: 0,
        extraBasesAllowed: 0,
      },
      {
        classification: 'single',
        runsAllowed: 0,
        extraBasesAllowed: 1,
      },
      {
        classification: 'double',
        runsAllowed: 1,
        extraBasesAllowed: 2,
      },
      {
        classification: 'home_run',
        runsAllowed: 1,
        extraBasesAllowed: 0,
      },
      {
        classification: 'error',
        runsAllowed: 0,
        extraBasesAllowed: 1,
      },
    ]);

    expect(result).toEqual({
      samples: 5,
      outs: 1,
      hits: 3,
      singles: 1,
      doubles: 1,
      triples: 0,
      homeRuns: 1,
      errors: 1,
      fieldersChoices: 0,
      totalBases: 7,
      runsAllowed: 2,
      extraBasesAllowed: 4,
      fieldableBalls: 4,
      hitsOnFieldableBalls: 2,
      fieldableHitRate: 0.5,
      outRate: 0.2,
      runsAllowedPerSample: 0.4,
    });
  });

  it('returns null rates where a denominator does not exist', () => {
    expect(aggregateValidationOutcomes([])).toEqual({
      samples: 0,
      outs: 0,
      hits: 0,
      singles: 0,
      doubles: 0,
      triples: 0,
      homeRuns: 0,
      errors: 0,
      fieldersChoices: 0,
      totalBases: 0,
      runsAllowed: 0,
      extraBasesAllowed: 0,
      fieldableBalls: 0,
      hitsOnFieldableBalls: 0,
      fieldableHitRate: null,
      outRate: null,
      runsAllowedPerSample: null,
    });
  });

  it('rejects invalid negative aggregate evidence', () => {
    expect(() => aggregateValidationOutcomes([{
      classification: 'out',
      runsAllowed: -1,
      extraBasesAllowed: 0,
    }])).toThrow(
      'runsAllowed must be finite and non-negative',
    );
  });
});
