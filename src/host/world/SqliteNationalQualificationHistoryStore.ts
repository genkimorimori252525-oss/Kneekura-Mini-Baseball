import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { ClubWorldRegion } from
  '../../core/world/competition/ClubWorldBerths';
import { createNationalQualificationHistory,
  latestRegionalNationalPlacement,
  latestWbcQualifierPodWinner, recordWbcGlobalQualifier,
  recordRegionalNationalChampionship,
  type NationalQualificationHistory } from
  '../../core/world/competition/NationalQualificationHistory';
import type { WbcQualifierPodWinner,
  WbcRegionalPlacement } from
  '../../core/world/competition/WbcBerths';
import type { SqliteWbcGlobalQualifierPodStore } from
  './SqliteWbcGlobalQualifierPodStore';
import type { SqliteWbcQualifierSelectionStore } from
  './SqliteWbcQualifierSelectionStore';
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
  recordQualifier(careerId: string,
    editionId: string): NationalQualificationHistory;
  readHistory(careerId: string,
    beforeDay?: number): NationalQualificationHistory | null;
  regionalAuthority(careerId: string): Readonly<{
    regionalChampionship(region: ClubWorldRegion,
      beforeDay: number): WbcRegionalPlacement | null;
  }>;
  qualifierAuthority(careerId: string): Readonly<{
    qualifierPodWinner(podIndex: number,
      beforeDay: number): WbcQualifierPodWinner | null;
  }>;
  close(): void;
}>;
type HeadRow = { competition_ids_json: string };
type EventRow = { ordinal: number; edition_id: string; request_json: string;
  history_json: string };
type RegionalRequest = Readonly<{ kind: 'REGIONAL';
  region: ClubWorldRegion; editionId: string }>;
type QualifierRequest = Readonly<{ kind: 'QUALIFIER';
  editionId: string }>;
type Request = RegionalRequest | QualifierRequest;
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const day = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);
const keys = (value: unknown, expected: readonly string[]): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === [...expected].sort().join(',');
const ids = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.length > 0 && value.every(id)
    && new Set(value).size === value.length;
/** Validate saved structure without asking a future Edition to replay itself. */
const validSavedHistory = (saved: NationalQualificationHistory): boolean =>
  keys(saved, ['regionalCompetitionIds', 'regional', 'qualifiers'])
  && Array.isArray(saved.regional) && Array.isArray(saved.qualifiers)
  && saved.regional.every((item) => keys(item, ['placement', 'resultApplicationIds'])
    && ids(item.resultApplicationIds)
    && keys(item.placement, ['region', 'editionId', 'snapshotId', 'completedAtDay', 'orderedNationIds'])
    && REGIONS.includes(item.placement.region) && id(item.placement.editionId)
    && id(item.placement.snapshotId) && day(item.placement.completedAtDay)
    && ids(item.placement.orderedNationIds))
  && saved.qualifiers.every((item) => keys(item, ['editionId', 'completedAtDay',
    'qualificationSnapshotId', 'directSnapshotId', 'rankingSnapshotId', 'resultApplicationIds', 'winners'])
    && id(item.editionId) && day(item.completedAtDay) && id(item.qualificationSnapshotId)
    && id(item.directSnapshotId) && id(item.rankingSnapshotId)
    && ids(item.resultApplicationIds) && item.resultApplicationIds.length === 12
    && Array.isArray(item.winners) && item.winners.length === 4
    && new Set(item.winners.map((winner: WbcQualifierPodWinner) => winner?.podIndex)).size === 4
    && new Set(item.winners.map((winner: WbcQualifierPodWinner) => winner?.nationId)).size === 4
    && item.winners.every((winner: WbcQualifierPodWinner) => keys(winner, ['podIndex', 'qualifierEditionId',
      'nationId', 'region', 'officialFinalApplicationId', 'finalizedDay'])
      && Number.isSafeInteger(winner.podIndex) && winner.podIndex >= 0 && winner.podIndex <= 3
      && winner.qualifierEditionId === item.editionId && id(winner.nationId)
      && REGIONS.includes(winner.region) && winner.finalizedDay === item.completedAtDay
      && id(winner.officialFinalApplicationId)
      && item.resultApplicationIds.includes(winner.officialFinalApplicationId)));

/** Official regional placements become cutoff-aware WBC berth sources. */
export const openSqliteNationalQualificationHistoryStore = (
  databasePath: string,
  sources: Readonly<{
    knockouts: Pick<SqliteRegionalNationalKnockoutStore,
      'readEvidence'>;
    qualifiers?: Pick<SqliteWbcGlobalQualifierPodStore,
      'readEvidence'>;
    selections?: Pick<SqliteWbcQualifierSelectionStore,
      'readSelection'>;
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
  const getEvents = db.prepare(`SELECT ordinal, edition_id, request_json, history_json
    FROM world_national_qualification_events WHERE career_id=?
    ORDER BY ordinal`);
  const head = (careerId: string): HeadRow | null =>
    (getHead.get(careerId) as HeadRow | undefined) ?? null;
  const events = (careerId: string): EventRow[] =>
    getEvents.all(careerId) as EventRow[];
  const project = (careerId: string, history: NationalQualificationHistory,
    request: Request): NationalQualificationHistory => {
    if (request.kind === 'QUALIFIER') {
      const evidence = sources.qualifiers?.readEvidence(careerId,
        request.editionId);
      const selection = sources.selections?.readSelection(careerId,
        request.editionId);
      if (!evidence || !selection) {
        throw new Error('national qualification lacks official WBC qualifier');
      }
      if (evidence.edition.editionId !== request.editionId
        || selection.qualifierEditionId !== request.editionId) {
        throw new Error('national qualification WBC qualifier edition mismatch');
      }
      return recordWbcGlobalQualifier(history, evidence.edition,
        selection, evidence.semifinalResults,
        evidence.finalResults);
    }
    const evidence = sources.knockouts.readEvidence(careerId,
      request.editionId);
    if (!evidence || evidence.source.groupEdition.region
      !== request.region || evidence.source.groupEdition.editionId
        !== request.editionId) {
      throw new Error('national qualification lacks official regional result');
    }
    return recordRegionalNationalChampionship(history,
      evidence.source, evidence.quarterfinalResults,
      evidence.semifinalResults, evidence.finalResult);
  };
  const replay = (careerId: string, includeQualifiers = true,
    beforeDay = Number.MAX_SAFE_INTEGER):
    NationalQualificationHistory | null => {
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
      let previousSaved = history;
      events(careerId).forEach((row, index) => {
        const request = JSON.parse(row.request_json) as Request;
        if (row.ordinal !== index
          || (request.kind !== 'QUALIFIER'
            && (request.kind !== 'REGIONAL'
              || !REGIONS.includes(request.region)))
          || !id(request.editionId)
          || request.editionId !== row.edition_id
          || canonicalJson(request) !== row.request_json) {
          throw new Error('national qualification event order differs');
        }
        const saved = JSON.parse(row.history_json) as
          NationalQualificationHistory;
        if (!validSavedHistory(saved)) {
          throw new Error('national qualification saved structure differs');
        }
        const recorded = request.kind === 'REGIONAL'
          ? saved.regional.at(-1)?.placement : saved.qualifiers.at(-1);
        const appended = request.kind === 'REGIONAL'
          ? { ...previousSaved, regional: [...previousSaved.regional, saved.regional.at(-1)] }
          : { ...previousSaved, qualifiers: [...previousSaved.qualifiers, saved.qualifiers.at(-1)] };
        if (saved.regional.length + saved.qualifiers.length !== index + 1
          || recorded?.editionId !== request.editionId
          || (request.kind === 'REGIONAL'
            && saved.regional.at(-1)?.placement.region !== request.region)
          || saved.regional.some((item) => !day(item.placement.completedAtDay))
          || saved.qualifiers.some((item) => !day(item.completedAtDay))
          || canonicalJson(saved) !== row.history_json
          || canonicalJson(appended) !== row.history_json
          || canonicalJson(saved.regionalCompetitionIds) !== canonicalJson(competitionIds)) {
          throw new Error('national qualification edition metadata differs');
        }
        // Later regional/qualifier editions may depend on this earlier
        // qualification. Follow only completed ancestors, never their sources.
        // Direct berths also exclude downstream qualifier evidence entirely.
        if (recorded!.completedAtDay <= beforeDay
          && (includeQualifiers || request.kind === 'REGIONAL')) {
          history = project(careerId, history, request);
        }
        const atCutoff = { regionalCompetitionIds: saved.regionalCompetitionIds,
          regional: saved.regional.filter((item) => item.placement.completedAtDay <= beforeDay),
          qualifiers: includeQualifiers
            ? saved.qualifiers.filter((item) => item.completedAtDay <= beforeDay) : [] };
        if (canonicalJson(history) !== canonicalJson(atCutoff)) {
          throw new Error('national qualification replay differs');
        }
        previousSaved = saved;
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
    recordQualifier(careerId: string,
      editionId: string): NationalQualificationHistory {
      assertCareer(careerId);
      if (!id(editionId)) {
        throw new Error('invalid WBC qualifier qualification request');
      }
      db.exec('BEGIN IMMEDIATE');
      try {
        const history = replay(careerId);
        if (!history) throw new Error('national qualification head is missing');
        const prior = history.qualifiers.find((item) =>
          item.editionId === editionId);
        if (prior) {
          db.exec('COMMIT');
          return history;
        }
        const request: QualifierRequest = { kind: 'QUALIFIER',
          editionId };
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
    readHistory(careerId: string,
      beforeDay = Number.MAX_SAFE_INTEGER): NationalQualificationHistory | null {
      assertCareer(careerId);
      if (!day(beforeDay)) throw new Error('invalid national qualification cutoff');
      return replay(careerId, true, beforeDay);
    },
    regionalAuthority(careerId: string) {
      assertCareer(careerId);
      return Object.freeze({ regionalChampionship: (
        region: ClubWorldRegion, beforeDay: number) => {
        assertCareer(careerId);
        if (!REGIONS.includes(region) || !day(beforeDay)) {
          throw new Error('invalid regional national placement lookup');
        }
        const history = replay(careerId, false, beforeDay);
        return history
          ? latestRegionalNationalPlacement(history, region,
            beforeDay) : null;
      } });
    },
    qualifierAuthority(careerId: string) {
      assertCareer(careerId);
      return Object.freeze({ qualifierPodWinner: (
        podIndex: number, beforeDay: number) => {
        assertCareer(careerId);
        if (!Number.isSafeInteger(podIndex) || podIndex < 0
          || podIndex > 3 || !day(beforeDay)) {
          throw new Error('invalid WBC qualifier pod lookup');
        }
        const history = replay(careerId, true, beforeDay);
        return history
          ? latestWbcQualifierPodWinner(history, podIndex,
            beforeDay) : null;
      } });
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
