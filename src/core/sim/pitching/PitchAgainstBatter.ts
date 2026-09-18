import type {
  ContactParameters,
} from '../contact/BatBallContact';
import type {
  CanonicalPlateAppearanceTimeline,
} from '../plateAppearance/CanonicalPlateAppearanceTimeline';
import {
  resolveSwingingPitchPhysicalResult,
  type BatterSwingWindow,
  type SwingingPitchPhysicalResult,
} from './SwingingPitchPhysicalResult';
import {
  recordSwingingPitchPhysicalResult,
} from './SwingingPitchTimelineAdapter';
import {
  resolveTakenPitchPhysicalResult,
  type StrikeZoneRegion,
  type TakenPitchPhysicalResult,
} from './TakenPitchPhysicalResult';
import {
  recordTakenPitchPhysicalResult,
} from './TakenPitchTimelineAdapter';
import type {
  PitchTrajectorySegment,
} from './PitchTrajectory';

export type TakePitchAgainstBatterInput = Readonly<{
  action: Readonly<{
    kind: 'take';
  }>;
  trajectory: PitchTrajectorySegment;
  plateZ: number;
  strikeZone: StrikeZoneRegion;
  ballRadiusMeters: number;
}>;

export type SwingPitchAgainstBatterInput = Readonly<{
  action: Readonly<{
    kind: 'swing';
    swing: BatterSwingWindow;
  }>;
  trajectory: PitchTrajectorySegment;
  contactParameters?: ContactParameters;
}>;

export type PitchAgainstBatterInput =
  | TakePitchAgainstBatterInput
  | SwingPitchAgainstBatterInput;

export type PitchAgainstBatterPhysicalResult =
  | Readonly<{
      kind: 'taken';
      result: TakenPitchPhysicalResult;
    }>
  | Readonly<{
      kind: 'swing';
      result: SwingingPitchPhysicalResult;
    }>;

export type PitchAgainstBatterResolution =
  | Readonly<{
      kind: 'recorded';
      physical: PitchAgainstBatterPhysicalResult;
      timeline: CanonicalPlateAppearanceTimeline;
    }>
  | Readonly<{
      kind: 'unresolved';
      reason: 'pitch_did_not_reach_plate';
      timeline: CanonicalPlateAppearanceTimeline;
    }>;

export const resolveAndRecordPitchAgainstBatter = (
  timeline: CanonicalPlateAppearanceTimeline,
  input: PitchAgainstBatterInput,
): PitchAgainstBatterResolution => {
  if (input.action.kind === 'take') {
    const physical = resolveTakenPitchPhysicalResult({
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

  const physical = resolveSwingingPitchPhysicalResult({
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
