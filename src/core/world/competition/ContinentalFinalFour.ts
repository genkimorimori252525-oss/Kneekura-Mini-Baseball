import { createCanonicalLineScoreSnapshot } from '../../model/CanonicalLineScoreSnapshot';
import type { CompetitionEditionSnapshot } from './CompetitionEdition';
import type { OfficialGameResult } from './OfficialGameCompletion';
import { finalizeContinentalQuarterfinals,
  type ContinentalQuarterfinalPlan,
  type ContinentalQuarterfinalSource } from './ContinentalQuarterfinals';

export type ContinentalSemifinalPairingPolicy = Readonly<{
  version: string;
  /** Indices into the four quarterfinal games; supplied by edition policy. */
  semifinalPairs: readonly (readonly [number, number])[];
}>;
export type ContinentalFinalFourSource = Readonly<{
  edition: CompetitionEditionSnapshot;
  quarterfinalPlan: ContinentalQuarterfinalPlan;
  quarterfinalResults: readonly OfficialGameResult[];
  quarterfinalSource: ContinentalQuarterfinalSource;
  pairingPolicy: ContinentalSemifinalPairingPolicy;
}>;
export type ContinentalFinalFourGame = Readonly<{
  gameId: string;
  neutralVenueId: string;
  homeClubId: string;
  awayClubId: string;
}>;
export type ContinentalFinalFourPlan = Readonly<{
  competitionId: string;
  editionId: string;
  hostingPolicyVersion: string;
  pairingPolicyVersion: string;
  hostNationId: string;
  hostCityId: string;
  hostVenueId: string;
  quarterfinalWinnerClubIds: readonly string[];
  sourceApplicationIds: readonly string[];
  semifinalGames: readonly ContinentalFinalFourGame[];
  finalGameId: string;
}>;
export type ContinentalFinalFourOutcome = Readonly<{
  plan: ContinentalFinalFourPlan;
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

/** Uses the host already pinned to the edition; no ability bonus is created. */
export const planContinentalFinalFour = (
  source: ContinentalFinalFourSource,
): ContinentalFinalFourPlan => {
  const edition = source?.edition;
  if (!id(edition?.competitionId) || !id(edition.editionId)
    || !id(edition.hostingPolicyVersion)) {
    throw new Error('invalid continental final four edition');
  }
  const quarterfinals = finalizeContinentalQuarterfinals(
    source.quarterfinalPlan, source.quarterfinalResults,
    source.quarterfinalSource);
  const plan = quarterfinals.plan;
  const host = edition.finalFourHost;
  const groupClubs = source.quarterfinalSource.groupPlan.groups
    .flatMap((group) => group.memberClubIds);
  if (edition.competitionId !== plan.competitionId
    || edition.editionId !== plan.editionId
    || !Array.isArray(edition.participantIds)
    || edition.participantIds.length !== 16
    || new Set(edition.participantIds).size !== 16
    || edition.participantIds.some((clubId) => !groupClubs.includes(clubId))
    || !host || host.policyVersion !== edition.hostingPolicyVersion
    || edition.host?.nationId !== host.selectedNationId
    || !Array.isArray(edition.host.cityIds)
    || !edition.host.cityIds.includes(host.selectedCityId)
    || !Array.isArray(edition.host.venueIds)
    || !edition.host.venueIds.includes(host.selectedVenueId)) {
    throw new Error('final four host or edition contradicts group participants');
  }
  const policy = source.pairingPolicy;
  const editionPairing = edition.finalFourPairingPolicy;
  if (!id(policy?.version) || !Array.isArray(policy.semifinalPairs)
    || policy.semifinalPairs.length !== 2
    || policy.semifinalPairs.some((pair) =>
      !Array.isArray(pair) || pair.length !== 2
      || pair.some((slot) => !Number.isSafeInteger(slot)))
    || [...policy.semifinalPairs.flat()].sort().join(',') !== '0,1,2,3'
    || !editionPairing || editionPairing.version !== policy.version
    || !Array.isArray(editionPairing.semifinalPairs)
    || editionPairing.semifinalPairs.length !== 2
    || editionPairing.semifinalPairs.some((pair, index) =>
      pair[0] !== policy.semifinalPairs[index][0]
      || pair[1] !== policy.semifinalPairs[index][1])) {
    throw new Error('invalid versioned semifinal pairing');
  }
  const semifinals = policy.semifinalPairs.map((pair, index) =>
    Object.freeze({ gameId: JSON.stringify(['continental-final-four-sf',
      edition.competitionId, edition.editionId, index]),
    neutralVenueId: host.selectedVenueId,
    homeClubId: quarterfinals.winnerClubIds[pair[0]],
    awayClubId: quarterfinals.winnerClubIds[pair[1]] }));
  const sourceApplicationIds = [
    ...plan.sources.flatMap((item) => item.resultApplicationIds),
    ...quarterfinals.resultApplicationIds,
  ];
  return Object.freeze({ competitionId: edition.competitionId,
    editionId: edition.editionId,
    hostingPolicyVersion: edition.hostingPolicyVersion,
    pairingPolicyVersion: policy.version,
    hostNationId: host.selectedNationId,
    hostCityId: host.selectedCityId,
    hostVenueId: host.selectedVenueId,
    quarterfinalWinnerClubIds: Object.freeze([
      ...quarterfinals.winnerClubIds]),
    sourceApplicationIds: Object.freeze(sourceApplicationIds),
    semifinalGames: Object.freeze(semifinals),
    finalGameId: JSON.stringify(['continental-final-four-final',
      edition.competitionId, edition.editionId]) });
};

const officialWinner = (game: ContinentalFinalFourGame,
  result: OfficialGameResult, editionId: string): string => {
  if (!result || result.gameId !== game.gameId
    || result.seasonId !== editionId
    || result.homeClubId !== game.homeClubId
    || result.awayClubId !== game.awayClubId
    || result.venueBinding?.gameId !== game.gameId
    || result.venueBinding.venueId !== game.neutralVenueId
    || !id(result.venueBinding.fixtureEventId)
    || !Number.isSafeInteger(result.venueBinding.fixtureRevision)
    || result.venueBinding.fixtureRevision < 0
    || !id(result.closureId) || !id(result.applicationId)
    || !Number.isSafeInteger(result.homeRuns)
    || !Number.isSafeInteger(result.awayRuns)
    || result.homeRuns < 0 || result.awayRuns < 0
    || result.homeRuns === result.awayRuns) {
    throw new Error('final four requires matching decided official results');
  }
  const lineScore = createCanonicalLineScoreSnapshot(result.lineScore);
  const winnerClubId = result.homeRuns > result.awayRuns
    ? game.homeClubId : game.awayClubId;
  if (lineScore.totals.home.runs !== result.homeRuns
    || lineScore.totals.away.runs !== result.awayRuns
    || result.winnerClubId !== winnerClubId) {
    throw new Error('final four result contradicts official line score');
  }
  return winnerClubId;
};

/** Rechecks the complete official path before advancing the champion. */
export const finalizeContinentalFinalFour = (
  plan: ContinentalFinalFourPlan,
  semifinalResults: readonly OfficialGameResult[],
  finalResult: OfficialGameResult,
  source: ContinentalFinalFourSource,
): ContinentalFinalFourOutcome => {
  const expected = planContinentalFinalFour(source);
  if (!plan || plan.competitionId !== expected.competitionId
    || plan.editionId !== expected.editionId
    || plan.hostingPolicyVersion !== expected.hostingPolicyVersion
    || plan.pairingPolicyVersion !== expected.pairingPolicyVersion
    || plan.hostNationId !== expected.hostNationId
    || plan.hostCityId !== expected.hostCityId
    || plan.hostVenueId !== expected.hostVenueId
    || plan.finalGameId !== expected.finalGameId
    || !Array.isArray(plan.quarterfinalWinnerClubIds)
    || !sameIds(plan.quarterfinalWinnerClubIds,
      expected.quarterfinalWinnerClubIds)
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
    throw new Error('final four plan contradicts official bracket or host');
  }
  if (!Array.isArray(semifinalResults) || semifinalResults.length !== 2
    || new Set(semifinalResults.map((result) => result.gameId)).size !== 2) {
    throw new Error('final four requires two unique semifinals');
  }
  const byGame = new Map(semifinalResults.map((result) =>
    [result.gameId, result]));
  const semifinalWinnerClubIds = expected.semifinalGames.map((game) =>
    officialWinner(game, byGame.get(game.gameId)!, expected.editionId));
  const finalGame = Object.freeze({ gameId: expected.finalGameId,
    neutralVenueId: expected.hostVenueId,
    homeClubId: semifinalWinnerClubIds[0],
    awayClubId: semifinalWinnerClubIds[1] });
  const championClubId = officialWinner(finalGame, finalResult,
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
    throw new Error('final four official application and fixture IDs must be unique');
  }
  return Object.freeze({ plan: expected,
    semifinalWinnerClubIds: Object.freeze(semifinalWinnerClubIds),
    finalGame, championClubId,
    resultApplicationIds: Object.freeze(resultApplicationIds) });
};
