import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createRosterState } from '../../core/world/roster/RosterState';
import type { RosterState } from '../../core/world/roster/RosterTypes';
import { canonicalRosterEvidenceJson as rosterJson } from './RosterEvidenceJson';
import { ensurePlayerPersonLinkSchema,
  isAcceptedPlayerIntakeSource,
  type AcceptedPlayerIntakeAuthority,
  type AcceptedPlayerIntakeSource } from
  './SqlitePlayerPersonLinkStore';

export type DurablePlayerIntake = Readonly<{
  source: AcceptedPlayerIntakeSource;
  rosterBeforeRevision: number;
  rosterAfterRevision: number;
}>;
export type SqlitePlayerIntakeStore = Readonly<{
  accept(sourceId: string): DurablePlayerIntake;
  read(sourceId: string): DurablePlayerIntake | null;
  close(): void;
}>;

type RosterRow = { revision: number; roster_json: string };
type IntakeRow = { career_id: string; player_id: string;
  person_id: string; source_record_id: string;
  before_revision: number; after_revision: number;
  source_json: string; after_json: string };
type LinkRow = { source_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const revision = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0)) : item);

/** Materialize one accepted new Player and Person in the global roster atomically. */
export const openSqlitePlayerIntakeStore = (
  databasePath: string,
  authority?: AcceptedPlayerIntakeAuthority | null,
): SqlitePlayerIntakeStore => {
  if (!id(databasePath) || (authority != null
    && typeof authority.readAcceptedPlayerIntake !== 'function')) {
    throw new Error('invalid Player intake store source');
  }
  const Database = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const db = new Database(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  ensurePlayerPersonLinkSchema(db);
  db.exec(`CREATE TABLE IF NOT EXISTS world_player_intakes (
    source_id TEXT PRIMARY KEY, career_id TEXT NOT NULL,
    player_id TEXT NOT NULL, person_id TEXT NOT NULL,
    source_record_id TEXT NOT NULL,
    before_revision INTEGER NOT NULL CHECK(before_revision >= 0),
    after_revision INTEGER NOT NULL CHECK(after_revision > before_revision),
    source_json TEXT NOT NULL, after_json TEXT NOT NULL,
    UNIQUE(career_id, player_id), UNIQUE(career_id, person_id),
    UNIQUE(career_id, source_record_id)
  );`);
  const get = db.prepare(`SELECT career_id, player_id, person_id,
    source_record_id,
    before_revision, after_revision, source_json, after_json
    FROM world_player_intakes WHERE source_id=?`);
  const getRoster = db.prepare(`SELECT revision, roster_json
    FROM world_roster_heads WHERE career_id=?`);
  const getLink = db.prepare(`SELECT source_json
    FROM world_player_person_links WHERE source_id=?`);
  const row = (sourceId: string): IntakeRow | null =>
    (get.get(sourceId) as IntakeRow | undefined) ?? null;
  const rosterHead = (careerId: string): RosterState | null => {
    const stored = getRoster.get(careerId) as RosterRow | undefined;
    if (!stored) return null;
    const roster = createRosterState(JSON.parse(stored.roster_json));
    if (roster.careerId !== careerId
      || roster.revision !== stored.revision
      || rosterJson(roster) !== stored.roster_json) {
      throw new Error('corrupt global roster head');
    }
    return roster;
  };
  const read = (sourceId: string): DurablePlayerIntake | null => {
    if (!id(sourceId)) throw new Error('invalid Player intake sourceId');
    const stored = row(sourceId);
    if (!stored) return null;
    const source = JSON.parse(stored.source_json) as
      AcceptedPlayerIntakeSource;
    const after = createRosterState(JSON.parse(stored.after_json));
    const head = rosterHead(stored.career_id);
    const link = getLink.get(sourceId) as LinkRow | undefined;
    if (!isAcceptedPlayerIntakeSource(source, sourceId)
      || !revision(stored.before_revision)
      || stored.after_revision !== stored.before_revision + 1
      || source.rosterRevision !== stored.after_revision
      || source.careerId !== stored.career_id
      || source.playerId !== stored.player_id
      || source.personId !== stored.person_id
      || source.sourceRecordId !== stored.source_record_id
      || canonicalJson(source) !== stored.source_json
      || rosterJson(after) !== stored.after_json
      || after.careerId !== source.careerId
      || after.revision !== stored.after_revision
      || after.effectiveDay !== source.acceptedAtDay
      || !after.players.some((player) =>
        player.playerId === source.playerId
        && player.clubRights.rightsHolderClubId === null
        && player.assignment === null)
      || link?.source_json !== stored.source_json
      || !head || head.revision < after.revision
      || head.effectiveDay < after.effectiveDay
      || !head.players.some((player) =>
        player.playerId === source.playerId)
      || (head.revision === after.revision
        && rosterJson(head) !== stored.after_json)) {
      throw new Error('corrupt durable Player intake');
    }
    return Object.freeze({ source,
      rosterBeforeRevision: stored.before_revision,
      rosterAfterRevision: stored.after_revision });
  };
  let closed = false;
  return Object.freeze({
    accept(sourceId: string): DurablePlayerIntake {
      if (!id(sourceId)) throw new Error('invalid Player intake sourceId');
      db.exec('BEGIN IMMEDIATE');
      try {
        const prior = row(sourceId);
        if (prior) {
          const result = read(sourceId)!;
          db.exec('COMMIT');
          return result;
        }
        if (!authority) {
          throw new Error('accepted Player intake authority is required');
        }
        const raw = authority.readAcceptedPlayerIntake(sourceId);
        const source = raw === null ? null : cloneInert(raw);
        if (!isAcceptedPlayerIntakeSource(source, sourceId)) {
          throw new Error('accepted Player intake source is absent or invalid');
        }
        const before = rosterHead(source.careerId);
        if (!before || before.revision + 1 !== source.rosterRevision
          || source.acceptedAtDay < before.effectiveDay
          || before.players.some((player) =>
            player.playerId === source.playerId)
          || getLink.get(sourceId)) {
          throw new Error('accepted Player intake does not extend global roster');
        }
        const after = createRosterState({ ...before,
          revision: source.rosterRevision,
          effectiveDay: source.acceptedAtDay,
          players: [...before.players, {
            playerId: source.playerId,
            clubRights: { rightsHolderClubId: null, contractId: null },
            assignment: null,
            registrations: [],
            availability: { status: 'UNAVAILABLE',
              evidenceId: source.sourceRecordId },
          }],
        });
        const sourceJson = canonicalJson(source);
        const afterJson = rosterJson(after);
        db.prepare(`INSERT INTO world_player_person_links
          (source_id, career_id, player_id, person_id,
           roster_revision, accepted_at_day, source_json)
          VALUES (?, ?, ?, ?, ?, ?, ?)`).run(source.sourceId,
            source.careerId, source.playerId, source.personId,
            source.rosterRevision, source.acceptedAtDay, sourceJson);
        db.prepare(`INSERT INTO world_player_intakes
          (source_id, career_id, player_id, person_id,
           source_record_id,
           before_revision, after_revision, source_json, after_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(source.sourceId,
            source.careerId, source.playerId, source.personId,
            source.sourceRecordId,
            before.revision, after.revision, sourceJson, afterJson);
        const updated = db.prepare(`UPDATE world_roster_heads
          SET revision=?, roster_json=? WHERE career_id=?
          AND revision=? AND roster_json=?`).run(after.revision,
            afterJson, source.careerId, before.revision,
            rosterJson(before));
        if (updated.changes !== 1) {
          throw new Error('Player intake roster CAS failed');
        }
        const result = read(sourceId)!;
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    read,
    close(): void { if (!closed) { db.close(); closed = true; } },
  });
};
