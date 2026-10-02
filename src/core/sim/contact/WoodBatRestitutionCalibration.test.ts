import { describe, expect, it } from 'vitest';
import {
  WOOD_BAT_NORMAL_RESTITUTION_CALIBRATION_TARGETS,
  validateWoodBatRestitutionCalibrationTargets,
} from './WoodBatRestitutionCalibration';

describe('wood-bat normal restitution calibration evidence', () => {
  it('keeps low-speed and high-speed evidence as calibration anchors rather than silently interpolating them', () => {
    validateWoodBatRestitutionCalibrationTargets(
      WOOD_BAT_NORMAL_RESTITUTION_CALIBRATION_TARGETS,
    );

    expect(
      WOOD_BAT_NORMAL_RESTITUTION_CALIBRATION_TARGETS,
    ).toEqual([
      expect.objectContaining({
        relativeImpactSpeedMps: 4,
        normalRestitution: 0.63,
        evidenceKind:
          'direct_low_speed_oblique_experiment',
      }),
      expect.objectContaining({
        relativeImpactSpeedMps: 60.8,
        normalRestitution: 0.452,
        uncertainty: 0.005,
        evidenceKind:
          'high_speed_bbcOR_field_lab_study',
      }),
    ]);
  });

  it('records the measured decrease in effective collision elasticity over the available wood-bat speed anchors', () => {
    const [low, high] =
      WOOD_BAT_NORMAL_RESTITUTION_CALIBRATION_TARGETS;

    expect(
      high!.relativeImpactSpeedMps,
    ).toBeGreaterThan(
      low!.relativeImpactSpeedMps,
    );
    expect(
      high!.normalRestitution,
    ).toBeLessThan(
      low!.normalRestitution,
    );
  });
});
