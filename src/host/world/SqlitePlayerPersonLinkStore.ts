import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createRosterState } from '../../core/world/roster/RosterState';
import type { RosterState } from '../../core/world/roster/RosterTypes';
import type { AcceptedPlayerPersonLinkAuthority } from
  './SqliteFreeAgentContractStore';

/** An independently accepted intake fact, not a caller-supplied identity claim. */
export type AcceptedPlayerIntakeSource = Readonly<{
  sourceId: string;
  careerId: string;
  playerId: string;
  personId: string;
  sourceRecordId: string;
  sourceVersion: string;
  acceptedRevision: number;
  acceptedAtDay: number;
  rosterRevision: number;
}>;
export type AcceptedPlayerIntakeAuthority = Readonly<{
  readAcceptedPlayerIntake(sourceId: string):
    AcceptedPlayerIntakeSource | null;
}>;
export type DurablePlayerPersonLink = AcceptedPlayerIntakeSource;
export type SqlitePlayerPersonLinkStore = AcceptedPlayerPersonLinkAuthority &
Readonly<{
  accept(sourceId: string): DurablePlayerPersonLink;
  readLink(sourceId: string): DurablePlayerPersonLink | null;
  close(): void;
}>;

type LinkRow = { source_id: string; career_id: string;
  player_id: string; person_id: string; roster_revision: number;
  accepted_at_day: number; source_json: string };
type RosterRow = { revision: number; roster_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const revision = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0)) : item);
export const isAcceptedPlayerIntakeSource = (source: AcceptedPlayerIntakeSource | null,
  sourceId: string): source is AcceptedPlayerIntakeSource =>
  source !== null
    && Object.keys(source).sort().join('|') === [
      'acceptedAtDay', 'acceptedRevision', 'careerId', 'personId',
      'playerId', 'rosterRevision', 'sourceId', 'sourceRecordId',
      'sourceVersion',
    ].join('|')
    && source.sourceId === sourceId
    && id(source.careerId) && id(source.playerId)
    && id(source.personId) && id(source.sourceRecordId)
    && id(source.sourceVersion) && revision(source.acceptedRevision)
    && revision(source.acceptedAtDay)
    && revision(source.rosterRevision);

export const ensurePlayerPersonLinkSchema = (db: DatabaseSync): void => {
  db.exec(`CREATE TABLE IF NOT EXISTS world_player_person_links (
    source_id TEXT PRIMARY KEY, career_id TEXT NOT NULL,
    player_id TEXT NOT NULL, person_id TEXT NOT NULL,
    roster_revision INTEGER NOT NULL CHECK(roster_revision >= 0),
    accepted_at_day INTEGER NOT NULL CHECK(accepted_at_day >= 0),
    source_json TEXT NOT NULL,
    UNIQUE(career_id, player_id), UNIQUE(career_id, person_id)
  );`);
};

/** First acceptance requires an intake authority; durable reads need only the stored snapshot. */
export const openSqlitePlayerPersonLinkStore = (databasePath: string,
  authority?: AcceptedPlayerIntakeAuthority | null):
SqlitePlayerPersonLinkStore => {
  if (!id(databasePath)) {
    throw new Error('invalid player-person link database path');
  }
  if (authority != null
    && typeof authority.readAcceptedPlayerIntake !== 'function') {
    throw new Error('invalid accepted player intake authority');
  }
  const Database = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const db = new Database(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  ensurePlayerPersonLinkSchema(db);
  const getLink = db.prepare(`SELECT source_id, career_id, player_id,
    person_id, roster_revision, accepted_at_day, source_json
    FROM world_player_person_links WHERE source_id=?`);
  const getRoster = db.prepare(`SELECT revision, roster_json
    FROM world_roster_heads WHERE career_id=?`);
  const linkRow = (sourceId: string): LinkRow | null =>
    (getLink.get(sourceId) as LinkRow | undefined) ?? null;
  const rosterHead = (careerId: string): RosterState | null => {
    const row = getRoster.get(careerId) as RosterRow | undefined;
    if (!row) return null;
    const roster = createRosterState(JSON.parse(row.roster_json));
    if (roster.careerId !== careerId || roster.revision !== row.revision
      || canonicalJson(roster) !== row.roster_json) {
      throw new Error('corrupt global roster head');
    }
    return roster;
  };
  const accepted = (sourceId: string): AcceptedPlayerIntakeSource => {
    if (!authority) {
      throw new Error('accepted player intake authority is required for first acceptance');
    }
    const raw = authority.readAcceptedPlayerIntake(sourceId);
    const source = raw === null ? null : cloneInert(raw);
    if (!isAcceptedPlayerIntakeSource(source, sourceId)) {
      throw new Error('accepted intake source is absent or invalid');
    }
    return source;
  };
  const readLink = (sourceId: string): DurablePlayerPersonLink | null => {
    if (!id(sourceId)) throw new Error('invalid player-person sourceId');
    const row = linkRow(sourceId);
    if (!row) return null;
    const stored = JSON.parse(row.source_json) as AcceptedPlayerIntakeSource;
    if (!isAcceptedPlayerIntakeSource(stored, sourceId)
      || canonicalJson(stored) !== row.source_json
      || row.source_id !== stored.sourceId
      || row.career_id !== stored.careerId
      || row.player_id !== stored.playerId
      || row.person_id !== stored.personId
      || row.roster_revision !== stored.rosterRevision
      || row.accepted_at_day !== stored.acceptedAtDay) {
      throw new Error('stored accepted intake snapshot is corrupt');
    }
    const roster = rosterHead(stored.careerId);
    if (!roster || roster.revision < stored.rosterRevision
      || roster.effectiveDay < stored.acceptedAtDay
      || !roster.players.some((player) =>
        player.playerId === stored.playerId)) {
      throw new Error('global roster head no longer supports player link');
    }
    return Object.freeze(stored);
  };
  let closed = false;
  return Object.freeze({
    accept(sourceId: string): DurablePlayerPersonLink {
      if (!id(sourceId)) throw new Error('invalid player-person sourceId');
      db.exec('BEGIN IMMEDIATE');
      try {
        const prior = linkRow(sourceId);
        if (prior) {
          const existing = readLink(sourceId)!;
          db.exec('COMMIT');
          return existing;
        }
        const source = accepted(sourceId);
        const roster = rosterHead(source.careerId);
        if (!roster || roster.revision !== source.rosterRevision
          || roster.effectiveDay < source.acceptedAtDay
          || !roster.players.some((player) =>
            player.playerId === source.playerId)) {
          throw new Error('accepted intake does not match global roster head');
        }
        const duplicate = db.prepare(`SELECT source_id
          FROM world_player_person_links WHERE career_id=?
          AND (player_id=? OR person_id=?)`).get(
            source.careerId, source.playerId, source.personId);
        if (duplicate) {
          throw new Error('player or person link is not unique in Career');
        }
        db.prepare(`INSERT INTO world_player_person_links
          (source_id, career_id, player_id, person_id,
           roster_revision, accepted_at_day, source_json)
          VALUES (?, ?, ?, ?, ?, ?, ?)`).run(source.sourceId,
            source.careerId, source.playerId, source.personId,
            source.rosterRevision, source.acceptedAtDay,
            canonicalJson(source));
        const result = readLink(sourceId)!;
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readLink,
    readAcceptedPlayerPersonLink(sourceId: string) {
      const link = readLink(sourceId);
      return link ? Object.freeze({ careerId: link.careerId,
        playerId: link.playerId, personId: link.personId }) : null;
    },
    close(): void { if (!closed) { db.close(); closed = true; } },
  });
};
