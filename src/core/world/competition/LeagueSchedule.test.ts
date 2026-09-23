import { describe, expect, it } from 'vitest';
import { applyScheduleRevisions, createBaseScheduleSnapshot } from './LeagueSchedule';

const input = {
  seasonId: 'season-1', leagueId: 'league-fixture',
  calendarProfileVersion: 'calendar-v1', generatorVersion: 'generator-v1',
  scheduleSeed: 'seed-1', opponentMatrixVersion: 'matrix-v1',
  regularSeasonGamesPerClub: 6,
  memberClubIds: ['club-a', 'club-b'],
  opponentMatrix: [
    { homeClubId: 'club-a', awayClubId: 'club-b', gameCount: 3 },
    { homeClubId: 'club-b', awayClubId: 'club-a', gameCount: 3 },
  ],
  allowedDays: Array.from({ length: 20 }, (_, index) => index + 1),
  reservedWindows: [{ kind: 'WORLD' as const, startsOnDay: 4, endsOnDay: 5 }],
  series: [
    { seriesId: 'series-1', homeClubId: 'club-a', awayClubId: 'club-b',
      startsOnDay: 1, gameCount: 3 as const },
    { seriesId: 'series-2', homeClubId: 'club-b', awayClubId: 'club-a',
      startsOnDay: 7, gameCount: 3 as const },
  ],
};

describe('league schedule snapshot and revisions', () => {
  it('freezes a complete series-based base schedule with historical provenance', () => {
    const snapshot = createBaseScheduleSnapshot(input);
    expect(snapshot.games).toHaveLength(6);
    expect(snapshot.games[0]).toMatchObject({
      gameId: 'series-1:1', day: 1, homeClubId: 'club-a', awayClubId: 'club-b',
    });
    expect(snapshot.calendarProfileVersion).toBe('calendar-v1');
    expect(Object.isFrozen(snapshot.games)).toBe(true);
    const revised = applyScheduleRevisions(snapshot, [{
      eventId: 'rainout-1', gameId: 'series-1:2', newDay: 11,
      reason: 'RAINOUT',
    }]);
    expect(revised.games.find((game) => game.gameId === 'series-1:2')?.day).toBe(11);
    expect(snapshot.games.find((game) => game.gameId === 'series-1:2')?.day).toBe(2);
    expect(revised.revisionEventIds).toEqual(['rainout-1']);
    expect(revised.games).toHaveLength(6);
  });

  it('rejects reserved windows, simultaneous games and silent volume reduction', () => {
    expect(() => createBaseScheduleSnapshot({
      ...input, series: [{ ...input.series[0], startsOnDay: 4 }, input.series[1]],
    })).toThrow('reserved');
    expect(() => createBaseScheduleSnapshot({
      ...input, series: [input.series[0]],
    })).toThrow('game count');
    expect(() => applyScheduleRevisions(createBaseScheduleSnapshot(input), [{
      eventId: 'bad-move', gameId: 'series-1:2', newDay: 7, reason: 'RAINOUT',
    }])).toThrow('simultaneous');
  });
});
