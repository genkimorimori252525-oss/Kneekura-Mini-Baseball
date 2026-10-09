import { inFlightBattingCutReferenceValid, type InFlightBattingCutReference } from './NativeInFlightBattingPerception';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { BattingExecutionRequest } from '../../core/world/psychology/batting/BattingTypes';
import type { BattingExecutionValues, BattingExecutionCalculation } from '../../core/world/psychology/batting/BattingCommitment';
import { originalBattingIntentInput, type AcceptedOriginalBattingIntent } from './OriginalBattingIntent';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaText as text, samePaReferenceValid as ref, samePaHash, type SamePaReference, type SamePaExecutionLineage } from './SamePlateAppearanceWorkPrefix';
import { samePaDispatchMemberValid, type SamePaDispatchMember } from './SamePlateAppearanceDispatchRoles';
import type { SamePaCurrentExecutionViewReference } from './SamePlateAppearanceInvocationView';
import type { AcceptedBattingEmotionExecution } from './NativeBattingEmotionExecution';
export type AcceptedSamePaBattingIntent = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'owned_same_pa_batting_intent_v1';
  viewReference: SamePaReference<'reserved_pa_execution_views'>; member: SamePaDispatchMember;
  postureReference: SamePaReference<'batting_observation_v1_postures'>; actorReference: SamePaReference<'physical_plate_appearance_actors'>;
  attempt: AcceptedOriginalBattingIntent['attempt'];
}>;
export const battingExecutionRoutes = Object.freeze(['batter_decision', 'batter_motor', 'batter_swing'] as const);
export type BattingExecutionRoute = typeof battingExecutionRoutes[number];
export type AcceptedSamePaBattingExecutionInput = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'owned_same_pa_batting_execution_input_v1';
  viewReference: SamePaCurrentExecutionViewReference; member: SamePaDispatchMember;
  postureReference: SamePaReference<'batting_observation_v1_postures'>;
  emotionReference: SamePaReference<'batting_emotion_execution_v1_executions'>;
  intentReference: SamePaReference<'batting_execution_v1_intents'> | null;
  assessmentReferences: readonly SamePaReference<'batting_score_v1_assessments'>[];
  calibrationReferences: readonly Readonly<{ route: BattingExecutionRoute; calibrationReference: SamePaReference<'pa_continuation_v1_execution_calibrations'> }>[];
  directive: 'AUTO' | 'TAKE' | 'SWING'; expectedWorld: AcceptedBattingEmotionExecution['expectedWorld'];
}>;
export type AcceptedInFlightSamePaBattingIntent = Omit<AcceptedSamePaBattingIntent, 'capability' | 'viewReference'> & Readonly<{
  capability: 'owned_in_flight_same_pa_batting_intent_v1'; viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>;
}>;
export type AcceptedInFlightSamePaBattingExecutionInput = Omit<AcceptedSamePaBattingExecutionInput, 'capability' | 'viewReference' | 'calibrationReferences' | 'intentReference'> & Readonly<{
  capability: 'owned_in_flight_same_pa_batting_execution_input_v1'; viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>;
  physicalPitchReference: SamePaReference<'pa_physical_v1_launches'>; physicalOperationReference: InFlightBattingCutReference;
  intentReference: SamePaReference<'batting_execution_v1_intents'>;
  calibrationReferences: readonly Readonly<{ route: BattingExecutionRoute; calibrationReference: SamePaReference<'pa_lifecycle_v1_execution_calibrations'> }>[];
}>;
export type AcceptedSamePaBattingInvocation = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'owned_same_pa_batting_calculation_v1';
  viewReference: SamePaCurrentExecutionViewReference; member: SamePaDispatchMember;
  inputReference: SamePaReference<'batting_execution_v1_inputs'>;
}>;
type Scope = Readonly<{ lineage: SamePaExecutionLineage; physicalPitchSourceId: string }>;
export type DurableSamePaBattingIntent = Scope & Readonly<{ kind: 'same_pa_batting_intent'; source: AcceptedSamePaBattingIntent | AcceptedInFlightSamePaBattingIntent; originalIntent: AcceptedOriginalBattingIntent }>;
export type DurableSamePaBattingExecutionInput = Scope & Readonly<{ kind: 'same_pa_batting_input'; source: AcceptedSamePaBattingExecutionInput | AcceptedInFlightSamePaBattingExecutionInput;
  physicalPitchReference: SamePaReference<'pa_dispatch_v1_pitch_actions' | 'pa_physical_v1_launches'>; nominalRequest: BattingExecutionRequest; effectiveValues: BattingExecutionValues }>;
export type DurableSamePaBattingInvocation = Scope & Readonly<{ kind: 'same_pa_batting_calculation'; source: AcceptedSamePaBattingInvocation;
  physicalPitchReference: SamePaReference<'pa_dispatch_v1_pitch_actions'>; calculation: BattingExecutionCalculation;
  invokedRoutes: readonly BattingExecutionRoute[]; motionIssued: false;
  physicalEffect: 'none';
  physicalAdmission: 'completed_take_requires_forward_physical_right' }>;
export type BattingExecutionInputSource = AcceptedSamePaBattingIntent | AcceptedSamePaBattingExecutionInput | AcceptedSamePaBattingInvocation | AcceptedInFlightSamePaBattingIntent | AcceptedInFlightSamePaBattingExecutionInput;
export type BattingExecutionInputRecord = DurableSamePaBattingIntent | DurableSamePaBattingExecutionInput | DurableSamePaBattingInvocation;
const fail = (): never => { throw new Error('invalid original batting intent, execution input or invocation Source'); };
export const battingExecutionInputSource = (raw: unknown, id?: string): BattingExecutionInputSource => {
  const s = cloneInert(raw) as BattingExecutionInputSource;
  if (!s || !text(s.sourceId) || !text(s.sourceVersion) || id !== undefined && s.sourceId !== id || !samePaDispatchMemberValid(s.member)) return fail();
  const base = ['sourceId', 'sourceVersion', 'capability', 'viewReference', 'member'];
  if (s.capability === 'owned_same_pa_batting_intent_v1' || s.capability === 'owned_in_flight_same_pa_batting_intent_v1') {
    const inFlight = s.capability === 'owned_in_flight_same_pa_batting_intent_v1';
    if (!fields(s, [...base, 'postureReference', 'actorReference', 'attempt']) || !ref(s.viewReference, inFlight ? 'pa_lifecycle_v1_execution_views' : 'reserved_pa_execution_views')
      || !ref(s.postureReference, 'batting_observation_v1_postures') || !ref(s.actorReference, 'physical_plate_appearance_actors')) return fail();
    originalBattingIntentInput({ version: 'original_batting_intent_v1', actorSourceId: s.actorReference.sourceId, attempt: s.attempt });
  } else if (s.capability === 'owned_same_pa_batting_execution_input_v1' || s.capability === 'owned_in_flight_same_pa_batting_execution_input_v1') {
    const inFlight = s.capability === 'owned_in_flight_same_pa_batting_execution_input_v1';
    if (!fields(s, [...base, 'postureReference', 'emotionReference', 'intentReference', 'assessmentReferences', 'calibrationReferences', 'directive', 'expectedWorld', ...(inFlight ? ['physicalPitchReference', 'physicalOperationReference'] : [])])
      || !ref(s.viewReference, inFlight ? 'pa_lifecycle_v1_execution_views' : 'pa_continuation_v1_execution_views')
      || inFlight && (!ref(s.physicalPitchReference, 'pa_physical_v1_launches') || !inFlightBattingCutReferenceValid(s.physicalOperationReference) || !ref(s.intentReference, 'batting_execution_v1_intents')) || !ref(s.postureReference, 'batting_observation_v1_postures')
      || !ref(s.emotionReference, 'batting_emotion_execution_v1_executions') || s.intentReference !== null && !ref(s.intentReference, 'batting_execution_v1_intents')
      || !['AUTO', 'TAKE', 'SWING'].includes(s.directive) || s.directive !== 'TAKE' && s.intentReference === null
      || !Array.isArray(s.assessmentReferences) || s.assessmentReferences.length > 64 || s.assessmentReferences.some(r => !ref(r, 'batting_score_v1_assessments'))
      || new Set(s.assessmentReferences.map(r => r.sourceId)).size !== s.assessmentReferences.length
      || !Array.isArray(s.calibrationReferences) || s.calibrationReferences.length !== 3 || s.calibrationReferences.some((r, i) => !fields(r, ['route', 'calibrationReference'])
        || r.route !== battingExecutionRoutes[i] || !ref(r.calibrationReference, inFlight ? 'pa_lifecycle_v1_execution_calibrations' : 'pa_continuation_v1_execution_calibrations'))
      || new Set(s.calibrationReferences.map(r => r.calibrationReference.sourceId)).size !== 3
      || !fields(s.expectedWorld, ['careerId', 'worldRevision', 'controlRevision', 'controlHash']) || !text(s.expectedWorld.careerId)
      || !Number.isSafeInteger(s.expectedWorld.worldRevision) || s.expectedWorld.worldRevision < 0 || !Number.isSafeInteger(s.expectedWorld.controlRevision)
      || s.expectedWorld.controlRevision < 0 || !samePaHash(s.expectedWorld.controlHash)) return fail();
  } else if (s.capability === 'owned_same_pa_batting_calculation_v1') {
    if (!fields(s, [...base, 'inputReference']) || !ref(s.viewReference, 'pa_continuation_v1_execution_views') || !ref(s.inputReference, 'batting_execution_v1_inputs')) return fail();
  } else return fail();
  return freeze(s);
};
