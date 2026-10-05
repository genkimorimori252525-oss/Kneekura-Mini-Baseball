import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import type { AcceptedActualFirstBasePlayEnd } from './ActualFirstBasePlayEnd';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

// Transaction-owner boundary only. The expensive physical derivation is replaced
// by immutable, Source-bound evidence. Every real SQLite row, hash, identity,
// terminal claim, fence, transaction and rollback remains in production code.
const state = vi.hoisted(() => ({ db: null as DatabaseSync | null, current: [] as boolean[],
  rowsAtDerive: [] as [number, number][], beforeReturn: null as null | ((db: DatabaseSync, invocation: number) => void),
  changedAt: 0, forbidCurrent: false, queryModes: [] as unknown[], dependency: false,
  dependencyHook: null as null | ((db: DatabaseSync, invocation: number) => (() => void) | undefined) }));
vi.mock('./ActualFirstBasePlayEndEvidenceFromSqlite', () => ({ actualFirstBasePlayEndEvidenceFromSqlite: (db: DatabaseSync) => {
  state.db = db;
  return { derive: (source: AcceptedActualFirstBasePlayEnd, current = false) => {
    state.current.push(current);
    state.rowsAtDerive.push([
      Number(db.prepare('SELECT count(*) AS n FROM actual_first_base_play_ends').get()!.n),
      Number(db.prepare('SELECT count(*) AS n FROM actual_live_play_fences').get()!.n),
    ]);
    if (current && state.forbidCurrent) throw new Error('current-only head is no longer open');
    const invocation = state.current.length;
    state.queryModes.push(db.prepare('PRAGMA query_only').get()!.query_only);
    const finish = state.dependencyHook?.(db, invocation);
    try {
      if (state.dependency && db.prepare('SELECT value FROM proof_dependency').get()!.value !== 'proof') throw new Error('corrupt original dependency');
      state.beforeReturn?.(db, invocation);
      return freeze({ source, kind: 'ended', gameId: 'game', playId: 7, physicalPitchSourceId: 'pitch',
      wholeHistory: { end: { kind: 'unestablished' } }, wholeHistoryHash: invocation === state.changedAt ? 'changed' : 'proof' });
    } finally { finish?.(); }
  } };
} }));
import { actualFirstBaseClosedEvidenceFromSqlite, actualFirstBaseEndArchiveEncoding,
  openSqliteActualFirstBasePlayEndStore } from './SqliteActualFirstBasePlayEndStore';

const { DatabaseSync: Sqlite } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const request = (sourceId: string): AcceptedActualFirstBasePlayEnd => ({ sourceId, sourceVersion: 'v1', runtimeSourceId: 'runtime',
  baseFieldSourceId: 'field', executionSourceId: 'execution', ruleConsumptionSourceId: 'rule', umpireCallSourceId: 'call', communicationSourceId: 'communication' });
const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'end-closed-proof-')), path = join(directory, 'state.sqlite');
  const store = openSqliteActualFirstBasePlayEndStore(path, { readAcceptedEnd: request });
  const peer = new Sqlite(path), writer = state.db!;
  peer.exec('CREATE TABLE mutation_witness(value TEXT)');
  return { store, peer, writer, close() { store.close(); peer.close(); rmSync(directory, { recursive: true, force: true }); } };
};
const assertEmpty = (peer: DatabaseSync) => {
  expect(peer.prepare('SELECT * FROM actual_first_base_play_ends').all()).toEqual([]);
  expect(peer.prepare('SELECT * FROM actual_live_play_fences').all()).toEqual([]);
};
beforeEach(() => { state.db = null; state.current = []; state.rowsAtDerive = []; state.beforeReturn = null; state.changedAt = 0; state.forbidCurrent = false; state.queryModes = []; state.dependency = false; state.dependencyHook = null; });

it('accepts with three full proofs, authenticates identical closed bytes, and keeps public reads and retries independent', () => {
  const x = fixture(); try {
    const ended = x.store.accept('end');
    expect(state.current).toEqual([true, true, true]);
    expect(state.rowsAtDerive).toEqual([[0, 0], [0, 0], [1, 1]]);
    expect(Object.isFrozen(ended)).toBe(true);
    const encoding = actualFirstBaseEndArchiveEncoding(ended), row = x.peer.prepare('SELECT * FROM actual_first_base_play_ends').get()!;
    expect([row.snapshot_json, row.snapshot_hash]).toEqual([encoding.json, encoding.hash]);
    expect(Object.keys(actualFirstBaseClosedEvidenceFromSqlite(x.peer)).sort()).toEqual(['read', 'reference']);
    state.current = []; state.forbidCurrent = true;
    const saved = x.store.read('end');
    expect(json(saved)).toBe(json(ended)); expect(saved).not.toBe(ended);
    expect(state.current).toEqual([false]);
    state.current = [];
    expect(json(x.store.accept('end'))).toBe(json(ended));
    expect(state.current).toEqual([false, false]);
  } finally { x.close(); }
});

it.each([2, 3])('retains complete before-write and post-trigger proof comparison (changed proof %s)', invocation => {
  const x = fixture(); try {
    state.changedAt = invocation;
    expect(() => x.store.accept('end')).toThrow(/complete proof changed/);
    expect(state.current.slice(0, invocation)).toEqual(Array(invocation).fill(true));
    assertEmpty(x.peer);
  } finally { x.close(); }
});

it.each([
  "UPDATE actual_first_base_play_ends SET source_hash='corrupt'",
  "UPDATE actual_first_base_play_ends SET snapshot_hash='corrupt'",
  "UPDATE actual_first_base_play_ends SET source_json=json_set(source_json,'$.runtimeSourceId','foreign')",
  "UPDATE actual_first_base_play_ends SET snapshot_json=json_set(snapshot_json,'$.wholeHistoryHash','foreign')",
  "UPDATE actual_first_base_play_ends SET game_id='foreign',play_id=99,physical_pitch_source_id='foreign-pitch'",
  "DELETE FROM actual_live_play_fences",
  "UPDATE actual_live_play_fences SET closure_source_id='foreign'",
])('still authenticates the saved archive and exact fence after the real seal trigger: %s', mutation => {
  const x = fixture(); try {
    x.peer.exec(`CREATE TRIGGER corrupt_closed_receipt AFTER INSERT ON actual_live_play_fences BEGIN ${mutation}; END;`);
    expect(() => x.store.accept('end')).toThrow(/archive|fence|identity|Source|proof changed/);
    assertEmpty(x.peer);
  } finally { x.close(); }
});

it('rejects same-connection writes during the retained post-trigger derivation and rolls back both owners', () => {
  const x = fixture(); try {
    let reached = false;
    state.beforeReturn = (db, invocation) => { if (invocation === 3) { reached = true; db.exec("INSERT INTO mutation_witness VALUES ('during-proof')"); } };
    expect(() => x.store.accept('end')).toThrow(/changed|transaction|read.?only/);
    expect(reached).toBe(true); assertEmpty(x.peer);
    expect(x.peer.prepare('SELECT * FROM mutation_witness').all()).toEqual([]);
  } finally { x.close(); }
});

// This injector never retains unrelated native statements. It changes state
// only once, after the retained third proof, at the real final fence read.
const injectFinalFenceRead = (db: DatabaseSync, when: 'prepare' | 'after-read', mutation: (db: DatabaseSync) => void) => {
  const prepare = db.prepare; let reached = false;
  db.prepare = function(sql, ...options) {
    const statement = prepare.call(this, sql, ...options);
    if (state.current.filter(Boolean).length !== 3 || !sql.startsWith('SELECT * FROM actual_live_play_fences WHERE') || reached) return statement;
    const mutate = () => { reached = true; mutation(db); };
    if (when === 'prepare') mutate();
    else {
      const all = statement.all;
      statement.all = function(...args: unknown[]) { const rows = Reflect.apply(all, this, args); mutate(); return rows; };
    }
    return statement;
  };
  return { reached: () => reached, close() { db.prepare = prepare; } };
};

it.each(['prepare', 'after-read'] as const)('rejects an injected %s write after the proof and before accepting its row authentication', when => {
  const x = fixture(), hook = injectFinalFenceRead(x.writer, when, db => db.exec("INSERT INTO mutation_witness VALUES ('during-authentication')"));
  try {
    expect(() => x.store.accept('end')).toThrow(/changed|transaction|read.?only/);
    expect(hook.reached()).toBe(true); assertEmpty(x.peer);
    expect(x.peer.prepare('SELECT * FROM mutation_witness').all()).toEqual([]);
  } finally { hook.close(); x.close(); }
});

it.each(['main', 'temp'] as const)('rejects a %s schema-only change that total_changes cannot see', schema => {
  const x = fixture(); let counterUnchanged = false;
  const hook = injectFinalFenceRead(x.writer, 'after-read', db => {
    const before = db.prepare('SELECT total_changes() AS changes').get()!.changes;
    try { db.exec(`CREATE TABLE ${schema}.changed_during_proof(value TEXT)`); }
    finally { counterUnchanged = db.prepare('SELECT total_changes() AS changes').get()!.changes === before; }
  });
  try {
    expect(() => x.store.accept('end')).toThrow(/changed|schema|transaction|read.?only/);
    expect(hook.reached()).toBe(true); expect(counterUnchanged).toBe(true); assertEmpty(x.peer);
    expect(x.writer.prepare(`SELECT 1 FROM ${schema}.sqlite_master WHERE name='changed_during_proof'`).get()).toBeUndefined();
  } finally { hook.close(); x.close(); }
});

it('rejects ending and replacing the writer transaction even when isTransaction and total_changes are unchanged', () => {
  const x = fixture(); let sameCounters = false;
  const hook = injectFinalFenceRead(x.writer, 'after-read', db => {
    const before = db.prepare('SELECT total_changes() AS changes').get()!.changes;
    // query_only blocks BEGIN IMMEDIATE itself; deferred BEGIN still tests
    // a replaced transaction with unchanged counters and a missing sentinel.
    db.exec('ROLLBACK; BEGIN');
    sameCounters = db.isTransaction === true && db.prepare('SELECT total_changes() AS changes').get()!.changes === before;
  });
  try {
    expect(() => x.store.accept('end')).toThrow(/transaction|savepoint|changed/);
    expect(hook.reached()).toBe(true); expect(sameCounters).toBe(true); assertEmpty(x.peer);
  } finally { hook.close(); x.close(); }
});


it.each([false, true])('preserves the original proof error and leaves no open transaction (proof ended transaction=%s)', endTransaction => {
  const x = fixture(), original = new Error('original post-trigger proof rejection');
  try {
    state.beforeReturn = (db, invocation) => {
      if (invocation !== 3) return;
      if (endTransaction) db.exec('ROLLBACK');
      throw original;
    };
    let caught: unknown;
    try { x.store.accept('end'); } catch (error) { caught = error; }
    expect(caught).toBe(original); expect(x.writer.isTransaction).toBe(false); assertEmpty(x.peer);
    state.beforeReturn = null; state.current = []; state.rowsAtDerive = [];
    expect(x.store.accept('end').kind).toBe('ended');
    expect(x.writer.isTransaction).toBe(false);
    expect(state.current).toEqual([true, true, true]);
  } finally { x.close(); }
});

it('retires the writer and closes its handle when rollback fails, retaining validation and cleanup errors', () => {
  const x = fixture(), original = new Error('original proof failure'), cleanup = new Error('injected rollback failure');
  const exec = x.writer.exec;
  x.writer.exec = function(sql) { if (sql === 'ROLLBACK') throw cleanup; return exec.call(this, sql); };
  try {
    state.beforeReturn = (_db, invocation) => { if (invocation === 3) throw original; };
    let caught: unknown;
    try { x.store.accept('end'); } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(AggregateError);
    expect((caught as AggregateError).cause).toBe(original);
    expect((caught as AggregateError).errors).toEqual([original, cleanup]);
    expect(x.writer.isOpen).toBe(false); assertEmpty(x.peer);
    for (const method of ['accept', 'evaluate', 'read'] as const) expect(() => x.store[method]('end')).toThrow(/closed/);
  } finally { x.writer.exec = exec; x.close(); }
});

it('keeps a failed-cleanup store retired while allowing close to retry a previously failed native close', () => {
  const x = fixture(), original = new Error('original proof failure'), rollbackError = new Error('injected rollback failure'), closeError = new Error('injected close failure');
  const exec = x.writer.exec, close = x.writer.close;
  x.writer.exec = function(sql) { if (sql === 'ROLLBACK') throw rollbackError; return exec.call(this, sql); };
  x.writer.close = () => { throw closeError; };
  try {
    state.beforeReturn = (_db, invocation) => { if (invocation === 3) throw original; };
    let caught: unknown;
    try { x.store.accept('end'); } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(AggregateError);
    expect((caught as AggregateError).cause).toBe(original);
    expect((caught as AggregateError).errors).toEqual([original, rollbackError, closeError]);
    expect(x.writer.isOpen).toBe(true); expect(x.writer.isTransaction).toBe(true);
    for (const method of ['accept', 'evaluate', 'read'] as const) expect(() => x.store[method]('end')).toThrow(/closed/);
    x.writer.exec = exec; x.writer.close = close;
    x.store.close(); expect(x.writer.isOpen).toBe(false); assertEmpty(x.peer);
    expect(() => x.store.close()).not.toThrow();
  } finally { x.writer.exec = exec; x.writer.close = close; x.close(); }
});


it('rejects a transient TEMP shadow that hides a seal-corrupted dependency then rolls back every sampled schema change', () => {
  const x = fixture(); let shadowCreated = false, endpointsRestored = false;
  try {
    x.peer.exec("CREATE TABLE proof_dependency(value TEXT); INSERT INTO proof_dependency VALUES ('proof');");
    x.peer.exec("CREATE TRIGGER corrupt_proof_dependency AFTER INSERT ON actual_live_play_fences BEGIN UPDATE proof_dependency SET value='corrupt'; END;");
    state.dependency = true;
    state.dependencyHook = (db, invocation) => {
      if (invocation !== 3) return;
      const stamp = () => [db.prepare('SELECT total_changes() AS changes').get()!.changes,
        db.prepare('PRAGMA main.schema_version').get()!.schema_version,
        db.prepare('PRAGMA temp.schema_version').get()!.schema_version, db.isTransaction];
      const before = stamp();
      db.exec("SAVEPOINT transient_shadow; CREATE TEMP VIEW proof_dependency AS SELECT 'proof' AS value;");
      shadowCreated = true;
      return () => { db.exec('ROLLBACK TO transient_shadow; RELEASE transient_shadow'); endpointsRestored = json(stamp()) === json(before); };
    };
    let caught: unknown;
    try { x.store.accept('end'); } catch (error) { caught = error; }
    // RED control: the old unguarded reuse accepts, even though the independent
    // public historical replay correctly rejects the now-unshadowed dependency.
    if (!caught) {
      expect(shadowCreated).toBe(true); expect(endpointsRestored).toBe(true);
      expect(() => x.store.read('end')).toThrow('corrupt original dependency');
    }
    expect(caught).toBeDefined();
    expect(String(caught)).toMatch(/read.?only|query.only|mutation|changed/);
    expect(shadowCreated).toBe(false); assertEmpty(x.peer);
    expect(x.peer.prepare('SELECT value FROM proof_dependency').get()!.value).toBe('proof');
    expect(x.writer.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  } finally { x.close(); }
});

it.each([false, true])('restores query_only after the protected proof (proof fails=%s)', failure => {
  const x = fixture(), original = new Error('original guarded proof error');
  try {
    if (failure) state.beforeReturn = (_db, invocation) => { if (invocation === 3) throw original; };
    let caught: unknown;
    try { x.store.accept('end'); } catch (error) { caught = error; }
    expect(caught).toBe(failure ? original : undefined);
    expect(state.queryModes).toEqual([0, 0, 1]);
    expect(x.writer.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    expect(x.writer.isTransaction).toBe(false);
    if (failure) assertEmpty(x.peer);
  } finally { x.close(); }
});

it('preserves an already-ON read-only setting at the post-trigger bracket boundary', () => {
  const x = fixture();
  const witness = witnessSqliteWrite('INSERT INTO actual_live_play_fences VALUES(?,?,?,?)', db => {
    db.exec('PRAGMA query_only=ON'); return true;
  });
  try {
    expect(x.store.accept('end').kind).toBe('ended'); expect(witness.wasReached()).toBe(true);
    expect(state.queryModes).toEqual([0, 0, 1]);
    expect(x.writer.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
    expect(x.store.read('end')!.kind).toBe('ended');
    expect(x.writer.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
  } finally { witness.close(); x.close(); }
});

it.each([[false, false], [false, true], [true, false], [true, true]] as const)('retires on query_only restoration failure and retains close cleanup retry (proof fails=%s, native close fails=%s)', (proofFails, closeFails) => {
  const x = fixture(), original = new Error('original guarded proof error'), restoreError = new Error('injected query_only restore failure'), closeError = new Error('injected native close failure');
  const exec = x.writer.exec, close = x.writer.close;
  x.writer.exec = function(sql) { if (/PRAGMA\s+query_only\s*=\s*OFF/i.test(sql)) throw restoreError; return exec.call(this, sql); };
  if (closeFails) x.writer.close = () => { throw closeError; };
  try {
    if (proofFails) state.beforeReturn = (_db, invocation) => { if (invocation === 3) throw original; };
    let caught: unknown;
    try { x.store.accept('end'); } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(AggregateError);
    const primary = proofFails ? original : restoreError, errors = proofFails ? [original, restoreError] : [restoreError];
    if (closeFails) errors.push(closeError);
    expect((caught as AggregateError).cause).toBe(primary);
    expect((caught as AggregateError).errors).toEqual(errors);
    expect(x.writer.isOpen).toBe(closeFails);
    for (const method of ['accept', 'evaluate', 'read'] as const) expect(() => x.store[method]('end')).toThrow(/closed|retired/);
    x.writer.exec = exec; x.writer.close = close; x.store.close();
    expect(x.writer.isOpen).toBe(false); assertEmpty(x.peer);
  } finally { x.writer.exec = exec; x.writer.close = close; x.close(); }
});

it('rejects an unexpected query_only flag change during the retained proof and restores the prior setting', () => {
  const x = fixture(); let reached = false, unchangedCounter = false;
  try {
    state.beforeReturn = (db, invocation) => {
      if (invocation !== 3) return;
      expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
      const before = db.prepare('SELECT total_changes() AS changes').get()!.changes;
      db.exec('PRAGMA query_only=OFF'); reached = true;
      unchangedCounter = db.prepare('SELECT total_changes() AS changes').get()!.changes === before;
    };
    expect(() => x.store.accept('end')).toThrow(/query.only|read.?only|changed/);
    expect(reached).toBe(true); expect(unchangedCounter).toBe(true); assertEmpty(x.peer);
    expect(x.writer.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    expect(x.writer.isTransaction).toBe(false);
  } finally { x.close(); }
});
