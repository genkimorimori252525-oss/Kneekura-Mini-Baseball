import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { command, state } from
  '../core/world/club/ClubFixtures.test-support';
import { applyClubCommand } from '../core/world/club/ClubLifecycle';
import { createBaseScheduleSnapshot } from '../core/world/competition/LeagueSchedule';
import { captureOfficialStandingsSchedule } from
  '../core/world/competition/OfficialStandingsScheduleSource';
import { registerDomesticFixture } from './RegisterDomesticFixture';
import { registerDomesticFixtureFromWorld } from './RegisterDomesticFixture';
import { SqliteOfficialStateStore } from './SqliteOfficialStateStore';
import { openSqliteWorldSettlementStore } from
  './world/SqliteWorldSettlementStore';
import { openSqliteDomesticScheduleStore } from
  './world/SqliteDomesticScheduleStore';
import { appendAcceptedClubEvents } from
  './world/SqliteClubEventJournal';

const directories: string[] = [];
const openStores: { close(): void }[] = [];
afterEach(() => {
  for (const store of openStores.splice(0)) store.close();
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-domestic-fixture-')) {
      throw new Error('test cleanup target escaped its temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});

it('pins a source-backed domestic venue durably and rejects later divergence', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-domestic-fixture-'));
  directories.push(directory);
  const path = join(directory, 'official.sqlite');
  const baseSchedule = createBaseScheduleSnapshot({
    seasonId: 'league-season-1', leagueId: 'league-a',
    calendarProfileVersion: 'calendar-v1', generatorVersion: 'generator-v1',
    scheduleSeed: 'seed-a', opponentMatrixVersion: 'matrix-v1',
    regularSeasonGamesPerClub: 2, memberClubIds: ['club-a', 'club-b'],
    opponentMatrix: [{ homeClubId: 'club-a', awayClubId: 'club-b', gameCount: 2 }],
    allowedDays: [11, 12], reservedWindows: [],
    series: [{ seriesId: 'series-a', homeClubId: 'club-a',
      awayClubId: 'club-b', startsOnDay: 11, gameCount: 2 }],
  });
  const input = { baseSchedule, revisions: [], gameId: 'series-a:1',
    venueRevisionAtGame: 0,
    history: { checkpoint: state(), acceptedEvents: [] } };
  const first = new SqliteOfficialStateStore(path);
  const pinned = registerDomesticFixture(first, input);
  expect(pinned.binding.venueId).toBe('stadium-a');
  first.close();
  const reopened = new SqliteOfficialStateStore(path);
  expect(reopened.getOfficialFixture(input.gameId)).toEqual(pinned.binding);
  expect(registerDomesticFixture(reopened, input)).toEqual(pinned);
  expect(() => registerDomesticFixture(reopened, { ...input,
    history: { checkpoint: { ...state(), institutional: {
      ...state().institutional, stadium: { ...state().institutional.stadium,
        stadiumId: 'other-stadium' } } }, acceptedEvents: [] } }))
    .toThrow('pinned differently');
  reopened.close();
});

it('uses the durable World season and Club head as the fixture authority', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-domestic-fixture-'));
  directories.push(directory);
  const worldPath = join(directory, 'world.sqlite');
  const world = openSqliteWorldSettlementStore(worldPath);
  const match = new SqliteOfficialStateStore(join(directory, 'match.sqlite'));
  const archive = openSqliteDomesticScheduleStore(worldPath);
  openStores.push(world, match, archive);
  const baseSchedule = createBaseScheduleSnapshot({
    seasonId: 'league-season-1', leagueId: 'league-a',
    calendarProfileVersion: 'calendar-v1', generatorVersion: 'generator-v1',
    scheduleSeed: 'seed-a', opponentMatrixVersion: 'matrix-v1',
    regularSeasonGamesPerClub: 2, memberClubIds: ['club-a', 'club-b'],
    opponentMatrix: [{ homeClubId: 'club-a', awayClubId: 'club-b', gameCount: 2 }],
    allowedDays: [11, 12], reservedWindows: [],
    series: [{ seriesId: 'series-a', homeClubId: 'club-a',
      awayClubId: 'club-b', startsOnDay: 11, gameCount: 2 }],
  });
  world.initialize({ careerId: 'career-a',
    schedule: captureOfficialStandingsSchedule(baseSchedule, []),
    standingsPolicy: { version: 'standings-v1',
      tieCreditNumerator: 1, tieCreditDenominator: 2,
      runDifferentialCapPerGame: 10 }, clubs: [state()] });
  archive.initialize('career-a', baseSchedule);
  const input = { careerId: 'career-a', seasonId: 'league-season-1',
    gameId: 'series-a:1' };
  const result = registerDomesticFixtureFromWorld(world, archive, match, input);
  expect(result.binding.venueId).toBe('stadium-a');
  expect(match.getOfficialFixture(input.gameId)).toEqual(result.binding);
  expect(registerDomesticFixtureFromWorld(world, archive, match, input))
    .toEqual(result);
  const before = world.readClub('career-a', 'club-a')!;
  const changed = applyClubCommand(before.state, {
    ...command([{ kind: 'REPLACE_STADIUM', stadium: {
      ...before.state.institutional.stadium,
      stadiumId: 'stadium-b', geometryRef: 'geometry-b' } }],
    before.state, 'future-stadium'), effectiveDay: 12,
  });
  if (!changed.ok) throw new Error('test Club event was rejected');
  const Database = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const db = new Database(worldPath);
  const canonicalJson = (value: unknown): string => JSON.stringify(value,
    (_key, item: unknown) => item !== null && typeof item === 'object'
      && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0)) : item);
  db.exec('BEGIN IMMEDIATE');
  try {
    appendAcceptedClubEvents(db, before.state,
      [changed.event], changed.state);
    db.prepare(`UPDATE world_club_heads SET revision=?, state_json=?
      WHERE career_id=? AND club_id=? AND revision=?`).run(
      changed.state.revision, canonicalJson(changed.state),
      'career-a', 'club-a', before.revision);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
  expect(registerDomesticFixtureFromWorld(world, archive, match, input))
    .toEqual(result);
  expect(registerDomesticFixtureFromWorld(world, archive, match,
    { ...input, gameId: 'series-a:2' }).binding.venueId)
    .toBe('stadium-b');
  expect(() => registerDomesticFixtureFromWorld(world, archive, match,
    { ...input, gameId: 'other-game' })).toThrow('scheduled');
});
