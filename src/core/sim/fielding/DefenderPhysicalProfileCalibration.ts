import {
  getPlayerHeightScale,
  type PlayerPhysicalProfile,
} from '../../model/PlayerPhysicalProfile';

export type DefenderPhysicalReachBaseline = Readonly<{
  bodyOriginHeightMeters: number;
  maximumLegReachMeters: number;
  maximumGloveReachMeters: number;
  maximumTagReachMeters: number;
}>;

export type DefenderPhysicalReachCalibration = Readonly<{
  heightScale: number;
  bodyOriginHeightMeters: number;
  maximumLegReachMeters: number;
  maximumGloveReachMeters: number;
  maximumTagReachMeters: number;
}>;

const validatePositiveFinite = (
  name: string,
  value: number,
): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      `${name} must be finite and positive`,
    );
  }
};

export const deriveDefenderPhysicalReachCalibration = (
  profile: PlayerPhysicalProfile,
  baseline: DefenderPhysicalReachBaseline,
): DefenderPhysicalReachCalibration => {
  validatePositiveFinite(
    'bodyOriginHeightMeters',
    baseline.bodyOriginHeightMeters,
  );
  validatePositiveFinite(
    'maximumLegReachMeters',
    baseline.maximumLegReachMeters,
  );
  validatePositiveFinite(
    'maximumGloveReachMeters',
    baseline.maximumGloveReachMeters,
  );
  validatePositiveFinite(
    'maximumTagReachMeters',
    baseline.maximumTagReachMeters,
  );

  const heightScale = getPlayerHeightScale(profile);

  return {
    heightScale,
    bodyOriginHeightMeters:
      baseline.bodyOriginHeightMeters * heightScale,
    maximumLegReachMeters:
      baseline.maximumLegReachMeters * heightScale,
    maximumGloveReachMeters:
      baseline.maximumGloveReachMeters * heightScale,
    maximumTagReachMeters:
      baseline.maximumTagReachMeters * heightScale,
  };
};
