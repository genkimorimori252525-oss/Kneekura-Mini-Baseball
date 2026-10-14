import type { DatabaseSync } from 'node:sqlite';
import { createCompetitionSourceReader } from './CompetitionSourceReadScope';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { deriveNationalHostCandidates, snapshotNationalHostCandidatePolicy,
  type NationalHostCandidatePolicy, type CompletedNationalHosting } from
  '../../core/world/competition/CompetitionHostInfrastructure';
import type { NationalHostCandidateSnapshot, SqliteNationalCompetitionEditionStore } from
  './SqliteNationalCompetitionEditionStore';
import type { SqliteNationalCompetitionSelectionStore, NationalCompetitionSelection } from
  './SqliteNationalCompetitionSelectionStore';
import type { SqliteWorldNationalRankingHistoryStore } from './SqliteWorldNationalRankingHistoryStore';
import type { AcceptedHostVenue, SqliteWorldHostInfrastructureStore } from './SqliteWorldHostInfrastructureStore';

export type NationalHostCandidateRequest = Readonly<{
  careerId: string; editionId: string; policy: NationalHostCandidatePolicy;
}>;
export type DurableNationalHostCandidates = NationalHostCandidateSnapshot & Readonly<{
  policy: NationalHostCandidatePolicy;
  source: Readonly<{ selection: NationalCompetitionSelection;
    venues: readonly AcceptedHostVenue[]; hostingHistory: readonly CompletedNationalHosting[] }>;
}>;
export type SqliteNationalHostCandidateStore = Readonly<{
  initialize(request: NationalHostCandidateRequest): DurableNationalHostCandidates;
  readCandidates(careerId: string, editionId: string, beforeDay: number): DurableNationalHostCandidates | null;
  close(): void;
}>;
export type NationalHostCandidateSources = Readonly<{
  selections: Pick<SqliteNationalCompetitionSelectionStore, 'readSelection'>;
  infrastructure: Pick<SqliteWorldHostInfrastructureStore, 'readVenues'>;
  history: Pick<SqliteWorldNationalRankingHistoryStore, 'readHistory'>;
  editions: Pick<SqliteNationalCompetitionEditionStore, 'readSnapshot'>;
}>;
type Row = { request_json: string; snapshot_json: string };
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0
  && value === value.trim();
const day = (value: unknown): value is number => typeof value === 'number'
  && Number.isSafeInteger(value) && value >= 0;
const canonicalJson = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) =>
  item !== null && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const digest = (value: unknown): string => createHash('sha256').update(canonicalJson(value)).digest('hex');
const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

/** Organizer-only candidate generation from historical facilities and completed official editions. */
const createSqliteNationalHostCandidateStore = (
  databasePath: string | DatabaseSync, sources: NationalHostCandidateSources,
): SqliteNationalHostCandidateStore => {
  if (typeof databasePath === 'string' && !id(databasePath)) throw new Error('invalid national host candidate database path');
  const readSelection = createCompetitionSourceReader(sources.selections.readSelection, sources.selections);
  const readVenues = createCompetitionSourceReader(sources.infrastructure.readVenues, sources.infrastructure);
  const readHistory = createCompetitionSourceReader<[string, number], ReturnType<typeof sources.history.readHistory>>(sources.history.readHistory, sources.history);
  const readSnapshot = createCompetitionSourceReader(sources.editions.readSnapshot, sources.editions);
  const sqlite: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const borrowed = typeof databasePath !== 'string';
  const db = borrowed ? databasePath : new sqlite.DatabaseSync(databasePath);
  if (!(db instanceof sqlite.DatabaseSync)) throw new Error('National evidence requires a Native connection');
  if (!borrowed) {
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_national_host_candidate_policies (
    career_id TEXT NOT NULL, policy_version TEXT NOT NULL, policy_json TEXT NOT NULL,
    PRIMARY KEY (career_id, policy_version)
  );
  CREATE TABLE IF NOT EXISTS world_national_host_candidates (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL, request_json TEXT NOT NULL, snapshot_json TEXT NOT NULL,
    PRIMARY KEY (career_id, edition_id)
  );`);
  }
  const get = db.prepare(`SELECT request_json, snapshot_json FROM world_national_host_candidates
    WHERE career_id=? AND edition_id=?`);
  const getPolicy = db.prepare(`SELECT policy_json FROM world_national_host_candidate_policies
    WHERE career_id=? AND policy_version=?`);
  const row = (careerId: string, editionId: string): Row | null =>
    (get.get(careerId, editionId) as Row | undefined) ?? null;
  const project = (request: NationalHostCandidateRequest): DurableNationalHostCandidates => {
    if (!request || !id(request.careerId) || !id(request.editionId)) throw new Error('invalid national hosting request');
    const policy = snapshotNationalHostCandidatePolicy(request.policy);
    const selection = readSelection(request.careerId, request.editionId);
    if (!selection || selection.editionId !== request.editionId || selection.kind !== policy.kind
      || !day(selection.qualificationCutoff.day)
      || selection.qualificationCutoff.day >= selection.calendarWindow.startsOnDay) {
      throw new Error('host candidates require accepted World selection and cutoff');
    }
    const asOfDay = selection.qualificationCutoff.day;
    const venues = readVenues(request.careerId, asOfDay);
    if (venues.some((venue) => venue.careerId !== request.careerId)) {
      throw new Error('host candidate infrastructure differs from Career scope');
    }
    const history = readHistory(request.careerId, asOfDay);
    const hostingHistory: CompletedNationalHosting[] = history.editions.filter((entry) =>
      entry.tier === policy.kind && entry.completedAtDay >= Math.max(0, asOfDay - policy.rotation.lookbackDays))
      .map((entry) => {
        // Check the predecessor cutoff before following its Edition owner to keep replay acyclic.
        const predecessor = readSelection(request.careerId, entry.editionId);
        if (entry.editionId === request.editionId || !predecessor || predecessor.kind !== policy.kind
          || !day(predecessor.qualificationCutoff.day) || predecessor.qualificationCutoff.day >= asOfDay
          || entry.completedAtDay > asOfDay || entry.completedAtDay < predecessor.calendarWindow.startsOnDay
          || entry.completedAtDay > predecessor.calendarWindow.endsOnDay) {
          throw new Error('hosting history lacks an accepted completed predecessor at cutoff');
        }
        const snapshot = readSnapshot(request.careerId, entry.editionId);
        if (!snapshot || snapshot.kind !== policy.kind || snapshot.edition.editionId !== entry.editionId
          || canonicalJson(snapshot.source.draw.source.selection) !== canonicalJson(predecessor)) {
          throw new Error('hosting history lacks accepted predecessor Edition');
        }
        const unique = new Map<string, CompletedNationalHosting['hosts'][number]>();
        for (const host of [...snapshot.hosting.groupHosts, ...snapshot.hosting.knockoutHubs,
          snapshot.hosting.finalFourHost]) {
          unique.set(host.selectedVenueId, { venueId: host.selectedVenueId, nationId: host.selectedNationId,
            cityId: host.selectedCityId, regionId: host.selectedRegionId });
        }
        return { editionId: entry.editionId, kind: policy.kind, completedAtDay: entry.completedAtDay,
          sourceSnapshotId: digest({ officialEdition: entry, acceptedEdition: snapshot }),
          hosts: [...unique.values()] };
      });
    const projected = deriveNationalHostCandidates({ policy, asOfDay, venues, history: hostingHistory });
    const basis = { ...projected, asOfDay, policy,
      source: { selection: cloneInert(selection), venues: cloneInert(venues), hostingHistory } };
    return freeze({ snapshotId: `national-host-candidates:${digest(basis)}`, ...basis });
  };
  const parse = (careerId: string, editionId: string, stored: Row): DurableNationalHostCandidates => {
    try {
      const request = JSON.parse(stored.request_json) as NationalHostCandidateRequest;
      const snapshot = JSON.parse(stored.snapshot_json) as DurableNationalHostCandidates;
      const policy = getPolicy.get(careerId, request.policy.version) as { policy_json: string } | undefined;
      if (!policy || policy.policy_json !== canonicalJson(snapshotNationalHostCandidatePolicy(request.policy))) {
        throw new Error('host candidate policy differs');
      }
      const replayed = project(request);
      if (request.careerId !== careerId || request.editionId !== editionId
        || canonicalJson(request) !== stored.request_json || canonicalJson(snapshot) !== stored.snapshot_json
        || canonicalJson(replayed) !== stored.snapshot_json) throw new Error('host candidate replay differs');
      return replayed;
    } catch (cause) { throw new Error(`corrupt national host candidates for ${careerId}`, { cause }); }
  };
  let closed = false;
  return Object.freeze({
    initialize(rawRequest: NationalHostCandidateRequest): DurableNationalHostCandidates {
      if (closed) throw new Error('national host candidate store is closed');
      const request = cloneInert(rawRequest);
      const snapshot = project(request);
      const requestJson = canonicalJson(request);
      const policyJson = canonicalJson(snapshot.policy);
      db.exec('BEGIN IMMEDIATE');
      try {
        const policy = getPolicy.get(request.careerId, snapshot.policy.version) as { policy_json: string } | undefined;
        if (policy && policy.policy_json !== policyJson) throw new Error('host candidate policy is already frozen differently');
        const stored = row(request.careerId, request.editionId);
        if (stored) {
          const prior = parse(request.careerId, request.editionId, stored);
          if (requestJson !== stored.request_json) throw new Error('host candidates are already frozen differently');
          db.exec('COMMIT');
          return prior;
        }
        if (!policy) db.prepare(`INSERT INTO world_national_host_candidate_policies
          (career_id, policy_version, policy_json) VALUES (?, ?, ?)`)
          .run(request.careerId, snapshot.policy.version, policyJson);
        db.prepare(`INSERT INTO world_national_host_candidates
          (career_id, edition_id, request_json, snapshot_json) VALUES (?, ?, ?, ?)`)
          .run(request.careerId, request.editionId, requestJson, canonicalJson(snapshot));
        db.exec('COMMIT');
        return snapshot;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    readCandidates(careerId: string, editionId: string, beforeDay: number): DurableNationalHostCandidates | null {
      if (closed || !id(careerId) || !id(editionId) || !day(beforeDay)) throw new Error('invalid national host candidate scope');
      const stored = row(careerId, editionId);
      if (!stored) return null;
      const snapshot = parse(careerId, editionId, stored);
      if (snapshot.asOfDay !== beforeDay) throw new Error('national host candidate cutoff differs');
      return snapshot;
    },
    close(): void { if (!closed && !borrowed) db.close(); closed = true; },
  });
};

/** Existing path facade retains connection/schema ownership. */
export const openSqliteNationalHostCandidateStore = (databasePath: string, sources: Parameters<typeof createSqliteNationalHostCandidateStore>[1]): SqliteNationalHostCandidateStore =>
  createSqliteNationalHostCandidateStore(databasePath, sources);

/** Same owner replay on a consuming Native connection; only read capabilities escape. */
export const nationalHostCandidateEvidenceFromSqlite = (db: DatabaseSync, sources: Parameters<typeof createSqliteNationalHostCandidateStore>[1]): Pick<SqliteNationalHostCandidateStore, 'readCandidates'> => {
  const owner = createSqliteNationalHostCandidateStore(db, sources);
  return Object.freeze({ readCandidates: owner.readCandidates });
};
