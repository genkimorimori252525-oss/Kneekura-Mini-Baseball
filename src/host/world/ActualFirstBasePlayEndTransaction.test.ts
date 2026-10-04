import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import type { AcceptedActualFirstBasePlayEnd } from './ActualFirstBasePlayEnd';
// Tiny transactional-owner test only. Physics derivation is replaced by a stable,
// source-bound already-proved result; all real SQLite ownership, encoding,
// identity, write ordering, seal/read, and transaction code remains unmodified.
vi.mock('./ActualFirstBasePlayEndEvidenceFromSqlite', () => ({ actualFirstBasePlayEndEvidenceFromSqlite: () => ({
  derive: (source: AcceptedActualFirstBasePlayEnd) => ({ source, kind: 'ended', gameId: 'game', playId: 7,
    physicalPitchSourceId: 'pitch', wholeHistory: { end: { kind: 'unestablished' } }, wholeHistoryHash: 'proof' }),
}) }));
import { openSqliteActualFirstBasePlayEndStore } from './SqliteActualFirstBasePlayEndStore';
const request = (sourceId: string): AcceptedActualFirstBasePlayEnd => ({ sourceId, sourceVersion: 'v1', runtimeSourceId: 'runtime',
  baseFieldSourceId: 'field', executionSourceId: 'execution', ruleConsumptionSourceId: 'rule', umpireCallSourceId: 'call', communicationSourceId: 'communication' });
const fixture = () => {
  const path = join(mkdtempSync(join(tmpdir(), 'actual-play-end-transaction-')), 'state.sqlite');
  const store = openSqliteActualFirstBasePlayEndStore(path, { readAcceptedEnd: request });
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(path);
  expect(db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
  expect(db.prepare('PRAGMA database_list').all().find(r => r.name === 'main')!.file).toBe(path);
  return { store, db, close() { store.close(); db.close(); } };
};
it('control: accepts one source-bound result and rejects a normal second source through SQL uniqueness', () => {
  const x = fixture(); try {
    expect(x.store.accept('first-end').kind).toBe('ended');
    expect(() => x.store.accept('second-end')).toThrow();
    expect(x.db.prepare('SELECT count(*) AS n FROM actual_first_base_play_ends').get()!.n).toBe(1);
  } finally { x.close(); }
});
it('rejects a second end when prior cached scope has changed and its seal is absent but raw original runtime and pitch still claim the play', () => {
  const x = fixture(); try {
    x.store.accept('first-end');
    x.db.exec("UPDATE actual_first_base_play_ends SET game_id='foreign',play_id=99,physical_pitch_source_id='foreign-pitch'; DELETE FROM actual_live_play_fences;");
    const original = x.db.prepare('SELECT source_json,snapshot_json FROM actual_first_base_play_ends').get()!;
    expect(JSON.parse(String(original.source_json)).runtimeSourceId).toBe('runtime');
    expect(JSON.parse(String(original.snapshot_json)).physicalPitchSourceId).toBe('pitch');
    expect(() => x.store.accept('second-end')).toThrow(/ownership|terminal|sealed|closure|claim/);
  } finally { x.close(); }
});
it('rolls back a new end when an INSERT trigger creates another raw same-runtime terminal claim hidden behind foreign cached scope', () => {
  const x = fixture(); try {
    x.db.exec(`CREATE TRIGGER hidden_terminal AFTER INSERT ON actual_first_base_play_ends WHEN NEW.source_id='first-end'
      BEGIN INSERT INTO actual_first_base_play_ends VALUES('hidden-end','foreign',99,'foreign-pitch',
        json_set(NEW.source_json,'$.sourceId','hidden-end'),NEW.source_hash,
        json_set(NEW.snapshot_json,'$.source.sourceId','hidden-end'),NEW.snapshot_hash); END;`);
    expect(() => x.store.accept('first-end')).toThrow(/ownership|terminal|sealed|closure|claim/);
    expect(x.db.prepare('SELECT * FROM actual_first_base_play_ends').all()).toEqual([]);
    expect(x.db.prepare('SELECT * FROM actual_live_play_fences').all()).toEqual([]);
  } finally { x.close(); }
});
it('revalidates an identical retry after its Source callback deletes the durable seal on a peer WAL connection', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'actual-play-end-retry-')), 'state.sqlite');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  let peer: import('node:sqlite').DatabaseSync | null = null;
  let deleteOnCallback = false;
  const store = openSqliteActualFirstBasePlayEndStore(path, { readAcceptedEnd(sourceId) {
    if (deleteOnCallback) peer!.exec('DELETE FROM actual_live_play_fences');
    return request(sourceId);
  } });
  peer = new DatabaseSync(path);
  expect(peer.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
  expect(peer.prepare('PRAGMA database_list').all().find(r => r.name === 'main')!.file).toBe(path);
  try {
    store.accept('first-end'); deleteOnCallback = true;
    expect(() => store.accept('first-end')).toThrow(/archive|fence|ownership|changed/);
  } finally { store.close(); peer.close(); }
});

it('proves the seal INSERT and its corrupting trigger ran before rejecting and rolling back the end', () => {
  const x = fixture();
  const witness = witnessSqliteWrite('INSERT INTO actual_live_play_fences VALUES(?,?,?,?)', db =>
    db.prepare("SELECT count(*) AS n FROM actual_first_base_play_ends WHERE source_id='hidden-end'").get()!.n === 1);
  try {
    x.db.exec(`CREATE TRIGGER hidden_terminal_after_seal AFTER INSERT ON actual_live_play_fences
      BEGIN INSERT INTO actual_first_base_play_ends
      SELECT 'hidden-end','foreign',99,'foreign-pitch',json_set(source_json,'$.sourceId','hidden-end'),source_hash,
        json_set(snapshot_json,'$.source.sourceId','hidden-end'),snapshot_hash FROM actual_first_base_play_ends WHERE source_id='first-end'; END;`);
    expect(() => x.store.accept('first-end')).toThrow(/ownership|terminal|closure|claim/);
    expect(witness.wasReached()).toBe(true);
    expect(x.db.prepare('SELECT * FROM actual_first_base_play_ends').all()).toEqual([]);
    expect(x.db.prepare('SELECT * FROM actual_live_play_fences').all()).toEqual([]);
  } finally { witness.close(); x.close(); }
});
