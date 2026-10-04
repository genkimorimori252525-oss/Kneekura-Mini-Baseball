import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { openActualLiveImmutableReceiptStore, type ActualLiveImmutableOwner } from './ActualLiveImmutableReceiptStore';
import { actorHash, actorJson } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

// Tiny transactional mechanism fixture. No synthetic value is presented as a
// real physical Source; Native scope/queue replay remains a separate gate.
const fixture = (encoded: boolean) => {
  const directory = mkdtempSync(join(tmpdir(), 'live-owner-codec-')), path = join(directory, 'owners.sqlite');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const peer = new DatabaseSync(path); peer.exec('PRAGMA journal_mode=WAL; CREATE TABLE dependencies(value INTEGER); INSERT INTO dependencies VALUES(1)');
  const source = { sourceId: 'checkpoint' };
  type Value = { source: typeof source; revision: 1; history: typeof source[]; ownershipKey: string; dependency: number };
  const make = (db: import('node:sqlite').DatabaseSync): ActualLiveImmutableOwner<typeof source, Value> => ({
    input: raw => raw,
    derive: source => ({ source, revision: 1, history: [source], ownershipKey: 'owned-key', dependency: Number(db.prepare('SELECT value FROM dependencies').get()!.value) }),
    ...(encoded ? { encode: (value: Value) => { const manifest = { ...value, snapshotFormat: 'test_concrete_owner' }; return { json: actorJson(manifest), hash: actorHash(manifest) }; } } : {}),
  });
  const open = () => openActualLiveImmutableReceiptStore(path, 'actual_live_play_queue_checkpoints', make, () => source);
  const store = open();
  return { peer, source, store, open, close() { store.close(); peer.close(); rmSync(directory, { recursive: true, force: true }); } };
};
it('uses only its concrete owner paired encoding through insert, retry, read and reopen', () => {
  const x = fixture(true);
  try {
    const value = x.store.accept(x.source.sourceId), row = x.peer.prepare('SELECT * FROM actual_live_play_queue_checkpoints').get()!;
    expect(JSON.parse(String(row.snapshot_json)).snapshotFormat).toBe('test_concrete_owner');
    expect(row.snapshot_hash).toBe(actorHash(JSON.parse(String(row.snapshot_json))));
    expect(x.store.accept(x.source.sourceId)).toEqual(value); expect(x.store.read(x.source.sourceId)).toEqual(value);
    x.store.close(); const reopened = x.open(); try { expect(reopened.read(x.source.sourceId)).toEqual(value); } finally { reopened.close(); }
  } finally { x.close(); }
});
it('rolls back same-connection trigger changes using the owner encoding and rejects altered archives', () => {
  const x = fixture(true);
  try {
    x.peer.exec('CREATE TRIGGER corrupt AFTER INSERT ON actual_live_play_queue_checkpoints BEGIN UPDATE dependencies SET value=2; END;');
    expect(() => x.store.accept(x.source.sourceId)).toThrow(/changed/);
    expect(x.peer.prepare('SELECT count(*) AS n FROM actual_live_play_queue_checkpoints').get()!.n).toBe(0);
    expect(x.peer.prepare('SELECT value FROM dependencies').get()!.value).toBe(1);
    x.peer.exec('DROP TRIGGER corrupt'); x.store.accept(x.source.sourceId);
    x.peer.exec("UPDATE actual_live_play_queue_checkpoints SET snapshot_hash='wrong'");
    expect(() => x.store.read(x.source.sourceId)).toThrow(/archive/);
  } finally { x.close(); }
});
it('leaves default-owner raw JSON and hashes unchanged', () => {
  const x = fixture(false);
  try {
    const value = x.store.accept(x.source.sourceId), row = x.peer.prepare('SELECT * FROM actual_live_play_queue_checkpoints').get()!;
    expect(row.snapshot_json).toBe(actorJson(value)); expect(row.snapshot_hash).toBe(actorHash(value));
  } finally { x.close(); }
});
