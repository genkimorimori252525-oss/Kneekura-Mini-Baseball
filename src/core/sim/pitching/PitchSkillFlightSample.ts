import type {
  AerodynamicPitchTrajectoryParameters,
} from './AerodynamicPitchTrajectory';
import {
  measurePitchMovementSignature,
  type PitchMovementSignature,
} from './PitchMovementSignature';
import {
  simulatePitchReleaseFlightSlice,
  type PitchReleaseFlightSliceResult,
} from './PitchReleaseFlightSlice';
import {
  samplePitchSkillRelease,
  type PitchSkillProfile,
  type PitchSkillSamplingContext,
  type SampledPitchSkillRelease,
} from './PitchSkillProfile';

export type PitchSkillFlightSampleInput = Readonly<{
  pitcherId: string;
  skill: PitchSkillProfile;
  sampling: PitchSkillSamplingContext;
  trajectoryParameters: AerodynamicPitchTrajectoryParameters;
  endTick: number;
  plateZ: number;
}>;

export type PitchSkillFlightSample = Readonly<{
  pitcherId: string;
  pitchSkillId: string;
  sampledRelease: SampledPitchSkillRelease;
  flight: PitchReleaseFlightSliceResult;
  movement: PitchMovementSignature;
}>;

/**
 * One complete physical observation from a learned pitch skill:
 *
 * stable player skill
 *   -> deterministic per-pitch release variation
 *   -> finger/release mechanics
 *   -> aerodynamic flight
 *   -> measured movement signature
 *
 * Human-readable pitch names remain downstream of this result.
 */
export const simulatePitchSkillFlightSample = (
  input: PitchSkillFlightSampleInput,
): PitchSkillFlightSample => {
  const sampledRelease =
    samplePitchSkillRelease(
      input.pitcherId,
      input.skill,
      input.sampling,
    );

  const flight =
    simulatePitchReleaseFlightSlice({
      release: sampledRelease.release,
      trajectoryParameters:
        input.trajectoryParameters,
      endTick: input.endTick,
      plateZ: input.plateZ,
    });

  if (flight.plateCrossing === null) {
    throw new Error(
      'pitch skill flight sample requires the pitch to reach the plate',
    );
  }

  const movement =
    measurePitchMovementSignature({
      trajectory: flight.trajectory,
      plateZ: input.plateZ,
    });

  return {
    pitcherId: input.pitcherId,
    pitchSkillId:
      input.skill.pitchSkillId,
    sampledRelease,
    flight,
    movement,
  };
};
