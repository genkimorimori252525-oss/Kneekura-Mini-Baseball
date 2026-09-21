export type BaseballFieldSurfaceFamily =
  | 'skinned_infield'
  | 'natural_turfgrass'
  | 'synthetic_turf';

export type BaseballSurfacePaceObservation = Readonly<{
  evidenceId: string;
  surfaceFamily: BaseballFieldSurfaceFamily;
  conditionId: string;
  measurementContextId: string;
  paceRatio: number;
  source: string;
  sourceYear: number;
}>;

export type BaseballSurfaceQualitativeConstraint =
  Readonly<{
    evidenceId: string;
    surfaceFamily: BaseballFieldSurfaceFamily;
    relation:
      | 'greater_than'
      | 'less_than'
      | 'no_detected_effect';
    leftConditionId: string;
    rightConditionId: string;
    source: string;
    sourceYear: number;
    note: string;
  }>;

/**
 * Brosnan, McNitt & Serensits (2011), Table 1.
 *
 * Surface pace is total baseball speed after impact divided by speed before
 * impact. The two sampling times are preserved as separate contexts instead
 * of being averaged away.
 */
export const BROSNAN_2011_SKINNED_INFIELD_COMPACTION_PACE:
  readonly BaseballSurfacePaceObservation[] =
  Object.freeze([
    {
      evidenceId: 'brosnan-2011-infield-high-time1',
      surfaceFamily: 'skinned_infield',
      conditionId: 'high_compaction',
      measurementContextId: 'time_1',
      paceRatio: 0.543,
      source:
        'Brosnan, McNitt & Serensits 2011, JTE 39(3), Table 1',
      sourceYear: 2011,
    },
    {
      evidenceId: 'brosnan-2011-infield-medium-time1',
      surfaceFamily: 'skinned_infield',
      conditionId: 'medium_compaction',
      measurementContextId: 'time_1',
      paceRatio: 0.525,
      source:
        'Brosnan, McNitt & Serensits 2011, JTE 39(3), Table 1',
      sourceYear: 2011,
    },
    {
      evidenceId: 'brosnan-2011-infield-low-time1',
      surfaceFamily: 'skinned_infield',
      conditionId: 'low_compaction',
      measurementContextId: 'time_1',
      paceRatio: 0.442,
      source:
        'Brosnan, McNitt & Serensits 2011, JTE 39(3), Table 1',
      sourceYear: 2011,
    },
    {
      evidenceId: 'brosnan-2011-infield-high-time2',
      surfaceFamily: 'skinned_infield',
      conditionId: 'high_compaction',
      measurementContextId: 'time_2',
      paceRatio: 0.589,
      source:
        'Brosnan, McNitt & Serensits 2011, JTE 39(3), Table 1',
      sourceYear: 2011,
    },
    {
      evidenceId: 'brosnan-2011-infield-medium-time2',
      surfaceFamily: 'skinned_infield',
      conditionId: 'medium_compaction',
      measurementContextId: 'time_2',
      paceRatio: 0.573,
      source:
        'Brosnan, McNitt & Serensits 2011, JTE 39(3), Table 1',
      sourceYear: 2011,
    },
    {
      evidenceId: 'brosnan-2011-infield-low-time2',
      surfaceFamily: 'skinned_infield',
      conditionId: 'low_compaction',
      measurementContextId: 'time_2',
      paceRatio: 0.527,
      source:
        'Brosnan, McNitt & Serensits 2011, JTE 39(3), Table 1',
      sourceYear: 2011,
    },
  ]);

/**
 * Brosnan et al. (2011), Table 2.
 *
 * These values are retained as construction/condition evidence rather than
 * directly converted into collision coefficients.
 */
export const BROSNAN_2011_SKINNED_INFIELD_BULK_DENSITY =
  Object.freeze({
    high_compaction: {
      bulkDensityMgM3: 1.63,
      volumetricWaterM3M3: 0.122,
    },
    medium_compaction: {
      bulkDensityMgM3: 1.54,
      volumetricWaterM3M3: 0.131,
    },
    low_compaction: {
      bulkDensityMgM3: 1.46,
      volumetricWaterM3M3: 0.143,
    },
  } as const);

/**
 * Brosnan et al. (2011), Table 5 synthetic-turf pace observations.
 */
export const BROSNAN_2011_SYNTHETIC_TURF_PACE:
  readonly BaseballSurfacePaceObservation[] =
  Object.freeze([
    {
      evidenceId: 'brosnan-2011-astroturf-pre-grooming',
      surfaceFamily: 'synthetic_turf',
      conditionId: 'astroturf',
      measurementContextId: 'pre_grooming',
      paceRatio: 0.599,
      source:
        'Brosnan, McNitt & Serensits 2011, JTE 39(3), Table 5',
      sourceYear: 2011,
    },
    {
      evidenceId: 'brosnan-2011-astroturf-post-grooming',
      surfaceFamily: 'synthetic_turf',
      conditionId: 'astroturf',
      measurementContextId: 'post_grooming',
      paceRatio: 0.631,
      source:
        'Brosnan, McNitt & Serensits 2011, JTE 39(3), Table 5',
      sourceYear: 2011,
    },
    {
      evidenceId: 'brosnan-2011-fieldturf-pre-grooming',
      surfaceFamily: 'synthetic_turf',
      conditionId: 'fieldturf',
      measurementContextId: 'pre_grooming',
      paceRatio: 0.514,
      source:
        'Brosnan, McNitt & Serensits 2011, JTE 39(3), Table 5',
      sourceYear: 2011,
    },
    {
      evidenceId: 'brosnan-2011-fieldturf-post-grooming',
      surfaceFamily: 'synthetic_turf',
      conditionId: 'fieldturf',
      measurementContextId: 'post_grooming',
      paceRatio: 0.533,
      source:
        'Brosnan, McNitt & Serensits 2011, JTE 39(3), Table 5',
      sourceYear: 2011,
    },
    {
      evidenceId: 'brosnan-2011-sofsport-pre-grooming',
      surfaceFamily: 'synthetic_turf',
      conditionId: 'sofsport',
      measurementContextId: 'pre_grooming',
      paceRatio: 0.527,
      source:
        'Brosnan, McNitt & Serensits 2011, JTE 39(3), Table 5',
      sourceYear: 2011,
    },
    {
      evidenceId: 'brosnan-2011-sofsport-post-grooming',
      surfaceFamily: 'synthetic_turf',
      conditionId: 'sofsport',
      measurementContextId: 'post_grooming',
      paceRatio: 0.530,
      source:
        'Brosnan, McNitt & Serensits 2011, JTE 39(3), Table 5',
      sourceYear: 2011,
    },
    {
      evidenceId: 'brosnan-2011-sprinturf-pre-grooming',
      surfaceFamily: 'synthetic_turf',
      conditionId: 'sprinturf',
      measurementContextId: 'pre_grooming',
      paceRatio: 0.551,
      source:
        'Brosnan, McNitt & Serensits 2011, JTE 39(3), Table 5',
      sourceYear: 2011,
    },
    {
      evidenceId: 'brosnan-2011-sprinturf-post-grooming',
      surfaceFamily: 'synthetic_turf',
      conditionId: 'sprinturf',
      measurementContextId: 'post_grooming',
      paceRatio: 0.559,
      source:
        'Brosnan, McNitt & Serensits 2011, JTE 39(3), Table 5',
      sourceYear: 2011,
    },
    {
      evidenceId: 'brosnan-2011-omnigrass41-pre-grooming',
      surfaceFamily: 'synthetic_turf',
      conditionId: 'omnigrass_41',
      measurementContextId: 'pre_grooming',
      paceRatio: 0.508,
      source:
        'Brosnan, McNitt & Serensits 2011, JTE 39(3), Table 5',
      sourceYear: 2011,
    },
    {
      evidenceId: 'brosnan-2011-omnigrass41-post-grooming',
      surfaceFamily: 'synthetic_turf',
      conditionId: 'omnigrass_41',
      measurementContextId: 'post_grooming',
      paceRatio: 0.529,
      source:
        'Brosnan, McNitt & Serensits 2011, JTE 39(3), Table 5',
      sourceYear: 2011,
    },
    {
      evidenceId: 'brosnan-2011-omnigrass51-pre-grooming',
      surfaceFamily: 'synthetic_turf',
      conditionId: 'omnigrass_51',
      measurementContextId: 'pre_grooming',
      paceRatio: 0.554,
      source:
        'Brosnan, McNitt & Serensits 2011, JTE 39(3), Table 5',
      sourceYear: 2011,
    },
    {
      evidenceId: 'brosnan-2011-omnigrass51-post-grooming',
      surfaceFamily: 'synthetic_turf',
      conditionId: 'omnigrass_51',
      measurementContextId: 'post_grooming',
      paceRatio: 0.536,
      source:
        'Brosnan, McNitt & Serensits 2011, JTE 39(3), Table 5',
      sourceYear: 2011,
    },
  ]);

/**
 * Qualitative constraints from published experiments that do not expose
 * enough numeric detail in the cited evidence to justify inventing a
 * coefficient.
 */
export const BASEBALL_FIELD_CONDITION_QUALITATIVE_CONSTRAINTS:
  readonly BaseballSurfaceQualitativeConstraint[] =
  Object.freeze([
    {
      evidenceId: 'brosnan-2011-infield-compaction',
      surfaceFamily: 'skinned_infield',
      relation: 'greater_than',
      leftConditionId: 'higher_bulk_density',
      rightConditionId: 'lower_bulk_density',
      source:
        'Brosnan, McNitt & Serensits 2011, JTE 39(3)',
      sourceYear: 2011,
      note:
        'Higher soil compaction increased surface pace within the tested skinned-infield construction.',
    },
    {
      evidenceId: 'brosnan-2011-bluegrass-cut-thatch',
      surfaceFamily: 'natural_turfgrass',
      relation: 'no_detected_effect',
      leftConditionId: 'tested_cutting_height_or_thatch_variation',
      rightConditionId: 'surface_pace',
      source:
        'Brosnan, McNitt & Serensits 2011, JTE 39(3)',
      sourceYear: 2011,
      note:
        'The tested Kentucky-bluegrass cutting-height and thatch-thickness ranges did not significantly change pace.',
    },
    {
      evidenceId: 'park-2020-wet-grass-boundary-angle',
      surfaceFamily: 'natural_turfgrass',
      relation: 'greater_than',
      leftConditionId: 'wet_grass_friction_boundary_angle',
      rightConditionId: 'dry_grass_friction_boundary_angle',
      source:
        'Park et al. 2020, School Science Journal 14(2), DOI 10.15737/ssj.14.2.202005.259',
      sourceYear: 2020,
      note:
        'Wet grass increased the boundary incident angle separating friction-response regimes; the abstract supports the direction but not a numeric coefficient for v1.',
    },
  ]);

export const findSurfacePaceObservation = (
  evidenceId: string,
): BaseballSurfacePaceObservation | null => (
  [
    ...BROSNAN_2011_SKINNED_INFIELD_COMPACTION_PACE,
    ...BROSNAN_2011_SYNTHETIC_TURF_PACE,
  ].find(
    (observation) =>
      observation.evidenceId === evidenceId,
  ) ?? null
);
