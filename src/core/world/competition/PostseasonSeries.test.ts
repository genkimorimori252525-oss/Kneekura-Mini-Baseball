import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import type { OfficialGameResult } from './OfficialGameCompletion';
import { resolvePostseasonSeries } from './PostseasonSeries';

const scheduledGames = ['a', 'a', 'b', 'b', 'a'].map((homeClubId, index) => ({
  gameId: `series-game-${index + 1}`, homeClubId, awayClubId: homeClubId === 'a' ? 'b' : 'a',
}));
const game = (index: number, winnerClubId: 'a' | 'b'): OfficialGameResult => {
  const scheduled = scheduledGames[index];
  const homeRuns = winnerClubId === scheduled.homeClubId ? 2 : 1;
  const awayRuns = winnerClubId === scheduled.awayClubId ? 2 : 1;
  return {
    gameId: scheduled.gameId, seasonId: 'season-1',
    homeClubId: scheduled.homeClubId, awayClubId: scheduled.awayClubId,
    homeRuns, awayRuns, winnerClubId, completionReason: 'BOTTOM_COMPLETE',
    ruleProfileId: asRuleProfileId('rules'), gamePolicyVersion: 'game-v1',
    closureId: `closure-${index}`, applicationId: `application-${index}`,
    durableRevision: index + 1,
    lineScore: { innings: [{ inning: 1, homeRuns, awayRuns }],
      totals: { home: { runs: homeRuns, hits: 0, errors: 0 },
        away: { runs: awayRuns, hits: 0, errors: 0 } } },
  };
};
const plan = {
  seriesId: 'semi-1', seasonId: 'season-1', bestOf: 5,
  higherSeedClubId: 'a', lowerSeedClubId: 'b', scheduledGames,
};

it('resolves a best-of-five from official game results and stops after three wins', () => {
  expect(resolvePostseasonSeries(plan, [game(0, 'a'), game(1, 'b')]))
    .toMatchObject({ status: 'PENDING', higherSeedWins: 1, lowerSeedWins: 1 });
  const result = resolvePostseasonSeries(plan, [
    game(0, 'a'), game(1, 'b'), game(2, 'a'), game(3, 'a'),
  ]);
  expect(result).toMatchObject({
    status: 'COMPLETE', winnerClubId: 'a', runnerUpClubId: 'b',
    higherSeedWins: 3, lowerSeedWins: 1,
  });
  expect(() => resolvePostseasonSeries(plan, [
    game(0, 'a'), game(1, 'b'), game(2, 'a'), game(3, 'a'), game(4, 'b'),
  ])).toThrow('after a series winner');
  expect(() => resolvePostseasonSeries(plan, [
    game(0, 'a'), { ...game(1, 'b'), closureId: 'closure-0' },
  ])).toThrow('unique official decided games');
});
