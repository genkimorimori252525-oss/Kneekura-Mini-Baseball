import {
  getPlayerHeightScale,
  type PlayerPhysicalProfile,
} from '../../core/model/PlayerPhysicalProfile';

export type MiniPlayerDotSizeCalibration = Readonly<{
  smallBelowHeightScale: number;
  largeAtOrAboveHeightScale: number;
  smallDiameterPixels: number;
  referenceDiameterPixels: number;
  largeDiameterPixels: number;
}>;

export type MiniPlayerDotPresentationProfile = Readonly<{
  sizeTier: 'small' | 'reference' | 'large';
  diameterPixels: number;
  heightScale: number;
}>;

export const DEFAULT_MINI_PLAYER_DOT_SIZE_CALIBRATION:
  MiniPlayerDotSizeCalibration = Object.freeze({
    smallBelowHeightScale: 0.95,
    largeAtOrAboveHeightScale: 1.05,
    smallDiameterPixels: 9,
    referenceDiameterPixels: 10,
    largeDiameterPixels: 11,
  });

const validateCalibration = (
  calibration: MiniPlayerDotSizeCalibration,
): void => {
  if (
    !Number.isFinite(calibration.smallBelowHeightScale)
    || !Number.isFinite(calibration.largeAtOrAboveHeightScale)
    || calibration.smallBelowHeightScale <= 0
    || calibration.largeAtOrAboveHeightScale <= 0
  ) {
    throw new Error(
      'height-scale thresholds must be finite and positive',
    );
  }
  if (
    calibration.smallBelowHeightScale
    >= calibration.largeAtOrAboveHeightScale
  ) {
    throw new Error(
      'smallBelowHeightScale must be less than largeAtOrAboveHeightScale',
    );
  }

  const diameters = [
    calibration.smallDiameterPixels,
    calibration.referenceDiameterPixels,
    calibration.largeDiameterPixels,
  ];
  if (
    diameters.some((value) => (
      !Number.isInteger(value)
      || value <= 0
    ))
  ) {
    throw new Error(
      'dot diameters must be positive integers',
    );
  }
};

export const deriveMiniPlayerDotPresentationProfile = (
  profile: PlayerPhysicalProfile,
  calibration: MiniPlayerDotSizeCalibration =
    DEFAULT_MINI_PLAYER_DOT_SIZE_CALIBRATION,
): MiniPlayerDotPresentationProfile => {
  validateCalibration(calibration);
  const heightScale = getPlayerHeightScale(profile);

  if (
    heightScale
    < calibration.smallBelowHeightScale
  ) {
    return {
      sizeTier: 'small',
      diameterPixels: calibration.smallDiameterPixels,
      heightScale,
    };
  }

  if (
    heightScale
    >= calibration.largeAtOrAboveHeightScale
  ) {
    return {
      sizeTier: 'large',
      diameterPixels: calibration.largeDiameterPixels,
      heightScale,
    };
  }

  return {
    sizeTier: 'reference',
    diameterPixels: calibration.referenceDiameterPixels,
    heightScale,
  };
};
