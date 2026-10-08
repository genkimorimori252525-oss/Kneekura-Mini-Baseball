import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import type { DatabaseSync as Database } from 'node:sqlite';
import { SqliteOfficialStateStore } from './SqliteOfficialStateStore';
import { SqliteOfficialStateWriter } from './SqliteOfficialStateWriter';
import { terminalFixtureCompatibility, terminalFixtureManifest } from './world/ActualFoulTerminalApplicationFixtures.test-support';
import { actorHash as hash, actorJson as json } from './world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { FoulTerminalApplicationBody } from './world/ActualFoulTerminalApplication';
import type { OfficialStateApplicationReceipt } from '../core/adjudication/NextPlayActivation';
import { assertPriorPhysicalClosureCompleted } from './world/PhysicalPlayClosureEvidenceFromSqlite';

type Origin = { owner: 'actual_foul_terminal_applications'; sourceId: string; sourceVersion: string; sourceHash: string; snapshotHash: string };
type Input = FoulTerminalApplicationBody & { origin: Origin };
type Pending = { version: 'official_pending_post_play_v1'; matchId: string; applicationId: string; closureId: string;
  previousPlayId: number; durableRevision: number; requestHash: string; origin: Origin; gameProgression: unknown };
type Result = { receipt: OfficialStateApplicationReceipt; pendingPostPlay: Pending };
type Writer = SqliteOfficialStateWriter & { preparePendingNonLive(input: Input): {
  kind: 'write'; write(): { readResult(): Result } } };
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const directories: string[] = [], resources: { close(): void }[] = [];
const track = <T extends { close(): void }>(resource: T): T => { resources.push(resource); return resource; };
afterEach(() => {
  while (resources.length) resources.pop()!.close();
  while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true });
});
const fixture = () => {
  const pure = terminalFixtureCompatibility(), m = terminalFixtureManifest;
  const directory = mkdtempSync(join(tmpdir(), 'terminal-pending-writer-')); directories.push(directory);
  const path = join(directory, 'state.sqlite'), store = track(new SqliteOfficialStateStore(path));
  store.registerOfficialFixture(m.fixture); store.initializeMatch(m.gameId, pure.original);
  const db = track(new DatabaseSync(path));
  const input: Input = { mode: 'non_live_pending_post_play_v1', kind: 'non_live', matchId: m.gameId,
    applicationId: 'pending-test-application', expectedDurableRevision: 0, match: pure.original,
    timeline: pure.timeline, adjudication: pure.ledger, context: { kind: 'strikeout' },
    game: { seasonId: m.seasonId, homeClubId: m.homeClubId, awayClubId: m.awayClubId, policy: m.legalGamePolicy, venueBinding: m.fixture },
    origin: { owner: 'actual_foul_terminal_applications', sourceId: 'compat-close', sourceVersion: 'test-v1',
      sourceHash: hash({ source: 'compat-close' }), snapshotHash: hash({ proposal: 'synthetic-unit-only' }) } };
  return { path, store, db, input, pure };
};
const writer = (db: Database): Writer => {
  const value = new SqliteOfficialStateWriter(db) as Writer;
  expect(typeof value.preparePendingNonLive, 'PENDING_NON_LIVE_WRITER_API_MISSING').toBe('function');
  return value;
};
const rows = (db: Database) => ({ matches: db.prepare('SELECT * FROM matches').all(), applications: db.prepare('SELECT * FROM applications').all() });
const commit = (db: Database, prepared: ReturnType<Writer['preparePendingNonLive']>) => {
  db.exec('BEGIN IMMEDIATE');
  try { const result = prepared.write().readResult(); expect(db.isTransaction).toBe(true); db.exec('COMMIT'); return result; }
  catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
};

it('P01 writes a non-live receipt and explicit pending marker without timing, setup or activation', () => {
  const f = fixture(), w = writer(f.db); f.db.exec('PRAGMA user_version=3');
  const result = commit(f.db, w.preparePendingNonLive(f.input));
  expect(result).toEqual({ receipt: { ...f.pure.expectedReceipt, applicationId: f.input.applicationId }, pendingPostPlay: {
    version: 'official_pending_post_play_v1', matchId: f.input.matchId, applicationId: f.input.applicationId,
    closureId: 'compat-close', previousPlayId: 7, durableRevision: 1, requestHash: hash(f.input), origin: f.input.origin,
    gameProgression: { kind: 'GAME_CONTINUES', nextMatchState: f.pure.next } } });
  expect(w.getMatch(f.input.matchId)).toEqual({ durableRevision: 1, matchState: f.pure.next,
    activation: null, nextWorld: null, finalResult: null, pendingPostPlay: result.pendingPostPlay });
  expect(rows(f.db)).toEqual({ matches: [{ match_id: f.input.matchId, durable_revision: 1,
    state_json: json(f.pure.next), activation_json: json({ pendingPostPlay: result.pendingPostPlay }) }], applications: [{
    application_id: f.input.applicationId, match_id: f.input.matchId, closure_id: 'compat-close',
    request_hash: hash(f.input), result_json: json(result) }] });
  for (const key of ['activation', 'nextWorld', 'nextStartedAtTick', 'worldSetup']) expect(result).not.toHaveProperty(key);
});
it('P02 requires schema v3 before writing pending state and does not migrate schema v2', () => {
  const f = fixture(), w = writer(f.db), before = rows(f.db);
  expect(() => commit(f.db, w.preparePendingNonLive(f.input))).toThrow(/schema.*3|version.*3/);
  expect(f.db.prepare('PRAGMA user_version').get()!.user_version).toBe(2); expect(rows(f.db)).toEqual(before);
});
it('P03 requires a caller transaction and consumes its prepared pending write once even after rollback', () => {
  const f = fixture(), w = writer(f.db); f.db.exec('PRAGMA user_version=3');
  const before = rows(f.db), prepared = w.preparePendingNonLive(f.input);
  expect(() => prepared.write()).toThrow('official state writer requires a caller-owned transaction');
  f.db.exec('BEGIN IMMEDIATE'); prepared.write().readResult(); f.db.exec('ROLLBACK');
  expect(rows(f.db)).toEqual(before);
  f.db.exec('BEGIN IMMEDIATE'); expect(() => prepared.write()).toThrow('official state prepared write was already used'); f.db.exec('ROLLBACK');
  expect(commit(f.db, w.preparePendingNonLive(f.input)).receipt.durableRevision).toBe(1);
});
it('P04 exact pending retry is unchanged and rejects a changed origin or malformed stored result', () => {
  const f = fixture(), w = writer(f.db); f.db.exec('PRAGMA user_version=3');
  const result = commit(f.db, w.preparePendingNonLive(f.input)), before = rows(f.db);
  expect(commit(f.db, w.preparePendingNonLive(f.input))).toEqual(result); expect(rows(f.db)).toEqual(before);
  expect(() => commit(f.db, w.preparePendingNonLive({ ...f.input, origin: { ...f.input.origin, sourceHash: '0'.repeat(64) } }))).toThrow(/different input/);
  f.db.prepare('UPDATE applications SET result_json=?').run(json({ ...result, receipt: { ...result.receipt, durableRevision: 2 } }));
  expect(() => commit(f.db, w.preparePendingNonLive(f.input))).toThrow(/pending.*result|pending.*receipt|pending.*mirror/);
});
it('P05 legacy activation and a second pending application cannot advance a pending Match', () => {
  const f = fixture(), w = writer(f.db); f.db.exec('PRAGMA user_version=3');
  commit(f.db, w.preparePendingNonLive(f.input)); const before = rows(f.db);
  const { mode: _mode, origin: _origin, game, ...input } = f.input;
  expect(() => f.store.applyAndActivate({ ...input, applicationId: 'escape-activation',
    nextStartedAtTick: f.input.timeline.lastEventTick + 100, worldSetup: {
      baseCenters: { first: { x: 27, z: 0 }, second: { x: 27, z: 27 }, third: { x: 0, z: 27 } },
      defenders: [], activePreviousPlayControllerIds: [] } })).toThrow(/pending post.play/);
  // A valid old result can be prepared separately; a current pending marker must
  // be checked before any new Match/application row can be written.
  expect(() => commit(f.db, w.preparePendingNonLive({ ...f.input, applicationId: 'escape-pending' }))).toThrow(/pending post.play/);
  expect(game).not.toBeNull(); expect(rows(f.db)).toEqual(before);
});
it('P06 v3-aware store preserves schema version and emits no new keys for a legacy unadvanced Match', () => {
  const f = fixture(); f.db.exec('PRAGMA user_version=3');
  const reopened = track(new SqliteOfficialStateStore(f.path));
  expect(f.db.prepare('PRAGMA user_version').get()!.user_version).toBe(3);
  expect(reopened.getMatch(f.input.matchId)).toEqual({ durableRevision: 0, matchState: f.pure.original,
    activation: null, nextWorld: null, finalResult: null });
});
it.each(['matches', 'applications'] as const)('P07 a real %s trigger failure remains caller-owned and rolls pending writes back', table => {
  const f = fixture(), w = writer(f.db); f.db.exec('PRAGMA user_version=3'); const before = rows(f.db);
  f.db.exec(`CREATE TRIGGER pending_abort AFTER ${table === 'matches' ? 'UPDATE' : 'INSERT'} ON ${table} BEGIN SELECT RAISE(ABORT,'pending-real-trigger'); END`);
  const prepared = w.preparePendingNonLive(f.input); f.db.exec('BEGIN IMMEDIATE');
  expect(() => prepared.write()).toThrow('pending-real-trigger'); expect(f.db.isTransaction).toBe(true);
  f.db.exec('ROLLBACK'); expect(rows(f.db)).toEqual(before);
});
it.each(['application', 'match'] as const)('P08 getMatch rejects a changed pending %s mirror', mirror => {
  const f = fixture(), w = writer(f.db); f.db.exec('PRAGMA user_version=3'); const result = commit(f.db, w.preparePendingNonLive(f.input));
  if (mirror === 'application') f.db.prepare('UPDATE applications SET result_json=?').run(json({ ...result, pendingPostPlay: { ...result.pendingPostPlay, previousPlayId: 19 } }));
  else f.db.prepare('UPDATE matches SET activation_json=?').run(json({ pendingPostPlay: { ...result.pendingPostPlay, durableRevision: 9 } }));
  expect(() => w.getMatch(f.input.matchId)).toThrow(/pending/);
});
it('P09 physical next-play admission rejects a pending application even without legacy live owners', () => {
  const f = fixture(), w = writer(f.db); f.db.exec('PRAGMA user_version=3'); commit(f.db, w.preparePendingNonLive(f.input));
  expect(() => assertPriorPhysicalClosureCompleted(f.db, f.input.applicationId)).toThrow(/terminal|pending post.play/);
});
it('P10 pending preparation captures inert request bytes before caller mutation', () => {
  const f = fixture(), w = writer(f.db); f.db.exec('PRAGMA user_version=3');
  const original = json(f.input), prepared = w.preparePendingNonLive(f.input);
  f.input.origin.sourceHash = 'f'.repeat(64); const result = commit(f.db, prepared);
  expect(result.pendingPostPlay.origin.sourceHash).toBe(JSON.parse(original).origin.sourceHash);
  expect(f.db.prepare('SELECT request_hash FROM applications').get()!.request_hash).toBe(hash(JSON.parse(original)));
});

it.each(['activation', 'finalResult', 'duplicate_pending'] as const)('P12 rejects a mixed or duplicate pending envelope: %s', extra => {
  const f = fixture(), w = writer(f.db); f.db.exec('PRAGMA user_version=3'); const result = commit(f.db, w.preparePendingNonLive(f.input));
  const raw = extra === 'duplicate_pending'
    ? '{"pendingPostPlay":{},"pendingPostPlay":' + json(result.pendingPostPlay) + '}'
    : json({ pendingPostPlay: result.pendingPostPlay, [extra]: {} });
  f.db.prepare('UPDATE matches SET activation_json=?').run(raw);
  expect(() => w.getMatch(f.input.matchId)).toThrow(/pending/);
});
it('P13 rejects a changed shared application request hash while reading pending Match', () => {
  const f = fixture(), w = writer(f.db); f.db.exec('PRAGMA user_version=3'); commit(f.db, w.preparePendingNonLive(f.input));
  f.db.prepare('UPDATE applications SET request_hash=?').run('0'.repeat(64));
  expect(() => w.getMatch(f.input.matchId)).toThrow(/pending/);
});

it.each(['missing', 'memory', 'v2', 'future', 'empty_v3'] as const)('P14 runner rejects %s before DDL or artifact creation', async kind => {
  const moduleId = './world/SqliteActualFoulTerminalApplicationRunner';
  const module: { openSqliteActualFoulTerminalApplicationRunner?: (path: string) => { close(): void } } =
    await import(/* @vite-ignore */ moduleId).catch(() => ({}));
  expect(typeof module.openSqliteActualFoulTerminalApplicationRunner, 'PENDING_RUNNER_OPEN_API_MISSING').toBe('function');
  const f = fixture();
  const path = kind === 'missing' ? join(f.path, '..', 'missing.sqlite') : kind === 'memory' ? ':memory:' : f.path;
  if (kind === 'future') f.db.exec('PRAGMA user_version=4');
  if (kind === 'empty_v3') f.db.exec('DROP TABLE applications; PRAGMA user_version=3');
  const before = f.db.prepare('SELECT type,name,sql FROM sqlite_master ORDER BY name').all();
  expect(() => module.openSqliteActualFoulTerminalApplicationRunner!(path)).toThrow();
  expect(f.db.prepare('SELECT type,name,sql FROM sqlite_master ORDER BY name').all()).toEqual(before);
  if (kind === 'missing') expect(existsSync(path)).toBe(false);
});

it.each(['nextStartedAtTick', 'worldSetup', 'activation'] as const)('P15 pending input rejects caller-supplied %s authority', key => {
  const f = fixture(), w = writer(f.db); f.db.exec('PRAGMA user_version=3'); const before = rows(f.db);
  expect(() => commit(f.db, w.preparePendingNonLive({ ...f.input, [key]: {} }))).toThrow(/pending.*input|pending.*field/);
  expect(rows(f.db)).toEqual(before);
});
it('P16 pending origin must equal the official closure identity', () => {
  const f = fixture(), w = writer(f.db); f.db.exec('PRAGMA user_version=3'); const before = rows(f.db);
  expect(() => commit(f.db, w.preparePendingNonLive({ ...f.input, origin: { ...f.input.origin, sourceId: 'foreign-source' } }))).toThrow(/origin|closure/);
  expect(rows(f.db)).toEqual(before);
});
