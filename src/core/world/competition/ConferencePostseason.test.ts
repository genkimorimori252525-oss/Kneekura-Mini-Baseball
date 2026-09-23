import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import { createBaseScheduleSnapshot } from './LeagueSchedule';
import type { OfficialGameResult } from './OfficialGameCompletion';
import type { LeagueGroupAlignment, OfficialGroupStandingsSnapshot } from './OfficialStandings';
import { createLeagueGroupAlignment, projectOfficialGroupStandings } from './OfficialStandings';
import type { PostseasonSeriesPlan } from './PostseasonSeries';
import { resolveConferencePostseason } from './ConferencePostseason';

const standing = (groupId: string, clubs: readonly string[],
  leagueId = 'league-001'): OfficialGroupStandingsSnapshot => ({
  seasonId: 'season-1', leagueId, groupId, alignmentVersion: 'alignment-v1',
  memberClubIds: clubs, tiebreakPolicyVersion: 'table-v1',
  scheduleRevisionEventIds: [], resultApplicationIds: [], tiebreakResolutions: [],
  orderedClubIds: clubs, unresolvedTieGroups: [],
  rows: clubs.map((clubId) => ({ clubId, games: 120, wins: 60, losses: 60,
    ties: 0, runsFor: 300, runsAgainst: 300, cappedRunDifferential: 0 })),
});
const alignment = (leagueId: string,
  groups: readonly Readonly<{ groupId: string; clubIds: readonly string[] }>[]): LeagueGroupAlignment => ({
  version: 'alignment-v1', seasonId: 'season-1', leagueId, groups,
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
  const grouped = alignment('league-001', [
    { groupId: 'group-a', clubIds: a.memberClubIds },
    { groupId: 'group-b', clubIds: b.memberClubIds },
  ]);
  expect(resolveConferencePostseason(policy, grouped, groups, null)).toMatchObject({
    status: 'PENDING', nextChampionship: { higherSeedClubId: 'b1',
      lowerSeedClubId: 'a2', bestOf: 7 },
  });
  const final = plan('national', 'b1', 'a2', 7);
  expect(resolveConferencePostseason(policy, grouped, groups,
    { plan: final, results: wins(final, 'a2') }))
    .toMatchObject({ status: 'COMPLETE', championClubId: 'a2', runnerUpClubId: 'b1',
      groupChampions: [{ groupId: 'group-a', clubId: 'a2' },
        { groupId: 'group-b', clubId: 'b1' }] });
  expect(() => resolveConferencePostseason(policy, grouped, [groups[0], {
    ...groups[1], series: [],
  }], { plan: final, results: wins(final, 'a2') })).toThrow('upstream');
  expect(() => resolveConferencePostseason(policy, grouped, [{
    ...groups[0], standings: { ...a, resultApplicationIds: ['apply-a-pre-0'] },
  }, groups[1]], null)).toThrow('official application');
  expect(() => resolveConferencePostseason(policy, grouped, [{
    ...groups[0], groupId: 'wrong-group',
  }, groups[1]], null)).toThrow('alignment');
});

it('enforces the distinct Mexico and Cuba zone-final lengths', () => {
  const north = standing('north', Array.from({ length: 10 }, (_, i) => `n${i + 1}`), 'league-009');
  const south = standing('south', Array.from({ length: 10 }, (_, i) => `s${i + 1}`), 'league-009');
  const mexicoAlignment = alignment('league-009', [
    { groupId: 'north', clubIds: north.memberClubIds },
    { groupId: 'south', clubIds: south.memberClubIds },
  ]);
  const semifinal = plan('mex-sf', 'n1', 'n4', 5);
  const groups = [
    { groupId: 'north', standings: north,
      series: [{ stage: 'semifinal-1' as const, plan: semifinal, results: [] }] },
    { groupId: 'south', standings: south, series: [] },
  ];
  expect(resolveConferencePostseason({ version: 'mex-v1', format: 'MEXICO',
    championshipHigherSeedGroupId: 'north' }, mexicoAlignment, groups, null))
    .toMatchObject({ status: 'PENDING' });
  expect(() => resolveConferencePostseason({ version: 'cuba-v1', format: 'CUBA',
    championshipHigherSeedGroupId: 'north' }, mexicoAlignment, groups, null))
    .toThrow('league');
  const west = standing('west', Array.from({ length: 8 }, (_, i) => `w${i + 1}`), 'league-013');
  const east = standing('east', Array.from({ length: 8 }, (_, i) => `e${i + 1}`), 'league-013');
  const cubaAlignment = alignment('league-013', [
    { groupId: 'west', clubIds: west.memberClubIds },
    { groupId: 'east', clubIds: east.memberClubIds },
  ]);
  const first = plan('cuba-sf-1', 'w1', 'w4', 5);
  const second = plan('cuba-sf-2', 'w2', 'w3', 5);
  const wrongFinal = plan('cuba-final-wrong', 'w1', 'w2', 7);
  expect(() => resolveConferencePostseason({ version: 'cuba-v1', format: 'CUBA',
    championshipHigherSeedGroupId: 'west' }, cubaAlignment, [
    { groupId: 'west', standings: west, series: [
      { stage: 'semifinal-1', plan: first, results: wins(first, 'w1') },
      { stage: 'semifinal-2', plan: second, results: wins(second, 'w2') },
      { stage: 'group-final', plan: wrongFinal, results: [] },
    ] },
    { groupId: 'east', standings: east, series: [] },
  ], null)).toThrow('series format');
});

it('accepts group tables projected from complete cross-group official games', () => {
  const a = Array.from({ length: 6 }, (_, index) => `a${index + 1}`);
  const b = Array.from({ length: 6 }, (_, index) => `b${index + 1}`);
  const schedule = createBaseScheduleSnapshot({
    seasonId: 'season-1', leagueId: 'league-001',
    calendarProfileVersion: 'calendar-v1', generatorVersion: 'generator-v1',
    scheduleSeed: 'seed', opponentMatrixVersion: 'matrix-v1',
    regularSeasonGamesPerClub: 2, memberClubIds: [...a, ...b],
    opponentMatrix: a.map((homeClubId, index) => ({
      homeClubId, awayClubId: b[index], gameCount: 2,
    })),
    allowedDays: [1, 2], reservedWindows: [],
    series: a.map((homeClubId, index) => ({ seriesId: `cross-${index}`,
      homeClubId, awayClubId: b[index], startsOnDay: 1, gameCount: 2 as const })),
  });
  const results = schedule.games.map((game, index): OfficialGameResult => {
    const homeRuns = Math.floor(index / 2) + 1;
    const awayRuns = 0;
    return { gameId: game.gameId, seasonId: 'season-1',
      homeClubId: game.homeClubId, awayClubId: game.awayClubId,
      homeRuns, awayRuns, winnerClubId: game.homeClubId,
      completionReason: 'BOTTOM_COMPLETE', ruleProfileId: asRuleProfileId('rules'),
      gamePolicyVersion: 'game-v1', closureId: `cross-closure-${index}`,
      applicationId: `cross-apply-${index}`, durableRevision: index + 1,
      lineScore: { innings: [{ inning: 1, homeRuns, awayRuns }],
        totals: { home: { runs: homeRuns, hits: 0, errors: 0 },
          away: { runs: awayRuns, hits: 0, errors: 0 } } },
    };
  });
  const grouped = createLeagueGroupAlignment(schedule, 'alignment-v1', [
    { groupId: 'east', clubIds: a }, { groupId: 'west', clubIds: b },
  ]);
  const policy = { version: 'standing-v1', tieCreditNumerator: 1,
    tieCreditDenominator: 2, runDifferentialCapPerGame: 10 };
  const east = projectOfficialGroupStandings(schedule, results, policy, grouped, 'east');
  const west = projectOfficialGroupStandings(schedule, results, policy, grouped, 'west');
  expect(resolveConferencePostseason({ version: 'japan-v1', format: 'JAPAN',
    championshipHigherSeedGroupId: 'east' }, grouped, [
    { groupId: 'east', standings: east, series: [] },
    { groupId: 'west', standings: west, series: [] },
  ], null)).toMatchObject({ status: 'PENDING', nextGroupSeries: [
    { groupId: 'east', stage: 'preliminary', higherSeedClubId: 'a5', lowerSeedClubId: 'a4' },
    { groupId: 'west', stage: 'preliminary', higherSeedClubId: 'b2', lowerSeedClubId: 'b3' },
  ] });
});
