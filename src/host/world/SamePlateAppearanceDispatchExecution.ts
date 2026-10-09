import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { PitchTimingProfile } from '../../core/sim/pitch/PitchTimingModel';
import type { PlayerWorkloadRecoveryState } from '../../core/world/development/PlayerWorkloadRecovery';
import type { resolveCanonicalPitchDelivery } from '../../core/sim/pitch/CanonicalPitchDelivery';
import type { createPitchTrajectoryFromRelease } from '../../core/sim/pitch/CanonicalPitchRelease';
import type { createCanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import type { resolveAndRecordPitchAgainstBatter } from '../../core/sim/pitching/PitchAgainstBatter';
import { actorHash as hash, actorJson as json, actorFreeze as freeze, type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaText, samePaHash, samePaReferenceValid as ref, type SamePaReference, type SamePaExecutionLineage } from './SamePlateAppearanceWorkPrefix';
import { samePaDispatchMemberValid, type SamePaDispatchMember } from './SamePlateAppearanceDispatchRoles';
import type { AcceptedSamePaPhysicalPitch, SamePaPhysicalSourceReference, SamePaDerivedConsumption, SamePaDerivedEpisodeAdmission,
  SamePaTimingReference, SamePaReleaseReference } from './SamePlateAppearanceDispatchSource';
import type { PlayerReleaseGeometrySnapshot } from './SqlitePlayerReleaseGeometryStore';
import type { AcceptedPitchFatiguePolicy } from './SqlitePitchFatiguePolicyStore';
import type { DurablePlayerBattingModelV1 } from './PlayerBattingModel';
export type SamePaNativePitchCalculation = Readonly<{
  kind: 'native_calculation_only'; route: 'pitch_delivery'; operation: Readonly<{ route: 'pitch_delivery';
    actionReference: SamePaReference<'pa_dispatch_v1_action_plans'>; calibrationReference: SamePaReference<'pa_dispatch_v1_execution_calibrations'> }>;
  frame: Readonly<{ kind: 'reserved_same_pa_pitch_frame_v1'; actorReference: SamePaReference<'physical_plate_appearance_actors'>;
    viewReference: SamePaReference<'reserved_pa_execution_views'>; member: SamePaDispatchMember; binding: DurablePhysicalPlateAppearanceActor['binding'];
    person: DurablePhysicalPlateAppearanceActor['person']; reservedActualState: PlayerWorkloadRecoveryState; projectedExecutionState: PlayerWorkloadRecoveryState;
    nominalTiming: PitchTimingProfile; nominalRelease: PlayerReleaseGeometrySnapshot; nominalBattingModel: DurablePlayerBattingModelV1; acceptedPitchResponse: AcceptedPitchFatiguePolicy }>;
  beforeTimeline: ReturnType<typeof createCanonicalPlateAppearanceTimeline>;
  calculation: Readonly<{ delivery: ReturnType<typeof resolveCanonicalPitchDelivery>; trajectory: ReturnType<typeof createPitchTrajectoryFromRelease>;
    resolution: Extract<ReturnType<typeof resolveAndRecordPitchAgainstBatter>, { kind: 'recorded' }> }>;
}>;
export type SamePaPitchConsumerSource = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'same_pa_consumer_action_v1'; rightReference: SamePaReference<'pa_dispatch_v1_rights'>;
  physicalSourceReference: SamePaPhysicalSourceReference; member: SamePaDispatchMember; route: 'pitch_delivery';
  calibrationReferences: readonly [Readonly<{ route: 'pitch_delivery'; calibrationReference: SamePaReference<'pa_dispatch_v1_execution_calibrations'> }>];
  originalInputReferences: Readonly<{ actionReference: SamePaReference<'pa_dispatch_v1_action_plans'>; timingReference: SamePaTimingReference;
    releaseReference: SamePaReleaseReference; pitchResponseReference: SamePaReference<'world_pitch_fatigue_policies'>;
    batterModelReference: SamePaReference<'world_player_batting_models'> }>;
  actionOrdinal: 0; operation: Readonly<{ kind: 'reserved_same_pa_pitch_delivery_v1' }>;
}>;
export const samePaPhysicalSourceReference = (s: AcceptedSamePaPhysicalPitch): SamePaPhysicalSourceReference =>
  freeze({ sourceId: s.sourceId, sourceVersion: s.sourceVersion, sourceHash: hash(s) });
export const samePaDispatchDerivedId = (source: SamePaPhysicalSourceReference, role: 'pitch_delivery' | 'consumption' | 'episode_admission') =>
  'pa-dispatch-v1:' + role + ':' + hash([source.sourceId, source.sourceVersion, source.sourceHash]);
/** Exact code-derived pitch-consumer Source domain. No owner proof is accepted. */
export const samePaPitchConsumerSourceInput = (raw: unknown): SamePaPitchConsumerSource => {
  const s = cloneInert(raw) as SamePaPitchConsumerSource;
  if (!fields(s, ['sourceId', 'sourceVersion', 'capability', 'rightReference', 'physicalSourceReference', 'member', 'route', 'calibrationReferences', 'originalInputReferences', 'actionOrdinal', 'operation'])
    || !samePaText(s.sourceId) || !samePaText(s.sourceVersion) || s.capability !== 'same_pa_consumer_action_v1' || s.route !== 'pitch_delivery'
    || !ref(s.rightReference, 'pa_dispatch_v1_rights') || !samePaDispatchMemberValid(s.member) || s.actionOrdinal !== 0
    || !fields(s.physicalSourceReference, ['sourceId', 'sourceVersion', 'sourceHash']) || !samePaText(s.physicalSourceReference.sourceId)
    || !samePaText(s.physicalSourceReference.sourceVersion) || !samePaHash(s.physicalSourceReference.sourceHash)
    || s.sourceId !== samePaDispatchDerivedId(s.physicalSourceReference, 'pitch_delivery')
    || !Array.isArray(s.calibrationReferences) || s.calibrationReferences.length !== 1 || !fields(s.calibrationReferences[0], ['route', 'calibrationReference'])
    || s.calibrationReferences[0].route !== 'pitch_delivery' || !ref(s.calibrationReferences[0].calibrationReference, 'pa_dispatch_v1_execution_calibrations')
    || !fields(s.originalInputReferences, ['actionReference', 'timingReference', 'releaseReference', 'pitchResponseReference', 'batterModelReference'])
    || !ref(s.originalInputReferences.actionReference, 'pa_dispatch_v1_action_plans')
    || !(ref(s.originalInputReferences.timingReference, 'world_pitch_timing_baselines') || ref(s.originalInputReferences.timingReference, 'world_pitch_timing_updates'))
    || !(ref(s.originalInputReferences.releaseReference, 'world_player_release_baselines') || ref(s.originalInputReferences.releaseReference, 'world_player_release_changes'))
    || !ref(s.originalInputReferences.pitchResponseReference, 'world_pitch_fatigue_policies') || !ref(s.originalInputReferences.batterModelReference, 'world_player_batting_models')
    || !fields(s.operation, ['kind']) || s.operation.kind !== 'reserved_same_pa_pitch_delivery_v1') throw new Error('invalid same-PA pitch consumer Source');
  return freeze(s);
};
type RecordBase<S> = Readonly<{ source: S; lineage: SamePaExecutionLineage; viewReference: SamePaReference<'reserved_pa_execution_views'> }>;
export type SamePaPitchConsumerRecord = RecordBase<SamePaPitchConsumerSource> & Readonly<{ kind: 'same_pa_pitch_delivery_invocation_v1';
  nominalInputHash: string; effectiveResponseHash: string; frame: SamePaNativePitchCalculation['frame'];
  beforeTimeline: SamePaNativePitchCalculation['beforeTimeline']; calculation: SamePaNativePitchCalculation['calculation'] }>;
export type SamePaExecutedPitch = RecordBase<AcceptedSamePaPhysicalPitch> & Readonly<{ kind: 'same_pa_first_pitch_executed_v1'; progressRevision: 1;
  episodeReference: SamePaReference<'pa_dispatch_v1_episodes'>; originalActor: DurablePhysicalPlateAppearanceActor;
  frame: SamePaNativePitchCalculation['frame']; beforeTimeline: SamePaNativePitchCalculation['beforeTimeline'];
  result: SamePaNativePitchCalculation['calculation']; consumerReferences: readonly SamePaReference<'pa_dispatch_v1_consumer_actions'>[] }>;
export type SamePaConsumptionRecord = RecordBase<SamePaDerivedConsumption> & Readonly<{ kind: 'same_pa_consumed_v1';
  pitchReference: SamePaReference<'pa_dispatch_v1_pitch_actions'>; consumerReferences: readonly SamePaReference<'pa_dispatch_v1_consumer_actions'>[] }>;
export type SamePaEpisodeAdmissionRecord = RecordBase<SamePaDerivedEpisodeAdmission> & Readonly<{ kind: 'same_pa_episode_admitted_v1';
  pitchReference: SamePaReference<'pa_dispatch_v1_pitch_actions'>; consumerReferences: readonly SamePaReference<'pa_dispatch_v1_consumer_actions'>[] }>;
export type SamePaExecutionRecord = SamePaPitchConsumerRecord | SamePaExecutedPitch | SamePaConsumptionRecord | SamePaEpisodeAdmissionRecord;
export const dispatchExecutionTables = Object.freeze({ invocation: 'pa_dispatch_v1_consumer_actions', pitch: 'pa_dispatch_v1_pitch_actions',
  consumption: 'pa_dispatch_v1_consumptions', admission: 'pa_dispatch_v1_episode_admissions' } as const);
export const dispatchExecutionRow = (value: SamePaExecutionRecord): Record<string, string | number> => {
  const l = value.lineage, s = value.source;
  const extra: Record<string, string | number> = value.kind === 'same_pa_pitch_delivery_invocation_v1' ? { right_source_id: value.source.rightReference.sourceId,
    physical_source_id: value.source.physicalSourceReference.sourceId, player_id: value.source.member.playerId, route: value.source.route, action_ordinal: value.source.actionOrdinal }
    : value.kind === 'same_pa_first_pitch_executed_v1' ? { right_source_id: value.source.rightReference.sourceId, episode_source_id: value.episodeReference.sourceId, progress_revision: 1 }
      : value.kind === 'same_pa_consumed_v1' ? { right_source_id: value.source.rightReference.sourceId, pitch_source_id: value.pitchReference.sourceId }
        : { episode_source_id: value.source.episodeReference.sourceId, pitch_source_id: value.pitchReference.sourceId };
  return { source_id: s.sourceId, source_version: s.sourceVersion, career_id: l.careerId, game_id: l.gameId, play_id: l.playId,
    enrollment_source_id: l.enrollmentReference.sourceId, first_pitch_source_id: l.firstPhysicalPitchSourceId, view_source_id: value.viewReference.sourceId,
    ...extra, source_json: json(s), source_hash: hash(s), snapshot_json: json(value), snapshot_hash: hash(value) };
};
export const dispatchPitchHead = (pitch: SamePaExecutedPitch): Record<string, string | number> => ({
  enrollment_source_id: pitch.lineage.enrollmentReference.sourceId, career_id: pitch.lineage.careerId, game_id: pitch.lineage.gameId,
  play_id: pitch.lineage.playId, first_pitch_source_id: pitch.source.sourceId, progress_revision: 1, last_source_id: pitch.source.sourceId, snapshot_hash: hash(pitch),
});
