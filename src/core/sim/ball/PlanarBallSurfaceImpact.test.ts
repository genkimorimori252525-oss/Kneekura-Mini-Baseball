import { describe, expect, it } from 'vitest';
import {
  REALISTIC_BASEBALL_RIGID_BODY,
} from '../contact/RigidBatBallContact';
import {
  DEFAULT_BALL_FLIGHT_PARAMETERS,
} from './BallFlight';
import {
  findPlanarBallSurfaceContactTick,
  measureSpherePlanarSurfaceSeparation,
  resolvePlanarBallSurfaceImpact,
  resolvePlanarBallSurfaceMaterialImpact,
} from './PlanarBallSurfaceImpact';

const wall = {
  point: {
    x: 5,
    y: 0,
    z: 0,
  },
  normal: {
    x: -1,
    y: 0,
    z: 0,
  },
} as const;

describe('planar ball surface impact', () => {
  it('uses sphere radius when measuring wall separation', () => {
    expect(
      measureSpherePlanarSurfaceSeparation(
        {
          x:
            5
            - REALISTIC_BASEBALL_RIGID_BODY
              .radiusM,
          y: 1,
          z: 0,
        },
        REALISTIC_BASEBALL_RIGID_BODY.radiusM,
        wall,
      ),
    ).toBeCloseTo(0, 12);
  });

  it('finds the first authoritative tick where free flight reaches a vertical wall', () => {
    const state = {
      tick: 1_000_000,
      position: {
        x: 0,
        y: 1,
        z: 0,
      },
      velocity: {
        x: 10,
        y: 0,
        z: 0,
      },
      spin: {
        x: 0,
        y: 0,
        z: 0,
      },
    };

    const tick =
      findPlanarBallSurfaceContactTick(
        state,
        1_000_000,
        {
          ...DEFAULT_BALL_FLIGHT_PARAMETERS,
          gravityY: 0,
        },
        REALISTIC_BASEBALL_RIGID_BODY.radiusM,
        wall,
      );

    expect(tick).not.toBeNull();

    const expectedSeconds =
      (
        5
        - REALISTIC_BASEBALL_RIGID_BODY.radiusM
      ) / 10;
    const expectedTick =
      state.tick
      + Math.ceil(
        expectedSeconds
        * DEFAULT_BALL_FLIGHT_PARAMETERS
          .ticksPerSecond,
      );

    expect(tick).toBe(expectedTick);
  });

  it('resolves the same spin-coupled surface physics for a wall impact', () => {
    const impact =
      resolvePlanarBallSurfaceImpact(
        {
          tick: 0,
          position: {
            x: 4,
            y: 1,
            z: 0,
          },
          velocity: {
            x: 12,
            y: 0,
            z: 4,
          },
          spin: {
            x: 0,
            y: 50,
            z: 0,
          },
        },
        200_000,
        {
          ...DEFAULT_BALL_FLIGHT_PARAMETERS,
          gravityY: 0,
        },
        REALISTIC_BASEBALL_RIGID_BODY,
        wall,
        {
          normalRestitution: 0.4,
          tangentialRestitution: 0,
          frictionCoefficient: 0.3,
        },
      );

    expect(impact).not.toBeNull();
    expect(
      measureSpherePlanarSurfaceSeparation(
        impact!.centerAtContact,
        REALISTIC_BASEBALL_RIGID_BODY.radiusM,
        wall,
      ),
    ).toBeCloseTo(0, 10);
    expect(
      impact!.contact.exitVelocity.x,
    ).toBeLessThan(0);
  });

  it('resolves wall response from a unified material profile at the actual incident angle and speed', () => {
    const impact =
      resolvePlanarBallSurfaceMaterialImpact(
        {
          tick: 0,
          position: {
            x: 4,
            y: 1,
            z: 0,
          },
          velocity: {
            x: 8,
            y: 0,
            z: 6,
          },
          spin: {
            x: 0,
            y: 0,
            z: 0,
          },
        },
        300_000,
        {
          ...DEFAULT_BALL_FLIGHT_PARAMETERS,
          gravityY: 0,
        },
        REALISTIC_BASEBALL_RIGID_BODY,
        wall,
        {
          materialId: 'fixture-wall',
          version: 'v1',
          response: {
            kind: 'angle_speed_grid',
            grid: {
              profileId: 'fixture-wall-grid',
              version: 'v1',
              angleRows: [
                {
                  incidenceAngleRadians: 0.5,
                  speedKnots: [
                    {
                      incidentSpeedMps: 10,
                      contact: {
                        normalRestitution: 0.6,
                        tangentialRestitution: 0,
                        frictionCoefficient: 0,
                      },
                    },
                  ],
                },
                {
                  incidenceAngleRadians: 1.0,
                  speedKnots: [
                    {
                      incidentSpeedMps: 10,
                      contact: {
                        normalRestitution: 0.2,
                        tangentialRestitution: 0,
                        frictionCoefficient: 0,
                      },
                    },
                  ],
                },
              ],
            },
          },
        },
      );

    expect(impact).not.toBeNull();
    expect(
      Math.abs(
        impact!.contact.exitVelocity.x,
      ),
    ).toBeLessThan(8);
  });

  it('returns null when the ball cannot reach the wall inside the interval', () => {
    expect(
      findPlanarBallSurfaceContactTick(
        {
          tick: 0,
          position: {
            x: 0,
            y: 1,
            z: 0,
          },
          velocity: {
            x: 1,
            y: 0,
            z: 0,
          },
          spin: {
            x: 0,
            y: 0,
            z: 0,
          },
        },
        100_000,
        {
          ...DEFAULT_BALL_FLIGHT_PARAMETERS,
          gravityY: 0,
        },
        REALISTIC_BASEBALL_RIGID_BODY.radiusM,
        wall,
      ),
    ).toBeNull();
  });
});
