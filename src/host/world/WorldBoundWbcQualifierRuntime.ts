import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { withCompetitionSourceReadScope } from './CompetitionSourceReadScope';
import { drawWbcQualifierEntrantPods } from '../../core/world/competition/WbcQualifierEditionAssembly';
import type { QualifierHostAccessAssessment, WbcQualifierHostCandidatePolicy } from '../../core/world/competition/WbcQualifierHostCandidates';
import type { WbcQualifierSchedulePolicy } from '../../core/world/competition/WbcQualifierSchedule';
import type { SqliteWbcWorldQualificationStore, WbcWorldQualificationRequest } from './SqliteWbcWorldQualificationStore';
import type { SqliteWorldNationalRankingSnapshotStore, WorldNationalRankingRequest } from './SqliteWorldNationalRankingSnapshotStore';
import type { SqliteWbcQualifierSelectionStore, WbcQualifierSelectionRequest } from './SqliteWbcQualifierSelectionStore';
import type { SqliteWbcQualifierEditionStore, WbcQualifierEditionRequest } from './SqliteWbcQualifierEditionStore';
import type { SqliteWbcQualifierHostAccessStore } from './SqliteWbcQualifierHostAccessStore';
import type { SqliteWbcQualifierHostCandidateStore } from './SqliteWbcQualifierHostCandidateStore';
import type { SqliteWbcGlobalQualifierPodStore } from './SqliteWbcGlobalQualifierPodStore';
import type { SqliteWbcQualifierScheduleStore } from './SqliteWbcQualifierScheduleStore';
import type { SqliteNationalQualificationHistoryStore } from './SqliteNationalQualificationHistoryStore';
import type { SqliteWbcBerthStore } from './SqliteWbcBerthStore';

export type WorldBoundWbcQualifierStores = Readonly<{
  qualification: Pick<SqliteWbcWorldQualificationStore, 'initialize' | 'readSnapshot'>;
  rankings: Pick<SqliteWorldNationalRankingSnapshotStore, 'initialize'>;
  selection: Pick<SqliteWbcQualifierSelectionStore, 'initialize'>;
  access: Pick<SqliteWbcQualifierHostAccessStore, 'record'>;
  hosts: Pick<SqliteWbcQualifierHostCandidateStore, 'initialize' | 'recordCompletedEdition'>;
  editions: Pick<SqliteWbcQualifierEditionStore, 'initialize'>;
  pods: Pick<SqliteWbcGlobalQualifierPodStore, 'initialize' | 'finalize'>;
  schedules: Pick<SqliteWbcQualifierScheduleStore, 'initialize'>;
  history: Pick<SqliteNationalQualificationHistoryStore, 'recordQualifier'>;
  berths: Pick<SqliteWbcBerthStore, 'initialize'>;
}>;
export type WorldBoundWbcQualifierInput = Readonly<{
  qualification: WbcWorldQualificationRequest;
  ranking: WorldNationalRankingRequest;
  selection: WbcQualifierSelectionRequest;
  edition: WbcQualifierEditionRequest;
  hostPolicy: WbcQualifierHostCandidatePolicy;
  accessAssessments: readonly QualifierHostAccessAssessment[];
  schedulePolicy: WbcQualifierSchedulePolicy;
}>;

/** Compose existing durable owners in dependency order; retries use their frozen requests. */
export const initializeWorldBoundWbcQualifier = (
  stores: WorldBoundWbcQualifierStores, rawInput: WorldBoundWbcQualifierInput,
) => {
  const input = cloneInert(rawInput);
  const { qualification: request, ranking, selection, edition } = input;
  if (!request || !ranking || !selection || !edition
    || [ranking.careerId, selection.careerId, edition.careerId].some((id) => id !== request.careerId)
    || selection.wbcEditionId !== request.editionId || edition.wbcEditionId !== request.editionId
    || selection.qualifierEditionId !== request.qualifierEditionId || edition.qualifierEditionId !== request.qualifierEditionId
    || selection.rankingAsOfDay !== ranking.asOfDay || edition.selectedAtDay !== ranking.asOfDay
    || input.hostPolicy.version !== edition.profile.hostingPolicyVersion) {
    throw new Error('World WBC qualifier runtime scope or cutoff differs');
  }
  const qualification = withCompetitionSourceReadScope(() => stores.qualification.initialize(request));
  const savedRanking = withCompetitionSourceReadScope(() => stores.rankings.initialize(ranking));
  const savedSelection = withCompetitionSourceReadScope(() => stores.selection.initialize(selection));
  const draw = drawWbcQualifierEntrantPods({ selection: savedSelection, drawSeed: edition.drawSeed,
    drawPolicyVersion: edition.profile.drawPolicyVersion });
  for (const assessment of input.accessAssessments) stores.access.record({ ...assessment,
    careerId: request.careerId, qualifierEditionId: request.qualifierEditionId, drawSnapshotId: draw.drawSnapshotId });
  withCompetitionSourceReadScope(() => stores.hosts.initialize({ careerId: request.careerId, qualifierEditionId: request.qualifierEditionId,
    selectedAtDay: edition.selectedAtDay, drawSeed: edition.drawSeed,
    drawPolicyVersion: edition.profile.drawPolicyVersion, policy: input.hostPolicy }));
  const savedEdition = withCompetitionSourceReadScope(() => stores.editions.initialize(edition));
  withCompetitionSourceReadScope(() => stores.pods.initialize({ careerId: request.careerId, edition: savedEdition.edition }));
  const schedule = withCompetitionSourceReadScope(() => stores.schedules.initialize({ careerId: request.careerId,
    editionId: request.qualifierEditionId, policy: input.schedulePolicy }));
  return Object.freeze({ qualification, ranking: savedRanking, selection: savedSelection, edition: savedEdition, schedule });
};

/** Incomplete qualifiers produce no qualification record or final berth allocation. */
export const completeWorldBoundWbcQualifier = (
  stores: WorldBoundWbcQualifierStores, careerId: string, wbcEditionId: string,
) => {
  const accepted = stores.qualification.readSnapshot(careerId, wbcEditionId);
  if (!accepted) throw new Error('World WBC qualifier qualification is missing');
  const qualifierEditionId = accepted.input.qualifierEditionId;
  if (!withCompetitionSourceReadScope(() => stores.pods.finalize(careerId, qualifierEditionId))) return null;
  withCompetitionSourceReadScope(() => stores.history.recordQualifier(careerId, qualifierEditionId));
  withCompetitionSourceReadScope(() => stores.hosts.recordCompletedEdition(careerId, qualifierEditionId));
  return withCompetitionSourceReadScope(() => stores.berths.initialize({ careerId, input: accepted.input }));
};
