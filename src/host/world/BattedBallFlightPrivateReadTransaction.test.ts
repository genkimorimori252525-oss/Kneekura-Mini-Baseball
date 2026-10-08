import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { expect, it, vi } from 'vitest';
import * as pitches from './PhysicalPitchEvidenceFromSqlite';
import * as executions from './SqliteBattedWorldFieldExecutionStore';
import * as admissions from './ActualLivePlayFence';
import { activeBattedWorldFieldReadFrame } from './SqliteBattedWorldFieldStore';
import { battedBallFlightFixture } from './BattedBallFlightFixtures.test-support';
import { openSqliteBattedBallFlightStore } from './SqliteBattedBallFlightStore';

const { DatabaseSync: Sqlite } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type ReadEvent = { name: 'pair' | 'prefix' | 'rows' | 'current'; edge: 'entry' | 'exit'; db: DatabaseSync; transaction: boolean;
  queryOnly: number; writer: boolean; fieldFrame: object | null; physicalTraversal: boolean };
type Context = Pick<ReadEvent, 'transaction' | 'queryOnly' | 'fieldFrame' | 'physicalTraversal'>;
type Boundary = Context & { name: 'insert' | 'admission' | 'openFrame-current' | 'openFrame-tail';
  edge: 'entry' | 'exit'; writer: boolean; priorFrame: object | null };
type TraversalExit = { before: Context; after: Context; writer: boolean };
type CallbackEvent = { name: 'authority' | 'peer'; transaction: boolean | null; queryOnly: number | null;
  fieldFrame: object | null };
// A typed view of the future owner export compiles against unchanged production;
// its absence fails explicitly instead of skipping the observation or supplying
// synthetic prefix/row evidence.
type PairedPitchModule = typeof pitches & { readOriginalPhysicalPitchWithRowsFromSqlite(
  ...args: Parameters<typeof pitches.readOriginalPhysicalPitchPrefixFromSqlite>
): Readonly<{ prefix: readonly ReturnType<typeof pitches.readOriginalPhysicalPitchPrefixFromSqlite>[number][];
  originalPitchRows: ReturnType<typeof pitches.captureOriginalPhysicalPitchRows> }> };
const pairedPitches = pitches as PairedPitchModule;

// Observe the real flight connection at real physical owner entry points. Every
// owner, traversal, SQL statement and peer read still runs; nothing returns saved
// results instead of authentic evidence. The fixture is built before observation.
const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'flight-private-read-'));
  const cleanups: (() => void)[] = [() => rmSync(directory, { recursive: true, force: true })];
  const close = () => {
    const errors: unknown[] = [];
    while (cleanups.length) { try { cleanups.pop()!(); } catch (error) { errors.push(error); } }
    if (errors.length) throw new AggregateError(errors, 'flight private-read fixture cleanup failed');
  };
  try {
    const base = battedBallFlightFixture(join(directory, 'state.sqlite'));
    cleanups.push(() => base.f.close());
    base.flights.close();
    const events: ReadEvent[] = [], callbacks: CallbackEvent[] = [], statements: string[] = [];
    const boundaries: Boundary[] = [], traversalExits: TraversalExit[] = [];
    const restores: { mockRestore(): void }[] = [];
    let db: DatabaseSync | undefined, writer = false, inPeer = false;
    let writerPriorFrame: object | null = null;
    let readHook: ((event: ReadEvent) => void) | undefined;
    let callbackHook: ((event: CallbackEvent) => void) | undefined;
    const traversalConnections: unknown[] = [];
    cleanups.push(() => {
      readHook = undefined; callbackHook = undefined;
      try { if (db?.isTransaction) db.exec('ROLLBACK'); }
      finally { while (restores.length) restores.pop()!.mockRestore(); }
    });
    const queryOnly = (connection: DatabaseSync) => Number(connection.prepare('PRAGMA query_only').get()!.query_only);
    const context = (connection: DatabaseSync): Context => ({ transaction: connection.isTransaction,
      queryOnly: queryOnly(connection), fieldFrame: activeBattedWorldFieldReadFrame(connection),
      physicalTraversal: traversalConnections.includes(connection) });
    const boundary = (name: Boundary['name'], connection: DatabaseSync, edge: Boundary['edge']) => {
      if (!inPeer) boundaries.push({ name, edge, writer, priorFrame: writerPriorFrame, ...context(connection) });
    };
    const observe = (name: ReadEvent['name'], raw: unknown, edge: ReadEvent['edge'] = 'entry') => {
      if (inPeer) return;
      expect(raw).toBeInstanceOf(Sqlite);
      const connection = raw as DatabaseSync;
      if (!db) {
        db = connection;
        const exec = db.exec.bind(db);
        restores.push(vi.spyOn(db, 'exec').mockImplementation(sql => {
          const value = exec(sql); statements.push(sql);
          if (/^BEGIN IMMEDIATE\b/i.test(sql)) { writer = true; writerPriorFrame = activeBattedWorldFieldReadFrame(connection); }
          if (/^(COMMIT|ROLLBACK)\s*;?$/i.test(sql)) writer = false;
          return value;
        }));
        const prepare = db.prepare.bind(db);
        restores.push(vi.spyOn(db, 'prepare').mockImplementation(sql => {
          const statement = prepare(sql);
          if (/^INSERT\s+INTO\s+(?:batted_ball_flights|batted_ball_flight_heads)\b/i.test(sql)) {
            const run = statement.run.bind(statement);
            restores.push(vi.spyOn(statement, 'run').mockImplementation((...args) => {
              boundary('insert', connection, 'entry');
              try { return run(...args); } finally { boundary('insert', connection, 'exit'); }
            }));
          }
          // The store's openFrame is a same-module closure. Observe its actual
          // first reader below and final SQL operation here, not a replacement
          // openFrame implementation. Only its pure scalar comparison remains
          // after this genuine get() returns; this is explicitly a tail witness.
          if (sql === 'SELECT revision,state_json FROM world_player_workload_heads WHERE career_id=? AND player_id=?') {
            const get = statement.get.bind(statement);
            restores.push(vi.spyOn(statement, 'get').mockImplementation((...args) => {
              boundary('openFrame-tail', connection, 'entry');
              try { return get(...args); } finally { boundary('openFrame-tail', connection, 'exit'); }
            }));
          }
          return statement;
        }));
      }
      expect(connection).toBe(db);
      const event: ReadEvent = { name, edge, db: connection, writer, ...context(connection) };
      events.push(event); if (edge === 'entry') readHook?.(event);
    };
    const realTraversal = executions.withBattedWorldPhysicalReadTraversal;
    const traversal = <T>(connection: Parameters<typeof realTraversal>[0], body: () => T): T => {
      if (inPeer) return realTraversal(connection, body);
      expect(connection).toBeInstanceOf(Sqlite);
      const native = connection as DatabaseSync, before = context(native), wasWriter = writer;
      try { return realTraversal(connection, () => {
        traversalConnections.push(connection);
        try { return body(); } finally { traversalConnections.pop(); }
      }); } finally { traversalExits.push({ before, after: context(native), writer: wasWriter }); }
    };
    restores.push(vi.spyOn(executions, 'withBattedWorldPhysicalReadTraversal').mockImplementation(traversal));
    const pair = pairedPitches.readOriginalPhysicalPitchWithRowsFromSqlite;
    expect(pair, 'approved paired owner export must exist').toBeTypeOf('function');
    restores.push(vi.spyOn(pairedPitches, 'readOriginalPhysicalPitchWithRowsFromSqlite').mockImplementation((...args) => {
      observe('pair', args[0]); try { return pair(...args); } finally { observe('pair', args[0], 'exit'); }
    }));
    const prefix = pitches.readOriginalPhysicalPitchPrefixFromSqlite;
    restores.push(vi.spyOn(pitches, 'readOriginalPhysicalPitchPrefixFromSqlite').mockImplementation((...args) => {
      observe('prefix', args[0]); try { return prefix(...args); } finally { observe('prefix', args[0], 'exit'); }
    }));
    const rows = pitches.captureOriginalPhysicalPitchRows;
    restores.push(vi.spyOn(pitches, 'captureOriginalPhysicalPitchRows').mockImplementation((...args) => {
      observe('rows', args[0]); try { return rows(...args); } finally { observe('rows', args[0], 'exit'); }
    }));
    const current = pitches.readPhysicalPitchProgressFromSqlite;
    restores.push(vi.spyOn(pitches, 'readPhysicalPitchProgressFromSqlite').mockImplementation((...args) => {
      observe('current', args[0]);
      if (!inPeer) boundary('openFrame-current', args[0] as DatabaseSync, 'entry');
      try { return current(...args); } finally {
        observe('current', args[0], 'exit');
        if (!inPeer) boundary('openFrame-current', args[0] as DatabaseSync, 'exit');
      }
    }));
    const admission = admissions.recordActualLivePlayAdmission;
    restores.push(vi.spyOn(admissions, 'recordActualLivePlayAdmission').mockImplementation((...args) => {
      if (!inPeer) { expect(args[0]).toBe(db); boundary('admission', args[0] as DatabaseSync, 'entry'); }
      try { return admission(...args); } finally {
        if (!inPeer) boundary('admission', args[0] as DatabaseSync, 'exit');
      }
    }));
    const callback = (name: CallbackEvent['name']) => {
      const event = { name, transaction: db?.isTransaction ?? null, queryOnly: db ? queryOnly(db) : null,
        fieldFrame: db ? activeBattedWorldFieldReadFrame(db) : null };
      callbacks.push(event); callbackHook?.(event);
    };
    const flights = base.f.track(openSqliteBattedBallFlightStore(base.f.path, { readAcceptedPitch: sourceId => {
      callback('peer'); inPeer = true;
      try { return base.pitches.readAcceptedPitch(sourceId); } finally { inPeer = false; }
    } }, { readAcceptedFlight: sourceId => { callback('authority'); return base.acceptedFlights.get(sourceId) ?? null; } }));
    return { ...base, flights, events, callbacks, statements, boundaries, traversalExits, close,
      accept: () => flights.accept(base.input.sourceId), read: () => flights.read(base.input.sourceId),
      connection: () => { expect(db).toBeInstanceOf(Sqlite); return db!; },
      count: () => Number(base.f.db.prepare('SELECT count(*) AS n FROM batted_ball_flights').get()!.n),
      setReadHook(hook?: (event: ReadEvent) => void) { readHook = hook; },
      setCallbackHook(hook?: (event: CallbackEvent) => void) { callbackHook = hook; } };
  } catch (error) {
    try { close(); } catch (cleanup) { throw new AggregateError([error, cleanup], 'flight private-read fixture setup failed', { cause: error }); }
    throw error;
  }
};

const expectReleased = (x: ReturnType<typeof fixture>) => {
  const db = x.connection();
  expect(db.isTransaction).toBe(false);
  expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  expect(activeBattedWorldFieldReadFrame(db)).toBeNull();
};

it('flight: owns a query-only physical traversal for each private read group before callbacks and writes', () => {
  const x = fixture();
  try {
    const first = x.accept(), appendEvents = [...x.events];
    expect(x.read()).toEqual(first); expect(x.accept()).toEqual(first); expect(x.count()).toBe(1);
    const reads = x.events.filter(event => !event.writer);
    expect(reads.length).toBeGreaterThan(5);
    expect(reads.every(event => event.transaction)).toBe(true);
    expect(reads.every(event => event.queryOnly === 1 && event.fieldFrame !== null && event.physicalTraversal)).toBe(true);
    const prewrite = appendEvents.filter(event => !event.writer && event.edge === 'entry');
    expect(prewrite.map(event => event.name)).toEqual(['pair', 'current']);
    expect(new Set(prewrite.map(event => event.fieldFrame)).size).toBe(1);
    const writerPairs = appendEvents.filter(event => event.writer && event.name === 'pair');
    expect(writerPairs.filter(event => event.edge === 'entry')).toHaveLength(2);
    expect(writerPairs.filter(event => event.edge === 'exit')).toHaveLength(2);
    expect(writerPairs.every(event => event.transaction && event.queryOnly === 1 && event.fieldFrame !== null && event.physicalTraversal)).toBe(true);
    const pairFrames: (object | null)[] = [];
    for (const event of writerPairs) {
      if (event.edge === 'entry') pairFrames.push(event.fieldFrame);
      else expect(event.fieldFrame).toBe(pairFrames.pop());
    }
    expect(pairFrames).toHaveLength(0);
    expect(new Set([...prewrite.filter(event => event.name === 'pair'), ...writerPairs].map(event => event.fieldFrame)).size).toBe(3);
    const writerOutside = x.boundaries.filter(event => event.writer);
    expect(writerOutside.length).toBeGreaterThan(0);
    expect(writerOutside.every(event => event.transaction && event.queryOnly === 0 && !event.physicalTraversal)).toBe(true);
    for (const event of writerOutside) { expect(event.fieldFrame).toBe(event.priorFrame); expect(event.priorFrame).toBeNull(); }
    for (const [name, count] of [['insert', 2], ['admission', 1], ['openFrame-current', 2], ['openFrame-tail', 2]] as const) {
      const observed = writerOutside.filter(event => event.name === name);
      expect(observed.filter(event => event.edge === 'entry')).toHaveLength(count);
      expect(observed.filter(event => event.edge === 'exit')).toHaveLength(count);
    }
    const localDerives = x.traversalExits.filter(event => event.writer);
    expect(localDerives).toHaveLength(2);
    for (const scope of localDerives) {
      expect(scope.before).toEqual({ transaction: true, queryOnly: 0, fieldFrame: null, physicalTraversal: false });
      expect(scope.after.transaction).toBe(true); expect(scope.after.queryOnly).toBe(scope.before.queryOnly);
      expect(scope.after.fieldFrame).toBe(scope.before.fieldFrame); expect(scope.after.physicalTraversal).toBe(false);
    }
    const observedCallbacks = x.callbacks.filter(event => event.transaction !== null);
    expect(observedCallbacks.map(event => event.name)).toEqual(['peer', 'authority']);
    expect(observedCallbacks.every(event => !event.transaction && event.queryOnly === 0 && event.fieldFrame === null)).toBe(true);
    expectReleased(x);
  } finally { x.close(); }
});

it('flight: keeps a WAL commit outside one read group and observes it in the next group', () => {
  const x = fixture(), snapshots: number[] = [], prewrite: number[] = [], later: number[] = [];
  let changed = false;
  try {
    x.f.db.exec('CREATE TABLE flight_read_probe(value INTEGER NOT NULL); INSERT INTO flight_read_probe VALUES(0)');
    x.setReadHook(event => {
      const value = () => Number(event.db.prepare('SELECT value FROM flight_read_probe').get()!.value);
      if (!changed && !event.writer) {
        changed = true; snapshots.push(value()); x.f.db.exec('UPDATE flight_read_probe SET value=1'); snapshots.push(value());
      }
      (event.writer ? later : prewrite).push(value());
    });
    const first = x.accept();
    expect(changed).toBe(true); expect(snapshots).toEqual([0, 0]);
    expect(prewrite).toEqual([0, 0]); expect(later.length).toBeGreaterThan(0); expect(later.every(value => value === 1)).toBe(true);
    x.setReadHook(event => later.push(Number(event.db.prepare('SELECT value FROM flight_read_probe').get()!.value)));
    expect(x.read()).toEqual(first); expect(later.every(value => value === 1)).toBe(true); expectReleased(x);
  } finally { x.close(); }
});

it('flight: preserves the owner error and rolls back its failed private read before a fresh retry', () => {
  const x = fixture(), failure = new Error('flight-private-owner-failure');
  x.setReadHook(() => { throw failure; });
  try {
    let caught: unknown; try { x.accept(); } catch (error) { caught = error; }
    expect(caught).toBe(failure); expect(x.count()).toBe(0);
    expect(x.statements.filter(sql => /^ROLLBACK\s*;?$/i.test(sql))).toHaveLength(1); expectReleased(x);
    x.setReadHook(); expect(x.accept().revision).toBe(1); expect(x.count()).toBe(1); expectReleased(x);
  } finally { x.close(); }
});

it('flight: rejects mutation on its private read connection and restores writable state before append', () => {
  const x = fixture(); let attempted = false;
  try {
    x.f.db.exec('CREATE TABLE flight_read_probe(value INTEGER NOT NULL)');
    x.setReadHook(event => {
      if (attempted || event.writer) return; attempted = true;
      expect(() => event.db.exec('INSERT INTO flight_read_probe VALUES(1)')).toThrow(/readonly/i);
    });
    expect(x.accept().revision).toBe(1); expect(attempted).toBe(true);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM flight_read_probe').get()!.n).toBe(0); expectReleased(x);
  } finally { x.close(); }
});

it('flight: sees authority commits in the following derive group', () => {
  const x = fixture(), observations: number[] = [];
  try {
    x.f.db.exec('CREATE TABLE flight_read_probe(value INTEGER NOT NULL); INSERT INTO flight_read_probe VALUES(0)');
    x.setCallbackHook(event => { if (event.name === 'authority') x.f.db.exec('UPDATE flight_read_probe SET value=1'); });
    x.setReadHook(event => observations.push(Number(event.db.prepare('SELECT value FROM flight_read_probe').get()!.value)));
    expect(x.accept().revision).toBe(1); expect(observations.length).toBeGreaterThan(0);
    expect(observations.every(value => value === 1)).toBe(true); expectReleased(x);
  } finally { x.close(); }
});

it('flight: rejects a peer callback archive mutation before append while preserving the peer commit', () => {
  const x = fixture(); let changed = false;
  try {
    x.setCallbackHook(event => {
      if (event.name !== 'peer') return;
      expect(event.transaction).toBe(false); expect(event.queryOnly).toBe(0); expect(event.fieldFrame).toBeNull();
      x.f.db.prepare("UPDATE physical_pitch_progress_actions SET source_hash='peer-committed' WHERE source_id=?").run(x.input.physicalPitchSourceId);
      changed = true;
    });
    expect(() => x.accept()).toThrow(); expect(changed).toBe(true); expect(x.count()).toBe(0);
    expect(x.f.db.prepare('SELECT source_hash FROM physical_pitch_progress_actions WHERE source_id=?').get(x.input.physicalPitchSourceId)!.source_hash).toBe('peer-committed');
    expectReleased(x);
  } finally { x.close(); }
});

it('flight: rejects a retry authority mutation after ending the original read snapshot', () => {
  const x = fixture(); let changed = false;
  try {
    x.accept();
    x.setCallbackHook(event => {
      if (event.name !== 'authority') return;
      expect(event.transaction).toBe(false); expect(event.queryOnly).toBe(0); expect(event.fieldFrame).toBeNull();
      x.f.db.prepare("UPDATE physical_pitch_progress_actions SET source_hash='retry-committed' WHERE source_id=?").run(x.input.physicalPitchSourceId);
      changed = true;
    });
    expect(() => x.accept()).toThrow(); expect(changed).toBe(true); expect(x.count()).toBe(1);
    expect(x.f.db.prepare('SELECT source_hash FROM physical_pitch_progress_actions WHERE source_id=?').get(x.input.physicalPitchSourceId)!.source_hash).toBe('retry-committed');
    expectReleased(x);
  } finally { x.close(); }
});

it('flight: leaves caller read and writer transactions owned by the caller on success and failure', () => {
  const x = fixture(), failure = new Error('caller-owned-flight-read-failure');
  try {
    const first = x.accept(), db = x.connection();
    x.f.db.exec('CREATE TABLE flight_read_probe(value INTEGER NOT NULL)');
    db.exec('BEGIN'); expect(x.read()).toEqual(first); expect(db.isTransaction).toBe(true); db.exec('ROLLBACK');
    db.exec('BEGIN IMMEDIATE'); db.exec('INSERT INTO flight_read_probe VALUES(7)');
    expect(x.read()).toEqual(first); expect(db.isTransaction).toBe(true);
    const rollbackCount = x.statements.filter(sql => /^ROLLBACK\s*;?$/i.test(sql)).length;
    x.setReadHook(() => { throw failure; });
    let caught: unknown; try { x.read(); } catch (error) { caught = error; }
    expect(caught).toBe(failure); expect(db.isTransaction).toBe(true);
    expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    expect(db.prepare('SELECT value FROM flight_read_probe').get()!.value).toBe(7);
    expect(x.statements.filter(sql => /^ROLLBACK\s*;?$/i.test(sql))).toHaveLength(rollbackCount);
    x.setReadHook(); db.exec('COMMIT'); expect(x.f.db.prepare('SELECT value FROM flight_read_probe').get()!.value).toBe(7);
    db.exec('PRAGMA query_only=ON; BEGIN'); expect(x.read()).toEqual(first);
    expect(db.isTransaction).toBe(true); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
    db.exec('ROLLBACK; PRAGMA query_only=OFF'); expectReleased(x);
    db.exec('BEGIN IMMEDIATE'); db.exec('INSERT INTO flight_read_probe VALUES(8)');
    const nestedRollbacks = x.statements.filter(sql => /^ROLLBACK\s*;?$/i.test(sql)).length;
    executions.withBattedWorldPhysicalReadTraversal(db, () => {
      const parentFrame = activeBattedWorldFieldReadFrame(db); expect(parentFrame).not.toBeNull();
      const start = x.events.length;
      expect(x.read()).toEqual(first);
      expect(x.events.slice(start).filter(event => event.name === 'pair' && event.edge === 'entry')).toHaveLength(1);
      expect(x.events.slice(start).every(event => event.fieldFrame === parentFrame && event.queryOnly === 1)).toBe(true);
      x.setReadHook(() => { throw failure; });
      caught = undefined; try { x.read(); } catch (error) { caught = error; }
      expect(caught).toBe(failure); expect(activeBattedWorldFieldReadFrame(db)).toBe(parentFrame);
      expect(db.isTransaction).toBe(true); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
      expect(db.prepare('SELECT value FROM flight_read_probe ORDER BY value').all().map(row => row.value)).toEqual([7, 8]);
      x.setReadHook(); expect(x.read()).toEqual(first);
    });
    expect(db.isTransaction).toBe(true); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    expect(activeBattedWorldFieldReadFrame(db)).toBeNull();
    expect(x.statements.filter(sql => /^ROLLBACK\s*;?$/i.test(sql))).toHaveLength(nestedRollbacks);
    db.exec('COMMIT'); expectReleased(x);
  } finally { x.close(); }
});

it('flight: retains real writer rollback and permits a fresh append after trigger removal', () => {
  const x = fixture();
  try {
    x.f.db.exec("CREATE TRIGGER fail_flight_writer AFTER INSERT ON batted_ball_flights BEGIN SELECT RAISE(ABORT,'real flight writer failure'); END");
    expect(() => x.accept()).toThrow('real flight writer failure'); expect(x.count()).toBe(0); expectReleased(x);
    x.f.db.exec('DROP TRIGGER fail_flight_writer'); expect(x.accept().revision).toBe(1); expect(x.count()).toBe(1); expectReleased(x);
  } finally { x.close(); }
});

it('flight: excludes competing writers during real writer revalidation', () => {
  const x = fixture(); let attempted = false, failure: unknown;
  try {
    x.f.db.exec('PRAGMA busy_timeout=0');
    x.setReadHook(event => {
      if (!event.writer || attempted) return; attempted = true;
      try { x.f.db.exec('UPDATE matches SET durable_revision=durable_revision+1'); } catch (error) { failure = error; }
    });
    expect(x.accept().revision).toBe(1); expect(attempted).toBe(true); expect(failure).toBeInstanceOf(Error);
    expect(String(failure)).toMatch(/locked|busy/); expect(x.count()).toBe(1); expectReleased(x);
    x.f.db.exec('BEGIN IMMEDIATE'); x.f.db.exec('ROLLBACK');
  } finally { x.close(); }
});
