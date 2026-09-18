import { describe, expect, it } from 'vitest';
import {
  buildPerceivedStealRaceCue,
} from './PerceivedStealRace';

describe('PerceivedStealRace', () => {
  it('composes pitcher quick, catcher transfer, throw flight, and tag timing into one perceived defender tag tick', () => {
    expect(buildPerceivedStealRaceCue({
      observedAt: 1_000_000,
      confidence: 0.9,
      runnerArrivalTick: 2_200_000,
      perceivedPitchCommitmentTick: 1_020_000,
      pitcherToCatcherTicks: 420_000,
      catcherTransferTicks: 160_000,
      throwFlightTicks: 620_000,
      fielderTagTicks: 80_000,
    })).toEqual({
      kind: 'next_base_race',
      observedAt: 1_000_000,
      confidence: 0.9,
      runnerArrivalTick: 2_200_000,
      defenderControlTick: 2_300_000,
    });
  });

  it('makes a quicker battery produce an earlier perceived defensive tag without changing runner arrival', () => {
    const slow = buildPerceivedStealRaceCue({
      observedAt: 1_000_000,
      confidence: 0.9,
      runnerArrivalTick: 2_200_000,
      perceivedPitchCommitmentTick: 1_020_000,
      pitcherToCatcherTicks: 500_000,
      catcherTransferTicks: 200_000,
      throwFlightTicks: 650_000,
      fielderTagTicks: 100_000,
    });
    const quick = buildPerceivedStealRaceCue({
      observedAt: 1_000_000,
      confidence: 0.9,
      runnerArrivalTick: 2_200_000,
      perceivedPitchCommitmentTick: 1_020_000,
      pitcherToCatcherTicks: 350_000,
      catcherTransferTicks: 120_000,
      throwFlightTicks: 580_000,
      fielderTagTicks: 70_000,
    });

    expect(quick.runnerArrivalTick)
      .toBe(slow.runnerArrivalTick);
    expect(quick.defenderControlTick)
      .toBeLessThan(
        slow.defenderControlTick as number,
      );
  });

  it('does not permit any component to start from future information relative to the observation', () => {
    expect(() => buildPerceivedStealRaceCue({
      observedAt: 1_000_000,
      confidence: 0.9,
      runnerArrivalTick: 2_200_000,
      perceivedPitchCommitmentTick: 999_999,
      pitcherToCatcherTicks: 420_000,
      catcherTransferTicks: 160_000,
      throwFlightTicks: 620_000,
      fielderTagTicks: 80_000,
    })).toThrow(
      'perceivedPitchCommitmentTick must be at or after observedAt',
    );
  });

  it('rejects invalid confidence and negative perceived durations', () => {
    expect(() => buildPerceivedStealRaceCue({
      observedAt: 1_000_000,
      confidence: 1.1,
      runnerArrivalTick: 2_200_000,
      perceivedPitchCommitmentTick: 1_020_000,
      pitcherToCatcherTicks: 420_000,
      catcherTransferTicks: 160_000,
      throwFlightTicks: 620_000,
      fielderTagTicks: 80_000,
    })).toThrow(
      'confidence must be finite and within [0, 1]',
    );

    expect(() => buildPerceivedStealRaceCue({
      observedAt: 1_000_000,
      confidence: 0.9,
      runnerArrivalTick: 2_200_000,
      perceivedPitchCommitmentTick: 1_020_000,
      pitcherToCatcherTicks: -1,
      catcherTransferTicks: 160_000,
      throwFlightTicks: 620_000,
      fielderTagTicks: 80_000,
    })).toThrow(
      'pitcherToCatcherTicks must be a non-negative safe integer tick duration',
    );
  });
});
