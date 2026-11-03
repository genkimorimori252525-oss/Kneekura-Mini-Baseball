import { afterEach, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { openSqliteBattedWorldContinuationV3Store } from './SqliteBattedWorldContinuationV3Store';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

const paths: string[] = [];
afterEach(() => { for (const path of paths.splice(0)) {
  if (!resolve(path).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe v3 schema fixture cleanup path');
  rmSync(path, { force: true, recursive: true });
} });
const path = () => { const folder = mkdtempSync(join(tmpdir(), 'mb-v3-schema-')); paths.push(folder); return join(folder, 'fixture.sqlite'); };
const peer = { read: () => { throw new Error('peer must not be used by an empty own-row read'); } };

it('opens only an explicit v3 owner and reads its empty archive independently', () => {
  const file = path(), store = openSqliteBattedWorldContinuationV3Store(file, peer), db = new DatabaseSync(file);
  try {
    expect(store.read('missing')).toBeNull();
    expect(db.prepare("SELECT 1 FROM sqlite_master WHERE name='batted_world_continuations'").get()).toBeUndefined();
    expect(db.prepare("SELECT 1 FROM sqlite_master WHERE name='batted_world_continuations_v3'").get()).toBeDefined();
  } finally { db.close(); store.close(); }
  expect(() => store.read('missing')).toThrow('closed');
});

it.each(['table', 'view'] as const)('rejects a pre-existing incompatible %s owner before creating any companion schema', kind => {
  const file = path(), db = new DatabaseSync(file);
  db.exec(kind === 'table' ? 'CREATE TABLE batted_world_continuations_v3 (source_id TEXT)' : 'CREATE VIEW batted_world_continuations_v3 AS SELECT 1 AS source_id');
  try {
    expect(() => openSqliteBattedWorldContinuationV3Store(file, peer)).toThrow('owner schema differs');
    expect(db.prepare("SELECT 1 FROM sqlite_master WHERE name='batted_world_continuation_heads_v3'").get()).toBeUndefined();
  } finally { db.close(); }
});

it('rejects owner schema changes after open before trusting a read', () => {
  const file = path(), store = openSqliteBattedWorldContinuationV3Store(file, peer), db = new DatabaseSync(file);
  try {
    db.exec('ALTER TABLE batted_world_continuations_v3 ADD COLUMN invented_outcome TEXT');
    expect(() => store.read('missing')).toThrow('owner schema differs');
  } finally { db.close(); store.close(); }
});
