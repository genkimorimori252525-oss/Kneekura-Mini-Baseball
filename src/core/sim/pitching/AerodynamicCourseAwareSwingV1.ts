import type { Vec3 } from '../../model/geometry';
import {
  REALISTIC_BASEBALL_RIGID_BODY,
  type RigidBaseballProperties,
  type RigidBatBallContactParameterResolver,
  type RigidBatPhysicalProperties,
} from '../contact/RigidBatBallContact';
import {
  findAerodynamicPitchPlateCrossing,
  type AerodynamicPitchPlateCrossing,
  type AerodynamicPitchTrajectory,
} from './AerodynamicPitchTrajectory';
import {
  createRigidBatSwingWindowFromKinematicsV1,
  resolveAerodynamicRigidBatSwing,
  type AerodynamicRigidBatSwingResult,
  type RigidBatSwingWindow,
} from './AerodynamicRigidBatSwingingPitchPhysicalResult';
import {
  EVIDENCE_BOUNDED_SWING_COURSE_PROFILE_V1,
  planCourseAwareSwingKinematicsV1,
  resolvePreferredContactDepthV1,
  resolveSwingCourseCoordinatesV1,
  type CourseAwareSwingPlanV1,
  type SwingBatterHandednessV1,
  type SwingKinematicsCourseProfileV1,
} from './CourseAwareSwingKinematicsV1';
import type {
  StrikeZoneRegion,
} from './TakenPitchPhysicalResult';

export type AerodynamicCourseAwareSwingPlanInputV1 =
  Readonly<{
    predictedTrajectory:
      AerodynamicPitchTrajectory;
    plateZ: number;
    strikeZone: StrikeZoneRegion;
    handedness:
      SwingBatterHandednessV1;
    batterCenterOfMass: Vec3;
    physical:
      RigidBatPhysicalProperties;
    profile?:
      SwingKinematicsCourseProfileV1;
  }>;

export type AerodynamicCourseAwareSwingPlanV1 =
  Readonly<{
    plateCrossing:
      AerodynamicPitchPlateCrossing;
    preferredContactCrossing:
      AerodynamicPitchPlateCrossing;
    swingPlan:
      CourseAwareSwingPlanV1;
    swingWindow:
      RigidBatSwingWindow;
  }>;

export const planAerodynamicCourseAwareSwingV1 = (
  input:
    AerodynamicCourseAwareSwingPlanInputV1,
): AerodynamicCourseAwareSwingPlanV1 | null => {
  const plateCrossing =
    findAerodynamicPitchPlateCrossing(
      input.predictedTrajectory,
      input.plateZ,
    );
  if (plateCrossing === null) {
    return null;
  }

  const profile =
    input.profile
    ?? EVIDENCE_BOUNDED_SWING_COURSE_PROFILE_V1;
  const course =
    resolveSwingCourseCoordinatesV1(
      plateCrossing.position,
      input.strikeZone,
      input.handedness,
    );
  const preferredContactDepthM =
    resolvePreferredContactDepthV1(
      course,
      profile,
    );
  const preferredContactZ =
    input.batterCenterOfMass.z
    + preferredContactDepthM;

  const preferredContactCrossing =
    findAerodynamicPitchPlateCrossing(
      input.predictedTrajectory,
      preferredContactZ,
    );
  if (
    preferredContactCrossing
    === null
  ) {
    return null;
  }

  const swingPlan =
    planCourseAwareSwingKinematicsV1({
      handedness:
        input.handedness,
      batterCenterOfMass:
        input.batterCenterOfMass,
      targetBallCenterAtPlate:
        plateCrossing.position,
      targetBallCenterAtContact:
        preferredContactCrossing.position,
      strikeZone:
        input.strikeZone,
      contactTick:
        preferredContactCrossing.tick,
      ticksPerSecond:
        input.predictedTrajectory
          .parameters
          .ticksPerSecond,
      profile,
    });

  return {
    plateCrossing,
    preferredContactCrossing,
    swingPlan,
    swingWindow:
      createRigidBatSwingWindowFromKinematicsV1(
        swingPlan.trajectory,
        input.physical,
      ),
  };
};

export type ResolveCourseAwareAerodynamicRigidSwingV1Input =
  AerodynamicCourseAwareSwingPlanInputV1
  & Readonly<{
    /**
     * The canonical/actual trajectory may differ from the batter's predicted
     * trajectory. Prediction error therefore changes real contact geometry.
     */
    actualTrajectory?:
      AerodynamicPitchTrajectory;
    ball?: RigidBaseballProperties;
    parameterResolver:
      RigidBatBallContactParameterResolver;
  }>;

export type ResolveCourseAwareAerodynamicRigidSwingV1Result =
  Readonly<{
    planned:
      AerodynamicCourseAwareSwingPlanV1;
    physical:
      AerodynamicRigidBatSwingResult;
  }>;

export const resolveCourseAwareAerodynamicRigidSwingV1 = (
  input:
    ResolveCourseAwareAerodynamicRigidSwingV1Input,
): ResolveCourseAwareAerodynamicRigidSwingV1Result | null => {
  const planned =
    planAerodynamicCourseAwareSwingV1(
      input,
    );
  if (planned === null) {
    return null;
  }

  const actualTrajectory =
    input.actualTrajectory
    ?? input.predictedTrajectory;

  if (
    planned.swingWindow.startTick
      < actualTrajectory.start.tick
    || planned.swingWindow.endTick
      > actualTrajectory.endTick
  ) {
    throw new Error(
      'course-aware swing window must lie inside the actual aerodynamic trajectory',
    );
  }

  return {
    planned,
    physical:
      resolveAerodynamicRigidBatSwing({
        trajectory:
          actualTrajectory,
        swing:
          planned.swingWindow,
        ball:
          input.ball
          ?? REALISTIC_BASEBALL_RIGID_BODY,
        parameterResolver:
          input.parameterResolver,
      }),
  };
};