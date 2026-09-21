import { describe, expect, it } from 'vitest';
import {
  TAKASHIMA_2015_NPB_RIGID_WALL_REFERENCE,
  isTakashima2015TestedImpactSpeed,
} from './BaseballImpactRegionEvidence';

describe('Takashima 2015 baseball impact-region evidence', () => {
  it('retains the historical NPB rigid-wall reference and tested speed window', () => {
    expect(
      TAKASHIMA_2015_NPB_RIGID_WALL_REFERENCE
        .targetImpactSpeedMps,
    ).toBe(75);
    expect(
      TAKASHIMA_2015_NPB_RIGID_WALL_REFERENCE
        .targetNormalRestitution,
    ).toBeCloseTo(0.4134, 12);
    expect(
      TAKASHIMA_2015_NPB_RIGID_WALL_REFERENCE
        .testedImpactSpeedRangeMps,
    ).toEqual({
      minimum: 30,
      maximum: 80,
    });
  });

  it('records impact-region dependence without inventing an unsupported numeric seam correction', () => {
    expect(
      TAKASHIMA_2015_NPB_RIGID_WALL_REFERENCE
        .impactRegionEffectDetected,
    ).toBe(true);
    expect(
      TAKASHIMA_2015_NPB_RIGID_WALL_REFERENCE
        .impactRegionDifferenceTrend,
    ).toBe(
      'difference_decreases_as_impact_speed_increases',
    );
    expect(
      TAKASHIMA_2015_NPB_RIGID_WALL_REFERENCE
        .impactRegions,
    ).toEqual([
      'cowhide_between_stitches',
      'stitches',
    ]);
  });

  it('bounds any future calibration to the actual measured impact-speed domain', () => {
    expect(
      isTakashima2015TestedImpactSpeed(30),
    ).toBe(true);
    expect(
      isTakashima2015TestedImpactSpeed(80),
    ).toBe(true);
    expect(
      isTakashima2015TestedImpactSpeed(29.9),
    ).toBe(false);
    expect(
      isTakashima2015TestedImpactSpeed(80.1),
    ).toBe(false);
  });
});
