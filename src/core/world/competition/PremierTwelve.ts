import { createCanonicalLineScoreSnapshot }
  from '../../model/CanonicalLineScoreSnapshot';
import type { OfficialGameResult } from './OfficialGameCompletion';
import { buildOfficialStandings, type OfficialStandingsSnapshot,
  type StandingsTiebreakPolicy } from './OfficialStandings';

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const nonnegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const PAIRS: readonly (readonly [number, number])[] =
  Array.from({ length: 6 }, (_, left) =>
    Array.from({ length: 5 - left }, (_, offset) =>
      [left, left + offset + 1] as const)).flat();

export type PremierTwelveRanking = Readonly<{
  snapshotId: string;
  policyVersion: string;
  asOfDay: number;
  orderedNationIds: readonly string[];
  evidenceResultIds: readonly string[];
}>;
export type PremierTwelveAuthority = Readonly<{
  editionCutoff: (editionId: string) => Readonly<{
    snapshotId: string; day: number }> | null;
  worldNationalRanking: (beforeDay: number) =>
    PremierTwelveRanking | null;
}>;
export type PremierTwelveEdition = Readonly<{
  competitionId: string;
  editionId: string;
  canonicalRole: 'PREMIER_12';
  formatVersion: string;
  ruleProfileVersion: string;
  gamePolicyVersion: string;
  rankingPolicyVersion: string;
  qualificationCutoffSnapshotId: string;
  rankingSnapshotId: string;
  drawSnapshotId: string;
  hostingPolicyVersion: string;
  tiebreakPolicy: StandingsTiebreakPolicy;
  finalFourPairingPolicy: Readonly<{ version: string;
    semifinalPairs: readonly (readonly [number, number])[] }>;
  hostNationIds: readonly string[];
  groupHosts: readonly Readonly<{ groupIndex: number;
    nationId: string; cityId: string; venueId: string }>[];
  finalFourHost: Readonly<{ nationId: string;
    cityId: string; venueId: string }>;
  groups: readonly Readonly<{ groupIndex: number;
    nationIds: readonly string[] }>[];
  calendarWindow: Readonly<{ startsOnDay: number;
    endsOnDay: number }>;
}>;
export type PremierTwelveGame = Readonly<{
  gameId: string;
  homeNationId: string;
  awayNationId: string;
  venueId: string;
}>;
export type PremierTwelveGroupPlan = Readonly<{
  competitionId: string;
  editionId: string;
  rankingSnapshotId: string;
  drawSnapshotId: string;
  hostingPolicyVersion: string;
  rankingResultIds: readonly string[];
  rankedNationIds: readonly string[];
  groups: readonly Readonly<{ groupIndex: number;
    nationIds: readonly string[];
    hostNationId: string; hostCityId: string;
    hostVenueId: string;
    games: readonly PremierTwelveGame[] }>[];
}>;
export type PremierTwelveGroupOutcome = Readonly<{
  plan: PremierTwelveGroupPlan;
  groups: readonly Readonly<{ groupIndex: number;
    standings: OfficialStandingsSnapshot;
    topTwoNationIds: readonly string[] | null }>[];
  resultApplicationIds: readonly string[];
}>;
export type PremierTwelveFinalFourPlan = Readonly<{
  editionId: string;
  pairingPolicyVersion: string;
  finalFourVenueId: string;
  sourceApplicationIds: readonly string[];
  semifinalGames: readonly PremierTwelveGame[];
  bronzeGameId: string;
  finalGameId: string;
}>;
export type PremierTwelveMedalGames = Readonly<{
  bronzeGame: PremierTwelveGame;
  finalGame: PremierTwelveGame;
}>;
export type PremierTwelveOutcome = Readonly<{
  plan: PremierTwelveFinalFourPlan;
  medalGames: PremierTwelveMedalGames;
  championNationId: string;
  runnerUpNationId: string;
  bronzeNationId: string;
  resultApplicationIds: readonly string[];
}>;

/** Reserve knockout slots before their participants qualify. */
export const premierTwelveFinalFourGameIds = (
  edition: Pick<PremierTwelveEdition, 'competitionId' | 'editionId'>,
): Readonly<{ semifinalGameIds: readonly string[];
  bronzeGameId: string; finalGameId: string }> => Object.freeze({
  semifinalGameIds: Object.freeze([0, 1].map((index) =>
    JSON.stringify(['premier-12-sf', edition.competitionId, edition.editionId, index]))),
  bronzeGameId: JSON.stringify(['premier-12-bronze', edition.competitionId, edition.editionId]),
  finalGameId: JSON.stringify(['premier-12-final', edition.competitionId, edition.editionId]),
});

/** The ranking authority supplies the top twelve at the edition cutoff. */
export const planPremierTwelveGroups = (
  edition: PremierTwelveEdition,
  authority: PremierTwelveAuthority,
): PremierTwelveGroupPlan => {
  if (!id(edition?.competitionId) || !id(edition.editionId)
    || edition.canonicalRole !== 'PREMIER_12'
    || !id(edition.formatVersion)
    || !id(edition.ruleProfileVersion)
    || !id(edition.gamePolicyVersion)
    || !id(edition.rankingPolicyVersion)
    || !id(edition.qualificationCutoffSnapshotId)
    || !id(edition.rankingSnapshotId)
    || !id(edition.drawSnapshotId)
    || !id(edition.hostingPolicyVersion)
    || !id(edition.tiebreakPolicy?.version)
    || !nonnegative(edition.calendarWindow?.startsOnDay)
    || !nonnegative(edition.calendarWindow?.endsOnDay)
    || edition.calendarWindow.endsOnDay
      < edition.calendarWindow.startsOnDay
    || typeof authority?.editionCutoff !== 'function'
    || typeof authority.worldNationalRanking !== 'function') {
    throw new Error('invalid Premier 12 edition or ranking authority');
  }
  const cutoff = authority.editionCutoff(edition.editionId);
  if (!cutoff || cutoff.snapshotId
    !== edition.qualificationCutoffSnapshotId
    || !nonnegative(cutoff.day)
    || cutoff.day >= edition.calendarWindow.startsOnDay) {
    throw new Error('Premier 12 requires official cutoff before its window');
  }
  const ranking = authority.worldNationalRanking(cutoff.day);
  if (!ranking || ranking.snapshotId !== edition.rankingSnapshotId
    || ranking.policyVersion !== edition.rankingPolicyVersion
    || !nonnegative(ranking.asOfDay)
    || ranking.asOfDay !== cutoff.day
    || !Array.isArray(ranking.orderedNationIds)
    || ranking.orderedNationIds.length < 12
    || ranking.orderedNationIds.some((nationId) => !id(nationId))
    || new Set(ranking.orderedNationIds).size
      !== ranking.orderedNationIds.length
    || !Array.isArray(ranking.evidenceResultIds)
    || ranking.evidenceResultIds.length === 0
    || ranking.evidenceResultIds.some((resultId) => !id(resultId))
    || new Set(ranking.evidenceResultIds).size
      !== ranking.evidenceResultIds.length) {
    throw new Error('Premier 12 requires official cutoff world ranking');
  }
  if (!Array.isArray(edition.hostNationIds)
    || edition.hostNationIds.length < 1
    || edition.hostNationIds.length > 2
    || edition.hostNationIds.some((nationId) => !id(nationId))
    || new Set(edition.hostNationIds).size
      !== edition.hostNationIds.length
    || !Array.isArray(edition.groups)
    || edition.groups.length !== 2
    || !Array.isArray(edition.groupHosts)
    || edition.groupHosts.length !== 2
    || new Set(edition.groupHosts.map((host) => host.cityId)).size
      !== 2
    || new Set(edition.groupHosts.map((host) => host.venueId)).size
      !== 2
    || !id(edition.finalFourHost?.nationId)
    || !edition.hostNationIds.includes(edition.finalFourHost.nationId)
    || !id(edition.finalFourHost.cityId)
    || !id(edition.finalFourHost.venueId)) {
    throw new Error('Premier 12 requires two group hosts and final four city');
  }
  const entrants = new Set<string>();
  const groups = edition.groups.map((group: PremierTwelveEdition['groups'][number],
    groupIndex: number) => {
    const host = edition.groupHosts[groupIndex];
    if (!group || group.groupIndex !== groupIndex
      || !Array.isArray(group.nationIds)
      || group.nationIds.length !== 6
      || new Set(group.nationIds).size !== 6
      || group.nationIds.some((nationId) => !id(nationId)
        || entrants.has(nationId)
        || !ranking.orderedNationIds.slice(0, 12).includes(nationId))
      || !host || host.groupIndex !== groupIndex
      || !edition.hostNationIds.includes(host.nationId)
      || !id(host.cityId) || !id(host.venueId)) {
      throw new Error('Premier 12 draw must partition ranking top twelve');
    }
    group.nationIds.forEach((nationId) => entrants.add(nationId));
    const nationIds = Object.freeze([...group.nationIds]);
    const games = Object.freeze(PAIRS.map((pair, gameIndex) =>
      Object.freeze({ gameId: JSON.stringify(['premier-12-group',
        edition.competitionId, edition.editionId,
        groupIndex, gameIndex]),
      homeNationId: nationIds[pair[0]],
      awayNationId: nationIds[pair[1]],
      venueId: host.venueId })));
    return Object.freeze({ groupIndex, nationIds,
      hostNationId: host.nationId, hostCityId: host.cityId,
      hostVenueId: host.venueId, games });
  });
  if (entrants.size !== 12) {
    throw new Error('Premier 12 draw omits a ranked nation');
  }
  return Object.freeze({ competitionId: edition.competitionId,
    editionId: edition.editionId,
    rankingSnapshotId: ranking.snapshotId,
    drawSnapshotId: edition.drawSnapshotId,
    hostingPolicyVersion: edition.hostingPolicyVersion,
    rankingResultIds: Object.freeze([...ranking.evidenceResultIds]),
    rankedNationIds: Object.freeze(ranking.orderedNationIds.slice(0, 12)),
    groups: Object.freeze(groups) });
};

const officialWinner = (planned: PremierTwelveGame,
  result: OfficialGameResult | undefined,
  edition: PremierTwelveEdition,
  decided: boolean): string | null => {
  if (!result || result.gameId !== planned.gameId
    || result.seasonId !== edition.editionId
    || result.homeClubId !== planned.homeNationId
    || result.awayClubId !== planned.awayNationId
    || result.ruleProfileId !== edition.ruleProfileVersion
    || result.gamePolicyVersion !== edition.gamePolicyVersion
    || result.venueBinding?.gameId !== planned.gameId
    || result.venueBinding.venueId !== planned.venueId
    || !id(result.venueBinding.fixtureEventId)
    || !nonnegative(result.venueBinding.fixtureRevision)
    || !id(result.closureId) || !id(result.applicationId)
    || !nonnegative(result.durableRevision)
    || !nonnegative(result.homeRuns)
    || !nonnegative(result.awayRuns)
    || (decided && result.homeRuns === result.awayRuns)) {
    throw new Error('Premier 12 requires matching official venue-bound games');
  }
  const score = createCanonicalLineScoreSnapshot(result.lineScore);
  const winner = result.homeRuns > result.awayRuns
    ? planned.homeNationId
    : result.awayRuns > result.homeRuns
      ? planned.awayNationId : null;
  if (score.totals.home.runs !== result.homeRuns
    || score.totals.away.runs !== result.awayRuns
    || result.winnerClubId !== winner) {
    throw new Error('Premier 12 official result contradicts line score');
  }
  return winner;
};

export const finalizePremierTwelveGroups = (
  plan: PremierTwelveGroupPlan,
  results: readonly OfficialGameResult[],
  edition: PremierTwelveEdition,
  authority: PremierTwelveAuthority,
): PremierTwelveGroupOutcome => {
  const expected = planPremierTwelveGroups(edition, authority);
  if (JSON.stringify(plan) !== JSON.stringify(expected)) {
    throw new Error('Premier 12 group plan contradicts official ranking');
  }
  if (!Array.isArray(results) || results.length !== 30
    || new Set(results.map((result) => result.gameId)).size !== 30
    || new Set(results.map((result) => result.applicationId)).size !== 30
    || new Set(results.map((result) =>
      result.venueBinding?.fixtureEventId)).size !== 30) {
    throw new Error('Premier 12 requires thirty unique group games');
  }
  const groups = expected.groups.map((group) => {
    const groupResults = results.filter((result) =>
      group.games.some((game) => game.gameId === result.gameId));
    if (groupResults.length !== 15) {
      throw new Error('Premier 12 group requires fifteen official games');
    }
    for (const game of group.games) {
      officialWinner(game, groupResults.find((result) =>
        result.gameId === game.gameId), edition, false);
    }
    const standings = buildOfficialStandings({
      seasonId: edition.editionId,
      leagueId: JSON.stringify(['premier-12', edition.competitionId,
        group.groupIndex]),
      memberClubIds: group.nationIds,
      regularSeasonGamesPerClub: 5,
      games: group.games.map((game) => ({ gameId: game.gameId,
        homeClubId: game.homeNationId,
        awayClubId: game.awayNationId })),
      revisionEventIds: [] }, groupResults, edition.tiebreakPolicy);
    return Object.freeze({ groupIndex: group.groupIndex,
      standings, topTwoNationIds: standings.orderedClubIds === null
        ? null : Object.freeze(standings.orderedClubIds.slice(0, 2)) });
  });
  return Object.freeze({ plan: expected,
    groups: Object.freeze(groups),
    resultApplicationIds: Object.freeze(results.map((result) =>
      result.applicationId)) });
};

export type PremierTwelveFinalFourSource = Readonly<{
  edition: PremierTwelveEdition;
  authority: PremierTwelveAuthority;
  groupPlan: PremierTwelveGroupPlan;
  groupResults: readonly OfficialGameResult[];
}>;

export const assertPremierTwelvePairingPolicy = (
  pairing: PremierTwelveEdition['finalFourPairingPolicy'],
): void => {
  if (!id(pairing?.version)
    || !Array.isArray(pairing.semifinalPairs)
    || pairing.semifinalPairs.length !== 2
    || pairing.semifinalPairs.some((pair) =>
      !Array.isArray(pair) || pair.length !== 2
      || pair.some((index) => !nonnegative(index) || index > 3)
      || Math.floor(pair[0] / 2) === Math.floor(pair[1] / 2))
    || new Set(pairing.semifinalPairs.flat()).size !== 4) {
    throw new Error('Premier 12 needs decided cross-group semifinals');
  }
};

/** Uses the four officially ranked group qualifiers, with no bronze shortcut. */
export const planPremierTwelveFinalFour = (
  source: PremierTwelveFinalFourSource,
): PremierTwelveFinalFourPlan => {
  const groups = finalizePremierTwelveGroups(source.groupPlan,
    source.groupResults, source.edition, source.authority);
  const qualifiers = groups.groups.flatMap((group) =>
    group.topTwoNationIds ?? []);
  const edition = source.edition;
  const pairing = edition.finalFourPairingPolicy;
  if (qualifiers.length !== 4) {
    throw new Error('Premier 12 needs decided cross-group semifinals');
  }
  assertPremierTwelvePairingPolicy(pairing);
  const gameIds = premierTwelveFinalFourGameIds(edition);
  const semifinals = pairing.semifinalPairs.map((pair, index) =>
    Object.freeze({ gameId: gameIds.semifinalGameIds[index],
    homeNationId: qualifiers[pair[0]],
    awayNationId: qualifiers[pair[1]],
    venueId: edition.finalFourHost.venueId }));
  return Object.freeze({ editionId: edition.editionId,
    pairingPolicyVersion: pairing.version,
    finalFourVenueId: edition.finalFourHost.venueId,
    sourceApplicationIds: Object.freeze([...groups.resultApplicationIds]),
    semifinalGames: Object.freeze(semifinals),
    bronzeGameId: gameIds.bronzeGameId,
    finalGameId: gameIds.finalGameId });
};

export const planPremierTwelveMedalGames = (
  plan: PremierTwelveFinalFourPlan,
  semifinalResults: readonly OfficialGameResult[],
  source: PremierTwelveFinalFourSource,
): PremierTwelveMedalGames => {
  const expected = planPremierTwelveFinalFour(source);
  if (JSON.stringify(plan) !== JSON.stringify(expected)) {
    throw new Error('Premier 12 final four plan contradicts group results');
  }
  if (!Array.isArray(semifinalResults)
    || semifinalResults.length !== 2
    || new Set(semifinalResults.map((result) => result.gameId)).size !== 2
    || new Set(semifinalResults.map((result) =>
      result.applicationId)).size !== 2
    || new Set(semifinalResults.map((result) =>
      result.venueBinding?.fixtureEventId)).size !== 2
    || semifinalResults.some((result) => expected.sourceApplicationIds
      .includes(result.applicationId)
      || source.groupResults.some((groupResult) =>
        groupResult.venueBinding?.fixtureEventId
          === result.venueBinding?.fixtureEventId))) {
    throw new Error('Premier 12 needs two unique official semifinals');
  }
  const winners = expected.semifinalGames.map((game) =>
    officialWinner(game, semifinalResults.find((result) =>
      result.gameId === game.gameId), source.edition, true)!);
  const losers = expected.semifinalGames.map((game, index) =>
    game.homeNationId === winners[index]
      ? game.awayNationId : game.homeNationId);
  return Object.freeze({ bronzeGame: Object.freeze({
    gameId: expected.bronzeGameId,
    homeNationId: losers[0], awayNationId: losers[1],
    venueId: expected.finalFourVenueId }),
  finalGame: Object.freeze({ gameId: expected.finalGameId,
    homeNationId: winners[0], awayNationId: winners[1],
    venueId: expected.finalFourVenueId }) });
};

export const finalizePremierTwelve = (
  plan: PremierTwelveFinalFourPlan,
  semifinalResults: readonly OfficialGameResult[],
  bronzeResult: OfficialGameResult,
  finalResult: OfficialGameResult,
  source: PremierTwelveFinalFourSource,
): PremierTwelveOutcome => {
  const medals = planPremierTwelveMedalGames(plan,
    semifinalResults, source);
  const bronzeNationId = officialWinner(medals.bronzeGame,
    bronzeResult, source.edition, true)!;
  const championNationId = officialWinner(medals.finalGame,
    finalResult, source.edition, true)!;
  const runnerUpNationId = medals.finalGame.homeNationId
    === championNationId ? medals.finalGame.awayNationId
      : medals.finalGame.homeNationId;
  const results = [...semifinalResults, bronzeResult, finalResult];
  if (new Set(results.map((result) => result.applicationId)).size !== 4
    || new Set(results.map((result) =>
      result.venueBinding?.fixtureEventId)).size !== 4
    || results.some((result) => plan.sourceApplicationIds
      .includes(result.applicationId)
      || source.groupResults.some((groupResult) =>
        groupResult.venueBinding?.fixtureEventId
          === result.venueBinding?.fixtureEventId))) {
    throw new Error('Premier 12 medal game evidence must be unique');
  }
  return Object.freeze({ plan, medalGames: medals,
    championNationId, runnerUpNationId, bronzeNationId,
    resultApplicationIds: Object.freeze(results.map((result) =>
      result.applicationId)) });
};
