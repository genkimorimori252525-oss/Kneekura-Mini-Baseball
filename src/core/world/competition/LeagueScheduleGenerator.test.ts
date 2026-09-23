import { expect, it } from 'vitest';
import { generateLeagueSchedule } from './LeagueScheduleGenerator';

it('builds deterministic series rounds from a complete opponent matrix', () => {
  const clubs = ['a', 'b', 'c', 'd'];
  const opponentMatrix = clubs.flatMap((homeClubId) => clubs
    .filter((awayClubId) => awayClubId !== homeClubId)
    .map((awayClubId) => ({ homeClubId, awayClubId, gameCount: 2 })));
  const input = {
    seasonId: 'season-1', leagueId: 'fixture-league',
    calendarProfileVersion: 'fixture-v1', generatorVersion: 'series-round-v1',
    scheduleSeed: 'seed-1', opponentMatrixVersion: 'matrix-v1',
    regularSeasonGamesPerClub: 12, memberClubIds: clubs, opponentMatrix,
    allowedDays: Array.from({ length: 30 }, (_, index) => index + 1),
    reservedWindows: [{ kind: 'WORLD' as const, startsOnDay: 5, endsOnDay: 6 }],
    preferredSeriesLength: 2 as const, minimumDaysBetweenRounds: 0,
  };
  const first = generateLeagueSchedule(input);
  expect(first.games).toHaveLength(24);
  expect(first.series).toHaveLength(12);
  expect(first.games.every((game) => game.day < 5 || game.day > 6)).toBe(true);
  expect(generateLeagueSchedule(input)).toEqual(first);
  expect(() => generateLeagueSchedule({ ...input, allowedDays: [1, 2] }))
    .toThrow('schedule validation failure');
});

it('retains all 162 games per club in a 30-club season fixture', () => {
  const clubs = Array.from({ length: 30 }, (_, index) => `club-${index}`);
  const opponentMatrix = clubs.flatMap((homeClubId, homeIndex) => clubs
    .filter((awayClubId, awayIndex) => awayClubId !== homeClubId
      && awayIndex !== (homeIndex + 1) % 30
      && awayIndex !== (homeIndex + 29) % 30)
    .map((awayClubId) => ({ homeClubId, awayClubId, gameCount: 3 })));
  const schedule = generateLeagueSchedule({
    seasonId: 'large-season', leagueId: 'league-008',
    calendarProfileVersion: 'league-calendar-v1', generatorVersion: 'series-round-v1',
    scheduleSeed: 'seed-large', opponentMatrixVersion: 'fixture-matrix-v1',
    regularSeasonGamesPerClub: 162, memberClubIds: clubs, opponentMatrix,
    allowedDays: Array.from({ length: 220 }, (_, index) => index + 1),
    reservedWindows: [{ kind: 'WORLD', startsOnDay: 20, endsOnDay: 29 }],
    preferredSeriesLength: 3, minimumDaysBetweenRounds: 0,
  });
  expect(schedule.games).toHaveLength(30 * 162 / 2);
  expect(schedule.games.every((game) => game.day < 20 || game.day > 29)).toBe(true);
});
