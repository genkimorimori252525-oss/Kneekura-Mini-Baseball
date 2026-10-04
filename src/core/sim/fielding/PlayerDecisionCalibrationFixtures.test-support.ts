import type { PlayerDecisionCalibration } from './PlayerDecisionCalibration';

/** Synthetic test inputs only, never production defaults or measured calibration. */
export const playerDecisionCalibrationFixture = (): PlayerDecisionCalibration => ({
  decisionTimingParameters: { minimumDecisionDelayTicks: 20, maximumDecisionDelayTicks: 100, fixedProcessingOffsetTicks: 5 },
  firstStepTimingParameters: { minimumFirstStepDelayTicks: 10, maximumFirstStepDelayTicks: 50, fixedMotorOffsetTicks: 2 },
  minimumCueConfidence: 0.4,
  communicationTrust: 0.8,
});
