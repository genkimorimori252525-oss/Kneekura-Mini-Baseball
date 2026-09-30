import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { buildRegionalNationalRanking, type RegionalNationalRanking } from '../../core/world/competition/RegionalNationalRanking';
import type { ClubWorldRegion } from '../../core/world/competition/ClubWorldBerths';
import type { RegionalNationalEdition } from '../../core/world/competition/RegionalNationalGroups';
import type { WorldNationalRankingHistory, WorldNationalRankingPolicy,
  WorldNationalRankingPolicyRegistry } from '../../core/world/competition/WorldNationalRankingHistory';
import type { SqliteWorldNationalRankingHistoryStore } from './SqliteWorldNationalRankingHistoryStore';
import type { SqliteNationCompetitionRegionStore } from './SqliteNationCompetitionRegionStore';
import { createCompetitionSourceReader, withCompetitionSourceReadScope, withCompetitionSourceReadPhase } from './CompetitionSourceReadScope';

export type RegionalNationalRankingRequest = Readonly<{
  careerId: string; region: ClubWorldRegion; asOfDay: number; nationIds: readonly string[];
  policy: WorldNationalRankingPolicy; registry: WorldNationalRankingPolicyRegistry;
}>;
export type DurableRegionalNationalRanking = Readonly<{
  ranking: RegionalNationalRanking;
  source: Readonly<{ history: WorldNationalRankingHistory;
    editions: readonly RegionalNationalEdition[];
    nationRegions: readonly Readonly<{ nationId: string; beforeDay: number; region: ClubWorldRegion }>[] }>;
}>;
export type SqliteRegionalNationalRankingSnapshotStore = Readonly<{
  initialize(input: RegionalNationalRankingRequest): DurableRegionalNationalRanking;
  readSnapshot(careerId: string, region: ClubWorldRegion, asOfDay: number): DurableRegionalNationalRanking | null;
  readRanking(careerId: string, region: ClubWorldRegion, asOfDay: number): RegionalNationalRanking | null;
  close(): void;
}>;
type Row = { request_json: string; snapshot_json: string };
const regions: readonly ClubWorldRegion[] = ['ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const json = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

/** Regional-only official seeding evidence, distinct from the World ranking snapshot owner. */
export const openSqliteRegionalNationalRankingSnapshotStore = (databasePath: string, sources: Readonly<{
  history: Pick<SqliteWorldNationalRankingHistoryStore, 'readHistory' | 'readRegionalEdition'>;
  nations: Pick<SqliteNationCompetitionRegionStore, 'readRegion'>;
}>): SqliteRegionalNationalRankingSnapshotStore => {
  if (!id(databasePath)) throw new Error('invalid regional ranking database path');
  const readHistory = createCompetitionSourceReader<[string, number], WorldNationalRankingHistory>(sources.history.readHistory, sources.history);
  const readEdition = createCompetitionSourceReader(sources.history.readRegionalEdition, sources.history);
  const readRegion = createCompetitionSourceReader(sources.nations.readRegion, sources.nations);
  const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_regional_national_ranking_snapshots (
    career_id TEXT NOT NULL, region TEXT NOT NULL, as_of_day INTEGER NOT NULL,
    request_json TEXT NOT NULL, snapshot_json TEXT NOT NULL,
    PRIMARY KEY(career_id, region, as_of_day)
  ); CREATE TABLE IF NOT EXISTS world_regional_national_ranking_policies (
    career_id TEXT NOT NULL, policy_version TEXT NOT NULL, policy_json TEXT NOT NULL,
    PRIMARY KEY(career_id, policy_version)
  );`);
  let closed = false;
  const scope = (careerId: string, region: ClubWorldRegion, asOfDay: number): void => {
    if (closed || !id(careerId) || !regions.includes(region) || !day(asOfDay)) throw new Error('invalid regional ranking scope');
  };
  const row = (careerId: string, region: ClubWorldRegion, asOfDay: number): Row | undefined =>
    db.prepare('SELECT request_json, snapshot_json FROM world_regional_national_ranking_snapshots WHERE career_id=? AND region=? AND as_of_day=?')
      .get(careerId, region, asOfDay) as Row | undefined;
  const project = (request: RegionalNationalRankingRequest): DurableRegionalNationalRanking => {
    if (!request || Object.keys(request).sort().join('|') !== 'asOfDay|careerId|nationIds|policy|region|registry') {
      throw new Error('invalid regional ranking request');
    }
    const history = readHistory(request.careerId, request.asOfDay);
    const proofs = new Map<string, { nationId: string; beforeDay: number; region: ClubWorldRegion }>();
    const editionProofs = new Map<string, RegionalNationalEdition>();
    const regionAt = (nationId: string, beforeDay: number): ClubWorldRegion | null => {
      const region = readRegion(request.careerId, nationId, beforeDay);
      if (region) proofs.set(json([nationId, beforeDay]), { nationId, beforeDay, region });
      return region;
    };
    const calculated = buildRegionalNationalRanking(history, request.region, request.asOfDay,
      request.nationIds, request.policy, request.registry, regionAt, (editionId) => {
        const edition = readEdition(request.careerId, editionId, request.asOfDay);
        if (edition) editionProofs.set(editionId, edition);
        return edition;
      });
    const results = new Set(calculated.evidenceResultIds);
    const regionalHistory = { editions: history.editions.filter((edition) => edition.tier === 'REGIONAL'
      && edition.games.some((game) => results.has(game.applicationId))) };
    const relevant = new Set(request.nationIds.map((nation) => json([nation, request.asOfDay])));
    for (const edition of regionalHistory.editions) for (const game of edition.games) {
      for (const nation of [game.homeNationId, game.awayNationId]) relevant.add(json([nation, editionProofs.get(edition.editionId)!.calendarWindow.startsOnDay]));
    }
    const source = { history: regionalHistory, editions: regionalHistory.editions.map((entry) => editionProofs.get(entry.editionId)!),
      nationRegions: [...proofs.entries()]
      .filter(([key]) => relevant.has(key)).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, proof]) => proof) };
    const snapshotId = `regional-national-ranking:${createHash('sha256').update(json({ request, calculated, source })).digest('hex')}`;
    return freeze({ ranking: { ...calculated, snapshotId }, source });
  };
  const replay = (careerId: string, region: ClubWorldRegion, asOfDay: number, stored: Row): DurableRegionalNationalRanking => {
    try {
      const request = JSON.parse(stored.request_json) as RegionalNationalRankingRequest;
      const saved = JSON.parse(stored.snapshot_json) as DurableRegionalNationalRanking;
      const policy = db.prepare('SELECT policy_json FROM world_regional_national_ranking_policies WHERE career_id=? AND policy_version=?')
        .get(careerId, request.policy.version) as { policy_json: string } | undefined;
      if (request.careerId !== careerId || request.region !== region || request.asOfDay !== asOfDay
        || json(request) !== stored.request_json || json(saved) !== stored.snapshot_json
        || !policy || policy.policy_json !== json(request.policy)) throw new Error('regional ranking metadata or policy differs');
      const expected = project(request);
      if (json(expected) !== stored.snapshot_json) throw new Error('regional ranking source replay differs');
      return expected;
    } catch (cause) { throw new Error(`corrupt regional national ranking for ${careerId}`, { cause }); }
  };
  const readSnapshot = (careerId: string, region: ClubWorldRegion, asOfDay: number): DurableRegionalNationalRanking | null => withCompetitionSourceReadScope(() => {
    scope(careerId, region, asOfDay);
    const stored = row(careerId, region, asOfDay);
    return stored ? replay(careerId, region, asOfDay, stored) : null;
  });
  return Object.freeze({
    initialize(raw: RegionalNationalRankingRequest): DurableRegionalNationalRanking {
      return withCompetitionSourceReadPhase(() => {
        scope(raw?.careerId, raw?.region, raw?.asOfDay);
        const request = cloneInert(raw);
        db.exec('BEGIN IMMEDIATE');
        try {
          const existing = row(request.careerId, request.region, request.asOfDay);
          if (existing) {
            const prior = replay(request.careerId, request.region, request.asOfDay, existing);
            if (existing.request_json !== json(request)) throw new Error('regional ranking is frozen differently');
            db.exec('COMMIT'); return prior;
          }
          const snapshot = project(request);
          const policy = db.prepare('SELECT policy_json FROM world_regional_national_ranking_policies WHERE career_id=? AND policy_version=?')
            .get(request.careerId, request.policy.version) as { policy_json: string } | undefined;
          if (policy && policy.policy_json !== json(request.policy)) throw new Error('regional ranking policy is frozen differently');
          if (!policy) db.prepare('INSERT INTO world_regional_national_ranking_policies VALUES (?, ?, ?)')
            .run(request.careerId, request.policy.version, json(request.policy));
          db.prepare('INSERT INTO world_regional_national_ranking_snapshots VALUES (?, ?, ?, ?, ?)')
            .run(request.careerId, request.region, request.asOfDay, json(request), json(snapshot));
          db.exec('COMMIT'); return snapshot;
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      });
    },
    readSnapshot,
    readRanking: (careerId: string, region: ClubWorldRegion, asOfDay: number) => readSnapshot(careerId, region, asOfDay)?.ranking ?? null,
    close() { if (!closed) db.close(); closed = true; },
  });
};
