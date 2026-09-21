import type {
  RigidBaseballProperties,
} from '../contact/RigidBatBallContact';
import type {
  PennbounceSurfaceId,
} from './BaseballSurfacePaceCalibration';
import {
  fitPennbounceEquivalentSurfaceGrid,
  type PennbounceEquivalentFitAssumptions,
  type PennbounceEquivalentSurfaceFit,
} from './PennbounceEquivalentSurfaceFit';

export type PennbounceAssumptionCandidate =
  PennbounceEquivalentFitAssumptions;

export type PennbounceAssumptionSearchResult =
  Readonly<{
    surface: PennbounceSurfaceId;
    fits:
      readonly PennbounceEquivalentSurfaceFit[];
    bestRootMeanSquaredError: number;
    nearBestTolerance: number;
    nearBest:
      readonly PennbounceEquivalentSurfaceFit[];
    underdeterminedWithinTolerance: boolean;
  }>;

export const PENNBOUNCE_EXPLORATORY_ASSUMPTION_GRID_V1:
  readonly PennbounceAssumptionCandidate[] =
  Object.freeze(
    [0, 0.2, 0.4, 0.6]
      .flatMap(
        (tangentialRestitution) =>
          [0.15, 0.3, 0.6, 1]
            .map(
              (frictionCoefficient) => ({
                tangentialRestitution,
                frictionCoefficient,
              }),
            ),
      ),
  );

const assumptionsKey = (
  assumptions:
    PennbounceEquivalentFitAssumptions,
): string => (
  [
    assumptions
      .tangentialRestitution,
    assumptions
      .frictionCoefficient,
  ].join(':')
);

export const searchPennbounceEquivalentSurfaceFits = (
  surface: PennbounceSurfaceId,
  ball: RigidBaseballProperties,
  candidates:
    readonly PennbounceAssumptionCandidate[],
  nearBestTolerance = 0.0025,
): PennbounceAssumptionSearchResult => {
  if (candidates.length === 0) {
    throw new Error(
      'Pennbounce assumption search requires candidates',
    );
  }
  if (
    !Number.isFinite(nearBestTolerance)
    || nearBestTolerance < 0
  ) {
    throw new Error(
      'Pennbounce nearBestTolerance must be finite and non-negative',
    );
  }

  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = assumptionsKey(candidate);
    if (seen.has(key)) {
      throw new Error(
        'Pennbounce assumption candidates must be unique',
      );
    }
    seen.add(key);
  }

  const fits = candidates
    .map((assumptions) =>
      fitPennbounceEquivalentSurfaceGrid(
        surface,
        ball,
        assumptions,
        'pennbounce-assumption-search-v1',
      ),
    )
    .sort((a, b) => (
      a.rootMeanSquaredError
        - b.rootMeanSquaredError
      || a.boundaryLimitedCount
        - b.boundaryLimitedCount
      || a.assumptions
        .tangentialRestitution
        - b.assumptions
          .tangentialRestitution
      || a.assumptions
        .frictionCoefficient
        - b.assumptions
          .frictionCoefficient
    ));

  const bestRootMeanSquaredError =
    fits[0]!
      .rootMeanSquaredError;
  const nearBest = fits.filter(
    (fit) =>
      fit.rootMeanSquaredError
      <= bestRootMeanSquaredError
        + nearBestTolerance,
  );

  return {
    surface,
    fits,
    bestRootMeanSquaredError,
    nearBestTolerance,
    nearBest,
    underdeterminedWithinTolerance:
      nearBest.length > 1,
  };
};

/**
 * Convenience exploratory search across the published field surfaces.
 *
 * This deliberately returns evidence-conditioned candidate families rather
 * than a production material preset. A low RMSE alone cannot identify unique
 * tangential COR/friction from Pennbounce Vout/Vin observations.
 */
export const searchAllPennbounceSurfaceAssumptions = (
  ball: RigidBaseballProperties,
  candidates:
    readonly PennbounceAssumptionCandidate[] =
      PENNBOUNCE_EXPLORATORY_ASSUMPTION_GRID_V1,
  nearBestTolerance = 0.0025,
): readonly PennbounceAssumptionSearchResult[] => (
  [
    'astroturf',
    'skinned_infield',
    'fieldturf',
    'natural_turfgrass',
  ] as const
).map((surface) =>
  searchPennbounceEquivalentSurfaceFits(
    surface,
    ball,
    candidates,
    nearBestTolerance,
  ),
);
