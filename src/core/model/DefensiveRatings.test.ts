import { describe, expect, it } from 'vitest';
import {
  createDefensiveRatings,
  createNormalizedRating,
} from './DefensiveRatings';

const positionSuitability = {
  P: 0.2,
  C: 0.1,
  '1B': 0.7,
  '2B': 0.8,
  '3B': 0.9,
  SS: 1,
  LF: 0.6,
  CF: 0.5,
  RF: 0.6,
} as const;

describe('DefensiveRatings', () => {
  it('creates one validated normalized defensive ability schema', () => {
    const ratings = createDefensiveRatings({
      positionSuitability,
      firstStep: 0.8,
      acceleration: 0.7,
      battedBallRead: 0.9,
      routeEfficiency: 0.75,
      catching: 0.85,
      transfer: 0.65,
      armStrength: 0.8,
      throwingAccuracy: 0.9,
      situationalAwareness: 0.7,
      tagSkill: 0.6,
    });

    expect(ratings).toEqual({
      positionSuitability,
      firstStep: 0.8,
      acceleration: 0.7,
      battedBallRead: 0.9,
      routeEfficiency: 0.75,
      catching: 0.85,
      transfer: 0.65,
      armStrength: 0.8,
      throwingAccuracy: 0.9,
      situationalAwareness: 0.7,
      tagSkill: 0.6,
    });
  });

  it('accepts the full closed unit interval', () => {
    expect(createNormalizedRating(0)).toBe(0);
    expect(createNormalizedRating(1)).toBe(1);
  });

  it('rejects ratings outside [0, 1] and non-finite values', () => {
    expect(() => createNormalizedRating(-0.001))
      .toThrow(
        'rating must be finite and within [0, 1]',
      );
    expect(() => createNormalizedRating(1.001))
      .toThrow(
        'rating must be finite and within [0, 1]',
      );
    expect(() => createNormalizedRating(Number.NaN))
      .toThrow(
        'rating must be finite and within [0, 1]',
      );
  });

  it('requires explicit suitability for all nine defensive positions', () => {
    const missingRf: Partial<
      typeof positionSuitability
    > = {
      ...positionSuitability,
    };
    delete missingRf.RF;

    expect(() => createDefensiveRatings({
      positionSuitability:
        missingRf as typeof positionSuitability,
      firstStep: 0.8,
      acceleration: 0.7,
      battedBallRead: 0.9,
      routeEfficiency: 0.75,
      catching: 0.85,
      transfer: 0.65,
      armStrength: 0.8,
      throwingAccuracy: 0.9,
      situationalAwareness: 0.7,
      tagSkill: 0.6,
    })).toThrow(
      'positionSuitability must explicitly contain all nine defensive positions',
    );
  });

  it('does not contain a direct success, out, catch, or safe probability field', () => {
    const ratings = createDefensiveRatings({
      positionSuitability,
      firstStep: 0.8,
      acceleration: 0.7,
      battedBallRead: 0.9,
      routeEfficiency: 0.75,
      catching: 0.85,
      transfer: 0.65,
      armStrength: 0.8,
      throwingAccuracy: 0.9,
      situationalAwareness: 0.7,
      tagSkill: 0.6,
    });

    expect(Object.keys(ratings).sort()).toEqual([
      'acceleration',
      'armStrength',
      'battedBallRead',
      'catching',
      'firstStep',
      'positionSuitability',
      'routeEfficiency',
      'situationalAwareness',
      'tagSkill',
      'throwingAccuracy',
      'transfer',
    ]);
  });
});
