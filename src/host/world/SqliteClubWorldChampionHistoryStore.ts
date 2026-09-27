import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createClubWorldChampionHistory,
  latestClubWorldChampion, recordClubWorldChampion,
  type ClubWorldChampionHistory } from
  '../../core/world/competition/ClubWorldChampionHistory';
import type { ClubWorldBerthAuthority } from
  '../../core/world/competition/ClubWorldBerths';
import type { SqliteClubWorldFinalFourStore } from
  './SqliteClubWorldFinalFourStore';

export type SqliteClubWorldChampionHistoryStore = Readonly<{
  initialize(careerId: string,
    competitionId: string): ClubWorldChampionHistory;
  record(careerId: string,
    editionId: string): ClubWorldChampionHistory;
  readHistory(careerId: string): ClubWorldChampionHistory | null;
  authority(careerId: string): Readonly<{
    defendingWorldChampion:
      ClubWorldBerthAuthority['defendingWorldChampion'];
  }>;
  close(): void;
}>;
type HeadRow = { competition_id: string };
type EventRow = { ordinal: number; edition_id: string;
  history_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);

/** Defending title authority replays the Final Four and Match result. */
export const openSqliteClubWorldChampionHistoryStore = (
  databasePath: string,
  sources: Readonly<{
    finals: Pick<SqliteClubWorldFinalFourStore, 'readEvidence'>;
  }>,
): SqliteClubWorldChampionHistoryStore => {
  if (!id(databasePath)) {
    throw new Error('invalid Club World title history database path');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_club_world_title_heads (
    career_id TEXT PRIMARY KEY, competition_id TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS world_club_world_title_events (
    career_id TEXT NOT NULL, ordinal INTEGER NOT NULL,
    edition_id TEXT NOT NULL, history_json TEXT NOT NULL,
    PRIMARY KEY (career_id, ordinal),
    UNIQUE (career_id, edition_id)
  );`);
  const getHead = db.prepare(`SELECT competition_id
    FROM world_club_world_title_heads WHERE career_id=?`);
  const getEvents = db.prepare(`SELECT ordinal, edition_id, history_json
    FROM world_club_world_title_events WHERE career_id=? ORDER BY ordinal`);
  const head = (careerId: string): HeadRow | null =>
    (getHead.get(careerId) as HeadRow | undefined) ?? null;
  const events = (careerId: string): EventRow[] =>
    getEvents.all(careerId) as EventRow[];
  const project = (careerId: string, history: ClubWorldChampionHistory,
    editionId: string): ClubWorldChampionHistory => {
    const evidence = sources.finals.readEvidence(careerId, editionId);
    if (!evidence) {
      throw new Error('Club World title lacks official final');
    }
    return recordClubWorldChampion(history, evidence);
  };
  const replay = (careerId: string): ClubWorldChampionHistory | null => {
    const stored = head(careerId);
    if (!stored) return null;
    try {
      let history = createClubWorldChampionHistory(
        stored.competition_id);
      events(careerId).forEach((row, index) => {
        if (row.ordinal !== index || !id(row.edition_id)) {
          throw new Error('Club World title event order differs');
        }
        history = project(careerId, history, row.edition_id);
        if (canonicalJson(history) !== row.history_json) {
          throw new Error('Club World title history replay differs');
        }
      });
      return history;
    } catch (cause) {
      throw new Error(`corrupt Club World title history for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  const assertCareer = (careerId: string): void => {
    if (closed || !id(careerId)) {
      throw new Error('invalid Club World title career');
    }
  };
  return Object.freeze({
    initialize(careerId: string,
      competitionId: string): ClubWorldChampionHistory {
      assertCareer(careerId);
      const fresh = createClubWorldChampionHistory(competitionId);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = head(careerId);
        if (stored) {
          const history = replay(careerId)!;
          if (stored.competition_id !== competitionId) {
            throw new Error('Club World competition identity is frozen differently');
          }
          db.exec('COMMIT');
          return history;
        }
        db.prepare(`INSERT INTO world_club_world_title_heads
          (career_id, competition_id) VALUES (?, ?)`)
          .run(careerId, competitionId);
        db.exec('COMMIT');
        return fresh;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    record(careerId: string,
      editionId: string): ClubWorldChampionHistory {
      assertCareer(careerId);
      if (!id(editionId)) throw new Error('invalid Club World title edition');
      db.exec('BEGIN IMMEDIATE');
      try {
        const history = replay(careerId);
        if (!history) throw new Error('Club World title head is missing');
        if (history.champions.some((item) =>
          item.editionId === editionId)) {
          db.exec('COMMIT');
          return history;
        }
        const next = project(careerId, history, editionId);
        db.prepare(`INSERT INTO world_club_world_title_events
          (career_id, ordinal, edition_id, history_json)
          VALUES (?, ?, ?, ?)`).run(careerId,
            history.champions.length, editionId, canonicalJson(next));
        db.exec('COMMIT');
        return next;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readHistory(careerId: string): ClubWorldChampionHistory | null {
      assertCareer(careerId);
      return replay(careerId);
    },
    authority(careerId: string) {
      assertCareer(careerId);
      return Object.freeze({ defendingWorldChampion: (beforeDay: number) => {
        const history = replay(careerId);
        return history ? latestClubWorldChampion(history, beforeDay) : null;
      } });
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
