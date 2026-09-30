import { createCompetitionSourceReader, withCompetitionSourceReadScope } from './CompetitionSourceReadScope';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { assembleWbcQualifierEdition, type WbcQualifierEditionAssembly,
  type WbcQualifierEditionProfile, type WbcQualifierHostCandidateSnapshot } from
  '../../core/world/competition/WbcQualifierEditionAssembly';
import type { WbcGlobalQualifierEdition } from '../../core/world/competition/WbcGlobalQualifierPods';
import type { WbcQualifierSelection } from '../../core/world/competition/WbcGlobalQualifierSelection';
import type { WbcDirectBerths } from '../../core/world/competition/WbcBerths';
import type { PremierTwelveRanking } from '../../core/world/competition/PremierTwelve';
import type { NationalCompetitionSelection, SqliteNationalCompetitionSelectionStore } from './SqliteNationalCompetitionSelectionStore';
import type { SqliteWbcDirectBerthStore } from './SqliteWbcDirectBerthStore';
import type { SqliteWbcQualifierSelectionStore, WbcQualifierSelectionRequest } from './SqliteWbcQualifierSelectionStore';
import type { SqliteWorldNationalRankingSnapshotStore } from './SqliteWorldNationalRankingSnapshotStore';
import type { SqliteNationCompetitionRegionStore } from './SqliteNationCompetitionRegionStore';

export type WbcQualifierEditionRequest = Readonly<{
  careerId: string; wbcEditionId: string; qualifierEditionId: string; selectedAtDay: number;
  calendarWindow: WbcGlobalQualifierEdition['calendarWindow']; drawSeed: string; profile: WbcQualifierEditionProfile;
}>;
export type DurableWbcQualifierEdition = WbcQualifierEditionAssembly & Readonly<{
  snapshotId: string;
  source: Readonly<{ world: NationalCompetitionSelection; direct: WbcDirectBerths;
    selection: WbcQualifierSelection; selectionRequest: WbcQualifierSelectionRequest;
    ranking: PremierTwelveRanking; hosts: WbcQualifierHostCandidateSnapshot }>;
}>;
export type WbcQualifierEditionSources = Readonly<{
  selections: Pick<SqliteNationalCompetitionSelectionStore, 'readSelection'>;
  direct: Pick<SqliteWbcDirectBerthStore, 'readDirect'>;
  selection: Pick<SqliteWbcQualifierSelectionStore, 'readSelection' | 'readRequest'>;
  rankings: Pick<SqliteWorldNationalRankingSnapshotStore, 'readRanking'>;
  nations: Pick<SqliteNationCompetitionRegionStore, 'readRegion'>;
  hosts: Readonly<{ readCandidates(careerId: string, qualifierEditionId: string,
    beforeDay: number): WbcQualifierHostCandidateSnapshot | null }>;
}>;
export type SqliteWbcQualifierEditionStore = Readonly<{
  initialize(request: WbcQualifierEditionRequest): DurableWbcQualifierEdition;
  readSnapshot(careerId: string, qualifierEditionId: string): DurableWbcQualifierEdition | null;
  readEdition(careerId: string, qualifierEditionId: string): WbcGlobalQualifierEdition | null;
  close(): void;
}>;
type Row = { request_json: string; snapshot_json: string };
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const canonical = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) =>
  item !== null && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

/** Edition assembly consumes accepted source owners; hosts confer no automatic berth or ability change. */
export const openSqliteWbcQualifierEditionStore = (
  databasePath: string, sources: WbcQualifierEditionSources,
): SqliteWbcQualifierEditionStore => {
  if (!id(databasePath)) throw new Error('invalid WBC qualifier Edition database path');
  const readDirect = createCompetitionSourceReader(sources.direct.readDirect, sources.direct);
  const readSelected = createCompetitionSourceReader(sources.selection.readSelection, sources.selection);
  const readSelectedRequest = createCompetitionSourceReader(sources.selection.readRequest, sources.selection);
  const readRanking = createCompetitionSourceReader(sources.rankings.readRanking, sources.rankings);
  const readCandidates = createCompetitionSourceReader(sources.hosts.readCandidates, sources.hosts);
  const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_wbc_qualifier_editions (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL, request_json TEXT NOT NULL, snapshot_json TEXT NOT NULL,
    PRIMARY KEY (career_id, edition_id)
  ); CREATE TABLE IF NOT EXISTS world_wbc_qualifier_host_policies (
    career_id TEXT NOT NULL, policy_version TEXT NOT NULL, policy_json TEXT NOT NULL,
    PRIMARY KEY (career_id, policy_version)
  );`);
  const get = db.prepare('SELECT request_json, snapshot_json FROM world_wbc_qualifier_editions WHERE career_id=? AND edition_id=?');
  const getPolicy = db.prepare('SELECT policy_json FROM world_wbc_qualifier_host_policies WHERE career_id=? AND policy_version=?');
  const policyJson = (request: WbcQualifierEditionRequest): string => canonical({
    version: request.profile.hostingPolicyVersion, distinctPodCities: request.profile.distinctPodCities });
  const row = (careerId: string, editionId: string): Row | null => (get.get(careerId, editionId) as Row | undefined) ?? null;
  const project = (request: WbcQualifierEditionRequest): DurableWbcQualifierEdition => {
    if (!request || ![request.careerId, request.wbcEditionId, request.qualifierEditionId].every(id)
      || !day(request.selectedAtDay) || !day(request.calendarWindow?.startsOnDay)
      || !day(request.calendarWindow.endsOnDay) || request.selectedAtDay >= request.calendarWindow.startsOnDay
      || request.calendarWindow.endsOnDay < request.calendarWindow.startsOnDay) {
      throw new Error('qualifier Edition requires valid pre-play selection and calendar');
    }
    const world = sources.selections.readSelection(request.careerId, request.wbcEditionId);
    const direct = readDirect(request.careerId, request.wbcEditionId);
    if (!world || world.kind !== 'WBC' || world.editionId !== request.wbcEditionId || !direct
      || direct.editionId !== world.editionId || direct.qualifierEditionId !== request.qualifierEditionId
      || direct.cutoffSnapshotId !== world.qualificationCutoff.snapshotId || direct.cutoffDay !== world.qualificationCutoff.day
      || request.calendarWindow.endsOnDay > direct.cutoffDay
      || direct.cutoffDay >= world.calendarWindow.startsOnDay
      || !Array.isArray(direct.placements) || direct.placements.length !== 4
      || direct.placements.some((item) => !day(item.completedAtDay) || item.completedAtDay > request.selectedAtDay)) {
      throw new Error('qualifier Edition requires regional results and accepted World cutoff');
    }
    const selection = readSelected(request.careerId, request.qualifierEditionId);
    const selectionRequest = readSelectedRequest(request.careerId, request.qualifierEditionId);
    const ranking = readRanking(request.careerId, request.selectedAtDay);
    if (!selectionRequest || selectionRequest.careerId !== request.careerId
      || selectionRequest.wbcEditionId !== request.wbcEditionId || selectionRequest.qualifierEditionId !== request.qualifierEditionId
      || selectionRequest.rankingAsOfDay !== request.selectedAtDay
      || !day(selectionRequest.eligibility?.asOfDay) || selectionRequest.eligibility.asOfDay > request.selectedAtDay
      || !selection || selectionRequest.eligibility.snapshotId !== selection.eligibilitySnapshotId
      || selectionRequest.policy.version !== selection.policyVersion
      || selection.qualifierEditionId !== request.qualifierEditionId
      || selection.directSnapshotId !== direct.directSnapshotId || !ranking
      || ranking.asOfDay !== request.selectedAtDay || selection.rankingSnapshotId !== ranking.snapshotId
      || selection.entrants.some((item) => direct.entrantNationIds.includes(item.nationId)
        || !selectionRequest.eligibility.eligibleNationIds.includes(item.nationId)
        || item.route === 'WORLD_RANKING' && !ranking.orderedNationIds.includes(item.nationId)
        || sources.nations.readRegion(request.careerId, item.nationId, request.selectedAtDay) !== item.region)) {
      throw new Error('qualifier Edition requires accepted selected entrants and pre-play ranking');
    }
    const hosts = readCandidates(request.careerId, request.qualifierEditionId, request.selectedAtDay);
    if (!hosts || hosts.asOfDay !== request.selectedAtDay) throw new Error('qualifier Edition requires cutoff host evidence');
    const assembly = assembleWbcQualifierEdition({ selection, hosts, drawSeed: request.drawSeed,
      profile: request.profile, calendarWindow: request.calendarWindow });
    const basis = cloneInert({ ...assembly, source: { world, direct, selection, selectionRequest, ranking, hosts } });
    return freeze({ ...basis, snapshotId: `wbc-qualifier-edition:${createHash('sha256')
      .update(canonical({ request, ...basis })).digest('hex')}` });
  };
  const replay = (careerId: string, qualifierEditionId: string, stored: Row): DurableWbcQualifierEdition => {
    try {
      const request = JSON.parse(stored.request_json) as WbcQualifierEditionRequest;
      const saved = JSON.parse(stored.snapshot_json) as DurableWbcQualifierEdition;
      const policy = getPolicy.get(careerId, request.profile.hostingPolicyVersion) as { policy_json: string } | undefined;
      if (request.careerId !== careerId || request.qualifierEditionId !== qualifierEditionId
        || canonical(request) !== stored.request_json || canonical(saved) !== stored.snapshot_json
        || !policy || policy.policy_json !== policyJson(request)) throw new Error('qualifier Edition serialization or policy differs');
      const current = project(request);
      if (canonical(current) !== stored.snapshot_json) throw new Error('qualifier Edition source replay differs');
      return current;
    } catch (cause) { throw new Error(`corrupt WBC qualifier Edition for ${careerId}`, { cause }); }
  };
  let closed = false;
  const scope = (careerId: string, editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) throw new Error('invalid qualifier Edition scope');
  };
  const readSnapshot = (careerId: string, qualifierEditionId: string): DurableWbcQualifierEdition | null => withCompetitionSourceReadScope(() => {
    scope(careerId, qualifierEditionId); const stored = row(careerId, qualifierEditionId);
    return stored ? replay(careerId, qualifierEditionId, stored) : null;
  });
  return Object.freeze({
    initialize(raw: WbcQualifierEditionRequest): DurableWbcQualifierEdition {
      scope(raw?.careerId, raw?.qualifierEditionId); const request = cloneInert(raw);
      const stored = row(request.careerId, request.qualifierEditionId);
      if (stored) {
        const prior = replay(request.careerId, request.qualifierEditionId, stored);
        if (stored.request_json !== canonical(request)) throw new Error('qualifier Edition is frozen differently');
        return prior;
      }
      const current = project(request);
      db.exec('BEGIN IMMEDIATE');
      try {
        const policy = getPolicy.get(request.careerId, request.profile.hostingPolicyVersion) as { policy_json: string } | undefined;
        if (policy && policy.policy_json !== policyJson(request)) throw new Error('qualifier host policy is frozen differently');
        const raced = row(request.careerId, request.qualifierEditionId);
        if (raced && (raced.request_json !== canonical(request) || raced.snapshot_json !== canonical(current))) {
          throw new Error('qualifier Edition is frozen differently');
        }
        if (!policy) db.prepare('INSERT INTO world_wbc_qualifier_host_policies VALUES (?, ?, ?)')
          .run(request.careerId, request.profile.hostingPolicyVersion, policyJson(request));
        if (!raced) db.prepare('INSERT INTO world_wbc_qualifier_editions VALUES (?, ?, ?, ?)')
          .run(request.careerId, request.qualifierEditionId, canonical(request), canonical(current));
        db.exec('COMMIT'); return current;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    readSnapshot,
    readEdition(careerId: string, qualifierEditionId: string): WbcGlobalQualifierEdition | null {
      return readSnapshot(careerId, qualifierEditionId)?.edition ?? null;
    },
    close(): void { if (!closed) db.close(); closed = true; },
  });
};
