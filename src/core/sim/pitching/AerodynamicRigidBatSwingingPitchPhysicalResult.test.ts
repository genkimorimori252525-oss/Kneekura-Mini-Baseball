import { describe, expect, it } from 'vitest';
import {
  REFERENCE_BASEBALL_AERODYNAMICS,
} from '../ball/BaseballAerodynamics';
import {
  REALISTIC_BASEBALL_RIGID_BODY,
  type RigidBatPhysicalProperties,
} from '../contact/RigidBatBallContact';
import {
  resolveAerodynamicRigidBatSwing,
} from './AerodynamicRigidBatSwingingPitchPhysicalResult';
import type {
  AerodynamicPitchTrajectory,
} from './AerodynamicPitchTrajectory';

const physical:
  RigidBatPhysicalProperties = {
    massKg: 0.9,
    centerOfMassT: 0.6,
    transverseMomentOfInertiaKgM2:
      0.06,
    axialMomentOfInertiaKgM2:
      0.00055,
    radiusProfile: {
      knots: [
        {
          t: 0,
          radiusM: 0.033,
        },
        {
          t: 1,
          radiusM: 0.033,
        },
      ],
    },
  };

const trajectory =
  (): AerodynamicPitchTrajectory => ({
    start: {
      tick: 1_000_000,
      position: {
        x: 0,
        y: 1,
        z: 0.2,
      },
      velocity: {
        x: 0,
        y: 0,
        z: -60,
      },
      spin: {
        x: 0,
        y: 0,
        z: 0,
      },
    },
    endTick: 1_006_000,
    parameters: {
      ticksPerSecond: 1_000_000,
      integrationStepTicks: 100,
      gravityY: -9.81,
      aerodynamics:
        REFERENCE_BASEBALL_AERODYNAMICS,
    },
  });

const swing = (
  xOffset = 0,
) => ({
  startTick: 1_000_000,
  endTick: 1_006_000,
  ticksPerSecond: 1_000_000,
  stateAtStart: {
    pose: {
      grip: {
        x: -0.42 + xOffset,
        y: 1,
        z: 0,
      },
      tip: {
        x: 0.42 + xOffset,
        y: 1,
        z: 0,
      },
    },
    linearVelocity: {
      x: 0,
      y: 0,
      z: 0,
    },
    angularVelocity: {
      x: 0,
      y: 0,
      z: 0,
    },
  },
  physical,
} as const);

describe('aerodynamic rigid-bat swing contact', () => {
  it('keeps the historical first-order window as an explicit compatibility path', () => {
    expect(
      swing().kinematicsV1,
    ).toBeUndefined();
  });

  it('finds tapered rigid contact along the aerodynamic pitch path', () => {
    let observedApproachSpeed:
      number | null = null;

    const result =
      resolveAerodynamicRigidBatSwing({
        trajectory: trajectory(),
        swing: swing(),
        ball:
          REALISTIC_BASEBALL_RIGID_BODY,
        parameterResolver:
          (kinematics) => {
            observedApproachSpeed =
              kinematics
                .normalApproachSpeedMps;
            return {
              normalRestitution: 0.5,
              tangentialRestitution: 0.3,
              frictionCoefficient: 0.2,
            };
          },
      });

    expect(result.kind).toBe('contact');
    if (result.kind !== 'contact') {
      throw new Error(
        'fixture must produce rigid contact',
      );
    }
    expect(
      observedApproachSpeed,
    ).not.toBeNull();
    expect(
      observedApproachSpeed!,
    ).toBeGreaterThan(40);
    expect(result.contact.ballCenter)
      .toBeDefined();
  });

  it('returns a miss when tapered bat geometry never reaches the aerodynamic pitch', () => {
    const result =
      resolveAerodynamicRigidBatSwing({
        trajectory: trajectory(),
        swing: swing(1),
        ball:
          REALISTIC_BASEBALL_RIGID_BODY,
        parameterResolver: () => ({
          normalRestitution: 0.5,
          tangentialRestitution: 0.3,
          frictionCoefficient: 0.2,
        }),
      });

    expect(result).toEqual({
      kind: 'swinging_miss',
      adjudicationTick: 1_006_000,
    });
  });

  it('is deterministic for the same physical inputs and resolver', () => {
    const input = {
      trajectory: trajectory(),
      swing: swing(),
      ball:
        REALISTIC_BASEBALL_RIGID_BODY,
      parameterResolver: () => ({
        normalRestitution: 0.5,
        tangentialRestitution: 0.3,
        frictionCoefficient: 0.2,
      }),
    } as const;

    expect(
      resolveAerodynamicRigidBatSwing(
        input,
      ),
    ).toEqual(
      resolveAerodynamicRigidBatSwing(
        input,
      ),
    );
  });
});