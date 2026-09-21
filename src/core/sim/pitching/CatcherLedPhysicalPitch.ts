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
  createCatcherLeadCount,
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
import {
  resolvePitcherSignDecision,
  type PitcherSignBehaviorProfile,
  type PitcherSignDecision,
} from './PitcherSignDecision';
import {
  resolveBatterPitchAnticipation,
  type BatterPitchAnticipation,
  type BatterPitchAnticipationResolution,
} from './BatterPitchAnticipation';

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
    pitcherSignBehavior?:
      PitcherSignBehaviorProfile;
    batterAnticipation?:
      BatterPitchAnticipation;
    sampling:
      PitchSkillSamplingContext;
    trajectoryParameters:
      AerodynamicPitchTrajectoryParameters;
    endTick: number;
    plateZ: number;
  }>;

export type CatcherLedPhysicalPitch =
  Readonly<{
    /**
     * Compatibility alias for the catcher's original call.
     */
    call: CatcherPitchCall;
    catcherCall: CatcherPitchCall;
    finalCall: CatcherPitchCall;
    signDecision:
      PitcherSignDecision | null;
    batterAnticipation:
      BatterPitchAnticipationResolution | null;
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
    count: createCatcherLeadCount(
      input.timeline.status.count.balls,
      input.timeline.status.count.strikes,
    ),
    pitchOrdinal:
      input.sampling.pitchOrdinal,
    availablePitchSkillIds,
    previousCall: input.previousCall,
  });

  const signDecision =
    input.pitcherSignBehavior
      === undefined
      ? null
      : resolvePitcherSignDecision({
          matchSeed:
            input.managerSession
              .matchSeed,
          playId:
            input.managerSession.playId,
          availablePitchSkillIds,
          catcherCall: call,
          behavior:
            input.pitcherSignBehavior,
        });

  const finalCall =
    signDecision?.finalCall
    ?? call;

  const skill =
    input.pitcherSkills.skills.find(
      (candidate) =>
        candidate.pitchSkillId
        === finalCall.pitchSkillId,
    );
  if (skill === undefined) {
    throw new Error(
      'final pitchSkillId missing from pitcher skill profile',
    );
  }

  const response =
    input.commandResponses.find(
      (candidate) =>
        candidate.pitchSkillId
        === finalCall.pitchSkillId,
    );
  if (response === undefined) {
    throw new Error(
      'final pitchSkillId requires a physical command response profile',
    );
  }

  const execution =
    simulateCatcherCalledPitchSkillFlight({
      call: finalCall,
      skill,
      response,
      sampling: input.sampling,
      trajectoryParameters:
        input.trajectoryParameters,
      endTick: input.endTick,
      plateZ: input.plateZ,
    });

  const batterAnticipation =
    input.batterAnticipation
      === undefined
      ? null
      : resolveBatterPitchAnticipation(
          input.batterAnticipation,
          finalCall,
        );

  return {
    call,
    catcherCall: call,
    finalCall,
    signDecision,
    batterAnticipation,
    execution,
  };
};
