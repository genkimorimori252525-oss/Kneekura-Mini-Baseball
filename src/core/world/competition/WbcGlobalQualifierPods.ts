import { createCanonicalLineScoreSnapshot }
  from '../../model/CanonicalLineScoreSnapshot';
import type { ClubWorldRegion } from './ClubWorldBerths';
import type { OfficialGameResult } from './OfficialGameCompletion';
import type { WbcQualifierPodWinner } from './WbcBerths';

const REGIONS: readonly ClubWorldRegion[] = [
  'ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const day = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export type WbcQualifierPod = Readonly<{
  podIndex: number;
  hostNationId: string;
  hostCityId: string;
  hostVenueId: string;
  entrants: readonly Readonly<{ nationId: string;
    region: ClubWorldRegion }>[];
}>;
/** The four independent hosts belong to this edition, not a single host nation. */
export type WbcGlobalQualifierEdition = Readonly<{
  competitionId: string;
  editionId: string;
  canonicalRole: 'WBC_GLOBAL_QUALIFIER';
  formatVersion: string;
  ruleProfileVersion: string;
  gamePolicyVersion: string;
  hostingPolicyVersion: string;
  qualificationSnapshotId: string;
  drawSnapshotId: string;
  calendarWindow: Readonly<{ startsOnDay: number; endsOnDay: number }>;
  pods: readonly WbcQualifierPod[];
}>;
export type WbcQualifierGame = Readonly<{
  gameId: string;
  podIndex: number;
  homeNationId: string;
  awayNationId: string;
  venueId: string;
}>;
export type WbcQualifierPodPlan = Readonly<{
  podIndex: number;
  hostNationId: string;
  hostCityId: string;
  hostVenueId: string;
  entrants: WbcQualifierPod['entrants'];
  semifinals: readonly WbcQualifierGame[];
  finalGameId: string;
}>;
export type WbcGlobalQualifierPlan = Readonly<{
  competitionId: string;
  editionId: string;
  formatVersion: string;
  hostingPolicyVersion: string;
  qualificationSnapshotId: string;
  drawSnapshotId: string;
  pods: readonly WbcQualifierPodPlan[];
}>;
export type WbcGlobalQualifierOutcome = Readonly<{
  plan: WbcGlobalQualifierPlan;
  finalGames: readonly WbcQualifierGame[];
  winners: readonly WbcQualifierPodWinner[];
  resultApplicationIds: readonly string[];
}>;

/** The edition records the 16-nation draw and four pod hosts before play. */
export const planWbcGlobalQualifier = (
  edition: WbcGlobalQualifierEdition,
): WbcGlobalQualifierPlan => {
  if (!id(edition?.competitionId) || !id(edition.editionId)
    || edition.canonicalRole !== 'WBC_GLOBAL_QUALIFIER'
    || !id(edition.formatVersion) || !id(edition.ruleProfileVersion)
    || !id(edition.gamePolicyVersion)
    || !id(edition.hostingPolicyVersion)
    || !id(edition.qualificationSnapshotId)
    || !id(edition.drawSnapshotId)
    || !day(edition.calendarWindow?.startsOnDay)
    || !day(edition.calendarWindow?.endsOnDay)
    || edition.calendarWindow.endsOnDay
      < edition.calendarWindow.startsOnDay
    || !Array.isArray(edition.pods) || edition.pods.length !== 4) {
    throw new Error('invalid versioned WBC Global Qualifier edition');
  }
  const allNations = new Set<string>();
  const allRegions = new Set<ClubWorldRegion>();
  const pods = edition.pods.map((pod: WbcQualifierPod,
    podIndex: number) => {
    if (!pod || pod.podIndex !== podIndex
      || !id(pod.hostNationId) || !id(pod.hostCityId)
      || !id(pod.hostVenueId)
      || !Array.isArray(pod.entrants) || pod.entrants.length !== 4
      || pod.entrants.some((entrant) => !id(entrant?.nationId)
        || !REGIONS.includes(entrant.region)
        || allNations.has(entrant.nationId))
      || new Set(pod.entrants.map((entrant) => entrant.nationId)).size !== 4
      || new Set(pod.entrants.map((entrant) => entrant.region)).size < 2) {
      throw new Error('WBC qualifier pod requires four distinct mixed-region nations');
    }
    const entrants = Object.freeze(pod.entrants.map((entrant) => {
      allNations.add(entrant.nationId);
      allRegions.add(entrant.region);
      return Object.freeze({ nationId: entrant.nationId,
        region: entrant.region });
    }));
    const semifinals = Object.freeze([0, 1].map((gameIndex) =>
      Object.freeze({ gameId: JSON.stringify(['wbc-qualifier-sf',
        edition.competitionId, edition.editionId, podIndex, gameIndex]),
      podIndex, homeNationId: entrants[gameIndex * 2].nationId,
      awayNationId: entrants[gameIndex * 2 + 1].nationId,
      venueId: pod.hostVenueId })));
    return Object.freeze({ podIndex, hostNationId: pod.hostNationId,
      hostCityId: pod.hostCityId, hostVenueId: pod.hostVenueId,
      entrants, semifinals,
      finalGameId: JSON.stringify(['wbc-qualifier-final',
        edition.competitionId, edition.editionId, podIndex]) });
  });
  if (allNations.size !== 16 || allRegions.size !== 4) {
    throw new Error('WBC qualifier must include all four regions');
  }
  return Object.freeze({ competitionId: edition.competitionId,
    editionId: edition.editionId, formatVersion: edition.formatVersion,
    hostingPolicyVersion: edition.hostingPolicyVersion,
    qualificationSnapshotId: edition.qualificationSnapshotId,
    drawSnapshotId: edition.drawSnapshotId,
    pods: Object.freeze(pods) });
};

const officialWinner = (game: WbcQualifierGame,
  result: OfficialGameResult | undefined,
  edition: WbcGlobalQualifierEdition): string => {
  if (!result || result.gameId !== game.gameId
    || result.seasonId !== edition.editionId
    || result.homeClubId !== game.homeNationId
    || result.awayClubId !== game.awayNationId
    || result.ruleProfileId !== edition.ruleProfileVersion
    || result.gamePolicyVersion !== edition.gamePolicyVersion
    || result.venueBinding?.gameId !== game.gameId
    || result.venueBinding.venueId !== game.venueId
    || !id(result.venueBinding.fixtureEventId)
    || !day(result.venueBinding.fixtureRevision)
    || !id(result.closureId) || !id(result.applicationId)
    || !day(result.durableRevision)
    || !day(result.homeRuns) || !day(result.awayRuns)
    || result.homeRuns === result.awayRuns
    || result.completionReason === 'TIE_LIMIT') {
    throw new Error('WBC qualifier requires decided official venue-bound games');
  }
  const lineScore = createCanonicalLineScoreSnapshot(result.lineScore);
  const winner = result.homeRuns > result.awayRuns
    ? game.homeNationId : game.awayNationId;
  if (lineScore.totals.home.runs !== result.homeRuns
    || lineScore.totals.away.runs !== result.awayRuns
    || result.winnerClubId !== winner) {
    throw new Error('WBC qualifier winner contradicts official line score');
  }
  return winner;
};

/** Rebuilds the bracket from the edition before accepting all 12 games. */
export const finalizeWbcGlobalQualifier = (
  plan: WbcGlobalQualifierPlan,
  semifinalResults: readonly OfficialGameResult[],
  finalResults: readonly OfficialGameResult[],
  edition: WbcGlobalQualifierEdition,
): WbcGlobalQualifierOutcome => {
  const expected = planWbcGlobalQualifier(edition);
  if (JSON.stringify(plan) !== JSON.stringify(expected)) {
    throw new Error('WBC qualifier plan contradicts its edition');
  }
  if (!Array.isArray(semifinalResults) || semifinalResults.length !== 8
    || !Array.isArray(finalResults) || finalResults.length !== 4) {
    throw new Error('WBC qualifier requires eight semifinals and four finals');
  }
  const allResults = [...semifinalResults, ...finalResults];
  if (new Set(allResults.map((result) => result.gameId)).size !== 12
    || new Set(allResults.map((result) => result.applicationId)).size !== 12
    || new Set(allResults.map((result) =>
      result.venueBinding?.fixtureEventId)).size !== 12) {
    throw new Error('WBC qualifier official game evidence must be unique');
  }
  const byGame = new Map(allResults.map((result) =>
    [result.gameId, result]));
  const finalGames: WbcQualifierGame[] = [];
  const winners: WbcQualifierPodWinner[] = [];
  for (const pod of expected.pods) {
    const semifinalWinners = pod.semifinals.map((game) =>
      officialWinner(game, byGame.get(game.gameId), edition));
    const finalGame = Object.freeze({ gameId: pod.finalGameId,
      podIndex: pod.podIndex,
      homeNationId: semifinalWinners[0],
      awayNationId: semifinalWinners[1], venueId: pod.hostVenueId });
    const finalResult = byGame.get(finalGame.gameId);
    const nationId = officialWinner(finalGame, finalResult, edition);
    const region = pod.entrants.find((entrant) =>
      entrant.nationId === nationId)!.region;
    finalGames.push(finalGame);
    winners.push(Object.freeze({ podIndex: pod.podIndex,
      qualifierEditionId: edition.editionId, nationId, region,
      officialFinalApplicationId: finalResult!.applicationId,
      finalizedDay: edition.calendarWindow.endsOnDay }));
  }
  return Object.freeze({ plan: expected,
    finalGames: Object.freeze(finalGames),
    winners: Object.freeze(winners),
    resultApplicationIds: Object.freeze(allResults.map((result) =>
      result.applicationId)) });
};
