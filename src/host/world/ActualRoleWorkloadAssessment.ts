import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { PlayerWorkloadActivity } from '../../core/world/development/PlayerWorkloadRecovery';
import { actualLivePlayFields as fields, actualLivePlayId as id } from './ActualLivePlayScope';
import { actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
export type ActualRolePhysicalEndReference = Readonly<{ owner: 'actual_first_base_play_ends'; sourceId: string; sourceVersion: string; sourceHash: string; snapshotHash: string }>;
export type ActualRoleWholeHistoryReference = Readonly<{ hash: string; convention: 'owned_scheduled_whole_history_manifest_v1' }>;
/** Independently accepted TOTAL effort for this original participant's entire closed play.
 * No component weighting, automatic effort generation, fatigue or readiness is accepted here. */
export type AcceptedActualRoleWorkloadAssessment = Readonly<{
  sourceId: string; sourceVersion: string; closureSourceId: string;
  physicalEndReference: ActualRolePhysicalEndReference; wholeHistoryReference: ActualRoleWholeHistoryReference;
  participantReference: Readonly<{ playerId: string; bindingHash: string; personHash: string }>;
  effortUnits: number;
  provenance: Readonly<{ assessmentSourceId: string; assessmentVersion: string; calibrationSourceId: string; calibrationVersion: string }>;
}>;
const digest = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
export const actualRoleWorkloadAssessmentInput = (raw: AcceptedActualRoleWorkloadAssessment, sourceId: string): AcceptedActualRoleWorkloadAssessment => {
  const s = cloneInert(raw);
  if (!fields(s, ['sourceId', 'sourceVersion', 'closureSourceId', 'physicalEndReference', 'wholeHistoryReference', 'participantReference', 'effortUnits', 'provenance'])
    || s.sourceId !== sourceId || ![s.sourceId, s.sourceVersion, s.closureSourceId].every(id)
    || !fields(s.physicalEndReference, ['owner', 'sourceId', 'sourceVersion', 'sourceHash', 'snapshotHash'])
    || s.physicalEndReference.owner !== 'actual_first_base_play_ends' || !id(s.physicalEndReference.sourceId) || !id(s.physicalEndReference.sourceVersion)
    || !digest(s.physicalEndReference.sourceHash) || !digest(s.physicalEndReference.snapshotHash)
    || !fields(s.wholeHistoryReference, ['hash', 'convention']) || !digest(s.wholeHistoryReference.hash)
    || s.wholeHistoryReference.convention !== 'owned_scheduled_whole_history_manifest_v1'
    || !fields(s.participantReference, ['playerId', 'bindingHash', 'personHash']) || !id(s.participantReference.playerId)
    || !digest(s.participantReference.bindingHash) || !digest(s.participantReference.personHash)
    || typeof s.effortUnits !== 'number' || !Number.isFinite(s.effortUnits) || s.effortUnits < 0
    || !fields(s.provenance, ['assessmentSourceId', 'assessmentVersion', 'calibrationSourceId', 'calibrationVersion'])
    || !Object.values(s.provenance).every(id)) throw new Error('invalid accepted actual role total-play workload assessment');
  return freeze(s);
};
export type ActualRoleWorkloadScope = Readonly<{ careerId: string; gameId: string; playId: number; playerId: string; gameDay: number }>;
export const deriveActualRoleWorkloadActivity = (raw: AcceptedActualRoleWorkloadAssessment, scope: ActualRoleWorkloadScope): Extract<PlayerWorkloadActivity, { kind: 'MATCH' }> => {
  const s = actualRoleWorkloadAssessmentInput(raw, raw.sourceId);
  if (![scope.careerId, scope.gameId, scope.playerId].every(id) || !Number.isSafeInteger(scope.playId) || scope.playId < 0
    || !Number.isSafeInteger(scope.gameDay) || scope.gameDay < 0 || s.participantReference.playerId !== scope.playerId) throw new Error('actual role workload participant scope differs');
  return freeze({ sourceEventId: `actual-total-play-workload:${hash([scope.careerId, scope.gameId, scope.playId, scope.playerId])}`,
    sourceVersion: 'actual-total-play-workload-v1', evidenceId: s.physicalEndReference.sourceId,
    careerId: scope.careerId, playerId: scope.playerId, atDay: scope.gameDay, kind: 'MATCH', effortUnits: s.effortUnits });
};
