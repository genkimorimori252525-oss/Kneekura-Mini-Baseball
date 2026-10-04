import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as store from './SqliteActualLivePlayClosureStore';
import { assertPriorActualLiveClosureCompleted } from './ActualLivePlayClosureEvidenceFromSqlite';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
it('does not apply a missing actual adjudication or fabricate scoring/workload and reopens on the same disk', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'actual-live-closure-')), 'state.sqlite');
  const source = { sourceId: 'close', sourceVersion: 'v1', adjudicationSourceId: 'adj', applicationId: 'apply', closureTick: 10,
    nextStartedAtTick: 11, controllerReset: 'rule_system_retire_original_play' as const,
    worldSetup: { baseCenters: { first: { x: 1, z: 1 }, second: { x: 0, z: 2 }, third: { x: -1, z: 1 } }, defenders: [], activePreviousPlayControllerIds: [] } };
  const owner = store.openSqliteActualLivePlayClosureStore(path, { readAcceptedClosure: id => id === source.sourceId ? source : null });
  const db = new DatabaseSync(path);
  try {
    expect(db.prepare('PRAGMA database_list').all().find(r => r.name === 'main')!.file).toBe(path);
    expect(db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    expect(() => owner.enqueue(source.sourceId)).toThrow(/adjudication/);
    expect(db.prepare('SELECT * FROM actual_live_play_closures').all()).toEqual([]);
    expect(db.prepare('SELECT * FROM applications').all()).toEqual([]);
    expect(() => assertPriorActualLiveClosureCompleted(db, 'unrelated')).not.toThrow();
  } finally { owner.close(); db.close(); }
  const reopened = store.openSqliteActualLivePlayClosureStore(path);
  try { expect(reopened.read(source.sourceId)).toBeNull(); } finally { reopened.close(); }
});
