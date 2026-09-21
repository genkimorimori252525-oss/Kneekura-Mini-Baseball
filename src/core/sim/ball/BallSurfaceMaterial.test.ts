import { describe, expect, it } from 'vitest';
import {
  calculateSurfaceIncidenceAngleRadians,
  resolveBallSurfaceMaterialContact,
  type BallSurfaceMaterialProfile,
} from './BallSurfaceMaterial';

describe('ball surface material profile', () => {
  it('calculates incidence angle relative to an arbitrary surface normal', () => {
    const angle =
      calculateSurfaceIncidenceAngleRadians(
        {
          x: 3,
          y: -4,
          z: 0,
        },
        {
          x: 0,
          y: 1,
          z: 0,
        },
      );

    expect(angle).toBeCloseTo(
      Math.atan2(4, 3),
      12,
    );
  });

  it('uses the same angle logic for a vertical wall', () => {
    const angle =
      calculateSurfaceIncidenceAngleRadians(
        {
          x: 4,
          y: 0,
          z: 3,
        },
        {
          x: -1,
          y: 0,
          z: 0,
        },
      );

    expect(angle).toBeCloseTo(
      Math.atan2(4, 3),
      12,
    );
  });

  it('resolves an angle-speed grid without knowing whether the material is ground or wall', () => {
    const material:
      BallSurfaceMaterialProfile = {
        materialId: 'fixture',
        version: 'v1',
        response: {
          kind: 'angle_speed_grid',
          grid: {
            profileId:
              'fixture-grid',
            version: 'v1',
            angleRows: [
              {
                incidenceAngleRadians:
                  0.4,
                speedKnots: [
                  {
                    incidentSpeedMps: 10,
                    contact: {
                      normalRestitution: 0.6,
                      tangentialRestitution: 0.2,
                      frictionCoefficient: 0.3,
                    },
                  },
                ],
              },
              {
                incidenceAngleRadians:
                  0.8,
                speedKnots: [
                  {
                    incidentSpeedMps: 10,
                    contact: {
                      normalRestitution: 0.2,
                      tangentialRestitution: 0.4,
                      frictionCoefficient: 0.5,
                    },
                  },
                ],
              },
            ],
          },
        },
      };

    const contact =
      resolveBallSurfaceMaterialContact(
        material,
        {
          x: 10 * Math.cos(0.6),
          y: -10 * Math.sin(0.6),
          z: 0,
        },
        {
          x: 0,
          y: 1,
          z: 0,
        },
      );

    expect(
      contact.normalRestitution,
    ).toBeCloseTo(0.4, 12);
    expect(
      contact.tangentialRestitution,
    ).toBeCloseTo(0.3, 12);
    expect(
      contact.frictionCoefficient,
    ).toBeCloseTo(0.4, 12);
  });
});
