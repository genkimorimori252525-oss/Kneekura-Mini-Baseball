import type { PlayerObservationCalibration } from './PlayerObservationCalibration';

/** Synthetic test inputs only; these values are not production calibration. */
export const playerObservationCalibrationFixture = (): PlayerObservationCalibration => ({
  perceptionAbility: 0.8,
  refreshPolicy: { attendedIntervalTicks: 10, peripheralIntervalTicks: 40 },
  geometryParameters: {
    fullQualityHalfAngleRadians: Math.PI / 6, maxVisibleHalfAngleRadians: Math.PI / 2,
    fullQualityDistanceMeters: 10, maxObservableDistanceMeters: 100,
    fullQualityRelativeSpeedMps: 2, maxRelativeSpeedMps: 50,
  },
  qualityParameters: {
    instantaneousDurationQuality: 0.2, fullQualityObservationDurationSeconds: 1,
    minimumAbilityQuality: 0.4,
    weights: { distance: 1, relativeSpeed: 1, attention: 1, duration: 1, ability: 1 },
  },
  errorParameters: {
    minimumDetectionQuality: 0.1, minimumPositionErrorMeters: 0, maximumPositionErrorMeters: 2,
    minimumVelocityErrorMps: 0, maximumVelocityErrorMps: 4,
  },
  memoryDecayParameters: { ticksPerSecond: 1000, confidenceLossPerSecond: 0.1, confidenceFloor: 0.05 },
});
