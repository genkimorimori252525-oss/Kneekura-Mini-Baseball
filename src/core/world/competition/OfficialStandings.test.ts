import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import { createBaseScheduleSnapshot } from './LeagueSchedule';
import { buildOfficialStandings } from './OfficialStandings';
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
});
