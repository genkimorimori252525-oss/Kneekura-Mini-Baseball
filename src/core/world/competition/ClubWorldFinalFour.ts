import { createCanonicalLineScoreSnapshot }
  from '../../model/CanonicalLineScoreSnapshot';
import { finalizeClubWorldQuarterfinals,
  type ClubWorldQuarterfinalPlan, type ClubWorldQuarterfinalSource }
  from './ClubWorldQuarterfinals';
import type { OfficialGameResult } from './OfficialGameCompletion';

export type ClubWorldFinalFourSource = Readonly<{
  quarterfinalSource: ClubWorldQuarterfinalSource;
  quarterfinalPlan: ClubWorldQuarterfinalPlan;
  quarterfinalResults: readonly OfficialGameResult[];
}>;
export type ClubWorldFinalFourGame = Readonly<{
  gameId: string;
  homeClubId: string;
  awayClubId: string;
  neutralVenueId: string;
  fixtureEventId: string;
}>;
export type ClubWorldFinalFourPlan = Readonly<{
  competitionId: string;
  editionId: string;
  hostingPolicyVersion: string;
  pairingPolicyVersion: string;
  hostNationId: string;
  hostCityId: string;
  hostVenueId: string;
  quarterfinalWinnerClubIds: readonly string[];
  sourceApplicationIds: readonly string[];
  semifinalGames: readonly ClubWorldFinalFourGame[];
  finalGameId: string;
  finalFixtureEventId: string;
}>;
export type ClubWorldFinalFourOutcome = Readonly<{
  plan: ClubWorldFinalFourPlan;
  semifinalWinnerClubIds: readonly string[];
  finalGame: ClubWorldFinalFourGame;
  championClubId: string;
  resultApplicationIds: readonly string[];
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

/** Host and pairings were selected before the Club World edition began. */
export const planClubWorldFinalFour = (
  source: ClubWorldFinalFourSource,
): ClubWorldFinalFourPlan => {
  const quarterfinals = finalizeClubWorldQuarterfinals(
    source.quarterfinalPlan, source.quarterfinalResults,
    source.quarterfinalSource);
  const edition = source.quarterfinalSource.groupSource.edition;
  const host = edition.finalFourHost;
  const pairing = edition.finalFourPairingPolicy;
  if (!host || host.policyVersion !== edition.hostingPolicyVersion
    || host.selectedNationId !== edition.host.nationId
    || !edition.host.cityIds.includes(host.selectedCityId)
    || !edition.host.venueIds.includes(host.selectedVenueId)
    || !pairing || !id(pairing.version)
    || !Array.isArray(pairing.semifinalPairs)
    || pairing.semifinalPairs.length !== 2
    || pairing.semifinalPairs.some((pair) =>
      !Array.isArray(pair) || pair.length !== 2
      || pair.some((slot) => !Number.isSafeInteger(slot)))
    || JSON.stringify([...pairing.semifinalPairs.flat()].sort())
      !== JSON.stringify([0, 1, 2, 3])) {
    throw new Error('Club World Final Four host and pairings must be pinned');
  }
  const winners = quarterfinals.winnerClubIds;
  if (winners.length !== 4 || new Set(winners).size !== 4) {
    throw new Error('Club World Final Four requires four quarterfinal winners');
  }
  const semifinalGames = pairing.semifinalPairs.map((pair, index) => {
    const gameId = JSON.stringify(['club-world-semifinal',
      edition.competitionId, edition.editionId, index]);
    return Object.freeze({ gameId, homeClubId: winners[pair[0]],
      awayClubId: winners[pair[1]],
      neutralVenueId: host.selectedVenueId,
      fixtureEventId: JSON.stringify(['club-world-fixture', gameId,
        host.selectedVenueId]) });
  });
  const finalGameId = JSON.stringify(['club-world-final',
    edition.competitionId, edition.editionId]);
  return Object.freeze({ competitionId: edition.competitionId,
    editionId: edition.editionId,
    hostingPolicyVersion: edition.hostingPolicyVersion,
    pairingPolicyVersion: pairing.version,
    hostNationId: host.selectedNationId,
    hostCityId: host.selectedCityId,
    hostVenueId: host.selectedVenueId,
    quarterfinalWinnerClubIds: Object.freeze([...winners]),
    sourceApplicationIds: Object.freeze([
      ...quarterfinals.plan.sourceApplicationIds,
      ...quarterfinals.resultApplicationIds].sort()),
    semifinalGames: Object.freeze(semifinalGames),
    finalGameId,
    finalFixtureEventId: JSON.stringify(['club-world-fixture',
      finalGameId, host.selectedVenueId]) });
};

const officialWinner = (game: ClubWorldFinalFourGame,
  result: OfficialGameResult, editionId: string): string => {
  if (result.gameId !== game.gameId || result.seasonId !== editionId
    || result.homeClubId !== game.homeClubId
    || result.awayClubId !== game.awayClubId
    || !id(result.closureId) || !id(result.applicationId)) {
    throw new Error('Club World Final Four official result mismatch');
  }
  if (result.venueBinding?.gameId !== game.gameId
    || result.venueBinding.venueId !== game.neutralVenueId
    || result.venueBinding.fixtureEventId !== game.fixtureEventId
    || !Number.isSafeInteger(result.venueBinding.fixtureRevision)
    || result.venueBinding.fixtureRevision < 0) {
    throw new Error('Club World Final Four requires the pinned neutral venue');
  }
  if (!Number.isSafeInteger(result.homeRuns)
    || !Number.isSafeInteger(result.awayRuns)
    || result.homeRuns < 0 || result.awayRuns < 0
    || result.homeRuns === result.awayRuns
    || result.completionReason === 'TIE_LIMIT') {
    throw new Error('Club World Final Four game must be decided');
  }
  const lineScore = createCanonicalLineScoreSnapshot(result.lineScore);
  const winner = result.homeRuns > result.awayRuns
    ? game.homeClubId : game.awayClubId;
  if (lineScore.totals.home.runs !== result.homeRuns
    || lineScore.totals.away.runs !== result.awayRuns
    || result.winnerClubId !== winner) {
    throw new Error('Club World Final Four winner contradicts official score');
  }
  return winner;
};

/** Two semifinals and one single-game final; no third-place game. */
export const finalizeClubWorldFinalFour = (
  plan: ClubWorldFinalFourPlan,
  semifinalResults: readonly OfficialGameResult[],
  finalResult: OfficialGameResult,
  source: ClubWorldFinalFourSource,
): ClubWorldFinalFourOutcome => {
  const expected = planClubWorldFinalFour(source);
  if (!plan || JSON.stringify(plan) !== JSON.stringify(expected)) {
    throw new Error('Club World Final Four plan contradicts official quarterfinals');
  }
  if (!Array.isArray(semifinalResults)
    || semifinalResults.length !== 2 || !finalResult) {
    throw new Error('Club World Final Four requires three official games');
  }
  const byGame = new Map(semifinalResults.map((result) =>
    [result.gameId, result]));
  if (byGame.size !== 2) {
    throw new Error('Club World semifinals require two distinct games');
  }
  const prior = new Set(expected.sourceApplicationIds);
  const applications = [...semifinalResults.map((result) =>
    result.applicationId), finalResult.applicationId];
  const closures = [...semifinalResults.map((result) =>
    result.closureId), finalResult.closureId];
  if (new Set(applications).size !== 3
    || new Set(closures).size !== 3
    || applications.some((applicationId) =>
      !id(applicationId) || prior.has(applicationId))) {
    throw new Error('Club World Final Four closure and application IDs must be unique');
  }
  const semifinalWinnerClubIds = expected.semifinalGames.map((game) => {
    const result = byGame.get(game.gameId);
    if (!result) throw new Error('missing official Club World semifinal');
    return officialWinner(game, result, expected.editionId);
  });
  const finalGame = Object.freeze({ gameId: expected.finalGameId,
    homeClubId: semifinalWinnerClubIds[0],
    awayClubId: semifinalWinnerClubIds[1],
    neutralVenueId: expected.hostVenueId,
    fixtureEventId: expected.finalFixtureEventId });
  const championClubId = officialWinner(finalGame, finalResult,
    expected.editionId);
  return Object.freeze({ plan: expected,
    semifinalWinnerClubIds: Object.freeze(semifinalWinnerClubIds),
    finalGame, championClubId,
    resultApplicationIds: Object.freeze(applications) });
};
