import { describe, expect, it } from 'vitest';
import {
  createPlayerPhysicalProfile,
} from '../../core/model/PlayerPhysicalProfile';
import {
  deriveDefenderPhysicalReachCalibration,
} from '../../core/sim/fielding/DefenderPhysicalProfileCalibration';
import {
  DEFAULT_MINI_PLAYER_DOT_SIZE_CALIBRATION,
  deriveMiniPlayerDotPresentationProfile,
} from './PlayerDotProfile';

describe('Mini PlayerDotProfile', () => {
  it('maps the reference-height player to the existing 10px presentation baseline', () => {
    expect(deriveMiniPlayerDotPresentationProfile(
      createPlayerPhysicalProfile(1.8),
    )).toEqual({
      sizeTier: 'reference',
      diameterPixels: 10,
      heightScale: 1,
    });
  });

  it('uses only small discrete presentation tiers for shorter and taller profiles', () => {
    expect(deriveMiniPlayerDotPresentationProfile(
      createPlayerPhysicalProfile(1.62),
    )).toEqual({
      sizeTier: 'small',
      diameterPixels: 9,
      heightScale: 0.9,
    });

    expect(deriveMiniPlayerDotPresentationProfile(
      createPlayerPhysicalProfile(1.98),
    )).toEqual({
      sizeTier: 'large',
      diameterPixels: 11,
      heightScale: 1.1,
    });
  });

  it('keeps modest height differences at the 10px reference tier', () => {
    expect(deriveMiniPlayerDotPresentationProfile(
      createPlayerPhysicalProfile(1.84),
    ).diameterPixels).toBe(10);

    expect(deriveMiniPlayerDotPresentationProfile(
      createPlayerPhysicalProfile(1.76),
    ).diameterPixels).toBe(10);
  });

  it('lets Presentation thresholds and pixel sizes change without changing Core physical calibration', () => {
    const profile = createPlayerPhysicalProfile(1.98);
    const physicalBefore = deriveDefenderPhysicalReachCalibration(
      profile,
      {
        bodyOriginHeightMeters: 0.95,
        maximumLegReachMeters: 1.5,
        maximumGloveReachMeters: 1.3,
        maximumTagReachMeters: 1.1,
      },
    );

    const defaultDot = deriveMiniPlayerDotPresentationProfile(
      profile,
    );
    const customDot = deriveMiniPlayerDotPresentationProfile(
      profile,
      {
        ...DEFAULT_MINI_PLAYER_DOT_SIZE_CALIBRATION,
        smallDiameterPixels: 4,
        referenceDiameterPixels: 6,
        largeDiameterPixels: 20,
        smallBelowHeightScale: 0.8,
        largeAtOrAboveHeightScale: 1.5,
      },
    );

    const physicalAfter = deriveDefenderPhysicalReachCalibration(
      profile,
      {
        bodyOriginHeightMeters: 0.95,
        maximumLegReachMeters: 1.5,
        maximumGloveReachMeters: 1.3,
        maximumTagReachMeters: 1.1,
      },
    );

    expect(defaultDot).not.toEqual(customDot);
    expect(physicalAfter).toEqual(physicalBefore);
  });

  it('rejects invalid or overlapping presentation thresholds', () => {
    expect(() => deriveMiniPlayerDotPresentationProfile(
      createPlayerPhysicalProfile(1.8),
      {
        ...DEFAULT_MINI_PLAYER_DOT_SIZE_CALIBRATION,
        smallBelowHeightScale: 1.1,
        largeAtOrAboveHeightScale: 1.0,
      },
    )).toThrow(
      'smallBelowHeightScale must be less than largeAtOrAboveHeightScale',
    );

    expect(() => deriveMiniPlayerDotPresentationProfile(
      createPlayerPhysicalProfile(1.8),
      {
        ...DEFAULT_MINI_PLAYER_DOT_SIZE_CALIBRATION,
        referenceDiameterPixels: 0,
      },
    )).toThrow(
      'dot diameters must be positive integers',
    );
  });
});
