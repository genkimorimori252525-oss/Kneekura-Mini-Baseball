import { expect, it } from 'vitest';
import { applyScheduleRevisions, createBaseScheduleSnapshot } from './LeagueSchedule';
import { captureOfficialStandingsSchedule } from './OfficialStandingsScheduleSource';

const base = () => createBaseScheduleSnapshot({
  seasonId: 'season-a', leagueId: 'league-a',
  calendarProfileVersion: 'calendar-v1', generatorVersion: 'generator-v1',
  scheduleSeed: 'seed-a', opponentMatrixVersion: 'matrix-v1',
  regularSeasonGamesPerClub: 2, memberClubIds: ['a', 'b'],
  opponentMatrix: [
    { homeClubId: 'a', awayClubId: 'b', gameCount: 2 },
  ],
  allowedDays: [1, 2, 3], reservedWindows: [],
  series: [{ seriesId: 'series-a', homeClubId: 'a',
    awayClubId: 'b', startsOnDay: 1, gameCount: 2 }],
});

it('projects an accepted schedule revision into the exact standings identity set', () => {
  const source = base();
  const revision = { eventId: 'rainout-a', gameId: 'series-a:2',
    newDay: 3, reason: 'RAINOUT' as const };
  const expected = applyScheduleRevisions(source, [revision]);
  const captured = captureOfficialStandingsSchedule(source, [revision]);
  expect(captured).toEqual({ seasonId: source.seasonId,
    leagueId: source.leagueId,
    memberClubIds: source.memberClubIds,
    regularSeasonGamesPerClub: 2,
    games: expected.games.map(({ gameId, homeClubId, awayClubId }) =>
      ({ gameId, homeClubId, awayClubId })),
    revisionEventIds: ['rainout-a'] });
  expect(source.revisionEventIds).toEqual([]);
});

it('rejects a forged base game list and a forged schedule revision', () => {
  const source = base();
  expect(() => captureOfficialStandingsSchedule({ ...source,
    games: source.games.slice(0, 1) }, [])).toThrow('base schedule');
  expect(() => captureOfficialStandingsSchedule(source, [{
    eventId: 'rainout-a', gameId: 'series-a:2',
    newDay: 1, reason: 'RAINOUT',
  }])).toThrow('simultaneous');
});

it('accepts a lossless archive with reordered object keys', () => {
  const source = base();
  const archived = JSON.parse(JSON.stringify(source, (_key, value: unknown) =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).reverse()) : value));
  expect(captureOfficialStandingsSchedule(archived, []))
    .toEqual(captureOfficialStandingsSchedule(source, []));
});
