import type {
  CanonicalPlateAppearanceTimeline,
} from '../plateAppearance/CanonicalPlateAppearanceTimeline';
import type {
  RigidBaseballProperties,
  RigidBatBallContactParameterResolver,
} from '../contact/RigidBatBallContact';
import {
  resolveAerodynamicRigidBatSwing,
  type RigidBatSwingWindow,
} from './AerodynamicRigidBatSwingingPitchPhysicalResult';
import {
  resolveAerodynamicTakenPitchPhysicalResult,
  type AerodynamicTakenPitchPhysicalResult,
} from './AerodynamicTakenPitchPhysicalResult';
import type {
  AerodynamicPitchTrajectory,
} from './AerodynamicPitchTrajectory';
import {
  adaptRigidBatBallContactToCanonicalContact,
} from './RigidBatContactCanonicalAdapter';
import {
  recordSwingingPitchPhysicalResult,
} from './SwingingPitchTimelineAdapter';
import {
  recordTakenPitchPhysicalResult,
} from './TakenPitchTimelineAdapter';
import type {
  StrikeZoneRegion,
} from './TakenPitchPhysicalResult';

export type AerodynamicRigidTakePitchAgainstBatterInput =
  Readonly<{
    action: Readonly<{
      kind: 'take';
    }>;
    trajectory:
      AerodynamicPitchTrajectory;
    plateZ: number;
    strikeZone: StrikeZoneRegion;
    ballRadiusMeters: number;
  }>;

export type AerodynamicRigidSwingPitchAgainstBatterInput =
  Readonly<{
    action: Readonly<{
      kind: 'swing';
      swing: RigidBatSwingWindow;
    }>;
    trajectory:
      AerodynamicPitchTrajectory;
    ball: RigidBaseballProperties;
    parameterResolver:
      RigidBatBallContactParameterResolver;
  }>;

export type AerodynamicRigidPitchAgainstBatterInput =
  | AerodynamicRigidTakePitchAgainstBatterInput
  | AerodynamicRigidSwingPitchAgainstBatterInput;

const isAerodynamicRigidTakePitchInput = (
  input: AerodynamicRigidPitchAgainstBatterInput,
): input is AerodynamicRigidTakePitchAgainstBatterInput => (
  input.action.kind === 'take'
);

export type AerodynamicRigidPitchAgainstBatterResolution =
  | Readonly<{
      kind: 'recorded_take';
      physical:
        AerodynamicTakenPitchPhysicalResult;
      timeline:
        CanonicalPlateAppearanceTimeline;
    }>
  | Readonly<{
      kind: 'recorded_swing';
      physical: ReturnType<
        typeof resolveAerodynamicRigidBatSwing
      >;
      timeline:
        CanonicalPlateAppearanceTimeline;
    }>
  | Readonly<{
      kind: 'unresolved';
      reason:
        'pitch_did_not_reach_plate';
      timeline:
        CanonicalPlateAppearanceTimeline;
    }>;

export const resolveAndRecordAerodynamicRigidPitchAgainstBatter = (
  timeline: CanonicalPlateAppearanceTimeline,
  input: AerodynamicRigidPitchAgainstBatterInput,
): AerodynamicRigidPitchAgainstBatterResolution => {
  if (isAerodynamicRigidTakePitchInput(input)) {
    const physical =
      resolveAerodynamicTakenPitchPhysicalResult({
        trajectory: input.trajectory,
        plateZ: input.plateZ,
        strikeZone:
          input.strikeZone,
        ballRadiusMeters:
          input.ballRadiusMeters,
      });

    if (physical === null) {
      return {
        kind: 'unresolved',
        reason:
          'pitch_did_not_reach_plate',
        timeline,
      };
    }

    return {
      kind: 'recorded_take',
      physical,
      timeline:
        recordTakenPitchPhysicalResult(
          timeline,
          physical,
        ),
    };
  }

  const physical =
    resolveAerodynamicRigidBatSwing({
      trajectory:
        input.trajectory,
      swing:
        input.action.swing,
      ball:
        input.ball,
      parameterResolver:
        input.parameterResolver,
    });

  if (physical.kind === 'contact') {
    const canonicalContact =
      adaptRigidBatBallContactToCanonicalContact(
        physical.contact,
      );

    return {
      kind: 'recorded_swing',
      physical,
      timeline:
        recordSwingingPitchPhysicalResult(
          timeline,
          {
            kind: 'contact',
            contact:
              canonicalContact,
          },
        ),
    };
  }

  return {
    kind: 'recorded_swing',
    physical,
    timeline:
      recordSwingingPitchPhysicalResult(
        timeline,
        {
          kind: 'swinging_miss',
          adjudicationTick:
            physical.adjudicationTick,
        },
      ),
  };
};
