import type {
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
import {
  resolveAndRecordPitchAgainstBatter,
} from '../pitching/PitchAgainstBatter';
import {
  createCanonicalPlateAppearanceTimeline,
  type CanonicalPlateAppearanceTimeline,
} from './CanonicalPlateAppearanceTimeline';
import type {
  PlateAppearanceCommand,
} from './PlateAppearanceCommand';
import {
  assertCommandSessionCanDriveTimeline,
  type PlateAppearanceCommandSession,
} from './PlateAppearanceCommandSession';
import {
  createCommandedPitchAgainstBatterInput,
  type CommandedPitchAgainstBatter,
  type CommandPitchEnvironment,
} from './PlateAppearanceCommandPitchAdapter';

export type CommandedPlateAppearanceSequenceInput = Readonly<{
  match: CanonicalMatchState;
  session: PlateAppearanceCommandSession;
  startedAtTick: number;
  environments: readonly CommandPitchEnvironment[];
}>;

export type CommandedPlateAppearanceSequenceResult = Readonly<{
  command: PlateAppearanceCommand;
  pitchesGenerated: number;
  unusedEnvironmentCount: number;
  generatedPitches:
    readonly CommandedPitchAgainstBatter[];
  timeline: CanonicalPlateAppearanceTimeline;
}>;

const validateEnvironmentOrdinals = (
  environments: readonly CommandPitchEnvironment[],
): void => {
  for (
    let index = 0;
    index < environments.length;
    index += 1
  ) {
    if (
      environments[index].pitchOrdinal
      !== index
    ) {
      throw new Error(
        'commanded pitch environments must use contiguous ordinals starting at zero',
      );
    }
  }
};

export const resolveCommandedPlateAppearanceSequence = (
  input: CommandedPlateAppearanceSequenceInput,
): CommandedPlateAppearanceSequenceResult => {
  if (input.session.playId !== input.match.playId) {
    throw new Error(
      'command session playId must match CanonicalMatchState.playId',
    );
  }

  validateEnvironmentOrdinals(
    input.environments,
  );

  let timeline =
    createCanonicalPlateAppearanceTimeline(
      input.match,
      input.startedAtTick,
    );

  assertCommandSessionCanDriveTimeline(
    input.session,
    timeline,
  );

  const generatedPitches:
    CommandedPitchAgainstBatter[] = [];

  for (const environment of input.environments) {
    if (timeline.status.kind !== 'active') {
      break;
    }

    assertCommandSessionCanDriveTimeline(
      input.session,
      timeline,
    );

    const generated =
      createCommandedPitchAgainstBatterInput({
        session: input.session,
        environment,
      });

    const resolution =
      resolveAndRecordPitchAgainstBatter(
        timeline,
        generated.input,
      );

    if (resolution.kind === 'unresolved') {
      throw new Error(
        'commanded pitch must physically reach the plate',
      );
    }

    generatedPitches.push(generated);
    timeline = resolution.timeline;
  }

  return {
    command: input.session.command,
    pitchesGenerated: generatedPitches.length,
    unusedEnvironmentCount: (
      input.environments.length
      - generatedPitches.length
    ),
    generatedPitches,
    timeline,
  };
};
