import type {
  CanonicalPlateAppearanceTimeline,
} from '../plateAppearance/CanonicalPlateAppearanceTimeline';
import {
  createCommandedPitchAgainstBatterInput,
  type CommandPitchEnvironment,
  type CommandedPitchAgainstBatter,
} from '../plateAppearance/PlateAppearanceCommandPitchAdapter';
import type {
  PlateAppearanceCommandSession,
} from '../plateAppearance/PlateAppearanceCommandSession';
import {
  createCatcherLeadCount,
  createCatcherPitchCall,
  type CatcherLeadProfile,
  type CatcherPitchCall,
} from './CatcherLead';

export type CatcherLedCommandedPitch = Readonly<{
  call: CatcherPitchCall;
  perPitchSession:
    PlateAppearanceCommandSession;
  commanded:
    CommandedPitchAgainstBatter;
}>;

export type CatcherLedCommandedPitchInput = Readonly<{
  managerSession:
    PlateAppearanceCommandSession;
  timeline:
    CanonicalPlateAppearanceTimeline;
  catcherLead:
    CatcherLeadProfile;
  environment:
    CommandPitchEnvironment;
  availablePitchSkillIds:
    readonly string[];
  previousCall?: CatcherPitchCall;
}>;

const createPerPitchSession = (
  managerSession:
    PlateAppearanceCommandSession,
  call: CatcherPitchCall,
): PlateAppearanceCommandSession => ({
  ...managerSession,
  command: {
    ...managerSession.command,
    pitcher: {
      attackZone: call.attackZone,
      verticalPlan: call.verticalPlan,
      aggression: call.aggression,
    },
  },
});

/**
 * @deprecated Compatibility-only historical path. Active production plate
 * appearances use the aerodynamic rigid-bat Swing Kinematics v1 path.
 */
export const createCatcherLedCommandedPitch = (
  input: CatcherLedCommandedPitchInput,
): CatcherLedCommandedPitch => {
  if (
    input.timeline.status.kind
    !== 'active'
  ) {
    throw new Error(
      'catcher lead requires an active plate appearance timeline',
    );
  }
  if (
    input.environment.pitchOrdinal < 0
    || !Number.isSafeInteger(
      input.environment.pitchOrdinal,
    )
  ) {
    throw new Error(
      'catcher-led environment pitchOrdinal must be a non-negative safe integer',
    );
  }

  const call = createCatcherPitchCall({
    session: input.managerSession,
    profile: input.catcherLead,
    count: createCatcherLeadCount(
      input.timeline.status.count.balls,
      input.timeline.status.count.strikes,
    ),
    pitchOrdinal:
      input.environment.pitchOrdinal,
    availablePitchSkillIds:
      input.availablePitchSkillIds,
    previousCall: input.previousCall,
  });

  const perPitchSession =
    createPerPitchSession(
      input.managerSession,
      call,
    );

  const commanded =
    createCommandedPitchAgainstBatterInput({
      session: perPitchSession,
      environment: input.environment,
    });

  return {
    call,
    perPitchSession,
    commanded,
  };
};