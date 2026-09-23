import { expect, it } from 'vitest';
import { createBaseScheduleSnapshot } from './LeagueSchedule';
import { createLeagueSeasonEventSnapshot, marketDecisionTriggersOnDay } from './LeagueSeasonEvents';

const schedule = createBaseScheduleSnapshot({
  seasonId: 'season-1', leagueId: 'league-fixture',
  calendarProfileVersion: 'calendar-v1', generatorVersion: 'generator-v1',
  scheduleSeed: 'seed-1', opponentMatrixVersion: 'matrix-v1',
  regularSeasonGamesPerClub: 4, memberClubIds: ['a', 'b'],
  opponentMatrix: [
    { homeClubId: 'a', awayClubId: 'b', gameCount: 2 },
    { homeClubId: 'b', awayClubId: 'a', gameCount: 2 },
  ],
  allowedDays: Array.from({ length: 20 }, (_, index) => index + 1),
  reservedWindows: [],
  series: [
    { seriesId: 's1', homeClubId: 'a', awayClubId: 'b', startsOnDay: 1, gameCount: 2 },
    { seriesId: 's2', homeClubId: 'b', awayClubId: 'a', startsOnDay: 10, gameCount: 2 },
  ],
});

it('pins only enabled events and emits calendar triggers without a club buying decision', () => {
  const events = createLeagueSeasonEventSnapshot(schedule, {
    version: 'event-v1', allStarEnabled: false,
    marketWindows: [
      { windowId: 'market-1', type: 'REGISTRATION_WINDOW_CLOSE', day: 8,
        policyVersion: 'market-policy-v1' },
    ],
    rosterExpansionEnabled: true, rosterExpansionDay: 9,
    awardSelectionPolicyVersion: 'award-v1',
  });
  expect(events).toMatchObject({
    seasonId: 'season-1', leagueId: 'league-fixture', eventProfileVersion: 'event-v1',
    actualOpeningDay: 1, allStarEvent: null, rosterExpansionDay: 9,
    awardSelectionPolicyVersion: 'award-v1',
  });
  expect(events.marketWindowSnapshots).toHaveLength(1);
  expect(marketDecisionTriggersOnDay(events, 8)).toEqual([{
    seasonId: 'season-1', leagueId: 'league-fixture', windowId: 'market-1',
    type: 'REGISTRATION_WINDOW_CLOSE', day: 8, policyVersion: 'market-policy-v1',
  }]);
  expect(marketDecisionTriggersOnDay(events, 7)).toEqual([]);
});

it('does not invent events and rejects an All-Star break on a scheduled game day', () => {
  const empty = createLeagueSeasonEventSnapshot(schedule, {
    version: 'minimal-v1', allStarEnabled: false, marketWindows: [],
    rosterExpansionEnabled: false, awardSelectionPolicyVersion: 'award-v1',
  });
  expect(empty.marketWindowSnapshots).toEqual([]);
  expect(empty.rosterExpansionDay).toBeNull();
  expect(() => createLeagueSeasonEventSnapshot(schedule, {
    version: 'bad-v1', allStarEnabled: true, allStarDay: 10,
    marketWindows: [], rosterExpansionEnabled: false,
    awardSelectionPolicyVersion: 'award-v1',
  })).toThrow('All-Star break');
});
