import type {
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
import {
  applyStrikeoutPlateAppearanceToMatchState,
  applyWalkPlateAppearanceToMatchState,
} from './PlateAppearanceMatchState';
import {
  resolveCommandedPlateAppearanceSequence,
  type CommandedPlateAppearanceSequenceInput,
} from './CommandedPlateAppearanceSequence';
import type {
  CanonicalPlateAppearanceTimeline,
} from './CanonicalPlateAppearanceTimeline';

export type CommandedPlateAppearanceCoordinatorInput =
  CommandedPlateAppearanceSequenceInput;

export type CommandedPlateAppearanceCoordinatorResult =
  | Readonly<{
      kind: 'complete';
      terminalKind: 'walk' | 'strikeout';
      pitchesGenerated: number;
      unusedEnvironmentCount: number;
      timeline: CanonicalPlateAppearanceTimeline;
      nextMatchState: CanonicalMatchState;
    }>
  | Readonly<{
      kind: 'batted_ball_pending';
      pitchesGenerated: number;
      unusedEnvironmentCount: number;
      timeline: CanonicalPlateAppearanceTimeline;
      matchState: CanonicalMatchState;
    }>
  | Readonly<{
      kind: 'active';
      pitchesGenerated: number;
      unusedEnvironmentCount: number;
      timeline: CanonicalPlateAppearanceTimeline;
      matchState: CanonicalMatchState;
    }>;

export const resolveCommandedPlateAppearanceToMatchState = (
  input: CommandedPlateAppearanceCoordinatorInput,
): CommandedPlateAppearanceCoordinatorResult => {
  const sequence =
    resolveCommandedPlateAppearanceSequence(input);

  switch (sequence.timeline.status.kind) {
    case 'walk':
      return {
        kind: 'complete',
        terminalKind: 'walk',
        pitchesGenerated:
          sequence.pitchesGenerated,
        unusedEnvironmentCount:
          sequence.unusedEnvironmentCount,
        timeline: sequence.timeline,
        nextMatchState:
          applyWalkPlateAppearanceToMatchState(
            input.match,
            sequence.timeline,
            input.session.batterRunnerId,
          ),
      };

    case 'strikeout':
      return {
        kind: 'complete',
        terminalKind: 'strikeout',
        pitchesGenerated:
          sequence.pitchesGenerated,
        unusedEnvironmentCount:
          sequence.unusedEnvironmentCount,
        timeline: sequence.timeline,
        nextMatchState:
          applyStrikeoutPlateAppearanceToMatchState(
            input.match,
            sequence.timeline,
          ),
      };

    case 'batted_ball_pending':
      return {
        kind: 'batted_ball_pending',
        pitchesGenerated:
          sequence.pitchesGenerated,
        unusedEnvironmentCount:
          sequence.unusedEnvironmentCount,
        timeline: sequence.timeline,
        matchState: input.match,
      };

    case 'active':
      return {
        kind: 'active',
        pitchesGenerated:
          sequence.pitchesGenerated,
        unusedEnvironmentCount:
          sequence.unusedEnvironmentCount,
        timeline: sequence.timeline,
        matchState: input.match,
      };

    default:
      throw new Error(
        'commanded pitch sequence ended in an unsupported canonical status',
      );
  }
};
