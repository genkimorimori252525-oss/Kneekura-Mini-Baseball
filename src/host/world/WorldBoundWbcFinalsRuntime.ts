import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { requireRegisteredDrawPolicy } from '../../core/world/competition/CompetitionDraw';
import { snapshotNationalHostCandidatePolicy } from '../../core/world/competition/CompetitionHostInfrastructure';
import type { WbcFinalsSchedulePolicy } from '../../core/world/competition/WbcFinalsSchedule';
import { withCompetitionSourceReadPhase } from './CompetitionSourceReadScope';
import type { SqliteNationalCompetitionSelectionStore } from './SqliteNationalCompetitionSelectionStore';
import type { SqliteWorldNationalRankingSnapshotStore, WorldNationalRankingRequest } from './SqliteWorldNationalRankingSnapshotStore';
import type { SqliteNationalCompetitionDrawStore, NationalCompetitionDrawRequest } from './SqliteNationalCompetitionDrawStore';
import type { SqliteNationalHostCandidateStore, NationalHostCandidateRequest } from './SqliteNationalHostCandidateStore';
import type { SqliteNationalCompetitionEditionStore, NationalCompetitionEditionRequest } from './SqliteNationalCompetitionEditionStore';
import type { SqliteWbcFinalsGroupStore } from './SqliteWbcFinalsGroupStore';
import type { SqliteWbcFinalsKnockoutStore } from './SqliteWbcFinalsKnockoutStore';
import type { SqliteWbcFinalsScheduleStore } from './SqliteWbcFinalsScheduleStore';
import type { SqliteOfficialWbcHistoryStore } from './SqliteOfficialWbcHistoryStore';
import type { SqliteWorldNationalRankingHistoryStore } from './SqliteWorldNationalRankingHistoryStore';
import { deliverCompletedGamePlayerOutcomes, type CompletedGameOutcomeStores } from './CompletedGamePlayerOutcomeDelivery';

export type WorldBoundWbcFinalsStores = CompletedGameOutcomeStores & Readonly<{
  selections: Pick<SqliteNationalCompetitionSelectionStore, 'readSelection'>;
  rankings: Pick<SqliteWorldNationalRankingSnapshotStore, 'initialize'>;
  draws: Pick<SqliteNationalCompetitionDrawStore, 'initialize'>;
  hosts: Pick<SqliteNationalHostCandidateStore, 'initialize'>;
  editions: Pick<SqliteNationalCompetitionEditionStore, 'initialize' | 'readSnapshot'>;
  groups: Pick<SqliteWbcFinalsGroupStore, 'initialize' | 'finalize'>;
  knockout: Pick<SqliteWbcFinalsKnockoutStore, 'initialize' | 'finalize' | 'readPlan' | 'readEvidence'>;
  schedules: Pick<SqliteWbcFinalsScheduleStore, 'initialize'>;
  history: Pick<SqliteOfficialWbcHistoryStore, 'record'>;
  rankingHistory: Pick<SqliteWorldNationalRankingHistoryStore, 'recordWbc'>;
}>;
export type WorldBoundWbcFinalsInput = Readonly<{
  ranking: WorldNationalRankingRequest;
  draw: NationalCompetitionDrawRequest;
  hosts: NationalHostCandidateRequest;
  edition: NationalCompetitionEditionRequest;
  schedulePolicy: WbcFinalsSchedulePolicy;
}>;

/** Each durable owner freezes its own request; interruption can be retried in this order. */
export const initializeWorldBoundWbcFinals = (stores: WorldBoundWbcFinalsStores, rawInput: WorldBoundWbcFinalsInput) => {
  const input = cloneInert(rawInput);
  const { ranking, draw, hosts, edition } = input;
  if (!ranking || !draw || !hosts || !edition || draw.kind !== 'WBC' || edition.profile?.kind !== 'WBC'
    || hosts.policy?.kind !== 'WBC' || [draw.careerId, hosts.careerId].some((id) => id !== edition.careerId)
    || ranking.careerId !== edition.careerId || [draw.editionId, hosts.editionId].some((id) => id !== edition.editionId)
    || hosts.policy.version !== edition.profile.hostingPolicyVersion) {
    throw new Error('World WBC finals runtime scope or cutoff differs');
  }
  const selection = stores.selections.readSelection(edition.careerId, edition.editionId);
  if (!selection || selection.kind !== 'WBC' || selection.editionId !== edition.editionId
    || ranking.asOfDay !== selection.qualificationCutoff.day) {
    throw new Error('World WBC finals runtime scope or cutoff differs');
  }
  requireRegisteredDrawPolicy(draw.registry, draw.policy);
  snapshotNationalHostCandidatePolicy(hosts.policy);
  const savedRanking = withCompetitionSourceReadPhase(() => stores.rankings.initialize(ranking));
  const savedDraw = withCompetitionSourceReadPhase(() => stores.draws.initialize(draw));
  const candidates = withCompetitionSourceReadPhase(() => stores.hosts.initialize(hosts));
  const savedEdition = withCompetitionSourceReadPhase(() => stores.editions.initialize(edition));
  if (savedEdition.kind !== 'WBC') throw new Error('World WBC finals requires accepted WBC Edition');
  const groups = withCompetitionSourceReadPhase(() => stores.groups.initialize({ careerId: edition.careerId, edition: savedEdition.edition }));
  const schedule = withCompetitionSourceReadPhase(() => stores.schedules.initialize({ careerId: edition.careerId,
    editionId: edition.editionId, knockoutEdition: savedEdition.knockoutEdition, policy: input.schedulePolicy }));
  return Object.freeze({ ranking: savedRanking, draw: savedDraw, candidates, edition: savedEdition, groups, schedule });
};

/** Knockout qualification only follows complete official group results. */
export const initializeWorldBoundWbcKnockout = (stores: WorldBoundWbcFinalsStores, careerId: string, editionId: string) => {
  const snapshot = stores.editions.readSnapshot(careerId, editionId);
  if (!snapshot || snapshot.kind !== 'WBC') throw new Error('World WBC finals requires accepted WBC Edition');
  if (!withCompetitionSourceReadPhase(() => stores.groups.finalize(careerId, editionId))) return null;
  return withCompetitionSourceReadPhase(() => stores.knockout.initialize({ careerId, edition: snapshot.knockoutEdition }));
};

/** Incomplete finals never become historical qualification or ranking evidence. */
export const completeWorldBoundWbcFinals = (stores: WorldBoundWbcFinalsStores, careerId: string, editionId: string) => {
  const snapshot = stores.editions.readSnapshot(careerId, editionId);
  if (!snapshot || snapshot.kind !== 'WBC') throw new Error('World WBC finals requires accepted WBC Edition');
  if (!withCompetitionSourceReadPhase(() => stores.knockout.readPlan(careerId, editionId))) return null;
  if (!withCompetitionSourceReadPhase(() => stores.knockout.finalize(careerId, editionId))) return null;
  const history = withCompetitionSourceReadPhase(() => stores.history.record(careerId, editionId));
  const ranking = withCompetitionSourceReadPhase(() => stores.rankingHistory.recordWbc(careerId, editionId));
  const evidence = withCompetitionSourceReadPhase(() => stores.knockout.readEvidence(careerId, editionId));
  if (!evidence || evidence.source.groupEdition.editionId !== editionId || evidence.source.knockoutEdition.editionId !== editionId) {
    throw new Error('World WBC finals outcome delivery lacks completed original evidence');
  }
  const playerOutcomes = deliverCompletedGamePlayerOutcomes(stores, careerId, editionId, [
    ...evidence.source.groupResults, ...evidence.roundOf16Results, ...evidence.quarterfinalResults,
    ...evidence.semifinalResults, evidence.finalResult,
  ]);
  return Object.freeze({ history, ranking, playerOutcomes });
};
