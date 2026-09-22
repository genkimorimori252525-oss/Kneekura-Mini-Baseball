import { describe, expect, it } from 'vitest';
import {
  HIRONO_2025_WOOD_BAT_SPEED_RESPONSE_EVIDENCE,
  resolveWoodBatSpeedResponse,
  validateWoodBatSpeedResponseProfile,
  type WoodBatSpeedResponseProfile,
} from './WoodBatSpeedResponseProfile';

const profile:
  WoodBatSpeedResponseProfile = {
    profileId: 'measured-bat-A',
    version: 'fixture-v1',
    normalRestitutionKnots: [
      {
        relativeImpactSpeedMps: 35,
        normalRestitution: 0.50,
      },
      {
        relativeImpactSpeedMps: 50,
        normalRestitution: 0.47,
      },
      {
        relativeImpactSpeedMps: 65,
        normalRestitution: 0.45,
      },
    ],
    tangentialRestitution: 0.464,
    frictionCoefficient: 0.15,
    evidenceIds: [
      'fixture-same-bat-speed-series',
    ],
  };

describe('wood bat speed response profile', () => {
  it('interpolates only inside an explicit bat/profile-specific measurement series', () => {
    const response =
      resolveWoodBatSpeedResponse(
        profile,
        42.5,
      );

    expect(
      response.normalRestitution,
    ).toBeCloseTo(0.485, 12);
    expect(
      response.tangentialRestitution,
    ).toBeCloseTo(0.464, 12);
  });

  it('clamps outside measured speed knots instead of inventing extrapolation', () => {
    expect(
      resolveWoodBatSpeedResponse(
        profile,
        5,
      ).normalRestitution,
    ).toBeCloseTo(0.50, 12);
    expect(
      resolveWoodBatSpeedResponse(
        profile,
        100,
      ).normalRestitution,
    ).toBeCloseTo(0.45, 12);
  });

  it('rejects a one-point anchor pretending to be a complete speed law', () => {
    expect(() =>
      validateWoodBatSpeedResponseProfile({
        ...profile,
        normalRestitutionKnots: [
          profile
            .normalRestitutionKnots[0]!,
        ],
      }),
    ).toThrow(
      'wood-bat speed response requires at least two same-profile speed knots',
    );
  });

  it('records the modern evidence that wood-bat speed dependence is bat-specific', () => {
    expect(
      HIRONO_2025_WOOD_BAT_SPEED_RESPONSE_EVIDENCE
        .testedImpactSpeedComparisonKph,
    ).toEqual([
      120,
      180,
    ]);
    expect(
      HIRONO_2025_WOOD_BAT_SPEED_RESPONSE_EVIDENCE
        .implication,
    ).toContain(
      'profile-specific',
    );
  });
});
