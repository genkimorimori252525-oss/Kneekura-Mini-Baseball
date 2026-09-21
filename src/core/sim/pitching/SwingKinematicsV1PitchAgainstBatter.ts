import type { Vec3 } from '../../model/geometry';
import type {
  CanonicalPlateAppearanceTimeline,
} from '../plateAppearance/CanonicalPlateAppearanceTimeline';
import {
  createRigidBatSwingWindowFromKinematicsV1,
} from './AerodynamicRigidBatSwingingPitchPhysicalResult';
import {
  resolveAndRecordAerodynamicRigidPitchAgainstBatter,
  type AerodynamicRigidPitchAgainstBatterResolution,
} from './AerodynamicRigidPitchAgainstBatter';
import {
  planAerodynamicCourseAwareSwingV1,
  type AerodynamicCourseAwareSwingPlanV1,
} from './AerodynamicCourseAwareSwingV1';
import {
  shiftSwingKinematicsTrajectoryV1,
  type SwingKinematicsTrajectoryV1,
} from '../contact/SwingKinematicsV1';
import type {
  RigidBaseballProperties,
  RigidBatBallContactParameterResolver,
  RigidBatPhysicalProperties,
} from '../contact/RigidBatBallContact';
import type {
  AerodynamicPitchTrajectory,
} from './AerodynamicPitchTrajectory';
import type {
  SwingBatterHandednessV1,
  SwingKinematicsCourseProfileV1,
} from './CourseAwareSwingKinematicsV1';
import {
  resolveBatterAnticipationRecognitionDelayTicks,
  type BatterAnticipationTimingCalibration,
} from './BatterAnticipationSwingAdapter';
import type {
  BatterPitchAnticipationResolution,
} from './BatterPitchAnticipation';
import type {
  StrikeZoneRegion,
} from './TakenPitchPhysicalResult';

export type SwingKinematicsV1BatterRuntime =
  Readonly<{
    handedness:
      SwingBatterHandednessV1;
    centerOfMass: Vec3;
    batPhysical:
      RigidBatPhysicalProperties;
    ball:
      RigidBaseballProperties;
    contactParameterResolver:
      RigidBatBallContactParameterResolver;
    swingProfile?:
      SwingKinematicsCourseProfileV1;
  }>;

export type SwingKinematicsV1TakePitchAction =
  Readonly<{
    kind: 'take';
  }>;

export type SwingKinematicsV1SwingPitchAction =
  Readonly<{
    kind: 'swing';
    /**
     * Tactical timing bias. Negative is earlier, positive is later.
     * This shifts the entire rigid trajectory in time.
     */
    timingOffsetTicks?: number;
    anticipation?: Readonly<{
      resolution:
        BatterPitchAnticipationResolution;
      calibration:
        BatterAnticipationTimingCalibration;
    }>;
  }>;

export type SwingKinematicsV1PitchAction =
  | SwingKinematicsV1TakePitchAction
  | SwingKinematicsV1SwingPitchAction;

type SharedPitchInput = Readonly<{
  actualTrajectory:
    AerodynamicPitchTrajectory;
  /**
   * What the batter plans against. Defaults to actualTrajectory when no
   * perception/prediction error is being modeled.
   */
  predictedTrajectory?:
    AerodynamicPitchTrajectory;
  plateZ: number;
  strikeZone: StrikeZoneRegion;
}>;

export type SwingKinematicsV1TakePitchAgainstBatterInput =
  SharedPitchInput
  & Readonly<{
    action:
      SwingKinematicsV1TakePitchAction;
    ballRadiusMeters: number;
  }>;

export type SwingKinematicsV1SwingPitchAgainstBatterInput =
  SharedPitchInput
  & Readonly<{
    action:
      SwingKinematicsV1SwingPitchAction;
    batter:
      SwingKinematicsV1BatterRuntime;
  }>;

export type SwingKinematicsV1PitchAgainstBatterInput =
  | SwingKinematicsV1TakePitchAgainstBatterInput
  | SwingKinematicsV1SwingPitchAgainstBatterInput;

export type SwingKinematicsV1SwingTiming =
  Readonly<{
    commandTimingOffsetTicks: number;
    recognitionDelayTicks: number;
    totalTimingShiftTicks: number;
    baseTrajectory:
      SwingKinematicsTrajectoryV1;
    shiftedTrajectory:
      SwingKinematicsTrajectoryV1;
  }>;

export type SwingKinematicsV1PitchAgainstBatterResolution =
  | Readonly<{
      kind: 'recorded_take';
      resolution:
        Extract<
          AerodynamicRigidPitchAgainstBatterResolution,
          { kind: 'recorded_take' }
        >;
    }>
  | Readonly<{
      kind: 'recorded_swing';
      planned:
        AerodynamicCourseAwareSwingPlanV1;
      timing:
        SwingKinematicsV1SwingTiming;
      resolution:
        Extract<
          AerodynamicRigidPitchAgainstBatterResolution,
          { kind: 'recorded_swing' }
        >;
    }>
  | Readonly<{
      kind: 'unresolved';
      reason:
        | 'pitch_did_not_reach_plate'
        | 'swing_plan_unresolved';
      timeline:
        CanonicalPlateAppearanceTimeline;
    }>;


const isTakeInput = (
  input:
    SwingKinematicsV1PitchAgainstBatterInput,
): input is SwingKinematicsV1TakePitchAgainstBatterInput => (
  input.action.kind === 'take'
);

const validateTimingOffset = (
  value: number,
): void => {
  if (!Number.isSafeInteger(value)) {
    throw new Error(
      'Swing Kinematics v1 timing offset must be a safe integer tick delta',
    );
  }
};

const assertTrajectoryInsideActualPitch = (
  trajectory:
    SwingKinematicsTrajectoryV1,
  actual:
    AerodynamicPitchTrajectory,
): void => {
  if (
    trajectory.startTick
      < actual.start.tick
    || trajectory.endTick
      > actual.endTick
  ) {
    throw new Error(
      'shifted Swing Kinematics v1 trajectory must lie inside the actual aerodynamic pitch interval',
    );
  }
};

/**
 * Production plate-appearance adapter for the frozen Swing Kinematics v1 path.
 *
 * This module contains no alternate bat trajectory generator. Swing geometry
 * comes from CourseAwareSwingKinematicsV1; timing effects shift that entire
 * physical trajectory before the tapered rigid-bat contact search.
 */
export const resolveAndRecordSwingKinematicsV1PitchAgainstBatter = (
  timeline:
    CanonicalPlateAppearanceTimeline,
  input:
    SwingKinematicsV1PitchAgainstBatterInput,
): SwingKinematicsV1PitchAgainstBatterResolution => {
  if (isTakeInput(input)) {
    const resolution =
      resolveAndRecordAerodynamicRigidPitchAgainstBatter(
        timeline,
        {
          action: {
            kind: 'take',
          },
          trajectory:
            input.actualTrajectory,
          plateZ:
            input.plateZ,
          strikeZone:
            input.strikeZone,
          ballRadiusMeters:
            input.ballRadiusMeters,
        },
      );

    if (
      resolution.kind
      === 'unresolved'
    ) {
      return {
        kind: 'unresolved',
        reason:
          resolution.reason,
        timeline:
          resolution.timeline,
      };
    }

    if (
      resolution.kind
      !== 'recorded_take'
    ) {
      throw new Error(
        'take input produced a non-take rigid pitch resolution',
      );
    }

    return {
      kind: 'recorded_take',
      resolution,
    };
  }

  const predictedTrajectory =
    input.predictedTrajectory
    ?? input.actualTrajectory;
  const planned =
    planAerodynamicCourseAwareSwingV1({
      predictedTrajectory,
      plateZ:
        input.plateZ,
      strikeZone:
        input.strikeZone,
      handedness:
        input.batter.handedness,
      batterCenterOfMass:
        input.batter.centerOfMass,
      physical:
        input.batter.batPhysical,
      profile:
        input.batter.swingProfile,
    });

  if (planned === null) {
    return {
      kind: 'unresolved',
      reason:
        'swing_plan_unresolved',
      timeline,
    };
  }

  const commandTimingOffsetTicks =
    input.action.timingOffsetTicks
    ?? 0;
  validateTimingOffset(
    commandTimingOffsetTicks,
  );

  const baseShifted =
    shiftSwingKinematicsTrajectoryV1(
      planned.swingPlan.trajectory,
      commandTimingOffsetTicks,
    );
  assertTrajectoryInsideActualPitch(
    baseShifted,
    input.actualTrajectory,
  );

  const recognitionDelayTicks =
    input.action.anticipation
      === undefined
      ? 0
      : resolveBatterAnticipationRecognitionDelayTicks(
          input.action
            .anticipation.resolution,
          input.action
            .anticipation.calibration,
          input.actualTrajectory.endTick
            - baseShifted.endTick,
        );
  const totalTimingShiftTicks =
    commandTimingOffsetTicks
    + recognitionDelayTicks;
  const shiftedTrajectory =
    recognitionDelayTicks === 0
      ? baseShifted
      : shiftSwingKinematicsTrajectoryV1(
          baseShifted,
          recognitionDelayTicks,
        );
  assertTrajectoryInsideActualPitch(
    shiftedTrajectory,
    input.actualTrajectory,
  );

  const swingWindow =
    createRigidBatSwingWindowFromKinematicsV1(
      shiftedTrajectory,
      input.batter.batPhysical,
    );
  const resolution =
    resolveAndRecordAerodynamicRigidPitchAgainstBatter(
      timeline,
      {
        action: {
          kind: 'swing',
          swing:
            swingWindow,
        },
        trajectory:
          input.actualTrajectory,
        ball:
          input.batter.ball,
        parameterResolver:
          input.batter
            .contactParameterResolver,
      },
    );

  if (
    resolution.kind
    !== 'recorded_swing'
  ) {
    throw new Error(
      'swing input produced a non-swing rigid pitch resolution',
    );
  }

  return {
    kind: 'recorded_swing',
    planned,
    timing: {
      commandTimingOffsetTicks,
      recognitionDelayTicks,
      totalTimingShiftTicks,
      baseTrajectory:
        planned.swingPlan.trajectory,
      shiftedTrajectory,
    },
    resolution,
  };
};