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
    ).toBeCloseTo(0.6, 5);
    expect(
      faster.velocity.y / 40,
    ).toBeCloseTo(0.2, 5);
  });

  it('can resolve a different response for shallow versus steep impact angle at the same speed', () => {
    const responseGrid = {
      profileId: 'angle-speed-fixture',
      version: 'v1',
      angleRows: [
        {
          incidenceAngleRadians: 0.4,
          speedKnots: [
            {
              incidentSpeedMps: 20,
              contact: {
                normalRestitution: 0.6,
                tangentialRestitution: 0,
                frictionCoefficient: 0,
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
                normalRestitution: 0.2,
                tangentialRestitution: 0,
                frictionCoefficient: 0,
              },
            },
          ],
        },
      ],
    } as const;

    const parameters: BallFlightParameters = {
      ...DEFAULT_BALL_FLIGHT_PARAMETERS,
      restingVerticalSpeed: 0.01,
      groundSurfacePhysics: {
        ball: REFERENCE_BASEBALL_RIGID_BODY,
        responseGrid,
      },
    };

    const speed = 20;
    const shallowAngle = 0.4;
    const steepAngle = 0.8;

    const shallow = advanceBallState(
      {
        tick: 0,
        position: {
          x: 0,
          y: REFERENCE_BASEBALL_RIGID_BODY.radiusM,
          z: 0,
        },
        velocity: {
          x: speed * Math.cos(shallowAngle),
          y: -speed * Math.sin(shallowAngle),
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

    const steep = advanceBallState(
      {
        tick: 0,
        position: {
          x: 0,
          y: REFERENCE_BASEBALL_RIGID_BODY.radiusM,
          z: 0,
        },
        velocity: {
          x: speed * Math.cos(steepAngle),
          y: -speed * Math.sin(steepAngle),
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
      shallow.velocity.y
      / (speed * Math.sin(shallowAngle)),
    ).toBeCloseTo(0.6, 5);
    expect(
      steep.velocity.y
      / (speed * Math.sin(steepAngle)),
    ).toBeCloseTo(0.2, 5);
  });

  it('lets settled balls skid for physical time before reaching no-slip rolling', () => {
    const parameters: BallFlightParameters = {
      ...DEFAULT_BALL_FLIGHT_PARAMETERS,
      groundSurfacePhysics: {
        ball: REFERENCE_BASEBALL_RIGID_BODY,
        contact: {
          normalRestitution: 0.4,
          tangentialRestitution: 0,
          frictionCoefficient: 0.3,
        },
        slidingFrictionCoefficient: 0.15,
        enforceRollingConstraint: true,
      },
    };

    const initial = {
      tick: 0,
      position: {
        x: 0,
        y: REFERENCE_BASEBALL_RIGID_BODY.radiusM,
        z: 0,
      },
      velocity: {
        x: 8,
        y: 0,
        z: 0,
      },
      spin: {
        x: 0,
        y: 0,
        z: 0,
      },
    };

    const early = advanceBallState(
      initial,
      10_000,
      parameters,
    );
    const earlySlip =
      early.velocity.x
      + REFERENCE_BASEBALL_RIGID_BODY.radiusM
        * early.spin.z;

    expect(Math.abs(earlySlip))
      .toBeGreaterThan(0.1);

    const late = advanceBallState(
      early,
      2_000_000,
      parameters,
    );
    const lateSlip =
      late.velocity.x
      + REFERENCE_BASEBALL_RIGID_BODY.radiusM
        * late.spin.z;

    expect(Math.abs(lateSlip))
      .toBeLessThan(1e-8);
    expect(late.velocity.x)
      .toBeLessThan(early.velocity.x);
  });

  it('can consume one unified material profile for bounce, skid, and rolling resistance', () => {
    const material = {
      materialId: 'fixture-ground',
      version: 'v1',
      response: {
        kind: 'static',
        contact: {
          normalRestitution: 0.25,
          tangentialRestitution: 0,
          frictionCoefficient: 0.2,
        },
      },
      slidingFrictionCoefficient: 0.1,
      rollingDecelerationMps2: 0.5,
    } as const;

    const parameters: BallFlightParameters = {
      ...DEFAULT_BALL_FLIGHT_PARAMETERS,
      restingVerticalSpeed: 0.01,
      groundSurfacePhysics: {
        ball: REFERENCE_BASEBALL_RIGID_BODY,
        material,
      },
    };

    const bounced = advanceBallState(
      {
        tick: 0,
        position: {
          x: 0,
          y: REFERENCE_BASEBALL_RIGID_BODY.radiusM,
          z: 0,
        },
        velocity: {
          x: 6,
          y: -2,
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

    expect(bounced.velocity.y)
      .toBeCloseTo(0.5, 5);

    const ground = advanceBallState(
      {
        tick: 10,
        position: {
          x: 0,
          y: REFERENCE_BASEBALL_RIGID_BODY.radiusM,
          z: 0,
        },
        velocity: {
          x: 6,
          y: 0,
          z: 0,
        },
        spin: {
          x: 0,
          y: 0,
          z: -6 / REFERENCE_BASEBALL_RIGID_BODY.radiusM,
        },
      },
      1_000_000,
      parameters,
    );

    expect(ground.velocity.x)
      .toBeCloseTo(5.5, 6);
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
