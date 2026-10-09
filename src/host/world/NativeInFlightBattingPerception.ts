import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaText as text, samePaHash, samePaReferenceValid as ref, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaDispatchMemberValid } from './SamePlateAppearanceDispatchRoles';
import type { AcceptedBattingInvocationPosture, AcceptedBattingObservedPrediction, BattingPerceptionKind } from './NativeBattingPerception';
import type { AcceptedCurrentBattingScoreAssessment } from './NativeBattingCurrentScoreAssessment';
export type InFlightBattingCutReference = SamePaReference<'pa_physical_v1_launches' | 'pa_physical_v1_cuts'>;
type Base = Pick<AcceptedBattingInvocationPosture, 'sourceId' | 'sourceVersion' | 'member'> & Readonly<{ viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'> }>;
export type AcceptedInFlightBattingPosture = Omit<AcceptedBattingInvocationPosture, 'capability' | 'viewReference' | 'actionReference'> & Base & Readonly<{
  capability: 'owned_in_flight_batting_posture_v1'; actionReference: SamePaReference<'pa_physical_v1_action_plans'>;
}>;
export type AcceptedInFlightBattingObservation = Base & Readonly<{
  capability: 'owned_in_flight_batting_observation_v1'; postureReference: SamePaReference<'batting_observation_v1_postures'>;
  physicalPitchReference: SamePaReference<'pa_physical_v1_launches'>; physicalOperationReference: InFlightBattingCutReference;
  calibrationReference: SamePaReference<'pa_lifecycle_v1_execution_calibrations'>; observedTick: number;
  previousObservationReference: SamePaReference<'batting_observation_v1_observations'> | null;
}>;
export type AcceptedInFlightBattingDelivery = Base & Readonly<{
  capability: 'owned_in_flight_batting_observation_delivery_v1'; observationReference: SamePaReference<'batting_observation_v1_observations'>;
  physicalPitchReference: SamePaReference<'pa_physical_v1_launches'>; physicalOperationReference: InFlightBattingCutReference;
  calibrationReference: SamePaReference<'pa_lifecycle_v1_execution_calibrations'>;
}>;
export type AcceptedInFlightBattingPrediction = Omit<AcceptedBattingObservedPrediction, 'capability' | 'viewReference'> & Base & Readonly<{
  capability: 'owned_in_flight_batting_observed_prediction_v1';
}>;
export type AcceptedInFlightBattingScore = Omit<AcceptedCurrentBattingScoreAssessment, 'capability' | 'viewReference'> & Base & Readonly<{
  capability: 'owned_in_flight_batting_score_assessment_v1';
}>;
export type InFlightBattingPerceptionSource = AcceptedInFlightBattingPosture | AcceptedInFlightBattingObservation | AcceptedInFlightBattingDelivery | AcceptedInFlightBattingPrediction | AcceptedInFlightBattingScore;
const capabilities = ['owned_in_flight_batting_posture_v1', 'owned_in_flight_batting_observation_v1', 'owned_in_flight_batting_observation_delivery_v1',
  'owned_in_flight_batting_observed_prediction_v1', 'owned_in_flight_batting_score_assessment_v1'];
export const isInFlightBattingPerceptionSource = (v: unknown): v is InFlightBattingPerceptionSource => v !== null && typeof v === 'object' && capabilities.includes((v as { capability: string }).capability);
const tick = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const vector = (v: unknown) => fields(v, ['x', 'y', 'z']) && Object.values(v).every(n => typeof n === 'number' && Number.isFinite(n));
const provenance = (v: unknown) => fields(v, ['assessmentSourceId', 'assessmentVersion', 'calibrationSourceId', 'calibrationVersion']) && Object.values(v).every(text);
export const inFlightBattingCutReferenceValid = (v: unknown) => ref(v, 'pa_physical_v1_launches') || ref(v, 'pa_physical_v1_cuts');
const fail = (): never => { throw new Error('invalid in-flight batting perception Source'); };
/** Additive Source arms. No old Source is relabelled or normalized into these. */
export const inFlightBattingPerceptionSourceInput = (kind: BattingPerceptionKind, raw: unknown, id?: string): InFlightBattingPerceptionSource => {
  const s = cloneInert(raw) as InFlightBattingPerceptionSource;
  if (!isInFlightBattingPerceptionSource(s) || !text(s.sourceId) || !text(s.sourceVersion) || id !== undefined && s.sourceId !== id
    || !ref(s.viewReference, 'pa_lifecycle_v1_execution_views') || !samePaDispatchMemberValid(s.member)) return fail();
  const base = ['sourceId', 'sourceVersion', 'capability', 'viewReference', 'member'];
  if (kind === 'posture' && s.capability === 'owned_in_flight_batting_posture_v1') {
    if (!fields(s, [...base, 'actionReference', 'modelReference', 'geometry', 'sceneBodyReferences', 'provenance'])
      || !ref(s.actionReference, 'pa_physical_v1_action_plans') || !ref(s.modelReference, 'world_player_batting_models') || !provenance(s.provenance)) return fail();
    const g = s.geometry;
    if (!fields(g, ['kind', 'startedAtTick', 'validUntilTick', 'ticksPerSecond', 'handedness', 'centerOfMass', 'eyePosition', 'observerForward', 'attention', 'bodyReadyTick', 'latestMotorStartTick', 'plateZ', 'strikeZone'])
      || g.kind !== 'stationary_pre_pitch_scene_v1' || ![g.startedAtTick, g.validUntilTick, g.bodyReadyTick, g.latestMotorStartTick].every(tick)
      || g.bodyReadyTick < g.startedAtTick || g.latestMotorStartTick < g.bodyReadyTick || g.validUntilTick < g.latestMotorStartTick
      || !tick(g.ticksPerSecond) || g.ticksPerSecond === 0 || !['R', 'L'].includes(g.handedness)
      || ![g.centerOfMass, g.eyePosition, g.observerForward].every(vector) || Math.hypot(g.observerForward.x, g.observerForward.y, g.observerForward.z) === 0
      || !Number.isFinite(g.plateZ) || !fields(g.strikeZone, ['centerX', 'halfWidth', 'lowerY', 'upperY']) || !Object.values(g.strikeZone).every(Number.isFinite)
      || g.strikeZone.halfWidth <= 0 || g.strikeZone.upperY <= g.strikeZone.lowerY || !fields(g.attention, ['target', 'focusedSinceTick'])
      || !tick(g.attention.focusedSinceTick) || g.attention.focusedSinceTick > g.startedAtTick) return fail();
    const target = g.attention.target;
    if (!(target.kind === 'ball' && fields(target, ['kind']) || target.kind === 'player' && fields(target, ['kind', 'playerId']) && text(target.playerId)
      || target.kind === 'coach' && fields(target, ['kind', 'coachId']) && text(target.coachId)
      || target.kind === 'base' && fields(target, ['kind', 'base']) && [1, 2, 3, 4].includes(target.base))) return fail();
    if (!Array.isArray(s.sceneBodyReferences) || s.sceneBodyReferences.length !== 9 || s.sceneBodyReferences.some(b => !fields(b, ['playerId', 'bodyReference']) || !text(b.playerId)
      || !ref(b.bodyReference, 'world_player_body_materializations')) || new Set(s.sceneBodyReferences.map(b => b.playerId)).size !== 9
      || new Set(s.sceneBodyReferences.map(b => b.bodyReference.sourceId)).size !== 9) return fail();
  } else if (kind === 'observation' && s.capability === 'owned_in_flight_batting_observation_v1') {
    if (!fields(s, [...base, 'postureReference', 'physicalPitchReference', 'physicalOperationReference', 'calibrationReference', 'observedTick', 'previousObservationReference'])
      || !ref(s.postureReference, 'batting_observation_v1_postures') || !ref(s.physicalPitchReference, 'pa_physical_v1_launches') || !inFlightBattingCutReferenceValid(s.physicalOperationReference)
      || !ref(s.calibrationReference, 'pa_lifecycle_v1_execution_calibrations') || !tick(s.observedTick)
      || s.previousObservationReference !== null && !ref(s.previousObservationReference, 'batting_observation_v1_observations')) return fail();
  } else if (kind === 'delivery' && s.capability === 'owned_in_flight_batting_observation_delivery_v1') {
    if (!fields(s, [...base, 'observationReference', 'physicalPitchReference', 'physicalOperationReference', 'calibrationReference'])
      || !ref(s.observationReference, 'batting_observation_v1_observations') || !ref(s.physicalPitchReference, 'pa_physical_v1_launches') || !inFlightBattingCutReferenceValid(s.physicalOperationReference)
      || !ref(s.calibrationReference, 'pa_lifecycle_v1_execution_calibrations')) return fail();
  } else if (kind === 'prediction' && s.capability === 'owned_in_flight_batting_observed_prediction_v1') {
    if (!fields(s, [...base, 'observationReference', 'deliveryReference', 'modelReference', 'predictionParameterReference']) || !ref(s.observationReference, 'batting_observation_v1_observations')
      || !ref(s.deliveryReference, 'batting_observation_v1_deliveries') || !ref(s.modelReference, 'world_player_batting_models')
      || !fields(s.predictionParameterReference, ['sourceId', 'sourceVersion', 'sourceHash']) || !text(s.predictionParameterReference.sourceId)
      || !text(s.predictionParameterReference.sourceVersion) || !samePaHash(s.predictionParameterReference.sourceHash)) return fail();
  } else if (kind === 'assessment' && s.capability === 'owned_in_flight_batting_score_assessment_v1') {
    if (!fields(s, [...base, 'predictionReference', 'modelReference', 'observationCutReference', 'score', 'provenance']) || !ref(s.predictionReference, 'batting_prediction_v1_predictions')
      || !ref(s.modelReference, 'world_player_batting_models') || !ref(s.observationCutReference, 'batting_observation_v1_observations')
      || typeof s.score !== 'number' || !Number.isFinite(s.score) || s.score < 0 || s.score > 1 || !provenance(s.provenance)) return fail();
  } else return fail();
  return freeze(s);
};
