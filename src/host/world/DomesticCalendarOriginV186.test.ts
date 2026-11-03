import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { state } from '../../core/world/club/ClubFixtures.test-support';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { openSqliteDomesticScheduleStore, readDomesticCalendarOriginFromSqlite } from './SqliteDomesticScheduleStore';
import { openSqliteWorldCompetitionCycleStore } from './SqliteWorldCompetitionCycleStore';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { initializeWorldBoundDomesticSeason, resumeWorldBoundDomesticSeasonCalendar } from './WorldBoundDomesticSeasonRuntime';
import { worldCycleInput } from './WorldCompetitionCycleFixtures.test-support';

const { DatabaseSync, constants } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const directories: string[] = [], stores: { close(): void }[] = [];
afterEach(() => {
  while (stores.length) stores.pop()!.close();
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(root + sep) || !basename(target).startsWith('calendar-origin-v186-')) throw new Error('calendar fixture cleanup escaped its directory');
    rmSync(target, { recursive: true, force: true });
  }
});
const track = <T extends { close(): void }>(store: T): T => { stores.push(store); return store; };
const json = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const sha = (value: string): string => createHash('sha256').update(value).digest('hex');
const sourceOf = (input: ReturnType<typeof fixture>['input']) => ({ cycleOrdinal: input.cycleOrdinal, leagueRegion: input.leagueRegion,
  seasonDayOne: input.seasonDayOne, generatorInput: input.generatorInput });
const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'calendar-origin-v186-')); directories.push(directory);
  const path = join(directory, 'world.sqlite'), cycle = track(openSqliteWorldCompetitionCycleStore(path)),
    world = track(openSqliteWorldSettlementStore(path)), archive = track(openSqliteDomesticScheduleStore(path)),
    match = track(new SqliteOfficialStateStore(join(directory, 'match.sqlite')));
  cycle.initialize('career-a', worldCycleInput(0));
  const club = state(), clubs = [club, { ...state(), identity: { ...club.identity, clubId: 'club-b' },
    live: { ...club.live, references: { ...club.live.references,
      rivalryStateRefs: [{ fromClubId: 'club-b', toClubId: 'club-a', stateRef: 'rivalry-b-a' }] } } }];
  const input = { careerId: 'career-a', cycleOrdinal: 0, leagueRegion: 'ASIA_PACIFIC' as const, seasonDayOne: '2032-02-20', clubs,
    standingsPolicy: { version: 'standings-v1', tieCreditNumerator: 1, tieCreditDenominator: 2, runDifferentialCapPerGame: 10 },
    eventProfile: { version: 'events-v1', allStarEnabled: false, marketWindows: [], rosterExpansionEnabled: false, awardSelectionPolicyVersion: 'award-v1' },
    generatorInput: { seasonId: 'league-season-1', leagueId: 'league-a', calendarProfileVersion: 'calendar-v1', generatorVersion: 'generator-v1',
      scheduleSeed: 'seed-a', opponentMatrixVersion: 'matrix-v1', regularSeasonGamesPerClub: 4, memberClubIds: ['club-a', 'club-b'],
      opponentMatrix: [{ homeClubId: 'club-a', awayClubId: 'club-b', gameCount: 2 }, { homeClubId: 'club-b', awayClubId: 'club-a', gameCount: 2 }],
      allowedDays: Array.from({ length: 27 }, (_, i) => i + 10), reservedWindows: [], preferredSeriesLength: 2 as const, minimumDaysBetweenRounds: 0 } };
  const bound = initializeWorldBoundDomesticSeason({ cycle, world, archive, match }, input), db = track(new DatabaseSync(path));
  return { path, cycle, world, archive, match, input, bound, db };
};
const frozen = (value: unknown): void => { if (value && typeof value === 'object') { expect(Object.isFrozen(value)).toBe(true); Object.values(value).forEach(frozen); } };
const readGroup = <T>(db: InstanceType<typeof DatabaseSync>, read: () => T): T => {
  db.exec('BEGIN'); db.exec('PRAGMA query_only=1');
  try { return read(); } finally { db.exec('ROLLBACK'); db.exec('PRAGMA query_only=0'); }
};

it('DC186-R01 resumes the real calendar stage after archive/events committed but before origin persisted', () => {
  const x = fixture(), seasonId = x.input.generatorInput.seasonId;
  const before = x.db.prepare('SELECT * FROM main.world_domestic_schedules').all();
  // Recreate exactly the persisted boundary before the new origin insert.
  x.db.prepare('DELETE FROM main.world_domestic_calendar_origins WHERE career_id=? AND season_id=?').run('career-a', seasonId);
  const interrupted = { ...x.archive, bindCalendarOrigin: () => { throw new Error('origin phase interrupted'); } };
  expect(() => initializeWorldBoundDomesticSeason({ ...x, archive: interrupted }, x.input)).toThrow('origin phase interrupted');
  expect(x.archive.readCalendarOrigin('career-a', seasonId)).toBeNull();
  const restored = resumeWorldBoundDomesticSeasonCalendar({ archive: x.archive }, x.input);
  expect(restored).toStrictEqual(x.bound.calendarOrigin);
  expect(x.archive.readCalendarOrigin('career-a', seasonId)).toStrictEqual(restored);
  expect(resumeWorldBoundDomesticSeasonCalendar({ archive: x.archive }, x.input)).toStrictEqual(restored);
  expect(x.db.prepare('SELECT * FROM main.world_domestic_schedules').all()).toStrictEqual(before);
});

it('DC186-N01 archives the actual generator origin, replays it after reopen and retains exact idempotent source scope', () => {
  const x = fixture(), source = sourceOf(x.input), seasonId = x.input.generatorInput.seasonId;
  expect(x.bound.calendarOrigin).toMatchObject({ kind: 'world_bound_domestic_calendar_origin_v186', careerId: 'career-a', seasonId,
    source, calendarPolicyVersion: 'world-calendar-v1', worldWindowSnapshotId: x.bound.worldWindowSnapshotId });
  expect(x.bound.calendarOrigin.source.seasonDayOne).toBe('2032-02-20');
  const beforeBase = x.db.prepare('SELECT * FROM main.world_domestic_schedules').all();
  const row = x.db.prepare('SELECT * FROM main.world_domestic_calendar_origins WHERE career_id=? AND season_id=?').get('career-a', seasonId)!;
  expect(JSON.parse(String(row.source_json))).toStrictEqual({ careerId: 'career-a', seasonId, source });
  expect(row.source_hash).toBe(sha(String(row.source_json))); expect(row.source_hash).toBe(x.bound.calendarOrigin.sourceHash);
  expect(x.archive.bindCalendarOrigin('career-a', source)).toStrictEqual(x.bound.calendarOrigin);
  expect(x.db.prepare('SELECT * FROM main.world_domestic_schedules').all()).toStrictEqual(beforeBase);
  x.archive.close(); stores.splice(stores.indexOf(x.archive), 1);
  const reopened = track(openSqliteDomesticScheduleStore(x.path)), read = reopened.readCalendarOrigin('career-a', seasonId)!;
  expect(read).toStrictEqual(x.bound.calendarOrigin); frozen(read);
  expect(read).not.toBe(x.bound.calendarOrigin); expect(read.source).not.toBe(source);
  x.input.seasonDayOne = '2032-02-21'; expect(read.source.seasonDayOne).toBe('2032-02-20');
});

it('DC186-N02 authenticates on the caller query-only Native snapshot without changing transaction, authorizer or rows', () => {
  const x = fixture(), seasonId = x.input.generatorInput.seasonId;
  const rows = x.db.prepare('SELECT * FROM main.world_domestic_calendar_origins').all();
  x.db.setAuthorizer((code, table) => code === constants.SQLITE_DELETE && table === 'world_domestic_calendar_origins' ? constants.SQLITE_DENY : constants.SQLITE_OK);
  try {
    readGroup(x.db, () => {
      x.db.exec('SAVEPOINT caller_calendar');
      const changes = x.db.prepare('SELECT total_changes() n').get()!.n, schema = x.db.prepare('PRAGMA main.schema_version').get()!.schema_version;
      expect(readDomesticCalendarOriginFromSqlite(x.db, 'career-a', seasonId)).toStrictEqual(x.bound.calendarOrigin);
      expect(readDomesticCalendarOriginFromSqlite(x.db, 'career-a', seasonId)).toStrictEqual(x.bound.calendarOrigin);
      expect(x.db.isTransaction).toBe(true); expect(x.db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
      expect(x.db.prepare('SELECT total_changes() n').get()!.n).toBe(changes); expect(x.db.prepare('PRAGMA main.schema_version').get()!.schema_version).toBe(schema);
      expect(() => x.db.prepare('DELETE FROM main.world_domestic_calendar_origins WHERE 0')).toThrow(/authorized/i);
      x.db.exec('RELEASE caller_calendar');
    });
    expect(x.db.prepare('SELECT * FROM main.world_domestic_calendar_origins').all()).toStrictEqual(rows);
  } finally { x.db.setAuthorizer(null); }
});

it('DC186-N03 refuses alternate origins, accepted wrong cycles and mismatched generator bases without rebinding', () => {
  const x = fixture(), source = sourceOf(x.input), before = x.db.prepare('SELECT * FROM main.world_domestic_calendar_origins').all();
  x.cycle.initialize('career-a', worldCycleInput(1));
  for (const invalid of [{ ...source, seasonDayOne: '2032-02-21' }, { ...source, seasonDayOne: '2032-02-30' },
    { ...source, cycleOrdinal: 1 }, { ...source, leagueRegion: 'EUROPE' as const },
    { ...source, generatorInput: { ...source.generatorInput, scheduleSeed: 'another-seed' } },
    { ...source, generatorInput: { ...source.generatorInput, seasonId: 'other-season' } }]) {
    expect(() => x.archive.bindCalendarOrigin('career-a', invalid)).toThrow();
  }
  expect(x.db.prepare('SELECT * FROM main.world_domestic_calendar_origins').all()).toStrictEqual(before);
  expect(x.archive.readCalendarOrigin('career-a', source.generatorInput.seasonId)).toStrictEqual(x.bound.calendarOrigin);
});

it.each(['source_hash', 'base_schedule_hash', 'source_json', 'scoped_source', 'origin_rehash', 'base_json', 'cycle_plan'] as const)
('DC186-N04 reauthenticates persisted %s instead of accepting self-consistent archive claims', mutation => {
  const x = fixture(), seasonId = x.input.generatorInput.seasonId;
  if (mutation === 'source_hash' || mutation === 'base_schedule_hash') x.db.prepare(`UPDATE main.world_domestic_calendar_origins SET ${mutation}=?`).run('0'.repeat(64));
  else if (mutation === 'source_json') x.db.exec("UPDATE main.world_domestic_calendar_origins SET source_json='{}'");
  else if (mutation === 'scoped_source' || mutation === 'origin_rehash') {
    const row = x.db.prepare('SELECT source_json FROM main.world_domestic_calendar_origins').get()!, body = JSON.parse(String(row.source_json));
    if (mutation === 'scoped_source') body.careerId = 'another-career'; else body.source.seasonDayOne = '2032-02-21';
    const text = json(body); x.db.prepare('UPDATE main.world_domestic_calendar_origins SET source_json=?,source_hash=?').run(text, sha(text));
  } else if (mutation === 'base_json') {
    const row = x.db.prepare('SELECT base_json FROM main.world_domestic_schedules').get()!, base = JSON.parse(String(row.base_json));
    base.scheduleSeed = 'modified'; x.db.prepare('UPDATE main.world_domestic_schedules SET base_json=?').run(json(base));
  } else x.db.exec("UPDATE main.world_competition_cycles SET plan_json='{}'");
  expect(() => x.archive.readCalendarOrigin('career-a', seasonId)).toThrow();
  readGroup(x.db, () => expect(() => readDomesticCalendarOriginFromSqlite(x.db, 'career-a', seasonId)).toThrow());
});

it('DC186-N05 requires a real main-only query-only snapshot and leaves a legacy database without an origin absent', () => {
  const db = track(new DatabaseSync(':memory:'));
  let calls = 0;
  expect(() => readDomesticCalendarOriginFromSqlite({ isTransaction: true, prepare() { calls++; throw new Error('facade SQL'); } } as never, 'career-a', 'season')).toThrow(/Native/);
  expect(calls).toBe(0); expect(() => readDomesticCalendarOriginFromSqlite(db, 'career-a', 'season')).toThrow(/snapshot/);
  db.exec('BEGIN'); try { expect(() => readDomesticCalendarOriginFromSqlite(db, 'career-a', 'season')).toThrow(/snapshot/); } finally { db.exec('ROLLBACK'); }
  const schema = db.prepare('PRAGMA main.schema_version').get()!.schema_version;
  readGroup(db, () => expect(readDomesticCalendarOriginFromSqlite(db, 'career-a', 'season')).toBeNull());
  expect(db.prepare('PRAGMA main.schema_version').get()!.schema_version).toBe(schema);
  expect(db.prepare("SELECT name FROM main.sqlite_master WHERE name='world_domestic_calendar_origins'").get()).toBeUndefined();
  db.exec("ATTACH ':memory:' AS foreign_calendar");
  readGroup(db, () => expect(() => readDomesticCalendarOriginFromSqlite(db, 'career-a', 'season')).toThrow(/main-only/));
  db.exec('DETACH foreign_calendar'); db.exec('CREATE TEMP TABLE world_domestic_calendar_origins(value TEXT)');
  readGroup(db, () => expect(() => readDomesticCalendarOriginFromSqlite(db, 'career-a', 'season')).toThrow(/main-only/));
});
