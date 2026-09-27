import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { isDeepStrictEqual } from 'node:util';
import { replayClubEvents } from '../../core/world/club/ClubEvents';
import { readState } from '../../core/world/club/ClubSchemas';
import type { ClubTransitionEvent, ClubWorldState } from
  '../../core/world/club/ClubTypes';
import type { MatchdayClubHistory } from
  '../../core/world/club/OfficialMatchdayRevenue';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';

type CheckpointRow = { revision: number; state_json: string };
type EventRow = { after_revision: number; event_id: string;
  event_json: string };
type HeadRow = { revision: number; state_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0)) : item);

/** Call once when opening a World writer, before its first transaction. */
export const ensureClubEventJournalSchema = (db: DatabaseSync): void => {
  db.exec(`CREATE TABLE IF NOT EXISTS world_club_checkpoints (
    career_id TEXT NOT NULL, club_id TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK(revision >= 0),
    state_json TEXT NOT NULL,
    PRIMARY KEY(career_id, club_id)
  );
  CREATE TABLE IF NOT EXISTS world_club_event_journal (
    career_id TEXT NOT NULL, club_id TEXT NOT NULL,
    after_revision INTEGER NOT NULL CHECK(after_revision > 0),
    event_id TEXT NOT NULL, event_json TEXT NOT NULL,
    PRIMARY KEY(career_id, club_id, after_revision),
    UNIQUE(career_id, club_id, event_id),
    FOREIGN KEY(career_id, club_id)
      REFERENCES world_club_checkpoints(career_id, club_id)
  );`);
};

/** Inside the same transaction that inserts the initial World Club head. */
export const initializeClubCheckpoint = (db: DatabaseSync,
  input: ClubWorldState): void => {
  const state = readState(input);
  const careerId = state.careerId;
  const clubId = state.identity.clubId;
  const json = canonicalJson(state);
  const prior = db.prepare(`SELECT revision, state_json
    FROM world_club_checkpoints WHERE career_id=? AND club_id=?`)
    .get(careerId, clubId) as CheckpointRow | undefined;
  if (prior) {
    if (prior.revision !== state.revision || prior.state_json !== json) {
      throw new Error('initial Club checkpoint differs');
    }
    return;
  }
  db.prepare(`INSERT INTO world_club_checkpoints
    (career_id, club_id, revision, state_json) VALUES (?, ?, ?, ?)`)
    .run(careerId, clubId, state.revision, json);
};

/** Replays every accepted event and checks the current World Club head. */
export const readAcceptedClubHistory = (db: DatabaseSync,
  careerId: string, clubId: string): MatchdayClubHistory | null => {
  if (!id(careerId) || !id(clubId)) {
    throw new Error('invalid Club history scope');
  }
  const head = db.prepare(`SELECT revision, state_json FROM world_club_heads
    WHERE career_id=? AND club_id=?`).get(careerId, clubId) as
    HeadRow | undefined;
  const row = db.prepare(`SELECT revision, state_json
    FROM world_club_checkpoints WHERE career_id=? AND club_id=?`)
    .get(careerId, clubId) as CheckpointRow | undefined;
  if (!head && !row) return null;
  if (!head || !row) {
    throw new Error('World Club head lacks an initial accepted checkpoint');
  }
  const checkpoint = readState(JSON.parse(row.state_json));
  if (checkpoint.revision !== row.revision
    || checkpoint.careerId !== careerId
    || checkpoint.identity.clubId !== clubId
    || canonicalJson(checkpoint) !== row.state_json) {
    throw new Error('corrupt initial Club checkpoint');
  }
  const rows = db.prepare(`SELECT after_revision, event_id, event_json
    FROM world_club_event_journal WHERE career_id=? AND club_id=?
    ORDER BY after_revision`).all(careerId, clubId) as EventRow[];
  const events: ClubTransitionEvent[] = [];
  for (const [index, eventRow] of rows.entries()) {
    const event = JSON.parse(eventRow.event_json) as ClubTransitionEvent;
    if (eventRow.after_revision !== row.revision + index + 1
      || event.afterRevision !== eventRow.after_revision
      || event.command?.eventId !== eventRow.event_id
      || event.command.careerId !== careerId
      || event.command.clubId !== clubId
      || canonicalJson(event) !== eventRow.event_json) {
      throw new Error('corrupt accepted Club event journal');
    }
    events.push(event);
  }
  const replay = replayClubEvents(checkpoint, events);
  if (!replay.ok || replay.value.revision !== head.revision
    || canonicalJson(replay.value) !== head.state_json) {
    throw new Error('accepted Club history diverges from World head');
  }
  return Object.freeze({ checkpoint,
    acceptedEvents: Object.freeze(events) });
};

/** Call before updating the Club head, inside the caller's transaction. */
export const appendAcceptedClubEvents = (db: DatabaseSync,
  beforeInput: ClubWorldState,
  inputEvents: readonly ClubTransitionEvent[],
  afterInput: ClubWorldState): void => {
  const before = readState(beforeInput);
  const after = readState(afterInput);
  const history = readAcceptedClubHistory(db, before.careerId,
    before.identity.clubId);
  if (!history || !Array.isArray(inputEvents)
    || inputEvents.length === 0
    || after.careerId !== before.careerId
    || after.identity.clubId !== before.identity.clubId) {
    throw new Error('accepted Club journal append lacks current history');
  }
  const prior = replayClubEvents(history.checkpoint,
    history.acceptedEvents);
  const next = replayClubEvents(before, inputEvents);
  if (!prior.ok || !isDeepStrictEqual(prior.value, before)
    || !next.ok || !isDeepStrictEqual(next.value, after)
    || after.revision !== before.revision + inputEvents.length) {
    throw new Error('accepted Club journal append does not replay');
  }
  for (const event of inputEvents) {
    db.prepare(`INSERT INTO world_club_event_journal
      (career_id, club_id, after_revision, event_id, event_json)
      VALUES (?, ?, ?, ?, ?)`).run(before.careerId,
        before.identity.clubId, event.afterRevision,
        event.command.eventId, canonicalJson(event));
  }
};

/** Read-only production source for MatchdayClubHistory. */
export const openSqliteClubEventJournal = (databasePath: string): Readonly<{
  readHistory(careerId: string, clubId: string): MatchdayClubHistory | null;
  close(): void;
}> => {
  if (!id(databasePath)) throw new Error('invalid Club journal database path');
  const Database = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const db = new Database(databasePath);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  ensureClubEventJournalSchema(db);
  return Object.freeze({
    readHistory: (careerId: string, clubId: string) =>
      readAcceptedClubHistory(db, careerId, clubId),
    close: () => db.close(),
  });
};
