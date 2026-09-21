import { describe, expect, it } from 'vitest';
import {
  REALISTIC_BASEBALL_RIGID_BODY,
} from '../contact/RigidBatBallContact';
import {
  PENNBOUNCE_EXPLORATORY_ASSUMPTION_GRID_V1,
  searchAllPennbounceSurfaceAssumptions,
  searchPennbounceEquivalentSurfaceFits,
} from './PennbounceSurfaceAssumptionSearch';

describe('Pennbounce surface assumption search', () => {
  it('ranks explicitly conditioned fits without promoting one to production truth', () => {
    const result =
      searchPennbounceEquivalentSurfaceFits(
        'natural_turfgrass',
        REALISTIC_BASEBALL_RIGID_BODY,
        [
          {
            tangentialRestitution: 0,
            frictionCoefficient: 0.15,
          },
          {
            tangentialRestitution: 0.4,
            frictionCoefficient: 0.3,
          },
          {
            tangentialRestitution: 0.6,
            frictionCoefficient: 1,
          },
        ],
        0.01,
      );

    expect(result.fits)
      .toHaveLength(3);
    expect(
      result.fits[0]!
        .rootMeanSquaredError,
    ).toBeLessThanOrEqual(
      result.fits[1]!
        .rootMeanSquaredError,
    );
    expect(
      result.fits.every(
        (fit) =>
          fit.assumptions
            .frictionCoefficient
          !== undefined,
      ),
    ).toBe(true);
  });

  it('reports near-equivalent candidate multiplicity instead of hiding underdetermination', () => {
    const result =
      searchPennbounceEquivalentSurfaceFits(
        'astroturf',
        REALISTIC_BASEBALL_RIGID_BODY,
        [
          {
            tangentialRestitution: 0.2,
            frictionCoefficient: 0.3,
          },
          {
            tangentialRestitution: 0.2,
            frictionCoefficient: 0.6,
          },
        ],
        1,
      );

    expect(result.nearBest)
      .toHaveLength(2);
    expect(
      result.underdeterminedWithinTolerance,
    ).toBe(true);
  });

  it('has a deterministic exploratory candidate grid rather than a hidden optimizer domain', () => {
    expect(
      PENNBOUNCE_EXPLORATORY_ASSUMPTION_GRID_V1,
    ).toHaveLength(16);
    expect(
      new Set(
        PENNBOUNCE_EXPLORATORY_ASSUMPTION_GRID_V1
          .map(
            (candidate) =>
              JSON.stringify(candidate),
          ),
      ).size,
    ).toBe(16);
  });

  it('can analyze all four published playing-surface families with the same evidence boundary', () => {
    const results =
      searchAllPennbounceSurfaceAssumptions(
        REALISTIC_BASEBALL_RIGID_BODY,
        [
          {
            tangentialRestitution: 0.4,
            frictionCoefficient: 0.3,
          },
        ],
      );

    expect(
      results.map(
        (result) =>
          result.surface,
      ),
    ).toEqual([
      'astroturf',
      'skinned_infield',
      'fieldturf',
      'natural_turfgrass',
    ]);
    expect(
      results.every(
        (result) =>
          result.fits.length === 1,
      ),
    ).toBe(true);
  });
});
