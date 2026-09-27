import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { allocateClubWorldBerths,
  type ClubWorldBerthAllocation, type ClubWorldBerthAuthority,
  type ClubWorldRegion } from
  '../../core/world/competition/ClubWorldBerths';
import type { SqliteClubWorldChampionHistoryStore } from
  './SqliteClubWorldChampionHistoryStore';
import type { SqliteClubWorldQualificationSourceStore } from
  './SqliteClubWorldQualificationSourceStore';
import type { SqliteRegionalClubSeasonHistoryStore } from
  './SqliteRegionalClubSeasonHistoryStore';

const REGIONS: readonly ClubWorldRegion[] = [
  'ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
export type ClubWorldBerthRequest = Readonly<{
  careerId: string;
  editionId: string;
  cycleId: string;
  previousRegionalEditionIds: Readonly<Record<ClubWorldRegion, string>>;
  previousWorldEditionId: string;
}>;
export type SqliteClubWorldBerthStore = Readonly<{
  initialize(request: ClubWorldBerthRequest): ClubWorldBerthAllocation;
  readAllocation(careerId: string,
    editionId: string): ClubWorldBerthAllocation | null;
  close(): void;
}>;
type Row = { request_json: string; allocation_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);

/** Allocate 16 berths from frozen performance and official title history. */
export const openSqliteClubWorldBerthStore = (
  databasePath: string,
  sources: Readonly<{
    qualification: Pick<SqliteClubWorldQualificationSourceStore,
      'readSources'>;
    regional: Pick<SqliteRegionalClubSeasonHistoryStore, 'authority'>;
    titles: Pick<SqliteClubWorldChampionHistoryStore, 'authority'>;
    editionHost: ClubWorldBerthAuthority['editionHost'];
  }>,
): SqliteClubWorldBerthStore => {
  if (!id(databasePath)) {
    throw new Error('invalid Club World berth database path');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_club_world_berths (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    request_json TEXT NOT NULL, allocation_json TEXT NOT NULL,
    PRIMARY KEY (career_id, edition_id)
  );`);
  const get = db.prepare(`SELECT request_json, allocation_json
    FROM world_club_world_berths WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): Row | null =>
    (get.get(careerId, editionId) as Row | undefined) ?? null;
  const project = (request: ClubWorldBerthRequest):
    ClubWorldBerthAllocation => {
    const performance = sources.qualification.readSources(
      request.careerId, request.editionId);
    const host = sources.editionHost(request.editionId);
    const regional = sources.regional.authority(request.careerId);
    const world = sources.titles.authority(request.careerId);
    if (!performance || !host) {
      throw new Error('Club World berths require performance and host');
    }
    const regionalChampions = REGIONS.map((region) => {
      const official = regional.latestRegionalChampion(region,
        host.qualificationCutoffDay);
      if (!official) {
        throw new Error('Club World lacks official regional champion');
      }
      return { region, clubId: official.clubId,
        officialTitleId: official.officialTitleId,
        titleCompetitionId: `REGIONAL_CL_${region}`,
        titleEditionId: official.editionId };
    });
    const defender = world.defendingWorldChampion(
      host.qualificationCutoffDay);
    if (!defender) {
      throw new Error('Club World lacks defending world champion');
    }
    const authority: ClubWorldBerthAuthority = {
      editionHost: sources.editionHost,
      latestRegionalChampion: regional.latestRegionalChampion,
      defendingWorldChampion: world.defendingWorldChampion,
    };
    return allocateClubWorldBerths({
      editionId: request.editionId,
      policyVersion: 'club-world-qualification-v1',
      cycleId: request.cycleId,
      coefficientPolicyVersion: performance.policyVersion,
      rankingPolicyVersion: performance.policyVersion,
      fourYearSeasonIds: performance.coefficients[0]?.fourYearSeasonIds ?? [],
      previousRegionalEditionIds: request.previousRegionalEditionIds,
      previousWorldEditionId: request.previousWorldEditionId,
      hostRegion: host.region,
      hostSnapshot: { editionId: request.editionId,
        snapshotId: host.snapshotId, region: host.region },
      coefficients: performance.coefficients,
      rankings: performance.rankings,
      regionalChampions,
      defendingWorldChampion: { region: defender.region,
        clubId: defender.clubId,
        officialTitleId: defender.officialTitleId,
        titleCompetitionId: 'CLUB_WORLD',
        titleEditionId: defender.editionId },
    }, authority);
  };
  const replay = (careerId: string, editionId: string,
    stored: Row): ClubWorldBerthAllocation => {
    try {
      const request = JSON.parse(stored.request_json) as
        ClubWorldBerthRequest;
      const saved = JSON.parse(stored.allocation_json) as
        ClubWorldBerthAllocation;
      const result = project(request);
      if (request.careerId !== careerId
        || request.editionId !== editionId
        || canonicalJson(request) !== stored.request_json
        || canonicalJson(saved) !== stored.allocation_json
        || canonicalJson(result) !== stored.allocation_json) {
        throw new Error('Club World berth replay differs');
      }
      return result;
    } catch (cause) {
      throw new Error(`corrupt Club World berths for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  const assertScope = (careerId: string, editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) {
      throw new Error('invalid Club World berth scope');
    }
  };
  return Object.freeze({
    initialize(rawRequest: ClubWorldBerthRequest):
      ClubWorldBerthAllocation {
      assertScope(rawRequest?.careerId, rawRequest?.editionId);
      const request = cloneInert(rawRequest);
      const result = project(request);
      const requestJson = canonicalJson(request);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(request.careerId, request.editionId);
        if (stored) {
          const prior = replay(request.careerId, request.editionId,
            stored);
          if (stored.request_json !== requestJson) {
            throw new Error('Club World berth source is frozen differently');
          }
          db.exec('COMMIT');
          return prior;
        }
        db.prepare(`INSERT INTO world_club_world_berths
          (career_id, edition_id, request_json, allocation_json)
          VALUES (?, ?, ?, ?)`).run(request.careerId,
            request.editionId, requestJson, canonicalJson(result));
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readAllocation(careerId: string,
      editionId: string): ClubWorldBerthAllocation | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored) : null;
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
