import type { PlayerLocomotionCalibration } from './PlayerLocomotionCalibration';

/** Synthetic test values, never production tuning or an empirical calibration claim. */
export const playerLocomotionCalibrationFixture = (): PlayerLocomotionCalibration => ({
  accelerationRatingCalibration: { lowestAbilityAccelerationMps2: 2, highestAbilityAccelerationMps2: 6 },
  brakingMps2: 8, topSpeedMps: 7, arrivalRadiusMeters: 0.2, maxIntegrationStepTicks: 10,
  routeCalibration: { maximumLateralDetourMeters: 4 }, preferredSide: 1,
});
