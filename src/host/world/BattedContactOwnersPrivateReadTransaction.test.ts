import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { expect, it, vi } from 'vitest';
import * as pitches from './PhysicalPitchEvidenceFromSqlite';
import * as executions from './SqliteBattedWorldFieldExecutionStore';
import * as flightOwners from './SqliteBattedBallFlightStore';
import * as admissions from './ActualLivePlayFence';
import { activeBattedWorldFieldReadFrame } from './SqliteBattedWorldFieldStore';
import { battedWorldContactFixture } from './BattedWorldContactFixtures.test-support';
import { battedFirstFielderTouchFixture } from './BattedFirstFielderTouchFixtures.test-support';
import { battedContactResponseFixture } from './BattedContactResponseFixtures.test-support';
import { openSqliteBattedWorldContactStore } from './SqliteBattedWorldContactStore';
import { openSqliteBattedFirstFielderTouchStore } from './SqliteBattedFirstFielderTouchStore';
import { openSqliteBattedContactResponseStore } from './SqliteBattedContactResponseStore';

const { DatabaseSync: Sqlite } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Owner = 'contact' | 'touch' | 'response';
type Operation = 'pair' | 'prefix' | 'rows' | 'current' | 'insert' | 'admission' | 'openFrame';
type Event = { name: Operation; edge: 'entry' | 'exit'; db: DatabaseSync; transaction: boolean; queryOnly: number; writer: boolean;
  fieldFrame: object | null; writerPriorFrame: object | null; physicalTraversal: boolean; phase: string; value: number };
type TraversalExit = { before: Pick<Event, 'transaction' | 'queryOnly' | 'fieldFrame'>;
  after: Pick<Event, 'transaction' | 'queryOnly' | 'fieldFrame'>; writer: boolean; phase: string };
type Callback = { name: 'authority' | 'model' | 'peer'; transaction: boolean | null;
  queryOnly: number | null; fieldFrame: object | null };
// Test-only declaration of the approved future export keeps the unchanged
// production tree compilable. Absence is an explicit contract failure, never a
// skipped observer or a substitute implementation returning fabricated evidence.
type PairedPitchModule = typeof pitches & { readOriginalPhysicalPitchWithRowsFromSqlite(
  ...args: Parameters<typeof pitches.readOriginalPhysicalPitchPrefixFromSqlite>
): Readonly<{ prefix: readonly ReturnType<typeof pitches.readOriginalPhysicalPitchPrefixFromSqlite>[number][];
  originalPitchRows: ReturnType<typeof pitches.captureOriginalPhysicalPitchRows> }> };
const pairedPitches = pitches as PairedPitchModule;

// These observers forward the original functions unchanged. No module factory,
// importOriginal, synthetic physical evidence, or saved-result peer is used.
const fixture = (owner: Owner) => {
  const directory = mkdtempSync(join(tmpdir(), `batted-${owner}-private-read-`)), path = join(directory, 'state.sqlite');
  const cleanup: (() => void)[] = [() => rmSync(directory, { recursive: true, force: true })];
  const events: Event[] = [], callbacks: Callback[] = [], statements: string[] = [], restores: { mockRestore(): void }[] = [];
  const traversalExits: TraversalExit[] = [];
  let db: DatabaseSync | undefined, writer = false, inPeer = false, phase = 'setup';
  let writerPriorFrame: object | null = null;
  let readHook: ((event: Event) => void) | undefined, callbackHook: ((event: Callback) => void) | undefined;
  const queryOnly = (connection: DatabaseSync) => Number(connection.prepare('PRAGMA query_only').get()!.query_only);
  const close = () => { const errors: unknown[] = []; while (cleanup.length) {
    try { cleanup.pop()!(); } catch (error) { errors.push(error); }
  } if (errors.length) throw new AggregateError(errors, 'contact owner private-read cleanup failed'); };
  const callback = <T>(name: Callback['name'], work: () => T): T => {
    const event = { name, transaction: db?.isTransaction ?? null, queryOnly: db ? queryOnly(db) : null,
      fieldFrame: db ? activeBattedWorldFieldReadFrame(db) : null };
    callbacks.push(event); callbackHook?.(event);
    if (name !== 'peer') return work();
    inPeer = true; try { return work(); } finally { inPeer = false; }
  };
  try {
    // Complete genuine Native prerequisites before installing any observation.
    const setup = () => {
      if (owner === 'contact') {
        const base = battedWorldContactFixture(path, false, true); cleanup.push(() => base.f.close()); base.contacts.close();
        const openStore = () => base.f.track(openSqliteBattedWorldContactStore(path,
          { read: id => callback('peer', () => base.flights.read(id)) }, {
            readAcceptedContact: id => callback('authority', () => base.authority.readAcceptedContact(id)),
            readAcceptedModel: id => callback('model', () => base.authority.readAcceptedModel(id)),
          }));
        return { openStore, peerDb: base.f.db, sourceId: base.source.sourceId, table: 'batted_world_contacts' };
      }
      if (owner === 'touch') {
        const base = battedFirstFielderTouchFixture(path, 'airborne'); cleanup.push(() => base.f.close()); base.touches.close();
        const openStore = () => base.f.track(openSqliteBattedFirstFielderTouchStore(path,
          { read: id => callback('peer', () => base.contacts.read(id)) }, {
            readAcceptedTouch: id => callback('authority', () => base.touchAuthority.readAcceptedTouch(id)),
          }));
        return { openStore, peerDb: base.f.db, sourceId: base.touchSource.sourceId, table: 'batted_first_fielder_touches' };
      }
      const base = battedContactResponseFixture(path, 'airborne'); cleanup.push(() => base.f.close()); base.responses.close();
      const openStore = () => base.f.track(openSqliteBattedContactResponseStore(path,
        { read: id => callback('peer', () => base.touches.read(id)) }, {
          readAcceptedResponse: id => callback('authority', () => base.responseAuthority.readAcceptedResponse(id)),
          readAcceptedModel: id => callback('model', () => base.responseAuthority.readAcceptedModel(id)),
        }));
      return { openStore, peerDb: base.f.db, sourceId: base.responseSource.sourceId, table: 'batted_contact_responses' };
    };
    const base = setup(), traversalConnections: unknown[] = [];
    base.peerDb.exec('CREATE TABLE contact_read_probe(value INTEGER NOT NULL); INSERT INTO contact_read_probe VALUES(0)');
    cleanup.push(() => {
      readHook = undefined; callbackHook = undefined;
      try { if (db?.isTransaction) db.exec('ROLLBACK'); }
      finally { while (restores.length) restores.pop()!.mockRestore(); }
    });
    const observe = (name: Operation, raw: unknown, edge: Event['edge'] = 'entry') => {
      if (inPeer) return;
      expect(raw).toBeInstanceOf(Sqlite); const connection = raw as DatabaseSync;
      if (!db) {
        db = connection; const exec = db.exec.bind(db);
        restores.push(vi.spyOn(db, 'exec').mockImplementation(sql => {
          const value = exec(sql); statements.push(sql);
          if (/^BEGIN IMMEDIATE\b/i.test(sql)) { writer = true; writerPriorFrame = activeBattedWorldFieldReadFrame(connection); }
          if (/^(COMMIT|ROLLBACK)\s*;?$/i.test(sql)) writer = false;
          return value;
        }));
        const prepare = db.prepare.bind(db);
        restores.push(vi.spyOn(db, 'prepare').mockImplementation(sql => {
          const statement = prepare(sql);
          if (/^INSERT\s+INTO\s+(?:batted_world_models|batted_world_contacts|batted_world_contact_heads|batted_first_fielder_touches|batted_contact_response_models|batted_contact_responses)\b/i.test(sql)) {
            const run = statement.run.bind(statement);
            restores.push(vi.spyOn(statement, 'run').mockImplementation((...args) => {
              observe('insert', connection);
              try { return run(...args); } finally { observe('insert', connection, 'exit'); }
            }));
          }
          return statement;
        }));
      }
      expect(connection).toBe(db);
      const event: Event = { name, edge, db: connection, transaction: connection.isTransaction, queryOnly: queryOnly(connection), writer,
        fieldFrame: activeBattedWorldFieldReadFrame(connection), writerPriorFrame,
        physicalTraversal: traversalConnections.includes(connection), phase,
        value: Number(connection.prepare('SELECT value FROM contact_read_probe').get()!.value) };
      events.push(event);
      if (edge === 'entry' && ['pair', 'prefix', 'rows', 'current'].includes(name)) readHook?.(event);
    };
    const realTraversal = executions.withBattedWorldPhysicalReadTraversal;
    const traversal = <T>(connection: Parameters<typeof realTraversal>[0], work: () => T): T => {
      if (inPeer) return realTraversal(connection, work);
      expect(connection).toBeInstanceOf(Sqlite);
      const native = connection as DatabaseSync;
      const state = () => ({ transaction: native.isTransaction, queryOnly: queryOnly(native),
        fieldFrame: activeBattedWorldFieldReadFrame(native) });
      const before = state(), wasWriter = writer, currentPhase = phase;
      try { return realTraversal(connection, () => {
        traversalConnections.push(connection); try { return work(); } finally { traversalConnections.pop(); }
      }); } finally { traversalExits.push({ before, after: state(), writer: wasWriter, phase: currentPhase }); }
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
      observe('current', args[0]); try { return current(...args); } finally { observe('current', args[0], 'exit'); }
    }));
    const flightEvidence = flightOwners.battedBallFlightEvidenceFromSqlite;
    restores.push(vi.spyOn(flightOwners, 'battedBallFlightEvidenceFromSqlite').mockImplementation((...args) => {
      const evidence = flightEvidence(...args), openFrame = evidence.openFrame;
      restores.push(vi.spyOn(evidence, 'openFrame').mockImplementation((...frameArgs) => {
        observe('openFrame', args[0]);
        try { return openFrame(...frameArgs); } finally { observe('openFrame', args[0], 'exit'); }
      }));
      return evidence;
    }));
    const admission = admissions.recordActualLivePlayAdmission;
    restores.push(vi.spyOn(admissions, 'recordActualLivePlayAdmission').mockImplementation((...args) => {
      observe('admission', args[0]);
      try { return admission(...args); } finally { observe('admission', args[0], 'exit'); }
    }));
    const store = base.openStore();
    return { ...base, store, events, callbacks, statements, traversalExits, close,
      accept: () => store.accept(base.sourceId), read: () => store.read(base.sourceId),
      count: () => Number(base.peerDb.prepare(`SELECT count(*) AS n FROM ${base.table}`).get()!.n),
      connection: () => { expect(db).toBeInstanceOf(Sqlite); return db!; },
      setPhase(value: string) { phase = value; }, setReadHook(hook?: typeof readHook) { readHook = hook; },
      setCallbackHook(hook?: typeof callbackHook) { callbackHook = hook; } };
  } catch (error) { try { close(); } catch (cleanupError) {
    throw new AggregateError([error, cleanupError], 'contact owner private-read fixture setup failed', { cause: error });
  } throw error; }
};

const released = (x: ReturnType<typeof fixture>) => {
  const db = x.connection(); expect(db.isTransaction).toBe(false);
  expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0); expect(activeBattedWorldFieldReadFrame(db)).toBeNull();
};

for (const owner of ['contact', 'touch', 'response'] as const) it(`${owner}: owns fresh private snapshots and physical traversals across append, read and retry`, () => {
  const x = fixture(owner), snapshots: number[] = []; let changed = false;
  try {
    // A genuine AFTER INSERT mutation must still roll back the original writer.
    x.peerDb.exec(`CREATE TRIGGER alter_owner AFTER INSERT ON ${x.table} BEGIN UPDATE ${x.table} SET source_hash='changed'; END`);
    expect(() => x.accept()).toThrow(/corrupt|changed/); expect(x.count()).toBe(0); released(x);
    x.peerDb.exec('DROP TRIGGER alter_owner'); x.events.length = 0; x.callbacks.length = 0;
    x.setPhase('append');
    x.setCallbackHook(event => { if (event.name === 'authority') x.peerDb.exec('UPDATE contact_read_probe SET value=10');
      if (event.name === 'peer') x.peerDb.exec('UPDATE contact_read_probe SET value=12'); });
    x.setReadHook(event => {
      if (changed || event.writer) return; changed = true; snapshots.push(event.value);
      x.peerDb.exec('UPDATE contact_read_probe SET value=11');
      snapshots.push(Number(event.db.prepare('SELECT value FROM contact_read_probe').get()!.value));
    });
    const first = x.accept(); released(x); x.setReadHook(); x.setCallbackHook();
    x.setPhase('public'); expect(x.read()).toEqual(first); released(x);
    x.setPhase('retry');
    x.setCallbackHook(event => { if (event.name === 'authority') x.peerDb.exec('UPDATE contact_read_probe SET value=13'); });
    expect(x.accept()).toEqual(first); expect(x.count()).toBe(1); released(x); x.setCallbackHook();
    const reads = x.events.filter(event => !event.writer);
    expect(reads.length).toBeGreaterThan(5);
    expect(reads.every(event => event.transaction)).toBe(true);
    expect(reads.every(event => event.queryOnly === 1 && event.fieldFrame !== null && event.physicalTraversal)).toBe(true);
    expect(snapshots).toEqual([10, 10]);
    const prewrite = reads.filter(event => event.phase === 'append');
    expect(prewrite.every(event => event.value === 10)).toBe(true); expect(new Set(prewrite.map(event => event.fieldFrame)).size).toBe(1);
    const writes = x.events.filter(event => event.writer);
    const pairs = writes.filter(event => event.name === 'pair');
    const outside = writes.filter(event => ['insert', 'admission', 'openFrame', 'current'].includes(event.name));
    expect(pairs.length).toBeGreaterThan(0); expect(outside.length).toBeGreaterThan(0);
    expect(pairs.length + outside.length).toBe(writes.length);
    expect(writes.every(event => event.transaction && event.value === 12)).toBe(true);
    expect(pairs.every(event => event.queryOnly === 1 && event.fieldFrame !== null && event.physicalTraversal)).toBe(true);
    expect(outside.every(event => event.queryOnly === 0 && event.fieldFrame === null && !event.physicalTraversal)).toBe(true);
    for (const event of outside) expect(event.fieldFrame).toBe(event.writerPriorFrame);
    const pairFrames: (object | null)[] = [];
    for (const event of pairs) {
      if (event.edge === 'entry') pairFrames.push(event.fieldFrame);
      else expect(event.fieldFrame).toBe(pairFrames.pop());
    }
    expect(pairFrames).toHaveLength(0);
    for (const name of ['pair', 'insert', 'admission', 'openFrame'] as const) {
      const observed = writes.filter(event => event.name === name);
      expect(observed.filter(event => event.edge === 'entry').length).toBeGreaterThan(0);
      expect(observed.filter(event => event.edge === 'exit')).toHaveLength(observed.filter(event => event.edge === 'entry').length);
    }
    const localDerives = x.traversalExits.filter(event => event.writer && event.phase === 'append');
    expect(localDerives.length).toBeGreaterThan(0);
    for (const scope of localDerives) {
      expect(scope.before).toEqual({ transaction: true, queryOnly: 0, fieldFrame: null });
      expect(scope.after.transaction).toBe(true); expect(scope.after.queryOnly).toBe(scope.before.queryOnly);
      expect(scope.after.fieldFrame).toBe(scope.before.fieldFrame);
    }
    const publicReads = reads.filter(event => event.phase === 'public'), retryReads = reads.filter(event => event.phase === 'retry');
    expect(publicReads.length).toBeGreaterThan(0); expect(publicReads.every(event => event.value === 12)).toBe(true);
    expect(new Set(retryReads.map(event => event.value))).toEqual(new Set([12, 13]));
    expect(new Set(retryReads.map(event => event.fieldFrame)).size).toBe(2);
    expect(new Set(reads.map(event => event.fieldFrame)).size).toBe(4);
    expect(x.callbacks.every(event => event.transaction === false && event.queryOnly === 0 && event.fieldFrame === null)).toBe(true);

    // The same reader must leave an existing caller transaction owned by its caller.
    const db = x.connection(), failure = new Error(`${owner}-original-owner-error`);
    db.exec('BEGIN'); expect(x.read()).toEqual(first); expect(db.isTransaction).toBe(true); db.exec('ROLLBACK');
    db.exec('BEGIN IMMEDIATE'); db.exec('UPDATE contact_read_probe SET value=14');
    expect(x.read()).toEqual(first); expect(db.isTransaction).toBe(true);
    const rollbacks = x.statements.filter(sql => /^ROLLBACK\s*;?$/i.test(sql)).length;
    x.setReadHook(() => { throw failure; });
    let caught: unknown; try { x.read(); } catch (error) { caught = error; }
    expect(caught).toBe(failure); expect(db.isTransaction).toBe(true); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    expect(db.prepare('SELECT value FROM contact_read_probe').get()!.value).toBe(14);
    expect(x.statements.filter(sql => /^ROLLBACK\s*;?$/i.test(sql))).toHaveLength(rollbacks);
    x.setReadHook(); db.exec('COMMIT'); expect(x.peerDb.prepare('SELECT value FROM contact_read_probe').get()!.value).toBe(14);
    x.setReadHook(() => { throw failure; });
    caught = undefined; try { x.read(); } catch (error) { caught = error; }
    expect(caught).toBe(failure); released(x);
    expect(x.statements.filter(sql => /^ROLLBACK\s*;?$/i.test(sql))).toHaveLength(rollbacks + 1);
    x.setReadHook(); expect(x.read()).toEqual(first); released(x);
    // A real existing owner frame is retained on both successful and failed
    // nested reads; caller writes and the caller transaction survive the child.
    db.exec('BEGIN IMMEDIATE'); db.exec('UPDATE contact_read_probe SET value=15');
    const nestedRollbacks = x.statements.filter(sql => /^ROLLBACK\s*;?$/i.test(sql)).length;
    executions.withBattedWorldPhysicalReadTraversal(db, () => {
      const parentFrame = activeBattedWorldFieldReadFrame(db); expect(parentFrame).not.toBeNull();
      const start = x.events.length;
      expect(x.read()).toEqual(first);
      expect(x.events.slice(start).filter(event => event.name === 'pair').length).toBeGreaterThan(0);
      expect(x.events.slice(start).every(event => event.fieldFrame === parentFrame && event.queryOnly === 1)).toBe(true);
      x.setReadHook(() => { throw failure; });
      caught = undefined; try { x.read(); } catch (error) { caught = error; }
      expect(caught).toBe(failure); expect(activeBattedWorldFieldReadFrame(db)).toBe(parentFrame);
      expect(db.isTransaction).toBe(true); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
      expect(db.prepare('SELECT value FROM contact_read_probe').get()!.value).toBe(15);
      x.setReadHook(); expect(x.read()).toEqual(first);
    });
    expect(db.isTransaction).toBe(true); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    expect(activeBattedWorldFieldReadFrame(db)).toBeNull();
    expect(x.statements.filter(sql => /^ROLLBACK\s*;?$/i.test(sql))).toHaveLength(nestedRollbacks);
    db.exec('COMMIT'); expect(x.peerDb.prepare('SELECT value FROM contact_read_probe').get()!.value).toBe(15); released(x);
  } finally { x.close(); }
});
