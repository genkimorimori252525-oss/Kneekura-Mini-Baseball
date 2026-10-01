import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createCareerClubs, type CareerClubBundle, type CareerClubCreation } from '../../core/world/catalog';
import type { SqliteClubCatalogSnapshotStore } from './SqliteClubCatalogSnapshotStore';
import { ensureClubEventJournalSchema, initializeClubCheckpoint, readAcceptedClubHistory } from './SqliteClubEventJournal';
import { createCompetitionSourceReader, withCompetitionSourceReadPhase, withCompetitionSourceReadScope } from './CompetitionSourceReadScope';

export type CareerClubCreationRequest = Readonly<{ catalogSnapshotId: string; creation: CareerClubCreation }>;
export type DurableCareerClubCreation = Readonly<{
  snapshotId: string; version: 1; careerId: string; season: number; effectiveDay: number;
  catalogSnapshotId: string; requestDigest: string; clubIds: readonly string[];
  provenance: CareerClubBundle['provenance']; rivalryGraph: CareerClubBundle['rivalryGraph'];
  rivalryReferences: CareerClubBundle['rivalryReferences']; competitiveThreats: CareerClubBundle['competitiveThreats'];
}>;
export type SqliteCareerClubCreationStore = Readonly<{
  initialize(request: CareerClubCreationRequest): DurableCareerClubCreation;
  readSnapshot(careerId: string): DurableCareerClubCreation | null;
  close(): void;
}>;
type Row = { request_json: string; manifest_json: string };
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const json = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const digest = (value: unknown): string => createHash('sha256').update(json(value)).digest('hex');
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

/** All Club seeds and initial relations commit together, once per empty Career. */
export const openSqliteCareerClubCreationStore = (databasePath: string, sources: Readonly<{
  catalogs: Pick<SqliteClubCatalogSnapshotStore, 'readSnapshot'>;
}>): SqliteCareerClubCreationStore => {
  if (!id(databasePath)) throw new Error('invalid career Club creation database path');
  const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_club_heads (
    career_id TEXT NOT NULL, club_id TEXT NOT NULL, revision INTEGER NOT NULL, state_json TEXT NOT NULL,
    PRIMARY KEY(career_id, club_id)
  );
  CREATE TABLE IF NOT EXISTS world_career_club_creations (
    career_id TEXT PRIMARY KEY, request_json TEXT NOT NULL, manifest_json TEXT NOT NULL
  );`);
  ensureClubEventJournalSchema(db);
  const catalogReader = createCompetitionSourceReader(sources.catalogs.readSnapshot, sources.catalogs);
  let closed = false;
  const scope = (careerId: string): void => {
    if (closed) throw new Error('career Club creation store is closed');
    if (!id(careerId)) throw new Error('invalid career Club creation identity');
  };
  const row = (careerId: string): Row | undefined => db.prepare(
    'SELECT request_json, manifest_json FROM world_career_club_creations WHERE career_id=?').get(careerId) as Row | undefined;
  const project = (raw: CareerClubCreationRequest): Readonly<{ bundle: CareerClubBundle; manifest: DurableCareerClubCreation }> => {
    const request = cloneInert(raw);
    if (!request || typeof request !== 'object' || Array.isArray(request)
      || Object.keys(request).sort().join(',') !== 'catalogSnapshotId,creation' || !id(request.catalogSnapshotId)) {
      throw new Error('invalid career Club creation request');
    }
    const catalog = catalogReader(request.catalogSnapshotId);
    if (!catalog || catalog.snapshotId !== request.catalogSnapshotId) throw new Error('accepted Club catalog snapshot is missing or differs');
    const result = createCareerClubs(catalog.catalog, request.creation);
    if (!result.ok) throw new Error(`invalid career Club creation: ${result.reason.code}${result.reason.path ? ':' + result.reason.path : ''}`);
    const bundle = result.value;
    const basis = { version: 1 as const, careerId: bundle.careerId, season: bundle.season, effectiveDay: bundle.effectiveDay,
      catalogSnapshotId: request.catalogSnapshotId, requestDigest: digest(request), clubIds: bundle.clubs.map((club) => club.identity.clubId),
      provenance: bundle.provenance, rivalryGraph: bundle.rivalryGraph, rivalryReferences: bundle.rivalryReferences,
      competitiveThreats: bundle.competitiveThreats };
    return { bundle, manifest: freeze({ snapshotId: `career-club-creation:${digest(basis)}`, ...basis }) };
  };
  const replay = (careerId: string, stored: Row): DurableCareerClubCreation => {
    try {
      const request = JSON.parse(stored.request_json) as CareerClubCreationRequest;
      const manifest = JSON.parse(stored.manifest_json) as DurableCareerClubCreation;
      if (request.creation.context.careerId !== careerId || json(request) !== stored.request_json
        || json(manifest) !== stored.manifest_json) throw new Error('career Club creation metadata differs');
      const expected = project(request);
      if (json(expected.manifest) !== stored.manifest_json) throw new Error('career Club creation Source replay differs');
      for (const club of expected.bundle.clubs) {
        const history = readAcceptedClubHistory(db, careerId, club.identity.clubId);
        if (!history || json(history.checkpoint) !== json(club)) throw new Error('career Club creation initial checkpoint differs');
      }
      return expected.manifest;
    } catch (cause) { throw new Error(`corrupt career Club creation for ${careerId}`, { cause }); }
  };
  return Object.freeze({
    initialize(raw: CareerClubCreationRequest): DurableCareerClubCreation {
      return withCompetitionSourceReadPhase(() => {
        const request = cloneInert(raw);
        scope(request?.creation?.context?.careerId);
        db.exec('BEGIN IMMEDIATE');
        try {
          const careerId = request.creation.context.careerId, stored = row(careerId);
          if (stored) {
            const prior = replay(careerId, stored);
            if (json(request) !== stored.request_json) throw new Error('career Club creation is frozen differently');
            db.exec('COMMIT'); return prior;
          }
          // Caller CREATION flags cannot authorize a second initialization of actual persisted Clubs.
          if (db.prepare('SELECT 1 FROM world_club_heads WHERE career_id=? LIMIT 1').get(careerId)
            || db.prepare('SELECT 1 FROM world_club_checkpoints WHERE career_id=? LIMIT 1').get(careerId)) {
            throw new Error('Career already has Club state');
          }
          const { bundle, manifest } = project(request);
          const insert = db.prepare('INSERT INTO world_club_heads VALUES (?, ?, ?, ?)');
          for (const club of bundle.clubs) {
            insert.run(careerId, club.identity.clubId, club.revision, json(club));
            initializeClubCheckpoint(db, club);
          }
          db.prepare('INSERT INTO world_career_club_creations VALUES (?, ?, ?)').run(careerId, json(request), json(manifest));
          db.exec('COMMIT'); return manifest;
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      });
    },
    readSnapshot(careerId: string): DurableCareerClubCreation | null {
      return withCompetitionSourceReadScope(() => { scope(careerId); const stored = row(careerId); return stored ? replay(careerId, stored) : null; });
    },
    close(): void { if (!closed) db.close(); closed = true; },
  });
};
