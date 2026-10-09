import { samePaLifecycleCalibrationInput, type AcceptedSamePaLifecycleCalibration, type SamePaLifecycleCalibration } from './SamePlateAppearanceLifecycleCalibrationSource';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import type { CanonicalWorldSnapshot } from '../../core/model/CanonicalWorldSnapshot';
import type { CanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import type { PlayerWorkloadActivity, PlayerWorkloadRecoveryState } from '../../core/world/development/PlayerWorkloadRecovery';
import { actorFreeze as freeze, type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaText as text, samePaReferenceValid as ref, samePaParticipantValid,
  type SamePaReference, type SamePaParticipantReference, type SamePaExecutionLineage } from './SamePlateAppearanceWorkPrefix';
import type { SamePaDispatchMember } from './SamePlateAppearanceDispatchRoles';

export const samePaLifecycleWorkOwners = Object.freeze(['pa_take_successor_v1_pitch_actions', 'pa_physical_v1_launches', 'pa_physical_v1_cuts',
  'pa_physical_v1_commitments', 'pa_physical_v1_resolutions', 'pa_physical_v1_field_roots', 'pa_physical_v1_field_steps',
  'batting_observation_v1_observations', 'batting_observation_v1_deliveries', 'batting_prediction_v1_predictions',
  'batting_emotion_execution_v1_executions', 'batting_execution_v1_executions', 'pa_catch_v1_work', 'world_batter_run_plans', 'pa_lifecycle_v1_outcomes', 'pa_lifecycle_v1_resets'] as const);
export type SamePaLifecycleWorkReference = SamePaReference<typeof samePaLifecycleWorkOwners[number]>;
export type SamePaLifecycleViewReference = SamePaReference<'pa_lifecycle_v1_execution_views'>;
export type SamePaLifecyclePitchReference = SamePaReference<'pa_dispatch_v1_pitch_actions' | 'pa_take_successor_v1_pitch_actions' | 'pa_physical_v1_launches'>;
export type SamePaLifecycleBodyCut = Readonly<{
  kind: 'same_pa_starting_body_cut_v1'; origin: 'retained_take' | 'foul_reset';
  worldReference: SamePaReference<'physical_plate_appearance_actors' | 'pa_lifecycle_v1_resets'>;
  originalWorld: CanonicalWorldSnapshot; originalWorldHash: string; completedAtTick: number;
}>;
export type SamePaLifecycleCut = Readonly<{
  stage: 'retained_take' | 'in_flight' | 'resolved' | 'field_active' | 'foul_official_pending' | 'foul_reset_ready' | 'terminal';
  physicalPitchReference: SamePaLifecyclePitchReference; operationReference: SamePaLifecycleWorkReference;
  physicalOperationReference: SamePaReference<'pa_take_successor_v1_pitch_actions' | 'pa_physical_v1_launches' | 'pa_physical_v1_cuts' | 'pa_physical_v1_commitments' | 'pa_physical_v1_resolutions' | 'pa_physical_v1_field_roots' | 'pa_physical_v1_field_steps'>;
  pitchOrdinal: number; evaluationTick: number; timeline: CanonicalPlateAppearanceTimeline;
  physicalWorld: CanonicalWorldSnapshot; bodyCut: SamePaLifecycleBodyCut;
  outcomeReference: SamePaReference<'pa_lifecycle_v1_outcomes'> | null;
  resetReference: SamePaReference<'pa_lifecycle_v1_resets'> | null;
}>;
type Base = Readonly<{ sourceId: string; sourceVersion: string; enrollmentReference: SamePaReference<'same_pa_enrollments'> }>;
export type AcceptedSamePaLifecyclePrefix = Base & Readonly<{
  capability: 'same_pa_lifecycle_prefix_v1'; anchorViewReference: SamePaReference<'pa_continuation_v1_execution_views'>;
  eventReferences: readonly SamePaLifecycleWorkReference[];
}>;
export type SamePaLifecyclePrefix = Readonly<{
  kind: 'same_pa_lifecycle_prefix'; source: AcceptedSamePaLifecyclePrefix; lineage: SamePaExecutionLineage;
  previousViewReference: SamePaReference<'pa_continuation_v1_execution_views' | 'pa_lifecycle_v1_execution_views'>;
  cut: SamePaLifecycleCut; coverageHash: string;
}>;
export type AcceptedSamePaLifecycleTotal = Base & Readonly<{
  capability: 'same_pa_lifecycle_cumulative_total_v1'; prefixReference: SamePaReference<'pa_lifecycle_v1_work_prefixes'>;
  participantReference: SamePaParticipantReference; effortUnits: number;
  provenance: Readonly<{ assessmentSourceId: string; assessmentVersion: string; calibrationSourceId: string; calibrationVersion: string }>;
}>;
export type SamePaLifecycleTotal = Readonly<{
  kind: 'same_pa_lifecycle_total'; source: AcceptedSamePaLifecycleTotal; lineage: SamePaExecutionLineage; coverageHash: string; effortUnits: number;
}>;
export type SamePaLifecycleTotalReference = Readonly<{ playerId: string; assessmentReference: SamePaReference<'pa_lifecycle_v1_total_assessments'> }>;
export type AcceptedSamePaLifecycleView = Base & Readonly<{
  capability: 'same_pa_lifecycle_cumulative_view_v1'; prefixReference: SamePaReference<'pa_lifecycle_v1_work_prefixes'>;
  participantTotalReferences: readonly SamePaLifecycleTotalReference[];
}>;
export type SamePaLifecycleView = Readonly<{
  kind: 'same_pa_lifecycle_view'; source: AcceptedSamePaLifecycleView; lineage: SamePaExecutionLineage;
  coverageHash: string; assessmentSetHash: string; cut: SamePaLifecycleCut;
  participants: readonly Readonly<{ playerId: string; totalReference: SamePaReference<'pa_lifecycle_v1_total_assessments'>;
    reservedState: PlayerWorkloadRecoveryState; activity: PlayerWorkloadActivity; projectedState: PlayerWorkloadRecoveryState; projectedStateHash: string }>[];
}>;
export type SamePaLifecycleViewBasis = Readonly<{ actor: DurablePhysicalPlateAppearanceActor; view: SamePaLifecycleView; members: readonly SamePaDispatchMember[] }>;
export type SamePaLifecycleNextPitchBasis = SamePaLifecycleViewBasis & Readonly<{
  kind: 'ready'; timeline: CanonicalPlateAppearanceTimeline; match: CanonicalMatchState; physicalWorld: CanonicalWorldSnapshot;
  baseCenters: import('../../core/adjudication/BetweenPlayWorldReset').BetweenPlayWorldSetup['baseCenters'];
  bodyCut: SamePaLifecycleBodyCut; nextPitchOrdinal: number; previousPitchReference: SamePaLifecyclePitchReference;
  outcomeReference: SamePaReference<'pa_lifecycle_v1_outcomes'> | null; resetReference: SamePaReference<'pa_lifecycle_v1_resets'> | null;
}>;
export type SamePaLifecycleSource = AcceptedSamePaLifecyclePrefix | AcceptedSamePaLifecycleTotal | AcceptedSamePaLifecycleView | AcceptedSamePaLifecycleCalibration;
export type SamePaLifecycleRecord = SamePaLifecyclePrefix | SamePaLifecycleTotal | SamePaLifecycleView | SamePaLifecycleCalibration;
export const samePaLifecycleTables = Object.freeze({ prefix: 'pa_lifecycle_v1_work_prefixes', total: 'pa_lifecycle_v1_total_assessments',
  view: 'pa_lifecycle_v1_execution_views', calibration: 'pa_lifecycle_v1_execution_calibrations', outcome: 'pa_lifecycle_v1_outcomes', reset: 'pa_lifecycle_v1_resets' } as const);
const base = (s: Base, extra: readonly string[]) => fields(s, ['sourceId', 'sourceVersion', 'capability', 'enrollmentReference', ...extra])
  && text(s.sourceId) && text(s.sourceVersion) && ref(s.enrollmentReference, 'same_pa_enrollments');
export const samePaLifecycleSourceInput = (raw: unknown, id?: string): SamePaLifecycleSource => {
  const s = cloneInert(raw) as SamePaLifecycleSource;
  if (!s || id !== undefined && s.sourceId !== id) throw new Error('invalid same-PA lifecycle Source identity');
  if (s.capability === 'same_pa_lifecycle_execution_calibration_v1') return samePaLifecycleCalibrationInput(s, id);
  let valid = false;
  if (s.capability === 'same_pa_lifecycle_prefix_v1') valid = base(s, ['anchorViewReference', 'eventReferences'])
    && ref(s.anchorViewReference, 'pa_continuation_v1_execution_views') && Array.isArray(s.eventReferences) && s.eventReferences.length > 0
    && s.eventReferences.every(r => samePaLifecycleWorkOwners.some(owner => ref(r, owner)))
    && new Set(s.eventReferences.map(r => r.owner + ':' + r.sourceId)).size === s.eventReferences.length;
  else if (s.capability === 'same_pa_lifecycle_cumulative_total_v1') valid = base(s, ['prefixReference', 'participantReference', 'effortUnits', 'provenance'])
    && ref(s.prefixReference, 'pa_lifecycle_v1_work_prefixes') && samePaParticipantValid(s.participantReference)
    && Number.isFinite(s.effortUnits) && s.effortUnits >= 0 && fields(s.provenance, ['assessmentSourceId', 'assessmentVersion', 'calibrationSourceId', 'calibrationVersion'])
    && Object.values(s.provenance).every(text);
  else if (s.capability === 'same_pa_lifecycle_cumulative_view_v1') valid = base(s, ['prefixReference', 'participantTotalReferences'])
    && ref(s.prefixReference, 'pa_lifecycle_v1_work_prefixes') && Array.isArray(s.participantTotalReferences) && s.participantTotalReferences.length >= 10 && s.participantTotalReferences.length <= 13
    && new Set(s.participantTotalReferences.map(p => p.playerId)).size === s.participantTotalReferences.length
    && new Set(s.participantTotalReferences.map(p => p.assessmentReference?.sourceId)).size === s.participantTotalReferences.length
    && s.participantTotalReferences.every(p => fields(p, ['playerId', 'assessmentReference']) && text(p.playerId) && ref(p.assessmentReference, 'pa_lifecycle_v1_total_assessments'));
  if (!valid) throw new Error('invalid same-PA lifecycle Source'); return freeze(s);
};
