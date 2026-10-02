import type {
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
import {
  resolveAndRecordPitchAgainstBatter,
} from './PitchAgainstBatter';
import {
  createCanonicalPlateAppearanceTimeline,
  type CanonicalPlateAppearanceTimeline,
} from '../plateAppearance/CanonicalPlateAppearanceTimeline';
import type {
  CommandPitchEnvironment,
  CommandedPitchAgainstBatter,
} from '../plateAppearance/PlateAppearanceCommandPitchAdapter';
import {
  assertCommandSessionCanDriveTimeline,
  type PlateAppearanceCommandSession,
} from '../plateAppearance/PlateAppearanceCommandSession';
import {
  createCatcherLedCommandedPitch,
} from './CatcherLeadCommandAdapter';
import type {
  CatcherLeadProfile,
  CatcherPitchCall,
} from './CatcherLead';

export type CatcherLedPlateAppearanceSequenceInput =
  Readonly<{
    match: CanonicalMatchState;
    managerSession:
      PlateAppearanceCommandSession;
    catcherLead:
      CatcherLeadProfile;
    startedAtTick: number;
    environments:
      readonly CommandPitchEnvironment[];
    availablePitchSkillIds:
      readonly string[];
  }>;

export type CatcherLedPlateAppearanceSequenceResult =
  Readonly<{
    pitchesGenerated: number;
    unusedEnvironmentCount: number;
    catcherCalls:
      readonly CatcherPitchCall[];
    generatedPitches:
      readonly CommandedPitchAgainstBatter[];
    timeline:
      CanonicalPlateAppearanceTimeline;
  }>;

const validateEnvironmentOrdinals = (
  environments:
    readonly CommandPitchEnvironment[],
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
        'catcher-led pitch environments must use contiguous ordinals starting at zero',
      );
    }
  }
};

export const resolveCatcherLedPlateAppearanceSequence = (
  input: CatcherLedPlateAppearanceSequenceInput,
): CatcherLedPlateAppearanceSequenceResult => {
  if (
    input.managerSession.playId
    !== input.match.playId
  ) {
    throw new Error(
      'manager command session playId must match CanonicalMatchState.playId',
    );
  }
  if (
    input.catcherLead.pitcherId.length === 0
    || input.catcherLead.catcherId.length === 0
  ) {
    throw new Error(
      'catcher lead requires pitcher and catcher ids',
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
    input.managerSession,
    timeline,
  );

  const catcherCalls:
    CatcherPitchCall[] = [];
  const generatedPitches:
    CommandedPitchAgainstBatter[] = [];

  let previousCall:
    CatcherPitchCall | undefined;

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
      input.managerSession,
      timeline,
    );

    const catcherLed =
      createCatcherLedCommandedPitch({
        managerSession:
          input.managerSession,
        timeline,
        catcherLead:
          input.catcherLead,
        environment,
        availablePitchSkillIds:
          input.availablePitchSkillIds,
        previousCall,
      });

    const resolution =
      resolveAndRecordPitchAgainstBatter(
        timeline,
        catcherLed.commanded.input,
      );

    if (
      resolution.kind
      === 'unresolved'
    ) {
      throw new Error(
        'catcher-led pitch must physically reach the plate',
      );
    }

    catcherCalls.push(
      catcherLed.call,
    );
    generatedPitches.push(
      catcherLed.commanded,
    );
    timeline =
      resolution.timeline;
    previousCall =
      catcherLed.call;
  }

  return {
    pitchesGenerated:
      generatedPitches.length,
    unusedEnvironmentCount:
      input.environments.length
      - generatedPitches.length,
    catcherCalls,
    generatedPitches,
    timeline,
  };
};
