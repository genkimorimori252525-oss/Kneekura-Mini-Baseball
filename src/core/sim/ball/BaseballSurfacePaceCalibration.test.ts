import { describe, expect, it } from 'vitest';
import {
  PENNBOUNCE_2005_ANGLE_TARGETS,
  PENNBOUNCE_2005_MEAN_SURFACE_PACE,
  PENNBOUNCE_2005_SURFACE_VELOCITY_TARGETS,
  calculateSurfacePaceSpeedRatio,
} from './BaseballSurfacePaceCalibration';

describe('Pennbounce baseball surface pace calibration targets', () => {
  it('preserves the published mean ordering of common baseball surfaces', () => {
    expect(
      PENNBOUNCE_2005_MEAN_SURFACE_PACE
        .astroturf,
    ).toBeGreaterThan(
      PENNBOUNCE_2005_MEAN_SURFACE_PACE
        .skinned_infield,
    );
    expect(
      PENNBOUNCE_2005_MEAN_SURFACE_PACE
        .skinned_infield,
    ).toBeGreaterThan(
      PENNBOUNCE_2005_MEAN_SURFACE_PACE
        .fieldturf,
    );
    expect(
      PENNBOUNCE_2005_MEAN_SURFACE_PACE
        .fieldturf,
    ).toBeGreaterThan(
      PENNBOUNCE_2005_MEAN_SURFACE_PACE
        .natural_turfgrass,
    );
  });

  it('records the opposite high-speed trends observed for dense and compliant surfaces', () => {
    const bySurface = (
      surface:
        'skinned_infield'
        | 'natural_turfgrass',
    ) => PENNBOUNCE_2005_SURFACE_VELOCITY_TARGETS
      .filter(
        (row) =>
          row.surface === surface,
      )
      .sort(
        (a, b) =>
          a.incidentSpeedMps
          - b.incidentSpeedMps,
      );

    const infield =
      bySurface('skinned_infield');
    const grass =
      bySurface('natural_turfgrass');

    expect(
      infield[1]!.measuredSpeedRatio,
    ).toBeGreaterThan(
      infield[0]!.measuredSpeedRatio,
    );
    expect(
      grass[1]!.measuredSpeedRatio,
    ).toBeLessThan(
      grass[0]!.measuredSpeedRatio,
    );
  });

  it('records slower surface pace at the steeper published incidence angle', () => {
    expect(
      PENNBOUNCE_2005_ANGLE_TARGETS[1]!
        .measuredSpeedRatio,
    ).toBeLessThan(
      PENNBOUNCE_2005_ANGLE_TARGETS[0]!
        .measuredSpeedRatio,
    );
  });

  it('treats the calibration observable as total rebound-speed ratio, not an internal normal COR', () => {
    expect(
      calculateSurfacePaceSpeedRatio(
        40,
        20,
      ),
    ).toBe(0.5);
  });
});
