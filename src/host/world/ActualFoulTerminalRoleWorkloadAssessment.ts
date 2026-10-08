import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { PlayerWorkloadActivity } from '../../core/world/development/PlayerWorkloadRecovery';
import type { FoulOfficialEndReference } from './ActualFoulOfficial';
import type { FoulTerminalPhysicalPitchReference } from './ActualFoulTerminalApplication';
import { actorFreeze as freeze, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualLivePlayFields as fields, actualLivePlayId as id } from './ActualLivePlayScope';

export type FoulTerminalWorkloadReference = Readonly<{
  owner: 'actual_foul_terminal_applications'; sourceId: string; sourceVersion: string;
  sourceHash: string; proposalHash: string; officialReceiptHash: string; acknowledgementHash: string;
}>;
export type AcceptedFoulTerminalRoleWorkloadAssessment = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'actual_foul_terminal_total_workload_v1';
  terminalReference: FoulTerminalWorkloadReference; physicalEndReference: FoulOfficialEndReference;
  wholeHistoryReference: Readonly<{ hash: string; convention: 'owned_scheduled_whole_history_manifest_v1' }>;
  originalPhysicalPitchPrefix: readonly FoulTerminalPhysicalPitchReference[];
  participantReference: Readonly<{ playerId: string; bindingHash: string; personHash: string }>;
  effortUnits: number;
  provenance: Readonly<{ assessmentSourceId: string; assessmentVersion: string; calibrationSourceId: string; calibrationVersion: string }>;
}>;
const digest = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const foulTerminalRoleWorkloadAssessmentInput = (raw: unknown, sourceId: string): AcceptedFoulTerminalRoleWorkloadAssessment => {
  const source = cloneInert(raw) as AcceptedFoulTerminalRoleWorkloadAssessment;
  if (!fields(source, ['sourceId', 'sourceVersion', 'capability', 'terminalReference', 'physicalEndReference', 'wholeHistoryReference',
    'originalPhysicalPitchPrefix', 'participantReference', 'effortUnits', 'provenance']) || source.sourceId !== sourceId
    || ![sourceId, source.sourceVersion].every(id) || source.capability !== 'actual_foul_terminal_total_workload_v1') {
    throw new Error('invalid accepted terminal TOTAL workload assessment');
  }
  const ref = source.terminalReference, end = source.physicalEndReference, participant = source.participantReference;
  if (!fields(ref, ['owner', 'sourceId', 'sourceVersion', 'sourceHash', 'proposalHash', 'officialReceiptHash', 'acknowledgementHash'])
    || ref.owner !== 'actual_foul_terminal_applications' || ![ref.sourceId, ref.sourceVersion].every(id)
    || ![ref.sourceHash, ref.proposalHash, ref.officialReceiptHash, ref.acknowledgementHash].every(digest)
    || !fields(end, ['owner', 'sourceId', 'sourceVersion', 'sourceHash', 'snapshotHash']) || end.owner !== 'actual_foul_play_ends'
    || ![end.sourceId, end.sourceVersion].every(id) || ![end.sourceHash, end.snapshotHash].every(digest)
    || !fields(source.wholeHistoryReference, ['hash', 'convention']) || !digest(source.wholeHistoryReference.hash)
    || source.wholeHistoryReference.convention !== 'owned_scheduled_whole_history_manifest_v1'
    || !Array.isArray(source.originalPhysicalPitchPrefix) || !source.originalPhysicalPitchPrefix.length
    || source.originalPhysicalPitchPrefix.some(p => !fields(p, ['owner', 'sourceId', 'sourceVersion', 'sourceHash', 'snapshotHash', 'progressRevision'])
      || p.owner !== 'physical_pitch_progress_actions' || ![p.sourceId, p.sourceVersion].every(id) || ![p.sourceHash, p.snapshotHash].every(digest)
      || !Number.isSafeInteger(p.progressRevision) || p.progressRevision < 1)
    || new Set(source.originalPhysicalPitchPrefix.map(p => p.sourceId)).size !== source.originalPhysicalPitchPrefix.length
    || !fields(participant, ['playerId', 'bindingHash', 'personHash']) || !id(participant.playerId)
    || ![participant.bindingHash, participant.personHash].every(digest)
    || typeof source.effortUnits !== 'number' || !Number.isFinite(source.effortUnits) || source.effortUnits < 0
    || !fields(source.provenance, ['assessmentSourceId', 'assessmentVersion', 'calibrationSourceId', 'calibrationVersion'])
    || !Object.values(source.provenance).every(id)) throw new Error('terminal workload original references, TOTAL effort or provenance differ');
  return freeze(source);
};

/** Same accounting identity as first-base TOTAL workload. The accepted TOTAL
 * already includes the complete physical pitch prefix; nothing is added to it. */
export const deriveFoulTerminalRoleWorkloadActivity = (source: AcceptedFoulTerminalRoleWorkloadAssessment,
  scope: Readonly<{ careerId: string; gameId: string; playId: number; playerId: string; gameDay: number }>): Extract<PlayerWorkloadActivity, { kind: 'MATCH' }> => {
  const accepted = foulTerminalRoleWorkloadAssessmentInput(source, source.sourceId);
  if (![scope.careerId, scope.gameId, scope.playerId].every(id) || !Number.isSafeInteger(scope.playId) || scope.playId < 0
    || !Number.isSafeInteger(scope.gameDay) || scope.gameDay < 0 || accepted.participantReference.playerId !== scope.playerId) throw new Error('terminal workload participant scope differs');
  return freeze({ sourceEventId: 'actual-total-play-workload:' + hash([scope.careerId, scope.gameId, scope.playId, scope.playerId]),
    sourceVersion: 'actual-total-play-workload-v1', evidenceId: accepted.physicalEndReference.sourceId, careerId: scope.careerId,
    playerId: scope.playerId, atDay: scope.gameDay, kind: 'MATCH', effortUnits: accepted.effortUnits });
};
