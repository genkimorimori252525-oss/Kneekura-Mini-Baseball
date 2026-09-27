import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { ClubWorldRegion } from
  '../../core/world/competition/ClubWorldBerths';
import { createNationalQualificationHistory,
  latestRegionalNationalPlacement,
  recordRegionalNationalChampionship,
  type NationalQualificationHistory } from
  '../../core/world/competition/NationalQualificationHistory';
import type { WbcRegionalPlacement } from
  '../../core/world/competition/WbcBerths';
import type { SqliteRegionalNationalKnockoutStore } from
  './SqliteRegionalNationalKnockoutStore';

const REGIONS: readonly ClubWorldRegion[] = [
  'ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
export type SqliteNationalQualificationHistoryStore = Readonly<{
  initialize(careerId: string,
    competitionIds: Readonly<Record<ClubWorldRegion, string>>):
    NationalQualificationHistory;
  recordRegional(careerId: string, region: ClubWorldRegion,
    editionId: string): NationalQualificationHistory;
  readHistory(careerId: string): NationalQualificationHistory | null;
  regionalAuthority(careerId: string): Readonly<{
    regionalChampionship(region: ClubWorldRegion,
      beforeDay: number): WbcRegionalPlacement | null;
  }>;
  close(): void;
}>;
type HeadRow = { competition_ids_json: string };
type EventRow = { ordinal: number; request_json: string;
  history_json: string };
type RegionalRequest = Readonly<{ kind: 'REGIONAL';
  region: ClubWorldRegion; editionId: string }>;
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);

/** Official regional placements become cutoff-aware WBC berth sources. */
export const openSqliteNationalQualificationHistoryStore = (
  databasePath: string,
  sources: Readonly<{
    knockouts: Pick<SqliteRegionalNationalKnockoutStore,
      'readEvidence'>;
  }>,
): SqliteNationalQualificationHistoryStore => {
  if (!id(databasePath)) {
    throw new Error('invalid national qualification database path');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_national_qualification_heads (
    career_id TEXT PRIMARY KEY, competition_ids_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS world_national_qualification_events (
    career_id TEXT NOT NULL, ordinal INTEGER NOT NULL,
    edition_id TEXT NOT NULL,
    request_json TEXT NOT NULL, history_json TEXT NOT NULL,
    PRIMARY KEY (career_id, ordinal),
    UNIQUE (career_id, edition_id)
  );`);
  const getHead = db.prepare(`SELECT competition_ids_json
    FROM world_national_qualification_heads WHERE career_id=?`);
  const getEvents = db.prepare(`SELECT ordinal, request_json, history_json
    FROM world_national_qualification_events WHERE career_id=?
    ORDER BY ordinal`);
  const head = (careerId: string): HeadRow | null =>
    (getHead.get(careerId) as HeadRow | undefined) ?? null;
  const events = (careerId: string): EventRow[] =>
    getEvents.all(careerId) as EventRow[];
  const project = (careerId: string, history: NationalQualificationHistory,
    request: RegionalRequest): NationalQualificationHistory => {
    const evidence = sources.knockouts.readEvidence(careerId,
      request.editionId);
    if (!evidence || evidence.source.groupEdition.region
      !== request.region) {
      throw new Error('national qualification lacks official regional result');
    }
    return recordRegionalNationalChampionship(history,
      evidence.source, evidence.quarterfinalResults,
      evidence.semifinalResults, evidence.finalResult);
  };
  const replay = (careerId: string): NationalQualificationHistory | null => {
    const stored = head(careerId);
    if (!stored) return null;
    try {
      const competitionIds = JSON.parse(stored.competition_ids_json) as
        Readonly<Record<ClubWorldRegion, string>>;
      if (canonicalJson(competitionIds)
        !== stored.competition_ids_json) {
        throw new Error('national qualification head serialization differs');
      }
      let history = createNationalQualificationHistory(
        competitionIds);
      events(careerId).forEach((row, index) => {
        const request = JSON.parse(row.request_json) as
          RegionalRequest;
        if (row.ordinal !== index || request.kind !== 'REGIONAL'
          || !REGIONS.includes(request.region)
          || !id(request.editionId)
          || canonicalJson(request) !== row.request_json) {
          throw new Error('national qualification event order differs');
        }
        history = project(careerId, history, request);
        if (canonicalJson(history) !== row.history_json) {
          throw new Error('national qualification replay differs');
        }
      });
      return history;
    } catch (cause) {
      throw new Error(`corrupt national qualification history for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  const assertCareer = (careerId: string): void => {
    if (closed || !id(careerId)) {
      throw new Error('invalid national qualification career');
    }
  };
  return Object.freeze({
    initialize(careerId: string,
      rawIds: Readonly<Record<ClubWorldRegion, string>>):
      NationalQualificationHistory {
      assertCareer(careerId);
      const ids = cloneInert(rawIds);
      const fresh = createNationalQualificationHistory(ids);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = head(careerId);
        if (stored) {
          const history = replay(careerId)!;
          if (stored.competition_ids_json !== canonicalJson(ids)) {
            throw new Error('national competition identities are already frozen differently');
          }
          db.exec('COMMIT');
          return history;
        }
        db.prepare(`INSERT INTO world_national_qualification_heads
          (career_id, competition_ids_json) VALUES (?, ?)`)
          .run(careerId, canonicalJson(ids));
        db.exec('COMMIT');
        return fresh;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    recordRegional(careerId: string, region: ClubWorldRegion,
      editionId: string): NationalQualificationHistory {
      assertCareer(careerId);
      if (!REGIONS.includes(region) || !id(editionId)) {
        throw new Error('invalid regional qualification request');
      }
      db.exec('BEGIN IMMEDIATE');
      try {
        const history = replay(careerId);
        if (!history) throw new Error('national qualification head is missing');
        const prior = history.regional.find((item) =>
          item.placement.editionId === editionId);
        if (prior) {
          if (prior.placement.region !== region) {
            throw new Error('regional edition is already recorded differently');
          }
          db.exec('COMMIT');
          return history;
        }
        const request: RegionalRequest = { kind: 'REGIONAL',
          region, editionId };
        const next = project(careerId, history, request);
        db.prepare(`INSERT INTO world_national_qualification_events
          (career_id, ordinal, edition_id, request_json, history_json)
          VALUES (?, ?, ?, ?, ?)`).run(careerId,
            history.regional.length + history.qualifiers.length,
            editionId, canonicalJson(request), canonicalJson(next));
        db.exec('COMMIT');
        return next;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readHistory(careerId: string): NationalQualificationHistory | null {
      assertCareer(careerId);
      return replay(careerId);
    },
    regionalAuthority(careerId: string) {
      assertCareer(careerId);
      return Object.freeze({ regionalChampionship: (
        region: ClubWorldRegion, beforeDay: number) => {
        const history = replay(careerId);
        return history
          ? latestRegionalNationalPlacement(history, region,
            beforeDay) : null;
      } });
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
