import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { planWbcDirectBerths, type WbcBerthInput, type WbcBerthPolicy,
  type WbcBerthPolicyRegistry, type WbcDirectBerths } from '../../core/world/competition/WbcBerths';
import { buildWbcRegionalCoefficients, type OfficialWbcWorldEdition,
  type WbcRegionalCoefficientPolicy, type WbcRegionalCoefficientPolicyRegistry } from
  '../../core/world/competition/WbcRegionalCoefficients';
import type { ClubWorldRegion } from '../../core/world/competition/ClubWorldBerths';
import type { NationalCompetitionSelection, SqliteNationalCompetitionSelectionStore } from
  './SqliteNationalCompetitionSelectionStore';
import type { SqliteOfficialWbcHistoryStore } from './SqliteOfficialWbcHistoryStore';
import type { SqliteNationalQualificationHistoryStore } from './SqliteNationalQualificationHistoryStore';
import type { SqliteNationCompetitionRegionStore } from './SqliteNationCompetitionRegionStore';
import { openSqliteWbcRegionalCoefficientStore } from './SqliteWbcRegionalCoefficientStore';
import { openSqliteWbcDirectBerthStore } from './SqliteWbcDirectBerthStore';

const REGIONS: readonly ClubWorldRegion[] = ['ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
export type WbcWorldQualificationRequest = Readonly<{
  careerId: string;
  editionId: string;
  qualifierEditionId: string;
  coefficientPolicy: WbcRegionalCoefficientPolicy;
  coefficientRegistry: WbcRegionalCoefficientPolicyRegistry;
  berthPolicy: WbcBerthPolicy;
  berthRegistry: WbcBerthPolicyRegistry;
}>;
export type DurableWbcWorldQualification = Readonly<{
  snapshotId: string;
  selection: NationalCompetitionSelection;
  previousSelections: readonly NationalCompetitionSelection[];
  previousWorldEditions: readonly OfficialWbcWorldEdition[];
  regionalSelections: readonly NationalCompetitionSelection[];
  input: WbcBerthInput;
  direct: WbcDirectBerths;
}>;
export type SqliteWbcWorldQualificationStore = Readonly<{
  initialize(request: WbcWorldQualificationRequest): DurableWbcWorldQualification;
  readSnapshot(careerId: string, editionId: string): DurableWbcWorldQualification | null;
  readDirect(careerId: string, editionId: string): WbcDirectBerths | null;
  close(): void;
}>;
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(cloneInert(value),
  (_key, item: unknown) => item !== null && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const freezeSnapshot = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freezeSnapshot); Object.freeze(value);
  }
  return value;
};
type Row = { request_json: string; snapshot_json: string };

/** Derive source identities from World history; absent bootstrap evidence is never fabricated. */
export const openSqliteWbcWorldQualificationStore = (
  databasePath: string,
  sources: Readonly<{
    selections: Pick<SqliteNationalCompetitionSelectionStore, 'readSelection' | 'readWbcPredecessors'>;
    history: Pick<SqliteOfficialWbcHistoryStore, 'readEdition'>;
    regional: Pick<SqliteNationalQualificationHistoryStore, 'regionalAuthority'>;
    nations: Pick<SqliteNationCompetitionRegionStore, 'authority'>;
  }>,
): SqliteWbcWorldQualificationStore => {
  if (!id(databasePath)) throw new Error('invalid World WBC qualification database path');
  const sqlite: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_wbc_world_qualifications (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    request_json TEXT NOT NULL, snapshot_json TEXT NOT NULL,
    PRIMARY KEY (career_id, edition_id)
  );`);
  const coefficients = openSqliteWbcRegionalCoefficientStore(databasePath, { history: sources.history });
  const direct = openSqliteWbcDirectBerthStore(databasePath, { coefficients,
    regional: sources.regional, nations: sources.nations, editionCutoff: () => null,
    editionCutoffForCareer: (careerId, editionId) =>
      sources.selections.readSelection(careerId, editionId)?.qualificationCutoff ?? null });
  const get = db.prepare(`SELECT request_json, snapshot_json
    FROM world_wbc_world_qualifications WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): Row | null =>
    (get.get(careerId, editionId) as Row | undefined) ?? null;
  const project = (request: WbcWorldQualificationRequest) => {
    if (!id(request?.careerId) || !id(request.editionId) || !id(request.qualifierEditionId)) {
      throw new Error('invalid World WBC qualification request');
    }
    const selection = sources.selections.readSelection(request.careerId, request.editionId);
    if (!selection || selection.kind !== 'WBC' || selection.editionId !== request.editionId
      || !Number.isSafeInteger(selection.cycleOrdinal) || selection.cycleOrdinal < 2) {
      throw new Error('World WBC qualification requires two previous accepted WBC cycles');
    }
    const previousSelections = sources.selections.readWbcPredecessors(request.careerId, selection.cycleOrdinal);
    if (previousSelections.length !== 2 || previousSelections.some((past, index) =>
      past.kind !== 'WBC' || past.cycleOrdinal !== selection.cycleOrdinal - 2 + index
      || past.careerDayOne !== selection.careerDayOne
      || past.calendarWindow.endsOnDay >= selection.qualificationCutoff.day)) {
      throw new Error('World WBC qualification requires two previous accepted WBC cycles');
    }
    // Follow only accepted predecessor IDs, never the current or future WBC result source.
    const previousWorldEditions = previousSelections.map((past) => {
      const historical = sources.history.readEdition(request.careerId, past.editionId);
      if (!historical || historical.editionId !== past.editionId
        || historical.completedAtDay !== past.calendarWindow.endsOnDay) {
        throw new Error('World WBC qualification requires matching official predecessor history');
      }
      return historical;
    });
    const regionalAuthority = sources.regional.regionalAuthority(request.careerId);
    const placements = REGIONS.map((region) => {
      const placement = regionalAuthority.regionalChampionship(region, selection.qualificationCutoff.day);
      if (!placement || placement.region !== region) throw new Error('World WBC regional placement is missing');
      return placement;
    });
    const regionalSelections = placements.map((placement) => {
      const regional = sources.selections.readSelection(request.careerId, placement.editionId);
      if (!regional || regional.kind !== 'REGIONAL_NATIONAL' || regional.region !== placement.region
        || regional.editionId !== placement.editionId || regional.cycleOrdinal !== selection.cycleOrdinal
        || regional.careerDayOne !== selection.careerDayOne
        || regional.calendarWindow.endsOnDay !== placement.completedAtDay
        || placement.completedAtDay > selection.qualificationCutoff.day) {
        throw new Error('World WBC qualification requires the current accepted regional editions');
      }
      return regional;
    });
    const coefficientValues = buildWbcRegionalCoefficients(previousWorldEditions[0], previousWorldEditions[1],
      request.coefficientPolicy, request.coefficientRegistry);
    const input: WbcBerthInput = { editionId: request.editionId, qualifierEditionId: request.qualifierEditionId,
      cycleId: JSON.stringify(['world-wbc-cycle', request.careerId, selection.cycleOrdinal, selection.calendarPolicyVersion]),
      previousWorldEditionIds: previousSelections.map((past) => past.editionId),
      previousRegionalEditionIds: Object.fromEntries(placements.map((placement) =>
        [placement.region, placement.editionId])) as Record<ClubWorldRegion, string>,
      cutoffSnapshotId: selection.qualificationCutoff.snapshotId,
      coefficientPolicyVersion: request.coefficientPolicy.version,
      policy: request.berthPolicy, policyRegistry: request.berthRegistry };
    const expectedDirect = planWbcDirectBerths(input, {
      editionCutoff: () => selection.qualificationCutoff,
      regionalCoefficient: (region) => coefficientValues.find((item) => item.region === region) ?? null,
      regionalChampionship: (region) => placements.find((item) => item.region === region) ?? null,
      nationCompetitionRegion: sources.nations.authority(request.careerId).nationCompetitionRegion,
    });
    const basis = { selection, previousSelections, previousWorldEditions, regionalSelections,
      input, direct: expectedDirect };
    const snapshot = freezeSnapshot(cloneInert({ ...basis, snapshotId: `world-wbc-qualification:${
      createHash('sha256').update(canonicalJson({ request, ...basis })).digest('hex')}` }));
    return { snapshot, coefficientValues, coefficientRequest: { careerId: request.careerId,
      olderEditionId: previousSelections[0].editionId, newerEditionId: previousSelections[1].editionId,
      policy: request.coefficientPolicy, registry: request.coefficientRegistry } };
  };
  const replay = (careerId: string, editionId: string, stored: Row): DurableWbcWorldQualification => {
    try {
      const request = JSON.parse(stored.request_json) as WbcWorldQualificationRequest;
      const saved = JSON.parse(stored.snapshot_json) as DurableWbcWorldQualification;
      if (request.careerId !== careerId || request.editionId !== editionId
        || canonicalJson(request) !== stored.request_json || canonicalJson(saved) !== stored.snapshot_json) {
        throw new Error('World WBC qualification serialization differs');
      }
      const current = project(request);
      if (canonicalJson(current.snapshot) !== stored.snapshot_json
        || canonicalJson(coefficients.readSnapshot(careerId, current.coefficientRequest.newerEditionId))
          !== canonicalJson(current.coefficientValues)
        || canonicalJson(direct.readDirect(careerId, editionId)) !== canonicalJson(current.snapshot.direct)) {
        throw new Error('World WBC qualification source replay differs');
      }
      return current.snapshot;
    } catch (cause) { throw new Error(`corrupt World WBC qualification for ${careerId}`, { cause }); }
  };
  let closed = false;
  const assertScope = (careerId: string, editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) throw new Error('invalid World WBC qualification scope');
  };
  const readSnapshot = (careerId: string, editionId: string): DurableWbcWorldQualification | null => {
    assertScope(careerId, editionId);
    const saved = row(careerId, editionId); return saved ? replay(careerId, editionId, saved) : null;
  };
  return Object.freeze({
    initialize(rawRequest: WbcWorldQualificationRequest): DurableWbcWorldQualification {
      assertScope(rawRequest?.careerId, rawRequest?.editionId);
      const request = cloneInert(rawRequest), stored = row(request.careerId, request.editionId);
      if (stored) {
        const prior = replay(request.careerId, request.editionId, stored);
        if (canonicalJson(request) !== stored.request_json) throw new Error('World WBC qualification is frozen differently');
        return prior;
      }
      const current = project(request); // Validate all sources/policies before any component writes.
      coefficients.initialize(current.coefficientRequest);
      const accepted = direct.initialize({ careerId: request.careerId, input: current.snapshot.input });
      if (canonicalJson(accepted) !== canonicalJson(current.snapshot.direct)) throw new Error('World WBC direct source differs');
      db.exec('BEGIN IMMEDIATE');
      try {
        const raced = row(request.careerId, request.editionId);
        if (raced) {
          if (raced.request_json !== canonicalJson(request) || raced.snapshot_json !== canonicalJson(current.snapshot)) {
            throw new Error('World WBC qualification is frozen differently');
          }
        } else {
          db.prepare(`INSERT INTO world_wbc_world_qualifications
            (career_id, edition_id, request_json, snapshot_json) VALUES (?, ?, ?, ?)`)
            .run(request.careerId, request.editionId, canonicalJson(request), canonicalJson(current.snapshot));
        }
        db.exec('COMMIT'); return current.snapshot;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    readSnapshot,
    readDirect(careerId: string, editionId: string): WbcDirectBerths | null {
      return readSnapshot(careerId, editionId)?.direct ?? null;
    },
    close(): void { if (!closed) { direct.close(); coefficients.close(); db.close(); } closed = true; },
  });
};
