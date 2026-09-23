import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import {
  activateNextLiveBallPlay,
  confirmDurableClosedLiveBallStateApplication,
  type NextLiveBallPlayActivation,
  type OfficialStateApplicationReceipt,
} from '../core/adjudication/NextPlayActivation';
import {
  activateNextNonLivePlateAppearance,
  confirmDurableClosedNonLiveStateApplication,
  deriveClosedNonLiveMatchState,
  type NonLiveOfficialContext,
} from '../core/adjudication/NonLiveOfficialApplication';
import { cloneInert } from '../core/adjudication/OfficialWindowPolicy';
import {
  prepareBetweenPlayWorld,
  type BetweenPlayWorldSetup,
} from '../core/adjudication/BetweenPlayWorldReset';
import { deriveClosedLiveBallMatchState, type PlayAdjudicationLedger } from '../core/adjudication/PlayAdjudicationLedger';
import type { CanonicalMatchState } from '../core/model/CanonicalMatchState';
import {
  resolveOfficialGameBoundary,
  type OfficialGameBoundaryInput,
  type OfficialGameResult,
  type OfficialGameVenueBinding,
} from '../core/world/competition/OfficialGameCompletion';
import type { CanonicalWorldSnapshot } from '../core/model/CanonicalWorldSnapshot';
import type { CanonicalPlateAppearanceTimeline } from '../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';

const DatabaseSync = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;

type CommonApplication = Readonly<{
  matchId: string;
  applicationId: string;
  expectedDurableRevision: number;
  match: CanonicalMatchState;
  adjudication: PlayAdjudicationLedger;
  nextStartedAtTick: number;
  worldSetup: BetweenPlayWorldSetup;
}>;

export type PersistOfficialPlayInput =
  | (CommonApplication & Readonly<{
      kind: 'live_ball';
      physicalTimeline: CanonicalPlateAppearanceTimeline;
    }>)
  | (CommonApplication & Readonly<{
      kind: 'non_live';
      timeline: CanonicalPlateAppearanceTimeline;
      context: NonLiveOfficialContext;
    }>);

type CommonFinalApplication = Pick<CommonApplication,
  'matchId' | 'applicationId' | 'expectedDurableRevision' | 'match' | 'adjudication'>;
export type PersistOfficialFinalInput =
  | (CommonFinalApplication & Readonly<{
      kind: 'live_ball';
      physicalTimeline: CanonicalPlateAppearanceTimeline;
      game: Omit<OfficialGameBoundaryInput, 'gameId' | 'priorMatch' | 'application'>;
    }>)
  | (CommonFinalApplication & Readonly<{
      kind: 'non_live';
      timeline: CanonicalPlateAppearanceTimeline;
      context: NonLiveOfficialContext;
      game: Omit<OfficialGameBoundaryInput, 'gameId' | 'priorMatch' | 'application'>;
    }>);
export type PersistOfficialFinalResult = Readonly<{
  receipt: OfficialStateApplicationReceipt;
  result: OfficialGameResult;
}>;

export type PersistOfficialPlayResult = Readonly<{
  receipt: OfficialStateApplicationReceipt;
  activation: NextLiveBallPlayActivation;
  nextWorld: CanonicalWorldSnapshot;
}>;

export type PersistedMatch = Readonly<{
  durableRevision: number;
  matchState: CanonicalMatchState;
  activation: NextLiveBallPlayActivation | null;
  nextWorld: CanonicalWorldSnapshot | null;
  finalResult: OfficialGameResult | null;
}>;

type MatchRow = { durable_revision: number; state_json: string; activation_json: string | null };
type ApplicationRow = { request_hash: string; result_json: string };
type FixtureRow = { game_id: string; venue_id: string;
  fixture_event_id: string; fixture_revision: number };

const nonEmpty = (value: string, name: string): string => {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${name} must not be empty`);
  return value;
};

const revision = (value: number, name: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative safe integer`);
  return value;
};

const validateMatchState = (state: CanonicalMatchState): CanonicalMatchState => {
  nonEmpty(state.ruleProfileId, 'match ruleProfileId');
  revision(state.playId, 'match playId');
  if (!Number.isSafeInteger(state.inning) || state.inning < 1) throw new Error('match inning is invalid');
  if (state.half !== 'top' && state.half !== 'bottom') throw new Error('match half is invalid');
  for (const [name, value, maximum] of [
    ['outs', state.outs, 2], ['balls', state.balls, 3], ['strikes', state.strikes, 2],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
      throw new Error(`match ${name} is invalid`);
    }
  }
  for (const value of [state.score.away, state.score.home]) revision(value, 'match score');
  const runners = [state.bases.first, state.bases.second, state.bases.third];
  for (const runner of runners) {
    if (runner !== null) nonEmpty(runner, 'base runner');
  }
  const occupied = runners.filter((runner): runner is string => runner !== null);
  if (new Set(occupied).size !== occupied.length) throw new Error('base runners must be unique');
  return state;
};

const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(value).sort()) result[key] = stable((value as Record<string, unknown>)[key]);
    return result;
  }
  return value;
};

const serialized = (value: unknown): string => JSON.stringify(stable(value));
const hash = (value: unknown): string => createHash('sha256').update(serialized(value)).digest('hex');

const prepareApplication = (
  input: PersistOfficialPlayInput,
  durableRevision: number,
): PersistOfficialPlayResult => {
  if (input.kind === 'live_ball') {
    const derived = deriveClosedLiveBallMatchState(input.match, input.physicalTimeline, input.adjudication);
    const receipt = confirmDurableClosedLiveBallStateApplication({
      match: input.match, physicalTimeline: input.physicalTimeline, adjudication: input.adjudication,
      persistedMatchState: derived, applicationId: input.applicationId, durableRevision,
    });
    const activation = activateNextLiveBallPlay({
      match: input.match, physicalTimeline: input.physicalTimeline, adjudication: input.adjudication,
      application: receipt, nextStartedAtTick: input.nextStartedAtTick,
    });
    const nextWorld = prepareBetweenPlayWorld(activation.nextMatchState, input.nextStartedAtTick, input.worldSetup);
    return Object.freeze({ receipt, activation, nextWorld });
  }
  if (input.kind === 'non_live') {
    const shared = {
      match: input.match, timeline: input.timeline, adjudication: input.adjudication, context: input.context,
    };
    const derived = deriveClosedNonLiveMatchState(shared);
    const receipt = confirmDurableClosedNonLiveStateApplication({
      ...shared, persistedMatchState: derived, applicationId: input.applicationId, durableRevision,
    });
    const activation = activateNextNonLivePlateAppearance({
      ...shared, application: receipt, nextStartedAtTick: input.nextStartedAtTick,
    });
    const nextWorld = prepareBetweenPlayWorld(activation.nextMatchState, input.nextStartedAtTick, input.worldSetup);
    return Object.freeze({ receipt, activation, nextWorld });
  }
  throw new Error('unknown official play kind');
};

const prepareFinalApplication = (
  input: PersistOfficialFinalInput,
  durableRevision: number,
): PersistOfficialFinalResult => {
  let receipt: OfficialStateApplicationReceipt;
  if (input.kind === 'live_ball') {
    const derived = deriveClosedLiveBallMatchState(input.match, input.physicalTimeline, input.adjudication);
    receipt = confirmDurableClosedLiveBallStateApplication({
      match: input.match, physicalTimeline: input.physicalTimeline, adjudication: input.adjudication,
      persistedMatchState: derived, applicationId: input.applicationId, durableRevision,
    });
  } else {
    const shared = { match: input.match, timeline: input.timeline,
      adjudication: input.adjudication, context: input.context };
    const derived = deriveClosedNonLiveMatchState(shared);
    receipt = confirmDurableClosedNonLiveStateApplication({
      ...shared, persistedMatchState: derived,
      applicationId: input.applicationId, durableRevision,
    });
  }
  const boundary = resolveOfficialGameBoundary({ ...input.game,
    gameId: input.matchId, priorMatch: input.match, application: receipt });
  if (boundary.kind !== 'GAME_FINAL') {
    throw new Error('official play does not complete the game');
  }
  return Object.freeze({ receipt, result: boundary.result });
};

export class SqliteOfficialStateStore {
  private readonly database: DatabaseSyncType;

  constructor(path: string) {
    nonEmpty(path, 'SQLite path');
    this.database = new DatabaseSync(path);
    this.database.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    const version = this.database.prepare('PRAGMA user_version').get() as { user_version: number };
    if (version.user_version > 2) {
      this.database.close();
      throw new Error('unsupported official state store schema version');
    }
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS matches (
        match_id TEXT PRIMARY KEY,
        durable_revision INTEGER NOT NULL,
        state_json TEXT NOT NULL,
        activation_json TEXT
      );
      CREATE TABLE IF NOT EXISTS applications (
        application_id TEXT PRIMARY KEY,
        match_id TEXT NOT NULL REFERENCES matches(match_id),
        closure_id TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        result_json TEXT NOT NULL,
        UNIQUE(match_id, closure_id)
      );
      CREATE TABLE IF NOT EXISTS official_fixtures (
        game_id TEXT PRIMARY KEY,
        venue_id TEXT NOT NULL,
        fixture_event_id TEXT NOT NULL UNIQUE,
        fixture_revision INTEGER NOT NULL CHECK(fixture_revision >= 0)
      );
      PRAGMA user_version=2;
    `);
  }

  close(): void {
    this.database.close();
  }

  /** Pins an official venue before the match is initialized or played. */
  registerOfficialFixture(input: OfficialGameVenueBinding):
  OfficialGameVenueBinding {
    const fixture = cloneInert(input);
    nonEmpty(fixture.gameId, 'fixture gameId');
    nonEmpty(fixture.venueId, 'fixture venueId');
    nonEmpty(fixture.fixtureEventId, 'fixture eventId');
    revision(fixture.fixtureRevision, 'fixture revision');
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const existing = this.getOfficialFixture(fixture.gameId);
      if (existing) {
        if (serialized(existing) !== serialized(fixture)) {
          throw new Error('official fixture is already pinned differently');
        }
        this.database.exec('COMMIT');
        return existing;
      }
      if (this.getMatch(fixture.gameId) !== null) {
        throw new Error('official fixture must precede match initialization');
      }
      this.database.prepare(`
        INSERT INTO official_fixtures(game_id, venue_id,
          fixture_event_id, fixture_revision) VALUES (?, ?, ?, ?)
      `).run(fixture.gameId, fixture.venueId,
        fixture.fixtureEventId, fixture.fixtureRevision);
      this.database.exec('COMMIT');
      return Object.freeze({ ...fixture });
    } catch (error) {
      this.rollback();
      throw error;
    }
  }

  getOfficialFixture(gameId: string): OfficialGameVenueBinding | null {
    const row = this.database.prepare(`
      SELECT game_id, venue_id, fixture_event_id, fixture_revision
      FROM official_fixtures WHERE game_id=?
    `).get(nonEmpty(gameId, 'fixture gameId')) as FixtureRow | undefined;
    return row ? Object.freeze({ gameId: row.game_id,
      venueId: row.venue_id, fixtureEventId: row.fixture_event_id,
      fixtureRevision: row.fixture_revision }) : null;
  }

  getMatch(matchId: string): PersistedMatch | null {
    const id = nonEmpty(matchId, 'matchId');
    const row = this.database.prepare(`
      SELECT durable_revision, state_json, activation_json FROM matches WHERE match_id=?
    `).get(id) as MatchRow | undefined;
    if (row === undefined) return null;
    const storedActivation = row.activation_json === null
      ? null : cloneInert(JSON.parse(row.activation_json) as
        | NextLiveBallPlayActivation
        | { activation: NextLiveBallPlayActivation; nextWorld: CanonicalWorldSnapshot }
        | { finalResult: OfficialGameResult });
    const finalResult = storedActivation !== null && 'finalResult' in storedActivation
      ? storedActivation.finalResult : null;
    return Object.freeze({
      durableRevision: revision(row.durable_revision, 'stored durable revision'),
      matchState: validateMatchState(cloneInert(JSON.parse(row.state_json) as CanonicalMatchState)),
      activation: storedActivation === null || 'finalResult' in storedActivation ? null
        : 'activation' in storedActivation ? storedActivation.activation : storedActivation,
      nextWorld: storedActivation === null || !('activation' in storedActivation)
        ? null : storedActivation.nextWorld,
      finalResult,
    });
  }

  initializeMatch(matchId: string, matchInput: CanonicalMatchState): PersistedMatch {
    const id = nonEmpty(matchId, 'matchId');
    const match = validateMatchState(cloneInert(matchInput));
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const existing = this.getMatch(id);
      if (existing !== null) {
        if (existing.durableRevision !== 0 || serialized(existing.matchState) !== serialized(match)) {
          throw new Error('match is already initialized with different state');
        }
        this.database.exec('COMMIT');
        return existing;
      }
      this.database.prepare(`
        INSERT INTO matches(match_id, durable_revision, state_json, activation_json) VALUES (?, 0, ?, NULL)
      `).run(id, serialized(match));
      this.database.exec('COMMIT');
      return Object.freeze({ durableRevision: 0, matchState: match,
        activation: null, nextWorld: null, finalResult: null });
    } catch (error) {
      this.rollback();
      throw error;
    }
  }

  applyAndActivate(input: PersistOfficialPlayInput): PersistOfficialPlayResult {
    const request = cloneInert(input);
    nonEmpty(request.matchId, 'matchId');
    nonEmpty(request.applicationId, 'applicationId');
    const expected = revision(request.expectedDurableRevision, 'expectedDurableRevision');
    const nextRevision = revision(expected + 1, 'next durable revision');
    const requestHash = hash(request);
    const priorBeforePrepare = this.database.prepare(`
      SELECT request_hash, result_json FROM applications WHERE application_id=?
    `).get(request.applicationId) as ApplicationRow | undefined;
    if (priorBeforePrepare !== undefined) {
      if (priorBeforePrepare.request_hash !== requestHash) {
        throw new Error('applicationId was already used for different input');
      }
      return cloneInert(JSON.parse(priorBeforePrepare.result_json) as PersistOfficialPlayResult);
    }
    const currentBeforePrepare = this.getMatch(request.matchId);
    if (currentBeforePrepare?.finalResult) {
      throw new Error('match is already finalized');
    }
    const result = prepareApplication(request, nextRevision);
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const prior = this.database.prepare(`
        SELECT request_hash, result_json FROM applications WHERE application_id=?
      `).get(request.applicationId) as ApplicationRow | undefined;
      if (prior !== undefined) {
        if (prior.request_hash !== requestHash) {
          throw new Error('applicationId was already used for different input');
        }
        this.database.exec('COMMIT');
        return cloneInert(JSON.parse(prior.result_json) as PersistOfficialPlayResult);
      }
      const closureId = result.receipt.closureId;
      const appliedClosure = this.database.prepare(`
        SELECT application_id FROM applications WHERE match_id=? AND closure_id=?
      `).get(request.matchId, closureId);
      if (appliedClosure !== undefined) throw new Error('official closure was already applied');
      const current = this.getMatch(request.matchId);
      if (current === null) throw new Error('match is not initialized');
      if (current.finalResult !== null) throw new Error('match is already finalized');
      if (current.durableRevision !== expected) throw new Error('stale durable MatchState revision');
      if (serialized(current.matchState) !== serialized(request.match)) {
        throw new Error('prior MatchState does not match durable state');
      }
      const updated = this.database.prepare(`
        UPDATE matches SET durable_revision=?, state_json=?, activation_json=?
        WHERE match_id=? AND durable_revision=?
      `).run(nextRevision, serialized(result.activation.nextMatchState),
        serialized({ activation: result.activation, nextWorld: result.nextWorld }), request.matchId, expected);
      if (updated.changes !== 1) throw new Error('stale durable MatchState revision');
      this.database.prepare(`
        INSERT INTO applications(application_id, match_id, closure_id, request_hash, result_json)
        VALUES (?, ?, ?, ?, ?)
      `).run(request.applicationId, request.matchId, closureId, requestHash, serialized(result));
      this.database.exec('COMMIT');
      return result;
    } catch (error) {
      this.rollback();
      throw error;
    }
  }

  applyAndFinalize(input: PersistOfficialFinalInput): PersistOfficialFinalResult {
    const request = cloneInert(input);
    nonEmpty(request.matchId, 'matchId');
    nonEmpty(request.applicationId, 'applicationId');
    const expected = revision(request.expectedDurableRevision, 'expectedDurableRevision');
    const nextRevision = revision(expected + 1, 'next durable revision');
    const prepared = prepareFinalApplication(request, nextRevision);
    const requestHash = hash({ kind: 'game_final', request });
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const prior = this.database.prepare(`
        SELECT request_hash, result_json FROM applications WHERE application_id=?
      `).get(request.applicationId) as ApplicationRow | undefined;
      if (prior !== undefined) {
        if (prior.request_hash !== requestHash) {
          throw new Error('applicationId was already used for different input');
        }
        this.database.exec('COMMIT');
        return cloneInert(JSON.parse(prior.result_json) as PersistOfficialFinalResult);
      }
      const current = this.getMatch(request.matchId);
      if (current === null) throw new Error('match is not initialized');
      if (current.finalResult !== null) throw new Error('match is already finalized');
      const fixture = this.getOfficialFixture(request.matchId);
      if ((fixture === null) !== (request.game.venueBinding === undefined)
        || (fixture !== null && serialized(fixture)
          !== serialized(request.game.venueBinding))) {
        throw new Error('official game venue must match pre-game durable fixture');
      }
      const appliedClosure = this.database.prepare(`
        SELECT application_id FROM applications WHERE match_id=? AND closure_id=?
      `).get(request.matchId, prepared.receipt.closureId);
      if (appliedClosure !== undefined) throw new Error('official closure was already applied');
      if (current.durableRevision !== expected) throw new Error('stale durable MatchState revision');
      if (serialized(current.matchState) !== serialized(request.match)) {
        throw new Error('prior MatchState does not match durable state');
      }
      const updated = this.database.prepare(`
        UPDATE matches SET durable_revision=?, state_json=?, activation_json=?
        WHERE match_id=? AND durable_revision=?
      `).run(nextRevision, serialized(prepared.receipt.appliedMatchState),
        serialized({ finalResult: prepared.result }), request.matchId, expected);
      if (updated.changes !== 1) throw new Error('stale durable MatchState revision');
      this.database.prepare(`
        INSERT INTO applications(application_id, match_id, closure_id, request_hash, result_json)
        VALUES (?, ?, ?, ?, ?)
      `).run(request.applicationId, request.matchId,
        prepared.receipt.closureId, requestHash, serialized(prepared));
      this.database.exec('COMMIT');
      return prepared;
    } catch (error) {
      this.rollback();
      throw error;
    }
  }

  private rollback(): void {
    try { this.database.exec('ROLLBACK'); } catch { /* Transaction may already be closed. */ }
  }
}
