export type WoodBatNormalRestitutionCalibrationTarget = Readonly<{
  relativeImpactSpeedMps: number;
  normalRestitution: number;
  uncertainty?: number;
  source: string;
  evidenceKind:
    | 'direct_low_speed_oblique_experiment'
    | 'high_speed_bbcOR_field_lab_study';
  note: string;
}>;

/**
 * Calibration anchors only. They deliberately do not define a production
 * interpolation law: COR is speed-, ball-, bat-, and test-condition-dependent.
 */
export const WOOD_BAT_NORMAL_RESTITUTION_CALIBRATION_TARGETS:
  readonly WoodBatNormalRestitutionCalibrationTarget[] =
  Object.freeze([
    {
      relativeImpactSpeedMps: 4,
      normalRestitution: 0.63,
      uncertainty: 0.01,
      source:
        'Cross & Nathan 2006, Scattering of a Baseball by a Bat',
      evidenceKind:
        'direct_low_speed_oblique_experiment',
      note:
        'Low-speed wood-bat normal COR inferred after recoil correction.',
    },
    {
      relativeImpactSpeedMps: 60.8,
      normalRestitution: 0.452,
      uncertainty: 0.005,
      source:
        'Nathan et al. 2011, A Comparative Study of Baseball Bat Performance',
      evidenceKind:
        'high_speed_bbcOR_field_lab_study',
      note:
        'Wood-bat BBCOR reference at laboratory launch speed chosen to match field relative collision speed.',
    },
  ]);

export const validateWoodBatRestitutionCalibrationTargets = (
  targets:
    readonly WoodBatNormalRestitutionCalibrationTarget[],
): void => {
  if (targets.length === 0) {
    throw new Error(
      'wood bat restitution calibration requires targets',
    );
  }

  let previousSpeed = -Infinity;
  for (const target of targets) {
    if (
      !Number.isFinite(
        target.relativeImpactSpeedMps,
      )
      || target.relativeImpactSpeedMps <= 0
      || target.relativeImpactSpeedMps
        <= previousSpeed
    ) {
      throw new Error(
        'wood bat restitution calibration speeds must be finite, positive, and strictly increasing',
      );
    }
    if (
      !Number.isFinite(
        target.normalRestitution,
      )
      || target.normalRestitution < 0
      || target.normalRestitution > 1
    ) {
      throw new Error(
        'wood bat restitution targets must lie within [0, 1]',
      );
    }
    if (
      target.uncertainty !== undefined
      && (
        !Number.isFinite(
          target.uncertainty,
        )
        || target.uncertainty < 0
      )
    ) {
      throw new Error(
        'wood bat restitution uncertainty must be finite and non-negative',
      );
    }
    previousSpeed =
      target.relativeImpactSpeedMps;
  }
};
