import { createRequire } from 'node:module';
import { expect, it, vi } from 'vitest';
import { getDefaultClubCatalog } from '../../core/world/catalog';
import * as compiledCatalog from '../../core/world/catalog';
import * as catalogModule from './SqliteClubCatalogSnapshotStore';

it('archives the actual approved compiled catalog independently of running Careers and revalidates it after reopening', () => {
  expect(catalogModule).toHaveProperty('openSqliteClubCatalogSnapshotStore');
  const path = `file:club-catalog-${crypto.randomUUID()}?mode=memory&cache=shared`;
  const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const db = new DatabaseSync(path);
  let store = catalogModule.openSqliteClubCatalogSnapshotStore(path);
  try {
    const saved = store.initializeCurrent();
    expect(saved.catalog).toEqual(getDefaultClubCatalog());
    expect(saved.catalog.clubs).toHaveLength(234);
    expect(saved.catalog.leagues).toHaveLength(21);
    expect(saved.snapshotId).toMatch(/^club-catalog:[a-f0-9]{64}$/);
    expect(Object.isFrozen(saved.catalog.clubs[0].targets)).toBe(true);
    expect(store.initializeCurrent()).toEqual(saved);
    store.close(); store = catalogModule.openSqliteClubCatalogSnapshotStore(path);
    expect(store.readSnapshot(saved.snapshotId)).toEqual(saved);
    expect(store.readSnapshot('missing')).toBeNull();
    db.prepare("UPDATE world_club_catalog_snapshots SET catalog_json='{}'").run();
    expect(() => store.readSnapshot(saved.snapshotId)).toThrow('corrupt');
    expect(() => store.initializeCurrent()).toThrow('corrupt');
  } finally { store.close(); db.close(); }
});

it('preserves accepted older datasets and refuses content changes under the same dataset identity', () => {
  const path = `file:club-catalog-version-${crypto.randomUUID()}?mode=memory&cache=shared`;
  const store = catalogModule.openSqliteClubCatalogSnapshotStore(path);
  const original = getDefaultClubCatalog();
  const current = vi.spyOn(compiledCatalog, 'getDefaultClubCatalog');
  try {
    const old = store.initializeCurrent();
    // Simulate a future compiled dataset only inside this test; no production reform or calibration.
    const next = { ...original, datasetVersion: 'fixture-next-dataset', sourceRevision: 'f'.repeat(40) };
    current.mockReturnValue(next);
    const saved = store.initializeCurrent();
    expect(saved.snapshotId).not.toBe(old.snapshotId);
    expect(store.readSnapshot(old.snapshotId)).toEqual(old);
    expect(store.readSnapshot(saved.snapshotId)?.catalog.datasetVersion).toBe('fixture-next-dataset');
    current.mockReturnValue({ ...next, clubs: next.clubs.map((club, index) => index === 0 ? { ...club, aliases: [...club.aliases, 'fixture-new-alias'] } : club) });
    expect(() => store.initializeCurrent()).toThrow('frozen differently');
    expect(store.readSnapshot(saved.snapshotId)).toEqual(saved);
  } finally { current.mockRestore(); store.close(); }
});
