import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { ClubWorldRegion } from
  '../../core/world/competition/ClubWorldBerths';

const REGIONS: readonly ClubWorldRegion[] = [
  'ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
export type NationCompetitionRegionEvent = Readonly<{
  careerId: string;
  nationId: string;
  region: ClubWorldRegion;
  effectiveFromDay: number;
  sourceEventId: string;
}>;
export type DurableNationCompetitionRegion = Readonly<
  NationCompetitionRegionEvent & { revision: number }>;
export type SqliteNationCompetitionRegionStore = Readonly<{
  record(input: NationCompetitionRegionEvent):
    DurableNationCompetitionRegion;
  readHistory(careerId: string, nationId: string):
    readonly DurableNationCompetitionRegion[];
  readRegion(careerId: string, nationId: string,
    beforeDay: number): ClubWorldRegion | null;
  authority(careerId: string): Readonly<{
    nationCompetitionRegion(nationId: string,
      beforeDay: number): ClubWorldRegion | null;
  }>;
  close(): void;
}>;
type RegionRow = { revision: number; request_json: string;
  chain_hash: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);
const digest = (prior: string, value: string): string =>
  createHash('sha256').update(JSON.stringify([prior, value]))
    .digest('hex');
const validate = (event: NationCompetitionRegionEvent): void => {
  if (!id(event?.careerId) || !id(event.nationId)
    || !id(event.sourceEventId) || !REGIONS.includes(event.region)
    || !day(event.effectiveFromDay)) {
    throw new Error('invalid accepted nation competition region event');
  }
};

/** National qualification reads the region effective at its cutoff day. */
const createSqliteNationCompetitionRegionStore = (
  databasePath: string | DatabaseSync,
): SqliteNationCompetitionRegionStore => {
  if (typeof databasePath === 'string' && !id(databasePath)) throw new Error('invalid nation region database path');
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const borrowed = typeof databasePath !== 'string';
  const db = borrowed ? databasePath : new sqlite.DatabaseSync(databasePath);
  if (!(db instanceof sqlite.DatabaseSync)) throw new Error('National evidence requires a Native connection');
  if (!borrowed) {
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_nation_competition_regions (
    career_id TEXT NOT NULL, nation_id TEXT NOT NULL,
    revision INTEGER NOT NULL, source_event_id TEXT NOT NULL,
    request_json TEXT NOT NULL, chain_hash TEXT NOT NULL,
    PRIMARY KEY (career_id, nation_id, revision),
    UNIQUE (career_id, source_event_id)
  );`);
  }
  const rows = db.prepare(`SELECT revision, request_json, chain_hash
    FROM world_nation_competition_regions
    WHERE career_id=? AND nation_id=? ORDER BY revision`);
  const getEvent = db.prepare(`SELECT nation_id, request_json
    FROM world_nation_competition_regions
    WHERE career_id=? AND source_event_id=?`);
  const replay = (careerId: string, nationId: string):
    readonly DurableNationCompetitionRegion[] => {
    let priorHash = 'GENESIS';
    let priorDay = -1;
    let priorRegion: ClubWorldRegion | null = null;
    return Object.freeze((rows.all(careerId, nationId) as RegionRow[])
      .map((row, index) => {
        try {
          const event = JSON.parse(row.request_json) as
            NationCompetitionRegionEvent;
          validate(event);
          if (event.careerId !== careerId
            || event.nationId !== nationId
            || row.revision !== index + 1
            || event.effectiveFromDay <= priorDay
            || event.region === priorRegion
            || canonicalJson(event) !== row.request_json
            || digest(priorHash, row.request_json)
              !== row.chain_hash) {
            throw new Error('nation region event history differs');
          }
          priorHash = row.chain_hash;
          priorDay = event.effectiveFromDay;
          priorRegion = event.region;
          return Object.freeze({ ...event, revision: row.revision });
        } catch (cause) {
          throw new Error(`corrupt nation competition region history for ${nationId}`,
            { cause });
        }
      }));
  };
  let closed = false;
  const assertScope = (careerId: string, nationId: string): void => {
    if (closed || !id(careerId) || !id(nationId)) {
      throw new Error('invalid nation region read scope');
    }
  };
  const readRegion = (careerId: string, nationId: string,
    beforeDay: number): ClubWorldRegion | null => {
    assertScope(careerId, nationId);
    if (!day(beforeDay)) throw new Error('invalid nation region cutoff');
    return replay(careerId, nationId).filter((event) =>
      event.effectiveFromDay <= beforeDay).at(-1)?.region ?? null;
  };
  return Object.freeze({
    record(rawInput: NationCompetitionRegionEvent):
      DurableNationCompetitionRegion {
      if (closed) throw new Error('nation region store is closed');
      const input = cloneInert(rawInput);
      validate(input);
      db.exec('BEGIN IMMEDIATE');
      try {
        const existing = getEvent.get(input.careerId,
          input.sourceEventId) as
          { nation_id: string; request_json: string } | undefined;
        if (existing) {
          if (existing.nation_id !== input.nationId
            || existing.request_json !== canonicalJson(input)) {
            throw new Error('nation region source event is already frozen differently');
          }
          const prior = replay(input.careerId, input.nationId)
            .find((event) =>
              event.sourceEventId === input.sourceEventId)!;
          db.exec('COMMIT');
          return prior;
        }
        const history = replay(input.careerId, input.nationId);
        const last = history.at(-1);
        if (last && (input.effectiveFromDay
          <= last.effectiveFromDay || input.region === last.region)) {
          throw new Error('nation region change is stale or unchanged');
        }
        const revision = history.length + 1;
        const requestJson = canonicalJson(input);
        const previousHash = (rows.all(input.careerId,
          input.nationId) as RegionRow[]).at(-1)?.chain_hash
          ?? 'GENESIS';
        db.prepare(`INSERT INTO world_nation_competition_regions
          (career_id, nation_id, revision, source_event_id,
            request_json, chain_hash) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(input.careerId, input.nationId, revision,
            input.sourceEventId, requestJson,
            digest(previousHash, requestJson));
        db.exec('COMMIT');
        return Object.freeze({ ...input, revision });
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readHistory(careerId: string, nationId: string):
      readonly DurableNationCompetitionRegion[] {
      assertScope(careerId, nationId);
      return replay(careerId, nationId);
    },
    readRegion,
    authority(careerId: string) {
      if (closed || !id(careerId)) {
        throw new Error('invalid nation region authority scope');
      }
      return Object.freeze({ nationCompetitionRegion: (
        nationId: string, beforeDay: number) =>
        readRegion(careerId, nationId, beforeDay) });
    },
    close(): void {
      if (!closed && !borrowed) db.close();
      closed = true;
    },
  });
};

/** Existing string-path facade owns its connection and schema. */
export const openSqliteNationCompetitionRegionStore = (databasePath: string): SqliteNationCompetitionRegionStore =>
  createSqliteNationCompetitionRegionStore(databasePath);

/** Read-only projection of the same owner on a consumer connection. No opener, schema writes or close capability. */
export const nationCompetitionRegionEvidenceFromSqlite = (db: DatabaseSync): Pick<SqliteNationCompetitionRegionStore, 'readHistory' | 'readRegion' | 'authority'> => {
  const owner = createSqliteNationCompetitionRegionStore(db);
  return Object.freeze({ readHistory: owner.readHistory, readRegion: owner.readRegion, authority: owner.authority });
};
