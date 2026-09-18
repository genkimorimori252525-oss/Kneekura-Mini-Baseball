import { describe, expect, it } from 'vitest';
import {
  createDefensiveRatings,
} from '../../model/DefensiveRatings';
import {
  DeterministicRng,
} from '../../rng/DeterministicRng';
import type {
  PerceivedGloveTargetAssessment,
} from './PerceivedGloveTarget';
import {
  deriveRatedCatchRetentionParameters,
  deriveRatedDefenderMotionParameters,
  getRatedPositionSuitability,
  resolveRatedCatchExecutionTarget,
  resolveRatedDefensiveDecisionTiming,
} from './DefensiveRatingAdapters';

const createRatings = (
  overrides: Partial<{
    acceleration: number;
    catching: number;
    situationalAwareness: number;
  }> = {},
) => createDefensiveRatings({
  positionSuitability: {
    P: 0.2,
    C: 0.3,
    '1B': 0.8,
    '2B': 0.7,
    '3B': 0.6,
    SS: 0.9,
    LF: 0.5,
    CF: 0.4,
    RF: 0.5,
  },
  firstStep: 0.6,
  acceleration: overrides.acceleration ?? 0.5,
  battedBallRead: 0.6,
  routeEfficiency: 0.6,
  catching: overrides.catching ?? 0.5,
  transfer: 0.5,
  armStrength: 0.5,
  throwingAccuracy: 0.5,
  situationalAwareness:
    overrides.situationalAwareness ?? 0.5,
  tagSkill: 0.5,
});

describe('DefensiveRatingAdapters', () => {
  it('maps acceleration only into the existing motion acceleration parameter', () => {
    const base = {
      ticksPerSecond: 1_000_000,
      maxIntegrationStepTicks: 10_000,
      accelerationMps2: 4,
      brakingMps2: 5,
      topSpeedMps: 8,
      arrivalRadiusMeters: 0.2,
    } as const;

    const low = deriveRatedDefenderMotionParameters(
      base,
      createRatings({ acceleration: 0 }),
      {
        lowestAbilityAccelerationMps2: 2,
        highestAbilityAccelerationMps2: 6,
      },
    );
    const high = deriveRatedDefenderMotionParameters(
      base,
      createRatings({ acceleration: 1 }),
      {
        lowestAbilityAccelerationMps2: 2,
        highestAbilityAccelerationMps2: 6,
      },
    );

    expect(low.accelerationMps2).toBe(2);
    expect(high.accelerationMps2).toBe(6);
    expect({
      ...low,
      accelerationMps2: base.accelerationMps2,
    }).toEqual(base);
    expect({
      ...high,
      accelerationMps2: base.accelerationMps2,
    }).toEqual(base);
  });

  it('uses catching only as the existing catch-execution ability input', () => {
    const target: PerceivedGloveTargetAssessment = {
      plannedFromTick: 1_000_000,
      targetTick: 1_100_000,
      ticksPerSecond: 1_000_000,
      predictedBallPosition: { x: 1, y: 1, z: 0 },
      predictedBodyPosition: { x: 0, y: 1, z: 0 },
      desiredOffset: { x: 1, y: 0, z: 0 },
      reachDistanceMeters: 1,
      maximumReachMeters: 1.5,
      withinReach: true,
      sourceBallConfidence: 0.8,
      sourceObservedAt: 950_000,
    };
    const calibration = {
      minimumTargetErrorMeters: 0.01,
      maximumTargetErrorMeters: 0.11,
    };

    const low = resolveRatedCatchExecutionTarget(
      target,
      createRatings({ catching: 0 }),
      new DeterministicRng(123),
      calibration,
    );
    const high = resolveRatedCatchExecutionTarget(
      target,
      createRatings({ catching: 1 }),
      new DeterministicRng(123),
      calibration,
    );

    expect(low.errorScaleMeters).toBeCloseTo(0.11, 12);
    expect(high.errorScaleMeters).toBeCloseTo(0.01, 12);
    expect(low.sourceBallConfidence)
      .toBe(high.sourceBallConfidence);
    expect(low.maximumReachMeters)
      .toBe(high.maximumReachMeters);
  });

  it('uses catching for retention capacity without changing the supplied base geometry', () => {
    const base = {
      gloveRadiusMeters: 0.08,
      ballRadiusMeters: 0.0366,
      centerRetentionCapacityJ: 8,
      captureDissipationPowerW: 20,
      edgeRetentionFactor: 0.6,
    } as const;
    const calibration = {
      lowAbilityCenterRetentionCapacityMultiplier: 0.5,
      highAbilityCenterRetentionCapacityMultiplier: 1.5,
      lowAbilityCaptureDissipationPowerMultiplier: 0.7,
      highAbilityCaptureDissipationPowerMultiplier: 1.3,
    } as const;

    const low = deriveRatedCatchRetentionParameters(
      base,
      createRatings({ catching: 0 }),
      calibration,
    );
    const high = deriveRatedCatchRetentionParameters(
      base,
      createRatings({ catching: 1 }),
      calibration,
    );

    expect(low.gloveRadiusMeters).toBe(base.gloveRadiusMeters);
    expect(high.gloveRadiusMeters).toBe(base.gloveRadiusMeters);
    expect(low.ballRadiusMeters).toBe(base.ballRadiusMeters);
    expect(high.ballRadiusMeters).toBe(base.ballRadiusMeters);
    expect(low.centerRetentionCapacityJ).toBe(4);
    expect(high.centerRetentionCapacityJ).toBe(12);
  });

  it('uses situational awareness only to change decision timing', () => {
    const parameters = {
      minimumDecisionDelayTicks: 20_000,
      maximumDecisionDelayTicks: 100_000,
      fixedProcessingOffsetTicks: 5_000,
    } as const;

    const low = resolveRatedDefensiveDecisionTiming(
      1_000_000,
      createRatings({
        situationalAwareness: 0,
      }),
      parameters,
    );
    const high = resolveRatedDefensiveDecisionTiming(
      1_000_000,
      createRatings({
        situationalAwareness: 1,
      }),
      parameters,
    );

    expect(low).toEqual({
      evidenceAvailableAt: 1_000_000,
      decisionDelayTicks: 105_000,
      decisionTick: 1_105_000,
    });
    expect(high).toEqual({
      evidenceAvailableAt: 1_000_000,
      decisionDelayTicks: 25_000,
      decisionTick: 1_025_000,
    });
  });

  it('returns explicit registered-position suitability without altering another rating', () => {
    const ratings = createRatings();

    expect(getRatedPositionSuitability(
      ratings,
      'SS',
    )).toBe(0.9);
    expect(ratings.catching).toBe(0.5);
  });
});
