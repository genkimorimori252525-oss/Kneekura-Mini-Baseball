import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createWorldNationalRankingHistory,
  recordRegionalNationalRankingResults,
  recordPremierTwelveRankingResults,
  recordWbcNationalRankingResults,
  type WorldNationalRankingHistory } from
  '../../core/world/competition/WorldNationalRankingHistory';
import type { SqliteNationCompetitionRegionStore } from
  './SqliteNationCompetitionRegionStore';
import type { SqliteRegionalNationalKnockoutStore } from
  './SqliteRegionalNationalKnockoutStore';
import type { SqliteWbcFinalsKnockoutStore } from
  './SqliteWbcFinalsKnockoutStore';
import type { SqlitePremierTwelveFinalFourStore } from
  './SqlitePremierTwelveFinalFourStore';
import type { RegionalNationalEdition } from '../../core/world/competition/RegionalNationalGroups';
import { createCompetitionSourceReader, withCompetitionSourceReadScope, withCompetitionSourceReadPhase } from './CompetitionSourceReadScope';

type Kind = 'REGIONAL' | 'WBC' | 'PREMIER_12';
type EventRow = { ordinal: number; kind: Kind;
  edition_id: string; history_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const day = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value)
  && value >= 0;
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
  recordPremier(careerId: string,
    editionId: string): WorldNationalRankingHistory;
  readHistory(careerId: string,
    beforeDay?: number): WorldNationalRankingHistory;
  readRegionalEdition(careerId: string, editionId: string, beforeDay: number): RegionalNationalEdition | null;
  close(): void;
}>;

/** Official regional, WBC and Premier12 Match results feed one ranking history. */
export const openSqliteWorldNationalRankingHistoryStore = (
  databasePath: string,
  sources: Readonly<{
    regional: Pick<SqliteRegionalNationalKnockoutStore,
      'readEvidence'>;
    wbc: Pick<SqliteWbcFinalsKnockoutStore, 'readEvidence'>;
    premier?: Pick<SqlitePremierTwelveFinalFourStore, 'readEvidence'>;
    nations: Pick<SqliteNationCompetitionRegionStore, 'readRegion'>;
  }>,
): SqliteWorldNationalRankingHistoryStore => {
  if (!id(databasePath)) {
    throw new Error('invalid world national ranking database path');
  }
  const readRegional = createCompetitionSourceReader(sources.regional.readEvidence, sources.regional);
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
      const evidence = readRegional(careerId, editionId);
      if (!evidence) {
        throw new Error('ranking requires official regional final');
      }
      return recordRegionalNationalRankingResults(history,
        evidence.source, evidence.quarterfinalResults,
        evidence.semifinalResults, evidence.finalResult);
    }
    if (kind === 'PREMIER_12') {
      const evidence = sources.premier?.readEvidence(careerId, editionId);
      if (!evidence || evidence.source.edition.editionId !== editionId) {
        throw new Error('ranking requires official Premier12 final');
      }
      return recordPremierTwelveRankingResults(history, evidence.source,
        evidence.semifinalResults, evidence.bronzeResult, evidence.finalResult);
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
  const replay = (careerId: string,
    beforeDay = Number.MAX_SAFE_INTEGER): WorldNationalRankingHistory => {
    try {
      let history = createWorldNationalRankingHistory();
      events(careerId).forEach((row, index) => {
        if (row.ordinal !== index
          || !['REGIONAL', 'WBC', 'PREMIER_12'].includes(row.kind)
          || !id(row.edition_id)) {
          throw new Error('national ranking event order differs');
        }
        const saved = JSON.parse(row.history_json) as
          WorldNationalRankingHistory;
        if (!Array.isArray(saved.editions)
          || saved.editions.length !== index + 1
          || saved.editions[index].editionId !== row.edition_id
          || saved.editions[index].tier !== row.kind
          || saved.editions.some((edition) => !day(edition.completedAtDay))
          || canonicalJson(saved) !== row.history_json) {
          throw new Error('national ranking edition metadata differs');
        }
        // The edition being qualified may consume this earlier ranking.
        // Replay only causal ancestors at the cutoff, never later results.
        if (saved.editions[index].completedAtDay <= beforeDay) {
          history = project(careerId, history, row.kind,
            row.edition_id);
        }
        const atCutoff = { editions: saved.editions.filter((edition) =>
          edition.completedAtDay <= beforeDay) };
        if (canonicalJson(history) !== canonicalJson(atCutoff)) {
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
    editionId: string): WorldNationalRankingHistory => withCompetitionSourceReadPhase(() => {
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
  });
  return Object.freeze({
    recordRegional(careerId: string,
      editionId: string): WorldNationalRankingHistory {
      return record(careerId, 'REGIONAL', editionId);
    },
    recordWbc(careerId: string,
      editionId: string): WorldNationalRankingHistory {
      return record(careerId, 'WBC', editionId);
    },
    recordPremier(careerId: string,
      editionId: string): WorldNationalRankingHistory {
      return record(careerId, 'PREMIER_12', editionId);
    },
    readHistory(careerId: string,
      beforeDay = Number.MAX_SAFE_INTEGER): WorldNationalRankingHistory {
      assertCareer(careerId);
      if (!day(beforeDay)) throw new Error('invalid national ranking cutoff');
      return replay(careerId, beforeDay);
    },
    readRegionalEdition(careerId: string, editionId: string, beforeDay: number): RegionalNationalEdition | null {
      return withCompetitionSourceReadScope(() => {
        assertCareer(careerId);
        if (!id(editionId) || !day(beforeDay)) throw new Error('invalid regional ranking Edition scope');
        const accepted = replay(careerId, beforeDay).editions.find((entry) => entry.editionId === editionId && entry.tier === 'REGIONAL');
        if (!accepted) return null;
        const evidence = readRegional(careerId, editionId);
        const edition = evidence?.source.groupEdition;
        if (!edition || edition.editionId !== editionId || edition.calendarWindow.endsOnDay !== accepted.completedAtDay) {
          throw new Error('regional ranking lacks accepted official Edition');
        }
        return edition;
      });
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
