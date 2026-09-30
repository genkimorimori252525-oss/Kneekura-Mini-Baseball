import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { WbcQualifierEligibility } from '../../core/world/competition/WbcGlobalQualifierSelection';
import type { SqliteNationalCallupStore, NativeNationalEligibilityEvaluation } from './SqliteNationalCallupStore';
import type { SqliteNationalCompetitionSelectionStore, NationalCompetitionSelection } from './SqliteNationalCompetitionSelectionStore';
import type { SqliteNationCompetitionRegionStore } from './SqliteNationCompetitionRegionStore';

export type NationalRosterEligibilityPolicy = Readonly<{ version: string; minimumActivePlayers: number }>;
export type NationalRosterEligibilityRequest = Readonly<{
  careerId: string; editionId: string; asOfDay: number; candidateNationIds: readonly string[];
  policy: NationalRosterEligibilityPolicy;
}>;
export type DurableNationalRosterEligibility = Readonly<{
  input: NationalRosterEligibilityRequest; eligibility: WbcQualifierEligibility;
  source: Readonly<{ selection: NationalCompetitionSelection;
    candidates: readonly Readonly<{ nationId: string; region: string; rosterRevision: number; callupSnapshotIds: readonly string[];
      eligibilityEvidence: readonly Readonly<{ eventId: string; snapshotId: string; source: NativeNationalEligibilityEvaluation['source'] }>[] }>[] }>;
}>;
export type SqliteNationalRosterEligibilityStore = Readonly<{
  initialize(input: NationalRosterEligibilityRequest): DurableNationalRosterEligibility;
  readEligibility(careerId: string, snapshotId: string): WbcQualifierEligibility | null;
  readEligibilityForEdition(careerId: string, editionId: string, snapshotId: string): WbcQualifierEligibility | null;
  close(): void;
}>;
type Row = { edition_id: string; as_of_day: number; request_json: string; snapshot_json: string };
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const json = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

/** Country roster capability comes from accepted World Players; no region or rating grants eligibility. */
export const openSqliteNationalRosterEligibilityStore = (databasePath: string, sources: Readonly<{
  selections: Pick<SqliteNationalCompetitionSelectionStore, 'readSelection'>;
  nations: Pick<SqliteNationCompetitionRegionStore, 'readRegion'>;
  callups: Pick<SqliteNationalCallupStore, 'readRosterSnapshot' | 'readEligibilityAtDay' | 'readEligibilitySnapshot'>;
}>): SqliteNationalRosterEligibilityStore => {
  if (!id(databasePath)) throw new Error('invalid national roster eligibility database path');
  const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_national_roster_eligibility (
    career_id TEXT NOT NULL, snapshot_id TEXT NOT NULL, edition_id TEXT NOT NULL, as_of_day INTEGER NOT NULL,
    request_json TEXT NOT NULL, snapshot_json TEXT NOT NULL, PRIMARY KEY(career_id, snapshot_id)
  );`);
  let closed = false;
  const scope = (careerId: string, reference: string): void => {
    if (closed || !id(careerId) || !id(reference)) throw new Error('invalid national roster eligibility scope');
  };
  const project = (raw: NationalRosterEligibilityRequest, pins?: DurableNationalRosterEligibility['source']): DurableNationalRosterEligibility => {
    const input = cloneInert(raw);
    if (!input || Object.keys(input).sort().join('|') !== 'asOfDay|candidateNationIds|careerId|editionId|policy'
      || !id(input.careerId) || !id(input.editionId) || !day(input.asOfDay)
      || !Array.isArray(input.candidateNationIds) || input.candidateNationIds.some((nation) => !id(nation))
      || new Set(input.candidateNationIds).size !== input.candidateNationIds.length
      || !input.policy || Object.keys(input.policy).sort().join('|') !== 'minimumActivePlayers|version'
      || !id(input.policy.version) || !day(input.policy.minimumActivePlayers) || input.policy.minimumActivePlayers === 0) {
      throw new Error('invalid national roster eligibility request or policy');
    }
    const selection = sources.selections.readSelection(input.careerId, input.editionId);
    if (!selection || selection.editionId !== input.editionId || input.asOfDay > selection.qualificationCutoff.day) {
      throw new Error('national roster eligibility exceeds accepted qualification cutoff');
    }
    const candidates = input.candidateNationIds.map((nationId) => {
      const region = sources.nations.readRegion(input.careerId, nationId, input.asOfDay);
      if (!region || (selection.kind === 'REGIONAL_NATIONAL' && selection.region !== region)) throw new Error('national roster eligibility requires accepted Nation region');
      const pin = pins?.candidates.find((candidate) => candidate.nationId === nationId);
      if (pins && !pin) throw new Error('national roster eligibility candidate prefix is absent');
      const checkpoint = sources.callups.readRosterSnapshot(input.careerId, input.editionId, nationId, input.asOfDay, pin?.rosterRevision);
      const roster = checkpoint.roster;
      if (roster.some((entry) => entry.input.careerId !== input.careerId || entry.input.editionId !== input.editionId
        || entry.input.nationId !== nationId || entry.input.registeredAtDay > input.asOfDay || !entry.eligibility.eligible
        || entry.decision.registrationStatus !== 'ACTIVE') || new Set(roster.map((entry) => entry.input.playerId)).size !== roster.length) {
        throw new Error('national roster eligibility differs from accepted callups');
      }
      const evaluations = roster.map((entry) => {
        const prior = pin?.eligibilityEvidence.find((item) => item.eventId === entry.input.eventId);
        if (pin && !prior) throw new Error('national roster eligibility legal prefix is absent');
        const evaluation = prior ? sources.callups.readEligibilitySnapshot(input.careerId, entry.input.eventId, input.asOfDay, prior.source)
          : sources.callups.readEligibilityAtDay(input.careerId, entry.input.eventId, input.asOfDay);
        if (!evaluation) throw new Error('national roster eligibility legal evaluation is absent');
        return { entry, evaluation };
      });
      return { nationId, region, rosterRevision: checkpoint.revision,
        callupSnapshotIds: evaluations.filter((item) => item.evaluation.decision.eligible).map((item) => item.entry.snapshotId).sort(),
        eligibilityEvidence: evaluations.map((item) => ({ eventId: item.entry.input.eventId,
          snapshotId: item.evaluation.snapshotId, source: item.evaluation.source })) };
    });
    const source = { selection, candidates };
    const basis = { input, source };
    const eligibility = { snapshotId: `national-roster-eligibility:${createHash('sha256').update(json(basis)).digest('hex')}`,
      asOfDay: input.asOfDay, eligibleNationIds: candidates.filter((candidate) => candidate.callupSnapshotIds.length >= input.policy.minimumActivePlayers)
        .map((candidate) => candidate.nationId) };
    return freeze({ ...basis, eligibility });
  };
  const read = (careerId: string, snapshotId: string): DurableNationalRosterEligibility | null => {
    scope(careerId, snapshotId);
    const row = db.prepare(`SELECT edition_id, as_of_day, request_json, snapshot_json FROM world_national_roster_eligibility
      WHERE career_id=? AND snapshot_id=?`).get(careerId, snapshotId) as Row | undefined;
    if (!row) return null;
    try {
      const input = JSON.parse(row.request_json) as NationalRosterEligibilityRequest;
      const saved = JSON.parse(row.snapshot_json) as DurableNationalRosterEligibility;
      const expected = project(input, saved.source);
      if (input.careerId !== careerId || input.editionId !== row.edition_id || input.asOfDay !== row.as_of_day
        || json(input) !== row.request_json || expected.eligibility.snapshotId !== snapshotId
        || json(expected) !== row.snapshot_json) throw new Error('national roster eligibility replay differs');
      return expected;
    } catch (cause) { throw new Error(`corrupt national roster eligibility for ${careerId}`, { cause }); }
  };
  return Object.freeze({
    initialize(raw: NationalRosterEligibilityRequest): DurableNationalRosterEligibility {
      scope(raw?.careerId, raw?.editionId);
      const snapshot = project(raw);
      db.exec('BEGIN IMMEDIATE');
      try {
        const prior = db.prepare(`SELECT request_json FROM world_national_roster_eligibility
          WHERE career_id=? AND json_extract(request_json, '$.policy.version')=?`).all(raw.careerId, raw.policy.version) as { request_json: string }[];
        if (prior.some((row) => json((JSON.parse(row.request_json) as NationalRosterEligibilityRequest).policy) !== json(raw.policy))) {
          throw new Error('national roster eligibility policy version is frozen differently');
        }
        const existing = read(raw.careerId, snapshot.eligibility.snapshotId);
        if (existing) { db.exec('COMMIT'); return existing; }
        db.prepare(`INSERT INTO world_national_roster_eligibility
          (career_id, snapshot_id, edition_id, as_of_day, request_json, snapshot_json) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(raw.careerId, snapshot.eligibility.snapshotId, raw.editionId, raw.asOfDay, json(snapshot.input), json(snapshot));
        db.exec('COMMIT'); return snapshot;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    readEligibility(careerId: string, snapshotId: string): WbcQualifierEligibility | null {
      return read(careerId, snapshotId)?.eligibility ?? null;
    },
    readEligibilityForEdition(careerId: string, editionId: string, snapshotId: string): WbcQualifierEligibility | null {
      scope(careerId, editionId);
      const snapshot = read(careerId, snapshotId);
      return snapshot?.input.editionId === editionId ? snapshot.eligibility : null;
    },
    close(): void { if (!closed) db.close(); closed = true; },
  });
};
