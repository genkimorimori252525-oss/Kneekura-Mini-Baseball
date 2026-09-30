import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { deriveRegionalNationalHostCandidates, snapshotRegionalNationalHostPolicy,
  type RegionalNationalHostPolicy, type RegionalNationalHostCandidates,
  type CompletedRegionalNationalHosting } from '../../core/world/competition/RegionalNationalHosting';
import type { ClubWorldRegion } from '../../core/world/competition/ClubWorldBerths';
import type { RegionalNationalEdition } from '../../core/world/competition/RegionalNationalGroups';
import { assertRegionalNationalKnockoutEdition, type RegionalNationalKnockoutEdition } from '../../core/world/competition/RegionalNationalKnockout';
import type { WorldNationalRankingHistory } from '../../core/world/competition/WorldNationalRankingHistory';
import type { AcceptedHostVenue, SqliteWorldHostInfrastructureStore } from './SqliteWorldHostInfrastructureStore';
import type { NationalCompetitionSelection, SqliteNationalCompetitionSelectionStore } from './SqliteNationalCompetitionSelectionStore';
import type { SqliteNationCompetitionRegionStore } from './SqliteNationCompetitionRegionStore';
import type { SqliteWorldNationalRankingHistoryStore } from './SqliteWorldNationalRankingHistoryStore';
import { createCompetitionSourceReader, withCompetitionSourceReadScope, withCompetitionSourceReadPhase } from './CompetitionSourceReadScope';

export type RegionalNationalHostCandidateRequest = Readonly<{ careerId: string; editionId: string; policy: RegionalNationalHostPolicy }>;
export type DurableRegionalNationalHostCandidates = RegionalNationalHostCandidates & Readonly<{
  snapshotId: string;
  source: Readonly<{ selection: NationalCompetitionSelection; venues: readonly AcceptedHostVenue[];
    nationRegions: readonly Readonly<{ nationId: string; region: ClubWorldRegion }>[];
    hostingHistory: readonly CompletedRegionalNationalHosting[];
    previousEditions: readonly Readonly<{ selection: NationalCompetitionSelection; edition: RegionalNationalEdition;
      knockoutEdition: RegionalNationalKnockoutEdition; venues: readonly AcceptedHostVenue[];
      official: WorldNationalRankingHistory['editions'][number] }>[] }>;
}>;
export type SqliteRegionalNationalHostCandidateStore = Readonly<{
  initialize(request: RegionalNationalHostCandidateRequest): DurableRegionalNationalHostCandidates;
  readCandidates(careerId: string, editionId: string, beforeDay: number): DurableRegionalNationalHostCandidates | null;
  close(): void;
}>;
type Row = { request_json: string; snapshot_json: string };
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const json = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const digest = (value: unknown): string => createHash('sha256').update(json(value)).digest('hex');
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

/** Organizer authority is independent of entry qualification; predecessor cutoffs keep replay acyclic. */
export const openSqliteRegionalNationalHostCandidateStore = (databasePath: string, sources: Readonly<{
  selections: Pick<SqliteNationalCompetitionSelectionStore, 'readSelection'>;
  nations: Pick<SqliteNationCompetitionRegionStore, 'readRegion'>;
  infrastructure: Pick<SqliteWorldHostInfrastructureStore, 'readVenues'>;
  history: Pick<SqliteWorldNationalRankingHistoryStore, 'readHistory' | 'readRegionalHostingEdition'>;
}>): SqliteRegionalNationalHostCandidateStore => {
  if (!id(databasePath)) throw new Error('invalid regional host candidate database path');
  const readSelection = createCompetitionSourceReader(sources.selections.readSelection, sources.selections);
  const readRegion = createCompetitionSourceReader(sources.nations.readRegion, sources.nations);
  const readVenues = createCompetitionSourceReader(sources.infrastructure.readVenues, sources.infrastructure);
  const readHistory = createCompetitionSourceReader<[string, number], WorldNationalRankingHistory>(sources.history.readHistory, sources.history);
  const readEdition = createCompetitionSourceReader(sources.history.readRegionalHostingEdition, sources.history);
  const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_regional_national_host_candidates (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL, request_json TEXT NOT NULL, snapshot_json TEXT NOT NULL,
    PRIMARY KEY(career_id, edition_id)
  ); CREATE TABLE IF NOT EXISTS world_regional_national_host_policies (
    career_id TEXT NOT NULL, policy_version TEXT NOT NULL, policy_json TEXT NOT NULL,
    PRIMARY KEY(career_id, policy_version)
  );`);
  let closed = false;
  const scope = (careerId: string, editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) throw new Error('invalid regional host candidate scope');
  };
  const row = (careerId: string, editionId: string): Row | undefined => db.prepare(
    'SELECT request_json, snapshot_json FROM world_regional_national_host_candidates WHERE career_id=? AND edition_id=?')
    .get(careerId, editionId) as Row | undefined;
  const project = (request: RegionalNationalHostCandidateRequest): DurableRegionalNationalHostCandidates => {
    if (!request || Object.keys(request).sort().join('|') !== 'careerId|editionId|policy'
      || !id(request.careerId) || !id(request.editionId)) throw new Error('invalid regional host candidate request');
    const policy = snapshotRegionalNationalHostPolicy(request.policy);
    const selection = readSelection(request.careerId, request.editionId);
    if (!selection || selection.kind !== 'REGIONAL_NATIONAL' || !selection.region || selection.editionId !== request.editionId
      || !day(selection.qualificationCutoff.day) || selection.qualificationCutoff.day >= selection.calendarWindow.startsOnDay) {
      throw new Error('regional host candidates require accepted World selection and cutoff');
    }
    const asOfDay = selection.qualificationCutoff.day;
    const venues = readVenues(request.careerId, asOfDay);
    if (venues.some((venue) => venue.careerId !== request.careerId)) throw new Error('regional host infrastructure differs from Career');
    const nationRegions = [...new Set(venues.map((venue) => venue.nationId))].sort().map((nationId) => {
      const region = readRegion(request.careerId, nationId, asOfDay);
      if (!region) throw new Error('regional host lacks cutoff Nation membership');
      return { nationId, region };
    });
    const history = readHistory(request.careerId, asOfDay);
    const previousEditions: DurableRegionalNationalHostCandidates['source']['previousEditions'][number][] = [];
    const hostingHistory: CompletedRegionalNationalHosting[] = [];
    for (const official of history.editions.filter((entry) => entry.tier === 'REGIONAL'
      && entry.completedAtDay <= asOfDay && entry.completedAtDay >= Math.max(0, asOfDay - policy.rotation.lookbackDays))) {
      const previous = readSelection(request.careerId, official.editionId);
      if (!previous || previous.kind !== 'REGIONAL_NATIONAL' || previous.editionId !== official.editionId) {
        throw new Error('regional hosting history lacks an accepted predecessor');
      }
      if (previous.region !== selection.region) continue;
      // Do not follow a current/later Edition back into its own candidate or draw Source.
      if (official.editionId === request.editionId || previous.qualificationCutoff.day >= asOfDay
        || official.completedAtDay !== previous.calendarWindow.endsOnDay
        || previous.calendarWindow.startsOnDay <= previous.qualificationCutoff.day) {
        throw new Error('regional hosting history lacks an accepted completed predecessor at cutoff');
      }
      const metadata = readEdition(request.careerId, official.editionId, asOfDay);
      const edition = metadata?.edition, knockoutEdition = metadata?.knockoutEdition;
      if (!edition || edition.editionId !== official.editionId || edition.region !== selection.region
        || json(edition.calendarWindow) !== json(previous.calendarWindow)) throw new Error('regional hosting history lacks accepted predecessor Edition metadata');
      if (!knockoutEdition) throw new Error('regional hosting history lacks knockout Edition metadata');
      assertRegionalNationalKnockoutEdition(edition, edition.groups.length === 2 ? 4 : 8, knockoutEdition);
      const usedIds = [...new Set([...edition.groups.map((group) => group.hostVenueId),
        ...knockoutEdition.openingVenueIds, ...knockoutEdition.semifinalVenueIds, knockoutEdition.finalVenueId])];
      const historicalVenues = readVenues(request.careerId, previous.qualificationCutoff.day);
      const usedVenues = usedIds.map((venueId) => {
        const venue = historicalVenues.find((item) => item.venueId === venueId);
        if (!venue || venue.careerId !== request.careerId || venue.region !== edition.region
          || !edition.hostNationIds.includes(venue.nationId) || edition.groups.some((group) => group.hostVenueId === venueId
            && (group.hostNationId !== venue.nationId || group.hostCityId !== venue.cityId))) {
          throw new Error('regional hosting history lacks accepted historical venue identity');
        }
        return venue;
      });
      const proof = { selection: previous, edition, knockoutEdition, venues: usedVenues, official };
      previousEditions.push(proof);
      const hosts = new Map<string, CompletedRegionalNationalHosting['hosts'][number]>();
      for (const venue of usedVenues) hosts.set(venue.venueId, { venueId: venue.venueId,
        nationId: venue.nationId, cityId: venue.cityId, regionId: edition.region });
      hostingHistory.push({ editionId: official.editionId, region: edition.region, completedAtDay: official.completedAtDay,
        sourceSnapshotId: digest(proof), hosts: [...hosts.values()] });
    }
    const candidates = deriveRegionalNationalHostCandidates({ region: selection.region, asOfDay, policy, venues, nationRegions, history: hostingHistory });
    const basis = { ...candidates, source: { selection, venues, nationRegions, hostingHistory, previousEditions } };
    return freeze(cloneInert({ snapshotId: `regional-national-host-candidates:${digest(basis)}`, ...basis }));
  };
  const replay = (careerId: string, editionId: string, stored: Row): DurableRegionalNationalHostCandidates => {
    try {
      const request = JSON.parse(stored.request_json) as RegionalNationalHostCandidateRequest;
      const saved = JSON.parse(stored.snapshot_json) as DurableRegionalNationalHostCandidates;
      const policy = db.prepare('SELECT policy_json FROM world_regional_national_host_policies WHERE career_id=? AND policy_version=?')
        .get(careerId, request.policy.version) as { policy_json: string } | undefined;
      if (request.careerId !== careerId || request.editionId !== editionId || json(request) !== stored.request_json
        || json(saved) !== stored.snapshot_json || !policy || policy.policy_json !== json(request.policy)) throw new Error('regional hosting metadata or policy differs');
      const expected = project(request);
      if (json(expected) !== stored.snapshot_json) throw new Error('regional hosting Source replay differs');
      return expected;
    } catch (cause) { throw new Error(`corrupt regional national host candidates for ${careerId}`, { cause }); }
  };
  return Object.freeze({
    initialize(raw: RegionalNationalHostCandidateRequest): DurableRegionalNationalHostCandidates {
      return withCompetitionSourceReadPhase(() => {
        scope(raw?.careerId, raw?.editionId);
        const request = cloneInert(raw);
        db.exec('BEGIN IMMEDIATE');
        try {
          const stored = row(request.careerId, request.editionId);
          if (stored) {
            const prior = replay(request.careerId, request.editionId, stored);
            if (json(request) !== stored.request_json) throw new Error('regional host candidates are frozen differently');
            db.exec('COMMIT'); return prior;
          }
          const snapshot = project(request);
          const policy = db.prepare('SELECT policy_json FROM world_regional_national_host_policies WHERE career_id=? AND policy_version=?')
            .get(request.careerId, request.policy.version) as { policy_json: string } | undefined;
          if (policy && policy.policy_json !== json(request.policy)) throw new Error('regional host policy is frozen differently');
          if (!policy) db.prepare('INSERT INTO world_regional_national_host_policies VALUES (?, ?, ?)')
            .run(request.careerId, request.policy.version, json(request.policy));
          db.prepare('INSERT INTO world_regional_national_host_candidates VALUES (?, ?, ?, ?)')
            .run(request.careerId, request.editionId, json(request), json(snapshot));
          db.exec('COMMIT'); return snapshot;
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      });
    },
    readCandidates(careerId: string, editionId: string, beforeDay: number): DurableRegionalNationalHostCandidates | null {
      return withCompetitionSourceReadScope(() => {
        scope(careerId, editionId);
        if (!day(beforeDay)) throw new Error('invalid regional host cutoff');
        const stored = row(careerId, editionId);
        if (!stored) return null;
        const snapshot = replay(careerId, editionId, stored);
        if (snapshot.asOfDay !== beforeDay) throw new Error('regional host cutoff differs');
        return snapshot;
      });
    },
    close() { if (!closed) db.close(); closed = true; },
  });
};
