import { expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import * as store from './SqliteActualLiveAdjudicationStore';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
it('never persists an official checkpoint from a missing physical-end proposal and reopens cleanly on disk/WAL', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'actual-live-adjudication-')), 'state.sqlite');
  const source = { sourceId: 'adj', sourceVersion: 'v1', physicalEndSourceId: 'end', policy: null };
  const owner = store.openSqliteActualLiveAdjudicationStore(path, { readAcceptedAdjudication: id => id === source.sourceId ? source : null });
  const db = new DatabaseSync(path);
  try {
    expect(db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    expect(db.prepare('PRAGMA database_list').all().find(r => r.name === 'main')!.file).toBe(path);
    expect(() => owner.accept(source.sourceId)).toThrow(/physical end/);
    expect(db.prepare('SELECT * FROM actual_live_adjudications').all()).toEqual([]);
  } finally { owner.close(); db.close(); }
  const reopened = store.openSqliteActualLiveAdjudicationStore(path);
  try { expect(reopened.read(source.sourceId)).toBeNull(); } finally { reopened.close(); }
});
