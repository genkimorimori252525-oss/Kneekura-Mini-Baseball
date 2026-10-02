export type PennbounceSurfaceId =
  | 'astroturf'
  | 'skinned_infield'
  | 'fieldturf'
  | 'natural_turfgrass';

export type PennbounceBlockCombinationTarget = Readonly<{
  surface: PennbounceSurfaceId;
  incidenceAngleRadians: 0.44 | 0.61;
  nominalIncidentSpeedMps: 31.0 | 40.2;
  /**
   * Published Table 5 block COR values (Vout / Vin). Keeping the block values
   * avoids silently replacing the source with hand-rounded interaction means.
   */
  blockMeasuredSpeedRatios:
    readonly [number, number, number];
}>;

export const PENNBOUNCE_2005_BLOCK_COMBINATION_TARGETS:
  readonly PennbounceBlockCombinationTarget[] =
  Object.freeze([
    {
      surface: 'skinned_infield',
      incidenceAngleRadians: 0.61,
      nominalIncidentSpeedMps: 40.2,
      blockMeasuredSpeedRatios: [0.535, 0.512, 0.506],
    },
    {
      surface: 'natural_turfgrass',
      incidenceAngleRadians: 0.61,
      nominalIncidentSpeedMps: 40.2,
      blockMeasuredSpeedRatios: [0.283, 0.272, 0.289],
    },
    {
      surface: 'fieldturf',
      incidenceAngleRadians: 0.61,
      nominalIncidentSpeedMps: 40.2,
      blockMeasuredSpeedRatios: [0.417, 0.426, 0.452],
    },
    {
      surface: 'astroturf',
      incidenceAngleRadians: 0.61,
      nominalIncidentSpeedMps: 40.2,
      blockMeasuredSpeedRatios: [0.513, 0.537, 0.491],
    },
    {
      surface: 'skinned_infield',
      incidenceAngleRadians: 0.61,
      nominalIncidentSpeedMps: 31.0,
      blockMeasuredSpeedRatios: [0.424, 0.478, 0.512],
    },
    {
      surface: 'natural_turfgrass',
      incidenceAngleRadians: 0.61,
      nominalIncidentSpeedMps: 31.0,
      blockMeasuredSpeedRatios: [0.347, 0.367, 0.361],
    },
    {
      surface: 'fieldturf',
      incidenceAngleRadians: 0.61,
      nominalIncidentSpeedMps: 31.0,
      blockMeasuredSpeedRatios: [0.452, 0.456, 0.429],
    },
    {
      surface: 'astroturf',
      incidenceAngleRadians: 0.61,
      nominalIncidentSpeedMps: 31.0,
      blockMeasuredSpeedRatios: [0.551, 0.530, 0.481],
    },
    {
      surface: 'skinned_infield',
      incidenceAngleRadians: 0.44,
      nominalIncidentSpeedMps: 40.2,
      blockMeasuredSpeedRatios: [0.600, 0.631, 0.598],
    },
    {
      surface: 'natural_turfgrass',
      incidenceAngleRadians: 0.44,
      nominalIncidentSpeedMps: 40.2,
      blockMeasuredSpeedRatios: [0.411, 0.451, 0.423],
    },
    {
      surface: 'fieldturf',
      incidenceAngleRadians: 0.44,
      nominalIncidentSpeedMps: 40.2,
      blockMeasuredSpeedRatios: [0.502, 0.525, 0.513],
    },
    {
      surface: 'astroturf',
      incidenceAngleRadians: 0.44,
      nominalIncidentSpeedMps: 40.2,
      blockMeasuredSpeedRatios: [0.662, 0.602, 0.604],
    },
    {
      surface: 'skinned_infield',
      incidenceAngleRadians: 0.44,
      nominalIncidentSpeedMps: 31.0,
      blockMeasuredSpeedRatios: [0.525, 0.574, 0.548],
    },
    {
      surface: 'natural_turfgrass',
      incidenceAngleRadians: 0.44,
      nominalIncidentSpeedMps: 31.0,
      blockMeasuredSpeedRatios: [0.434, 0.456, 0.453],
    },
    {
      surface: 'fieldturf',
      incidenceAngleRadians: 0.44,
      nominalIncidentSpeedMps: 31.0,
      blockMeasuredSpeedRatios: [0.541, 0.543, 0.589],
    },
    {
      surface: 'astroturf',
      incidenceAngleRadians: 0.44,
      nominalIncidentSpeedMps: 31.0,
      blockMeasuredSpeedRatios: [0.579, 0.573, 0.619],
    },
  ]);

export const meanPennbounceBlockCombination = (
  target: PennbounceBlockCombinationTarget,
): number => (
  target.blockMeasuredSpeedRatios.reduce(
    (sum, value) => sum + value,
    0,
  )
  / target.blockMeasuredSpeedRatios.length
);

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

export const NPB_2015_RIGID_WALL_COR_REFERENCE =
  Object.freeze({
    incidentSpeedMps: 75,
    desiredNormalCor: 0.4134,
    source:
      'Takashima et al. 2015, JSME Sports and Human Dynamics',
    note:
      'Historical NPB regulation/reference reported by the paper; validation target only, not a 2026 rule assertion.',
  } as const);

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
