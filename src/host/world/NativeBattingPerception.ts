import { inFlightBattingPerceptionSourceInput, isInFlightBattingPerceptionSource, type InFlightBattingPerceptionSource, type AcceptedInFlightBattingPosture, type AcceptedInFlightBattingObservation, type AcceptedInFlightBattingDelivery, type AcceptedInFlightBattingPrediction, type AcceptedInFlightBattingScore } from './NativeInFlightBattingPerception';
import { samePaOccupiedRunnerHoldReferencesValid } from './SamePlateAppearanceOccupiedRunnerHold';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import type { AttentionState } from '../../core/sim/perception/Observation';
import type { BattingSource } from '../../core/world/psychology/batting/BattingTypes';
import type { BattingObservationCalculation } from '../../core/world/psychology/batting/BattingObservationCalculation';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaText as text, samePaHash, samePaReferenceValid as ref, type SamePaReference, type SamePaExecutionLineage } from './SamePlateAppearanceWorkPrefix';
import { samePaDispatchMemberValid, type SamePaDispatchMember } from './SamePlateAppearanceDispatchRoles';
import type { DurablePlayerBattingModelV1 } from './PlayerBattingModel';
import type { BodyMaterializationReceipt } from './PlayerBodyCapabilityMaterialization';
import type { BattingObservedMotionForecast } from './NativeBattingPrediction';
import { battingScoreAssessmentInput, type AcceptedBattingScoreAssessment } from './NativeBattingScoreAssessment';
import { currentBattingScoreAssessmentInput, type AcceptedCurrentBattingScoreAssessment } from './NativeBattingCurrentScoreAssessment';
import type { SamePaCurrentExecutionViewReference, SamePaInvocationViewReference } from './SamePlateAppearanceInvocationView';
import type { BattingObservationDelivery } from './NativeBattingDelivery';

type Base<V extends SamePaInvocationViewReference = SamePaReference<'reserved_pa_execution_views'>> = Readonly<{ sourceId: string; sourceVersion: string; viewReference: V; member: SamePaDispatchMember }>;
export type AcceptedBattingInvocationPosture = Base & Readonly<{
  capability: 'owned_batting_invocation_posture_v1'; actionReference: SamePaReference<'pa_dispatch_v1_action_plans'>;
  modelReference: SamePaReference<'world_player_batting_models'>;
  geometry: Readonly<{ kind: 'stationary_pre_pitch_scene_v1'; startedAtTick: number; validUntilTick: number; ticksPerSecond: number;
    handedness: 'R' | 'L'; centerOfMass: Vec3; eyePosition: Vec3; observerForward: Vec3; attention: AttentionState;
    bodyReadyTick: number; latestMotorStartTick: number; plateZ: number; strikeZone: BattingSource['strikeZone'] }>;
  sceneBodyReferences: readonly Readonly<{ playerId: string; bodyReference: SamePaReference<'world_player_body_materializations'> }>[];
  occupiedRunnerHoldReferences?: readonly SamePaReference<'world_same_pa_occupied_runner_holds'>[];
  provenance: AcceptedBattingScoreAssessment['provenance'];
}>;
export type AcceptedNextTakeBattingPosture = Omit<AcceptedBattingInvocationPosture, 'capability' | 'viewReference' | 'actionReference'> & Readonly<{
  capability: 'owned_next_take_batting_posture_v1'; viewReference: SamePaCurrentExecutionViewReference;
  actionReference: SamePaReference<'pa_take_successor_v1_action_plans'>; nextPhysicalPitchSourceId: string;
}>;
export type AcceptedBattingObservation = Base<SamePaCurrentExecutionViewReference> & Readonly<{
  capability: 'owned_batting_observation_v1'; postureReference: SamePaReference<'batting_observation_v1_postures'>;
  physicalPitchReference: SamePaReference<'pa_dispatch_v1_pitch_actions'>;
  calibrationReference: SamePaReference<'pa_continuation_v1_execution_calibrations'>;
  observedTick: number; deliveryCutTick: number; previousObservationReference: SamePaReference<'batting_observation_v1_observations'> | null;
}>;
export type AcceptedBattingObservedPrediction = Base<SamePaCurrentExecutionViewReference> & Readonly<{
  capability: 'owned_batting_observed_prediction_v1'; observationReference: SamePaReference<'batting_observation_v1_observations'>;
  deliveryReference: SamePaReference<'batting_observation_v1_deliveries'>;
  modelReference: SamePaReference<'world_player_batting_models'>;
  predictionParameterReference: Readonly<{ sourceId: string; sourceVersion: string; sourceHash: string }>;
}>;
export type AcceptedBattingObservationDelivery = Base<SamePaCurrentExecutionViewReference> & Readonly<{
  capability: 'owned_batting_observation_delivery_v1'; observationReference: SamePaReference<'batting_observation_v1_observations'>;
  completionReference: SamePaReference<'pa_take_successor_v1_action_plans'>; postureReference: SamePaReference<'batting_observation_v1_postures'>;
  calibrationReference: SamePaReference<'pa_continuation_v1_execution_calibrations'>;
}>;
type OwnedScope = Readonly<{ lineage: SamePaExecutionLineage; physicalPitchSourceId: string }>;
export type DurableBattingInvocationPosture = OwnedScope & Readonly<{ kind: 'batting_invocation_posture'; source: AcceptedBattingInvocationPosture | AcceptedNextTakeBattingPosture | AcceptedInFlightBattingPosture;
  model: DurablePlayerBattingModelV1; sceneBodies: readonly BodyMaterializationReceipt[] }>;
export type DurableBattingObservation = OwnedScope & Readonly<{ kind: 'batting_observation'; source: AcceptedBattingObservation | AcceptedInFlightBattingObservation;
  modelReference: SamePaReference<'world_player_batting_models'>; eventSequence: number; lastCapturedTick: number | null; physicalCutHash: string; calculation: BattingObservationCalculation }>;
export type DurableBattingObservedPrediction = OwnedScope & Readonly<{ kind: 'batting_observed_prediction'; source: AcceptedBattingObservedPrediction | AcceptedInFlightBattingPrediction;
  physicalPitchReference: SamePaReference<'pa_dispatch_v1_pitch_actions' | 'pa_physical_v1_launches'>; forecast: BattingObservedMotionForecast }>;
export type DurableBattingObservationDelivery = OwnedScope & Readonly<{ kind: 'batting_observation_delivery'; source: AcceptedBattingObservationDelivery | AcceptedInFlightBattingDelivery;
  physicalPitchReference: SamePaReference<'pa_dispatch_v1_pitch_actions' | 'pa_physical_v1_launches'>; originalCaptureHash: string; eventSequence: number; delivery: BattingObservationDelivery;
  temporalCut: Readonly<{ kind: 'retained_stationary_delivery_cut_v1'; fromTick: number; throughTick: number; originalWorldHash: string }> | Readonly<{ kind: 'owned_in_flight_delivery_cut_v1'; fromTick: number; throughTick: number; originalWorldHash: string; physicalOperationReference: SamePaReference<'pa_physical_v1_launches' | 'pa_physical_v1_cuts'> }> }>;
export type DurableBattingScoreAssessment = OwnedScope & Readonly<{ kind: 'batting_score_assessment'; source: AcceptedBattingScoreAssessment | AcceptedCurrentBattingScoreAssessment | AcceptedInFlightBattingScore;
  prediction: BattingSource['predictions'][number] }>;
export type LegacyBattingPerceptionSource = AcceptedBattingInvocationPosture | AcceptedNextTakeBattingPosture | AcceptedBattingObservation | AcceptedBattingObservationDelivery | AcceptedBattingObservedPrediction | AcceptedBattingScoreAssessment | AcceptedCurrentBattingScoreAssessment;
export type BattingPerceptionSource = LegacyBattingPerceptionSource | InFlightBattingPerceptionSource;
export type BattingPerceptionRecord = DurableBattingInvocationPosture | DurableBattingObservation | DurableBattingObservationDelivery | DurableBattingObservedPrediction | DurableBattingScoreAssessment;
export type BattingPerceptionKind = 'posture' | 'observation' | 'delivery' | 'prediction' | 'assessment';
export const battingPerceptionTables = Object.freeze({ posture: 'batting_observation_v1_postures', observation: 'batting_observation_v1_observations',
  delivery: 'batting_observation_v1_deliveries', prediction: 'batting_prediction_v1_predictions', assessment: 'batting_score_v1_assessments' } as const);
const tick = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const vector = (v: unknown) => fields(v, ['x', 'y', 'z']) && Object.values(v).every(n => typeof n === 'number' && Number.isFinite(n));
const fail = (): never => { throw new Error('invalid explicit batting perception Source'); };
const baseKeys = ['sourceId', 'sourceVersion', 'capability', 'viewReference', 'member'];
export const battingPerceptionSourceInput = (kind: BattingPerceptionKind, raw: unknown, id?: string): BattingPerceptionSource => {
  const checked = cloneInert(raw);
  if (isInFlightBattingPerceptionSource(checked)) return inFlightBattingPerceptionSourceInput(kind, checked, id);
  if (kind === 'assessment') { const value = cloneInert(raw) as { capability?: unknown }; return value?.capability === 'owned_batting_current_score_assessment_v1' ? currentBattingScoreAssessmentInput(value, id) : battingScoreAssessmentInput(value, id); }
  const s = cloneInert(raw) as Exclude<LegacyBattingPerceptionSource, AcceptedBattingScoreAssessment | AcceptedCurrentBattingScoreAssessment>;
  if (!s || !text(s.sourceId) || !text(s.sourceVersion) || id !== undefined && s.sourceId !== id
    || !ref(s.viewReference, s.capability === 'owned_batting_invocation_posture_v1' ? 'reserved_pa_execution_views' : 'pa_continuation_v1_execution_views') || !samePaDispatchMemberValid(s.member)) return fail();
  if (kind === 'posture' && (s.capability === 'owned_batting_invocation_posture_v1' || s.capability === 'owned_next_take_batting_posture_v1')) {
    const next = s.capability === 'owned_next_take_batting_posture_v1';
    if (!fields(s, [...baseKeys, 'actionReference', 'modelReference', 'geometry', 'sceneBodyReferences', 'provenance', ...(next ? ['nextPhysicalPitchSourceId'] : []), ...('occupiedRunnerHoldReferences' in s ? ['occupiedRunnerHoldReferences'] : [])])
      || 'occupiedRunnerHoldReferences' in s && !samePaOccupiedRunnerHoldReferencesValid(s.occupiedRunnerHoldReferences)
      || !ref(s.actionReference, next ? 'pa_take_successor_v1_action_plans' : 'pa_dispatch_v1_action_plans') || next && !text(s.nextPhysicalPitchSourceId) || !ref(s.modelReference, 'world_player_batting_models')
      || !fields(s.provenance, ['assessmentSourceId', 'assessmentVersion', 'calibrationSourceId', 'calibrationVersion']) || !Object.values(s.provenance).every(text)) return fail();
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
    const sceneCount = 9 + (s.occupiedRunnerHoldReferences?.length ?? 0);
    if (!Array.isArray(s.sceneBodyReferences) || s.sceneBodyReferences.length !== sceneCount || s.sceneBodyReferences.some(b => !fields(b, ['playerId', 'bodyReference']) || !text(b.playerId)
      || !ref(b.bodyReference, 'world_player_body_materializations')) || new Set(s.sceneBodyReferences.map(b => b.playerId)).size !== sceneCount
      || new Set(s.sceneBodyReferences.map(b => b.bodyReference.sourceId)).size !== sceneCount) return fail();
  } else if (kind === 'observation' && s.capability === 'owned_batting_observation_v1') {
    if (!fields(s, [...baseKeys, 'postureReference', 'physicalPitchReference', 'calibrationReference', 'observedTick', 'deliveryCutTick', 'previousObservationReference'])
      || !ref(s.postureReference, 'batting_observation_v1_postures') || !ref(s.physicalPitchReference, 'pa_dispatch_v1_pitch_actions')
      || !ref(s.calibrationReference, 'pa_continuation_v1_execution_calibrations') || !tick(s.observedTick) || !tick(s.deliveryCutTick) || s.deliveryCutTick < s.observedTick
      || s.previousObservationReference !== null && !ref(s.previousObservationReference, 'batting_observation_v1_observations')) return fail();
  } else if (kind === 'prediction' && s.capability === 'owned_batting_observed_prediction_v1') {
    if (!fields(s, [...baseKeys, 'observationReference', 'deliveryReference', 'modelReference', 'predictionParameterReference']) || !ref(s.observationReference, 'batting_observation_v1_observations')
      || !ref(s.deliveryReference, 'batting_observation_v1_deliveries')
      || !ref(s.modelReference, 'world_player_batting_models') || !fields(s.predictionParameterReference, ['sourceId', 'sourceVersion', 'sourceHash'])
      || !text(s.predictionParameterReference.sourceId) || !text(s.predictionParameterReference.sourceVersion) || !samePaHash(s.predictionParameterReference.sourceHash)) return fail();
  } else if (kind === 'delivery' && s.capability === 'owned_batting_observation_delivery_v1') {
    if (!fields(s, [...baseKeys, 'observationReference', 'completionReference', 'postureReference', 'calibrationReference'])
      || !ref(s.observationReference, 'batting_observation_v1_observations') || !ref(s.completionReference, 'pa_take_successor_v1_action_plans')
      || !ref(s.postureReference, 'batting_observation_v1_postures') || !ref(s.calibrationReference, 'pa_continuation_v1_execution_calibrations')) return fail();
  } else return fail();
  return freeze(s);
};
