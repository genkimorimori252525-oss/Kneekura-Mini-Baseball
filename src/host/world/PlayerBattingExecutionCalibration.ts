import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createPlayerObservationCalibration } from '../../core/sim/perception/PlayerObservationCalibration';
import { resolvePreferredContactDepthV1 } from '../../core/sim/pitching/CourseAwareSwingKinematicsV1';
import { bodySourceId as id, bodySourceFields as fields } from './PlayerBodyCapabilityMaterialization';
import type { AcceptedBattingCapability, AcceptedBattingRepertoire, AcceptedBattingDecisionModel, AcceptedBattingObservationCalibration } from './PlayerBattingModel';
const requireFields = (value: unknown, required: readonly string[]): void => {
  if (!fields(value, required)) throw new Error('invalid accepted batting model fields');
};
const positive = (value: number): boolean => Number.isFinite(value) && value > 0;
const positiveTick = (value: number): boolean => Number.isSafeInteger(value) && value > 0;
const unit = (value: number): boolean => Number.isFinite(value) && value >= 0 && value <= 1;

/** Shared strict numerical domains, without a model Source or owner identity.
 * The nominal model owner and versioned execution owner retain their own refs. */
export const battingCapabilityValuesInput = (raw: AcceptedBattingCapability['values']): AcceptedBattingCapability['values'] => {
  const capability = cloneInert(raw);
  requireFields(capability, ['motorLatencyTicks', 'technicalTimingOffsetTicks', 'maximumSweetSpotSpeedMps']);
  if (!positiveTick(capability.motorLatencyTicks) || !Number.isSafeInteger(capability.technicalTimingOffsetTicks)
    || !positive(capability.maximumSweetSpotSpeedMps)) throw new Error('invalid accepted batting motor capability');
  return capability;
};

export const battingRepertoireValuesInput = (raw: AcceptedBattingRepertoire['values']): AcceptedBattingRepertoire['values'] => {
  const repertoire = cloneInert(raw);
  requireFields(repertoire, ['repertoireId', 'repertoireVersion', 'profiles']);
  if (!id(repertoire.repertoireId) || !id(repertoire.repertoireVersion) || !Array.isArray(repertoire.profiles)
    || repertoire.profiles.length < 1 || repertoire.profiles.length > 32) throw new Error('invalid accepted batting repertoire');
  const ids = new Set<string>();
  const profileFields = ['profileId', 'version', 'batLengthM', 'sweetSpotT', 'centerContactDepthM', 'contactDepthPopulationStdDevM',
    'insideOutsideDepthGainM', 'heightDepthGainM', 'baseContactSweetSpotSpeedMps', 'contactDepthSpeedGainMpsPerM',
    'basePreContactSeconds', 'insideOutsideTimingGainSeconds', 'heightTimingGainSeconds', 'followThroughSeconds',
    'highAttackAngleDeg', 'middleAttackAngleDeg', 'lowAttackAngleDeg', 'courseAttackDirectionGainDeg', 'nominalContactSurfaceDistanceM'];
  repertoire.profiles.forEach((row, index) => {
    requireFields(row, ['minimumAggression', 'profile']); requireFields(row.profile, profileFields);
    if (!unit(row.minimumAggression) || (index === 0 ? row.minimumAggression !== 0 : row.minimumAggression <= repertoire.profiles[index - 1].minimumAggression)
      || !id(row.profile.profileId) || !id(row.profile.version) || ids.has(row.profile.profileId)
      || row.profile.batLengthM !== repertoire.profiles[0].profile.batLengthM
      || row.profile.sweetSpotT !== repertoire.profiles[0].profile.sweetSpotT) throw new Error('invalid accepted batting course repertoire');
    // Same pure profile-validation route as Core BattingValidation; discard the scalar, retain original bytes.
    resolvePreferredContactDepthV1({ heightNormalized: 0, insideOutsideNormalized: 0 }, row.profile);
    ids.add(row.profile.profileId);
  });
  return repertoire;
};

export const battingDecisionValuesInput = (raw: AcceptedBattingDecisionModel['values']): AcceptedBattingDecisionModel['values'] => {
  const decision = cloneInert(raw);
  requireFields(decision, ['modelId', 'version', 'threshold', 'aggressionWeight']);
  if (!id(decision.modelId) || !id(decision.version) || !unit(decision.threshold) || !unit(decision.aggressionWeight)) {
    throw new Error('invalid accepted batting decision parameters');
  }
  return decision;
};

export const battingObservationValuesInput = (raw: AcceptedBattingObservationCalibration['values']): AcceptedBattingObservationCalibration['values'] => {
  const observation = cloneInert(raw);
  requireFields(observation, ['calibration', 'deliveryLatencyTicks']);
  if (!positiveTick(observation.deliveryLatencyTicks)) throw new Error('accepted batting sensory delivery latency must be positive');
  createPlayerObservationCalibration(observation.calibration);
  return observation;
};
