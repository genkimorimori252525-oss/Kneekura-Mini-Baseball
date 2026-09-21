export type PennbounceSurfaceId =
  | 'astroturf'
  | 'skinned_infield'
  | 'fieldturf'
  | 'natural_turfgrass';

export type SurfacePaceVelocityTarget = Readonly<{
  surface: PennbounceSurfaceId;
  incidentSpeedMps: number;
  measuredSpeedRatio: number;
}>;

/**
 * Pennbounce 2005/2007 baseball playing-surface pace targets.
 *
 * Important: the published "coefficient of restitution" here is the ratio of
 * total ball speed after impact to total ball speed before impact. It is a
 * surface-pace observable, NOT the normal COR parameter used internally by
 * BallSurfaceContact.
 */
export const PENNBOUNCE_2005_MEAN_SURFACE_PACE =
  Object.freeze({
    astroturf: 0.562,
    skinned_infield: 0.537,
    fieldturf: 0.487,
    natural_turfgrass: 0.378,
  } as const satisfies Readonly<
    Record<PennbounceSurfaceId, number>
  >);

export const PENNBOUNCE_2005_SURFACE_VELOCITY_TARGETS:
  readonly SurfacePaceVelocityTarget[] = Object.freeze([
    {
      surface: 'astroturf',
      incidentSpeedMps: 31.0,
      measuredSpeedRatio: 0.555,
    },
    {
      surface: 'astroturf',
      incidentSpeedMps: 40.2,
      measuredSpeedRatio: 0.568,
    },
    {
      surface: 'fieldturf',
      incidentSpeedMps: 31.0,
      measuredSpeedRatio: 0.502,
    },
    {
      surface: 'fieldturf',
      incidentSpeedMps: 40.2,
      measuredSpeedRatio: 0.472,
    },
    {
      surface: 'natural_turfgrass',
      incidentSpeedMps: 31.0,
      measuredSpeedRatio: 0.403,
    },
    {
      surface: 'natural_turfgrass',
      incidentSpeedMps: 40.2,
      measuredSpeedRatio: 0.355,
    },
    {
      surface: 'skinned_infield',
      incidentSpeedMps: 31.0,
      measuredSpeedRatio: 0.511,
    },
    {
      surface: 'skinned_infield',
      incidentSpeedMps: 40.2,
      measuredSpeedRatio: 0.564,
    },
  ]);

export const PENNBOUNCE_2005_ANGLE_TARGETS =
  Object.freeze([
    {
      incidenceAngleRadians: 0.44,
      measuredSpeedRatio: 0.539,
    },
    {
      incidenceAngleRadians: 0.61,
      measuredSpeedRatio: 0.443,
    },
  ] as const);

export const calculateSurfacePaceSpeedRatio = (
  incidentSpeedMps: number,
  reboundSpeedMps: number,
): number => {
  if (
    !Number.isFinite(incidentSpeedMps)
    || incidentSpeedMps <= 0
    || !Number.isFinite(reboundSpeedMps)
    || reboundSpeedMps < 0
  ) {
    throw new Error(
      'surface pace speeds must be finite with positive incident speed and non-negative rebound speed',
    );
  }
  return reboundSpeedMps
    / incidentSpeedMps;
};
