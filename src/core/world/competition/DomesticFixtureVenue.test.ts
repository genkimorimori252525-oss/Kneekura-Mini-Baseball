import { expect, it } from 'vitest';
import { applyClubCommand } from '../club/ClubLifecycle';
import { state } from '../club/ClubFixtures.test-support';
import { createBaseScheduleSnapshot } from './LeagueSchedule';
import { bindDomesticFixtureVenue,
  matchesDomesticFixtureRevision } from './DomesticFixtureVenue';

const schedule = () => createBaseScheduleSnapshot({
  seasonId: 'league-season-1', leagueId: 'league-a',
  calendarProfileVersion: 'calendar-v1', generatorVersion: 'generator-v1',
  scheduleSeed: 'seed-a', opponentMatrixVersion: 'matrix-v1',
  regularSeasonGamesPerClub: 2, memberClubIds: ['club-a', 'club-b'],
  opponentMatrix: [{ homeClubId: 'club-a',
    awayClubId: 'club-b', gameCount: 2 }],
  allowedDays: [11, 12, 13], reservedWindows: [],
  series: [{ seriesId: 'series-a', homeClubId: 'club-a',
    awayClubId: 'club-b', startsOnDay: 11, gameCount: 2 }],
});

it('pins the actual home stadium and schedule evidence before a game', () => {
  const club = state();
  const result = bindDomesticFixtureVenue({ baseSchedule: schedule(),
    revisions: [], gameId: 'series-a:1', venueRevisionAtGame: 0,
    history: { checkpoint: club, acceptedEvents: [] } });
  expect(result.binding).toMatchObject({ gameId: 'series-a:1',
    venueId: 'stadium-a', fixtureRevision: 1 });
  expect(result.basis).toMatchObject({ seasonId: 'league-season-1',
    gameDay: 11, homeClubId: 'club-a', venueRevision: 0,
    stadiumId: 'stadium-a' });
});

it('uses an accepted stadium change, and rejects a stale venue revision', () => {
  const club = state();
  const changed = applyClubCommand(club, { eventId: 'stadium-change',
    careerId: club.careerId, clubId: club.identity.clubId,
    expectedRevision: 0, effectiveDay: 11,
    causeEventIds: ['stadium-plan'],
    operations: [{ kind: 'REPLACE_STADIUM',
      stadium: { ...club.institutional.stadium,
        stadiumId: 'stadium-b' } }] });
  if (!changed.ok) throw new Error('fixture setup failed');
  const input = { baseSchedule: schedule(), revisions: [],
    gameId: 'series-a:2', venueRevisionAtGame: 1,
    history: { checkpoint: club, acceptedEvents: [changed.event] } };
  expect(bindDomesticFixtureVenue(input).binding.venueId).toBe('stadium-b');
  expect(() => bindDomesticFixtureVenue({ ...input,
    venueRevisionAtGame: 0 })).toThrow('venue revision');
});

it('rejects an unscheduled game and a forged base schedule', () => {
  const club = state();
  const input = { baseSchedule: schedule(), revisions: [],
    gameId: 'other', venueRevisionAtGame: 0,
    history: { checkpoint: club, acceptedEvents: [] } };
  expect(() => bindDomesticFixtureVenue(input)).toThrow('scheduled');
  expect(() => bindDomesticFixtureVenue({ ...input,
    gameId: 'series-a:1', baseSchedule: { ...input.baseSchedule,
      games: input.baseSchedule.games.slice(0, 1) } }))
    .toThrow('base schedule');
});

it('keeps fixture identity stable when another game is rescheduled', () => {
  const input = { baseSchedule: schedule(), gameId: 'series-a:1',
    venueRevisionAtGame: 0,
    history: { checkpoint: state(), acceptedEvents: [] } };
  const original = bindDomesticFixtureVenue({ ...input, revisions: [] });
  const changed = bindDomesticFixtureVenue({ ...input, revisions: [{
    eventId: 'move-game-two', gameId: 'series-a:2',
    newDay: 13, reason: 'RAINOUT' as const }] });
  expect(changed.binding).toEqual(original.binding);
  expect(changed.basis.scheduleRevisionEventIds).toEqual([]);
  expect(matchesDomesticFixtureRevision(original.binding, 'career-a',
    input.baseSchedule, [{ eventId: 'move-game-two',
      gameId: 'series-a:2', newDay: 13, reason: 'RAINOUT' }])).toBe(true);
  expect(matchesDomesticFixtureRevision(original.binding, 'career-a',
    input.baseSchedule, [{ eventId: 'move-game-one',
      gameId: 'series-a:1', newDay: 13, reason: 'RAINOUT' }])).toBe(false);
});
