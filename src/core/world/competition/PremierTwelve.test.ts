import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import { createWorldNationalRankingHistory,
  recordPremierTwelveRankingResults }
  from './WorldNationalRankingHistory';
import type { OfficialGameResult } from './OfficialGameCompletion';
import { finalizePremierTwelve, finalizePremierTwelveGroups,
  planPremierTwelveFinalFour, planPremierTwelveGroups,
  planPremierTwelveMedalGames, type PremierTwelveAuthority,
  type PremierTwelveEdition, type PremierTwelveGame }
  from './PremierTwelve';

const nationIds = Array.from({ length: 12 }, (_, index) =>
  `nation-${index}`);
const ranking = { snapshotId: 'ranking-2034',
  policyVersion: 'world-national-results-v1', asOfDay: 100,
  orderedNationIds: [...nationIds, 'nation-12'],
  evidenceResultIds: ['national-result-1', 'national-result-2'] };
const authority: PremierTwelveAuthority = {
  editionCutoff: () => ({ snapshotId: 'cutoff-2034', day: 100 }),
  worldNationalRanking: () => ranking,
};
const edition: PremierTwelveEdition = {
  competitionId: 'premier-12', editionId: 'premier-2034',
  canonicalRole: 'PREMIER_12', formatVersion: 'premier-12-v1',
  ruleProfileVersion: 'premier-rules-v1',
  gamePolicyVersion: 'premier-games-v1',
  rankingPolicyVersion: ranking.policyVersion,
  qualificationCutoffSnapshotId: 'cutoff-2034',
  rankingSnapshotId: ranking.snapshotId,
  drawSnapshotId: 'draw-2034',
  hostingPolicyVersion: 'premier-hosts-v1',
  tiebreakPolicy: { version: 'premier-groups-v1',
    tieCreditNumerator: 0, tieCreditDenominator: 1,
    runDifferentialCapPerGame: 5 },
  finalFourPairingPolicy: { version: 'premier-pairs-v1',
    semifinalPairs: [[0, 3], [1, 2]] },
  hostNationIds: ['host-a', 'host-b'],
  groupHosts: [{ groupIndex: 0, nationId: 'host-a',
    cityId: 'city-a', venueId: 'venue-a' },
  { groupIndex: 1, nationId: 'host-b',
    cityId: 'city-b', venueId: 'venue-b' }],
  finalFourHost: { nationId: 'host-a',
    cityId: 'city-final', venueId: 'venue-final' },
  groups: [
    { groupIndex: 0, nationIds: nationIds.slice(0, 6) },
    { groupIndex: 1, nationIds: nationIds.slice(6, 12) },
  ],
  calendarWindow: { startsOnDay: 110, endsOnDay: 125 },
};
const result = (game: PremierTwelveGame,
  index: number): OfficialGameResult => ({
  gameId: game.gameId, seasonId: edition.editionId,
  homeClubId: game.homeNationId, awayClubId: game.awayNationId,
  homeRuns: 2, awayRuns: 1, winnerClubId: game.homeNationId,
  completionReason: 'BOTTOM_COMPLETE',
  ruleProfileId: asRuleProfileId(edition.ruleProfileVersion),
  gamePolicyVersion: edition.gamePolicyVersion,
  closureId: `closure-${index}`,
  applicationId: `application-${index}`,
  durableRevision: index + 1,
  venueBinding: { gameId: game.gameId, venueId: game.venueId,
    fixtureEventId: `fixture-${index}`, fixtureRevision: 1 },
  lineScore: { innings: [{ inning: 1,
    homeRuns: 2, awayRuns: 1 }], totals: {
    home: { runs: 2, hits: 0, errors: 0 },
    away: { runs: 1, hits: 0, errors: 0 } } },
});

it('selects ranking top twelve and decides group, bronze and final games', () => {
  const plan = planPremierTwelveGroups(edition, authority);
  expect(plan.groups.flatMap((group) => group.games)).toHaveLength(30);
  const results = plan.groups.flatMap((group) => group.games).map(result);
  const groups = finalizePremierTwelveGroups(plan,
    results, edition, authority);
  expect(groups.groups.map((group) => group.topTwoNationIds))
    .toEqual([['nation-0', 'nation-1'],
      ['nation-6', 'nation-7']]);
  const source = { edition, authority, groupPlan: plan,
    groupResults: results };
  const finalFour = planPremierTwelveFinalFour(source);
  const semifinals = finalFour.semifinalGames.map((game, index) =>
    result(game, index + 30));
  const medals = planPremierTwelveMedalGames(finalFour,
    semifinals, source);
  const bronze = result(medals.bronzeGame, 32);
  const final = result(medals.finalGame, 33);
  const outcome = finalizePremierTwelve(finalFour,
    semifinals, bronze, final, source);
  expect(outcome.championNationId).toBe(final.winnerClubId);
  expect(outcome.bronzeNationId).toBe(bronze.winnerClubId);
  expect(outcome.resultApplicationIds).toHaveLength(4);
  expect(outcome.medalGames.bronzeGame.venueId).toBe('venue-final');
  const nationalHistory = recordPremierTwelveRankingResults(
    createWorldNationalRankingHistory(), source,
    semifinals, bronze, final);
  expect(nationalHistory.editions[0].games).toHaveLength(34);
});

it('rejects non-top-twelve entrants and duplicate medal evidence', () => {
  const badEdition = structuredClone(edition);
  (badEdition.groups[0].nationIds[0] as string) = 'nation-12';
  expect(() => planPremierTwelveGroups(badEdition, authority))
    .toThrow('top twelve');
  const plan = planPremierTwelveGroups(edition, authority);
  const groupResults = plan.groups.flatMap((group) => group.games)
    .map(result);
  expect(() => finalizePremierTwelveGroups(plan, groupResults,
    edition, { ...authority, worldNationalRanking: () => ({
      ...ranking, orderedNationIds: [nationIds[1], nationIds[0],
        ...ranking.orderedNationIds.slice(2)] }) }))
    .toThrow('ranking');
  const source = { edition, authority, groupPlan: plan, groupResults };
  const finalFour = planPremierTwelveFinalFour(source);
  const semifinals = finalFour.semifinalGames.map((game, index) =>
    result(game, index + 30));
  const medals = planPremierTwelveMedalGames(finalFour,
    semifinals, source);
  const bronze = result(medals.bronzeGame, 32);
  const final = result(medals.finalGame, 33);
  expect(() => finalizePremierTwelve(finalFour,
    semifinals, bronze,
    { ...final, applicationId: bronze.applicationId }, source))
    .toThrow('unique');
});
