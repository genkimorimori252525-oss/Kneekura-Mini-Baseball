import { describe, expect, it } from 'vitest';
import {
  TAHARA_2008_HARD_BALL_SURFACE_REBOUND_EVIDENCE,
  findTahara2008HardBallSurfaceReboundEvidence,
} from './Tahara2008SurfaceReboundEvidence';

describe('Tahara 2008 hard-ball surface rebound evidence', () => {
  it('preserves directly measured normal-rebound ordering', () => {
    const previous =
      findTahara2008HardBallSurfaceReboundEvidence(
        'previous_generation_artificial_turf',
      );
    const fifth =
      findTahara2008HardBallSurfaceReboundEvidence(
        'fifth_generation_artificial_turf',
      );
    const natural =
      findTahara2008HardBallSurfaceReboundEvidence(
        'natural_turf',
      );

    expect(
      previous.normalRepulsionCoefficient,
    ).toBeGreaterThan(
      fifth.normalRepulsionCoefficient,
    );
    expect(
      fifth.normalRepulsionCoefficient,
    ).toBeGreaterThan(
      natural.normalRepulsionCoefficient,
    );
  });

  it('retains published uncertainty rather than treating means as exact constants', () => {
    const natural =
      findTahara2008HardBallSurfaceReboundEvidence(
        'natural_turf',
      );

    expect(
      natural.normalRepulsionCoefficient,
    ).toBeCloseTo(0.13, 12);
    expect(
      natural.normalRepulsionCoefficientStdDev,
    ).toBeCloseTo(0.01, 12);
    expect(
      natural.reboundHeightM,
    ).toBeCloseTo(0.19, 12);
    expect(
      natural.reboundHeightStdDevM,
    ).toBeCloseTo(0.06, 12);
  });

  it('keeps each tested construction separate instead of collapsing all artificial turf into one material', () => {
    expect(
      TAHARA_2008_HARD_BALL_SURFACE_REBOUND_EVIDENCE
        .map(
          (entry) =>
            entry.surfaceId,
        ),
    ).toEqual([
      'previous_generation_artificial_turf',
      'fifth_generation_artificial_turf',
      'natural_turf',
    ]);
  });
});
