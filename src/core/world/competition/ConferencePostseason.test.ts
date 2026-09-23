import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import type { OfficialGameResult } from './OfficialGameCompletion';
import type { OfficialStandingsSnapshot } from './OfficialStandings';
import type { PostseasonSeriesPlan } from './PostseasonSeries';
import { resolveConferencePostseason } from './ConferencePostseason';

const standing = (groupId: string, clubs: readonly string[]): OfficialStandingsSnapshot => ({
  seasonId: 'season-1', leagueId: groupId, tiebreakPolicyVersion: 'table-v1',
  scheduleRevisionEventIds: [], resultApplicationIds: [], tiebreakResolutions: [],
  orderedClubIds: clubs, unresolvedTieGroups: [],
  rows: clubs.map((clubId) => ({ clubId, games: 120, wins: 60, losses: 60,
    ties: 0, runsFor: 300, runsAgainst: 300, cappedRunDifferential: 0 })),
});
const plan = (seriesId: string, high: string, low: string, bestOf: number): PostseasonSeriesPlan => ({
  seriesId, seasonId: 'season-1', higherSeedClubId: high,
  lowerSeedClubId: low, bestOf,
  scheduledGames: Array.from({ length: bestOf }, (_, index) => {
    const homeClubId = index < Math.floor(bestOf / 2) + 1 ? high : low;
    return { gameId: `${seriesId}-${index}`, homeClubId,
      awayClubId: homeClubId === high ? low : high };
  }),
});
const wins = (series: PostseasonSeriesPlan, winner: string): OfficialGameResult[] =>
  series.scheduledGames.slice(0, Math.floor(series.bestOf / 2) + 1).map((game, index) => {
    const homeRuns = game.homeClubId === winner ? 2 : 1;
    const awayRuns = game.awayClubId === winner ? 2 : 1;
    return {
      gameId: game.gameId, seasonId: 'season-1',
      homeClubId: game.homeClubId, awayClubId: game.awayClubId,
      homeRuns, awayRuns, winnerClubId: winner, completionReason: 'BOTTOM_COMPLETE',
      ruleProfileId: asRuleProfileId('rules'), gamePolicyVersion: 'game-v1',
      closureId: `closure-${game.gameId}`, applicationId: `apply-${game.gameId}`,
      durableRevision: index + 1,
      lineScore: { innings: [{ inning: 1, homeRuns, awayRuns }],
        totals: { home: { runs: homeRuns, hits: 0, errors: 0 },
          away: { runs: awayRuns, hits: 0, errors: 0 } } },
    };
  });

it('advances Japanese league playoffs and championship only after official series wins', () => {
  const a = standing('group-a', ['a1', 'a2', 'a3', 'a4', 'a5', 'a6']);
  const b = standing('group-b', ['b1', 'b2', 'b3', 'b4', 'b5', 'b6']);
  const aPre = plan('a-pre', 'a2', 'a3', 3);
  const aFinal = plan('a-final', 'a1', 'a2', 5);
  const bPre = plan('b-pre', 'b2', 'b3', 3);
  const bFinal = plan('b-final', 'b1', 'b3', 5);
  const groups = [
    { groupId: 'group-a', standings: a,
      series: [{ stage: 'preliminary' as const, plan: aPre, results: wins(aPre, 'a2') },
        { stage: 'group-final' as const, plan: aFinal, results: wins(aFinal, 'a2') }] },
    { groupId: 'group-b', standings: b,
      series: [{ stage: 'preliminary' as const, plan: bPre, results: wins(bPre, 'b3') },
        { stage: 'group-final' as const, plan: bFinal, results: wins(bFinal, 'b1') }] },
  ];
  const policy = { version: 'japan-v1', format: 'JAPAN' as const,
    championshipHigherSeedGroupId: 'group-b' };
  expect(resolveConferencePostseason(policy, groups, null)).toMatchObject({
    status: 'PENDING', nextChampionship: { higherSeedClubId: 'b1',
      lowerSeedClubId: 'a2', bestOf: 7 },
  });
  const final = plan('national', 'b1', 'a2', 7);
  expect(resolveConferencePostseason(policy, groups, { plan: final, results: wins(final, 'a2') }))
    .toMatchObject({ status: 'COMPLETE', championClubId: 'a2', runnerUpClubId: 'b1',
      groupChampions: [{ groupId: 'group-a', clubId: 'a2' },
        { groupId: 'group-b', clubId: 'b1' }] });
  expect(() => resolveConferencePostseason(policy, [groups[0], {
    ...groups[1], series: [],
  }], { plan: final, results: wins(final, 'a2') })).toThrow('upstream');
});

it('enforces the distinct Mexico and Cuba zone-final lengths', () => {
  const north = standing('north', Array.from({ length: 10 }, (_, i) => `n${i + 1}`));
  const south = standing('south', Array.from({ length: 10 }, (_, i) => `s${i + 1}`));
  const semifinal = plan('mex-sf', 'n1', 'n4', 5);
  const groups = [
    { groupId: 'north', standings: north,
      series: [{ stage: 'semifinal-1' as const, plan: semifinal, results: [] }] },
    { groupId: 'south', standings: south, series: [] },
  ];
  expect(resolveConferencePostseason({ version: 'mex-v1', format: 'MEXICO',
    championshipHigherSeedGroupId: 'north' }, groups, null)).toMatchObject({ status: 'PENDING' });
  expect(() => resolveConferencePostseason({ version: 'cuba-v1', format: 'CUBA',
    championshipHigherSeedGroupId: 'north' }, groups, null)).toThrow('group club count');
  const west = standing('west', Array.from({ length: 8 }, (_, i) => `w${i + 1}`));
  const east = standing('east', Array.from({ length: 8 }, (_, i) => `e${i + 1}`));
  const first = plan('cuba-sf-1', 'w1', 'w4', 5);
  const second = plan('cuba-sf-2', 'w2', 'w3', 5);
  const wrongFinal = plan('cuba-final-wrong', 'w1', 'w2', 7);
  expect(() => resolveConferencePostseason({ version: 'cuba-v1', format: 'CUBA',
    championshipHigherSeedGroupId: 'west' }, [
    { groupId: 'west', standings: west, series: [
      { stage: 'semifinal-1', plan: first, results: wins(first, 'w1') },
      { stage: 'semifinal-2', plan: second, results: wins(second, 'w2') },
      { stage: 'group-final', plan: wrongFinal, results: [] },
    ] },
    { groupId: 'east', standings: east, series: [] },
  ], null)).toThrow('series format');
});
