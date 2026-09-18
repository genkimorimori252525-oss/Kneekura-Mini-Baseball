import { describe, expect, it } from 'vitest';
import {
  deriveMiniBallHeightPresentationProfile,
} from './MiniBallHeightProfile';

describe('MiniBallHeightProfile', () => {
  it('maps canonical ball height into a discrete presentation tier', () => {
    expect(
      deriveMiniBallHeightPresentationProfile(0.05),
    ).toEqual({
      heightTier: 0,
      diameterPixels: 3,
      clampedHeightMeters: 0.05,
    });

    expect(
      deriveMiniBallHeightPresentationProfile(0.8),
    ).toEqual({
      heightTier: 1,
      diameterPixels: 4,
      clampedHeightMeters: 0.8,
    });

    expect(
      deriveMiniBallHeightPresentationProfile(2),
    ).toEqual({
      heightTier: 2,
      diameterPixels: 5,
      clampedHeightMeters: 2,
    });

    expect(
      deriveMiniBallHeightPresentationProfile(5),
    ).toEqual({
      heightTier: 3,
      diameterPixels: 6,
      clampedHeightMeters: 5,
    });

    expect(
      deriveMiniBallHeightPresentationProfile(10),
    ).toEqual({
      heightTier: 4,
      diameterPixels: 7,
      clampedHeightMeters: 10,
    });
  });

  it('uses only canonical height, with no batted-ball classification input', () => {
    const first =
      deriveMiniBallHeightPresentationProfile(2.5);
    const second =
      deriveMiniBallHeightPresentationProfile(2.5);

    expect(first).toEqual(second);
  });

  it('clamps tiny negative presentation height to ground instead of inventing a new trajectory', () => {
    expect(
      deriveMiniBallHeightPresentationProfile(-0.02),
    ).toEqual({
      heightTier: 0,
      diameterPixels: 3,
      clampedHeightMeters: 0,
    });
  });

  it('rejects non-finite height and invalid calibration ordering', () => {
    expect(() =>
      deriveMiniBallHeightPresentationProfile(
        Number.NaN,
      ),
    ).toThrow(
      'ball height must be finite',
    );

    expect(() =>
      deriveMiniBallHeightPresentationProfile(
        1,
        {
          tier1AtMeters: 2,
          tier2AtMeters: 1,
          tier3AtMeters: 3,
          tier4AtMeters: 7,
          tierDiametersPixels: [3, 4, 5, 6, 7],
        },
      ),
    ).toThrow(
      'ball height thresholds must be strictly increasing',
    );
  });
});
