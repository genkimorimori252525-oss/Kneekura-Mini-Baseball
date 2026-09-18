import { describe, expect, it } from 'vitest';
import {
  createPlayerPhysicalProfile,
} from '../../model/PlayerPhysicalProfile';
import {
  deriveDefenderPhysicalReachCalibration,
  type DefenderPhysicalReachBaseline,
} from './DefenderPhysicalProfileCalibration';

const baseline: DefenderPhysicalReachBaseline = {
  bodyOriginHeightMeters: 0.95,
  maximumLegReachMeters: 1.5,
  maximumGloveReachMeters: 1.3,
  maximumTagReachMeters: 1.1,
};

describe('DefenderPhysicalProfileCalibration', () => {
  it('reproduces the existing baseline exactly for the reference-height profile', () => {
    expect(deriveDefenderPhysicalReachCalibration(
      createPlayerPhysicalProfile(1.8),
      baseline,
    )).toEqual({
      heightScale: 1,
      bodyOriginHeightMeters: 0.95,
      maximumLegReachMeters: 1.5,
      maximumGloveReachMeters: 1.3,
      maximumTagReachMeters: 1.1,
    });
  });

  it('increases only physical size/reach intermediates for a taller profile', () => {
    const result = deriveDefenderPhysicalReachCalibration(
      createPlayerPhysicalProfile(1.98),
      baseline,
    );

    expect(result.heightScale)
      .toBeCloseTo(1.1, 12);
    expect(result.bodyOriginHeightMeters)
      .toBeCloseTo(1.045, 12);
    expect(result.maximumLegReachMeters)
      .toBeCloseTo(1.65, 12);
    expect(result.maximumGloveReachMeters)
      .toBeCloseTo(1.43, 12);
    expect(result.maximumTagReachMeters)
      .toBeCloseTo(1.21, 12);
  });

  it('reduces the same physical intermediates for a shorter profile', () => {
    const result = deriveDefenderPhysicalReachCalibration(
      createPlayerPhysicalProfile(1.62),
      baseline,
    );

    expect(result.heightScale)
      .toBeCloseTo(0.9, 12);
    expect(result.bodyOriginHeightMeters)
      .toBeCloseTo(0.855, 12);
    expect(result.maximumLegReachMeters)
      .toBeCloseTo(1.35, 12);
    expect(result.maximumGloveReachMeters)
      .toBeCloseTo(1.17, 12);
    expect(result.maximumTagReachMeters)
      .toBeCloseTo(0.99, 12);
  });

  it('does not create direct success, speed, acceleration, or skill outputs', () => {
    const result = deriveDefenderPhysicalReachCalibration(
      createPlayerPhysicalProfile(1.8),
      baseline,
    );

    expect(Object.keys(result).sort()).toEqual([
      'bodyOriginHeightMeters',
      'heightScale',
      'maximumGloveReachMeters',
      'maximumLegReachMeters',
      'maximumTagReachMeters',
    ]);
  });

  it('rejects invalid physical baselines', () => {
    expect(() => deriveDefenderPhysicalReachCalibration(
      createPlayerPhysicalProfile(1.8),
      {
        ...baseline,
        maximumLegReachMeters: 0,
      },
    )).toThrow(
      'maximumLegReachMeters must be finite and positive',
    );
  });
});
