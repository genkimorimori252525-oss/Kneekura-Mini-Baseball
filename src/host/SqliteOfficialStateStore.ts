import { createRequire } from 'node:module';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import { cloneInert } from '../core/adjudication/OfficialWindowPolicy';
import type { CanonicalMatchState } from '../core/model/CanonicalMatchState';
import type { OfficialGameVenueBinding } from '../core/world/competition/OfficialGameCompletion';
import type { SqliteEvidenceGuard } from './SqliteEvidenceGuard';
import { SqliteOfficialStateWriter, officialStateNonEmpty as nonEmpty,
  officialStateRevision as revision, officialStateValidateMatchState as validateMatchState,
  officialStateSerialized as serialized, type PersistOfficialPlayInput, type PersistOfficialPlayResult,
  type PersistOfficialFinalInput, type PersistOfficialFinalResult, type PersistedMatch } from './SqliteOfficialStateWriter';

export { deriveOfficialPlayResult, deriveOfficialFinalResult } from './SqliteOfficialStateWriter';
export type { PersistOfficialPlayInput, PersistOfficialPlayResult, PersistOfficialFinalInput,
  PersistOfficialFinalResult, PersistedMatch } from './SqliteOfficialStateWriter';

const DatabaseSync = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;

export class SqliteOfficialStateStore {
  private readonly database: DatabaseSyncType;
  private readonly writer: SqliteOfficialStateWriter;

  constructor(path: string, private readonly evidenceGuard?: SqliteEvidenceGuard<PersistOfficialPlayInput | PersistOfficialFinalInput>) {
    if (evidenceGuard !== undefined && typeof evidenceGuard !== 'function') throw new Error('invalid official application evidence guard');
    nonEmpty(path, 'SQLite path');
    this.database = new DatabaseSync(path);
    this.database.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    const version = this.database.prepare('PRAGMA user_version').get() as { user_version: number };
    if (version.user_version > 3) {
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
      PRAGMA user_version=${version.user_version === 3 ? 3 : 2};
    `);
    this.writer = new SqliteOfficialStateWriter(this.database, this.evidenceGuard);
  }

  close(): void {
    this.database.close();
  }

  /** Pins an official venue before the match is initialized or played. */
  registerOfficialFixture(input: OfficialGameVenueBinding, evidenceGuard?: SqliteEvidenceGuard<OfficialGameVenueBinding>):
  OfficialGameVenueBinding {
    if (evidenceGuard !== undefined && typeof evidenceGuard !== 'function') throw new Error('invalid fixture evidence guard');
    const fixture = cloneInert(input);
    nonEmpty(fixture.gameId, 'fixture gameId');
    nonEmpty(fixture.venueId, 'fixture venueId');
    nonEmpty(fixture.fixtureEventId, 'fixture eventId');
    revision(fixture.fixtureRevision, 'fixture revision');
    this.database.exec('BEGIN IMMEDIATE');
    try {
      evidenceGuard?.(this.database, fixture, 'write');
      const existing = this.getOfficialFixture(fixture.gameId);
      if (existing) {
        if (serialized(existing) !== serialized(fixture)) {
          throw new Error('official fixture is already pinned differently');
        }
        evidenceGuard?.(this.database, fixture, 'retry');
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
      evidenceGuard?.(this.database, fixture, 'written');
      this.database.exec('COMMIT');
      return Object.freeze({ ...fixture });
    } catch (error) {
      this.rollback();
      throw error;
    }
  }

  getOfficialFixture(gameId: string): OfficialGameVenueBinding | null {
    return this.writer.getOfficialFixture(gameId);
  }

  getMatch(matchId: string): PersistedMatch | null {
    return this.writer.getMatch(matchId);
  }

  initializeMatch(matchId: string, matchInput: CanonicalMatchState,
    evidenceGuard?: SqliteEvidenceGuard<Readonly<{ matchId: string; matchState: CanonicalMatchState }>>): PersistedMatch {
    if (evidenceGuard !== undefined && typeof evidenceGuard !== 'function') throw new Error('invalid initial Match evidence guard');
    const id = nonEmpty(matchId, 'matchId');
    const match = validateMatchState(cloneInert(matchInput));
    const evidence = Object.freeze({ matchId: id, matchState: match });
    this.database.exec('BEGIN IMMEDIATE');
    try {
      evidenceGuard?.(this.database, evidence, 'write');
      const existing = this.getMatch(id);
      if (existing !== null) {
        if (existing.durableRevision !== 0 || serialized(existing.matchState) !== serialized(match)) {
          throw new Error('match is already initialized with different state');
        }
        evidenceGuard?.(this.database, evidence, 'retry');
        this.database.exec('COMMIT');
        return existing;
      }
      this.database.prepare(`
        INSERT INTO matches(match_id, durable_revision, state_json, activation_json) VALUES (?, 0, ?, NULL)
      `).run(id, serialized(match));
      evidenceGuard?.(this.database, evidence, 'written');
      this.database.exec('COMMIT');
      return Object.freeze({ durableRevision: 0, matchState: match,
        activation: null, nextWorld: null, finalResult: null });
    } catch (error) {
      this.rollback();
      throw error;
    }
  }

  applyAndActivate(input: PersistOfficialPlayInput): PersistOfficialPlayResult {
    const prepared = this.writer.prepareActivation(input);
    if (prepared.kind === 'retry') return prepared.result;
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const outcome = prepared.write();
      this.database.exec('COMMIT');
      return outcome.readResult();
    } catch (error) {
      this.rollback();
      throw error;
    }
  }

  applyAndFinalize(input: PersistOfficialFinalInput): PersistOfficialFinalResult {
    const prepared = this.writer.prepareFinalization(input);
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const outcome = prepared.write();
      this.database.exec('COMMIT');
      return outcome.readResult();
    } catch (error) {
      this.rollback();
      throw error;
    }
  }

  private rollback(): void {
    try { this.database.exec('ROLLBACK'); } catch { /* Transaction may already be closed. */ }
  }
}
