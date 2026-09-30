import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { deriveOfficialWbcWorldEdition,
  type OfficialWbcWorldEdition } from
  '../../core/world/competition/WbcRegionalCoefficients';
import type { SqliteNationCompetitionRegionStore } from
  './SqliteNationCompetitionRegionStore';
import type { SqliteWbcFinalsKnockoutStore } from
  './SqliteWbcFinalsKnockoutStore';

export type SqliteOfficialWbcHistoryStore = Readonly<{
  record(careerId: string, editionId: string): OfficialWbcWorldEdition;
  readEdition(careerId: string,
    editionId: string): OfficialWbcWorldEdition | null;
  readHistory(careerId: string):
    readonly OfficialWbcWorldEdition[];
  close(): void;
}>;
type Row = { ordinal: number; edition_id: string;
  snapshot_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);

/** Every historical WBC score is reproduced from 51 Match applications. */
export const openSqliteOfficialWbcHistoryStore = (
  databasePath: string,
  sources: Readonly<{
    finals: Pick<SqliteWbcFinalsKnockoutStore, 'readEvidence'>;
    regions: Pick<SqliteNationCompetitionRegionStore, 'readRegion'>;
  }>,
): SqliteOfficialWbcHistoryStore => {
  if (!id(databasePath)) {
    throw new Error('invalid official WBC history database path');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_official_wbc_editions (
    career_id TEXT NOT NULL, ordinal INTEGER NOT NULL,
    edition_id TEXT NOT NULL, snapshot_json TEXT NOT NULL,
    PRIMARY KEY (career_id, ordinal),
    UNIQUE (career_id, edition_id)
  );`);
  const get = db.prepare(`SELECT ordinal, edition_id, snapshot_json
    FROM world_official_wbc_editions WHERE career_id=? ORDER BY ordinal`);
  const rows = (careerId: string): Row[] =>
    get.all(careerId) as Row[];
  const project = (careerId: string,
    editionId: string): OfficialWbcWorldEdition => {
    const evidence = sources.finals.readEvidence(careerId, editionId);
    if (!evidence) throw new Error('WBC history requires official final');
    const completedAtDay = evidence.source.groupEdition
      .calendarWindow.endsOnDay;
    return deriveOfficialWbcWorldEdition(evidence.source,
      evidence.roundOf16Results, evidence.quarterfinalResults,
      evidence.semifinalResults, evidence.finalResult,
      (nationId) => sources.regions.readRegion(careerId,
        nationId, completedAtDay));
  };
  const replay = (careerId: string,
    onlyEditionId?: string): OfficialWbcWorldEdition[] => {
    try {
      return rows(careerId).flatMap((row, index) => {
        if (row.ordinal !== index || !id(row.edition_id)) {
          throw new Error('WBC edition history order differs');
        }
        // A later edition can qualify using this historical source.
        // Never traverse its dependent results while reading one ancestor.
        if (onlyEditionId !== undefined && row.edition_id !== onlyEditionId) {
          return [];
        }
        const saved = JSON.parse(row.snapshot_json) as
          OfficialWbcWorldEdition;
        const official = project(careerId, row.edition_id);
        if (canonicalJson(saved) !== row.snapshot_json
          || canonicalJson(official) !== row.snapshot_json) {
          throw new Error('official WBC edition replay differs');
        }
        return [official];
      });
    } catch (cause) {
      throw new Error(`corrupt official WBC history for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  const assertCareer = (careerId: string): void => {
    if (closed || !id(careerId)) {
      throw new Error('invalid official WBC career');
    }
  };
  return Object.freeze({
    record(careerId: string,
      editionId: string): OfficialWbcWorldEdition {
      assertCareer(careerId);
      if (!id(editionId)) throw new Error('invalid official WBC edition');
      db.exec('BEGIN IMMEDIATE');
      try {
        const history = replay(careerId);
        const prior = history.find((item) =>
          item.editionId === editionId);
        if (prior) {
          db.exec('COMMIT');
          return prior;
        }
        const edition = project(careerId, editionId);
        if (history.some((item) =>
          item.snapshotId === edition.snapshotId
          || item.games.some((game) => edition.games.some((next) =>
            next.applicationId === game.applicationId)))) {
          throw new Error('official WBC edition evidence is duplicated');
        }
        db.prepare(`INSERT INTO world_official_wbc_editions
          (career_id, ordinal, edition_id, snapshot_json)
          VALUES (?, ?, ?, ?)`).run(careerId,
            history.length, editionId, canonicalJson(edition));
        db.exec('COMMIT');
        return edition;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readEdition(careerId: string,
      editionId: string): OfficialWbcWorldEdition | null {
      assertCareer(careerId);
      if (!id(editionId)) throw new Error('invalid official WBC edition');
      return replay(careerId, editionId).find((item) =>
        item.editionId === editionId) ?? null;
    },
    readHistory(careerId: string):
      readonly OfficialWbcWorldEdition[] {
      assertCareer(careerId);
      return Object.freeze(replay(careerId));
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
