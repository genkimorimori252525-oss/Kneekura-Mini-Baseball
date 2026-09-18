export const REFERENCE_PLAYER_HEIGHT_METERS = 1.8 as const;

export type PlayerPhysicalProfile = Readonly<{
  heightMeters: number;
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

export const createPlayerPhysicalProfile = (
  heightMeters: number,
): PlayerPhysicalProfile => {
  validatePositiveFinite(
    'heightMeters',
    heightMeters,
  );

  return {
    heightMeters,
  };
};

export const getPlayerHeightScale = (
  profile: PlayerPhysicalProfile,
  referenceHeightMeters: number =
    REFERENCE_PLAYER_HEIGHT_METERS,
): number => {
  validatePositiveFinite(
    'heightMeters',
    profile.heightMeters,
  );
  validatePositiveFinite(
    'referenceHeightMeters',
    referenceHeightMeters,
  );

  return (
    profile.heightMeters
    / referenceHeightMeters
  );
};
