import { describe, expect, it } from 'vitest';
import {
  REALISTIC_BASEBALL_RIGID_BODY,
} from '../contact/RigidBatBallContact';
import {
  evaluatePennbounceSurfaceResponseGrid,
} from './PennbounceSurfaceCalibrationObjective';

describe('Pennbounce surface calibration objective', () => {
  it('evaluates all four angle-speed blocks for one surface', () => {
    const grid = {
      profileId: 'fixture-natural-grass',
      version: 'v1',
      angleRows: [
        {
          incidenceAngleRadians: 0.44,
          speedKnots: [
            {
              incidentSpeedMps: 31,
              contact: {
                normalRestitution: 0.3,
                tangentialRestitution: 0.6,
                frictionCoefficient: 0.5,
              },
            },
            {
              incidentSpeedMps: 40.2,
              contact: {
                normalRestitution: 0.25,
                tangentialRestitution: 0.7,
                frictionCoefficient: 0.6,
              },
            },
          ],
        },
        {
          incidenceAngleRadians: 0.61,
          speedKnots: [
            {
              incidentSpeedMps: 31,
              contact: {
                normalRestitution: 0.3,
                tangentialRestitution: 0.6,
                frictionCoefficient: 0.5,
              },
            },
            {
              incidentSpeedMps: 40.2,
              contact: {
                normalRestitution: 0.25,
                tangentialRestitution: 0.7,
                frictionCoefficient: 0.6,
              },
            },
          ],
        },
      ],
    } as const;

    const score =
      evaluatePennbounceSurfaceResponseGrid(
        'natural_turfgrass',
        grid,
        REALISTIC_BASEBALL_RIGID_BODY,
      );

    expect(score.targetCount).toBe(4);
    expect(score.residuals).toHaveLength(4);
    expect(score.rootMeanSquaredError)
      .toBeGreaterThanOrEqual(0);
    expect(score.maximumAbsoluteError)
      .toBeGreaterThanOrEqual(
        score.rootMeanSquaredError,
      );
  });

  it('preserves the exact Pennbounce block means as the measured side of the objective', () => {
    const grid = {
      profileId: 'fixture-astroturf',
      version: 'v1',
      angleRows: [
        {
          incidenceAngleRadians: 0.44,
          speedKnots: [
            {
              incidentSpeedMps: 31,
              contact: {
                normalRestitution: 0.5,
                tangentialRestitution: 0,
                frictionCoefficient: 0,
              },
            },
            {
              incidentSpeedMps: 40.2,
              contact: {
                normalRestitution: 0.5,
                tangentialRestitution: 0,
                frictionCoefficient: 0,
              },
            },
          ],
        },
        {
          incidenceAngleRadians: 0.61,
          speedKnots: [
            {
              incidentSpeedMps: 31,
              contact: {
                normalRestitution: 0.5,
                tangentialRestitution: 0,
                frictionCoefficient: 0,
              },
            },
            {
              incidentSpeedMps: 40.2,
              contact: {
                normalRestitution: 0.5,
                tangentialRestitution: 0,
                frictionCoefficient: 0,
              },
            },
          ],
        },
      ],
    } as const;

    const score =
      evaluatePennbounceSurfaceResponseGrid(
        'astroturf',
        grid,
        REALISTIC_BASEBALL_RIGID_BODY,
      );

    const shallow31 =
      score.residuals.find(
        (row) =>
          row.incidentSpeedMps === 31
          && Math.abs(
            row.incidenceAngleRadians
            - 0.44,
          ) < 1e-12,
      );

    expect(shallow31).toBeDefined();
    expect(
      shallow31!.measuredSpeedRatio,
    ).toBeCloseTo(
      (0.579 + 0.573 + 0.619) / 3,
      12,
    );
  });
});
