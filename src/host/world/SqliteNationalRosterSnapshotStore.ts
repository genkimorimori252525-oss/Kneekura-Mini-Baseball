import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createRosterState } from '../../core/world/roster/RosterState';
import type { RosterState } from '../../core/world/roster/RosterTypes';
import type { SqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';

export type AcceptedNationalRosterSnapshot = Readonly<{
  snapshotId: string; version: 'native-national-roster-snapshot-v1';
  careerId: string; revision: number; effectiveDay: number; roster: RosterState;
}>;
export type SqliteNationalRosterSnapshotStore = Readonly<{
  capture(careerId: string, clubId: string): AcceptedNationalRosterSnapshot;
  readSnapshot(careerId: string, snapshotId: string): AcceptedNationalRosterSnapshot | null;
  close(): void;
}>;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const json = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const project = (raw: RosterState): AcceptedNationalRosterSnapshot => {
  const roster = createRosterState(cloneInert(raw));
  const basis = { version: 'native-national-roster-snapshot-v1' as const,
    careerId: roster.careerId, revision: roster.revision, effectiveDay: roster.effectiveDay, roster };
  const snapshotId = `national-roster:${createHash('sha256').update(json(basis)).digest('hex')}`;
  return freeze({ snapshotId, ...basis });
};

/** Capture a real accepted global roster now; never reconstruct missing past states from a later head. */
export const openSqliteNationalRosterSnapshotStore = (databasePath: string, sources: Readonly<{
  roster: Pick<SqliteManagerRosterDecisionStore, 'readHead'>;
}>): SqliteNationalRosterSnapshotStore => {
  if (!id(databasePath)) throw new Error('invalid national roster snapshot database path');
  const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_national_roster_snapshots (
    career_id TEXT NOT NULL, revision INTEGER NOT NULL, snapshot_id TEXT NOT NULL, snapshot_json TEXT NOT NULL,
    PRIMARY KEY(career_id, revision), UNIQUE(career_id, snapshot_id)
  );`);
  let closed = false;
  const scope = (careerId: string, reference: string): void => {
    if (closed || !id(careerId) || !id(reference)) throw new Error('invalid national roster snapshot scope');
  };
  const read = (careerId: string, snapshotId: string): AcceptedNationalRosterSnapshot | null => {
    scope(careerId, snapshotId);
    const row = db.prepare(`SELECT revision, snapshot_json FROM world_national_roster_snapshots
      WHERE career_id=? AND snapshot_id=?`).get(careerId, snapshotId) as { revision: number; snapshot_json: string } | undefined;
    if (!row) return null;
    try {
      const saved = JSON.parse(row.snapshot_json) as AcceptedNationalRosterSnapshot;
      const expected = project(saved.roster);
      if (saved.careerId !== careerId || expected.snapshotId !== snapshotId || saved.revision !== row.revision
        || json(saved) !== row.snapshot_json || json(expected) !== row.snapshot_json) throw new Error('national roster snapshot differs');
      return expected;
    } catch (cause) { throw new Error(`corrupt national roster snapshot for ${careerId}`, { cause }); }
  };
  return Object.freeze({
    capture(careerId: string, clubId: string): AcceptedNationalRosterSnapshot {
      scope(careerId, clubId);
      const head = sources.roster.readHead(careerId, clubId);
      if (!head || head.careerId !== careerId || head.clubId !== clubId || head.roster.careerId !== careerId) {
        throw new Error('national roster snapshot requires accepted Native roster');
      }
      const snapshot = project(head.roster);
      db.exec('BEGIN IMMEDIATE');
      try {
        const existing = db.prepare(`SELECT snapshot_id FROM world_national_roster_snapshots
          WHERE career_id=? AND revision=?`).get(careerId, snapshot.revision) as { snapshot_id: string } | undefined;
        if (existing && existing.snapshot_id !== snapshot.snapshotId) throw new Error('national roster revision is frozen differently');
        if (existing) {
          const prior = read(careerId, snapshot.snapshotId)!;
          db.exec('COMMIT'); return prior;
        }
        db.prepare(`INSERT INTO world_national_roster_snapshots (career_id, revision, snapshot_id, snapshot_json)
          VALUES (?, ?, ?, ?)`).run(careerId, snapshot.revision, snapshot.snapshotId, json(snapshot));
        db.exec('COMMIT'); return snapshot;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    readSnapshot: read,
    close(): void { if (!closed) db.close(); closed = true; },
  });
};
