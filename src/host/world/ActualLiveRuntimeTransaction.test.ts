import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
// Stable original-scope proof isolates only the real runtime owner's retry protocol.
vi.mock('./ActualLivePlayEvidenceFromSqlite', () => ({ actualLivePlayEvidenceFromSqlite: () => ({ derive: () => ({ scope: {
  unsupportedParticipantIds: [], gameId: 'game', playId: 7, originalPitchHash: 'proof', scopeId: 'scope', participants: [], producers: [],
} }) }) }));
import { openSqliteActualLivePlayRuntimeStore } from './SqliteActualLivePlayRuntimeStore';
it('does not return a stale registered runtime after its Source callback removes the durable owner on a peer WAL connection', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'actual-runtime-retry-')), 'state.sqlite');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const source = { sourceId: 'runtime', sourceVersion: 'v1', capability: 'causal_original_live_play_runtime_v1' as const, physicalPitchSourceId: 'pitch' };
  let peer: import('node:sqlite').DatabaseSync | null = null, mutate = false;
  const store = openSqliteActualLivePlayRuntimeStore(path, { readAcceptedRuntime() {
    if (mutate) peer!.exec('DELETE FROM actual_live_play_runtimes');
    return source;
  } });
  peer = new DatabaseSync(path);
  expect(peer.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
  expect(peer.prepare('PRAGMA database_list').all().find(r => r.name === 'main')!.file).toBe(path);
  try {
    store.accept(source.sourceId); expect(store.read(source.sourceId)).not.toBeNull(); mutate = true;
    expect(() => store.accept(source.sourceId)).toThrow(/original|changed|missing/);
  } finally { store.close(); peer.close(); }
});
it('rejects a second raw original-pitch runtime claim hidden behind foreign cached columns during a primary runtime read', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'actual-runtime-hidden-owner-')), 'state.sqlite');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const { createHash } = createRequire(import.meta.url)('node:crypto') as typeof import('node:crypto');
  const source = { sourceId: 'runtime', sourceVersion: 'v1', capability: 'causal_original_live_play_runtime_v1' as const, physicalPitchSourceId: 'pitch' };
  const store = openSqliteActualLivePlayRuntimeStore(path, { readAcceptedRuntime: () => source });
  const db = new DatabaseSync(path);
  expect(db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
  expect(db.prepare('PRAGMA database_list').all().find(r => r.name === 'main')!.file).toBe(path);
  try {
    const original = store.accept(source.sourceId), hiddenSource = { ...source, sourceId: 'hidden-runtime' };
    const sourceJson = JSON.stringify(hiddenSource), snapshotJson = JSON.stringify({ ...original, source: hiddenSource });
    const digest = (v: string) => createHash('sha256').update(v).digest('hex');
    db.prepare('INSERT INTO actual_live_play_runtimes VALUES(?,?,?,?,?,?,?,?)').run(
      hiddenSource.sourceId, 'foreign', 99, 'foreign-pitch', sourceJson, digest(sourceJson), snapshotJson, digest(snapshotJson));
    expect(() => store.read(source.sourceId)).toThrow(/ownership|metadata|scope/);
  } finally { store.close(); db.close(); }
});
