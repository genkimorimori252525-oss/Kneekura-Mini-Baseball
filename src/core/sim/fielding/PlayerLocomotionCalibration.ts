import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { DefenderAccelerationRatingCalibration } from './DefensiveRatingAdapters';
import type { DefenderRoutePlanCalibration } from './DefenderRoutePlan';

export type PlayerLocomotionCalibration = Readonly<{
  accelerationRatingCalibration: DefenderAccelerationRatingCalibration;
  brakingMps2: number;
  topSpeedMps: number;
  arrivalRadiusMeters: number;
  maxIntegrationStepTicks: number;
  routeCalibration: DefenderRoutePlanCalibration;
  preferredSide: -1 | 1;
}>;

const fields = (value: unknown, names: readonly string[]): void => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...names].sort())) {
    throw new Error('invalid Player locomotion calibration fields');
  }
};
const positive = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be finite and positive`);
};
const nonnegative = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be finite and non-negative`);
};

/** Explicit domains shared with DefenderMotion/DefenderRoutePlan and the acceleration rating adapter.
 * No clock, physical state, ability or ignored base acceleration belongs to this calibration.
 * Concrete consumers must validate their actual clock, tick arithmetic and finite derived trajectories/routes.
 */
export const createPlayerLocomotionCalibration = (raw: PlayerLocomotionCalibration): PlayerLocomotionCalibration => {
  const value = cloneInert(raw);
  fields(value, ['accelerationRatingCalibration', 'brakingMps2', 'topSpeedMps', 'arrivalRadiusMeters',
    'maxIntegrationStepTicks', 'routeCalibration', 'preferredSide']);
  fields(value.accelerationRatingCalibration, ['lowestAbilityAccelerationMps2', 'highestAbilityAccelerationMps2']);
  fields(value.routeCalibration, ['maximumLateralDetourMeters']);
  const acceleration = value.accelerationRatingCalibration;
  positive('lowestAbilityAccelerationMps2', acceleration.lowestAbilityAccelerationMps2);
  positive('highestAbilityAccelerationMps2', acceleration.highestAbilityAccelerationMps2);
  if (acceleration.highestAbilityAccelerationMps2 < acceleration.lowestAbilityAccelerationMps2) {
    throw new Error('highestAbilityAccelerationMps2 must be at least lowestAbilityAccelerationMps2');
  }
  positive('brakingMps2', value.brakingMps2); positive('topSpeedMps', value.topSpeedMps);
  nonnegative('arrivalRadiusMeters', value.arrivalRadiusMeters);
  nonnegative('maximumLateralDetourMeters', value.routeCalibration.maximumLateralDetourMeters);
  if (!Number.isSafeInteger(value.maxIntegrationStepTicks) || value.maxIntegrationStepTicks <= 0) {
    throw new Error('maxIntegrationStepTicks must be a positive safe integer');
  }
  if (value.preferredSide !== -1 && value.preferredSide !== 1) throw new Error('preferredSide must be -1 or 1');
  Object.freeze(value.accelerationRatingCalibration); Object.freeze(value.routeCalibration);
  return Object.freeze(value);
};
