import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { SamePaExecutionLineage, SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { SamePaDispatchRole, SamePaDispatchRoleBinding, SamePaDispatchPrerequisite } from './SamePlateAppearanceDispatchRoles';
import type { AcceptedSamePaFirstPitchAction, AcceptedSamePaExecutionCalibration, AcceptedSamePaConsumerSet, AcceptedSamePaFirstPitchEpisode, AcceptedSamePaFirstPitchRight } from './SamePlateAppearanceDispatchSource';
type Base<S> = Readonly<{ source: S; lineage: SamePaExecutionLineage }>;
export type SamePaPreparedAction = Base<AcceptedSamePaFirstPitchAction> & Readonly<{ kind: 'action_prepared'; roles: readonly SamePaDispatchRoleBinding[];
  timingProfileHash: string; releaseGeometryHash: string; bodyMaterializationHash: string; equipmentHash: string }>;
export type SamePaPreparedCalibration = Base<AcceptedSamePaExecutionCalibration> & Readonly<{ kind: 'execution_calibration_prepared'; role: SamePaDispatchRole; nominalInputHash: string; effectiveResponseHash: string }>;
export type SamePaPreparedConsumers = Base<AcceptedSamePaConsumerSet> & Readonly<{ kind: 'consumer_set_prepared'; roles: readonly SamePaDispatchRoleBinding[] }>;
export type SamePaPreparedEpisode = Base<AcceptedSamePaFirstPitchEpisode> & Readonly<{ kind: 'prospective_episode_prepared'; roles: readonly SamePaDispatchRoleBinding[] }>;
export type SamePaPreparedRight = Base<AcceptedSamePaFirstPitchRight> & Readonly<{ kind: 'immutable_right_prepared'; expectedProgressRevision: 0; roles: readonly SamePaDispatchRoleBinding[] }>;
export type SamePaDispatchRecord = SamePaPreparedAction | SamePaPreparedCalibration | SamePaPreparedConsumers | SamePaPreparedEpisode | SamePaPreparedRight;
export type SamePaDispatchPending = Readonly<{ kind: 'pending'; missingAcceptedSourceIds: readonly string[]; prerequisites: readonly (SamePaDispatchPrerequisite | Readonly<{
  playerId: string; route: SamePaDispatchPrerequisite['route']; reason: 'missing_accepted_calibration' | 'missing_action_plan' }>)[] }>;
export type SamePaCalibrationSet = Readonly<{ kind: 'execution_calibration_set'; calibrations: readonly SamePaPreparedCalibration[];
  calibrationReferences: readonly SamePaReference<'pa_dispatch_v1_execution_calibrations'>[] }>;
export const dispatchTables = Object.freeze({ action: 'pa_dispatch_v1_action_plans', calibration: 'pa_dispatch_v1_execution_calibrations',
  consumer: 'pa_dispatch_v1_consumer_sets', episode: 'pa_dispatch_v1_episodes', right: 'pa_dispatch_v1_rights' } as const);
export type DispatchKind = keyof typeof dispatchTables;
export const dispatchCapabilities = Object.freeze({ action: 'same_pa_first_pitch_action_v1', calibration: 'same_pa_execution_calibration_v1',
  consumer: 'same_pa_consumer_set_v1', episode: 'same_pa_first_pitch_episode_v1', right: 'same_pa_first_pitch_right_v1' } as const);
export const dispatchRow = (value: SamePaDispatchRecord): Record<string, string | number> => {
  const s = value.source, l = value.lineage;
  const extra: Record<string, string | number> = s.capability === 'same_pa_execution_calibration_v1' ? { player_id: s.member.playerId, route: s.route, nominal_parameter_identity: json(s.nominalParameterReference ?? s.nominalReference) }
    : s.capability === 'same_pa_first_pitch_right_v1' ? { episode_source_id: s.episodeReference.sourceId } : {};
  return { source_id: s.sourceId, source_version: s.sourceVersion, career_id: l.careerId, game_id: l.gameId, play_id: l.playId,
    enrollment_source_id: s.enrollmentReference.sourceId, first_pitch_source_id: s.firstPhysicalPitchSourceId, view_source_id: s.viewReference.sourceId,
    ...extra, source_json: json(s), source_hash: hash(s), snapshot_json: json(value), snapshot_hash: hash(value) };
};
