import { describe, expect, it } from 'vitest';
import {
  REFERENCE_BASEBALL_AERODYNAMICS,
} from '../ball/BaseballAerodynamics';
import {
  DEFAULT_BALL_FLIGHT_PARAMETERS,
} from '../ball/BallFlight';
import {
  REALISTIC_BASEBALL_RIGID_BODY,
  type RigidBatBallContactKinematics,
  type RigidBatPhysicalProperties,
} from '../contact/RigidBatBallContact';
import {
  createEvidenceBackedWoodBatContactParameters,
} from '../contact/WoodBatContactResponse';
import type {
  AerodynamicPitchTrajectory,
} from '../pitching/AerodynamicPitchTrajectory';
import {
  simulateAerodynamicRigidContactFlightSlice,
} from './AerodynamicRigidContactFlightSlice';

const batPhysical:
  RigidBatPhysicalProperties = {
    massKg: 0.9,
    centerOfMassT: 0.6,
    transverseMomentOfInertiaKgM2: 0.06,
    axialMomentOfInertiaKgM2: 0.00055,
    radiusProfile: {
      knots: [
        { t: 0, radiusM: 0.033 },
        { t: 1, radiusM: 0.033 },
      ],
    },
  };

const trajectory:
  AerodynamicPitchTrajectory = {
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
        x: 20,
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
  };

const swing = {
  startTick: 1_000_000,
  endTick: 1_006_000,
  ticksPerSecond: 1_000_000,
  stateAtStart: {
    pose: {
      grip: {
        x: -0.42,
        y: 1,
        z: 0,
      },
      tip: {
        x: 0.42,
        y: 1,
        z: 0,
      },
    },
    linearVelocity: {
      x: 0,
      y: 0,
      z: 20,
    },
    angularVelocity: {
      x: 0,
      y: 0,
      z: 0,
    },
  },
  physical: batPhysical,
} as const;

const flightParameters = {
  ...DEFAULT_BALL_FLIGHT_PARAMETERS,
  aerodynamics: {
    ...REFERENCE_BASEBALL_AERODYNAMICS,
    ballMassKg:
      REALISTIC_BASEBALL_RIGID_BODY.massKg,
    ballRadiusM:
      REALISTIC_BASEBALL_RIGID_BODY.radiusM,
  },
  ballRadius:
    REALISTIC_BASEBALL_RIGID_BODY.radiusM,
  groundSurfacePhysics: {
    ball:
      REALISTIC_BASEBALL_RIGID_BODY,
    material: {
      materialId: 'fixture-ground',
      version: 'v1',
      response: {
        kind: 'static',
        contact: {
          normalRestitution: 0.35,
          tangentialRestitution: 0,
          frictionCoefficient: 0.25,
        },
      },
      slidingFrictionCoefficient: 0.15,
      rollingDecelerationMps2: 1,
    },
  },
} as const;

describe('aerodynamic rigid contact -> batted-ball flight slice', () => {
  it('carries the actual rigid-contact center, velocity and spin directly into flight', () => {
    const result =
      simulateAerodynamicRigidContactFlightSlice({
        trajectory,
        swing,
        ball:
          REALISTIC_BASEBALL_RIGID_BODY,
        parameterResolver:
          (kinematics) =>
            createEvidenceBackedWoodBatContactParameters({
              relativeImpactSpeedMps:
                kinematics
                  .normalApproachSpeedMps,
              frictionCoefficient: 0.2,
            }),
        flightParameters,
        durationTicks: 100_000,
        cadenceTicks: 25_000,
      });

    expect(result.initialBall)
      .toEqual({
        tick: result.contact.tick,
        position:
          result.contact.ballCenter,
        velocity:
          result.contact.exitVelocity,
        spin:
          result.contact.exitSpin,
      });
    expect(result.samples[0])
      .toEqual(result.initialBall);
    expect(result.samples)
      .toHaveLength(5);
  });

  it('is deterministic through pitch flight, rigid collision and batted-ball flight', () => {
    const input = {
      trajectory,
      swing,
      ball:
        REALISTIC_BASEBALL_RIGID_BODY,
      parameterResolver:
        (kinematics:
          RigidBatBallContactKinematics) =>
          createEvidenceBackedWoodBatContactParameters({
            relativeImpactSpeedMps:
              kinematics
                .normalApproachSpeedMps,
            frictionCoefficient: 0.2,
          }),
      flightParameters,
      durationTicks: 100_000,
      cadenceTicks: 25_000,
    } as const;

    expect(
      simulateAerodynamicRigidContactFlightSlice(
        input,
      ),
    ).toEqual(
      simulateAerodynamicRigidContactFlightSlice(
        input,
      ),
    );
  });
});
