import { describe, expect, it } from 'vitest';
import {
  createDefensiveRatingProfile,
  createDefensiveRatings,
  getPublicDefensiveRatings,
} from './DefensiveRatings';
import {
  deriveRatedDefenderMotionParameters,
} from '../sim/fielding/DefensiveRatingAdapters';

const internal = createDefensiveRatings({
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
  acceleration: 0.7,
  battedBallRead: 0.8,
  routeEfficiency: 0.75,
  catching: 0.85,
  transfer: 0.65,
  armStrength: 0.9,
  throwingAccuracy: 0.8,
  situationalAwareness: 0.7,
  tagSkill: 0.6,
});

describe('DefensiveRatingProfile public/internal boundary', () => {
  it('exposes public defense summary while sharing arm strength and position suitability from the internal source of truth', () => {
    const profile = createDefensiveRatingProfile({
      publicDefenseRating: 0.82,
      internal,
    });

    expect(getPublicDefensiveRatings(profile)).toEqual({
      defense: 0.82,
      armStrength: 0.9,
      positionSuitability:
        internal.positionSuitability,
    });
  });

  it('lets public defense summary differ without altering any physical rating input', () => {
    const lowDisplay = createDefensiveRatingProfile({
      publicDefenseRating: 0.2,
      internal,
    });
    const highDisplay = createDefensiveRatingProfile({
      publicDefenseRating: 0.95,
      internal,
    });

    expect(lowDisplay.internal)
      .toBe(highDisplay.internal);

    const base = {
      ticksPerSecond: 1_000_000,
      maxIntegrationStepTicks: 10_000,
      accelerationMps2: 4,
      brakingMps2: 5,
      topSpeedMps: 8,
      arrivalRadiusMeters: 0.2,
    } as const;
    const calibration = {
      lowestAbilityAccelerationMps2: 2,
      highestAbilityAccelerationMps2: 6,
    } as const;

    expect(deriveRatedDefenderMotionParameters(
      base,
      lowDisplay.internal,
      calibration,
    )).toEqual(
      deriveRatedDefenderMotionParameters(
        base,
        highDisplay.internal,
        calibration,
      ),
    );
  });

  it('validates the public defense summary as a normalized display rating', () => {
    expect(() => createDefensiveRatingProfile({
      publicDefenseRating: 1.1,
      internal,
    })).toThrow(
      'rating must be finite and within [0, 1]',
    );
  });
});
