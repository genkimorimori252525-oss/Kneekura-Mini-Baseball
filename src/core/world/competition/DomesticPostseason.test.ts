import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import type { OfficialGameResult } from './OfficialGameCompletion';
import type { PostseasonSeriesPlan } from './PostseasonSeries';
import type { OfficialStandingsSnapshot } from './OfficialStandings';
import { resolveDomesticPostseason } from './DomesticPostseason';

const standings = (orderedClubIds: readonly string[]): OfficialStandingsSnapshot => ({
  seasonId: 'season-1', leagueId: 'league-fixture', tiebreakPolicyVersion: 'policy-v1',
  scheduleRevisionEventIds: [], orderedClubIds, unresolvedTieGroups: [],
  resultApplicationIds: [], tiebreakResolutions: [],
  rows: orderedClubIds.map((clubId) => ({
    clubId, games: 0, wins: 0, losses: 0, ties: 0,
    runsFor: 0, runsAgainst: 0, cappedRunDifferential: 0,
  })),
});

const series = (seriesId: string, high: string, low: string, bestOf: number): PostseasonSeriesPlan => ({
  seriesId, seasonId: 'season-1', bestOf,
  higherSeedClubId: high, lowerSeedClubId: low,
  scheduledGames: Array.from({ length: bestOf }, (_, index) => {
    const homeClubId = index < Math.floor(bestOf / 2) + 1 ? high : low;
    return { gameId: `${seriesId}-${index}`, homeClubId,
      awayClubId: homeClubId === high ? low : high };
  }),
});
const wins = (plan: PostseasonSeriesPlan, winner: string): OfficialGameResult[] =>
  plan.scheduledGames.slice(0, Math.floor(plan.bestOf / 2) + 1).map((game, index) => {
    const homeRuns = game.homeClubId === winner ? 2 : 1;
    const awayRuns = game.awayClubId === winner ? 2 : 1;
    return {
      gameId: game.gameId, seasonId: plan.seasonId,
      homeClubId: game.homeClubId, awayClubId: game.awayClubId,
      homeRuns, awayRuns, winnerClubId: winner, completionReason: 'BOTTOM_COMPLETE',
      ruleProfileId: asRuleProfileId('rules'), gamePolicyVersion: 'game-v1',
      closureId: `closure-${game.gameId}`, applicationId: `application-${game.gameId}`,
      durableRevision: index + 1,
      lineScore: { innings: [{ inning: 1, homeRuns, awayRuns }],
        totals: { home: { runs: homeRuns, hits: 0, errors: 0 },
          away: { runs: awayRuns, hits: 0, errors: 0 } } },
    };
  });

it('resolves TOP4_SERIES only after both semifinals and final are official', () => {
  const ranking = standings(['a', 'b', 'c', 'd', 'e']);
  const first = series('sf-1', 'a', 'd', 5);
  const second = series('sf-2', 'b', 'c', 5);
  const final = series('final', 'a', 'c', 7);
  const pending = resolveDomesticPostseason('TOP4_SERIES', ranking, [
    { stage: 'semifinal-1', plan: first, results: wins(first, 'a') },
    { stage: 'semifinal-2', plan: second, results: wins(second, 'c') },
  ]);
  expect(pending).toMatchObject({ status: 'PENDING', championClubId: null,
    nextSeries: [{ stage: 'final', higherSeedClubId: 'a', lowerSeedClubId: 'c', bestOf: 7 }] });
  expect(resolveDomesticPostseason('TOP4_SERIES', ranking, [
    { stage: 'semifinal-1', plan: first, results: wins(first, 'a') },
    { stage: 'semifinal-2', plan: second, results: wins(second, 'c') },
    { stage: 'final', plan: final, results: wins(final, 'c') },
  ])).toMatchObject({ status: 'COMPLETE', championClubId: 'c', runnerUpClubId: 'a' });
  expect(() => resolveDomesticPostseason('TOP4_SERIES', ranking, [
    { stage: 'final', plan: final, results: wins(final, 'c') },
  ])).toThrow('upstream');
  expect(() => resolveDomesticPostseason('TOP4_SERIES', ranking, [
    { stage: 'semifinal-1', plan: first, results: wins(first, 'a') },
    { stage: 'semifinal-2', plan: { ...second, seasonId: 'another-season' }, results: [] },
  ])).toThrow('season');
  expect(() => resolveDomesticPostseason('TABLE_TITLE', {
    ...ranking, orderedClubIds: null, unresolvedTieGroups: [['a', 'b']],
  }, [])).toThrow('unresolved');
});

it('uses Europe shorter series and rejects incorrect series lengths', () => {
  const short = series('euro-sf', 'a', 'd', 3);
  expect(resolveDomesticPostseason('EURO_TOP4', standings(['a', 'b', 'c', 'd']), [
    { stage: 'semifinal-1', plan: short, results: [] },
  ])).toMatchObject({ status: 'PENDING' });
  expect(() => resolveDomesticPostseason('EURO_TOP4', standings(['a', 'b', 'c', 'd']), [
    { stage: 'semifinal-1', plan: series('wrong', 'a', 'd', 5), results: [] },
  ])).toThrow('series format');
});

it('resolves the Korean ladder and Australia top-two final with seed priority', () => {
  const round1 = series('r1', 'd', 'e', 3);
  const round2 = series('r2', 'c', 'e', 5);
  const round3 = series('r3', 'b', 'c', 5);
  const final = series('r4', 'a', 'c', 7);
  expect(resolveDomesticPostseason('LADDER', standings(['a', 'b', 'c', 'd', 'e']), [
    { stage: 'ladder-1', plan: round1, results: wins(round1, 'e') },
    { stage: 'ladder-2', plan: round2, results: wins(round2, 'c') },
    { stage: 'ladder-3', plan: round3, results: wins(round3, 'c') },
    { stage: 'final', plan: final, results: wins(final, 'a') },
  ])).toMatchObject({ status: 'COMPLETE', championClubId: 'a', runnerUpClubId: 'c' });
  const australia = series('au-final', 'a', 'b', 5);
  expect(resolveDomesticPostseason('TOP2_FINAL', standings(['a', 'b', 'c', 'd']), [
    { stage: 'final', plan: australia, results: wins(australia, 'b') },
  ])).toMatchObject({ status: 'COMPLETE', championClubId: 'b', runnerUpClubId: 'a' });
});
