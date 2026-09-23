import { createCanonicalLineScoreSnapshot } from '../../model/CanonicalLineScoreSnapshot';
import { finalizeAfricaGroupHubs, type AfricaGroupHubPlan,
  type AfricaGroupHubSource } from './AfricaGroupHubs';
import type { ContinentalFinalFourGame } from './ContinentalFinalFour';
import type { OfficialGameResult } from './OfficialGameCompletion';
import type { StandingsTiebreakPolicy } from './OfficialStandings';

export type AfricaFinalFourSource = Readonly<{
  groupSource: AfricaGroupHubSource;
  groupPlan: AfricaGroupHubPlan;
  groupOfficialResults: readonly OfficialGameResult[];
  groupTiebreakPolicy: StandingsTiebreakPolicy;
  pairingPolicy: Readonly<{ version: string;
    /** Indices into A1, A2, B1, B2; pair each group across groups. */
    semifinalPairs: readonly (readonly [number, number])[] }>;
}>;
export type AfricaFinalFourPlan = Readonly<{
  competitionId: string;
  editionId: string;
  hostVenueId: string;
  hostCityId: string;
  hostNationId: string;
  hostingPolicyVersion: string;
  pairingPolicyVersion: string;
  qualifierClubIds: readonly string[];
  sourceApplicationIds: readonly string[];
  semifinalGames: readonly ContinentalFinalFourGame[];
  finalGameId: string;
}>;
export type AfricaFinalFourOutcome = Readonly<{
  plan: AfricaFinalFourPlan;
  semifinalWinnerClubIds: readonly string[];
  finalGame: ContinentalFinalFourGame;
  championClubId: string;
  resultApplicationIds: readonly string[];
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const sameIds = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length
  && left.every((item, index) => item === right[index]);

/** Uses official top-two groups and the host selected with the edition. */
export const planAfricaFinalFour = (
  source: AfricaFinalFourSource,
): AfricaFinalFourPlan => {
  const groupResults = finalizeAfricaGroupHubs(source.groupPlan,
    source.groupOfficialResults, source.groupTiebreakPolicy,
    source.groupSource);
  const edition = source.groupSource.edition;
  const host = edition.finalFourHost;
  if (!host || host.policyVersion !== edition.hostingPolicyVersion
    || edition.host.nationId !== host.selectedNationId
    || !edition.host.cityIds.includes(host.selectedCityId)
    || !edition.host.venueIds.includes(host.selectedVenueId)) {
    throw new Error('Africa final four host was not pinned to the edition');
  }
  const qualifiers = groupResults.groups.flatMap((group) =>
    group.qualifierClubIds ?? []);
  if (qualifiers.length !== 4 || new Set(qualifiers).size !== 4) {
    throw new Error('Africa semifinal qualification is unresolved');
  }
  const pairing = source.pairingPolicy;
  const editionPairing = edition.finalFourPairingPolicy;
  if (!id(pairing?.version)
    || !Array.isArray(pairing.semifinalPairs)
    || pairing.semifinalPairs.length !== 2
    || pairing.semifinalPairs.some((pair) =>
      !Array.isArray(pair) || pair.length !== 2
      || pair.some((slot) => !Number.isSafeInteger(slot)))
    || [...pairing.semifinalPairs.flat()].sort().join(',') !== '0,1,2,3'
    || pairing.semifinalPairs.some((pair) =>
      Math.floor(pair[0] / 2) === Math.floor(pair[1] / 2))
    || !editionPairing || editionPairing.version !== pairing.version
    || !Array.isArray(editionPairing.semifinalPairs)
    || editionPairing.semifinalPairs.length !== 2
    || editionPairing.semifinalPairs.some((pair, index) =>
      pair[0] !== pairing.semifinalPairs[index][0]
      || pair[1] !== pairing.semifinalPairs[index][1])) {
    throw new Error('Africa semifinal pairing must be versioned and cross-group');
  }
  const games = pairing.semifinalPairs.map((pair, index) =>
    Object.freeze({ gameId: JSON.stringify(['africa-final-four-sf',
      groupResults.plan.competitionId, groupResults.plan.editionId, index]),
    neutralVenueId: host.selectedVenueId,
    homeClubId: qualifiers[pair[0]],
    awayClubId: qualifiers[pair[1]] }));
  return Object.freeze({ competitionId: groupResults.plan.competitionId,
    editionId: groupResults.plan.editionId,
    hostVenueId: host.selectedVenueId,
    hostCityId: host.selectedCityId,
    hostNationId: host.selectedNationId,
    hostingPolicyVersion: edition.hostingPolicyVersion,
    pairingPolicyVersion: pairing.version,
    qualifierClubIds: Object.freeze(qualifiers),
    sourceApplicationIds: Object.freeze(groupResults.groups.flatMap(
      (group) => group.standings.resultApplicationIds)),
    semifinalGames: Object.freeze(games),
    finalGameId: JSON.stringify(['africa-final-four-final',
      groupResults.plan.competitionId, groupResults.plan.editionId]) });
};

const winner = (game: ContinentalFinalFourGame,
  result: OfficialGameResult, editionId: string): string => {
  if (!result || result.gameId !== game.gameId
    || result.seasonId !== editionId
    || result.homeClubId !== game.homeClubId
    || result.awayClubId !== game.awayClubId
    || !id(result.closureId) || !id(result.applicationId)
    || result.venueBinding?.gameId !== game.gameId
    || result.venueBinding.venueId !== game.neutralVenueId
    || !id(result.venueBinding.fixtureEventId)
    || !Number.isSafeInteger(result.venueBinding.fixtureRevision)
    || result.venueBinding.fixtureRevision < 0
    || !Number.isSafeInteger(result.homeRuns)
    || !Number.isSafeInteger(result.awayRuns)
    || result.homeRuns < 0 || result.awayRuns < 0
    || result.homeRuns === result.awayRuns) {
    throw new Error('Africa final four requires decided official venue-bound games');
  }
  const lineScore = createCanonicalLineScoreSnapshot(result.lineScore);
  const winnerClubId = result.homeRuns > result.awayRuns
    ? game.homeClubId : game.awayClubId;
  if (lineScore.totals.home.runs !== result.homeRuns
    || lineScore.totals.away.runs !== result.awayRuns
    || result.winnerClubId !== winnerClubId) {
    throw new Error('Africa final four official winner contradicts line score');
  }
  return winnerClubId;
};

export const finalizeAfricaFinalFour = (
  plan: AfricaFinalFourPlan,
  semifinalResults: readonly OfficialGameResult[],
  finalResult: OfficialGameResult,
  source: AfricaFinalFourSource,
): AfricaFinalFourOutcome => {
  const expected = planAfricaFinalFour(source);
  if (!plan || plan.competitionId !== expected.competitionId
    || plan.editionId !== expected.editionId
    || plan.hostVenueId !== expected.hostVenueId
    || plan.hostCityId !== expected.hostCityId
    || plan.hostNationId !== expected.hostNationId
    || plan.hostingPolicyVersion !== expected.hostingPolicyVersion
    || plan.pairingPolicyVersion !== expected.pairingPolicyVersion
    || plan.finalGameId !== expected.finalGameId
    || !Array.isArray(plan.qualifierClubIds)
    || !sameIds(plan.qualifierClubIds, expected.qualifierClubIds)
    || !Array.isArray(plan.sourceApplicationIds)
    || !sameIds(plan.sourceApplicationIds, expected.sourceApplicationIds)
    || !Array.isArray(plan.semifinalGames)
    || plan.semifinalGames.length !== 2
    || plan.semifinalGames.some((game, index) => {
      const original = expected.semifinalGames[index];
      return game.gameId !== original.gameId
        || game.neutralVenueId !== original.neutralVenueId
        || game.homeClubId !== original.homeClubId
        || game.awayClubId !== original.awayClubId;
    })) {
    throw new Error('Africa final four plan contradicts official sources');
  }
  if (!Array.isArray(semifinalResults) || semifinalResults.length !== 2
    || new Set(semifinalResults.map((result) => result.gameId)).size !== 2) {
    throw new Error('Africa final four requires two unique semifinals');
  }
  const byGame = new Map(semifinalResults.map((result) =>
    [result.gameId, result]));
  const semifinalWinnerClubIds = expected.semifinalGames.map((game) =>
    winner(game, byGame.get(game.gameId)!, expected.editionId));
  const finalGame = Object.freeze({ gameId: expected.finalGameId,
    neutralVenueId: expected.hostVenueId,
    homeClubId: semifinalWinnerClubIds[0],
    awayClubId: semifinalWinnerClubIds[1] });
  const championClubId = winner(finalGame, finalResult,
    expected.editionId);
  const resultApplicationIds = [
    ...semifinalResults.map((result) => result.applicationId),
    finalResult.applicationId,
  ];
  const fixtureEventIds = [...semifinalResults, finalResult].map((result) =>
    result.venueBinding!.fixtureEventId);
  if (new Set(resultApplicationIds).size !== 3
    || new Set(fixtureEventIds).size !== 3
    || resultApplicationIds.some((applicationId) =>
      expected.sourceApplicationIds.includes(applicationId))) {
    throw new Error('Africa final four application and fixture IDs must be unique');
  }
  return Object.freeze({ plan: expected,
    semifinalWinnerClubIds: Object.freeze(semifinalWinnerClubIds),
    finalGame, championClubId,
    resultApplicationIds: Object.freeze(resultApplicationIds) });
};
