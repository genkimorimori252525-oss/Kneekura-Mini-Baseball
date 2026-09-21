import type {
  ContactParameters,
} from '../contact/BatBallContact';
import {
  resolveAerodynamicSwingingPitchPhysicalResult,
  type AerodynamicSwingingPitchPhysicalResult,
} from './AerodynamicSwingingPitchPhysicalResult';
import type {
  AerodynamicPitchTrajectory,
} from './AerodynamicPitchTrajectory';
import {
  applyBatterAnticipationToSwingWindow,
  type BatterAnticipationSwingAdjustment,
  type BatterAnticipationTimingCalibration,
} from './BatterAnticipationSwingAdapter';
import type {
  BatterPitchAnticipationResolution,
} from './BatterPitchAnticipation';
import type {
  BatterSwingWindow,
} from './SwingingPitchPhysicalResult';

export type AnticipationAwareAerodynamicSwingInput =
  Readonly<{
    trajectory:
      AerodynamicPitchTrajectory;
    swing: BatterSwingWindow;
    anticipation:
      BatterPitchAnticipationResolution;
    timingCalibration:
      BatterAnticipationTimingCalibration;
    contactParameters?: ContactParameters;
  }>;

export type AnticipationAwareAerodynamicSwingResult =
  Readonly<{
    timing:
      BatterAnticipationSwingAdjustment;
    physical:
      AerodynamicSwingingPitchPhysicalResult;
  }>;

/**
 * Converts anticipation mismatch into an explicit calibrated recognition
 * delay, then lets ordinary bat/ball geometry decide contact or miss.
 *
 * There is no "surprise whiff" result flag: surprise only changes timing.
 *
 * Compatibility note: this adapter currently feeds the historical
 * AerodynamicSwingingPitchPhysicalResult path. Moving anticipation timing onto
 * a Swing Kinematics v1 trajectory requires shifting the whole trajectory and
 * is a separate integration task; do not partially shift only its time interval.
 */
export const resolveAnticipationAwareAerodynamicSwing = (
  input: AnticipationAwareAerodynamicSwingInput,
): AnticipationAwareAerodynamicSwingResult => {
  const timing =
    applyBatterAnticipationToSwingWindow(
      input.swing,
      input.anticipation,
      input.timingCalibration,
      input.trajectory.endTick,
    );

  const physical =
    resolveAerodynamicSwingingPitchPhysicalResult({
      trajectory: input.trajectory,
      swing: timing.adjustedSwing,
      contactParameters:
        input.contactParameters,
    });

  return {
    timing,
    physical,
  };
};