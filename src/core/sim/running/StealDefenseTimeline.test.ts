import { describe, expect, it } from 'vitest';
import {
  createDefensiveRatings,
} from '../../model/DefensiveRatings';
import {
  buildStealDefenseTimeline,
} from './StealDefenseTimeline';

const ratings = (
  transfer: number,
  tagSkill: number,
) => createDefensiveRatings({
  positionSuitability: {
    P: 0.5,
    C: 0.8,
    '1B': 0.5,
    '2B': 0.8,
    '3B': 0.5,
    SS: 0.8,
    LF: 0.5,
    CF: 0.5,
    RF: 0.5,
  },
  firstStep: 0.5,
  acceleration: 0.5,
  battedBallRead: 0.5,
  routeEfficiency: 0.5,
  catching: 0.5,
  transfer,
  armStrength: 0.5,
  throwingAccuracy: 0.5,
  situationalAwareness: 0.5,
  tagSkill,
});

const transferParameters = {
  minimumTransferDelayTicks: 80_000,
  maximumTransferDelayTicks: 260_000,
  fixedGripOffsetTicks: 20_000,
} as const;

const tagParameters = {
  minimumTagActionDelayTicks: 30_000,
  maximumTagActionDelayTicks: 140_000,
  fixedPossessionOffsetTicks: 10_000,
} as const;

describe('StealDefenseTimeline', () => {
  it('composes pitch-to-catcher, catcher transfer, throw reception, and fielder tag readiness', () => {
    expect(buildStealDefenseTimeline({
      pitchCommitmentTick: 1_000_000,
      catcherSecuredPossessionTick: 1_420_000,
      catcherRatings: ratings(0.5, 0.5),
      receiverSecuredPossessionTick: 2_160_000,
      receiverRatings: ratings(0.5, 0.75),
      transferParameters,
      tagParameters,
    })).toEqual({
      pitchCommitmentTick: 1_000_000,
      catcherSecuredPossessionTick: 1_420_000,
      pitchToCatcherTicks: 420_000,
      catcherThrowReadyTick: 1_610_000,
      catcherTransferDelayTicks: 190_000,
      receiverSecuredPossessionTick: 2_160_000,
      throwReceptionElapsedTicks: 550_000,
      tagActionStartTick: 2_227_500,
      tagActionDelayTicks: 67_500,
    });
  });

  it('lets catcher transfer skill alter throw-ready time without changing actual reception evidence', () => {
    const slow = buildStealDefenseTimeline({
      pitchCommitmentTick: 1_000_000,
      catcherSecuredPossessionTick: 1_420_000,
      catcherRatings: ratings(0, 0.5),
      receiverSecuredPossessionTick: 2_300_000,
      receiverRatings: ratings(0.5, 0.5),
      transferParameters,
      tagParameters,
    });
    const fast = buildStealDefenseTimeline({
      pitchCommitmentTick: 1_000_000,
      catcherSecuredPossessionTick: 1_420_000,
      catcherRatings: ratings(1, 0.5),
      receiverSecuredPossessionTick: 2_300_000,
      receiverRatings: ratings(0.5, 0.5),
      transferParameters,
      tagParameters,
    });

    expect(fast.catcherThrowReadyTick)
      .toBeLessThan(slow.catcherThrowReadyTick);
    expect(fast.receiverSecuredPossessionTick)
      .toBe(slow.receiverSecuredPossessionTick);
  });

  it('lets tag skill alter tag-action start after the same secured reception', () => {
    const slow = buildStealDefenseTimeline({
      pitchCommitmentTick: 1_000_000,
      catcherSecuredPossessionTick: 1_420_000,
      catcherRatings: ratings(0.5, 0.5),
      receiverSecuredPossessionTick: 2_160_000,
      receiverRatings: ratings(0.5, 0),
      transferParameters,
      tagParameters,
    });
    const fast = buildStealDefenseTimeline({
      pitchCommitmentTick: 1_000_000,
      catcherSecuredPossessionTick: 1_420_000,
      catcherRatings: ratings(0.5, 0.5),
      receiverSecuredPossessionTick: 2_160_000,
      receiverRatings: ratings(0.5, 1),
      transferParameters,
      tagParameters,
    });

    expect(fast.tagActionStartTick)
      .toBeLessThan(slow.tagActionStartTick);
    expect(fast.receiverSecuredPossessionTick)
      .toBe(slow.receiverSecuredPossessionTick);
  });

  it('rejects an impossible reception before the catcher is physically throw-ready', () => {
    expect(() => buildStealDefenseTimeline({
      pitchCommitmentTick: 1_000_000,
      catcherSecuredPossessionTick: 1_420_000,
      catcherRatings: ratings(0, 0.5),
      receiverSecuredPossessionTick: 1_500_000,
      receiverRatings: ratings(0.5, 0.5),
      transferParameters,
      tagParameters,
    })).toThrow(
      'receiverSecuredPossessionTick must be at or after catcherThrowReadyTick',
    );
  });
});
