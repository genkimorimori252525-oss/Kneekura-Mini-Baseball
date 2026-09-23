import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import { createBaseScheduleSnapshot } from './LeagueSchedule';
import { applyOfficialTiebreakGame, buildOfficialStandings,
  createLeagueGroupAlignment, projectOfficialGroupStandings } from './OfficialStandings';
import type { OfficialGameResult } from './OfficialGameCompletion';

const schedule = createBaseScheduleSnapshot({
  seasonId: 'season-1', leagueId: 'fixture-league',
  calendarProfileVersion: 'fixture-v1', generatorVersion: 'generator-v1',
  scheduleSeed: 'seed', opponentMatrixVersion: 'matrix-v1',
  regularSeasonGamesPerClub: 4, memberClubIds: ['a', 'b'],
  opponentMatrix: [
    { homeClubId: 'a', awayClubId: 'b', gameCount: 2 },
    { homeClubId: 'b', awayClubId: 'a', gameCount: 2 },
  ],
  allowedDays: [1, 2, 3, 4], reservedWindows: [],
  series: [
    { seriesId: 's1', homeClubId: 'a', awayClubId: 'b', startsOnDay: 1, gameCount: 2 },
    { seriesId: 's2', homeClubId: 'b', awayClubId: 'a', startsOnDay: 3, gameCount: 2 },
  ],
});
const result = (gameIndex: number, homeRuns: number, awayRuns: number): OfficialGameResult => {
  const game = schedule.games[gameIndex];
  return {
    gameId: game.gameId, seasonId: 'season-1',
    homeClubId: game.homeClubId, awayClubId: game.awayClubId,
    homeRuns, awayRuns,
    winnerClubId: homeRuns > awayRuns ? game.homeClubId
      : awayRuns > homeRuns ? game.awayClubId : null,
    completionReason: homeRuns === awayRuns ? 'TIE_LIMIT' : 'BOTTOM_COMPLETE',
    ruleProfileId: asRuleProfileId('fixture-rules'),
    gamePolicyVersion: 'fixture-game-v1', closureId: `closure-${gameIndex}`,
    applicationId: `application-${gameIndex}`, durableRevision: gameIndex + 1,
    lineScore: {
      innings: [{ inning: 1, homeRuns, awayRuns }],
      totals: {
        home: { runs: homeRuns, hits: 0, errors: 0 },
        away: { runs: awayRuns, hits: 0, errors: 0 },
      },
    },
  };
};
const policy = {
  version: 'standing-v1', tieCreditNumerator: 1, tieCreditDenominator: 2,
  runDifferentialCapPerGame: 10,
};

it('ranks only a fully completed official season against the frozen schedule', () => {
  const standings = buildOfficialStandings(schedule, [
    result(0, 2, 1), result(1, 3, 0), result(2, 1, 2), result(3, 1, 0),
  ], policy);
  expect(standings.orderedClubIds).toEqual(['a', 'b']);
  expect(standings.rows.find((row) => row.clubId === 'a')).toMatchObject({
    wins: 3, losses: 1, games: 4,
  });
  expect(() => buildOfficialStandings(schedule, [result(0, 2, 1)], policy))
    .toThrow('complete official game results');
});

it('leaves an exact unresolved tie open for a profile-defined tiebreak game', () => {
  const standings = buildOfficialStandings(schedule, [
    result(0, 1, 0), result(1, 0, 1), result(2, 1, 0), result(3, 0, 1),
  ], policy);
  expect(standings.orderedClubIds).toBeNull();
  expect(standings.unresolvedTieGroups).toEqual([['a', 'b']]);
  const decidingGame: OfficialGameResult = {
    ...result(0, 2, 1), gameId: 'tiebreak-1',
    closureId: 'tiebreak-closure', applicationId: 'tiebreak-application',
  };
  const decided = applyOfficialTiebreakGame(standings, {
    version: 'tiebreak-v1', gameId: 'tiebreak-1', seasonId: 'season-1',
    homeClubId: 'a', awayClubId: 'b',
  }, decidingGame);
  expect(decided.orderedClubIds).toEqual(['a', 'b']);
  expect(decided.tiebreakResolutions).toEqual([{
    policyVersion: 'tiebreak-v1', gameId: 'tiebreak-1',
    applicationId: 'tiebreak-application', winnerClubId: 'a', loserClubId: 'b',
  }]);
  expect(() => applyOfficialTiebreakGame(standings, {
    version: 'tiebreak-v1', gameId: 'tiebreak-1', seasonId: 'wrong-season',
    homeClubId: 'a', awayClubId: 'b',
  }, decidingGame)).toThrow('season');
});

it('projects a group table from every official cross-group game in the full league', () => {
  const crossSchedule = createBaseScheduleSnapshot({
    seasonId: 'season-1', leagueId: 'cross-league',
    calendarProfileVersion: 'calendar-v1', generatorVersion: 'generator-v1',
    scheduleSeed: 'seed', opponentMatrixVersion: 'matrix-v1',
    regularSeasonGamesPerClub: 2, memberClubIds: ['a', 'b', 'c', 'd'],
    opponentMatrix: [
      { homeClubId: 'a', awayClubId: 'c', gameCount: 2 },
      { homeClubId: 'b', awayClubId: 'd', gameCount: 2 },
    ],
    allowedDays: [1, 2], reservedWindows: [],
    series: [
      { seriesId: 'ac', homeClubId: 'a', awayClubId: 'c', startsOnDay: 1, gameCount: 2 },
      { seriesId: 'bd', homeClubId: 'b', awayClubId: 'd', startsOnDay: 1, gameCount: 2 },
    ],
  });
  const crossResults = crossSchedule.games.map((game, index): OfficialGameResult => {
    const homeRuns = index === 3 ? 1 : 2;
    const awayRuns = index === 3 ? 2 : 1;
    return {
      gameId: game.gameId, seasonId: 'season-1',
      homeClubId: game.homeClubId, awayClubId: game.awayClubId,
      homeRuns, awayRuns,
      winnerClubId: homeRuns > awayRuns ? game.homeClubId : game.awayClubId,
      completionReason: 'BOTTOM_COMPLETE', ruleProfileId: asRuleProfileId('rules'),
      gamePolicyVersion: 'game-v1', closureId: `closure-cross-${index}`,
      applicationId: `apply-cross-${index}`, durableRevision: index + 1,
      lineScore: { innings: [{ inning: 1, homeRuns, awayRuns }],
        totals: { home: { runs: homeRuns, hits: 0, errors: 0 },
          away: { runs: awayRuns, hits: 0, errors: 0 } } },
    };
  });
  const alignment = createLeagueGroupAlignment(crossSchedule, 'alignment-v1', [
    { groupId: 'east', clubIds: ['a', 'b'] },
    { groupId: 'west', clubIds: ['c', 'd'] },
  ]);
  const projected = projectOfficialGroupStandings(
    crossSchedule, crossResults, policy, alignment, 'east');
  expect(projected).toMatchObject({ groupId: 'east', alignmentVersion: 'alignment-v1',
    leagueId: 'cross-league', orderedClubIds: ['a', 'b'] });
  expect(projected.resultApplicationIds).toHaveLength(4);
  expect(() => projectOfficialGroupStandings(crossSchedule,
    crossResults.slice(1), policy, alignment, 'east'))
    .toThrow('complete official game results');
});
