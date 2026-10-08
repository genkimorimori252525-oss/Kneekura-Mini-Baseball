import { officialStateSerialized as serialized, officialStateHash as hash } from './OfficialStateEncoding';
import { deriveOfficialPendingNonLiveResult, officialPendingNonLiveInput, readOfficialPendingMatch,
  type OfficialPendingPostPlay, type PersistOfficialPendingNonLiveInput, type PersistOfficialPendingNonLiveResult } from './OfficialPendingPostPlay';
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
import type { SqliteEvidenceGuard } from './SqliteEvidenceGuard';

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
  pendingPostPlay?: OfficialPendingPostPlay;
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

/** Pure preparation shared with source owners validating this writer's exact result. */
export const deriveOfficialPlayResult = (
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

export const deriveOfficialFinalResult = (
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

// Shared only with the legacy store's unchanged initializer/fixture methods.
// One validator and one serialization implementation remain authoritative.
export { nonEmpty as officialStateNonEmpty, revision as officialStateRevision,
  validateMatchState as officialStateValidateMatchState, serialized as officialStateSerialized };

type OfficialStateWriteOutcome<T> = Readonly<{ readResult(): T }>;
type PreparedOfficialStateWrite<T> = Readonly<{ kind: 'write'; write(): OfficialStateWriteOutcome<T> }>;

/** A connection-bound official writer, never a connection or transaction owner.
 * Preparation retains legacy retry/derivation order. A result from write() is
 * still uncommitted: only the caller may commit or roll back its transaction.
 * readResult() defers stored-result decoding so the legacy adapter can retain
 * COMMIT-before-decode on in-transaction retries. A borrowed caller can instead
 * decode and validate inside its owned transaction before deciding to commit.
 * The active-transaction check is a prerequisite, not an ownership proof. */
export class SqliteOfficialStateWriter {
  constructor(private readonly database: DatabaseSyncType,
    private readonly evidenceGuard?: SqliteEvidenceGuard<PersistOfficialPlayInput | PersistOfficialFinalInput>) {
    if (evidenceGuard !== undefined && typeof evidenceGuard !== 'function') throw new Error('invalid official application evidence guard');
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
    const pending = readOfficialPendingMatch(this.database, id, row);
    if (pending) return Object.freeze({ durableRevision: revision(row.durable_revision, 'stored durable revision'),
      matchState: validateMatchState(pending.receipt.appliedMatchState), activation: null, nextWorld: null, finalResult: null,
      pendingPostPlay: pending.pendingPostPlay });
    const storedActivation = row.activation_json === null
      ? null : cloneInert(JSON.parse(row.activation_json) as
        | NextLiveBallPlayActivation
        | { activation: NextLiveBallPlayActivation; nextWorld: CanonicalWorldSnapshot }
        | { finalResult: OfficialGameResult });
    const finalResult = storedActivation !== null && 'finalResult' in storedActivation
      ? storedActivation.finalResult : null;
    const matchState = validateMatchState(cloneInert(
      JSON.parse(row.state_json) as CanonicalMatchState));
    const activation = storedActivation === null || 'finalResult' in storedActivation
      ? null : 'activation' in storedActivation
        ? storedActivation.activation : storedActivation;
    if (activation !== null && (
      activation.durableRevision !== row.durable_revision
      || serialized(activation.nextMatchState) !== serialized(matchState))) {
      throw new Error('durable activation does not match MatchState');
    }
    if (finalResult !== null && (
      finalResult.gameId !== id
      || finalResult.durableRevision !== row.durable_revision
      || finalResult.awayRuns !== matchState.score.away
      || finalResult.homeRuns !== matchState.score.home)) {
      throw new Error('durable final result does not match MatchState');
    }
    return Object.freeze({
      durableRevision: revision(row.durable_revision, 'stored durable revision'),
      matchState,
      activation,
      nextWorld: storedActivation === null || !('activation' in storedActivation)
        ? null : storedActivation.nextWorld,
      finalResult,
    });
  }

  prepareActivation(input: PersistOfficialPlayInput):
    Readonly<{ kind: 'retry'; result: PersistOfficialPlayResult }> | PreparedOfficialStateWrite<PersistOfficialPlayResult> {
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
      this.evidenceGuard?.(this.database, request, 'retry');
      if (priorBeforePrepare.request_hash !== requestHash) {
        throw new Error('applicationId was already used for different input');
      }
      return Object.freeze({ kind: 'retry', result: cloneInert(JSON.parse(priorBeforePrepare.result_json) as PersistOfficialPlayResult) });
    }
    const currentBeforePrepare = this.getMatch(request.matchId);
    if (currentBeforePrepare?.pendingPostPlay) throw new Error('match has pending post-play effects');
    if (currentBeforePrepare?.finalResult) {
      throw new Error('match is already finalized');
    }
    const result = deriveOfficialPlayResult(request, nextRevision);
    return this.prepareWrite(() => {
      const prior = this.database.prepare(`
        SELECT request_hash, result_json FROM applications WHERE application_id=?
      `).get(request.applicationId) as ApplicationRow | undefined;
      if (prior !== undefined) {
        this.evidenceGuard?.(this.database, request, 'retry');
        if (prior.request_hash !== requestHash) {
          throw new Error('applicationId was already used for different input');
        }
        return Object.freeze({ readResult: () => cloneInert(JSON.parse(prior.result_json) as PersistOfficialPlayResult) });
      }
      const closureId = result.receipt.closureId;
      this.evidenceGuard?.(this.database, request, 'write');
      const appliedClosure = this.database.prepare(`
        SELECT application_id FROM applications WHERE match_id=? AND closure_id=?
      `).get(request.matchId, closureId);
      if (appliedClosure !== undefined) throw new Error('official closure was already applied');
      const current = this.getMatch(request.matchId);
      if (current === null) throw new Error('match is not initialized');
      if (current.pendingPostPlay) throw new Error('match has pending post-play effects');
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
      this.evidenceGuard?.(this.database, request, 'written');
      return Object.freeze({ readResult: () => result });
    });
  }

  prepareFinalization(input: PersistOfficialFinalInput):
    PreparedOfficialStateWrite<PersistOfficialFinalResult> {
    const request = cloneInert(input);
    nonEmpty(request.matchId, 'matchId');
    nonEmpty(request.applicationId, 'applicationId');
    const expected = revision(request.expectedDurableRevision, 'expectedDurableRevision');
    const nextRevision = revision(expected + 1, 'next durable revision');
    const prepared = deriveOfficialFinalResult(request, nextRevision);
    const requestHash = hash({ kind: 'game_final', request });
    return this.prepareWrite(() => {
      const prior = this.database.prepare(`
        SELECT request_hash, result_json FROM applications WHERE application_id=?
      `).get(request.applicationId) as ApplicationRow | undefined;
      if (prior !== undefined) {
        this.evidenceGuard?.(this.database, request, 'retry');
        if (prior.request_hash !== requestHash) {
          throw new Error('applicationId was already used for different input');
        }
        return Object.freeze({ readResult: () => cloneInert(JSON.parse(prior.result_json) as PersistOfficialFinalResult) });
      }
      this.evidenceGuard?.(this.database, request, 'write');
      const current = this.getMatch(request.matchId);
      if (current === null) throw new Error('match is not initialized');
      if (current.pendingPostPlay) throw new Error('match has pending post-play effects');
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
      this.evidenceGuard?.(this.database, request, 'written');
      return Object.freeze({ readResult: () => prepared });
    });
  }

  /** Persists official truth without inventing a next-play setup or right.
   * The caller owns source authentication, companion stage and transaction. */
  preparePendingNonLive(input: PersistOfficialPendingNonLiveInput): PreparedOfficialStateWrite<PersistOfficialPendingNonLiveResult> {
    const request = officialPendingNonLiveInput(input);
    const expected = revision(request.expectedDurableRevision, 'expectedDurableRevision');
    const nextRevision = revision(expected + 1, 'next durable revision');
    const prepared = deriveOfficialPendingNonLiveResult(request, nextRevision), requestHash = hash(request);
    return this.prepareWrite(() => {
      if (this.database.prepare('PRAGMA main.user_version').get()!.user_version !== 3) {
        throw new Error('pending official state requires schema version 3');
      }
      const prior = this.database.prepare('SELECT * FROM main.applications WHERE application_id=?').get(request.applicationId);
      if (prior) {
        if (prior.request_hash !== requestHash) throw new Error('applicationId was already used for different input');
        if (prior.application_id !== request.applicationId || prior.match_id !== request.matchId
          || prior.closure_id !== prepared.receipt.closureId || prior.result_json !== serialized(prepared)) {
          throw new Error('pending official result mirror differs');
        }
        const current = this.getMatch(request.matchId);
        if (!current?.pendingPostPlay || current.durableRevision !== nextRevision
          || serialized(current.matchState) !== serialized(prepared.receipt.appliedMatchState)
          || serialized(current.pendingPostPlay) !== serialized(prepared.pendingPostPlay)) {
          throw new Error('pending official Match mirror differs');
        }
        return Object.freeze({ readResult: () => prepared });
      }
      const current = this.getMatch(request.matchId);
      if (!current) throw new Error('match is not initialized');
      if (current.pendingPostPlay) throw new Error('match has pending post-play effects');
      if (current.finalResult) throw new Error('match is already finalized');
      if (current.durableRevision !== expected) throw new Error('stale durable MatchState revision');
      if (serialized(current.matchState) !== serialized(request.match)) throw new Error('prior MatchState does not match durable state');
      if (request.game !== null && serialized(this.getOfficialFixture(request.matchId)) !== serialized(request.game.venueBinding)) {
        throw new Error('official game venue must match pre-game durable fixture');
      }
      if (this.database.prepare('SELECT application_id FROM main.applications WHERE match_id=? AND closure_id=?')
        .get(request.matchId, prepared.receipt.closureId)) throw new Error('official closure was already applied');
      const update = this.database.prepare('UPDATE main.matches SET durable_revision=?,state_json=?,activation_json=? WHERE match_id=? AND durable_revision=?')
        .run(nextRevision, serialized(prepared.receipt.appliedMatchState), serialized({ pendingPostPlay: prepared.pendingPostPlay }), request.matchId, expected);
      if (update.changes !== 1) throw new Error('stale durable MatchState revision');
      this.database.prepare('INSERT INTO main.applications(application_id,match_id,closure_id,request_hash,result_json) VALUES(?,?,?,?,?)')
        .run(request.applicationId, request.matchId, prepared.receipt.closureId, requestHash, serialized(prepared));
      return Object.freeze({ readResult: () => prepared });
    });
  }

  /** Do not expose the captured request/result or allow a returned result to
   * become the input to a second write after caller rollback. */
  private prepareWrite<T>(write: () => OfficialStateWriteOutcome<T>): PreparedOfficialStateWrite<T> {
    let used = false;
    return Object.freeze({ kind: 'write', write: () => {
      if (!this.database.isTransaction) throw new Error('official state writer requires a caller-owned transaction');
      if (used) throw new Error('official state prepared write was already used');
      used = true;
      return write();
    } });
  }
}
