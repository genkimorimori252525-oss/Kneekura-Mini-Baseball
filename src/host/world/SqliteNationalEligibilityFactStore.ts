import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { snapshotNationalEligibilityFact, type NationalEligibilityFact } from '../../core/world/competition/NationalEligibility';
import type { SqlitePlayerPersonLinkStore, DurablePlayerPersonLink } from './SqlitePlayerPersonLinkStore';
import type { SqliteNationCompetitionRegionStore } from './SqliteNationCompetitionRegionStore';

export type NationalEligibilityFactRequest = Readonly<{
  careerId: string; personLinkSourceId: string; active: boolean; fact: NationalEligibilityFact;
}>;
export type DurableNationalEligibilityFact = Readonly<{
  revision: number; previousSnapshotId: string | null; snapshotId: string;
  input: NationalEligibilityFactRequest;
  source: Readonly<{ personLink: DurablePlayerPersonLink; nationRegion: string }>;
}>;
export type NationalEligibilityFactsSnapshot = Readonly<{
  careerId: string; playerId: string; asOfDay: number; snapshotId: string;
  facts: readonly NationalEligibilityFact[];
}>;
export type SqliteNationalEligibilityFactStore = Readonly<{
  record(input: NationalEligibilityFactRequest): DurableNationalEligibilityFact;
  readFacts(careerId: string, playerId: string, beforeDay: number): NationalEligibilityFactsSnapshot | null;
  readFactsSnapshot(careerId: string, playerId: string, snapshotId: string, beforeDay: number): NationalEligibilityFactsSnapshot | null;
  close(): void;
}>;
type Row = { revision: number; snapshot_id: string; evidence_id: string; effective_from_day: number; entry_json: string };
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const json = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const digest = (value: unknown): string => `national-eligibility-facts:${createHash('sha256').update(json(value)).digest('hex')}`;
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

/** Accepted legal facts are World evidence; they never alter Club affiliation or ability. */
const createSqliteNationalEligibilityFactStore = (databasePath: string | DatabaseSync, sources: Readonly<{
  personLinks: Pick<SqlitePlayerPersonLinkStore, 'readLink'>;
  nations: Pick<SqliteNationCompetitionRegionStore, 'readRegion'>;
}>): SqliteNationalEligibilityFactStore => {
  if (typeof databasePath === 'string' && !id(databasePath)) throw new Error('invalid national eligibility database path');
  const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const borrowed = typeof databasePath !== 'string';
  const db = borrowed ? databasePath : new DatabaseSync(databasePath);
  if (!(db instanceof DatabaseSync)) throw new Error('National evidence requires a Native connection');
  if (!borrowed) {
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_national_eligibility_facts (
    career_id TEXT NOT NULL, player_id TEXT NOT NULL, revision INTEGER NOT NULL,
    evidence_id TEXT NOT NULL, effective_from_day INTEGER NOT NULL, snapshot_id TEXT NOT NULL, entry_json TEXT NOT NULL,
    PRIMARY KEY(career_id, player_id, revision), UNIQUE(career_id, evidence_id), UNIQUE(career_id, snapshot_id)
  );`);
  }
  const rows = db.prepare(`SELECT revision, snapshot_id, evidence_id, effective_from_day, entry_json
    FROM world_national_eligibility_facts WHERE career_id=? AND player_id=? AND effective_from_day<=? AND revision<=? ORDER BY revision`);
  let closed = false;
  const scope = (careerId: string, playerId: string, beforeDay: number): void => {
    if (closed || !id(careerId) || !id(playerId) || !day(beforeDay)) throw new Error('invalid national eligibility fact scope');
  };
  const project = (raw: NationalEligibilityFactRequest, revision: number, previousSnapshotId: string | null): DurableNationalEligibilityFact => {
    const input = cloneInert(raw);
    const fact = snapshotNationalEligibilityFact(input?.fact);
    if (!id(input.careerId) || !id(input.personLinkSourceId) || typeof input.active !== 'boolean'
      || Object.keys(input).sort().join('|') !== 'active|careerId|fact|personLinkSourceId') {
      throw new Error('invalid national eligibility fact request');
    }
    const link = sources.personLinks.readLink(input.personLinkSourceId);
    if (!link || link.careerId !== input.careerId || link.playerId !== fact.playerId || link.personId !== fact.personId
      || link.acceptedAtDay > fact.effectiveFromDay) throw new Error('national eligibility fact identity differs');
    const nationRegion = sources.nations.readRegion(input.careerId, fact.nationId, fact.effectiveFromDay);
    if (!nationRegion) throw new Error('national eligibility fact requires accepted Nation');
    const basis = { revision, previousSnapshotId, input, source: { personLink: cloneInert(link), nationRegion } };
    return freeze({ ...basis, snapshotId: digest(basis) });
  };
  const replay = (careerId: string, playerId: string, beforeDay: number, beforeRevision = Number.MAX_SAFE_INTEGER): DurableNationalEligibilityFact[] => {
    try {
      const history: DurableNationalEligibilityFact[] = [];
      for (const row of rows.all(careerId, playerId, beforeDay, beforeRevision) as Row[]) {
        const saved = JSON.parse(row.entry_json) as DurableNationalEligibilityFact;
        if (row.revision !== history.length + 1 || saved.input.careerId !== careerId || saved.input.fact.playerId !== playerId
          || saved.input.fact.evidenceId !== row.evidence_id || saved.input.fact.effectiveFromDay !== row.effective_from_day
          || saved.snapshotId !== row.snapshot_id
          || json(saved) !== row.entry_json) throw new Error('national eligibility fact metadata differs');
        const previous = history.at(-1);
        if (previous && saved.input.fact.effectiveFromDay < previous.input.fact.effectiveFromDay) throw new Error('national eligibility chronology differs');
        const expected = project(saved.input, row.revision, previous?.snapshotId ?? null);
        if (json(expected) !== row.entry_json) throw new Error('national eligibility fact replay differs');
        history.push(expected);
      }
      return history;
    } catch (cause) { throw new Error(`corrupt national eligibility facts for ${careerId}`, { cause }); }
  };
  const snapshot = (careerId: string, playerId: string, beforeDay: number, beforeRevision = Number.MAX_SAFE_INTEGER): NationalEligibilityFactsSnapshot | null => {
    const history = replay(careerId, playerId, beforeDay, beforeRevision);
    const latest = history.at(-1);
    if (!latest) return null;
    const byBasis = new Map<string, DurableNationalEligibilityFact>();
    for (const entry of history) byBasis.set(json([entry.input.fact.nationId, entry.input.fact.basis]), entry);
    return freeze({ careerId, playerId, asOfDay: beforeDay, snapshotId: latest.snapshotId,
      facts: [...byBasis.values()].filter((entry) => entry.input.active).map((entry) => entry.input.fact) });
  };
  return Object.freeze({
    record(raw: NationalEligibilityFactRequest): DurableNationalEligibilityFact {
      scope(raw?.careerId, raw?.fact?.playerId, raw?.fact?.effectiveFromDay);
      const input = cloneInert(raw);
      // Identity rejection precedes chronology so unrelated Person claims never become history.
      project(input, 1, null);
      db.exec('BEGIN IMMEDIATE');
      try {
        const history = replay(input.careerId, input.fact.playerId, Number.MAX_SAFE_INTEGER);
        const existing = history.find((entry) => entry.input.fact.evidenceId === input.fact.evidenceId);
        if (existing) {
          if (json(existing.input) !== json(input)) throw new Error('national eligibility fact is frozen differently');
          db.exec('COMMIT'); return existing;
        }
        const previous = history.at(-1);
        if (previous && input.fact.effectiveFromDay < previous.input.fact.effectiveFromDay) throw new Error('national eligibility fact is backdated');
        const sameBasis = history.filter((entry) => entry.input.fact.nationId === input.fact.nationId
          && entry.input.fact.basis === input.fact.basis).at(-1);
        if (!input.active && !sameBasis?.input.active) throw new Error('national eligibility fact has no active basis to revoke');
        const entry = project(input, history.length + 1, previous?.snapshotId ?? null);
        db.prepare(`INSERT INTO world_national_eligibility_facts
          (career_id, player_id, revision, evidence_id, effective_from_day, snapshot_id, entry_json) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(input.careerId, input.fact.playerId, entry.revision, input.fact.evidenceId, input.fact.effectiveFromDay, entry.snapshotId, json(entry));
        db.exec('COMMIT'); return entry;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    readFacts(careerId: string, playerId: string, beforeDay: number): NationalEligibilityFactsSnapshot | null {
      scope(careerId, playerId, beforeDay);
      return snapshot(careerId, playerId, beforeDay);
    },
    readFactsSnapshot(careerId: string, playerId: string, snapshotId: string, beforeDay: number): NationalEligibilityFactsSnapshot | null {
      scope(careerId, playerId, beforeDay);
      if (!id(snapshotId)) throw new Error('invalid national eligibility snapshot reference');
      const row = db.prepare(`SELECT revision FROM world_national_eligibility_facts
        WHERE career_id=? AND player_id=? AND snapshot_id=? AND effective_from_day<=?`)
        .get(careerId, playerId, snapshotId, beforeDay) as { revision: number } | undefined;
      if (!row) return null;
      const accepted = snapshot(careerId, playerId, beforeDay, row.revision);
      if (accepted?.snapshotId !== snapshotId) throw new Error('corrupt national eligibility snapshot prefix');
      return accepted;
    },
    close(): void { if (!closed && !borrowed) db.close(); closed = true; },
  });
};

/** Existing string-path facade owns its connection and schema. */
export const openSqliteNationalEligibilityFactStore = (databasePath: string, sources: Parameters<typeof createSqliteNationalEligibilityFactStore>[1]): SqliteNationalEligibilityFactStore =>
  createSqliteNationalEligibilityFactStore(databasePath, sources);

/** Read-only projection of the same owner on a consumer connection. No opener, schema writes or close capability. */
export const nationalEligibilityFactEvidenceFromSqlite = (db: DatabaseSync, sources: Parameters<typeof createSqliteNationalEligibilityFactStore>[1]): Pick<SqliteNationalEligibilityFactStore, 'readFacts' | 'readFactsSnapshot'> => {
  const owner = createSqliteNationalEligibilityFactStore(db, sources);
  return Object.freeze({ readFacts: owner.readFacts, readFactsSnapshot: owner.readFactsSnapshot });
};
