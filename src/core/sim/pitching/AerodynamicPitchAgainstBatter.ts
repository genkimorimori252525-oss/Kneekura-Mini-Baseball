import type {
  ContactParameters,
} from '../contact/BatBallContact';
import type {
  CanonicalPlateAppearanceTimeline,
} from '../plateAppearance/CanonicalPlateAppearanceTimeline';
import {
  resolveAerodynamicSwingingPitchPhysicalResult,
  type AerodynamicSwingingPitchPhysicalResult,
} from './AerodynamicSwingingPitchPhysicalResult';
import {
  resolveAerodynamicTakenPitchPhysicalResult,
  type AerodynamicTakenPitchPhysicalResult,
} from './AerodynamicTakenPitchPhysicalResult';
import type {
  AerodynamicPitchTrajectory,
} from './AerodynamicPitchTrajectory';
import type {
  BatterSwingWindow,
} from './SwingingPitchPhysicalResult';
import {
  recordSwingingPitchPhysicalResult,
} from './SwingingPitchTimelineAdapter';
import type {
  StrikeZoneRegion,
} from './TakenPitchPhysicalResult';
import {
  recordTakenPitchPhysicalResult,
} from './TakenPitchTimelineAdapter';

export type AerodynamicTakePitchAgainstBatterInput = Readonly<{
  action: Readonly<{
    kind: 'take';
  }>;
  trajectory: AerodynamicPitchTrajectory;
  plateZ: number;
  strikeZone: StrikeZoneRegion;
  ballRadiusMeters: number;
}>;

export type AerodynamicSwingPitchAgainstBatterInput = Readonly<{
  action: Readonly<{
    kind: 'swing';
    swing: BatterSwingWindow;
  }>;
  trajectory: AerodynamicPitchTrajectory;
  contactParameters?: ContactParameters;
}>;

export type AerodynamicPitchAgainstBatterInput =
  | AerodynamicTakePitchAgainstBatterInput
  | AerodynamicSwingPitchAgainstBatterInput;

const isAerodynamicTakePitchAgainstBatterInput = (
  input: AerodynamicPitchAgainstBatterInput,
): input is AerodynamicTakePitchAgainstBatterInput => (
  input.action.kind === 'take'
);

export type AerodynamicPitchAgainstBatterPhysicalResult =
  | Readonly<{
      kind: 'taken';
      result: AerodynamicTakenPitchPhysicalResult;
    }>
  | Readonly<{
      kind: 'swing';
      result: AerodynamicSwingingPitchPhysicalResult;
    }>;

export type AerodynamicPitchAgainstBatterResolution =
  | Readonly<{
      kind: 'recorded';
      physical: AerodynamicPitchAgainstBatterPhysicalResult;
      timeline: CanonicalPlateAppearanceTimeline;
    }>
  | Readonly<{
      kind: 'unresolved';
      reason: 'pitch_did_not_reach_plate';
      timeline: CanonicalPlateAppearanceTimeline;
    }>;

export const resolveAndRecordAerodynamicPitchAgainstBatter = (
  timeline: CanonicalPlateAppearanceTimeline,
  input: AerodynamicPitchAgainstBatterInput,
): AerodynamicPitchAgainstBatterResolution => {
  if (isAerodynamicTakePitchAgainstBatterInput(input)) {
    const physical =
      resolveAerodynamicTakenPitchPhysicalResult({
        trajectory: input.trajectory,
        plateZ: input.plateZ,
        strikeZone: input.strikeZone,
        ballRadiusMeters: input.ballRadiusMeters,
      });

    if (physical === null) {
      return {
        kind: 'unresolved',
        reason: 'pitch_did_not_reach_plate',
        timeline,
      };
    }

    return {
      kind: 'recorded',
      physical: {
        kind: 'taken',
        result: physical,
      },
      timeline: recordTakenPitchPhysicalResult(
        timeline,
        physical,
      ),
    };
  }

  const physical =
    resolveAerodynamicSwingingPitchPhysicalResult({
      trajectory: input.trajectory,
      swing: input.action.swing,
      contactParameters: input.contactParameters,
    });

  return {
    kind: 'recorded',
    physical: {
      kind: 'swing',
      result: physical,
    },
    timeline: recordSwingingPitchPhysicalResult(
      timeline,
      physical,
    ),
  };
};
