import { describe, expect, it } from 'vitest';
import {
  REFERENCE_BASEBALL_RIGID_BODY,
} from '../contact/RigidBatBallContact';
import {
  DEFAULT_BALL_FLIGHT_PARAMETERS,
  advanceBallState,
  type BallFlightParameters,
} from './BallFlight';

const physicalGround = (
  overrides: Partial<BallFlightParameters> = {},
): BallFlightParameters => ({
  ...DEFAULT_BALL_FLIGHT_PARAMETERS,
  restingVerticalSpeed: 0.5,
  groundSurfacePhysics: {
    ball: REFERENCE_BASEBALL_RIGID_BODY,
    contact: {
      normalRestitution: 0.4,
      tangentialRestitution: 0,
      frictionCoefficient: 10,
    },
    enforceRollingConstraint: true,
  },
  ...overrides,
});

describe('surface-aware ball flight', () => {
  it('uses spin-coupled impulse physics when physical ground contact is enabled', () => {
    const initial = {
      tick: 1_000_000,
      position: {
        x: 0,
        y: REFERENCE_BASEBALL_RIGID_BODY.radiusM,
        z: 0,
      },
      velocity: {
        x: 8,
        y: -6,
        z: 0,
      },
      spin: {
        x: 0,
        y: 0,
        z: 0,
      },
    };

    const result = advanceBallState(
      initial,
      1,
      physicalGround({
        restingVerticalSpeed: 0.1,
      }),
    );

    expect(result.velocity.x)
      .toBeLessThan(8);
    expect(result.velocity.y)
      .toBeGreaterThan(0);
    expect(result.spin.z)
      .toBeLessThan(0);
  });

  it('preserves the frozen legacy ground response when physical surface contact is disabled', () => {
    const initial = {
      tick: 1_000_000,
      position: {
        x: 0,
        y: DEFAULT_BALL_FLIGHT_PARAMETERS.ballRadius,
        z: 0,
      },
      velocity: {
        x: 8,
        y: -6,
        z: 0,
      },
      spin: {
        x: 0,
        y: 0,
        z: 0,
      },
    };

    const result = advanceBallState(
      initial,
      1,
      DEFAULT_BALL_FLIGHT_PARAMETERS,
    );

    expect(result.velocity.x)
      .toBeCloseTo(
        8
        * DEFAULT_BALL_FLIGHT_PARAMETERS
          .groundFriction,
        8,
      );
    expect(result.spin)
      .toEqual(initial.spin);
  });

  it('projects settled ground motion onto the no-slip rolling spin constraint', () => {
    const initial = {
      tick: 1_000_000,
      position: {
        x: 0,
        y: REFERENCE_BASEBALL_RIGID_BODY.radiusM,
        z: 0,
      },
      velocity: {
        x: 4,
        y: -0.5,
        z: 2,
      },
      spin: {
        x: 30,
        y: 7,
        z: 20,
      },
    };

    const result = advanceBallState(
      initial,
      1,
      physicalGround(),
    );

    expect(result.velocity.y)
      .toBe(0);
    expect(result.spin.x)
      .toBeCloseTo(
        result.velocity.z
        / REFERENCE_BASEBALL_RIGID_BODY.radiusM,
        8,
      );
    expect(result.spin.z)
      .toBeCloseTo(
        -result.velocity.x
        / REFERENCE_BASEBALL_RIGID_BODY.radiusM,
        8,
      );
    expect(result.spin.y)
      .toBeCloseTo(7, 8);
  });

  it('can resolve different physical ground response at different incident speeds from a versioned profile', () => {
    const responseProfile = {
      profileId: 'speed-sensitive-fixture',
      version: 'v1',
      knots: [
        {
          incidentSpeedMps: 10,
          contact: {
            normalRestitution: 0.6,
            tangentialRestitution: 0,
            frictionCoefficient: 0,
          },
        },
        {
          incidentSpeedMps: 40,
          contact: {
            normalRestitution: 0.2,
            tangentialRestitution: 0,
            frictionCoefficient: 0,
          },
        },
      ],
    } as const;

    const parameters: BallFlightParameters = {
      ...DEFAULT_BALL_FLIGHT_PARAMETERS,
      restingVerticalSpeed: 0.01,
      groundSurfacePhysics: {
        ball: REFERENCE_BASEBALL_RIGID_BODY,
        responseProfile,
      },
    };

    const slower = advanceBallState(
      {
        tick: 0,
        position: {
          x: 0,
          y: REFERENCE_BASEBALL_RIGID_BODY.radiusM,
          z: 0,
        },
        velocity: {
          x: 0,
          y: -10,
          z: 0,
        },
        spin: {
          x: 0,
          y: 0,
          z: 0,
        },
      },
      1,
      parameters,
    );

    const faster = advanceBallState(
      {
        tick: 0,
        position: {
          x: 0,
          y: REFERENCE_BASEBALL_RIGID_BODY.radiusM,
          z: 0,
        },
        velocity: {
          x: 0,
          y: -40,
          z: 0,
        },
        spin: {
          x: 0,
          y: 0,
          z: 0,
        },
      },
      1,
      parameters,
    );

    expect(
      slower.velocity.y / 10,
    ).toBeCloseTo(0.6, 6);
    expect(
      faster.velocity.y / 40,
    ).toBeCloseTo(0.2, 6);
  });

  it('rejects inconsistent physical ball radius at the flight boundary', () => {
    expect(() =>
      advanceBallState(
        {
          tick: 0,
          position: {
            x: 0,
            y: 1,
            z: 0,
          },
          velocity: {
            x: 0,
            y: 0,
            z: 1,
          },
          spin: {
            x: 0,
            y: 0,
            z: 0,
          },
        },
        1,
        physicalGround({
          groundSurfacePhysics: {
            ball: {
              ...REFERENCE_BASEBALL_RIGID_BODY,
              radiusM: 0.04,
            },
            contact: {
              normalRestitution: 0.4,
              tangentialRestitution: 0,
              frictionCoefficient: 0.3,
            },
          },
        }),
      ),
    ).toThrow(
      'groundSurfacePhysics.ball.radiusM must match ballRadius',
    );
  });
});
