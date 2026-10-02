import type {
  RigidBaseballProperties,
} from '../contact/RigidBatBallContact';
import {
  meanPennbounceBlockCombination,
  PENNBOUNCE_2005_BLOCK_COMBINATION_TARGETS,
  type PennbounceSurfaceId,
} from './BaseballSurfacePaceCalibration';
import {
  simulateBaseballSurfacePace,
} from './BaseballSurfacePaceModel';
import type {
  BallSurfaceResponseGrid,
} from './BallSurfaceResponseGrid';

export type PennbounceEquivalentFitAssumptions = Readonly<{
  tangentialRestitution: number;
  frictionCoefficient: number;
}>;

export type PennbounceEquivalentFitKnot = Readonly<{
  incidentSpeedMps: number;
  incidenceAngleRadians: number;
  measuredSpeedRatio: number;
  fittedNormalRestitution: number;
  predictedSpeedRatio: number;
  absoluteResidual: number;
  /**
   * True when the best solution sits at e_n=0 or e_n=1, indicating the
   * selected tangential/friction assumptions may not span the measurement.
   */
  boundaryLimited: boolean;
}>;

export type PennbounceEquivalentSurfaceFit = Readonly<{
  surface: PennbounceSurfaceId;
  assumptions: PennbounceEquivalentFitAssumptions;
  grid: BallSurfaceResponseGrid;
  knots: readonly PennbounceEquivalentFitKnot[];
  rootMeanSquaredError: number;
  maximumAbsoluteError: number;
  boundaryLimitedCount: number;
}>;

const validateAssumptions = (
  assumptions:
    PennbounceEquivalentFitAssumptions,
): void => {
  if (
    !Number.isFinite(
      assumptions.tangentialRestitution,
    )
    || assumptions.tangentialRestitution < 0
    || assumptions.tangentialRestitution > 1
  ) {
    throw new Error(
      'Pennbounce fit tangentialRestitution must lie within [0, 1]',
    );
  }
  if (
    !Number.isFinite(
      assumptions.frictionCoefficient,
    )
    || assumptions.frictionCoefficient < 0
  ) {
    throw new Error(
      'Pennbounce fit frictionCoefficient must be finite and non-negative',
    );
  }
};

const fitNormalRestitution = (
  ball: RigidBaseballProperties,
  incidentSpeedMps: number,
  incidenceAngleRadians: number,
  measuredSpeedRatio: number,
  assumptions:
    PennbounceEquivalentFitAssumptions,
): Readonly<{
  normalRestitution: number;
  predictedSpeedRatio: number;
  absoluteResidual: number;
}> => {
  let lower = 0;
  let upper = 1;

  let bestNormal = 0;
  let bestPredicted = Infinity;
  let bestResidual = Infinity;

  // Repeated deterministic grid refinement avoids assuming the response is
  // globally monotonic across friction-limited/non-slip regime transitions.
  for (let pass = 0; pass < 6; pass += 1) {
    const intervals = 100;
    const step =
      (upper - lower) / intervals;
    let passBestIndex = 0;

    for (
      let index = 0;
      index <= intervals;
      index += 1
    ) {
      const normalRestitution =
        lower + step * index;
      const predictedSpeedRatio =
        simulateBaseballSurfacePace({
          incidentSpeedMps,
          incidenceAngleRadians,
          ball,
          contact: {
            normalRestitution,
            tangentialRestitution:
              assumptions
                .tangentialRestitution,
            frictionCoefficient:
              assumptions
                .frictionCoefficient,
          },
        }).speedRatio;
      const residual =
        Math.abs(
          predictedSpeedRatio
          - measuredSpeedRatio,
        );

      if (
        residual < bestResidual
        || (
          Math.abs(
            residual - bestResidual,
          ) <= 1e-15
          && normalRestitution
            < bestNormal
        )
      ) {
        bestNormal =
          normalRestitution;
        bestPredicted =
          predictedSpeedRatio;
        bestResidual = residual;
        passBestIndex = index;
      }
    }

    if (step <= 1e-12) {
      break;
    }

    lower = Math.max(
      0,
      lower
      + step
        * Math.max(
          0,
          passBestIndex - 1,
        ),
    );
    upper = Math.min(
      1,
      lower
      + step * 2,
    );
  }

  return {
    normalRestitution:
      bestNormal,
    predictedSpeedRatio:
      bestPredicted,
    absoluteResidual:
      bestResidual,
  };
};

/**
 * Builds an equivalent normal-COR grid conditioned on explicitly supplied
 * tangential COR and friction assumptions.
 *
 * Pennbounce's Vout/Vin measurements do not uniquely identify all three local
 * contact parameters. This fitter therefore never labels its result as a
 * unique material truth; it exposes when the chosen assumptions force an
 * endpoint-limited solution.
 */
export const fitPennbounceEquivalentSurfaceGrid = (
  surface: PennbounceSurfaceId,
  ball: RigidBaseballProperties,
  assumptions:
    PennbounceEquivalentFitAssumptions,
  version:
    string = 'pennbounce-equivalent-fit-v1',
): PennbounceEquivalentSurfaceFit => {
  validateAssumptions(assumptions);
  if (version.length === 0) {
    throw new Error(
      'Pennbounce equivalent fit version must not be empty',
    );
  }

  const targets =
    PENNBOUNCE_2005_BLOCK_COMBINATION_TARGETS
      .filter(
        (target) =>
          target.surface === surface,
      )
      .sort((a, b) => (
        a.incidenceAngleRadians
          - b.incidenceAngleRadians
        || a.nominalIncidentSpeedMps
          - b.nominalIncidentSpeedMps
      ));

  if (targets.length === 0) {
    throw new Error(
      'Pennbounce equivalent fit requires surface targets',
    );
  }

  const knots =
    targets.map(
      (
        target,
      ): PennbounceEquivalentFitKnot => {
        const measuredSpeedRatio =
          meanPennbounceBlockCombination(
            target,
          );
        const fitted =
          fitNormalRestitution(
            ball,
            target.nominalIncidentSpeedMps,
            target.incidenceAngleRadians,
            measuredSpeedRatio,
            assumptions,
          );

        return {
          incidentSpeedMps:
            target.nominalIncidentSpeedMps,
          incidenceAngleRadians:
            target.incidenceAngleRadians,
          measuredSpeedRatio,
          fittedNormalRestitution:
            fitted.normalRestitution,
          predictedSpeedRatio:
            fitted.predictedSpeedRatio,
          absoluteResidual:
            fitted.absoluteResidual,
          boundaryLimited:
            fitted.normalRestitution
              <= 1e-8
            || fitted.normalRestitution
              >= 1 - 1e-8,
        };
      },
    );

  const uniqueAngles = [
    ...new Set(
      knots.map(
        (knot) =>
          knot.incidenceAngleRadians,
      ),
    ),
  ].sort((a, b) => a - b);

  const grid: BallSurfaceResponseGrid = {
    profileId:
      `pennbounce:${surface}:equivalent`,
    version,
    angleRows:
      uniqueAngles.map(
        (angle) => ({
          incidenceAngleRadians:
            angle,
          speedKnots:
            knots
              .filter(
                (knot) =>
                  knot.incidenceAngleRadians
                  === angle,
              )
              .sort(
                (a, b) =>
                  a.incidentSpeedMps
                  - b.incidentSpeedMps,
              )
              .map(
                (knot) => ({
                  incidentSpeedMps:
                    knot.incidentSpeedMps,
                  contact: {
                    normalRestitution:
                      knot.fittedNormalRestitution,
                    tangentialRestitution:
                      assumptions
                        .tangentialRestitution,
                    frictionCoefficient:
                      assumptions
                        .frictionCoefficient,
                  },
                }),
              ),
        }),
      ),
  };

  const squaredError =
    knots.reduce(
      (sum, knot) =>
        sum
        + knot.absoluteResidual
          * knot.absoluteResidual,
      0,
    );

  return {
    surface,
    assumptions,
    grid,
    knots,
    rootMeanSquaredError:
      Math.sqrt(
        squaredError
        / knots.length,
      ),
    maximumAbsoluteError:
      Math.max(
        ...knots.map(
          (knot) =>
            knot.absoluteResidual,
        ),
      ),
    boundaryLimitedCount:
      knots.filter(
        (knot) =>
          knot.boundaryLimited,
      ).length,
  };
};
