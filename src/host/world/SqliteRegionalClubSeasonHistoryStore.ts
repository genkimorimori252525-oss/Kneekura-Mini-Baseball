import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { ClubWorldBerthAuthority, ClubWorldRegion } from
  '../../core/world/competition/ClubWorldBerths';
import type { ClubWorldQualificationSourceAuthority } from
  '../../core/world/competition/ClubWorldQualificationSources';
import { completedRegionalClubSeason, createRegionalClubSeasonHistory,
  latestRegionalClubChampion, recordRegionalClubSeason,
  type RegionalClubCompetitionIdentity,
  type RegionalClubSeasonHistory } from
  '../../core/world/competition/RegionalClubSeasonHistory';
import type { OfficialRegionalClubSeasonSource } from
  '../../core/world/competition/OfficialRegionalClubAchievement';
import type { SqliteAfricaFinalFourStore } from
  './SqliteAfricaFinalFourStore';
import type { SqliteContinentalFinalFourStore } from
  './SqliteContinentalFinalFourStore';

const REGIONS: readonly ClubWorldRegion[] = [
  'ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
type Request = Readonly<{ region: ClubWorldRegion; seasonId: string;
  editionId: string }>;
type HeadRow = { identities_json: string };
type EventRow = { ordinal: number; request_json: string;
  history_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);

export type SqliteRegionalClubSeasonHistoryStore = Readonly<{
  initialize(careerId: string,
    identities: readonly RegionalClubCompetitionIdentity[]):
    RegionalClubSeasonHistory;
  record(careerId: string, region: ClubWorldRegion,
    seasonId: string, editionId: string): RegionalClubSeasonHistory;
  readHistory(careerId: string): RegionalClubSeasonHistory | null;
  authority(careerId: string): Readonly<{
    completedRegionalSeason:
      ClubWorldQualificationSourceAuthority['completedRegionalSeason'];
    latestRegionalChampion:
      ClubWorldBerthAuthority['latestRegionalChampion'];
  }>;
  close(): void;
}>;

/** Replays every title from its finalized Edition and durable Match evidence. */
export const openSqliteRegionalClubSeasonHistoryStore = (
  databasePath: string,
  sources: Readonly<{
    continental: Pick<SqliteContinentalFinalFourStore, 'readEvidence'>;
    africa: Pick<SqliteAfricaFinalFourStore, 'readEvidence'>;
  }>,
): SqliteRegionalClubSeasonHistoryStore => {
  if (!id(databasePath)) {
    throw new Error('invalid regional club history database path');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_regional_club_history_heads (
    career_id TEXT PRIMARY KEY, identities_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS world_regional_club_history_events (
    career_id TEXT NOT NULL, ordinal INTEGER NOT NULL,
    edition_id TEXT NOT NULL, request_json TEXT NOT NULL,
    history_json TEXT NOT NULL,
    PRIMARY KEY (career_id, ordinal),
    UNIQUE (career_id, edition_id)
  );`);
  const getHead = db.prepare(`SELECT identities_json
    FROM world_regional_club_history_heads WHERE career_id=?`);
  const getEvents = db.prepare(`SELECT ordinal, request_json, history_json
    FROM world_regional_club_history_events WHERE career_id=? ORDER BY ordinal`);
  const head = (careerId: string): HeadRow | null =>
    (getHead.get(careerId) as HeadRow | undefined) ?? null;
  const events = (careerId: string): EventRow[] =>
    getEvents.all(careerId) as EventRow[];
  const project = (careerId: string, history: RegionalClubSeasonHistory,
    request: Request): RegionalClubSeasonHistory => {
    let input: OfficialRegionalClubSeasonSource;
    if (request.region === 'AFRICA') {
      const evidence = sources.africa.readEvidence(careerId,
        request.editionId);
      if (!evidence) throw new Error('Africa club title is not finalized');
      input = { kind: 'AFRICA', region: 'AFRICA',
        seasonId: request.seasonId, ...evidence };
    } else {
      const evidence = sources.continental.readEvidence(careerId,
        request.editionId);
      if (!evidence) throw new Error('continental club title is not finalized');
      input = { kind: 'STANDARD', region: request.region,
        seasonId: request.seasonId, ...evidence };
    }
    return recordRegionalClubSeason(history, input);
  };
  const replay = (careerId: string): RegionalClubSeasonHistory | null => {
    const stored = head(careerId);
    if (!stored) return null;
    try {
      const identities = JSON.parse(stored.identities_json) as
        RegionalClubCompetitionIdentity[];
      if (canonicalJson(identities) !== stored.identities_json) {
        throw new Error('regional club identities serialization differs');
      }
      let history = createRegionalClubSeasonHistory(identities);
      events(careerId).forEach((row, index) => {
        const request = JSON.parse(row.request_json) as Request;
        if (row.ordinal !== index || !REGIONS.includes(request.region)
          || !id(request.seasonId) || !id(request.editionId)
          || canonicalJson(request) !== row.request_json) {
          throw new Error('regional club event order differs');
        }
        history = project(careerId, history, request);
        if (canonicalJson(history) !== row.history_json) {
          throw new Error('regional club history replay differs');
        }
      });
      return history;
    } catch (cause) {
      throw new Error(`corrupt regional club history for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  const assertCareer = (careerId: string): void => {
    if (closed || !id(careerId)) {
      throw new Error('invalid regional club history career');
    }
  };
  return Object.freeze({
    initialize(careerId: string,
      rawIdentities: readonly RegionalClubCompetitionIdentity[]):
      RegionalClubSeasonHistory {
      assertCareer(careerId);
      const identities = cloneInert(rawIdentities);
      const fresh = createRegionalClubSeasonHistory(identities);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = head(careerId);
        if (stored) {
          const history = replay(careerId)!;
          if (stored.identities_json !== canonicalJson(identities)) {
            throw new Error('regional club identities are already frozen differently');
          }
          db.exec('COMMIT');
          return history;
        }
        db.prepare(`INSERT INTO world_regional_club_history_heads
          (career_id, identities_json) VALUES (?, ?)`)
          .run(careerId, canonicalJson(identities));
        db.exec('COMMIT');
        return fresh;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    record(careerId: string, region: ClubWorldRegion,
      seasonId: string, editionId: string): RegionalClubSeasonHistory {
      assertCareer(careerId);
      if (!REGIONS.includes(region) || !id(seasonId) || !id(editionId)) {
        throw new Error('invalid regional club season request');
      }
      db.exec('BEGIN IMMEDIATE');
      try {
        const history = replay(careerId);
        if (!history) throw new Error('regional club history head is missing');
        const prior = history.seasons.find((item) =>
          item.editionId === editionId);
        if (prior) {
          if (prior.region !== region || prior.seasonId !== seasonId) {
            throw new Error('regional club edition is already bound differently');
          }
          db.exec('COMMIT');
          return history;
        }
        const request: Request = { region, seasonId, editionId };
        const next = project(careerId, history, request);
        db.prepare(`INSERT INTO world_regional_club_history_events
          (career_id, ordinal, edition_id, request_json, history_json)
          VALUES (?, ?, ?, ?, ?)`).run(careerId, history.seasons.length,
            editionId, canonicalJson(request), canonicalJson(next));
        db.exec('COMMIT');
        return next;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readHistory(careerId: string): RegionalClubSeasonHistory | null {
      assertCareer(careerId);
      return replay(careerId);
    },
    authority(careerId: string) {
      assertCareer(careerId);
      return Object.freeze({
        completedRegionalSeason: (region: ClubWorldRegion,
          seasonId: string, beforeDay: number) => {
          const history = replay(careerId);
          return history ? completedRegionalClubSeason(history,
            region, seasonId, beforeDay) : null;
        },
        latestRegionalChampion: (region: ClubWorldRegion,
          beforeDay: number) => {
          const history = replay(careerId);
          return history ? latestRegionalClubChampion(history,
            region, beforeDay) : null;
        },
      });
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
