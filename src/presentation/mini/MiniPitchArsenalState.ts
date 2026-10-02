import type {
  PitcherPitchArsenalProfile,
} from '../../core/sim/pitching/PitchArsenalProfile';
import {
  displayPitchMovementDirection,
  type PitchMovementDirectionDisplay,
  type PitchMovementDisplayConvention,
} from '../../core/sim/pitching/PitchMovementSignature';

export type MiniPitchArsenalRow = Readonly<{
  pitchSkillId: string;
  pitchName: string;
  direction: PitchMovementDirectionDisplay;
  meanHorizontalBreakCm: number;
  meanVerticalBreakCm: number;
  horizontalStdDevCm: number;
  verticalStdDevCm: number;
  meanReleaseSpeedKph: number;
  releaseSpeedStdDevKph: number;
  samples: number;
}>;

export type MiniPitchArsenalState = Readonly<{
  pitcherId: string;
  registryVersion: string;
  pitches: readonly MiniPitchArsenalRow[];
}>;

const metersToCentimeters = (
  meters: number,
): number => meters * 100;

const metersPerSecondToKph = (
  metersPerSecond: number,
): number => metersPerSecond * 3.6;

export const buildMiniPitchArsenalState = (
  profile: PitcherPitchArsenalProfile,
  convention: PitchMovementDisplayConvention,
): MiniPitchArsenalState => ({
  pitcherId: profile.pitcherId,
  registryVersion: profile.registryVersion,
  pitches: profile.pitches.map((pitch) => ({
    pitchSkillId: pitch.pitchSkillId,
    pitchName:
      pitch.registeredName.displayName,
    direction: displayPitchMovementDirection(
      pitch.physical.directionFamily,
      convention,
    ),
    meanHorizontalBreakCm:
      metersToCentimeters(
        pitch.physical.meanInducedHorizontalM,
      ),
    meanVerticalBreakCm:
      metersToCentimeters(
        pitch.physical.meanInducedVerticalM,
      ),
    horizontalStdDevCm:
      metersToCentimeters(
        pitch.physical.horizontalStdDevM,
      ),
    verticalStdDevCm:
      metersToCentimeters(
        pitch.physical.verticalStdDevM,
      ),
    meanReleaseSpeedKph:
      metersPerSecondToKph(
        pitch.physical.meanReleaseSpeedMps,
      ),
    releaseSpeedStdDevKph:
      metersPerSecondToKph(
        pitch.physical.releaseSpeedStdDevMps,
      ),
    samples: pitch.physical.samples,
  })),
});
