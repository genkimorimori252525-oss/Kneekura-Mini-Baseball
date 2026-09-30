import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { drawWbcQualifierEntrantPods, type WbcQualifierHostCandidateSnapshot } from '../../core/world/competition/WbcQualifierEditionAssembly';
import { deriveWbcQualifierHostCandidates, snapshotWbcQualifierHostCandidatePolicy,
  type WbcQualifierHostCandidatePolicy, type WbcQualifierHostAccessSnapshot,
  type CompletedQualifierHosting } from '../../core/world/competition/WbcQualifierHostCandidates';
import type { WbcQualifierSelection } from '../../core/world/competition/WbcGlobalQualifierSelection';
import type { SqliteWbcQualifierSelectionStore, WbcQualifierSelectionRequest } from './SqliteWbcQualifierSelectionStore';
import type { SqliteWorldHostInfrastructureStore, AcceptedHostVenue } from './SqliteWorldHostInfrastructureStore';
import type { SqliteWbcQualifierHostAccessStore } from './SqliteWbcQualifierHostAccessStore';
import type { SqliteWbcGlobalQualifierPodStore } from './SqliteWbcGlobalQualifierPodStore';
import type { SqliteWbcQualifierEditionStore } from './SqliteWbcQualifierEditionStore';

export type WbcQualifierHostCandidateRequest = Readonly<{
  careerId: string; qualifierEditionId: string; selectedAtDay: number; drawSeed: string;
  drawPolicyVersion: string; policy: WbcQualifierHostCandidatePolicy;
}>;
type Hosting = CompletedQualifierHosting & Readonly<{ selectedAtDay: number }>;
export type DurableWbcQualifierHostCandidates = WbcQualifierHostCandidateSnapshot & Readonly<{
  drawSnapshotId: string; policy: WbcQualifierHostCandidatePolicy;
  source: Readonly<{ selection: WbcQualifierSelection; selectionRequest: WbcQualifierSelectionRequest;
    venues: readonly AcceptedHostVenue[]; access: WbcQualifierHostAccessSnapshot; hostingHistory: readonly Hosting[] }>;
}>;
export type WbcQualifierHostCandidateSources = Readonly<{
  selection: Pick<SqliteWbcQualifierSelectionStore, 'readSelection' | 'readRequest'>;
  infrastructure: Pick<SqliteWorldHostInfrastructureStore, 'readVenues'>;
  access: Pick<SqliteWbcQualifierHostAccessStore, 'readAccess'>;
  qualifiers: Pick<SqliteWbcGlobalQualifierPodStore, 'readEvidence'>;
  editions: Pick<SqliteWbcQualifierEditionStore, 'readSnapshot'>;
}>;
export type SqliteWbcQualifierHostCandidateStore = Readonly<{
  initialize(request: WbcQualifierHostCandidateRequest): DurableWbcQualifierHostCandidates;
  readCandidates(careerId: string, qualifierEditionId: string, beforeDay: number): DurableWbcQualifierHostCandidates | null;
  recordCompletedEdition(careerId: string, qualifierEditionId: string): Hosting;
  close(): void;
}>;
type Row = { selected_day: number; request_json: string; snapshot_json: string };
type HistoryRow = { edition_id: string; selected_day: number; completed_day: number; snapshot_json: string };
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const canonical = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) =>
  item !== null && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const digest = (value: unknown): string => createHash('sha256').update(canonical(value)).digest('hex');
const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

/** Native organizer candidate owner, with acyclic official hosting predecessors. */
export const openSqliteWbcQualifierHostCandidateStore = (
  databasePath: string, sources: WbcQualifierHostCandidateSources,
): SqliteWbcQualifierHostCandidateStore => {
  if (!id(databasePath)) throw new Error('invalid qualifier host candidate database path');
  const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_wbc_qualifier_host_candidates (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL, selected_day INTEGER NOT NULL,
    request_json TEXT NOT NULL, snapshot_json TEXT NOT NULL, PRIMARY KEY(career_id, edition_id)
  ); CREATE TABLE IF NOT EXISTS world_wbc_qualifier_candidate_policies (
    career_id TEXT NOT NULL, policy_version TEXT NOT NULL, policy_json TEXT NOT NULL,
    PRIMARY KEY(career_id, policy_version)
  ); CREATE TABLE IF NOT EXISTS world_wbc_qualifier_hosting_history (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL, selected_day INTEGER NOT NULL,
    completed_day INTEGER NOT NULL, snapshot_json TEXT NOT NULL, PRIMARY KEY(career_id, edition_id)
  );`);
  const get = db.prepare('SELECT selected_day, request_json, snapshot_json FROM world_wbc_qualifier_host_candidates WHERE career_id=? AND edition_id=?');
  const getPolicy = db.prepare('SELECT policy_json FROM world_wbc_qualifier_candidate_policies WHERE career_id=? AND policy_version=?');
  const getHistory = db.prepare('SELECT edition_id, selected_day, completed_day, snapshot_json FROM world_wbc_qualifier_hosting_history WHERE career_id=? AND edition_id=?');
  const eligibleHistory = db.prepare(`SELECT edition_id, selected_day, completed_day, snapshot_json
    FROM world_wbc_qualifier_hosting_history WHERE career_id=? AND completed_day<=? AND completed_day>=?
    ORDER BY completed_day, edition_id`);
  const completed = (careerId: string, editionId: string): Hosting => {
    const evidence = sources.qualifiers.readEvidence(careerId, editionId);
    const accepted = sources.editions.readSnapshot(careerId, editionId);
    if (!evidence || !accepted || accepted.edition.editionId !== editionId || evidence.edition.editionId !== editionId
      || canonical(accepted.edition) !== canonical(evidence.edition)
      || evidence.semifinalResults.length !== 8 || evidence.finalResults.length !== 4 || evidence.outcome.winners.length !== 4) {
      throw new Error('qualifier hosting requires accepted Edition and twelve official Match results');
    }
    const selectedAtDay = accepted.source.selectionRequest.rankingAsOfDay, completedAtDay = accepted.edition.calendarWindow.endsOnDay;
    if (!day(selectedAtDay) || !day(completedAtDay) || selectedAtDay >= accepted.edition.calendarWindow.startsOnDay
      || completedAtDay < accepted.edition.calendarWindow.startsOnDay) throw new Error('invalid completed qualifier hosting calendar');
    const hosts = accepted.edition.pods.map((pod, index) => ({ venueId: pod.hostVenueId, nationId: pod.hostNationId,
      cityId: pod.hostCityId, regionId: accepted.hosting[index].selectedRegionId }));
    return freeze({ editionId, selectedAtDay, completedAtDay, hosts,
      sourceSnapshotId: `official-qualifier-hosting:${digest({ accepted, evidence })}` });
  };
  const priorHosting = (careerId: string, editionId: string, beforeDay: number, lookbackDays: number): readonly Hosting[] =>
    (eligibleHistory.all(careerId, beforeDay, Math.max(0, beforeDay - lookbackDays)) as HistoryRow[]).map((row) => {
      try {
        const saved = JSON.parse(row.snapshot_json) as Hosting;
        // Guard metadata before following the predecessor's Edition (and its own candidate owner).
        if (row.edition_id === editionId || !id(row.edition_id) || !day(row.selected_day)
          || row.selected_day >= beforeDay || !day(row.completed_day) || row.completed_day > beforeDay
          || row.completed_day <= row.selected_day || saved.editionId !== row.edition_id
          || saved.selectedAtDay !== row.selected_day || saved.completedAtDay !== row.completed_day
          || canonical(saved) !== row.snapshot_json) throw new Error('qualifier hosting predecessor metadata differs');
        const current = completed(careerId, row.edition_id);
        if (canonical(current) !== row.snapshot_json) throw new Error('qualifier hosting predecessor source differs');
        return current;
      } catch (cause) { throw new Error('corrupt qualifier hosting history', { cause }); }
    });
  const project = (request: WbcQualifierHostCandidateRequest): DurableWbcQualifierHostCandidates => {
    if (!request || ![request.careerId, request.qualifierEditionId, request.drawSeed, request.drawPolicyVersion].every(id)
      || !day(request.selectedAtDay)) throw new Error('invalid qualifier host candidate request');
    const policy = snapshotWbcQualifierHostCandidatePolicy(request.policy);
    const selection = sources.selection.readSelection(request.careerId, request.qualifierEditionId);
    const selectionRequest = sources.selection.readRequest(request.careerId, request.qualifierEditionId);
    if (!selection || selection.qualifierEditionId !== request.qualifierEditionId || !selectionRequest
      || selectionRequest.careerId !== request.careerId || selectionRequest.qualifierEditionId !== request.qualifierEditionId
      || selectionRequest.rankingAsOfDay !== request.selectedAtDay || !day(selectionRequest.eligibility?.asOfDay)
      || selectionRequest.eligibility.asOfDay > request.selectedAtDay
      || selectionRequest.eligibility.snapshotId !== selection.eligibilitySnapshotId) {
      throw new Error('qualifier host candidates require accepted pre-play selection');
    }
    const draw = drawWbcQualifierEntrantPods({ selection, drawSeed: request.drawSeed, drawPolicyVersion: request.drawPolicyVersion });
    const venues = sources.infrastructure.readVenues(request.careerId, request.selectedAtDay);
    if (venues.some((venue) => venue.careerId !== request.careerId)) throw new Error('qualifier host facilities differ from Career scope');
    const access = sources.access.readAccess(request.careerId, request.qualifierEditionId, draw.drawSnapshotId, request.selectedAtDay);
    const hostingHistory = priorHosting(request.careerId, request.qualifierEditionId, request.selectedAtDay, policy.rotation.lookbackDays);
    const candidates = deriveWbcQualifierHostCandidates({ policy, asOfDay: request.selectedAtDay,
      qualifierEditionId: request.qualifierEditionId, drawSnapshotId: draw.drawSnapshotId, venues, access, history: hostingHistory });
    const basis = cloneInert({ ...candidates, drawSnapshotId: draw.drawSnapshotId, policy,
      source: { selection, selectionRequest, venues, access, hostingHistory } });
    return freeze({ ...basis, snapshotId: `wbc-qualifier-host-candidates:${digest({ request, ...basis })}` });
  };
  const replay = (careerId: string, editionId: string, row: Row): DurableWbcQualifierHostCandidates => {
    try {
      const request = JSON.parse(row.request_json) as WbcQualifierHostCandidateRequest;
      const saved = JSON.parse(row.snapshot_json) as DurableWbcQualifierHostCandidates;
      const policy = getPolicy.get(careerId, request.policy.version) as { policy_json: string } | undefined;
      if (request.careerId !== careerId || request.qualifierEditionId !== editionId || row.selected_day !== request.selectedAtDay
        || canonical(request) !== row.request_json || canonical(saved) !== row.snapshot_json
        || !policy || policy.policy_json !== canonical(snapshotWbcQualifierHostCandidatePolicy(request.policy))) {
        throw new Error('qualifier candidate serialization or policy differs');
      }
      const current = project(request);
      if (canonical(current) !== row.snapshot_json) throw new Error('qualifier candidate source replay differs');
      return current;
    } catch (cause) { throw new Error('corrupt qualifier host candidates', { cause }); }
  };
  let closed = false;
  const scope = (careerId: string, editionId: string): void => {
    if (closed || ![careerId, editionId].every(id)) throw new Error('invalid qualifier host candidate scope');
  };
  return Object.freeze({
    initialize(raw: WbcQualifierHostCandidateRequest): DurableWbcQualifierHostCandidates {
      scope(raw?.careerId, raw?.qualifierEditionId); const request = cloneInert(raw);
      const existing = get.get(request.careerId, request.qualifierEditionId) as Row | undefined;
      if (existing) {
        const saved = replay(request.careerId, request.qualifierEditionId, existing);
        if (existing.request_json !== canonical(request)) throw new Error('qualifier host candidates are frozen differently');
        return saved;
      }
      const current = project(request), policyJson = canonical(current.policy);
      db.exec('BEGIN IMMEDIATE');
      try {
        const policy = getPolicy.get(request.careerId, current.policy.version) as { policy_json: string } | undefined;
        if (policy && policy.policy_json !== policyJson) throw new Error('qualifier candidate policy is frozen differently');
        const raced = get.get(request.careerId, request.qualifierEditionId) as Row | undefined;
        if (raced && (raced.request_json !== canonical(request) || raced.snapshot_json !== canonical(current)
          || raced.selected_day !== request.selectedAtDay)) throw new Error('qualifier host candidates are frozen differently');
        if (!policy) db.prepare('INSERT INTO world_wbc_qualifier_candidate_policies VALUES (?, ?, ?)')
          .run(request.careerId, current.policy.version, policyJson);
        if (!raced) db.prepare('INSERT INTO world_wbc_qualifier_host_candidates VALUES (?, ?, ?, ?, ?)')
          .run(request.careerId, request.qualifierEditionId, request.selectedAtDay, canonical(request), canonical(current));
        db.exec('COMMIT'); return current;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    readCandidates(careerId: string, editionId: string, beforeDay: number): DurableWbcQualifierHostCandidates | null {
      scope(careerId, editionId); if (!day(beforeDay)) throw new Error('invalid qualifier host candidate cutoff');
      const row = get.get(careerId, editionId) as Row | undefined;
      return row && row.selected_day === beforeDay ? replay(careerId, editionId, row) : null;
    },
    recordCompletedEdition(careerId: string, editionId: string): Hosting {
      scope(careerId, editionId); const projected = completed(careerId, editionId), json = canonical(projected);
      db.exec('BEGIN IMMEDIATE');
      try {
        const existing = getHistory.get(careerId, editionId) as HistoryRow | undefined;
        if (existing && (existing.snapshot_json !== json || existing.selected_day !== projected.selectedAtDay
          || existing.completed_day !== projected.completedAtDay)) throw new Error('qualifier hosting history is frozen differently');
        if (!existing) db.prepare('INSERT INTO world_wbc_qualifier_hosting_history VALUES (?, ?, ?, ?, ?)')
          .run(careerId, editionId, projected.selectedAtDay, projected.completedAtDay, json);
        db.exec('COMMIT'); return projected;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    close(): void { if (!closed) db.close(); closed = true; },
  });
};
