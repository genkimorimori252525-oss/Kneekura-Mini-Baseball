import { describe, expect, it } from 'vitest';
import {
  buildPerceivedPickoffThreatCue,
} from './PerceivedPickoffThreat';

describe('PerceivedPickoffThreat', () => {
  it('composes pitcher move, throw, and tag timing into a current-base threat cue', () => {
    expect(buildPerceivedPickoffThreatCue({
      observedAt: 1_000_000,
      confidence: 0.92,
      runnerReturnTick: 1_420_000,
      perceivedPickoffCommitmentTick: 1_020_000,
      pitcherReleaseDelayTicks: 90_000,
      throwFlightTicks: 180_000,
      fielderTagTicks: 70_000,
    })).toEqual({
      kind: 'current_base_threat',
      observedAt: 1_000_000,
      confidence: 0.92,
      runnerReturnTick: 1_420_000,
      defenderTagTick: 1_360_000,
    });
  });

  it('makes a quicker pickoff move produce an earlier perceived tag without changing runner return timing', () => {
    const slow = buildPerceivedPickoffThreatCue({
      observedAt: 1_000_000,
      confidence: 0.9,
      runnerReturnTick: 1_420_000,
      perceivedPickoffCommitmentTick: 1_020_000,
      pitcherReleaseDelayTicks: 150_000,
      throwFlightTicks: 210_000,
      fielderTagTicks: 80_000,
    });
    const quick = buildPerceivedPickoffThreatCue({
      observedAt: 1_000_000,
      confidence: 0.9,
      runnerReturnTick: 1_420_000,
      perceivedPickoffCommitmentTick: 1_020_000,
      pitcherReleaseDelayTicks: 70_000,
      throwFlightTicks: 180_000,
      fielderTagTicks: 60_000,
    });

    expect(quick.runnerReturnTick)
      .toBe(slow.runnerReturnTick);
    expect(quick.defenderTagTick)
      .toBeLessThan(slow.defenderTagTick);
  });

  it('rejects future-leaking chronology and invalid durations', () => {
    expect(() => buildPerceivedPickoffThreatCue({
      observedAt: 1_000_000,
      confidence: 0.9,
      runnerReturnTick: 1_420_000,
      perceivedPickoffCommitmentTick: 999_999,
      pitcherReleaseDelayTicks: 90_000,
      throwFlightTicks: 180_000,
      fielderTagTicks: 70_000,
    })).toThrow(
      'perceivedPickoffCommitmentTick must be at or after observedAt',
    );

    expect(() => buildPerceivedPickoffThreatCue({
      observedAt: 1_000_000,
      confidence: 0.9,
      runnerReturnTick: 1_420_000,
      perceivedPickoffCommitmentTick: 1_020_000,
      pitcherReleaseDelayTicks: 90_000,
      throwFlightTicks: -1,
      fielderTagTicks: 70_000,
    })).toThrow(
      'throwFlightTicks must be a non-negative safe integer tick duration',
    );
  });
});
