export const TAKASHIMA_2015_NPB_RIGID_WALL_REFERENCE =
  Object.freeze({
    targetImpactSpeedMps: 75,
    targetNormalRestitution: 0.4134,
    testedImpactSpeedRangeMps: {
      minimum: 30,
      maximum: 80,
    },
    launchSpinState: 'non_spinning',
    impactRegions: [
      'cowhide_between_stitches',
      'stitches',
    ] as const,
    impactRegionEffectDetected: true,
    impactRegionDifferenceTrend:
      'difference_decreases_as_impact_speed_increases',
    source:
      'Takashima et al. 2015, JSME Sports and Human Dynamics, DOI 10.1299/jsmeshd.2015._B-5-1_',
    note:
      'The experiment demonstrates impact-point-dependent rigid-wall COR and a diminishing difference at higher impact speed. v1 deliberately does not encode a numeric seam-vs-leather correction because the available source text/figure does not provide a robust versioned coefficient table for production use.',
  } as const);

export type BaseballSurfaceImpactRegion =
  (typeof TAKASHIMA_2015_NPB_RIGID_WALL_REFERENCE
    .impactRegions)[number];

export const isTakashima2015TestedImpactSpeed = (
  impactSpeedMps: number,
): boolean => {
  if (
    !Number.isFinite(impactSpeedMps)
    || impactSpeedMps < 0
  ) {
    throw new Error(
      'impactSpeedMps must be finite and non-negative',
    );
  }

  return (
    impactSpeedMps
      >= TAKASHIMA_2015_NPB_RIGID_WALL_REFERENCE
        .testedImpactSpeedRangeMps
        .minimum
    && impactSpeedMps
      <= TAKASHIMA_2015_NPB_RIGID_WALL_REFERENCE
        .testedImpactSpeedRangeMps
        .maximum
  );
};
