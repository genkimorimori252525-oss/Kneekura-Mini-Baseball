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


export const resolveBatterAnticipationRecognitionDelayTicks = (
  resolution:
    BatterPitchAnticipationResolution,
  calibration:
    BatterAnticipationTimingCalibration,
  maximumAvailableDelayTicks: number,
): number => {
  if (
    !Number.isSafeInteger(
      maximumAvailableDelayTicks,
    )
    || maximumAvailableDelayTicks < 0
  ) {
    throw new Error(
      'maximumAvailableDelayTicks must be a non-negative safe integer',
    );
  }

  const desiredDelay = Math.round(
    calibration.maxRecognitionDelayTicks
    * resolution
      .confidenceWeightedSurprise,
  );

  return Math.min(
    desiredDelay,
    maximumAvailableDelayTicks,
  );
};

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

  const recognitionDelayTicks =
    resolveBatterAnticipationRecognitionDelayTicks(
      resolution,
      calibration,
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