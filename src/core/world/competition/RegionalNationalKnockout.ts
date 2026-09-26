import { createCanonicalLineScoreSnapshot }
  from '../../model/CanonicalLineScoreSnapshot';
import type { ClubWorldRegion } from './ClubWorldBerths';
import type { OfficialGameResult } from './OfficialGameCompletion';
import { finalizeRegionalNationalGroups,
  type RegionalNationalAuthority, type RegionalNationalEdition,
  type RegionalNationalGroupPlan }
  from './RegionalNationalGroups';
import type { WbcRegionalPlacement } from './WbcBerths';

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const nonnegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const drawKey = (seed: string, nationId: string): number => {
  const source = JSON.stringify([seed, nationId]);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
};

export type RegionalNationalKnockoutEdition = Readonly<{
  competitionId: string;
  editionId: string;
  region: ClubWorldRegion;
  formatVersion: string;
  ruleProfileVersion: string;
  gamePolicyVersion: string;
  qualificationSnapshotId: string;
  groupDrawSnapshotId: string;
  knockoutPolicyVersion: string;
  openingPairs: readonly (readonly [number, number])[];
  openingVenueIds: readonly string[];
  semifinalVenueIds: readonly string[];
  finalVenueId: string;
  placementPolicy: Readonly<{ version: string;
    criteria: readonly ('GROUP_WINS' | 'GROUP_RUN_DIFFERENTIAL'
      | 'GROUP_RUNS_AGAINST')[];
    drawSeed: string }>;
}>;
export type RegionalNationalKnockoutSource = Readonly<{
  groupEdition: RegionalNationalEdition;
  groupPlan: RegionalNationalGroupPlan;
  groupResults: readonly OfficialGameResult[];
  authority: RegionalNationalAuthority;
  knockoutEdition: RegionalNationalKnockoutEdition;
}>;
export type RegionalNationalKnockoutGame = Readonly<{
  stage: 'QUARTERFINAL' | 'SEMIFINAL' | 'FINAL';
  stageIndex: number;
  gameId: string;
  homeNationId: string;
  awayNationId: string;
  venueId: string;
}>;
export type RegionalNationalKnockoutPlan = Readonly<{
  competitionId: string;
  editionId: string;
  region: ClubWorldRegion;
  knockoutPolicyVersion: string;
  placementPolicyVersion: string;
  sourceApplicationIds: readonly string[];
  knockoutNationIds: readonly string[];
  openingGames: readonly RegionalNationalKnockoutGame[];
  semifinalVenueIds: readonly string[];
  finalVenueId: string;
}>;
export type RegionalNationalKnockoutOutcome = Readonly<{
  plan: RegionalNationalKnockoutPlan;
  semifinalGames: readonly RegionalNationalKnockoutGame[];
  finalGame: RegionalNationalKnockoutGame;
  championNationId: string;
  placement: WbcRegionalPlacement;
  resultApplicationIds: readonly string[];
}>;

const game = (edition: RegionalNationalKnockoutEdition,
  stage: RegionalNationalKnockoutGame['stage'],
  stageIndex: number, homeNationId: string,
  awayNationId: string, venueId: string):
RegionalNationalKnockoutGame => Object.freeze({ stage, stageIndex,
  gameId: JSON.stringify(['regional-national-knockout',
    edition.competitionId, edition.editionId, stage, stageIndex]),
  homeNationId, awayNationId, venueId });

export const planRegionalNationalKnockout = (
  source: RegionalNationalKnockoutSource,
): RegionalNationalKnockoutPlan => {
  const groups = finalizeRegionalNationalGroups(source.groupPlan,
    source.groupResults, source.groupEdition, source.authority);
  const qualifiers = groups.knockoutNationIds;
  const edition = source.knockoutEdition;
  if (!qualifiers || ![4, 8].includes(qualifiers.length)
    || edition?.competitionId !== source.groupEdition.competitionId
    || edition.editionId !== source.groupEdition.editionId
    || edition.region !== source.groupEdition.region
    || edition.formatVersion !== source.groupEdition.formatVersion
    || edition.ruleProfileVersion
      !== source.groupEdition.ruleProfileVersion
    || edition.gamePolicyVersion
      !== source.groupEdition.gamePolicyVersion
    || edition.qualificationSnapshotId
      !== source.groupEdition.qualificationSnapshotId
    || edition.groupDrawSnapshotId
      !== source.groupEdition.drawSnapshotId
    || !id(edition.knockoutPolicyVersion)
    || !id(edition.placementPolicy?.version)
    || !id(edition.placementPolicy.drawSeed)
    || !Array.isArray(edition.placementPolicy.criteria)
    || edition.placementPolicy.criteria.length !== 3
    || new Set(edition.placementPolicy.criteria).size !== 3
    || !['GROUP_WINS', 'GROUP_RUN_DIFFERENTIAL',
      'GROUP_RUNS_AGAINST'].every((criterion) =>
      edition.placementPolicy.criteria.includes(criterion as
        typeof edition.placementPolicy.criteria[number]))
    || !Array.isArray(edition.openingPairs)
    || edition.openingPairs.length !== qualifiers.length / 2
    || edition.openingPairs.some((pair) =>
      !Array.isArray(pair) || pair.length !== 2
      || pair.some((slot) => !nonnegative(slot)
        || slot >= qualifiers.length))
    || new Set(edition.openingPairs.flat()).size
      !== qualifiers.length
    || !Array.isArray(edition.openingVenueIds)
    || edition.openingVenueIds.length !== qualifiers.length / 2
    || edition.openingVenueIds.some((venueId) => !id(venueId))
    || !Array.isArray(edition.semifinalVenueIds)
    || edition.semifinalVenueIds.length !== 2
    || edition.semifinalVenueIds.some((venueId) => !id(venueId))
    || !id(edition.finalVenueId)) {
    throw new Error('invalid versioned regional national knockout edition');
  }
  const openingStage = qualifiers.length === 8
    ? 'QUARTERFINAL' : 'SEMIFINAL';
  const openingGames = edition.openingPairs.map((pair, index) =>
    game(edition, openingStage, index,
      qualifiers[pair[0]], qualifiers[pair[1]],
      edition.openingVenueIds[index]));
  return Object.freeze({ competitionId: edition.competitionId,
    editionId: edition.editionId, region: edition.region,
    knockoutPolicyVersion: edition.knockoutPolicyVersion,
    placementPolicyVersion: edition.placementPolicy.version,
    sourceApplicationIds: Object.freeze([...groups.resultApplicationIds]),
    knockoutNationIds: Object.freeze([...qualifiers]),
    openingGames: Object.freeze(openingGames),
    semifinalVenueIds: Object.freeze([...edition.semifinalVenueIds]),
    finalVenueId: edition.finalVenueId });
};

const officialOutcome = (planned: RegionalNationalKnockoutGame,
  result: OfficialGameResult | undefined,
  edition: RegionalNationalKnockoutEdition): Readonly<{
    winnerId: string; loserId: string }> => {
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
    || !id(result.applicationId) || !id(result.closureId)
    || !nonnegative(result.durableRevision)
    || !nonnegative(result.homeRuns)
    || !nonnegative(result.awayRuns)
    || result.homeRuns === result.awayRuns
    || result.completionReason === 'TIE_LIMIT') {
    throw new Error('regional national knockout needs decided official games');
  }
  const score = createCanonicalLineScoreSnapshot(result.lineScore);
  const winnerId = result.homeRuns > result.awayRuns
    ? planned.homeNationId : planned.awayNationId;
  if (score.totals.home.runs !== result.homeRuns
    || score.totals.away.runs !== result.awayRuns
    || result.winnerClubId !== winnerId) {
    throw new Error('regional national winner contradicts official line score');
  }
  return Object.freeze({ winnerId,
    loserId: winnerId === planned.homeNationId
      ? planned.awayNationId : planned.homeNationId });
};
const stageOutcomes = (games: readonly RegionalNationalKnockoutGame[],
  results: readonly OfficialGameResult[],
  edition: RegionalNationalKnockoutEdition): readonly ReturnType<
    typeof officialOutcome>[] => {
  if (!Array.isArray(results) || results.length !== games.length
    || new Set(results.map((result) => result.gameId)).size
      !== games.length
    || new Set(results.map((result) => result.applicationId)).size
      !== games.length
    || new Set(results.map((result) =>
      result.venueBinding?.fixtureEventId)).size !== games.length) {
    throw new Error('regional national stage needs unique official games');
  }
  return Object.freeze(games.map((planned) =>
    officialOutcome(planned, results.find((result) =>
      result.gameId === planned.gameId), edition)));
};
const assertFresh = (results: readonly OfficialGameResult[],
  prior: readonly OfficialGameResult[]): void => {
  if (!Array.isArray(results) || results.some((result) =>
    prior.some((earlier) => earlier.applicationId === result.applicationId
      || earlier.venueBinding?.fixtureEventId
        === result.venueBinding?.fixtureEventId))) {
    throw new Error('regional national result evidence must be unique');
  }
};

export const planRegionalNationalSemifinals = (
  plan: RegionalNationalKnockoutPlan,
  quarterfinalResults: readonly OfficialGameResult[],
  source: RegionalNationalKnockoutSource,
): readonly RegionalNationalKnockoutGame[] => {
  const expected = planRegionalNationalKnockout(source);
  if (JSON.stringify(plan) !== JSON.stringify(expected)
    || expected.knockoutNationIds.length !== 8) {
    throw new Error('regional national quarterfinal plan is required');
  }
  assertFresh(quarterfinalResults, source.groupResults);
  const outcomes = stageOutcomes(expected.openingGames,
    quarterfinalResults, source.knockoutEdition);
  return Object.freeze(Array.from({ length: 2 }, (_, index) =>
    game(source.knockoutEdition, 'SEMIFINAL', index,
      outcomes[index * 2].winnerId,
      outcomes[index * 2 + 1].winnerId,
      expected.semifinalVenueIds[index])));
};

export const planRegionalNationalFinal = (
  plan: RegionalNationalKnockoutPlan,
  quarterfinalResults: readonly OfficialGameResult[],
  semifinalResults: readonly OfficialGameResult[],
  source: RegionalNationalKnockoutSource,
): RegionalNationalKnockoutGame => {
  const expected = planRegionalNationalKnockout(source);
  if (JSON.stringify(plan) !== JSON.stringify(expected)) {
    throw new Error('regional national final plan contradicts groups');
  }
  const semifinals = expected.knockoutNationIds.length === 8
    ? planRegionalNationalSemifinals(plan, quarterfinalResults, source)
    : expected.openingGames;
  if (expected.knockoutNationIds.length === 4
    && (!Array.isArray(quarterfinalResults)
      || quarterfinalResults.length !== 0)) {
    throw new Error('four-nation knockout has no quarterfinal');
  }
  assertFresh(semifinalResults,
    [...source.groupResults, ...quarterfinalResults]);
  const outcomes = stageOutcomes(semifinals, semifinalResults,
    source.knockoutEdition);
  return game(source.knockoutEdition, 'FINAL', 0,
    outcomes[0].winnerId, outcomes[1].winnerId,
    expected.finalVenueId);
};

/** Placement policy ranks eliminated cohorts from their official group rows. */
export const finalizeRegionalNationalKnockout = (
  plan: RegionalNationalKnockoutPlan,
  quarterfinalResults: readonly OfficialGameResult[],
  semifinalResults: readonly OfficialGameResult[],
  finalResult: OfficialGameResult,
  source: RegionalNationalKnockoutSource,
): RegionalNationalKnockoutOutcome => {
  const finalGame = planRegionalNationalFinal(plan,
    quarterfinalResults, semifinalResults, source);
  assertFresh([finalResult], [...source.groupResults,
    ...quarterfinalResults, ...semifinalResults]);
  const final = officialOutcome(finalGame, finalResult,
    source.knockoutEdition);
  const expected = planRegionalNationalKnockout(source);
  const semifinalGames = expected.knockoutNationIds.length === 8
    ? planRegionalNationalSemifinals(plan, quarterfinalResults, source)
    : expected.openingGames;
  const semifinalOutcomes = stageOutcomes(semifinalGames,
    semifinalResults, source.knockoutEdition);
  const quarterfinalOutcomes = expected.knockoutNationIds.length === 8
    ? stageOutcomes(expected.openingGames, quarterfinalResults,
      source.knockoutEdition) : [];
  const groups = finalizeRegionalNationalGroups(source.groupPlan,
    source.groupResults, source.groupEdition, source.authority);
  const rows = new Map(groups.groups.flatMap((group) =>
    group.standings.rows.map((row) => [row.clubId, row] as const)));
  const policy = source.knockoutEdition.placementPolicy;
  const rankCohort = (ids: readonly string[]): string[] =>
    [...ids].sort((left, right) => {
      const leftRow = rows.get(left)!;
      const rightRow = rows.get(right)!;
      for (const criterion of policy.criteria) {
        const difference = criterion === 'GROUP_WINS'
          ? rightRow.wins - leftRow.wins
          : criterion === 'GROUP_RUN_DIFFERENTIAL'
            ? rightRow.cappedRunDifferential
              - leftRow.cappedRunDifferential
            : leftRow.runsAgainst - rightRow.runsAgainst;
        if (difference !== 0) return difference;
      }
      return drawKey(policy.drawSeed, left)
        - drawKey(policy.drawSeed, right)
        || (left < right ? -1 : 1);
    });
  const entrants = groups.plan.groups.flatMap((group) =>
    group.nationIds);
  const advanced = new Set(expected.knockoutNationIds);
  const groupEliminated = entrants.filter((nationId) =>
    !advanced.has(nationId));
  const orderedNationIds = [final.winnerId, final.loserId,
    ...rankCohort(semifinalOutcomes.map((item) => item.loserId)),
    ...rankCohort(quarterfinalOutcomes.map((item) => item.loserId)),
    ...rankCohort(groupEliminated)];
  if (orderedNationIds.length !== entrants.length
    || new Set(orderedNationIds).size !== entrants.length) {
    throw new Error('regional national placement must rank every nation');
  }
  const resultApplicationIds = [...groups.resultApplicationIds,
    ...quarterfinalResults.map((result) => result.applicationId),
    ...semifinalResults.map((result) => result.applicationId),
    finalResult.applicationId];
  const placement: WbcRegionalPlacement = Object.freeze({
    region: source.groupEdition.region,
    editionId: source.groupEdition.editionId,
    snapshotId: JSON.stringify(['regional-national-placement',
      source.groupEdition.editionId, policy.version,
      ...resultApplicationIds]),
    completedAtDay: source.groupEdition.calendarWindow.endsOnDay,
    orderedNationIds: Object.freeze(orderedNationIds),
  });
  return Object.freeze({ plan: expected,
    semifinalGames: Object.freeze(semifinalGames),
    finalGame, championNationId: final.winnerId,
    placement,
    resultApplicationIds: Object.freeze(resultApplicationIds) });
};
