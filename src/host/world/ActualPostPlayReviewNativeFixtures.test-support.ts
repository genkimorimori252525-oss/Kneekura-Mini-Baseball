import { mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect } from 'vitest';
import * as entry from './SqliteActualLiveAdjudicationStore';
import { bootstrap, value as clubValue } from '../../core/world/club/ClubFixtures.test-support';
import { createClubFromSeed } from '../../core/world/club';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteWorldControlStore } from './SqliteWorldControlStore';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { intentFixture, reviewFixture, type ReviewProjection } from './ActualPostPlayReviewContract.test-support';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const connections = new Set<InstanceType<typeof DatabaseSync>>();
const restore: (() => void)[] = [];
const fixtureDirectories: string[] = [];
// Arm cleanup before any connection is opened. Observing the real exec/prepare
// methods also captures handles opened inside a store whose constructor throws.
const armFixtureCleanup = () => {
  if (restore.length) return;
  for (const name of ['exec', 'prepare'] as const) {
    const prototype = DatabaseSync.prototype, descriptor = Object.getOwnPropertyDescriptor(prototype, name);
    if (!descriptor || typeof descriptor.value !== 'function') throw new Error('SQLite fixture ownership hook is unavailable');
    const original = descriptor.value as (...args: unknown[]) => unknown;
    const observed = function(this: InstanceType<typeof DatabaseSync>, ...args: unknown[]) {
      connections.add(this);
      return Reflect.apply(original, this, args);
    };
    Object.defineProperty(prototype, name, { ...descriptor, value: observed });
    restore.push(() => {
      if (Object.getOwnPropertyDescriptor(prototype, name)?.value !== observed) throw new Error('SQLite fixture ownership hook changed');
      Object.defineProperty(prototype, name, descriptor);
    });
  }
};
afterEach(() => {
  const errors: unknown[] = [];
  for (const db of [...connections].reverse()) {
    try { if (db.isOpen) db.close(); } catch (error) { errors.push(error); }
  }
  connections.clear();
  for (const revert of restore.splice(0).reverse()) {
    try { revert(); } catch (error) { errors.push(error); }
  }
  // Keep the fresh fixture files for diagnostics; this registry owns handles.
  fixtureDirectories.splice(0);
  if (errors.length) throw new AggregateError(errors, 'Native review fixture cleanup failed');
});
export const assertReviewFixtureConnectionsClosed = () => expect([...connections].filter(db => db.isOpen)).toHaveLength(0);
export type NativeIntake = Readonly<{ kind: 'accepted'; value: ReviewProjection }>
  | Readonly<{ kind: 'intake_pending'; sourceId: string; pendingReasons: readonly string[] }>
  | Readonly<{ kind: 'intent_pending'; sourceId: string; reason: string }>;
export type NativeReviewStore = Readonly<{
  acceptSession(sourceId: string): NativeIntake; acceptEvent(sourceId: string): NativeIntake;
  readSession(sourceId: string): ReviewProjection | null; readCurrent(sourceId: string): ReviewProjection | null;
  readAt(sourceId: string, revision: number): ReviewProjection | null;
  readEvent(sourceId: string): Readonly<{ source: unknown; value: ReviewProjection; admissionEvidence: unknown }> | null;
  close(): void;
}>;
export type NativeReviewAuthority = Readonly<{
  readAcceptedSession(sourceId: string): unknown;
  readAcceptedEvent(sourceId: string): unknown;
  readAcceptedIntent(sourceId: string): unknown;
}>;
export const nativeReviewFactory = () => {
  const fn = (entry as unknown as Record<string, unknown>).openSqliteActualPostPlayReviewStore;
  expect(fn, 'Native post-play session/event journal owner').toBeTypeOf('function');
  return fn as (path: string, authority?: NativeReviewAuthority) => NativeReviewStore;
};
export const accepted = (value: NativeIntake) => {
  expect(value.kind).toBe('accepted');
  if (value.kind !== 'accepted') throw new Error('expected adopted review receipt');
  return value.value;
};
export const nativeReviewFixture = (noOfficialPolicy = false) => {
  armFixtureCleanup();
  const directory = mkdtempSync(join(tmpdir(), 'post-play-review-native-')); fixtureDirectories.push(directory);
  const path = join(directory, 'state.sqlite');
  const club = (clubId: string, managerId: string, appointmentId: string) => {
    const input = bootstrap();
    return clubValue(createClubFromSeed({ ...input,
      seed: { ...input.seed, identity: { ...input.seed.identity, clubId, canonicalOriginId: `${clubId}:origin`, foundingIdentityRef: `${clubId}:founding` } },
      initial: { ...input.initial, references: { ...input.initial.references, rivalryStateRefs: [],
        staffRoleLinks: [{ roleId: 'manager', roleKind: 'MANAGER', personId: managerId, appointmentId }] } } }));
  };
  const home = club('club-a', 'manager-a', 'appointment-a'), away = club('club-b', 'manager-b', 'appointment-b');
  const world = openSqliteWorldSettlementStore(path);
  world.initialize({ careerId: 'career-a', clubs: [home, away],
    schedule: { seasonId: 'league-season-1', leagueId: 'league-a', memberClubIds: ['club-a', 'club-b'], regularSeasonGamesPerClub: 1,
      games: [{ gameId: 'game', homeClubId: 'club-a', awayClubId: 'club-b' }], revisionEventIds: ['schedule-1'] },
    standingsPolicy: { version: 'fixture-v1', tieCreditNumerator: 1, tieCreditDenominator: 2, runDifferentialCapPerGame: 10 } });
  expect(world.readClub('career-a', 'club-a')?.state).toEqual(home);
  expect(world.readClub('career-a', 'club-b')?.state).toEqual(away);
  world.close();
  const control = { schemaVersion: 1 as const, revision: 0, controllerId: 'controller', controlledClubId: 'club-a',
    domainIds: ['POST_PLAY_REVIEW'], manualDomainIds: ['POST_PLAY_REVIEW'] };
  const controls = openSqliteWorldControlStore(path);
  controls.initialize({ careerId: 'career-a', worldRevision: 0, control });
  expect(controls.readHead('career-a')).toEqual({ careerId: 'career-a', worldRevision: 0, control }); controls.close();
  const pure = reviewFixture({ noDeadline: true, noOfficialPolicy });
  pure.source.policy!.opportunities[0].clubId = 'club-a';
  pure.source.policy!.opportunities[0].requesterIds = ['controller', 'manager-a', 'review-official'];
  const match = { ruleProfileId: pure.seed.ruleProfile.id, playId: 1, inning: 1, half: 'top', outs: 0, balls: 0, strikes: 0,
    bases: { first: null, second: null, third: null }, score: { home: 0, away: 0 } };
  const binding = (playerId: string, side: 'HOME' | 'AWAY') => ({ careerId: 'career-a', competitionEditionId: 'league-season-1',
    fixtureEventId: 'fixture', gameId: 'game', gameDay: 10, playerId, personId: `person:${playerId}`, side,
    clubId: side === 'HOME' ? 'club-a' : 'club-b' });
  const frame = { gameId: 'game', match, officialRevision: 0, activation: null, batterActor: { binding: binding('batter', 'AWAY') },
    bindings: Array.from({ length: 9 }, (_, i) => binding(`defender:${i}`, 'HOME')) };
  const adjudication = { source: pure.seed.source, kind: pure.seed.kind, gameId: 'game', playId: 1,
    physicalPitchSourceId: 'pitch', ruleProfile: pure.seed.ruleProfile, ledger: pure.seed.ledger,
    pendingReasons: pure.seed.pendingReasons, endReference: pure.seed.endReference,
    originalMatch: match, originalOfficialRevision: 0 };
  const end = { source: { sourceId: 'end', sourceVersion: 'fixture-v1', baseFieldSourceId: 'base-field' }, kind: 'ended',
    gameId: 'game', playId: 1, physicalPitchSourceId: 'pitch', exactEnd: pure.seed.exactEnd, playEnd: pure.seed.ledger.playEnd };
  const field = { source: { sourceId: 'base-field' }, response: { touch: { worldContact: { flight: {
    physicalPitch: { source: { sourceId: 'pitch' }, frame } } } } } };
  const session = { ...pure.source, adjudicationSnapshotHash: hash(adjudication) };
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE fixture_review_inputs(kind TEXT NOT NULL,source_id TEXT NOT NULL,value_json TEXT NOT NULL,reference_json TEXT,PRIMARY KEY(kind,source_id));
    CREATE TABLE IF NOT EXISTS official_fixtures(game_id TEXT PRIMARY KEY,fixture_event_id TEXT,venue_id TEXT,fixture_revision INTEGER);
    CREATE TABLE IF NOT EXISTS matches(match_id TEXT PRIMARY KEY,durable_revision INTEGER,state_json TEXT,activation_json TEXT);`);
  db.prepare('INSERT INTO official_fixtures VALUES(?,?,?,?)').run('game', 'fixture', 'venue', 0);
  db.prepare('INSERT INTO matches VALUES(?,?,?,NULL)').run('game', 0, json(match));
  for (const [kind, sourceId, value, reference] of [['adjudication', 'adjudication', adjudication, null],
    ['end', 'end', end, pure.seed.endReference], ['field', 'base-field', field, null]] as const) {
    db.prepare('INSERT INTO fixture_review_inputs VALUES(?,?,?,?)').run(kind, sourceId, json(value), reference === null ? null : json(reference));
  }
  expect(db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
  expect(db.prepare('PRAGMA database_list').all().find(r => r.name === 'main')!.file).toBe(path);
  const sessions = new Map<string, unknown>([[session.sourceId, session]]), events = new Map<string, unknown>(), intents = new Map<string, unknown>();
  const authority: NativeReviewAuthority = { readAcceptedSession: id => sessions.get(id) ?? null,
    readAcceptedEvent: id => events.get(id) ?? null, readAcceptedIntent: id => intents.get(id) ?? null };
  const human = (action: 'request' | 'decline' = 'request') => {
    const value = intentFixture('review', action);
    return { ...value, control, opportunity: { ...value.opportunity, worldRevision: 0, clubId: 'club-a', managerId: 'manager-a', appointmentId: 'appointment-a' },
      submission: { ...value.submission, expectedControlRevision: 0, expectedWorldRevision: 0 } };
  };
  const official = () => ({ sourceId: 'official-intent', sourceVersion: 'fixture-v1', capability: 'actual_post_play_review_official_intent_v1',
    sessionSourceId: session.sourceId, gameId: 'game', playId: 1, physicalPitchSourceId: 'pitch', callId: 'call', windowId: 'review',
    entitlementSourceId: 'entitlement:review', officialId: 'review-official', action: 'request' });
  const rows = () => ['actual_post_play_review_sessions', 'actual_post_play_review_events', 'actual_post_play_review_heads']
    .map(table => ({ table, rows: db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all() }));
  return { path, db, session, adjudication, end, field, control, home, makeClub: club, sessions, events, intents, authority, human, official, rows };
};
