import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { expect, it, vi } from 'vitest';
import * as pitches from './PhysicalPitchEvidenceFromSqlite';
import * as executions from './SqliteBattedWorldFieldExecutionStore';
import { activeBattedWorldFieldReadFrame } from './SqliteBattedWorldFieldStore';
import { battedBallFlightFixture } from './BattedBallFlightFixtures.test-support';
import { openSqliteBattedBallFlightStore } from './SqliteBattedBallFlightStore';

const { DatabaseSync: Sqlite } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type ReadEvent = { name: 'prefix' | 'rows' | 'current'; db: DatabaseSync; transaction: boolean;
  queryOnly: number; writer: boolean; fieldFrame: object | null; physicalTraversal: boolean };
type CallbackEvent = { name: 'authority' | 'peer'; transaction: boolean | null; queryOnly: number | null;
  fieldFrame: object | null };

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
    const restores: { mockRestore(): void }[] = [];
    let db: DatabaseSync | undefined, writer = false, inPeer = false;
    let readHook: ((event: ReadEvent) => void) | undefined;
    let callbackHook: ((event: CallbackEvent) => void) | undefined;
    const traversalConnections: unknown[] = [];
    cleanups.push(() => {
      readHook = undefined; callbackHook = undefined;
      try { if (db?.isTransaction) db.exec('ROLLBACK'); }
      finally { while (restores.length) restores.pop()!.mockRestore(); }
    });
    const queryOnly = (connection: DatabaseSync) => Number(connection.prepare('PRAGMA query_only').get()!.query_only);
    const observe = (name: ReadEvent['name'], raw: unknown) => {
      if (inPeer) return;
      expect(raw).toBeInstanceOf(Sqlite);
      const connection = raw as DatabaseSync;
      if (!db) {
        db = connection;
        const exec = db.exec.bind(db);
        restores.push(vi.spyOn(db, 'exec').mockImplementation(sql => {
          const value = exec(sql); statements.push(sql);
          if (/^BEGIN IMMEDIATE\b/i.test(sql)) writer = true;
          if (/^(COMMIT|ROLLBACK)\s*;?$/i.test(sql)) writer = false;
          return value;
        }));
      }
      expect(connection).toBe(db);
      const event: ReadEvent = { name, db: connection, transaction: connection.isTransaction,
        queryOnly: queryOnly(connection), writer, fieldFrame: activeBattedWorldFieldReadFrame(connection),
        physicalTraversal: traversalConnections.includes(connection) };
      events.push(event); readHook?.(event);
    };
    const realTraversal = executions.withBattedWorldPhysicalReadTraversal;
    const traversal = <T>(connection: Parameters<typeof realTraversal>[0], body: () => T): T => realTraversal(connection, () => {
      traversalConnections.push(connection);
      try { return body(); } finally { traversalConnections.pop(); }
    });
    restores.push(vi.spyOn(executions, 'withBattedWorldPhysicalReadTraversal').mockImplementation(traversal));
    const prefix = pitches.readOriginalPhysicalPitchPrefixFromSqlite;
    restores.push(vi.spyOn(pitches, 'readOriginalPhysicalPitchPrefixFromSqlite').mockImplementation((...args) => {
      observe('prefix', args[0]); return prefix(...args);
    }));
    const rows = pitches.captureOriginalPhysicalPitchRows;
    restores.push(vi.spyOn(pitches, 'captureOriginalPhysicalPitchRows').mockImplementation((...args) => {
      observe('rows', args[0]); return rows(...args);
    }));
    const current = pitches.readPhysicalPitchProgressFromSqlite;
    restores.push(vi.spyOn(pitches, 'readPhysicalPitchProgressFromSqlite').mockImplementation((...args) => {
      observe('current', args[0]); return current(...args);
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
    return { ...base, flights, events, callbacks, statements, close,
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
    const prewrite = appendEvents.filter(event => !event.writer);
    expect(prewrite.map(event => event.name)).toEqual(['prefix', 'rows', 'current']);
    expect(new Set(prewrite.map(event => event.fieldFrame)).size).toBe(1);
    expect(x.events.some(event => event.writer && event.transaction && event.queryOnly === 0)).toBe(true);
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
    expect(prewrite).toEqual([0, 0, 0]); expect(later.length).toBeGreaterThan(0); expect(later.every(value => value === 1)).toBe(true);
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
