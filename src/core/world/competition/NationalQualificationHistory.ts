import type { ClubWorldRegion } from './ClubWorldBerths';
import type { OfficialGameResult } from './OfficialGameCompletion';
import { finalizeRegionalNationalKnockout,
  planRegionalNationalKnockout,
  type RegionalNationalKnockoutSource }
  from './RegionalNationalKnockout';
import { finalizeSelectedWbcGlobalQualifier,
  planSelectedWbcGlobalQualifier,
  type WbcGlobalQualifierEdition }
  from './WbcGlobalQualifierPods';
import type { WbcQualifierSelection }
  from './WbcGlobalQualifierSelection';
import type { WbcQualifierPodWinner, WbcRegionalPlacement }
  from './WbcBerths';

const REGIONS: readonly ClubWorldRegion[] = [
  'ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const day = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const usedApplications = (history: NationalQualificationHistory):
readonly string[] => [
  ...history.regional.flatMap((item) => item.resultApplicationIds),
  ...history.qualifiers.flatMap((item) => item.resultApplicationIds),
];

export type NationalQualificationHistory = Readonly<{
  regionalCompetitionIds: Readonly<Record<ClubWorldRegion, string>>;
  regional: readonly Readonly<{ placement: WbcRegionalPlacement;
    resultApplicationIds: readonly string[] }>[];
  qualifiers: readonly Readonly<{ editionId: string;
    completedAtDay: number;
    qualificationSnapshotId: string;
    directSnapshotId: string;
    rankingSnapshotId: string;
    resultApplicationIds: readonly string[];
    winners: readonly WbcQualifierPodWinner[] }>[];
}>;

/** Pins the four regional competition identities before any results arrive. */
export const createNationalQualificationHistory = (
  regionalCompetitionIds: Readonly<Record<ClubWorldRegion, string>>,
): NationalQualificationHistory => {
  if (!regionalCompetitionIds || REGIONS.some((region) =>
    !id(regionalCompetitionIds[region]))
    || new Set(REGIONS.map((region) =>
      regionalCompetitionIds[region])).size !== 4) {
    throw new Error('four regional national competition identities required');
  }
  return Object.freeze({ regionalCompetitionIds: Object.freeze({
    ...regionalCompetitionIds }), regional: Object.freeze([]),
  qualifiers: Object.freeze([]) });
};

/** Revalidates every official group and knockout result before recording. */
export const recordRegionalNationalChampionship = (
  history: NationalQualificationHistory,
  source: RegionalNationalKnockoutSource,
  quarterfinalResults: readonly OfficialGameResult[],
  semifinalResults: readonly OfficialGameResult[],
  finalResult: OfficialGameResult,
): NationalQualificationHistory => {
  const edition = source.groupEdition;
  if (!history || !Array.isArray(history.regional)
    || !Array.isArray(history.qualifiers)
    || history.regionalCompetitionIds[edition.region]
      !== edition.competitionId) {
    throw new Error('regional national competition identity mismatch');
  }
  const plan = planRegionalNationalKnockout(source);
  const outcome = finalizeRegionalNationalKnockout(plan,
    quarterfinalResults, semifinalResults, finalResult, source);
  if (history.regional.some((item) =>
    item.placement.editionId === outcome.placement.editionId
      || item.placement.snapshotId === outcome.placement.snapshotId)
    || usedApplications(history).some((applicationId) =>
      outcome.resultApplicationIds.includes(applicationId))) {
    throw new Error('regional national official edition already recorded');
  }
  return Object.freeze({ ...history,
    regional: Object.freeze([...history.regional,
      Object.freeze({ placement: outcome.placement,
        resultApplicationIds: outcome.resultApplicationIds })]) });
};

/** Revalidates all twelve official pod games before recording winners. */
export const recordWbcGlobalQualifier = (
  history: NationalQualificationHistory,
  edition: WbcGlobalQualifierEdition,
  selection: WbcQualifierSelection,
  semifinalResults: readonly OfficialGameResult[],
  finalResults: readonly OfficialGameResult[],
): NationalQualificationHistory => {
  if (!history || !Array.isArray(history.qualifiers)
    || !Array.isArray(history.regional)) {
    throw new Error('national qualification history required');
  }
  const plan = planSelectedWbcGlobalQualifier(edition, selection);
  const outcome = finalizeSelectedWbcGlobalQualifier(plan,
    semifinalResults, finalResults, edition, selection);
  if (history.qualifiers.some((item) =>
    item.editionId === edition.editionId)
    || usedApplications(history).some((applicationId) =>
      outcome.resultApplicationIds.includes(applicationId))) {
    throw new Error('WBC qualifier official edition already recorded');
  }
  return Object.freeze({ ...history,
    qualifiers: Object.freeze([...history.qualifiers,
      Object.freeze({ editionId: edition.editionId,
        completedAtDay: edition.calendarWindow.endsOnDay,
        qualificationSnapshotId: selection.qualificationSnapshotId,
        directSnapshotId: selection.directSnapshotId,
        rankingSnapshotId: selection.rankingSnapshotId,
        resultApplicationIds: outcome.resultApplicationIds,
        winners: outcome.winners })]) });
};

/** Suitable for WbcBerthAuthority.regionalChampionship. */
export const latestRegionalNationalPlacement = (
  history: NationalQualificationHistory,
  region: ClubWorldRegion,
  beforeDay: number,
): WbcRegionalPlacement | null => {
  if (!REGIONS.includes(region) || !day(beforeDay)) {
    throw new Error('invalid regional national placement lookup');
  }
  const records = history.regional.filter((item) =>
    item.placement.region === region
      && item.placement.completedAtDay <= beforeDay)
    .sort((left, right) => right.placement.completedAtDay
      - left.placement.completedAtDay);
  if (records.length > 1 && records[0].placement.completedAtDay
    === records[1].placement.completedAtDay) {
    throw new Error('regional national edition order is ambiguous');
  }
  return records[0]?.placement ?? null;
};

/** Suitable for WbcBerthAuthority.qualifierPodWinner. */
export const latestWbcQualifierPodWinner = (
  history: NationalQualificationHistory,
  podIndex: number,
  beforeDay: number,
): WbcQualifierPodWinner | null => {
  if (!Number.isSafeInteger(podIndex) || podIndex < 0
    || podIndex > 3 || !day(beforeDay)) {
    throw new Error('invalid WBC qualifier pod lookup');
  }
  const records = history.qualifiers.filter((item) =>
    item.completedAtDay <= beforeDay)
    .sort((left, right) => right.completedAtDay
      - left.completedAtDay);
  if (records.length > 1
    && records[0].completedAtDay === records[1].completedAtDay) {
    throw new Error('WBC qualifier edition order is ambiguous');
  }
  return records[0]?.winners.find((winner) =>
    winner.podIndex === podIndex) ?? null;
};
