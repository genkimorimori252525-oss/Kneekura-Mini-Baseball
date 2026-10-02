import type {
  BatterSwingWindow,
} from './SwingingPitchPhysicalResult';
import type {
  BatterPitchAnticipationResolution,
} from './BatterPitchAnticipation';

export type BatterAnticipationTimingCalibration = Readonly<{
  /**
   * Maximum recognition delay when a high-confidence anticipation is fully
   * contradicted. Explicit calibration input; not a hidden whiff bonus.
   */
  maxRecognitionDelayTicks: number;
}>;

export type BatterAnticipationSwingAdjustment = Readonly<{
  recognitionDelayTicks: number;
  adjustedSwing: BatterSwingWindow;
}>;

export const applyBatterAnticipationToSwingWindow = (
  swing: BatterSwingWindow,
  resolution:
    BatterPitchAnticipationResolution,
  calibration:
    BatterAnticipationTimingCalibration,
  latestAllowedEndTick: number,
): BatterAnticipationSwingAdjustment => {
  if (
    !Number.isSafeInteger(
      calibration.maxRecognitionDelayTicks,
    )
    || calibration.maxRecognitionDelayTicks < 0
  ) {
    throw new Error(
      'maxRecognitionDelayTicks must be a non-negative safe integer',
    );
  }
  if (
    !Number.isSafeInteger(
      latestAllowedEndTick,
    )
    || latestAllowedEndTick
      < swing.endTick
  ) {
    throw new Error(
      'latestAllowedEndTick must be a safe integer at or after swing.endTick',
    );
  }

  const desiredDelay = Math.round(
    calibration.maxRecognitionDelayTicks
    * resolution
      .confidenceWeightedSurprise,
  );
  const recognitionDelayTicks =
    Math.min(
      desiredDelay,
      latestAllowedEndTick
        - swing.endTick,
    );

  return {
    recognitionDelayTicks,
    adjustedSwing: {
      ...swing,
      startTick:
        swing.startTick
        + recognitionDelayTicks,
      endTick:
        swing.endTick
        + recognitionDelayTicks,
    },
  };
};
