import { createCanonicalLineScoreSnapshot }
  from '../../model/CanonicalLineScoreSnapshot';
import type { OfficialGameResult } from './OfficialGameCompletion';
import { finalizeWbcFinalsGroups, type WbcFinalsGroupEdition,
  type WbcFinalsGroupPlan } from './WbcFinalsGroups';
import type { WbcBerthAllocation } from './WbcBerths';

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const nonnegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export type WbcKnockoutEdition = Readonly<{
  competitionId: string;
  editionId: string;
  canonicalRole: 'NATIONAL_WORLD_CHAMPIONSHIP';
  qualificationSnapshotId: string;
  groupDrawSnapshotId: string;
  ruleProfileVersion: string;
  gamePolicyVersion: string;
  knockoutPolicyVersion: string;
  hostNationId: 'US';
  roundOf16Pairs: readonly (readonly [number, number])[];
  knockoutHubs: readonly Readonly<{ cityId: string;
    venueId: string }>[];
  roundOf16HubIndices: readonly number[];
  quarterfinalHubIndices: readonly number[];
  finalFourHost: Readonly<{ cityId: string; venueId: string }>;
}>;
export type WbcKnockoutSource = Readonly<{
  groupEdition: WbcFinalsGroupEdition;
  groupPlan: WbcFinalsGroupPlan;
  groupResults: readonly OfficialGameResult[];
  berths: WbcBerthAllocation;
  knockoutEdition: WbcKnockoutEdition;
}>;
export type WbcKnockoutGame = Readonly<{
  stage: 'ROUND_OF_16' | 'QUARTERFINAL' | 'SEMIFINAL' | 'FINAL';
  stageIndex: number;
  gameId: string;
  homeNationId: string;
  awayNationId: string;
  venueId: string;
}>;
export type WbcKnockoutPlan = Readonly<{
  competitionId: string;
  editionId: string;
  qualificationSnapshotId: string;
  groupDrawSnapshotId: string;
  knockoutPolicyVersion: string;
  sourceApplicationIds: readonly string[];
  roundOf16Games: readonly WbcKnockoutGame[];
  quarterfinalVenueIds: readonly string[];
  finalFourVenueId: string;
}>;
export type WbcKnockoutOutcome = Readonly<{
  plan: WbcKnockoutPlan;
  quarterfinalGames: readonly WbcKnockoutGame[];
  semifinalGames: readonly WbcKnockoutGame[];
  finalGame: WbcKnockoutGame;
  championNationId: string;
  resultApplicationIds: readonly string[];
}>;

const game = (edition: WbcKnockoutEdition,
  stage: WbcKnockoutGame['stage'], stageIndex: number,
  homeNationId: string, awayNationId: string,
  venueId: string): WbcKnockoutGame => Object.freeze({ stage,
  stageIndex, gameId: JSON.stringify(['wbc-knockout',
    edition.competitionId, edition.editionId, stage, stageIndex]),
  homeNationId, awayNationId, venueId });

/** Rechecks all 36 group results before planning the frozen 16-nation draw. */
export const planWbcKnockout = (
  source: WbcKnockoutSource,
): WbcKnockoutPlan => {
  const groups = finalizeWbcFinalsGroups(source.groupPlan,
    source.groupResults, source.groupEdition, source.berths);
  const entrants = groups.roundOf16NationIds;
  const edition = source.knockoutEdition;
  if (!entrants || entrants.length !== 16
    || !id(edition?.competitionId)
    || edition.competitionId !== source.groupEdition.competitionId
    || edition.editionId !== source.groupEdition.editionId
    || edition.canonicalRole !== 'NATIONAL_WORLD_CHAMPIONSHIP'
    || edition.hostNationId !== 'US'
    || edition.qualificationSnapshotId
      !== source.groupEdition.qualificationSnapshotId
    || edition.groupDrawSnapshotId
      !== source.groupEdition.drawSnapshotId
    || edition.ruleProfileVersion
      !== source.groupEdition.ruleProfileVersion
    || edition.gamePolicyVersion
      !== source.groupEdition.gamePolicyVersion
    || !id(edition.knockoutPolicyVersion)
    || !Array.isArray(edition.roundOf16Pairs)
    || edition.roundOf16Pairs.length !== 8
    || edition.roundOf16Pairs.some((pair) =>
      !Array.isArray(pair) || pair.length !== 2
      || pair.some((index) => !nonnegative(index) || index > 15))
    || new Set(edition.roundOf16Pairs.flat()).size !== 16
    || !Array.isArray(edition.knockoutHubs)
    || edition.knockoutHubs.length < 2
    || edition.knockoutHubs.length > 4
    || edition.knockoutHubs.some((hub) =>
      !id(hub?.cityId) || !id(hub.venueId))
    || new Set(edition.knockoutHubs.map((hub) => hub.cityId)).size
      !== edition.knockoutHubs.length
    || new Set(edition.knockoutHubs.map((hub) => hub.venueId)).size
      !== edition.knockoutHubs.length
    || !Array.isArray(edition.roundOf16HubIndices)
    || edition.roundOf16HubIndices.length !== 8
    || !Array.isArray(edition.quarterfinalHubIndices)
    || edition.quarterfinalHubIndices.length !== 4
    || [...edition.roundOf16HubIndices,
      ...edition.quarterfinalHubIndices].some((index) =>
      !nonnegative(index) || index >= edition.knockoutHubs.length)
    || !id(edition.finalFourHost?.cityId)
    || !id(edition.finalFourHost.venueId)) {
    throw new Error('invalid versioned US WBC knockout edition');
  }
  const roundOf16Games = edition.roundOf16Pairs.map((pair, index) =>
    game(edition, 'ROUND_OF_16', index,
      entrants[pair[0]], entrants[pair[1]],
      edition.knockoutHubs[edition.roundOf16HubIndices[index]].venueId));
  return Object.freeze({ competitionId: edition.competitionId,
    editionId: edition.editionId,
    qualificationSnapshotId: edition.qualificationSnapshotId,
    groupDrawSnapshotId: edition.groupDrawSnapshotId,
    knockoutPolicyVersion: edition.knockoutPolicyVersion,
    sourceApplicationIds: Object.freeze([...groups.resultApplicationIds]),
    roundOf16Games: Object.freeze(roundOf16Games),
    quarterfinalVenueIds: Object.freeze(
      edition.quarterfinalHubIndices.map((index) =>
        edition.knockoutHubs[index].venueId)),
    finalFourVenueId: edition.finalFourHost.venueId });
};

const winner = (game: WbcKnockoutGame,
  result: OfficialGameResult | undefined,
  edition: WbcKnockoutEdition): string => {
  if (!result || result.gameId !== game.gameId
    || result.seasonId !== edition.editionId
    || result.homeClubId !== game.homeNationId
    || result.awayClubId !== game.awayNationId
    || result.ruleProfileId !== edition.ruleProfileVersion
    || result.gamePolicyVersion !== edition.gamePolicyVersion
    || result.venueBinding?.gameId !== game.gameId
    || result.venueBinding.venueId !== game.venueId
    || !id(result.venueBinding.fixtureEventId)
    || !nonnegative(result.venueBinding.fixtureRevision)
    || !id(result.applicationId) || !id(result.closureId)
    || !nonnegative(result.durableRevision)
    || !nonnegative(result.homeRuns)
    || !nonnegative(result.awayRuns)
    || result.homeRuns === result.awayRuns
    || result.completionReason === 'TIE_LIMIT') {
    throw new Error('WBC knockout needs decided official venue-bound games');
  }
  const score = createCanonicalLineScoreSnapshot(result.lineScore);
  const winningNationId = result.homeRuns > result.awayRuns
    ? game.homeNationId : game.awayNationId;
  if (score.totals.home.runs !== result.homeRuns
    || score.totals.away.runs !== result.awayRuns
    || result.winnerClubId !== winningNationId) {
    throw new Error('WBC knockout winner contradicts official line score');
  }
  return winningNationId;
};

const stageWinners = (games: readonly WbcKnockoutGame[],
  results: readonly OfficialGameResult[],
  edition: WbcKnockoutEdition): readonly string[] => {
  if (!Array.isArray(results) || results.length !== games.length
    || new Set(results.map((result) => result.gameId)).size
      !== games.length
    || new Set(results.map((result) => result.applicationId)).size
      !== games.length
    || new Set(results.map((result) =>
      result.venueBinding?.fixtureEventId)).size !== games.length) {
    throw new Error('WBC knockout stage requires unique official games');
  }
  return Object.freeze(games.map((planned) =>
    winner(planned, results.find((result) =>
      result.gameId === planned.gameId), edition)));
};

const requireNewEvidence = (results: readonly OfficialGameResult[],
  earlier: readonly OfficialGameResult[]): void => {
  if (!Array.isArray(results)) {
    throw new Error('WBC knockout requires official result arrays');
  }
  const applications = new Set(earlier.map((result) =>
    result.applicationId));
  const fixtures = new Set(earlier.map((result) =>
    result.venueBinding?.fixtureEventId));
  if (results.some((result) =>
    applications.has(result.applicationId)
    || fixtures.has(result.venueBinding?.fixtureEventId))) {
    throw new Error('WBC knockout official applications must be unique');
  }
};

export const planWbcQuarterfinals = (
  plan: WbcKnockoutPlan,
  roundOf16Results: readonly OfficialGameResult[],
  source: WbcKnockoutSource,
): readonly WbcKnockoutGame[] => {
  const expected = planWbcKnockout(source);
  if (JSON.stringify(plan) !== JSON.stringify(expected)) {
    throw new Error('WBC knockout plan contradicts official group sources');
  }
  requireNewEvidence(roundOf16Results, source.groupResults);
  const edition = source.knockoutEdition;
  const winners = stageWinners(expected.roundOf16Games,
    roundOf16Results, edition);
  return Object.freeze(Array.from({ length: 4 }, (_, index) =>
    game(edition, 'QUARTERFINAL', index,
      winners[index * 2], winners[index * 2 + 1],
      expected.quarterfinalVenueIds[index])));
};

export const planWbcSemifinals = (
  plan: WbcKnockoutPlan,
  roundOf16Results: readonly OfficialGameResult[],
  quarterfinalResults: readonly OfficialGameResult[],
  source: WbcKnockoutSource,
): readonly WbcKnockoutGame[] => {
  const edition = source.knockoutEdition;
  const quarterfinals = planWbcQuarterfinals(plan,
    roundOf16Results, source);
  requireNewEvidence(quarterfinalResults,
    [...source.groupResults, ...roundOf16Results]);
  const winners = stageWinners(quarterfinals,
    quarterfinalResults, edition);
  return Object.freeze(Array.from({ length: 2 }, (_, index) =>
    game(edition, 'SEMIFINAL', index,
      winners[index * 2], winners[index * 2 + 1],
      plan.finalFourVenueId)));
};

export const planWbcFinal = (
  plan: WbcKnockoutPlan,
  roundOf16Results: readonly OfficialGameResult[],
  quarterfinalResults: readonly OfficialGameResult[],
  semifinalResults: readonly OfficialGameResult[],
  source: WbcKnockoutSource,
): WbcKnockoutGame => {
  const edition = source.knockoutEdition;
  const semifinals = planWbcSemifinals(plan, roundOf16Results,
    quarterfinalResults, source);
  requireNewEvidence(semifinalResults,
    [...source.groupResults, ...roundOf16Results,
      ...quarterfinalResults]);
  const winners = stageWinners(semifinals, semifinalResults, edition);
  return game(edition, 'FINAL', 0, winners[0], winners[1],
    plan.finalFourVenueId);
};

/** Accepts eight R16, four QF, two SF and one final official results. */
export const finalizeWbcKnockout = (
  plan: WbcKnockoutPlan,
  roundOf16Results: readonly OfficialGameResult[],
  quarterfinalResults: readonly OfficialGameResult[],
  semifinalResults: readonly OfficialGameResult[],
  finalResult: OfficialGameResult,
  source: WbcKnockoutSource,
): WbcKnockoutOutcome => {
  const expected = planWbcKnockout(source);
  if (JSON.stringify(plan) !== JSON.stringify(expected)) {
    throw new Error('WBC knockout plan contradicts official group sources');
  }
  if (!Array.isArray(roundOf16Results)
    || roundOf16Results.length !== 8
    || !Array.isArray(quarterfinalResults)
    || quarterfinalResults.length !== 4
    || !Array.isArray(semifinalResults)
    || semifinalResults.length !== 2
    || !finalResult) {
    throw new Error('WBC knockout requires 8, 4, 2 and 1 official games');
  }
  const allResults = [...roundOf16Results, ...quarterfinalResults,
    ...semifinalResults, finalResult];
  requireNewEvidence([finalResult],
    [...source.groupResults, ...roundOf16Results,
      ...quarterfinalResults, ...semifinalResults]);
  if (new Set(allResults.map((result) => result.gameId)).size !== 15
    || new Set(allResults.map((result) => result.applicationId)).size
      !== 15
    || new Set(allResults.map((result) =>
      result.venueBinding?.fixtureEventId)).size !== 15
    || allResults.some((result) => expected.sourceApplicationIds
      .includes(result.applicationId))) {
    throw new Error('WBC knockout official applications must be unique');
  }
  const quarterfinalGames = planWbcQuarterfinals(plan,
    roundOf16Results, source);
  const semifinalGames = planWbcSemifinals(plan,
    roundOf16Results, quarterfinalResults, source);
  const finalGame = planWbcFinal(plan, roundOf16Results,
    quarterfinalResults, semifinalResults, source);
  const championNationId = winner(finalGame, finalResult,
    source.knockoutEdition);
  return Object.freeze({ plan: expected,
    quarterfinalGames: Object.freeze(quarterfinalGames),
    semifinalGames: Object.freeze(semifinalGames),
    finalGame, championNationId,
    resultApplicationIds: Object.freeze(allResults.map((result) =>
      result.applicationId)) });
};
