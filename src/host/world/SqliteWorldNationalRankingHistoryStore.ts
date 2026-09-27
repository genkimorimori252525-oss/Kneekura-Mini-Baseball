import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createWorldNationalRankingHistory,
  recordRegionalNationalRankingResults,
  recordWbcNationalRankingResults,
  type WorldNationalRankingHistory } from
  '../../core/world/competition/WorldNationalRankingHistory';
import type { SqliteNationCompetitionRegionStore } from
  './SqliteNationCompetitionRegionStore';
import type { SqliteRegionalNationalKnockoutStore } from
  './SqliteRegionalNationalKnockoutStore';
import type { SqliteWbcFinalsKnockoutStore } from
  './SqliteWbcFinalsKnockoutStore';

type Kind = 'REGIONAL' | 'WBC';
type EventRow = { ordinal: number; kind: Kind;
  edition_id: string; history_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);

export type SqliteWorldNationalRankingHistoryStore = Readonly<{
  recordRegional(careerId: string,
    editionId: string): WorldNationalRankingHistory;
  recordWbc(careerId: string,
    editionId: string): WorldNationalRankingHistory;
  readHistory(careerId: string): WorldNationalRankingHistory;
  close(): void;
}>;

/** Official regional and WBC Match results feed one ranking history. */
export const openSqliteWorldNationalRankingHistoryStore = (
  databasePath: string,
  sources: Readonly<{
    regional: Pick<SqliteRegionalNationalKnockoutStore,
      'readEvidence'>;
    wbc: Pick<SqliteWbcFinalsKnockoutStore, 'readEvidence'>;
    nations: Pick<SqliteNationCompetitionRegionStore, 'readRegion'>;
  }>,
): SqliteWorldNationalRankingHistoryStore => {
  if (!id(databasePath)) {
    throw new Error('invalid world national ranking database path');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_national_ranking_events (
    career_id TEXT NOT NULL, ordinal INTEGER NOT NULL,
    kind TEXT NOT NULL, edition_id TEXT NOT NULL,
    history_json TEXT NOT NULL,
    PRIMARY KEY (career_id, ordinal),
    UNIQUE (career_id, edition_id)
  );`);
  const get = db.prepare(`SELECT ordinal, kind, edition_id, history_json
    FROM world_national_ranking_events
    WHERE career_id=? ORDER BY ordinal`);
  const events = (careerId: string): EventRow[] =>
    get.all(careerId) as EventRow[];
  const project = (careerId: string,
    history: WorldNationalRankingHistory, kind: Kind,
    editionId: string): WorldNationalRankingHistory => {
    if (kind === 'REGIONAL') {
      const evidence = sources.regional.readEvidence(careerId,
        editionId);
      if (!evidence) {
        throw new Error('ranking requires official regional final');
      }
      return recordRegionalNationalRankingResults(history,
        evidence.source, evidence.quarterfinalResults,
        evidence.semifinalResults, evidence.finalResult);
    }
    const evidence = sources.wbc.readEvidence(careerId, editionId);
    if (!evidence) throw new Error('ranking requires official WBC final');
    const completedAtDay = evidence.source.groupEdition
      .calendarWindow.endsOnDay;
    return recordWbcNationalRankingResults(history,
      evidence.source, evidence.roundOf16Results,
      evidence.quarterfinalResults,
      evidence.semifinalResults, evidence.finalResult,
      (nationId) => sources.nations.readRegion(careerId,
        nationId, completedAtDay));
  };
  const replay = (careerId: string): WorldNationalRankingHistory => {
    try {
      let history = createWorldNationalRankingHistory();
      events(careerId).forEach((row, index) => {
        if (row.ordinal !== index
          || !['REGIONAL', 'WBC'].includes(row.kind)
          || !id(row.edition_id)) {
          throw new Error('national ranking event order differs');
        }
        history = project(careerId, history, row.kind,
          row.edition_id);
        if (canonicalJson(history) !== row.history_json) {
          throw new Error('national ranking history replay differs');
        }
      });
      return history;
    } catch (cause) {
      throw new Error(`corrupt national ranking history for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  const assertCareer = (careerId: string): void => {
    if (closed || !id(careerId)) {
      throw new Error('invalid national ranking career');
    }
  };
  const record = (careerId: string, kind: Kind,
    editionId: string): WorldNationalRankingHistory => {
    assertCareer(careerId);
    if (!id(editionId)) {
      throw new Error('invalid national ranking edition');
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      const history = replay(careerId);
      const prior = events(careerId).find((item) =>
        item.edition_id === editionId);
      if (prior) {
        if (prior.kind !== kind) {
          throw new Error('national ranking edition tier is frozen differently');
        }
        db.exec('COMMIT');
        return history;
      }
      const next = project(careerId, history, kind, editionId);
      db.prepare(`INSERT INTO world_national_ranking_events
        (career_id, ordinal, kind, edition_id, history_json)
        VALUES (?, ?, ?, ?, ?)`).run(careerId,
          history.editions.length, kind, editionId, canonicalJson(next));
      db.exec('COMMIT');
      return next;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
  return Object.freeze({
    recordRegional(careerId: string,
      editionId: string): WorldNationalRankingHistory {
      return record(careerId, 'REGIONAL', editionId);
    },
    recordWbc(careerId: string,
      editionId: string): WorldNationalRankingHistory {
      return record(careerId, 'WBC', editionId);
    },
    readHistory(careerId: string): WorldNationalRankingHistory {
      assertCareer(careerId);
      return replay(careerId);
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
