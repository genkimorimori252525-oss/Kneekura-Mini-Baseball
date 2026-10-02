import { describe, expect, it } from 'vitest';
import {
  resolveBallSurfaceResponseGrid,
  validateBallSurfaceResponseGrid,
  type BallSurfaceResponseGrid,
} from './BallSurfaceResponseGrid';

const grid: BallSurfaceResponseGrid = {
  profileId: 'fixture-grid',
  version: 'v1',
  angleRows: [
    {
      incidenceAngleRadians: 0.4,
      speedKnots: [
        {
          incidentSpeedMps: 20,
          contact: {
            normalRestitution: 0.6,
            tangentialRestitution: 0.2,
            frictionCoefficient: 0.3,
          },
        },
        {
          incidentSpeedMps: 40,
          contact: {
            normalRestitution: 0.4,
            tangentialRestitution: 0.1,
            frictionCoefficient: 0.5,
          },
        },
      ],
    },
    {
      incidenceAngleRadians: 0.8,
      speedKnots: [
        {
          incidentSpeedMps: 20,
          contact: {
            normalRestitution: 0.4,
            tangentialRestitution: 0.4,
            frictionCoefficient: 0.5,
          },
        },
        {
          incidentSpeedMps: 40,
          contact: {
            normalRestitution: 0.2,
            tangentialRestitution: 0.2,
            frictionCoefficient: 0.7,
          },
        },
      ],
    },
  ],
};

describe('ball surface response grid', () => {
  it('interpolates over speed and incidence angle deterministically', () => {
    const result =
      resolveBallSurfaceResponseGrid(
        grid,
        30,
        0.6,
      );

    expect(result.normalRestitution)
      .toBeCloseTo(0.4, 12);
    expect(result.tangentialRestitution)
      .toBeCloseTo(0.225, 12);
    expect(result.frictionCoefficient)
      .toBeCloseTo(0.5, 12);
  });

  it('clamps both angle and speed outside calibrated ranges', () => {
    expect(
      resolveBallSurfaceResponseGrid(
        grid,
        5,
        0.1,
      ),
    ).toEqual(
      grid.angleRows[0]!
        .speedKnots[0]!.contact,
    );

    expect(
      resolveBallSurfaceResponseGrid(
        grid,
        100,
        1.4,
      ),
    ).toEqual(
      grid.angleRows[1]!
        .speedKnots[1]!.contact,
    );
  });

  it('requires strictly increasing incidence-angle rows', () => {
    expect(() =>
      validateBallSurfaceResponseGrid({
        ...grid,
        angleRows: [
          grid.angleRows[1]!,
          grid.angleRows[0]!,
        ],
      }),
    ).toThrow(
      'surface response incidence angles must be finite, within (0, pi/2], and strictly increasing',
    );
  });
});
