import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { sampleBatRadius } from '../../core/sim/contact/RigidBatBallContact';

export type BatSwingEquipmentV121 = Readonly<{ lengthM: number; massKg: number; sweetSpotT: number }>;
/** An explicit author-supplied response calibration, not an inferred athlete measurement.
 * maximumSweetSpotSpeedMps belongs to baselineBat only when this model is present. */
export type BatSwingCapacityModelV121 = Readonly<{
  modelId: 'GENERIC_BAT_INERTIA_CALIBRATION_V121';
  baselineBat: BatSwingEquipmentV121;
  calibration: Readonly<{ calibrationId: string; source: string; inertiaExponent: number;
    minimumInertiaRatio: number; maximumInertiaRatio: number }>;
}>;
export type BatSwingCapacityInputV121 = Readonly<{ maximumSweetSpotSpeedMps: number;
  bat: BatSwingEquipmentV121; model?: BatSwingCapacityModelV121 }>;
export type BatSwingCapacityEstimateV121 = Readonly<{
  status: 'ESTIMATED' | 'UNAVAILABLE'; reason: 'MISSING_EXPLICIT_BASELINE_CALIBRATION'
    | 'OUTSIDE_CALIBRATION_RANGE' | 'CALIBRATED_EQUIPMENT_ESTIMATE';
  effectiveMaxSweetSpotSpeedMps: number | null; baselineMaximumSweetSpotSpeedMps: number;
  calibrationId: string | null; calibrationSource: string | null; inertiaRatio: number | null;
}>;
const requireValue = (ok: boolean, message: string): void => { if (!ok) throw Error('bat swing capacity: ' + message); };
const positive = (value: number) => Number.isFinite(value) && value > 0;
const exactFields = (value: unknown, keys: readonly string[]): void => {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('|') === [...keys].sort().join('|'), 'invalid model fields');
};
const equipmentValid = (bat: BatSwingEquipmentV121): void => {
  exactFields(bat, ['lengthM', 'massKg', 'sweetSpotT']);
  requireValue(positive(bat.lengthM) && positive(bat.massKg) && Number.isFinite(bat.sweetSpotT)
    && bat.sweetSpotT > 0 && bat.sweetSpotT <= 1, 'invalid bat geometry');
};

/** Same generic solid wooden silhouette used by Workbench contact physics.
 * The pivot is the declared knob reference, not a measured human wrist. */
export function deriveBatSwingInertiaV121(bat: BatSwingEquipmentV121) {
  equipmentValid(bat);
  const radiusProfile = { knots: [{ t: 0, radiusM: .024 }, { t: .04, radiusM: .014 },
    { t: .30, radiusM: .018 }, { t: .65, radiusM: .030 }, { t: .78, radiusM: .033 }, { t: 1, radiusM: .012 }] };
  const slices = Array.from({ length: 256 }, (_, index) => {
    const t = (index + .5) / 256, radiusM = sampleBatRadius(radiusProfile, t);
    return { t, radiusM, weight: radiusM * radiusM };
  });
  const total = slices.reduce((sum, slice) => sum + slice.weight, 0);
  const centerOfMassT = slices.reduce((sum, slice) => sum + slice.t * slice.weight, 0) / total;
  const transverseMomentOfInertiaKgM2 = slices.reduce((sum, slice) => sum + bat.massKg * slice.weight / total
    * (((slice.t - centerOfMassT) * bat.lengthM) ** 2 + slice.radiusM ** 2 / 4 + (bat.lengthM / 256) ** 2 / 12), 0);
  const axialMomentOfInertiaKgM2 = slices.reduce((sum, slice) => sum + bat.massKg * slice.weight / total * slice.radiusM ** 2 / 2, 0);
  return { radiusProfile, centerOfMassT, transverseMomentOfInertiaKgM2, axialMomentOfInertiaKgM2,
    knobMomentOfInertiaKgM2: transverseMomentOfInertiaKgM2 + bat.massKg * (centerOfMassT * bat.lengthM) ** 2 };
}

export function evaluateBatSwingCapacityV121(raw: BatSwingCapacityInputV121): BatSwingCapacityEstimateV121 {
  const descriptors: PropertyDescriptorMap = Object.getOwnPropertyDescriptors(raw);
  if (descriptors.model && 'value' in descriptors.model && descriptors.model.value === undefined) delete descriptors.model;
  const input = cloneInert(Object.create(Object.getPrototypeOf(raw), descriptors)) as BatSwingCapacityInputV121;
  requireValue(positive(input.maximumSweetSpotSpeedMps), 'invalid baseline maximum speed');
  equipmentValid(input.bat);
  const base = { baselineMaximumSweetSpotSpeedMps: input.maximumSweetSpotSpeedMps,
    effectiveMaxSweetSpotSpeedMps: null, calibrationId: null, calibrationSource: null, inertiaRatio: null };
  if (input.model === undefined) return Object.freeze({ ...base, status: 'UNAVAILABLE', reason: 'MISSING_EXPLICIT_BASELINE_CALIBRATION' });
  const model = input.model;
  exactFields(model, ['modelId', 'baselineBat', 'calibration']); equipmentValid(model.baselineBat);
  requireValue(model.modelId === 'GENERIC_BAT_INERTIA_CALIBRATION_V121', 'unknown calibration model');
  const c = model.calibration;
  exactFields(c, ['calibrationId', 'source', 'inertiaExponent', 'minimumInertiaRatio', 'maximumInertiaRatio']);
  requireValue([c.calibrationId, c.source].every(s => typeof s === 'string' && s.trim() === s && s.length > 0 && s.length <= 500),
    'calibration provenance required');
  requireValue(positive(c.inertiaExponent) && positive(c.minimumInertiaRatio) && c.minimumInertiaRatio <= 1
    && Number.isFinite(c.maximumInertiaRatio) && c.maximumInertiaRatio >= 1, 'invalid calibration response or domain');
  const inertiaRatio = deriveBatSwingInertiaV121(input.bat).knobMomentOfInertiaKgM2
    / deriveBatSwingInertiaV121(model.baselineBat).knobMomentOfInertiaKgM2;
  const provenance = { ...base, calibrationId: c.calibrationId, calibrationSource: c.source, inertiaRatio };
  if (inertiaRatio < c.minimumInertiaRatio || inertiaRatio > c.maximumInertiaRatio)
    return Object.freeze({ ...provenance, status: 'UNAVAILABLE', reason: 'OUTSIDE_CALIBRATION_RANGE' });
  // This response exponent must be supplied with its calibration source. There is
  // no default square-root law, no body-mass multiplier, and no contact bonus.
  const effectiveMaxSweetSpotSpeedMps = input.maximumSweetSpotSpeedMps
    * (input.bat.lengthM * input.bat.sweetSpotT) / (model.baselineBat.lengthM * model.baselineBat.sweetSpotT)
    * inertiaRatio ** -c.inertiaExponent;
  requireValue(positive(effectiveMaxSweetSpotSpeedMps), 'nonfinite estimated capacity');
  return Object.freeze({ ...provenance, status: 'ESTIMATED', reason: 'CALIBRATED_EQUIPMENT_ESTIMATE', effectiveMaxSweetSpotSpeedMps });
}

/** A proposal is never applied here. Unknown capacity preserves the legacy validator. */
export function validateBatSwingCapacityTargetV121(capacity: BatSwingCapacityEstimateV121, targetSweetSpotSpeedMps: number) {
  requireValue(positive(targetSweetSpotSpeedMps), 'invalid target speed');
  const ceiling = capacity.effectiveMaxSweetSpotSpeedMps;
  const valid = ceiling === null || targetSweetSpotSpeedMps <= ceiling;
  return Object.freeze({ valid, reason: valid ? null : 'TARGET_EXCEEDS_EFFECTIVE_BAT_SWING_CAPACITY',
    proposedTargetSweetSpotSpeedMps: valid ? null : ceiling });
}
