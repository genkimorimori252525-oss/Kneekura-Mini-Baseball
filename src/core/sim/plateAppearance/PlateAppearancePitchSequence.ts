import type {
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
import {
  createCanonicalPlateAppearanceTimeline,
  type CanonicalPlateAppearanceTimeline,
} from './CanonicalPlateAppearanceTimeline';
import {
  resolveAndRecordPitchAgainstBatter,
  type PitchAgainstBatterInput,
} from '../pitching/PitchAgainstBatter';

export type PlateAppearancePitchSequenceInput = Readonly<{
  match: CanonicalMatchState;
  startedAtTick: number;
  pitches: readonly PitchAgainstBatterInput[];
}>;

export type PlateAppearancePitchSequenceResult =
  | Readonly<{
      kind: 'active';
      pitchesConsumed: number;
      timeline: CanonicalPlateAppearanceTimeline;
    }>
  | Readonly<{
      kind: 'terminal';
      terminalKind: 'walk' | 'strikeout';
      pitchesConsumed: number;
      timeline: CanonicalPlateAppearanceTimeline;
    }>
  | Readonly<{
      kind: 'batted_ball_pending';
      pitchesConsumed: number;
      timeline: CanonicalPlateAppearanceTimeline;
    }>
  | Readonly<{
      kind: 'unresolved';
      reason: 'pitch_did_not_reach_plate';
      pitchIndex: number;
      pitchesConsumed: number;
      timeline: CanonicalPlateAppearanceTimeline;
    }>;

const stoppedAcceptingPitches = (
  timeline: CanonicalPlateAppearanceTimeline,
): boolean => (
  timeline.status.kind !== 'active'
);

const resultForStoppedTimeline = (
  timeline: CanonicalPlateAppearanceTimeline,
  pitchesConsumed: number,
): PlateAppearancePitchSequenceResult => {
  switch (timeline.status.kind) {
    case 'walk':
    case 'strikeout':
      return {
        kind: 'terminal',
        terminalKind: timeline.status.kind,
        pitchesConsumed,
        timeline,
      };
    case 'batted_ball_pending':
      return {
        kind: 'batted_ball_pending',
        pitchesConsumed,
        timeline,
      };
    default:
      throw new Error(
        'pitch sequence stopped in a state that cannot accept another pitch',
      );
  }
};

/**
 * @deprecated Compatibility-only historical path. Active production plate
 * appearances use the aerodynamic rigid-bat Swing Kinematics v1 path.
 */
export const advancePlateAppearancePitchSequence = (
  initialTimeline: CanonicalPlateAppearanceTimeline,
  pitches: readonly PitchAgainstBatterInput[],
): PlateAppearancePitchSequenceResult => {
  if (initialTimeline.status.kind !== 'active') {
    throw new Error(
      'plate appearance pitch sequence requires an active timeline',
    );
  }

  let timeline = initialTimeline;

  for (
    let pitchIndex = 0;
    pitchIndex < pitches.length;
    pitchIndex += 1
  ) {
    const result = resolveAndRecordPitchAgainstBatter(
      timeline,
      pitches[pitchIndex],
    );
    if (result.kind === 'unresolved') {
      return {
        kind: 'unresolved',
        reason: result.reason,
        pitchIndex,
        pitchesConsumed: pitchIndex,
        timeline: result.timeline,
      };
    }

    timeline = result.timeline;

    if (
      stoppedAcceptingPitches(timeline)
      && pitchIndex + 1 < pitches.length
    ) {
      throw new Error(
        'pitch sequence contains entries after the plate appearance stopped accepting pitches',
      );
    }
  }

  if (timeline.status.kind === 'active') {
    return {
      kind: 'active',
      pitchesConsumed: pitches.length,
      timeline,
    };
  }

  return resultForStoppedTimeline(
    timeline,
    pitches.length,
  );
};

export const resolvePlateAppearancePitchSequence = (
  input: PlateAppearancePitchSequenceInput,
): PlateAppearancePitchSequenceResult => (
  advancePlateAppearancePitchSequence(
    createCanonicalPlateAppearanceTimeline(
      input.match,
      input.startedAtTick,
    ),
    input.pitches,
  )
);