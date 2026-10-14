import { createRequire } from 'node:module';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { state } from '../../core/world/club/ClubFixtures.test-support';
import { createBaseScheduleSnapshot } from '../../core/world/competition/LeagueSchedule';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { initializeDomesticSeason, prepareDomesticOpeningMatch, reviseDomesticSeasonSchedule } from './DomesticSeasonRuntime';
import { openSqliteDomesticScheduleStore } from './SqliteDomesticScheduleStore';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';

const directories: string[] = [], openStores: { close(): void }[] = [];
afterEach(() => {
  openStores.splice(0).reverse().forEach(store => store.close());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${realpathSync(tmpdir())}${sep}`)
      || !basename(target).startsWith('kneekura-opening-domestic-')) throw new Error('invalid temporary test directory');
    rmSync(target, { recursive: true, force: true });
  }
});
const input = { careerId: 'career-a', seasonId: 'league-season-1', gameId: 'series-a:1',
  ruleProfileId: NPB_2026_RULE_PROFILE.id, playId: 7 };
const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-opening-domestic-')); directories.push(directory);
  const world = openSqliteWorldSettlementStore(join(directory, 'world.sqlite'));
  const archive = openSqliteDomesticScheduleStore(join(directory, 'world.sqlite'));
  const matchPath = join(directory, 'match.sqlite'), match = new SqliteOfficialStateStore(matchPath);
  openStores.push(world, archive, match);
  const original = state(), away = { ...original, identity: { ...original.identity, clubId: 'club-b' },
    live: { ...original.live, references: { ...original.live.references, rivalryStateRefs: [] } } };
  const baseSchedule = createBaseScheduleSnapshot({ seasonId: input.seasonId, leagueId: 'league-a',
    calendarProfileVersion: 'calendar-v1', generatorVersion: 'generator-v1', scheduleSeed: 'seed-a', opponentMatrixVersion: 'matrix-v1',
    regularSeasonGamesPerClub: 2, memberClubIds: ['club-a', 'club-b'],
    opponentMatrix: [{ homeClubId: 'club-a', awayClubId: 'club-b', gameCount: 2 }],
    allowedDays: [11, 12, 13], reservedWindows: [],
    series: [{ seriesId: 'series-a', homeClubId: 'club-a', awayClubId: 'club-b', startsOnDay: 11, gameCount: 2 }] });
  const stores = { world, archive, match };
  initializeDomesticSeason(stores, { careerId: input.careerId, baseSchedule, clubs: [original, away],
    standingsPolicy: { version: 'standings-v1', tieCreditNumerator: 1, tieCreditDenominator: 2, runDifferentialCapPerGame: 10 },
    eventProfile: { version: 'events-v1', allStarEnabled: false, marketWindows: [], rosterExpansionEnabled: false,
      awardSelectionPolicyVersion: 'awards-v1' } });
  return { stores, matchPath };
};

it('prepares the scheduled original Match with the standard unplayed state and explicit registered rules', () => {
  const { stores } = fixture(), before = stores.world.readSeason(input.careerId, input.seasonId);
  const prepared = prepareDomesticOpeningMatch(stores, input);
  expect(prepared.fixture.binding).toEqual(stores.match.getOfficialFixture(input.gameId));
  expect(prepared.fixture.basis).toMatchObject({ gameDay: 11, homeClubId: 'club-a', stadiumId: 'stadium-a' });
  expect(prepared.match).toEqual({ durableRevision: 0, activation: null, nextWorld: null, finalResult: null,
    matchState: { ruleProfileId: input.ruleProfileId, playId: 7, inning: 1, half: 'top', outs: 0, balls: 0, strikes: 0,
      bases: { first: null, second: null, third: null }, score: { away: 0, home: 0 } } });
  expect(stores.world.readSeason(input.careerId, input.seasonId)).toEqual(before);
});

it.each([
  { ...input, ruleProfileId: 'unsupported-rules' },
  { ...input, playId: -1 },
  { ...input, playId: 0.5 },
  { ...input, gameId: ' series-a:1' },
  { ...input, score: { home: 99, away: 0 } },
  { ...input, ruleProfile: NPB_2026_RULE_PROFILE },
])('rejects invalid or outcome-bearing setup before pinning a fixture: %j', invalid => {
  const { stores } = fixture();
  expect(() => prepareDomesticOpeningMatch(stores, invalid as never)).toThrow(/opening Match input|unsupported rule profile/);
  expect(stores.match.getOfficialFixture(input.gameId)).toBeNull();
  expect(stores.match.getMatch(input.gameId)).toBeNull();
});

it('resumes an interrupted fixture-first write and preserves exact identity after reopening', () => {
  const { stores, matchPath } = fixture();
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(matchPath); openStores.push(db);
  db.exec("CREATE TRIGGER fail_opening BEFORE INSERT ON matches BEGIN SELECT RAISE(ABORT,'opening interrupted'); END");
  expect(() => prepareDomesticOpeningMatch(stores, input)).toThrow('opening interrupted');
  const pinned = stores.match.getOfficialFixture(input.gameId);
  expect(pinned).not.toBeNull(); expect(stores.match.getMatch(input.gameId)).toBeNull();
  db.exec('DROP TRIGGER fail_opening');
  const reopened = new SqliteOfficialStateStore(matchPath); openStores.push(reopened);
  const result = prepareDomesticOpeningMatch({ ...stores, match: reopened }, input);
  expect(result.fixture.binding).toEqual(pinned);
  expect(prepareDomesticOpeningMatch(stores, input)).toEqual(result);
  expect(() => prepareDomesticOpeningMatch(stores, { ...input, playId: 8 })).toThrow('different state');
  expect(stores.match.getMatch(input.gameId)).toEqual(result.match);
});

it('uses the current accepted schedule revision and refuses an unscheduled game', () => {
  const { stores } = fixture();
  reviseDomesticSeasonSchedule(stores, { careerId: input.careerId, seasonId: input.seasonId,
    expectedRevision: 0, acceptedAtDay: 10,
    event: { eventId: 'rainout', gameId: input.gameId, newDay: 13, reason: 'RAINOUT' } });
  const result = prepareDomesticOpeningMatch(stores, input);
  expect(result.fixture.basis.gameDay).toBe(13);
  expect(result.fixture.binding.fixtureRevision).toBe(2);
  expect(() => prepareDomesticOpeningMatch(stores, { ...input, gameId: 'not-scheduled' })).toThrow('scheduled game');
  expect(stores.match.getMatch('not-scheduled')).toBeNull();
});

it('cannot reset an already advanced Match to an opening state', () => {
  const { stores, matchPath } = fixture();
  prepareDomesticOpeningMatch(stores, input);
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(matchPath); openStores.push(db);
  // The original Match owner is the authority for progress, even when no new setup is supplied.
  db.prepare('UPDATE matches SET durable_revision=1 WHERE match_id=?').run(input.gameId);
  const advanced = stores.match.getMatch(input.gameId);
  expect(() => prepareDomesticOpeningMatch(stores, input)).toThrow('different state');
  expect(stores.match.getMatch(input.gameId)).toEqual(advanced);
});
