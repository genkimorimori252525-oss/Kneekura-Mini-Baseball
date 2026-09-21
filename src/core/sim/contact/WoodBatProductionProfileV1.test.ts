import { describe, expect, it } from 'vitest';
import {
  resolveWoodBatSpeedResponse,
  validateWoodBatSpeedResponseProfile,
} from './WoodBatSpeedResponseProfile';
import {
  NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_SCOPE,
  NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1,
} from './WoodBatProductionProfileV1';

describe('wood bat production profile v1', () => {
  it('freezes one same-fixture high-speed fit instead of a cross-study interpolation', () => {
    expect(() =>
      validateWoodBatSpeedResponseProfile(
        NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1,
      ),
    ).not.toThrow();

    expect(
      NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_SCOPE
        .fixture,
    ).toBe(
      'rigidly-mounted-three-inch-wood-cylinder',
    );
    expect(
      NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_SCOPE
        .fittedNonGrossSlipImpactCount,
    ).toBe(47);

    const low =
      NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1
        .normalRestitutionKnots[0]!;
    const high =
      NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1
        .normalRestitutionKnots[1]!;

    expect(low.relativeImpactSpeedMps)
      .toBeCloseTo(37.9984, 10);
    expect(high.relativeImpactSpeedMps)
      .toBeCloseTo(53.6448, 10);
    expect(low.normalRestitution).toBe(0.52);
    expect(high.normalRestitution).toBe(0.52);
  });

  it('uses the fitted tangential response and gross-slip friction without extrapolating a new speed law', () => {
    for (const speed of [
      20,
      37.9984,
      45,
      53.6448,
      70,
    ]) {
      const resolved =
        resolveWoodBatSpeedResponse(
          NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1,
          speed,
        );

      expect(resolved.normalRestitution)
        .toBeCloseTo(0.52, 12);
      expect(resolved.tangentialRestitution)
        .toBeCloseTo(0.30, 12);
      expect(resolved.frictionCoefficient)
        .toBeCloseTo(0.15, 12);
    }
  });
});
