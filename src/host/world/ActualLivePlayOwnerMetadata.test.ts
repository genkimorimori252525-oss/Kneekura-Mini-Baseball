import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { actualLivePlayOwnerIdentityRow } from './ActualLivePlayOwnerMetadata';

// Reconstructed bounded metadata adversaries. No physical derivation is mocked or claimed.
const fixture = () => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const path = join(mkdtempSync(join(tmpdir(), 'live-owner-metadata-')), 'state.sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=wal; CREATE TABLE actual_live_play_runtimes(source_id TEXT,source_json TEXT,snapshot_json TEXT);');
  expect(db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
  expect(db.prepare('PRAGMA database_list').all().find(r => r.name === 'main')!.file).toBe(path);
  return db;
};
it.each([
  ['{"sourceId":"wanted"}', '{"source":{"sourceId":"wanted"}}'],
  ['{"source\\u0049d":"wanted"}', '{"source":{"sourceId":"foreign"}}'],
  ['{"sourceId":"foreign"}', '{"source":{"sourceId":"wanted"}}'],
  ['{"sourceId":"foreign"}', '{"history":[{"sourceId":"wanted"}]}'],
])('rejects a foreign primary row hiding the requested Source in a raw mirror: %s', (source, snapshot) => {
  const db = fixture();
  try {
    db.prepare('INSERT INTO actual_live_play_runtimes VALUES(?,?,?)').run('foreign', source, snapshot);
    expect(() => actualLivePlayOwnerIdentityRow(db, 'actual_live_play_runtimes', 'wanted')).toThrow(/ownership/);
  } finally { db.close(); }
});
it.each([
  ['{"sourceId":"wanted","sourceId":"wanted"}', '{"source":{"sourceId":"wanted"}}'],
  ['{"sourceId":"wanted"}', '{"source":{"sourceId":"other"}}'],
  ['{"sourceId":"wanted"}', '{"source":{"sourceId":"wanted","sourceId":"other"}}'],
  ['{"sourceId":"wanted"}', '{"source":{"sourceId":"wanted"},"source":{"sourceId":"wanted"}}'],
])('rejects ambiguous or mismatching Source mirrors: %s', (source, snapshot) => {
  const db = fixture();
  try {
    db.prepare('INSERT INTO actual_live_play_runtimes VALUES(?,?,?)').run('wanted', source, snapshot);
    expect(() => actualLivePlayOwnerIdentityRow(db, 'actual_live_play_runtimes', 'wanted')).toThrow(/mirror/);
  } finally { db.close(); }
});
it('returns only a unique matching owner and rejects an additional raw alias claimant', () => {
  const db = fixture();
  try {
    const source = '{"sourceId":"wanted"}', snapshot = '{"source":{"sourceId":"wanted"}}';
    db.prepare('INSERT INTO actual_live_play_runtimes VALUES(?,?,?)').run('wanted', source, snapshot);
    expect(actualLivePlayOwnerIdentityRow(db, 'actual_live_play_runtimes', 'wanted')!.source_id).toBe('wanted');
    db.prepare('INSERT INTO actual_live_play_runtimes VALUES(?,?,?)').run('foreign', '{"sourceId":"foreign"}', '{"history":[{"sourceId":"wanted"}]}');
    expect(() => actualLivePlayOwnerIdentityRow(db, 'actual_live_play_runtimes', 'wanted')).toThrow(/ownership/);
  } finally { db.close(); }
});
