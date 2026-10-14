import { samePaContinuationCalibrationInput, type AcceptedSamePaContinuationCalibration, type SamePaContinuationCalibration } from './SamePlateAppearanceContinuationCalibrationSource';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { PlayerWorkloadActivity, PlayerWorkloadRecoveryState } from '../../core/world/development/PlayerWorkloadRecovery';
import type { PitchPlateCrossing } from '../../core/sim/pitching/PitchTrajectory';
import type { CanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaText as text, samePaReferenceValid as ref, samePaParticipantValid,
  type SamePaReference, type SamePaParticipantReference, type SamePaExecutionLineage } from './SamePlateAppearanceWorkPrefix';
export const samePaContinuationInvocationOwners = Object.freeze(['batting_observation_v1_observations', 'batting_observation_v1_deliveries', 'batting_prediction_v1_predictions', 'batting_emotion_execution_v1_executions', 'batting_execution_v1_executions'] as const);
export type SamePaContinuationInvocationReference = SamePaReference<typeof samePaContinuationInvocationOwners[number]>;
type Base = Readonly<{ sourceId: string; sourceVersion: string; enrollmentReference: SamePaReference<'same_pa_enrollments'> }>;
export type AcceptedSamePaNonemptyPrefix = Base & Readonly<{ capability: 'same_pa_completed_take_prefix_v1';
  originalViewReference: SamePaReference<'reserved_pa_execution_views'>; pitchReference: SamePaReference<'pa_dispatch_v1_pitch_actions'>; operationReferences: readonly SamePaContinuationInvocationReference[] }>;
export type AcceptedSamePaContinuationTotal = Base & Readonly<{ capability: 'same_pa_nonempty_cumulative_total_v1';
  prefixReference: SamePaReference<'pa_continuation_v1_work_prefixes'>; participantReference: SamePaParticipantReference; effortUnits: number;
  provenance: Readonly<{ assessmentSourceId: string; assessmentVersion: string; calibrationSourceId: string; calibrationVersion: string }> }>;
export type SamePaContinuationTotalReference = Readonly<{ playerId: string; assessmentReference: SamePaReference<'pa_continuation_v1_total_assessments'> }>;
export type AcceptedSamePaContinuationView = Base & Readonly<{ capability: 'same_pa_nonempty_cumulative_view_v1';
  prefixReference: SamePaReference<'pa_continuation_v1_work_prefixes'>; participantTotalReferences: readonly SamePaContinuationTotalReference[] }>;
export type SamePaCompletedTakeCut = Readonly<{ kind: 'completed_take_plate_crossing_v1';
  pitchReference: SamePaReference<'pa_dispatch_v1_pitch_actions'>; originTick: number; ticksPerSecond: number;
  crossing: PitchPlateCrossing; trajectoryHash: string; timelineHash: string }>;
export type SamePaNonemptyPrefix = Readonly<{ kind: 'nonempty_prefix'; source: AcceptedSamePaNonemptyPrefix; lineage: SamePaExecutionLineage;
  physicalRevision: 1; evaluationTick: number; operationReferences: readonly SamePaContinuationInvocationReference[]; previousViewReference: SamePaReference<'reserved_pa_execution_views' | 'pa_continuation_v1_execution_views'>; endpoint: SamePaCompletedTakeCut; consumerReferences: readonly SamePaReference<'pa_dispatch_v1_consumer_actions'>[];
  consumptionReference: SamePaReference<'pa_dispatch_v1_consumptions'>; admissionReference: SamePaReference<'pa_dispatch_v1_episode_admissions'>;
  timeline: CanonicalPlateAppearanceTimeline; coverageHash: string }>;
export type SamePaContinuationTotal = Readonly<{ kind: 'nonempty_cumulative_total'; source: AcceptedSamePaContinuationTotal;
  lineage: SamePaExecutionLineage; coverageHash: string; effortUnits: number }>;
export type SamePaContinuationView = Readonly<{ kind: 'nonempty_basis_prepared'; source: AcceptedSamePaContinuationView; lineage: SamePaExecutionLineage;
  coverageHash: string; assessmentSetHash: string; evaluationTick: number; physicalCut: SamePaCompletedTakeCut;
  participants: readonly Readonly<{ playerId: string; totalReference: SamePaReference<'pa_continuation_v1_total_assessments'>;
    reservedState: PlayerWorkloadRecoveryState; activity: PlayerWorkloadActivity; projectedState: PlayerWorkloadRecoveryState; projectedStateHash: string }>[] }>;
export type SamePaContinuationRecord = SamePaNonemptyPrefix | SamePaContinuationTotal | SamePaContinuationView | SamePaContinuationCalibration;
export type SamePaContinuationSource = AcceptedSamePaNonemptyPrefix | AcceptedSamePaContinuationTotal | AcceptedSamePaContinuationView | AcceptedSamePaContinuationCalibration;
const base = (s: Base, extra: readonly string[]) => fields(s, ['sourceId', 'sourceVersion', 'capability', 'enrollmentReference', ...extra])
  && text(s.sourceId) && text(s.sourceVersion) && ref(s.enrollmentReference, 'same_pa_enrollments');
export const samePaContinuationSourceInput = (raw: unknown, id?: string): SamePaContinuationSource => {
  const s = cloneInert(raw) as SamePaContinuationSource; let valid = false;
  if (s?.capability === 'same_pa_nonempty_execution_calibration_v1') return samePaContinuationCalibrationInput(s, id);
  if (!s || id !== undefined && s.sourceId !== id) throw new Error('invalid same-PA continuation Source identity');
  if (s.capability === 'same_pa_completed_take_prefix_v1') valid = base(s, ['originalViewReference', 'pitchReference', 'operationReferences'])
    && ref(s.originalViewReference, 'reserved_pa_execution_views') && ref(s.pitchReference, 'pa_dispatch_v1_pitch_actions')
    && Array.isArray(s.operationReferences) && s.operationReferences.every(r => samePaContinuationInvocationOwners.some(owner => ref(r, owner)))
    && new Set(s.operationReferences.map(r => r.owner + ':' + r.sourceId)).size === s.operationReferences.length;
  else if (s.capability === 'same_pa_nonempty_cumulative_total_v1') valid = base(s, ['prefixReference', 'participantReference', 'effortUnits', 'provenance'])
    && ref(s.prefixReference, 'pa_continuation_v1_work_prefixes') && samePaParticipantValid(s.participantReference)
    && Number.isFinite(s.effortUnits) && s.effortUnits >= 0
    && fields(s.provenance, ['assessmentSourceId', 'assessmentVersion', 'calibrationSourceId', 'calibrationVersion']) && Object.values(s.provenance).every(text);
  else if (s.capability === 'same_pa_nonempty_cumulative_view_v1') valid = base(s, ['prefixReference', 'participantTotalReferences'])
    && ref(s.prefixReference, 'pa_continuation_v1_work_prefixes') && Array.isArray(s.participantTotalReferences)
    && s.participantTotalReferences.length >= 10 && s.participantTotalReferences.length <= 13 && new Set(s.participantTotalReferences.map(p => p.playerId)).size === s.participantTotalReferences.length
    && new Set(s.participantTotalReferences.map(p => p.assessmentReference?.sourceId)).size === s.participantTotalReferences.length
    && s.participantTotalReferences.every(p => fields(p, ['playerId', 'assessmentReference']) && text(p.playerId) && ref(p.assessmentReference, 'pa_continuation_v1_total_assessments'));
  if (!valid) throw new Error('invalid same-PA continuation Source'); return freeze(s);
};
export const samePaContinuationTables = Object.freeze({ prefix: 'pa_continuation_v1_work_prefixes', total: 'pa_continuation_v1_total_assessments', view: 'pa_continuation_v1_execution_views', calibration: 'pa_continuation_v1_execution_calibrations' } as const);
export type SamePaContinuationKind = keyof typeof samePaContinuationTables;
export const samePaContinuationKind = (s: SamePaContinuationSource): SamePaContinuationKind => s.capability === 'same_pa_completed_take_prefix_v1' ? 'prefix'
  : s.capability === 'same_pa_nonempty_cumulative_total_v1' ? 'total' : s.capability === 'same_pa_nonempty_execution_calibration_v1' ? 'calibration' : 'view';
