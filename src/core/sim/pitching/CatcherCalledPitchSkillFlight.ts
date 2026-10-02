import type {
  AerodynamicPitchTrajectoryParameters,
} from './AerodynamicPitchTrajectory';
import type {
  CatcherPitchCall,
} from './CatcherLead';
import {
  applyCatcherCallToPitchSkill,
  type PitchSkillCommandResponseProfile,
} from './PitchSkillCommandResponse';
import {
  simulatePitchSkillFlightSample,
  type PitchSkillFlightSample,
} from './PitchSkillFlightSample';
import type {
  PitchSkillProfile,
  PitchSkillSamplingContext,
} from './PitchSkillProfile';

export type CatcherCalledPitchSkillFlightInput =
  Readonly<{
    call: CatcherPitchCall;
    skill: PitchSkillProfile;
    response:
      PitchSkillCommandResponseProfile;
    sampling:
      PitchSkillSamplingContext;
    trajectoryParameters:
      AerodynamicPitchTrajectoryParameters;
    endTick: number;
    plateZ: number;
  }>;

export type CatcherCalledPitchSkillFlight =
  Readonly<{
    call: CatcherPitchCall;
    plannedSkill:
      PitchSkillProfile;
    physical:
      PitchSkillFlightSample;
  }>;

/**
 * Physical execution boundary for a catcher call.
 *
 * catcher chooses a stable pitchSkillId + coarse location
 *   -> pitcher-specific physical motor-plan adjustment
 *   -> the pitcher's own repeatability noise
 *   -> finger/release mechanics
 *   -> aerodynamic flight
 *
 * No exact plate coordinate is supplied here.
 */
export const simulateCatcherCalledPitchSkillFlight = (
  input: CatcherCalledPitchSkillFlightInput,
): CatcherCalledPitchSkillFlight => {
  if (
    input.call.pitchSkillId
    !== input.skill.pitchSkillId
  ) {
    throw new Error(
      'catcher-called physical pitch must use the selected pitchSkillId',
    );
  }

  const plannedSkill =
    applyCatcherCallToPitchSkill(
      input.skill,
      input.response,
      input.call,
    );

  const physical =
    simulatePitchSkillFlightSample({
      pitcherId:
        input.call.pitcherId,
      skill: plannedSkill,
      sampling: input.sampling,
      trajectoryParameters:
        input.trajectoryParameters,
      endTick: input.endTick,
      plateZ: input.plateZ,
    });

  return {
    call: input.call,
    plannedSkill,
    physical,
  };
};
