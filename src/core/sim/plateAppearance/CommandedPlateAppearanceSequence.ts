import type {
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
import {
  resolveAndRecordSwingKinematicsV1PitchAgainstBatter,
} from '../pitching/SwingKinematicsV1PitchAgainstBatter';
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
  createCommandedSwingKinematicsV1PitchInput,
  type CommandedPhysicalPitchEnvironmentV1,
  type CommandedSwingKinematicsV1Pitch,
} from './CommandedSwingKinematicsV1PitchAdapter';

export type CommandedPlateAppearanceSequenceInput = Readonly<{
  match: CanonicalMatchState;
  session: PlateAppearanceCommandSession;
  startedAtTick: number;
  /**
   * Production physical pitches. Pitcher/catcher mechanics are resolved
   * upstream; this sequence resolves batter decisions and canonical outcome.
   */
  environments:
    readonly CommandedPhysicalPitchEnvironmentV1[];
}>;

export type CommandedPlateAppearanceSequenceResult = Readonly<{
  command: PlateAppearanceCommand;
  pitchesGenerated: number;
  unusedEnvironmentCount: number;
  generatedPitches:
    readonly CommandedSwingKinematicsV1Pitch[];
  timeline: CanonicalPlateAppearanceTimeline;
}>;

const validateEnvironmentOrdinals = (
  environments:
    readonly CommandedPhysicalPitchEnvironmentV1[],
): void => {
  for (
    let index = 0;
    index < environments.length;
    index += 1
  ) {
    if (
      environments[index]!.pitchOrdinal
      !== index
    ) {
      throw new Error(
        'commanded physical pitch environments must use contiguous ordinals starting at zero',
      );
    }
  }
};

/**
 * Active commanded plate-appearance sequence.
 *
 * No legacy PitchAgainstBatter or first-order BatterSwingWindow is used here.
 * The supplied physical aerodynamic pitch is resolved against Swing Kinematics
 * v1 for swing decisions, while taken pitches use the same aerodynamic plate
 * crossing.
 */
export const resolveCommandedPlateAppearanceSequence = (
  input: CommandedPlateAppearanceSequenceInput,
): CommandedPlateAppearanceSequenceResult => {
  if (
    input.session.playId
    !== input.match.playId
  ) {
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
    CommandedSwingKinematicsV1Pitch[] =
      [];

  for (
    const environment
    of input.environments
  ) {
    if (
      timeline.status.kind
      !== 'active'
    ) {
      break;
    }

    assertCommandSessionCanDriveTimeline(
      input.session,
      timeline,
    );

    const generated =
      createCommandedSwingKinematicsV1PitchInput({
        session: input.session,
        environment,
      });

    const resolution =
      resolveAndRecordSwingKinematicsV1PitchAgainstBatter(
        timeline,
        generated.input,
      );

    if (
      resolution.kind
      === 'unresolved'
    ) {
      throw new Error(
        `commanded physical pitch unresolved: ${resolution.reason}`,
      );
    }

    generatedPitches.push(
      generated,
    );
    timeline =
      resolution.resolution.timeline;
  }

  return {
    command:
      input.session.command,
    pitchesGenerated:
      generatedPitches.length,
    unusedEnvironmentCount:
      input.environments.length
      - generatedPitches.length,
    generatedPitches,
    timeline,
  };
};