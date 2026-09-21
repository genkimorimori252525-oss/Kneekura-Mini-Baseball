import { describe, expect, it } from 'vitest';
import {
  REALISTIC_BASEBALL_RIGID_BODY,
} from '../contact/RigidBatBallContact';
import {
  fitPennbounceEquivalentSurfaceGrid,
} from './PennbounceEquivalentSurfaceFit';
import {
  evaluatePennbounceSurfaceResponseGrid,
} from './PennbounceSurfaceCalibrationObjective';

describe('Pennbounce equivalent surface fit', () => {
  it('builds a deterministic 2-angle x 2-speed grid from the published blocks', () => {
    const fit =
      fitPennbounceEquivalentSurfaceGrid(
        'natural_turfgrass',
        REALISTIC_BASEBALL_RIGID_BODY,
        {
          tangentialRestitution: 0.5,
          frictionCoefficient: 1,
        },
      );

    expect(fit.grid.angleRows)
      .toHaveLength(2);
    expect(
      fit.grid.angleRows.every(
        (row) =>
          row.speedKnots.length === 2,
      ),
    ).toBe(true);
    expect(fit.knots)
      .toHaveLength(4);

    expect(
      fitPennbounceEquivalentSurfaceGrid(
        'natural_turfgrass',
        REALISTIC_BASEBALL_RIGID_BODY,
        {
          tangentialRestitution: 0.5,
          frictionCoefficient: 1,
        },
      ),
    ).toEqual(fit);
  });

  it('reports rather than hides when fixed tangential assumptions cannot span every measurement', () => {
    const fit =
      fitPennbounceEquivalentSurfaceGrid(
        'natural_turfgrass',
        REALISTIC_BASEBALL_RIGID_BODY,
        {
          tangentialRestitution: 0,
          frictionCoefficient: 0,
        },
      );

    expect(
      fit.boundaryLimitedCount,
    ).toBeGreaterThan(0);
    expect(
      fit.maximumAbsoluteError,
    ).toBeGreaterThan(0);
  });

  it('creates a grid that can be scored by the independent calibration objective', () => {
    const fit =
      fitPennbounceEquivalentSurfaceGrid(
        'astroturf',
        REALISTIC_BASEBALL_RIGID_BODY,
        {
          tangentialRestitution: 0.5,
          frictionCoefficient: 1,
        },
      );
    const score =
      evaluatePennbounceSurfaceResponseGrid(
        'astroturf',
        fit.grid,
        REALISTIC_BASEBALL_RIGID_BODY,
      );

    expect(score.targetCount).toBe(4);
    expect(
      score.rootMeanSquaredError,
    ).toBeCloseTo(
      fit.rootMeanSquaredError,
      10,
    );
  });

  it('keeps the conditioning assumptions visible in the output instead of presenting the fit as uniquely identified', () => {
    const fit =
      fitPennbounceEquivalentSurfaceGrid(
        'skinned_infield',
        REALISTIC_BASEBALL_RIGID_BODY,
        {
          tangentialRestitution: 0.4,
          frictionCoefficient: 0.8,
        },
        'explicit-assumptions-v1',
      );

    expect(fit.assumptions)
      .toEqual({
        tangentialRestitution: 0.4,
        frictionCoefficient: 0.8,
      });
    expect(fit.grid.version)
      .toBe('explicit-assumptions-v1');
  });
});
