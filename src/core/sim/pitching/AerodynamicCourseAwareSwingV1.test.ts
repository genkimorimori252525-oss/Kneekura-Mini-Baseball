import { describe, expect, it } from 'vitest';
import {
  REFERENCE_BASEBALL_AERODYNAMICS,
} from '../ball/BaseballAerodynamics';
import {
  REALISTIC_BASEBALL_RIGID_BODY,
  type RigidBatPhysicalProperties,
} from '../contact/RigidBatBallContact';
import {
  NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1,
} from '../contact/WoodBatProductionProfileV1';
import {
  resolveWoodBatSpeedResponse,
} from '../contact/WoodBatSpeedResponseProfile';
import {
  planAerodynamicCourseAwareSwingV1,
  resolveCourseAwareAerodynamicRigidSwingV1,
} from './AerodynamicCourseAwareSwingV1';
import type {
  AerodynamicPitchTrajectory,
} from './AerodynamicPitchTrajectory';

const physical:
  RigidBatPhysicalProperties = {
    massKg: 0.9,
    centerOfMassT: 0.58,
    transverseMomentOfInertiaKgM2:
      0.055,
    axialMomentOfInertiaKgM2:
      0.00050,
    radiusProfile: {
      knots: [
        {
          t: 0,
          radiusM: 0.025,
        },
        {
          t: 0.55,
          radiusM: 0.031,
        },
        {
          t: 1,
          radiusM: 0.033,
        },
      ],
    },
  };

const trajectory = (
  x = 0,
  y = 0.82,
): AerodynamicPitchTrajectory => ({
  start: {
    tick: 1_000_000,
    position: {
      x,
      y: y + 0.05,
      z: 15,
    },
    velocity: {
      x: 0,
      y: 0,
      z: -40,
    },
    spin: {
      x: 0,
      y: 0,
      z: 0,
    },
  },
  endTick: 1_500_000,
  parameters: {
    ticksPerSecond: 1_000_000,
    integrationStepTicks: 1_000,
    gravityY: -9.81,
    aerodynamics: {
      ...REFERENCE_BASEBALL_AERODYNAMICS,
      airDensityKgM3: 0,
    },
  },
});

const strikeZone = {
  centerX: 0,
  halfWidth: 0.2159,
  lowerY: 0.50,
  upperY: 1.10,
} as const;

const parameterResolver = (
  kinematics: Readonly<{
    normalApproachSpeedMps: number;
  }>,
) => resolveWoodBatSpeedResponse(
  NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1,
  kinematics.normalApproachSpeedMps,
);

describe('aerodynamic course-aware swing v1', () => {
  it('plans a production v1 swing window directly from the predicted aerodynamic pitch', () => {
    const planned =
      planAerodynamicCourseAwareSwingV1({
        predictedTrajectory:
          trajectory(),
        plateZ: 0,
        strikeZone,
        handedness: 'R',
        batterCenterOfMass: {
          x: -0.78,
          y: 1.0,
          z: -0.16,
        },
        physical,
      });

    expect(planned).not.toBeNull();
    expect(
      planned!.swingWindow
        .kinematicsV1,
    ).toBeDefined();
    expect(
      planned!.swingPlan
        .trajectory.contactTick,
    ).toBe(
      planned!
        .preferredContactCrossing
        .tick,
    );
  });

  it('feeds the generated 3D swing trajectory into the calibrated rigid contact solver', () => {
    const result =
      resolveCourseAwareAerodynamicRigidSwingV1({
        predictedTrajectory:
          trajectory(),
        plateZ: 0,
        strikeZone,
        handedness: 'R',
        batterCenterOfMass: {
          x: -0.78,
          y: 1.0,
          z: -0.16,
        },
        physical,
        ball:
          REALISTIC_BASEBALL_RIGID_BODY,
        parameterResolver,
      });

    expect(result).not.toBeNull();
    expect(result!.physical.kind)
      .toBe('contact');
    if (
      result!.physical.kind
      !== 'contact'
    ) {
      throw new Error(
        'fixture must produce course-aware physical contact',
      );
    }

    expect(
      result!.physical.contact
        .normalRelativeSpeedBeforeMps,
    ).toBeLessThan(0);
    expect(
      result!.physical.contact
        .normalEffectiveMassSource,
    ).toBe('rigid_body');
  });

  it('lets prediction error causally turn the same planned swing into a miss', () => {
    const predicted =
      trajectory(0, 0.82);
    const actual =
      trajectory(0.55, 0.82);

    const result =
      resolveCourseAwareAerodynamicRigidSwingV1({
        predictedTrajectory:
          predicted,
        actualTrajectory:
          actual,
        plateZ: 0,
        strikeZone,
        handedness: 'R',
        batterCenterOfMass: {
          x: -0.78,
          y: 1.0,
          z: -0.16,
        },
        physical,
        parameterResolver,
      });

    expect(result).not.toBeNull();
    expect(result!.physical.kind)
      .toBe('swinging_miss');
  });

  it('is deterministic for identical prediction, actual physics and contact calibration', () => {
    const input = {
      predictedTrajectory:
        trajectory(-0.05, 0.80),
      plateZ: 0,
      strikeZone,
      handedness: 'R' as const,
      batterCenterOfMass: {
        x: -0.78,
        y: 1.0,
        z: -0.16,
      },
      physical,
      parameterResolver,
    };

    expect(
      resolveCourseAwareAerodynamicRigidSwingV1(
        input,
      ),
    ).toEqual(
      resolveCourseAwareAerodynamicRigidSwingV1(
        input,
      ),
    );
  });
});