export type MiniBallHeightTier =
  | 0
  | 1
  | 2
  | 3
  | 4;

export type MiniBallHeightCalibration = Readonly<{
  tier1AtMeters: number;
  tier2AtMeters: number;
  tier3AtMeters: number;
  tier4AtMeters: number;
  tierDiametersPixels: readonly [
    number,
    number,
    number,
    number,
    number,
  ];
}>;

export type MiniBallHeightPresentationProfile =
  Readonly<{
    heightTier: MiniBallHeightTier;
    diameterPixels: number;
    clampedHeightMeters: number;
  }>;

export const DEFAULT_MINI_BALL_HEIGHT_CALIBRATION:
  MiniBallHeightCalibration = Object.freeze({
    tier1AtMeters: 0.25,
    tier2AtMeters: 1.25,
    tier3AtMeters: 3.5,
    tier4AtMeters: 7,
    tierDiametersPixels: [3, 4, 5, 6, 7] as const,
  });

const validateCalibration = (
  calibration: MiniBallHeightCalibration,
): void => {
  const thresholds = [
    calibration.tier1AtMeters,
    calibration.tier2AtMeters,
    calibration.tier3AtMeters,
    calibration.tier4AtMeters,
  ];

  if (
    thresholds.some(
      (value) => !Number.isFinite(value) || value < 0,
    )
  ) {
    throw new Error(
      'ball height thresholds must be finite and non-negative',
    );
  }

  for (
    let index = 1;
    index < thresholds.length;
    index += 1
  ) {
    if (thresholds[index] <= thresholds[index - 1]) {
      throw new Error(
        'ball height thresholds must be strictly increasing',
      );
    }
  }

  if (
    calibration.tierDiametersPixels.some(
      (value) => (
        !Number.isFinite(value)
        || value <= 0
      ),
    )
  ) {
    throw new Error(
      'ball tier diameters must be finite and positive',
    );
  }
};

export const deriveMiniBallHeightPresentationProfile = (
  heightMeters: number,
  calibration: MiniBallHeightCalibration =
    DEFAULT_MINI_BALL_HEIGHT_CALIBRATION,
): MiniBallHeightPresentationProfile => {
  if (!Number.isFinite(heightMeters)) {
    throw new Error(
      'ball height must be finite',
    );
  }
  validateCalibration(calibration);

  const clampedHeightMeters = Math.max(
    0,
    heightMeters,
  );

  const heightTier: MiniBallHeightTier =
    clampedHeightMeters
      >= calibration.tier4AtMeters
      ? 4
      : clampedHeightMeters
          >= calibration.tier3AtMeters
        ? 3
        : clampedHeightMeters
            >= calibration.tier2AtMeters
          ? 2
          : clampedHeightMeters
              >= calibration.tier1AtMeters
            ? 1
            : 0;

  return {
    heightTier,
    diameterPixels:
      calibration.tierDiametersPixels[
        heightTier
      ],
    clampedHeightMeters,
  };
};