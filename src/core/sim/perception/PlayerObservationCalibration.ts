import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { ObservationRefreshPolicy } from './Observation';
import type { ObservationGeometryParameters } from './ObservationGeometry';
import type { ObservationQualityParameters } from './ObservationQuality';
import type { ObservationErrorParameters } from './ObservationCapture';
import type { ObservationMemoryDecayParameters } from './ObservationMemory';

/** Explicit measured/calibrated inputs only. Live view, attention and defensive ratings have other owners. */
export type PlayerObservationCalibration = Readonly<{
  perceptionAbility: number;
  refreshPolicy: ObservationRefreshPolicy;
  geometryParameters: ObservationGeometryParameters;
  qualityParameters: ObservationQualityParameters;
  errorParameters: ObservationErrorParameters;
  memoryDecayParameters: ObservationMemoryDecayParameters;
}>;

const fields = (value: unknown, names: readonly string[]): void => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...names].sort())) {
    throw new Error('invalid Player observation calibration fields');
  }
};
const unit = (value: number): void => {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('Player observation calibration must be within [0, 1]');
};
const nonnegative = (value: number): void => {
  if (!Number.isFinite(value) || value < 0) throw new Error('Player observation calibration must be finite and non-negative');
};
const interval = (value: number): void => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Player observation calibration requires a positive safe integer interval');
};
const range = (minimum: number, maximum: number, strict: boolean): void => {
  nonnegative(minimum); nonnegative(maximum);
  if (strict ? maximum <= minimum : maximum < minimum) throw new Error('invalid Player observation calibration range');
};
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

/** Validates every parameter before durable acceptance; never fills an omitted field or derives ability from awareness. */
export const createPlayerObservationCalibration = (input: PlayerObservationCalibration): PlayerObservationCalibration => {
  const value = cloneInert(input);
  fields(value, ['perceptionAbility', 'refreshPolicy', 'geometryParameters', 'qualityParameters', 'errorParameters', 'memoryDecayParameters']);
  unit(value.perceptionAbility);
  const refresh = value.refreshPolicy;
  fields(refresh, ['attendedIntervalTicks', 'peripheralIntervalTicks']);
  interval(refresh.attendedIntervalTicks); interval(refresh.peripheralIntervalTicks);

  const geometry = value.geometryParameters;
  fields(geometry, ['fullQualityHalfAngleRadians', 'maxVisibleHalfAngleRadians', 'fullQualityDistanceMeters',
    'maxObservableDistanceMeters', 'fullQualityRelativeSpeedMps', 'maxRelativeSpeedMps']);
  range(geometry.fullQualityHalfAngleRadians, geometry.maxVisibleHalfAngleRadians, true);
  if (geometry.maxVisibleHalfAngleRadians > Math.PI) throw new Error('Player observation angle must not exceed pi');
  range(geometry.fullQualityDistanceMeters, geometry.maxObservableDistanceMeters, true);
  range(geometry.fullQualityRelativeSpeedMps, geometry.maxRelativeSpeedMps, true);

  const quality = value.qualityParameters;
  fields(quality, ['instantaneousDurationQuality', 'fullQualityObservationDurationSeconds', 'minimumAbilityQuality', 'weights']);
  unit(quality.instantaneousDurationQuality); unit(quality.minimumAbilityQuality);
  nonnegative(quality.fullQualityObservationDurationSeconds);
  if (quality.fullQualityObservationDurationSeconds === 0) throw new Error('Player observation duration must be positive');
  fields(quality.weights, ['distance', 'relativeSpeed', 'attention', 'duration', 'ability']);
  Object.values(quality.weights).forEach(nonnegative);
  // Match ObservationQuality's summation order; caller property order must not mask overflow.
  const totalWeight = quality.weights.distance + quality.weights.relativeSpeed + quality.weights.attention
    + quality.weights.duration + quality.weights.ability;
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) throw new Error('Player observation weights require a finite positive total');

  const error = value.errorParameters;
  fields(error, ['minimumDetectionQuality', 'minimumPositionErrorMeters', 'maximumPositionErrorMeters',
    'minimumVelocityErrorMps', 'maximumVelocityErrorMps']);
  unit(error.minimumDetectionQuality);
  range(error.minimumPositionErrorMeters, error.maximumPositionErrorMeters, false);
  range(error.minimumVelocityErrorMps, error.maximumVelocityErrorMps, false);

  const memory = value.memoryDecayParameters;
  fields(memory, ['ticksPerSecond', 'confidenceLossPerSecond', 'confidenceFloor']);
  interval(memory.ticksPerSecond); nonnegative(memory.confidenceLossPerSecond); unit(memory.confidenceFloor);
  return freeze(value);
};
