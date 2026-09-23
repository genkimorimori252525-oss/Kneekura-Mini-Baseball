import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import type { OfficialGameResult } from './OfficialGameCompletion';
import type { CompetitionDraw } from './CompetitionDraw';
import { assignContinentalGroupHomeSeries,
  createHomeFairnessLedger } from './ContinentalHomeFairness';
import { createContinentalGroupGamePlan,
  finalizeContinentalGroupResults } from './ContinentalGroupResults';

const draw: CompetitionDraw = {
  editionId: 'continental-2027', drawPolicyVersion: 'draw-v1',
  drawSeed: 'seed-1', relaxationOrder: ['REMATCH_AVOIDANCE',
    'REGIONAL_DIVERSITY', 'SAME_LEAGUE_AVOIDANCE'],
  groups: ['abcd', 'efgh', 'ijkl', 'mnop'].map((members) =>
    [...members].map((teamId, index) => ({ teamId, pot: index + 1,
      leagueId: `league-${teamId}`, regionId: `region-${teamId}` }))),
  appliedConstraints: [], relaxedConstraints: [],
  softViolationCounts: { sameLeague: 0, sameRegion: 0, rematch: 0 },
};
const assignment = assignContinentalGroupHomeSeries({
  competitionId: 'continental-a', editionId: draw.editionId,
  editionOrdinal: 1, expectedRevision: 0, draw,
  ledger: createHomeFairnessLedger('continental-a'),
  policy: { version: 'fairness-v1', recentEditionWeights: [1] },
});
const policy = { version: 'group-tiebreak-v1', tieCreditNumerator: 0,
  tieCreditDenominator: 1, runDifferentialCapPerGame: 5 };
const result = (game: Readonly<{ gameId: string; homeClubId: string;
  awayClubId: string }>, index: number): OfficialGameResult => {
  const homeWon = game.homeClubId < game.awayClubId;
  const homeRuns = homeWon ? 2 : 1;
  const awayRuns = homeWon ? 1 : 2;
  return { ...game, seasonId: draw.editionId, homeRuns, awayRuns,
    winnerClubId: homeWon ? game.homeClubId : game.awayClubId,
    completionReason: 'BOTTOM_COMPLETE',
    ruleProfileId: asRuleProfileId('continental-rules-v1'),
    gamePolicyVersion: 'group-game-v1', closureId: `closure-${index}`,
    applicationId: `application-${index}`, durableRevision: index + 1,
    lineScore: { innings: [{ inning: 1, homeRuns, awayRuns }],
      totals: { home: { runs: homeRuns, hits: 0, errors: 0 },
        away: { runs: awayRuns, hits: 0, errors: 0 } } },
  };
};

it('derives 72 unique official game identities and qualifies only complete group results', () => {
  const plan = createContinentalGroupGamePlan(assignment);
  expect(plan.groups).toHaveLength(4);
  expect(plan.groups.every((group) => group.games.length === 18)).toBe(true);
  const games = plan.groups.flatMap((group) => group.games);
  expect(new Set(games.map((game) => game.gameId)).size).toBe(72);
  expect(games.every((game) => game.seriesId && game.gameIndex >= 1
    && game.gameIndex <= 3)).toBe(true);
  const results = games.map(result);
  const snapshot = finalizeContinentalGroupResults(plan, results, policy);
  expect(snapshot.tiebreakPolicy).toEqual(policy);
  expect(Object.isFrozen(snapshot.tiebreakPolicy)).toBe(true);
  expect(snapshot.groups.map((group) => group.qualifierClubIds))
    .toEqual([['a', 'b'], ['e', 'f'], ['i', 'j'], ['m', 'n']]);
  expect(snapshot.groups.every((group) => group.standings.rows.every((row) =>
    row.games === 9))).toBe(true);
  expect(() => finalizeContinentalGroupResults(plan,
    results.slice(1), policy)).toThrow('complete');
  expect(() => finalizeContinentalGroupResults(plan,
    [results[0], results[0], ...results.slice(2)], policy))
    .toThrow('unique');
  expect(() => finalizeContinentalGroupResults(plan,
    [{ ...results[0], homeClubId: 'wrong' }, ...results.slice(1)], policy))
    .toThrow('scheduled game');
  const tied = results.map((item): OfficialGameResult => ({
    ...item, homeRuns: 1, awayRuns: 1, winnerClubId: null,
    completionReason: 'TIE_LIMIT',
    lineScore: { innings: [{ inning: 1, homeRuns: 1, awayRuns: 1 }],
      totals: { home: { runs: 1, hits: 0, errors: 0 },
        away: { runs: 1, hits: 0, errors: 0 } } },
  }));
  expect(finalizeContinentalGroupResults(plan, tied, policy).groups
    .every((group) => group.qualifierClubIds === null)).toBe(true);
  const mutable = structuredClone(plan);
  const detached = finalizeContinentalGroupResults(mutable, results, policy);
  (mutable.groups[0].games[0] as { homeClubId: string }).homeClubId = 'changed';
  expect(detached.gamePlan.groups[0].games[0].homeClubId)
    .toBe(games[0].homeClubId);
  const forged = structuredClone(plan);
  (forged.groups[0] as { games: typeof plan.groups[0]['games'] }).games =
    Array.from({ length: 18 }, (_, index) => {
      const seriesIndex = Math.floor(index / 3);
      const members = seriesIndex < 3 ? ['a', 'b'] : ['c', 'd'];
      const homeClubId = seriesIndex % 3 === 0 ? members[0] : members[1];
      const awayClubId = seriesIndex % 3 === 0 ? members[1] : members[0];
      const seriesId = `forged-${seriesIndex}`;
      const gameIndex = (index % 3 + 1) as 1 | 2 | 3;
      return { seriesId, gameIndex, homeClubId, awayClubId,
        gameId: JSON.stringify(['continental-group-game',
          seriesId, gameIndex]) };
    });
  expect(() => finalizeContinentalGroupResults(forged, results, policy))
    .toThrow('six legal series');
});
