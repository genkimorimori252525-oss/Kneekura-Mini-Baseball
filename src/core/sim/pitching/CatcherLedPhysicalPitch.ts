import type {
  CanonicalPlateAppearanceTimeline,
} from '../plateAppearance/CanonicalPlateAppearanceTimeline';
import type {
  PlateAppearanceCommandSession,
} from '../plateAppearance/PlateAppearanceCommandSession';
import type {
  AerodynamicPitchTrajectoryParameters,
} from './AerodynamicPitchTrajectory';
import {
  createCatcherPitchCall,
  type CatcherLeadProfile,
  type CatcherPitchCall,
} from './CatcherLead';
import {
  simulateCatcherCalledPitchSkillFlight,
  type CatcherCalledPitchSkillFlight,
} from './CatcherCalledPitchSkillFlight';
import type {
  PitchSkillCommandResponseProfile,
} from './PitchSkillCommandResponse';
import type {
  PitcherPitchSkillProfile,
  PitchSkillSamplingContext,
} from './PitchSkillProfile';

export type CatcherLedPhysicalPitchInput =
  Readonly<{
    managerSession:
      PlateAppearanceCommandSession;
    timeline:
      CanonicalPlateAppearanceTimeline;
    catcherLead:
      CatcherLeadProfile;
    pitcherSkills:
      PitcherPitchSkillProfile;
    commandResponses:
      readonly PitchSkillCommandResponseProfile[];
    previousCall?: CatcherPitchCall;
    sampling:
      PitchSkillSamplingContext;
    trajectoryParameters:
      AerodynamicPitchTrajectoryParameters;
    endTick: number;
    plateZ: number;
  }>;

export type CatcherLedPhysicalPitch =
  Readonly<{
    call: CatcherPitchCall;
    execution:
      CatcherCalledPitchSkillFlight;
  }>;

export const simulateCatcherLedPhysicalPitch = (
  input: CatcherLedPhysicalPitchInput,
): CatcherLedPhysicalPitch => {
  if (
    input.timeline.status.kind
    !== 'active'
  ) {
    throw new Error(
      'catcher-led physical pitch requires an active plate appearance',
    );
  }
  if (
    input.pitcherSkills.pitcherId
    !== input.catcherLead.pitcherId
  ) {
    throw new Error(
      'catcher lead pitcherId must match pitcher skill profile',
    );
  }
  if (
    input.sampling.pitchOrdinal < 0
    || !Number.isSafeInteger(
      input.sampling.pitchOrdinal,
    )
  ) {
    throw new Error(
      'catcher-led physical pitch ordinal must be a non-negative safe integer',
    );
  }

  const availablePitchSkillIds =
    input.pitcherSkills.skills.map(
      (skill) => skill.pitchSkillId,
    );

  const call = createCatcherPitchCall({
    session: input.managerSession,
    profile: input.catcherLead,
    count: {
      balls:
        input.timeline.status.count.balls,
      strikes:
        input.timeline.status.count.strikes,
    },
    pitchOrdinal:
      input.sampling.pitchOrdinal,
    availablePitchSkillIds,
    previousCall: input.previousCall,
  });

  const skill =
    input.pitcherSkills.skills.find(
      (candidate) =>
        candidate.pitchSkillId
        === call.pitchSkillId,
    );
  if (skill === undefined) {
    throw new Error(
      'catcher selected pitchSkillId missing from pitcher skill profile',
    );
  }

  const response =
    input.commandResponses.find(
      (candidate) =>
        candidate.pitchSkillId
        === call.pitchSkillId,
    );
  if (response === undefined) {
    throw new Error(
      'catcher selected pitchSkillId requires a physical command response profile',
    );
  }

  const execution =
    simulateCatcherCalledPitchSkillFlight({
      call,
      skill,
      response,
      sampling: input.sampling,
      trajectoryParameters:
        input.trajectoryParameters,
      endTick: input.endTick,
      plateZ: input.plateZ,
    });

  return {
    call,
    execution,
  };
};
