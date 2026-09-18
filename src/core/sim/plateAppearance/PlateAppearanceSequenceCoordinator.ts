import type {
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
import type {
  PitchAgainstBatterInput,
} from '../pitching/PitchAgainstBatter';
import {
  applyStrikeoutPlateAppearanceToMatchState,
  applyWalkPlateAppearanceToMatchState,
} from './PlateAppearanceMatchState';
import {
  advancePlateAppearancePitchSequence,
  resolvePlateAppearancePitchSequence,
  type PlateAppearancePitchSequenceResult,
} from './PlateAppearancePitchSequence';
import type {
  CanonicalPlateAppearanceTimeline,
} from './CanonicalPlateAppearanceTimeline';

export type PlateAppearanceSequenceCoordinatorInput = Readonly<{
  match: CanonicalMatchState;
  batterRunnerId: string;
  startedAtTick: number;
  pitches: readonly PitchAgainstBatterInput[];
}>;

export type AdvancePlateAppearanceSequenceCoordinatorInput = Readonly<{
  match: CanonicalMatchState;
  batterRunnerId: string;
  timeline: CanonicalPlateAppearanceTimeline;
  pitches: readonly PitchAgainstBatterInput[];
}>;

export type PlateAppearanceSequenceCoordinatorResult =
  | Readonly<{
      kind: 'complete';
      terminalKind: 'walk' | 'strikeout';
      pitchesConsumed: number;
      timeline: Extract<
        PlateAppearancePitchSequenceResult,
        { kind: 'terminal' }
      >['timeline'];
      nextMatchState: CanonicalMatchState;
    }>
  | Readonly<{
      kind: 'active';
      pitchesConsumed: number;
      timeline: Extract<
        PlateAppearancePitchSequenceResult,
        { kind: 'active' }
      >['timeline'];
      matchState: CanonicalMatchState;
    }>
  | Readonly<{
      kind: 'batted_ball_pending';
      pitchesConsumed: number;
      timeline: Extract<
        PlateAppearancePitchSequenceResult,
        { kind: 'batted_ball_pending' }
      >['timeline'];
      matchState: CanonicalMatchState;
    }>
  | Readonly<{
      kind: 'unresolved';
      reason: 'pitch_did_not_reach_plate';
      pitchIndex: number;
      pitchesConsumed: number;
      timeline: Extract<
        PlateAppearancePitchSequenceResult,
        { kind: 'unresolved' }
      >['timeline'];
      matchState: CanonicalMatchState;
    }>;

const applyPitchSequenceResultToMatchState = (
  match: CanonicalMatchState,
  batterRunnerId: string,
  sequence: PlateAppearancePitchSequenceResult,
): PlateAppearanceSequenceCoordinatorResult => {
  if (batterRunnerId.length === 0) {
    throw new Error('batterRunnerId must not be empty');
  }

  if (sequence.timeline.playId !== match.playId) {
    throw new Error(
      'plate appearance timeline playId must match CanonicalMatchState.playId',
    );
  }

  if (sequence.kind === 'terminal') {
    const nextMatchState = sequence.terminalKind === 'strikeout'
      ? applyStrikeoutPlateAppearanceToMatchState(
          match,
          sequence.timeline,
        )
      : applyWalkPlateAppearanceToMatchState(
          match,
          sequence.timeline,
          batterRunnerId,
        );

    return {
      kind: 'complete',
      terminalKind: sequence.terminalKind,
      pitchesConsumed: sequence.pitchesConsumed,
      timeline: sequence.timeline,
      nextMatchState,
    };
  }

  if (sequence.kind === 'active') {
    return {
      kind: 'active',
      pitchesConsumed: sequence.pitchesConsumed,
      timeline: sequence.timeline,
      matchState: match,
    };
  }

  if (sequence.kind === 'batted_ball_pending') {
    return {
      kind: 'batted_ball_pending',
      pitchesConsumed: sequence.pitchesConsumed,
      timeline: sequence.timeline,
      matchState: match,
    };
  }

  return {
    kind: 'unresolved',
    reason: sequence.reason,
    pitchIndex: sequence.pitchIndex,
    pitchesConsumed: sequence.pitchesConsumed,
    timeline: sequence.timeline,
    matchState: match,
  };
};

export const resolvePlateAppearancePitchSequenceToMatchState = (
  input: PlateAppearanceSequenceCoordinatorInput,
): PlateAppearanceSequenceCoordinatorResult => (
  applyPitchSequenceResultToMatchState(
    input.match,
    input.batterRunnerId,
    resolvePlateAppearancePitchSequence({
      match: input.match,
      startedAtTick: input.startedAtTick,
      pitches: input.pitches,
    }),
  )
);

export const advancePlateAppearancePitchSequenceToMatchState = (
  input: AdvancePlateAppearanceSequenceCoordinatorInput,
): PlateAppearanceSequenceCoordinatorResult => (
  applyPitchSequenceResultToMatchState(
    input.match,
    input.batterRunnerId,
    advancePlateAppearancePitchSequence(
      input.timeline,
      input.pitches,
    ),
  )
);
