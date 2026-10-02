export type Kensrud2016BatTangentialCorReference = Readonly<{
  batType:
    | 'wood'
    | 'metal_rough'
    | 'metal_smooth'
    | 'all_baseball_bats';
  tangentialRestitution: number;
  standardError: number;
}>;

export const KENSRUD_2016_BASEBALL_TANGENTIAL_COR_REFERENCES:
  readonly Kensrud2016BatTangentialCorReference[] =
  Object.freeze([
    {
      batType: 'all_baseball_bats',
      tangentialRestitution: 0.405,
      standardError: 0.010,
    },
    {
      batType: 'wood',
      tangentialRestitution: 0.464,
      standardError: 0.014,
    },
    {
      batType: 'metal_rough',
      tangentialRestitution: 0.356,
      standardError: 0.015,
    },
    {
      batType: 'metal_smooth',
      tangentialRestitution: 0.374,
      standardError: 0.015,
    },
  ]);

export const KENSRUD_2016_GAME_SPEED_CONTEXT =
  Object.freeze({
    minimumBatSpeedMps: 28,
    maximumBatSpeedMps: 39,
    minimumBatSpeedMph: 63,
    maximumBatSpeedMph: 88,
    maximumBaseballImpactAngleDegrees: 30,
    maximumBaseballLaunchAngleDegreesApprox: 30,
    measuredBaseballCount: 58,
    baseballMassOzMean: 5.04,
    baseballRadiusInMean: 1.42,
    frictionCoefficientLowerBound: 0.15,
    source:
      'Kensrud, Nathan & Smith 2017, Oblique Collisions of Baseballs and Softballs with a Bat',
  } as const);

/**
 * This is a tangential-response evidence registry, not a complete contact
 * preset. In particular, the experiment only established a lower bound on
 * friction for the measured non-gross-slip baseball impacts.
 */
export const findKensrud2016TangentialReference = (
  batType:
    Kensrud2016BatTangentialCorReference['batType'],
): Kensrud2016BatTangentialCorReference => {
  const result =
    KENSRUD_2016_BASEBALL_TANGENTIAL_COR_REFERENCES
      .find(
        (entry) =>
          entry.batType === batType,
      );
  if (result === undefined) {
    throw new Error(
      'unknown Kensrud 2016 bat tangential reference',
    );
  }
  return result;
};
