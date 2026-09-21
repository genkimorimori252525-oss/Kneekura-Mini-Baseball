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
import {
  resolveBallSurfaceResponseGrid,
  type BallSurfaceResponseGrid,
} from './BallSurfaceResponseGrid';

export type PennbounceSurfaceResidual = Readonly<{
  surface: PennbounceSurfaceId;
  incidentSpeedMps: number;
  incidenceAngleRadians: number;
  measuredSpeedRatio: number;
  predictedSpeedRatio: number;
  residual: number;
}>;

export type PennbounceSurfaceCalibrationScore = Readonly<{
  surface: PennbounceSurfaceId;
  targetCount: number;
  rootMeanSquaredError: number;
  meanBias: number;
  maximumAbsoluteError: number;
  residuals:
    readonly PennbounceSurfaceResidual[];
}>;

/**
 * Evaluates one versioned reduced-order surface grid against all four
 * Pennbounce angle x speed combinations for a chosen material.
 *
 * The source publishes total rebound-speed ratio only, so this function is an
 * objective/validation layer. It deliberately does NOT claim that those four
 * measurements uniquely identify normal COR, tangential COR and friction.
 */
export const evaluatePennbounceSurfaceResponseGrid = (
  surface: PennbounceSurfaceId,
  grid: BallSurfaceResponseGrid,
  ball: RigidBaseballProperties,
): PennbounceSurfaceCalibrationScore => {
  const targets =
    PENNBOUNCE_2005_BLOCK_COMBINATION_TARGETS
      .filter(
        (target) =>
          target.surface === surface,
      );

  if (targets.length === 0) {
    throw new Error(
      'Pennbounce calibration requires at least one target for surface',
    );
  }

  const residuals =
    targets.map(
      (
        target,
      ): PennbounceSurfaceResidual => {
        const contact =
          resolveBallSurfaceResponseGrid(
            grid,
            target.nominalIncidentSpeedMps,
            target.incidenceAngleRadians,
          );
        const predicted =
          simulateBaseballSurfacePace({
            incidentSpeedMps:
              target.nominalIncidentSpeedMps,
            incidenceAngleRadians:
              target.incidenceAngleRadians,
            ball,
            contact,
          }).speedRatio;
        const measured =
          meanPennbounceBlockCombination(
            target,
          );

        return {
          surface,
          incidentSpeedMps:
            target.nominalIncidentSpeedMps,
          incidenceAngleRadians:
            target.incidenceAngleRadians,
          measuredSpeedRatio:
            measured,
          predictedSpeedRatio:
            predicted,
          residual:
            predicted - measured,
        };
      },
    );

  const squaredError =
    residuals.reduce(
      (sum, row) =>
        sum
        + row.residual
        * row.residual,
      0,
    );
  const bias =
    residuals.reduce(
      (sum, row) =>
        sum + row.residual,
      0,
    ) / residuals.length;
  const maximumAbsoluteError =
    Math.max(
      ...residuals.map(
        (row) =>
          Math.abs(row.residual),
      ),
    );

  return {
    surface,
    targetCount:
      residuals.length,
    rootMeanSquaredError:
      Math.sqrt(
        squaredError
        / residuals.length,
      ),
    meanBias: bias,
    maximumAbsoluteError,
    residuals,
  };
};
