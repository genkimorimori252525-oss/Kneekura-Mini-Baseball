import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { state } from '../../core/world/club/ClubFixtures.test-support';
import { createBaseScheduleSnapshot } from
  '../../core/world/competition/LeagueSchedule';
import { captureOfficialStandingsSchedule } from
  '../../core/world/competition/OfficialStandingsScheduleSource';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteDomesticScheduleStore, readDomesticMarketTriggerFromSqlite } from './SqliteDomesticScheduleStore';

const directories: string[] = [];
const stores: { close(): void }[] = [];
afterEach(() => {
  for (const store of stores.splice(0)) store.close();
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-schedule-store-')) {
      throw new Error('test cleanup target escaped its temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});

const base = () => createBaseScheduleSnapshot({
  seasonId: 'league-season-1', leagueId: 'league-a',
  calendarProfileVersion: 'calendar-v1', generatorVersion: 'generator-v1',
  scheduleSeed: 'seed-a', opponentMatrixVersion: 'matrix-v1',
  regularSeasonGamesPerClub: 2, memberClubIds: ['club-a', 'club-b'],
  opponentMatrix: [{ homeClubId: 'club-a', awayClubId: 'club-b',
    gameCount: 2 }], allowedDays: [11, 12, 13], reservedWindows: [],
  series: [{ seriesId: 'series-a', homeClubId: 'club-a',
    awayClubId: 'club-b', startsOnDay: 11, gameCount: 2 }],
});

it('rejects a non-Native market evidence facade before reaching SQL', () => {
  let sqlCalls = 0;
  const facade = { isTransaction: true, prepare() {
    sqlCalls += 1;
    throw new Error('facade SQL was reached');
  } };
  expect(() => readDomesticMarketTriggerFromSqlite(facade as never, 'career-a', {
    seasonId: 'league-season-1', leagueId: 'league-a', windowId: 'trade',
    type: 'TRADE_DEADLINE', day: 12, policyVersion: 'trade-v1',
  })).toThrow(/actual Native SQLite connection/);
  expect(sqlCalls).toBe(0);
});

it('pins the base schedule and applies accepted revision to the durable World season', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-schedule-store-'));
  directories.push(directory);
  const path = join(directory, 'world.sqlite');
  const world = openSqliteWorldSettlementStore(path);
  stores.push(world);
  const schedule = base();
  world.initialize({ careerId: 'career-a',
    schedule: captureOfficialStandingsSchedule(schedule, []),
    standingsPolicy: { version: 'standings-v1',
      tieCreditNumerator: 1, tieCreditDenominator: 2,
      runDifferentialCapPerGame: 10 }, clubs: [state()] });
  const first = openSqliteDomesticScheduleStore(path);
  stores.push(first);
  expect(first.initialize('career-a', schedule)).toMatchObject({
    revision: 0, baseSchedule: schedule, revisions: [] });
  expect(() => first.initialize('career-a', Object.assign({}, schedule,
    { hidden: () => 1 }))).toThrow('inert');
  const moved = { eventId: 'rainout-1', gameId: 'series-a:2',
    newDay: 13, reason: 'RAINOUT' as const };
  expect(first.appendRevision('career-a', schedule.seasonId, 0,
    moved, 11)).toMatchObject({ revision: 1,
    revisions: [moved] });
  expect(() => first.appendRevision('career-a', schedule.seasonId,
    1, { eventId: 'backdated-revision', gameId: 'series-a:1',
      newDay: 11, reason: 'OTHER' }, 10)).toThrow('backdated');
  expect(() => first.appendRevision('career-a', schedule.seasonId,
    1, Object.assign({ eventId: 'non-inert', gameId: 'series-a:1',
      newDay: 11, reason: 'OTHER' as const }, { hidden: () => 1 }), 11))
    .toThrow('inert');
  expect(() => first.appendRevision('career-a', schedule.seasonId,
    1, { eventId: 'late-rainout', gameId: 'series-a:1',
      newDay: 13, reason: 'RAINOUT' }, 12)).toThrow('past game');
  expect(world.readSeason('career-a', schedule.seasonId)?.schedule)
    .toEqual(captureOfficialStandingsSchedule(schedule, [moved]));
  expect(() => first.appendRevision('career-a', schedule.seasonId,
    0, { ...moved, eventId: 'rainout-2' }, 11)).toThrow('revision');
  expect(first.appendRevision('career-a', schedule.seasonId, 0,
    moved, 11).revision).toBe(1);
  first.close();
  stores.splice(stores.indexOf(first), 1);
  const reopened = openSqliteDomesticScheduleStore(path);
  stores.push(reopened);
  expect(reopened.read('career-a', schedule.seasonId)).toMatchObject({
    revision: 1, revisions: [moved] });
  expect(() => reopened.initialize('career-a', { ...schedule,
    games: schedule.games.slice(0, 1) })).toThrow();
});

it('pins season events and refuses a revision onto the All-Star break', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-schedule-store-'));
  directories.push(directory);
  const path = join(directory, 'world.sqlite');
  const world = openSqliteWorldSettlementStore(path);
  stores.push(world);
  const schedule = createBaseScheduleSnapshot({
    seasonId: 'league-season-1', leagueId: 'league-a',
    calendarProfileVersion: 'calendar-v1', generatorVersion: 'generator-v1',
    scheduleSeed: 'seed-events', opponentMatrixVersion: 'matrix-v1',
    regularSeasonGamesPerClub: 4, memberClubIds: ['club-a', 'club-b'],
    opponentMatrix: [{ homeClubId: 'club-a', awayClubId: 'club-b',
      gameCount: 4 }], allowedDays: [11, 12, 13, 14, 15],
    reservedWindows: [], series: [
      { seriesId: 'series-early', homeClubId: 'club-a',
        awayClubId: 'club-b', startsOnDay: 11, gameCount: 2 },
      { seriesId: 'series-late', homeClubId: 'club-a',
        awayClubId: 'club-b', startsOnDay: 14, gameCount: 2 },
    ],
  });
  world.initialize({ careerId: 'career-a',
    schedule: captureOfficialStandingsSchedule(schedule, []),
    standingsPolicy: { version: 'standings-v1',
      tieCreditNumerator: 1, tieCreditDenominator: 2,
      runDifferentialCapPerGame: 10 }, clubs: [state()] });
  const archive = openSqliteDomesticScheduleStore(path);
  stores.push(archive);
  archive.initialize('career-a', schedule);
  const profile = { version: 'events-v1', allStarEnabled: true,
    allStarDay: 13, marketWindows: [{ windowId: 'trade',
      type: 'TRADE_DEADLINE' as const, policyVersion: 'trade-v1', day: 12 }],
    rosterExpansionEnabled: false, awardSelectionPolicyVersion: 'award-v1' };
  expect(archive.initializeEvents('career-a', schedule.seasonId,
    profile).snapshot.allStarEvent?.day).toBe(13);
  expect(archive.marketTriggersOnDay('career-a', schedule.seasonId,
    12)).toMatchObject([{ windowId: 'trade', day: 12 }]);
  expect(() => archive.appendRevision('career-a', schedule.seasonId, 0,
    { eventId: 'rainout-break', gameId: 'series-late:2',
      newDay: 13, reason: 'RAINOUT' }, 12))
    .toThrow('All-Star break');
  expect(archive.read('career-a', schedule.seasonId)?.revision).toBe(0);
  expect(world.readSeason('career-a', schedule.seasonId)?.schedule)
    .toEqual(captureOfficialStandingsSchedule(schedule, []));
  archive.close();
  stores.splice(stores.indexOf(archive), 1);
  const reopened = openSqliteDomesticScheduleStore(path);
  stores.push(reopened);
  expect(reopened.readEvents('career-a', schedule.seasonId)?.profile)
    .toEqual(profile);
  expect(() => reopened.initializeEvents('career-a', schedule.seasonId,
    { ...profile, version: 'events-v2' })).toThrow('already pinned');
});
