import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { commandReader } from '../../core/world/club/ClubCommands';
import { replayClubEvents } from '../../core/world/club/ClubEvents';
import { applyClubCommand } from '../../core/world/club/ClubLifecycle';
import type { ClubCommand, ClubSeasonSnapshot, ClubTransitionEvent, ClubWorldState } from '../../core/world/club/ClubTypes';
import { freeze } from '../../core/world/club/ClubValidation';
import { appendAcceptedClubEvents, ensureClubEventJournalSchema, readAcceptedClubHistory } from './SqliteClubEventJournal';

export type AcceptedClubSeasonTransition = Readonly<{
  sourceId: string; sourceVersion: string; command: ClubCommand;
}>;
export type DurableClubSeasonTransition = Readonly<{
  source: AcceptedClubSeasonTransition; state: ClubWorldState; event: ClubTransitionEvent;
}>;
export type SqliteClubSeasonTransitionStore = Readonly<{
  apply(sourceId: string): DurableClubSeasonTransition;
  readApplication(sourceId: string): DurableClubSeasonTransition | null;
  readSeasonSnapshot(careerId: string, clubId: string, season: number): ClubSeasonSnapshot | null;
  close(): void;
}>;
type TransitionRow = { source_id: string; career_id: string; club_id: string;
  before_revision: number; after_revision: number; source_json: string; before_json: string; result_json: string };
type SnapshotRow = { career_id: string; club_id: string; season: number; snapshot_id: string; source_id: string; snapshot_json: string };
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const json = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) =>
  item !== null && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const source = (input: unknown, sourceId: string): AcceptedClubSeasonTransition => {
  const parsed = cloneInert(input) as AcceptedClubSeasonTransition;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
    || Object.keys(parsed).length !== 3 || !['sourceId', 'sourceVersion', 'command'].every((key) => Object.hasOwn(parsed, key))
    || parsed.sourceId !== sourceId || !id(parsed.sourceId) || !id(parsed.sourceVersion)) {
    throw new Error('invalid accepted Club season transition');
  }
  const command = commandReader(parsed.command, 'command');
  const kinds = command.operations.map((operation) => operation.kind).join(',');
  if (!['CLOSE_SEASON', 'OPEN_SEASON', 'CLOSE_SEASON,OPEN_SEASON'].includes(kinds)) {
    throw new Error('Club season transition only accepts close/open operations');
  }
  return freeze({ sourceId, sourceVersion: parsed.sourceVersion, command });
};

/** Accepted season boundaries advance the actual shared World head, never a history snapshot. */
export const openSqliteClubSeasonTransitionStore = (databasePath: string,
  authority?: Readonly<{ readAcceptedTransition(sourceId: string): AcceptedClubSeasonTransition | null }> | null,
): SqliteClubSeasonTransitionStore => {
  if (!id(databasePath) || authority != null && typeof authority.readAcceptedTransition !== 'function') {
    throw new Error('invalid Club season transition sources');
  }
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
  ensureClubEventJournalSchema(db);
  db.exec(`CREATE TABLE IF NOT EXISTS world_club_season_transitions (
    source_id TEXT PRIMARY KEY, career_id TEXT NOT NULL, club_id TEXT NOT NULL,
    before_revision INTEGER NOT NULL CHECK(before_revision >= 0),
    after_revision INTEGER NOT NULL CHECK(after_revision = before_revision + 1),
    source_json TEXT NOT NULL, before_json TEXT NOT NULL, result_json TEXT NOT NULL,
    UNIQUE(career_id, club_id, after_revision)
  );
  CREATE TABLE IF NOT EXISTS world_club_season_transition_snapshots (
    career_id TEXT NOT NULL, club_id TEXT NOT NULL, season INTEGER NOT NULL CHECK(season > 0),
    snapshot_id TEXT NOT NULL, source_id TEXT NOT NULL, snapshot_json TEXT NOT NULL,
    PRIMARY KEY(career_id, club_id, season), UNIQUE(career_id, snapshot_id),
    FOREIGN KEY(source_id) REFERENCES world_club_season_transitions(source_id)
  );`);
  const getApplication = db.prepare('SELECT * FROM world_club_season_transitions WHERE source_id=?');
  const getSnapshots = db.prepare('SELECT * FROM world_club_season_transition_snapshots WHERE source_id=?');
  let closed = false;
  const scope = (...ids: string[]): void => { if (closed || ids.some((value) => !id(value))) throw new Error('invalid Club season transition scope'); };
  const readApplication = (sourceId: string): DurableClubSeasonTransition | null => {
    scope(sourceId);
    const row = getApplication.get(sourceId) as TransitionRow | undefined;
    if (!row) return null;
    try {
      const accepted = source(JSON.parse(row.source_json), sourceId);
      const command = accepted.command;
      const history = readAcceptedClubHistory(db, command.careerId, command.clubId);
      if (!history || row.source_id !== sourceId || row.career_id !== command.careerId || row.club_id !== command.clubId
        || row.before_revision !== command.expectedRevision || row.after_revision !== command.expectedRevision + 1
        || row.source_json !== json(accepted) || command.expectedRevision < history.checkpoint.revision) {
        throw new Error('transition scope or revision differs');
      }
      const before = replayClubEvents(history.checkpoint,
        history.acceptedEvents.filter((event) => event.afterRevision <= command.expectedRevision));
      if (!before.ok || before.value.revision !== command.expectedRevision || json(before.value) !== row.before_json) {
        throw new Error('transition before state differs');
      }
      const result = applyClubCommand(before.value, command);
      if (!result.ok) throw new Error(result.reason.code);
      const durable = freeze({ source: accepted, state: result.state, event: result.event });
      const actual = history.acceptedEvents.find((event) => event.afterRevision === row.after_revision);
      if (!actual || json(actual) !== json(result.event) || row.result_json !== json(durable)) {
        throw new Error('transition result differs from accepted journal');
      }
      const snapshots = getSnapshots.all(sourceId) as SnapshotRow[];
      if (snapshots.length !== result.event.historySnapshots.length || snapshots.some((saved) => {
        const expected = result.event.historySnapshots.find((snapshot) => snapshot.snapshotId === saved.snapshot_id);
        return !expected || saved.source_id !== sourceId || saved.career_id !== command.careerId || saved.club_id !== command.clubId
          || saved.season !== expected.season || saved.snapshot_json !== json(expected);
      })) throw new Error('season snapshot archive differs');
      return durable;
    } catch (cause) { throw new Error('corrupt durable Club season transition', { cause }); }
  };
  return Object.freeze({
    apply(sourceId: string): DurableClubSeasonTransition {
      scope(sourceId);
      db.exec('BEGIN IMMEDIATE');
      try {
        const prior = readApplication(sourceId);
        const input = authority?.readAcceptedTransition(sourceId) ?? null;
        if (prior) {
          if (input !== null && json(source(input, sourceId)) !== json(prior.source)) throw new Error('frozen Club season Source differs');
          db.exec('COMMIT'); return prior;
        }
        if (input === null) throw new Error('missing accepted Club season transition');
        const accepted = source(input, sourceId), command = accepted.command;
        const history = readAcceptedClubHistory(db, command.careerId, command.clubId);
        if (!history) throw new Error('Club season transition lacks accepted World Club history');
        const before = replayClubEvents(history.checkpoint, history.acceptedEvents);
        if (!before.ok) throw new Error(before.reason.code);
        const result = applyClubCommand(before.value, command);
        if (!result.ok) throw new Error(result.reason.code);
        for (const snapshot of result.event.historySnapshots) {
          if (db.prepare('SELECT 1 FROM world_club_season_transition_snapshots WHERE career_id=? AND (snapshot_id=? OR (club_id=? AND season=?))')
            .get(snapshot.careerId, snapshot.snapshotId, snapshot.clubId, snapshot.season)) throw new Error('duplicate Club season snapshot');
        }
        const durable = freeze({ source: accepted, state: result.state, event: result.event });
        appendAcceptedClubEvents(db, before.value, [result.event], result.state);
        const updated = db.prepare('UPDATE world_club_heads SET revision=?, state_json=? WHERE career_id=? AND club_id=? AND revision=?')
          .run(result.state.revision, json(result.state), command.careerId, command.clubId, command.expectedRevision);
        if (updated.changes !== 1) throw new Error('stale Club season transition head');
        db.prepare(`INSERT INTO world_club_season_transitions
          (source_id, career_id, club_id, before_revision, after_revision, source_json, before_json, result_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(sourceId, command.careerId, command.clubId,
            command.expectedRevision, result.state.revision, json(accepted), json(before.value), json(durable));
        for (const snapshot of result.event.historySnapshots) {
          db.prepare(`INSERT INTO world_club_season_transition_snapshots
            (career_id, club_id, season, snapshot_id, source_id, snapshot_json) VALUES (?, ?, ?, ?, ?, ?)`)
            .run(snapshot.careerId, snapshot.clubId, snapshot.season, snapshot.snapshotId, sourceId, json(snapshot));
        }
        db.exec('COMMIT'); return durable;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    readApplication,
    readSeasonSnapshot(careerId: string, clubId: string, season: number): ClubSeasonSnapshot | null {
      scope(careerId, clubId);
      if (!Number.isSafeInteger(season) || season < 1) throw new Error('invalid Club season snapshot year');
      const row = db.prepare('SELECT * FROM world_club_season_transition_snapshots WHERE career_id=? AND club_id=? AND season=?')
        .get(careerId, clubId, season) as SnapshotRow | undefined;
      if (!row) return null;
      const saved = readApplication(row.source_id)?.event.historySnapshots.find((snapshot) =>
        snapshot.careerId === careerId && snapshot.clubId === clubId && snapshot.season === season && snapshot.snapshotId === row.snapshot_id);
      if (!saved || row.snapshot_json !== json(saved)) throw new Error('corrupt durable Club season snapshot');
      return saved;
    },
    close(): void { if (!closed) { db.close(); closed = true; } },
  });
};
