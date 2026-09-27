import type { ClubWorldRegion } from './ClubWorldBerths';
import { finalizeClubWorldFinalFour,
  type ClubWorldFinalFourPlan,
  type ClubWorldFinalFourSource } from './ClubWorldFinalFour';
import type { OfficialGameResult } from './OfficialGameCompletion';

export type ClubWorldChampion = Readonly<{
  editionId: string;
  clubId: string;
  region: ClubWorldRegion;
  officialTitleId: string;
  titleFinalizedDay: number;
}>;
export type ClubWorldChampionHistory = Readonly<{
  competitionId: string;
  champions: readonly ClubWorldChampion[];
}>;
export type ClubWorldTitleEvidence = Readonly<{
  source: ClubWorldFinalFourSource;
  plan: ClubWorldFinalFourPlan;
  semifinalResults: readonly OfficialGameResult[];
  finalResult: OfficialGameResult;
}>;
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

export const createClubWorldChampionHistory = (
  competitionId: string,
): ClubWorldChampionHistory => {
  if (!id(competitionId)) {
    throw new Error('Club World competition identity is required');
  }
  return Object.freeze({ competitionId, champions: Object.freeze([]) });
};

/** Record only a completed official final and its entrant's region. */
export const recordClubWorldChampion = (
  history: ClubWorldChampionHistory,
  evidence: ClubWorldTitleEvidence,
): ClubWorldChampionHistory => {
  if (!id(history?.competitionId)
    || !Array.isArray(history?.champions)) {
    throw new Error('Club World champion history is required');
  }
  const outcome = finalizeClubWorldFinalFour(evidence.plan,
    evidence.semifinalResults, evidence.finalResult,
    evidence.source);
  const edition = evidence.source.quarterfinalSource.groupSource.edition;
  const berths = evidence.source.quarterfinalSource.groupSource.berths;
  const slot = berths.slots.find((item) =>
    item.clubId === outcome.championClubId);
  if (edition.canonicalRole !== 'CLUB_WORLD'
    || edition.competitionId !== history.competitionId
    || !slot || !id(evidence.finalResult.applicationId)
    || history.champions.some((item) =>
      item.editionId === edition.editionId
      || item.officialTitleId === evidence.finalResult.applicationId)) {
    throw new Error('Club World title identity or edition is invalid');
  }
  const champion: ClubWorldChampion = Object.freeze({
    editionId: edition.editionId,
    clubId: outcome.championClubId,
    region: slot.region,
    officialTitleId: evidence.finalResult.applicationId,
    titleFinalizedDay: edition.calendarWindow.endsOnDay,
  });
  return Object.freeze({ competitionId: history.competitionId,
    champions: Object.freeze([...history.champions, champion]) });
};

/** Suitable for ClubWorldBerthAuthority.defendingWorldChampion. */
export const latestClubWorldChampion = (
  history: ClubWorldChampionHistory,
  beforeDay: number,
): ClubWorldChampion | null => {
  if (!Number.isSafeInteger(beforeDay) || beforeDay < 0) {
    throw new Error('invalid Club World champion cutoff');
  }
  const completed = history.champions.filter((item) =>
    item.titleFinalizedDay <= beforeDay)
    .sort((left, right) =>
      right.titleFinalizedDay - left.titleFinalizedDay);
  if (completed.length > 1
    && completed[0].titleFinalizedDay
      === completed[1].titleFinalizedDay) {
    throw new Error('Club World title order is ambiguous');
  }
  return completed[0] ?? null;
};
