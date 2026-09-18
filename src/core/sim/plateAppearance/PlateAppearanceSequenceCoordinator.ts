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
  resolvePlateAppearancePitchSequence,
  type PlateAppearancePitchSequenceResult,
} from './PlateAppearancePitchSequence';

export type PlateAppearanceSequenceCoordinatorInput = Readonly<{
  match: CanonicalMatchState;
  batterRunnerId: string;
  startedAtTick: number;
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

export const resolvePlateAppearancePitchSequenceToMatchState = (
  input: PlateAppearanceSequenceCoordinatorInput,
): PlateAppearanceSequenceCoordinatorResult => {
  if (input.batterRunnerId.length === 0) {
    throw new Error('batterRunnerId must not be empty');
  }

  const sequence = resolvePlateAppearancePitchSequence({
    match: input.match,
    startedAtTick: input.startedAtTick,
    pitches: input.pitches,
  });

  if (sequence.kind === 'terminal') {
    const nextMatchState = sequence.terminalKind === 'strikeout'
      ? applyStrikeoutPlateAppearanceToMatchState(
          input.match,
          sequence.timeline,
        )
      : applyWalkPlateAppearanceToMatchState(
          input.match,
          sequence.timeline,
          input.batterRunnerId,
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
      matchState: input.match,
    };
  }

  if (sequence.kind === 'batted_ball_pending') {
    return {
      kind: 'batted_ball_pending',
      pitchesConsumed: sequence.pitchesConsumed,
      timeline: sequence.timeline,
      matchState: input.match,
    };
  }

  return {
    kind: 'unresolved',
    reason: sequence.reason,
    pitchIndex: sequence.pitchIndex,
    pitchesConsumed: sequence.pitchesConsumed,
    timeline: sequence.timeline,
    matchState: input.match,
  };
};
