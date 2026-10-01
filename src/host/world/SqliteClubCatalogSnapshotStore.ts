import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { getDefaultClubCatalog, type ClubCatalog } from '../../core/world/catalog';
import { readCatalog } from '../../core/world/catalog/ClubCatalog';

export type DurableClubCatalogSnapshot = Readonly<{ snapshotId: string; catalog: ClubCatalog }>;
export type SqliteClubCatalogSnapshotStore = Readonly<{
  initializeCurrent(): DurableClubCatalogSnapshot;
  readSnapshot(snapshotId: string): DurableClubCatalogSnapshot | null;
  close(): void;
}>;
type Row = { snapshot_id: string; catalog_version: string; dataset_version: string; source_revision: string; catalog_json: string };
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const json = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const digest = (catalog: ClubCatalog): string => `club-catalog:${createHash('sha256').update(json(catalog)).digest('hex')}`;
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

/** Archive actual compiled approved datasets; a later dataset applies only to new Careers. */
export const openSqliteClubCatalogSnapshotStore = (databasePath: string): SqliteClubCatalogSnapshotStore => {
  if (!id(databasePath)) throw new Error('invalid club catalog database path');
  const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_club_catalog_snapshots (
    snapshot_id TEXT PRIMARY KEY, catalog_version TEXT NOT NULL, dataset_version TEXT NOT NULL,
    source_revision TEXT NOT NULL, catalog_json TEXT NOT NULL,
    UNIQUE(catalog_version, dataset_version, source_revision)
  );`);
  let closed = false;
  const scope = (): void => { if (closed) throw new Error('club catalog store is closed'); };
  const replay = (row: Row): DurableClubCatalogSnapshot => {
    try {
      const catalog = readCatalog(JSON.parse(row.catalog_json));
      if (catalog.catalogVersion !== row.catalog_version || catalog.datasetVersion !== row.dataset_version
        || catalog.sourceRevision !== row.source_revision || json(catalog) !== row.catalog_json || digest(catalog) !== row.snapshot_id) {
        throw new Error('club catalog snapshot metadata or content differs');
      }
      return freeze({ snapshotId: row.snapshot_id, catalog });
    } catch (cause) { throw new Error('corrupt accepted club catalog snapshot', { cause }); }
  };
  return Object.freeze({
    initializeCurrent(): DurableClubCatalogSnapshot {
      scope();
      const catalog = readCatalog(getDefaultClubCatalog());
      const snapshotId = digest(catalog);
      db.exec('BEGIN IMMEDIATE');
      try {
        const prior = db.prepare('SELECT * FROM world_club_catalog_snapshots WHERE catalog_version=? AND dataset_version=? AND source_revision=?')
          .get(catalog.catalogVersion, catalog.datasetVersion, catalog.sourceRevision) as Row | undefined;
        if (prior) {
          const saved = replay(prior);
          if (saved.snapshotId !== snapshotId) throw new Error('compiled club catalog version is frozen differently');
          db.exec('COMMIT'); return saved;
        }
        db.prepare('INSERT INTO world_club_catalog_snapshots VALUES (?, ?, ?, ?, ?)')
          .run(snapshotId, catalog.catalogVersion, catalog.datasetVersion, catalog.sourceRevision, json(catalog));
        db.exec('COMMIT'); return freeze({ snapshotId, catalog });
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    readSnapshot(snapshotId: string): DurableClubCatalogSnapshot | null {
      scope(); if (!id(snapshotId)) throw new Error('invalid club catalog snapshot identity');
      const row = db.prepare('SELECT * FROM world_club_catalog_snapshots WHERE snapshot_id=?').get(snapshotId) as Row | undefined;
      return row ? replay(row) : null;
    },
    close(): void { if (!closed) db.close(); closed = true; },
  });
};
