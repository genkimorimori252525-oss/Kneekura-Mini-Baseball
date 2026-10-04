import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { beginActualLivePlayWrite, assertActualLivePlayWriteUnchanged, recordActualLivePlayAdmission, beginActualLivePlayRegistration, assertActualLivePlayRegistrationUnchanged } from './ActualLivePlayFence';

const fixture = () => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const path = join(mkdtempSync(join(tmpdir(), 'actual-live-fence-')), 'fence.sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=wal; CREATE TABLE actual_live_play_fences(game_id TEXT,play_id INTEGER,physical_pitch_source_id TEXT,closure_source_id TEXT,PRIMARY KEY(game_id,play_id)); CREATE TABLE work(value TEXT);');
  expect(db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
  expect(db.prepare('PRAGMA database_list').all().find(r => r.name === 'main')!.file).toBe(path);
  const scope = { gameId: 'game', playId: 7, physicalPitchSourceId: 'pitch' };
  return { db, path, scope, DatabaseSync };
};
it('requires a transaction and rejects a terminal scope while preserving unrelated play admission after disk reopen', () => {
  const x = fixture();
  try {
    expect(() => beginActualLivePlayWrite(x.db, x.scope)).toThrow(/transaction/);
    x.db.exec("INSERT INTO actual_live_play_fences VALUES('game',7,'pitch','closure'); BEGIN IMMEDIATE;");
    expect(() => beginActualLivePlayWrite(x.db, x.scope)).toThrow(/sealed/);
    const other = beginActualLivePlayWrite(x.db, { gameId: 'game', playId: 8, physicalPitchSourceId: 'other-pitch' });
    assertActualLivePlayWriteUnchanged(x.db, other); x.db.exec('COMMIT'); x.db.close();
    const reopened = new x.DatabaseSync(x.path);
    try { reopened.exec('BEGIN IMMEDIATE'); expect(() => beginActualLivePlayWrite(reopened, x.scope)).toThrow(/sealed/); reopened.exec('ROLLBACK'); }
    finally { reopened.close(); }
  } finally { if (x.db.isOpen) x.db.close(); }
});
it('detects same-transaction fence creation or mutation after an otherwise successful writer and rolls back its delta', () => {
  const x = fixture();
  try {
    x.db.exec("CREATE TRIGGER seal_during_write AFTER INSERT ON work BEGIN INSERT INTO actual_live_play_fences VALUES('game',7,'pitch','closure'); END; BEGIN IMMEDIATE;");
    const fence = beginActualLivePlayWrite(x.db, x.scope);
    x.db.exec("INSERT INTO work VALUES('new');");
    expect(() => assertActualLivePlayWriteUnchanged(x.db, fence)).toThrow(/changed|sealed/);
    x.db.exec('ROLLBACK');
    expect(x.db.prepare('SELECT * FROM work').all()).toEqual([]);
    expect(x.db.prepare('SELECT * FROM actual_live_play_fences').all()).toEqual([]);
  } finally { x.db.close(); }
});
it('rejects a committed peer seal after preflight and ambiguous pitch/play fence ownership', () => {
  const x = fixture();
  try {
    const peer = new x.DatabaseSync(x.path);
    peer.exec("PRAGMA journal_mode=wal; INSERT INTO actual_live_play_fences VALUES('other',9,'pitch','closure');"); peer.close();
    x.db.exec('BEGIN IMMEDIATE');
    expect(() => beginActualLivePlayWrite(x.db, x.scope)).toThrow(/sealed/); x.db.exec('ROLLBACK');
  } finally { x.db.close(); }
});
it('preserves a legacy database without installing a fence and detects a newly installed owner inside the transaction', () => {
  const x = fixture();
  try {
    x.db.exec('DROP TABLE actual_live_play_fences; BEGIN IMMEDIATE;');
    const fence = beginActualLivePlayWrite(x.db, x.scope);
    assertActualLivePlayWriteUnchanged(x.db, fence);
    x.db.exec('CREATE TABLE actual_live_play_fences(game_id TEXT,play_id INTEGER,physical_pitch_source_id TEXT,closure_source_id TEXT);');
    expect(() => assertActualLivePlayWriteUnchanged(x.db, fence)).toThrow(/changed/); x.db.exec('ROLLBACK');
  } finally { x.db.close(); }
});
it('journals each governed writer atomically and refuses a missing producer descriptor', () => {
  const x = fixture();
  try {
    x.db.exec(`CREATE TABLE actual_live_play_runtimes(source_id TEXT,game_id TEXT,play_id INTEGER,physical_pitch_source_id TEXT,source_json TEXT,snapshot_json TEXT);
      INSERT INTO actual_live_play_runtimes VALUES('runtime','game',7,'pitch','{}','{}');
      CREATE TABLE actual_live_play_admissions(runtime_source_id TEXT,sequence INTEGER,owner TEXT,source_id TEXT,source_hash TEXT,snapshot_hash TEXT,PRIMARY KEY(runtime_source_id,sequence));
      CREATE TABLE actual_field_observations(source_id TEXT,source_hash TEXT,snapshot_hash TEXT);
      BEGIN IMMEDIATE;`);
    expect(() => beginActualLivePlayWrite(x.db, x.scope)).toThrow(/producer/);
    const fence = beginActualLivePlayWrite(x.db, x.scope, { owner: 'actual_field_observations', sourceId: 'observation' });
    x.db.exec("INSERT INTO actual_field_observations VALUES('observation','source-hash','snapshot-hash');");
    expect(() => assertActualLivePlayWriteUnchanged(x.db, fence)).toThrow(/record/);
    recordActualLivePlayAdmission(x.db, fence);
    assertActualLivePlayWriteUnchanged(x.db, fence);
    expect(x.db.prepare('SELECT * FROM actual_live_play_admissions').all()).toEqual([
      { runtime_source_id: 'runtime', sequence: 1, owner: 'actual_field_observations', source_id: 'observation', source_hash: 'source-hash', snapshot_hash: 'snapshot-hash' },
    ]);
    x.db.exec('COMMIT');
  } finally { x.db.close(); }
});
it('detects a journal-insert trigger that changes the producer payload without changing its hash columns', () => {
  const x = fixture();
  try {
    x.db.exec(`CREATE TABLE actual_live_play_runtimes(source_id TEXT,game_id TEXT,play_id INTEGER,physical_pitch_source_id TEXT,source_json TEXT,snapshot_json TEXT);
      INSERT INTO actual_live_play_runtimes VALUES('runtime','game',7,'pitch','{}','{}');
      CREATE TABLE actual_live_play_admissions(runtime_source_id TEXT,sequence INTEGER,owner TEXT,source_id TEXT,source_hash TEXT,snapshot_hash TEXT);
      CREATE TABLE actual_field_observations(source_id TEXT,source_hash TEXT,snapshot_hash TEXT,snapshot_json TEXT);
      CREATE TRIGGER mutate_payload AFTER INSERT ON actual_live_play_admissions BEGIN UPDATE actual_field_observations SET snapshot_json='corrupted'; END;
      BEGIN IMMEDIATE;`);
    const fence = beginActualLivePlayWrite(x.db, x.scope, { owner: 'actual_field_observations', sourceId: 'observation' });
    x.db.exec("INSERT INTO actual_field_observations VALUES('observation','source-hash','snapshot-hash','original');");
    expect(() => recordActualLivePlayAdmission(x.db, fence)).toThrow(/changed/);
    x.db.exec('ROLLBACK');
    expect(x.db.prepare('SELECT * FROM actual_field_observations').all()).toEqual([]);
    expect(x.db.prepare('SELECT * FROM actual_live_play_admissions').all()).toEqual([]);
  } finally { x.db.close(); }
});
it.each(['deleted seal', 'dropped seal owner'])('rejects retained completed-end ownership after a %s before the writer starts', (mode) => {
  const x = fixture();
  try {
    x.db.exec(`CREATE TABLE actual_first_base_play_ends(source_id TEXT,game_id TEXT,play_id INTEGER,physical_pitch_source_id TEXT,source_json TEXT,snapshot_json TEXT);
      INSERT INTO actual_first_base_play_ends VALUES('closure','game',7,'pitch','{}','{"gameId":"game","playId":7,"physicalPitchSourceId":"pitch"}');`);
    if (mode === 'dropped seal owner') x.db.exec('DROP TABLE actual_live_play_fences;');
    x.db.exec('BEGIN IMMEDIATE');
    expect(() => beginActualLivePlayWrite(x.db, x.scope)).toThrow(/sealed|terminal|closure/);
    x.db.exec('ROLLBACK');
  } finally { x.db.close(); }
});

it.each(['cross-scope pitch claim', 'owner disappearance'])('rolls registration back for %s while permitting only its own runtime census delta', mode => {
  const x = fixture();
  try {
    x.db.exec('BEGIN IMMEDIATE');
    const token = beginActualLivePlayRegistration(x.db, x.scope);
    x.db.exec("CREATE TABLE actual_live_play_runtimes(source_id TEXT,game_id TEXT,play_id INTEGER,physical_pitch_source_id TEXT,source_json TEXT,snapshot_json TEXT); INSERT INTO actual_live_play_runtimes VALUES('runtime','game',7,'pitch','{}','{}');");
    assertActualLivePlayRegistrationUnchanged(x.db, token);
    if (mode === 'cross-scope pitch claim') x.db.exec("INSERT INTO actual_live_play_fences VALUES('other-game',99,'pitch','foreign-end');");
    else x.db.exec('DROP TABLE actual_live_play_fences;');
    expect(() => assertActualLivePlayRegistrationUnchanged(x.db, token)).toThrow(/sealed|changed/);
    x.db.exec('ROLLBACK');
    expect(x.db.prepare("SELECT 1 FROM sqlite_master WHERE name='actual_live_play_runtimes'").get()).toBeUndefined();
  } finally { x.db.close(); }
});
it('retains terminal ownership through its original runtime Source when cached scope columns and mirrors are changed', () => {
  const x = fixture();
  try {
    x.db.exec(`CREATE TABLE actual_live_play_runtimes(source_id TEXT,game_id TEXT,play_id INTEGER,physical_pitch_source_id TEXT,source_json TEXT,snapshot_json TEXT);
      INSERT INTO actual_live_play_runtimes VALUES('runtime','game',7,'pitch','{}','{}');
      CREATE TABLE actual_live_play_admissions(runtime_source_id TEXT,sequence INTEGER,owner TEXT,source_id TEXT,source_hash TEXT,snapshot_hash TEXT);
      CREATE TABLE actual_first_base_play_ends(source_id TEXT,game_id TEXT,play_id INTEGER,physical_pitch_source_id TEXT,source_json TEXT,snapshot_json TEXT);
      INSERT INTO actual_first_base_play_ends VALUES('closure','foreign',99,'foreign-pitch','{"runtimeSourceId":"runtime"}',
        '{"gameId":"foreign","playId":99,"physicalPitchSourceId":"foreign-pitch"}');
      BEGIN IMMEDIATE;`);
    expect(() => beginActualLivePlayWrite(x.db, x.scope, { owner: 'actual_field_observations', sourceId: 'new' })).toThrow(/terminal|sealed/);
    x.db.exec('ROLLBACK');
  } finally { x.db.close(); }
});

it('rejects a raw runtime pitch claim hidden behind foreign cached scope before new admission', () => {
  const x = fixture();
  try {
    x.db.exec(`CREATE TABLE actual_live_play_runtimes(source_id TEXT,game_id TEXT,play_id INTEGER,physical_pitch_source_id TEXT,source_json TEXT,snapshot_json TEXT);
      INSERT INTO actual_live_play_runtimes VALUES('runtime','other',8,'other-pitch','{"physicalPitchSourceId":"pitch"}','{}'); BEGIN IMMEDIATE;`);
    expect(() => beginActualLivePlayWrite(x.db, x.scope, { owner: 'actual_field_observations', sourceId: 'new' })).toThrow(/ownership/);
    x.db.exec('ROLLBACK');
  } finally { x.db.close(); }
});
