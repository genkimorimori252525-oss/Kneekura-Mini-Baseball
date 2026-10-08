// Acceptance-only support. Every copy retains explicitly pinned A01 lineage;
// the current real owner reauthenticates it before a fault is installed.
import { createRequire } from 'node:module';
import { constants,copyFileSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync as Database,SQLOutputValue } from 'node:sqlite';
import { expect } from 'vitest';
import { SqliteOfficialStateWriter } from '../SqliteOfficialStateWriter';
import { officialStateHash as hash,officialStateSerialized as json } from '../OfficialStateEncoding';
import { openSqliteActualFoulTerminalApplicationStore } from './SqliteActualFoulTerminalApplicationStore';
import { assertClosedTerminalSidecars,retainedTerminalProducer } from './ActualFoulTerminalCutover.test-support';
import { extendPrivateTerminalCheck,prepareLegacyPendingCopy,rawCensus,schemaCensus,
  terminalRows,terminalColumns,terminalSchema,terminalTable,frozenTerminalSql,acknowledgedTerminalSql,fileHash }
  from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { expectedAcknowledgement,type AcknowledgementRunner,type Applied,type Acknowledged }
  from './ActualFoulTerminalAcknowledgementWire.test-support';
import { prepareRetainedTerminalAcknowledgementCopy } from './ActualFoulTerminalAcknowledgementRetained.test-support';

export const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
export const sourceId = 'terminal-application';
export type RawRow = Record<string,SQLOutputValue>;
type Stage = 'legacy-applied'|'capable-applied'|'acknowledged';
type Prepared = ReturnType<typeof prepareRetainedTerminalAcknowledgementCopy> &
  { producer:NonNullable<ReturnType<typeof retainedTerminalProducer>> };
export const quote = (name:string) => '"' + name.replaceAll('"','""') + '"';
const compact = (sql:string) => sql.replace(/\s+/g,'').replace(/^CREATETABLE(?:IFNOTEXISTS)?(?:main\.)?/i,'');

/** Every step runs even when a previous close/assertion failed. A body failure
 * remains first (and cause) if cleanup also fails. */
export const finishOwned = (failed:boolean,primary:unknown,steps:readonly (() => void)[]):void => {
  const errors:unknown[] = [];
  for (const step of steps) { try { step(); } catch (error) { errors.push(error); } }
  if (errors.length) throw new AggregateError(failed ? [primary,...errors] : errors,
    'acknowledgement acceptance cleanup failed',failed ? { cause:primary } : undefined);
};
const sameDescriptor = (actual:PropertyDescriptor|undefined,installed:PropertyDescriptor) => actual !== undefined
  && (['configurable','enumerable','value','writable','get','set'] as const).every(key => actual[key] === installed[key]);
const replaceOwnMethod = (target:object,key:string,wrap:(original:Function) => Function) => {
  const original = Object.getOwnPropertyDescriptor(target,key);
  if (!original || typeof original.value !== 'function') throw new Error('missing real method descriptor: '+key);
  const installed = { ...original,value:wrap(original.value) };
  Object.defineProperty(target,key,installed);
  return () => {
    if (!sameDescriptor(Object.getOwnPropertyDescriptor(target,key),installed)) {
      throw new Error('later '+key+' interceptor preserved');
    }
    Object.defineProperty(target,key,original);
  };
};
export const openIntegrityRunner = async ():Promise<(path:string) => AcknowledgementRunner> => {
  const moduleId = './SqliteActualFoulTerminalApplicationRunner';
  const module = await import(/* @vite-ignore */ moduleId);
  expect(typeof module.openSqliteActualFoulTerminalApplicationRunner).toBe('function');
  return module.openSqliteActualFoulTerminalApplicationRunner;
};
const openObservedRunner = (open:(path:string) => AcknowledgementRunner,path:string) => {
  let connection:Database|undefined,runner:AcknowledgementRunner|undefined,restore:(() => void)|undefined;
  let primary:unknown,failed = false;
  try {
    restore = replaceOwnMethod(DatabaseSync.prototype,'prepare',original => function(this:Database,...args:unknown[]) {
      if (connection && connection !== this) throw new Error('runner opener unexpectedly used a second connection');
      connection = this; return Reflect.apply(original,this,args);
    });
    runner = open(path);
    if (!connection) throw new Error('runner constructor connection was not observed');
    return { runner,connection };
  } catch (error) { primary = error; failed = true; throw error; }
  finally {
    const steps = [() => restore?.()];
    // If restoring the observer itself fails, do not return a live orphan.
    let restoreError:unknown,restoreFailed = false;
    try { finishOwned(failed,primary,steps); }
    catch (error) { restoreError = error; restoreFailed = true; }
    if (failed || restoreFailed) {
      finishOwned(true,restoreFailed ? restoreError : primary,[() => runner?.close()]);
      if (restoreFailed) throw restoreError;
    }
  }
};
export const requireAcknowledgement = (runner:AcknowledgementRunner):void => {
  expect(typeof runner.acknowledge,'QUALIFIED_ACKNOWLEDGEMENT_API_PREREQUISITE_MISSING').toBe('function');
};

/** Pass-through instrumentation only: no reader or successful result is
 * mocked. Even a same-byte UPDATE or a rolled-back write increments SQLite's
 * total_changes counter and fails this audit. Closed/retired connections are
 * sampled immediately before the real close, so they cannot hide writes.
 * All callers await no asynchronous work while these descriptors are held. */
export const assertNoOwnerWrites = (body:() => void):void => {
  const originalPrepare = Object.getOwnPropertyDescriptor(DatabaseSync.prototype,'prepare')?.value as Database['prepare'];
  if (typeof originalPrepare !== 'function') throw new Error('real SQLite prepare is missing');
  type Sample = { before:SQLOutputValue; after?:SQLOutputValue; queryOnly:SQLOutputValue;
    afterQueryOnly?:SQLOutputValue; closed:boolean; inTransaction?:boolean };
  const connections = new Map<Database,Sample>(),restores:(() => void)[] = [];
  const changes = (db:Database) => Reflect.apply(originalPrepare,db,['SELECT total_changes() AS n']).get()!.n as SQLOutputValue;
  const queryOnly = (db:Database) => Reflect.apply(originalPrepare,db,['PRAGMA query_only']).get()!.query_only as SQLOutputValue;
  const observe = (db:Database) => {
    let sample = connections.get(db);
    if (!sample) { sample = { before:changes(db),queryOnly:queryOnly(db),closed:false }; connections.set(db,sample); }
    return sample;
  };
  let writerCalls = 0,mutationAttempts = 0,primary:unknown,failed = false;
  const observeStatement = (value:unknown) => {
    if (typeof value === 'string' && /(?:^|;)\s*(?:UPDATE|INSERT|DELETE|REPLACE)\b/i.test(value)) mutationAttempts++;
  };
  try {
    restores.push(replaceOwnMethod(DatabaseSync.prototype,'prepare',original => function(this:Database,...args:unknown[]) {
      observe(this); observeStatement(args[0]); return Reflect.apply(original,this,args);
    }));
    restores.push(replaceOwnMethod(DatabaseSync.prototype,'exec',original => function(this:Database,...args:unknown[]) {
      observe(this); observeStatement(args[0]); return Reflect.apply(original,this,args);
    }));
    restores.push(replaceOwnMethod(DatabaseSync.prototype,'close',original => function(this:Database,...args:unknown[]) {
      const sample = observe(this); sample.after = changes(this); sample.inTransaction = this.isTransaction;
      sample.afterQueryOnly = queryOnly(this);
      const value = Reflect.apply(original,this,args); sample.closed = true; return value;
    }));
    restores.push(replaceOwnMethod(SqliteOfficialStateWriter.prototype,'preparePendingNonLive',original =>
      function(this:SqliteOfficialStateWriter,...args:unknown[]) {
        writerCalls++; return Reflect.apply(original,this,args);
      }));
    try { body(); } catch (error) { primary = error; failed = true; }
    const errors:unknown[] = [];
    for (const [connection,sample] of connections) {
      try {
        expect(sample.closed ? sample.after : changes(connection),'real SQLite connection performed a write').toBe(sample.before);
        expect(sample.closed ? sample.inTransaction : connection.isTransaction).toBe(false);
        expect(sample.closed ? sample.afterQueryOnly : queryOnly(connection)).toBe(sample.queryOnly);
      } catch (error) { errors.push(error); }
    }
    try { expect(writerCalls,'shared official writer was invoked by a read/retry/refusal').toBe(0); }
    catch (error) { errors.push(error); }
    try { expect(mutationAttempts,'a read/retry/refusal attempted mutating SQL').toBe(0); }
    catch (error) { errors.push(error); }
    if (errors.length) throw new AggregateError(failed ? [primary,...errors] : errors,'zero-write acceptance audit failed',
      failed ? { cause:primary } : undefined);
    if (failed) throw primary;
  } catch (error) { primary = error; failed = true; throw error; }
  finally { finishOwned(failed,primary,restores.reverse()); }
};

export type IntegrityFixture = Prepared & {
  applied:Applied|Acknowledged; acknowledged?:Acknowledged; observer:Database; runner:AcknowledgementRunner;
  runnerConnection:Database;
  open:(path:string) => AcknowledgementRunner; close:() => void;
};
const ownedFixtures = new WeakSet<IntegrityFixture>();

/** Every input is a fresh exclusive copy of the qualified A01 artifact. The
 * current owner rederives original P/C/E/journal and all current mirrors. No
 * application or acknowledgement is synthesized to stand in for that read.
 * A capable-applied test extends CHECK only after closing its own reader, on
 * this already exclusively created private copy, never on the retained file. */
export const prepareIntegrityFixture = async (stage:Stage = 'acknowledged',
  beforeCutover?:(prepared:Prepared,observer:Database) => void):Promise<IntegrityFixture> => {
  const copied = prepareRetainedTerminalAcknowledgementCopy(stage === 'acknowledged' ? 'acknowledged' : 'applied');
  const producer = retainedTerminalProducer();
  if (!producer) throw new Error('retained original producer lineage is required');
  const prepared:Prepared = { ...copied,producer },open = await openIntegrityRunner();
  let observer:Database|undefined,runner:AcknowledgementRunner|undefined,runnerConnection:Database|undefined;
  let primary:unknown,failed = false,transferred = false;
  const preserved = new Map([[producer.sourcePath,producer.sourceSha256],[copied.retainedPath,copied.retainedSha256]]);
  try {
    observer = new DatabaseSync(copied.path);
    ({ runner,connection:runnerConnection } = openObservedRunner(open,copied.path));
    const raw = rawCensus(observer),schema = schemaCensus(observer);
    let current = runner.read(sourceId);
    const expectedStage = stage === 'acknowledged' ? 'OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY' : 'OFFICIAL_APPLIED_PENDING_POST_PLAY';
    if (!current || current.status === 'QUEUED' || current.status !== expectedStage) {
      throw new Error('RETAINED_GENUINE_ACKNOWLEDGEMENT_STAGE_PREREQUISITE_MISSING');
    }
    expect(rawCensus(observer)).toEqual(raw); expect(schemaCensus(observer)).toEqual(schema);
    expect(runnerConnection.prepare('SELECT total_changes() AS n').get()!.n).toBe(0);
    requireAcknowledgement(runner);
    if (stage === 'capable-applied') {
      const before = current,closedConnection = runnerConnection;
      runner.close(); runner = undefined; runnerConnection = undefined;
      expect(() => closedConnection.prepare('SELECT 1')).toThrow();
      beforeCutover?.(prepared,observer);
      const delta = extendPrivateTerminalCheck(observer);
      writeFileSync(join(copied.directory,'retained-applied-check-control.json'),JSON.stringify({
        version:'owned_retained_terminal_applied_check_v1',retainedPath:copied.retainedPath,
        retainedSha256:copied.retainedSha256,destinationPath:copied.path,
        authenticatedAppliedSha256:hash(before),readerConnectionObservedClosed:true,...delta,
      },null,2),{ flag:'wx' });
      ({ runner,connection:runnerConnection } = openObservedRunner(open,copied.path));
      current = runner.read(sourceId);
      if (!current || current.status !== 'OFFICIAL_APPLIED_PENDING_POST_PLAY') throw new Error('retained pending stage changed during CHECK preparation');
      expect(current).toEqual(before);
    } else if (beforeCutover) throw new Error('private cutover hook requires capable-applied preparation');
    const applied:Applied|Acknowledged = current;
    const p = applied.proposal,origin = { owner:'actual_foul_terminal_applications',sourceId,
      sourceVersion:p.source.sourceVersion,sourceHash:hash(p.source),snapshotHash:hash(p) };
    const receipt = { applicationId:p.source.applicationId,closureId:sourceId,previousPlayId:p.playId,
      durableRevision:p.originalOfficialRevision+1,appliedMatchState:p.nextMatch };
    const official = { receipt,pendingPostPlay:{ version:'official_pending_post_play_v1',matchId:p.gameId,
      applicationId:receipt.applicationId,closureId:receipt.closureId,previousPlayId:receipt.previousPlayId,
      durableRevision:receipt.durableRevision,origin,requestHash:hash({ ...p.applicationBody,origin }),
      gameProgression:p.projectedGameProgression } };
    expect(applied.result.official).toEqual(official);
    expect(observer.prepare('SELECT result_json FROM main.applications WHERE application_id=?').get(p.source.applicationId)!.result_json).toBe(json(official));
    expect(observer.prepare('SELECT activation_json,state_json,durable_revision FROM main.matches WHERE match_id=?').get(p.gameId))
      .toEqual({ activation_json:json({ pendingPostPlay:official.pendingPostPlay }),state_json:json(p.nextMatch),durable_revision:receipt.durableRevision });
    expect(terminalRows(observer).find(row => row.source_id === sourceId)!.result_json).toBe(json(applied.result));
    const acknowledged = applied.status === 'OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY' ? applied : undefined;
    if (acknowledged) expect(acknowledged.result.acknowledgement).toEqual(expectedAcknowledgement(acknowledged));
    else expect(applied.result.acknowledgement).toBeNull();
    if (!runner || !runnerConnection) throw new Error('retained current owner handle is missing');
    const ownedObserver = observer,ownedRunner = runner,ownedConnection = runnerConnection;
    for (const [name,digest] of preserved) expect(fileHash(name)).toBe(digest);
    let closed = false;
    const f:IntegrityFixture = { ...prepared,applied,acknowledged,observer:ownedObserver,runner:ownedRunner,
      runnerConnection:ownedConnection,open,close() {
      if (closed) return; closed = true;
      finishOwned(false,undefined,[() => ownedRunner.close(),() => ownedObserver.close(),
        () => expect(() => ownedConnection.prepare('SELECT 1')).toThrow(),
        () => expect(() => ownedObserver.prepare('SELECT 1')).toThrow(),
        ...[...preserved].map(([name,digest]) => () => expect(fileHash(name)).toBe(digest))]);
    } };
    ownedFixtures.add(f); observer = undefined; runner = undefined; transferred = true;
    return f;
  } catch (error) { primary = error; failed = true; throw error; }
  finally { finishOwned(failed,primary,[() => runner?.close(),() => observer?.close(),
    () => { if (!transferred) for (const [name,digest] of preserved) expect(fileHash(name)).toBe(digest); }]); }
};

export const withIntegrityFixture = async (body:(fixture:IntegrityFixture) => void|Promise<void>,stage:Stage = 'acknowledged') => {
  const fixture = await prepareIntegrityFixture(stage); let primary:unknown,failed = false;
  try { await body(fixture); } catch (error) { primary = error; failed = true; throw error; }
  finally { finishOwned(failed,primary,[() => fixture.close()]); }
};
const withQueue = (path:string,body:(queue:ReturnType<typeof openSqliteActualFoulTerminalApplicationStore>) => void) => {
  const queue = openSqliteActualFoulTerminalApplicationStore(path); let primary:unknown,failed = false;
  try { body(queue); } catch (error) { primary = error; failed = true; throw error; }
  finally { finishOwned(failed,primary,[() => queue.close()]); }
};
export const assertAllRoutesReject = (fixture:Pick<IntegrityFixture,'runner'|'observer'|'path'>) => {
  requireAcknowledgement(fixture.runner);
  const rows = rawCensus(fixture.observer),schema = schemaCensus(fixture.observer);
  const actions = [() => fixture.runner.read(sourceId),() => fixture.runner.apply(sourceId),
    () => fixture.runner.acknowledge!(sourceId),() => withQueue(fixture.path,queue => { queue.enqueue(sourceId); })];
  for (const action of actions) {
    assertNoOwnerWrites(() => expect(action).toThrow());
    expect(rawCensus(fixture.observer)).toEqual(rows); expect(schemaCensus(fixture.observer)).toEqual(schema);
  }
};
export const assertExactRetries = (fixture:IntegrityFixture) => {
  const expected = fixture.acknowledged ?? fixture.applied;
  const rows = rawCensus(fixture.observer),schema = schemaCensus(fixture.observer);
  assertNoOwnerWrites(() => {
    expect(fixture.runner.read(sourceId)).toEqual(expected);
    expect(fixture.runner.apply(sourceId)).toEqual(expected);
    if (fixture.acknowledged) expect(fixture.runner.acknowledge!(sourceId)).toEqual(expected);
    withQueue(fixture.path,queue => { expect(queue.enqueue(sourceId)).toEqual(expected); });
  });
  expect(rawCensus(fixture.observer)).toEqual(rows); expect(schemaCensus(fixture.observer)).toEqual(schema);
};
/** One complete read after restoration proves the handle and restored domain
 * evidence remain valid. A01 already qualified all successful retry routes. */
export const assertRestoredRead = (fixture:IntegrityFixture) => {
  const rows = rawCensus(fixture.observer),schema = schemaCensus(fixture.observer);
  assertNoOwnerWrites(() => expect(fixture.runner.read(sourceId)).toEqual(fixture.acknowledged ?? fixture.applied));
  expect(rawCensus(fixture.observer)).toEqual(rows); expect(schemaCensus(fixture.observer)).toEqual(schema);
};

/** Only a private corruption/restoration observer may use this helper. The
 * deliberate invalid row exists outside transactions, but the original FK
 * policy is restored and verified before any production operation resumes. */
export const withIntegrityObserverForeignKeysDisabled = (db:Database,body:() => void):void => {
  expect(db.isTransaction).toBe(false);
  const setting = db.prepare('PRAGMA foreign_keys').get()!.foreign_keys;
  if (setting !== 0 && setting !== 1) throw new Error('private observer foreign-key policy differs');
  let failed = false,primary:unknown;
  try {
    db.exec('PRAGMA foreign_keys=OFF');
    expect(db.prepare('PRAGMA foreign_keys').get()!.foreign_keys).toBe(0);
    body();
  } catch (error) { failed = true; primary = error; throw error; }
  finally { finishOwned(failed,primary,[() => expect(db.isTransaction).toBe(false),() => {
    db.exec('PRAGMA foreign_keys='+setting);
    expect(db.prepare('PRAGMA foreign_keys').get()!.foreign_keys).toBe(setting);
  }]); }
};

/** Captures exact rowid and all SQLite values. Restoration is an independently
 * committed observer transaction, completed before any separate owner reads.
 * It can restore only a row captured from this genuine artifact. */
export const captureRow = (db:Database,table:string,key:string,value:SQLOutputValue) => {
  const rows = db.prepare('SELECT rowid AS __ack_rowid,* FROM main.'+quote(table)+' WHERE '+quote(key)+'=?').all(value);
  expect(rows).toHaveLength(1);
  const saved = rows[0],columns = Object.keys(saved).filter(column => column !== '__ack_rowid');
  return { saved,restore() { withIntegrityObserverForeignKeysDisabled(db,() => {
    expect(db.isTransaction).toBe(false); db.exec('BEGIN IMMEDIATE');
    let primary:unknown,failed = false;
    try {
      db.prepare('DELETE FROM main.'+quote(table)+' WHERE '+quote(key)+'=?').run(value);
      db.prepare('INSERT INTO main.'+quote(table)+'(rowid,'+columns.map(quote).join(',')+') VALUES('
        +Array(columns.length+1).fill('?').join(',')+')').run(saved.__ack_rowid,...columns.map(column => saved[column]));
      db.exec('COMMIT');
    } catch (error) { primary = error; failed = true; throw error; }
    finally { finishOwned(failed,primary,[() => { if (db.isTransaction) db.exec('ROLLBACK'); }]); }
  }); } };
};

/** Test-only CHECK change on an exclusively-created private copy. No successful
 * object is manufactured: every inserted value is a saved SQLite value from
 * that exact private copy. CHECK bypass, if requested, is limited to copying
 * an already genuine acknowledged row into the intentionally invalid legacy
 * combination. It is restored before any production opener is called. */
export const rebuildPrivateCheck = (db:Database,expectedSql:string,replacementSql:string,bypass = false) => {
  const schema = schemaCensus(db),shape = terminalSchema(db),rows = rawCensus(db),terminal = terminalRows(db);
  expect(db.isTransaction).toBe(false);
  expect(compact(String(shape.installed.find(row => row.type === 'table')!.sql))).toBe(compact(expectedSql));
  expect(shape.installed.filter(row => row.type === 'trigger')).toEqual([]);
  expect(shape.indexes).toHaveLength(6);
  expect(shape.indexes.every(index => index.unique === 1 && index.partial === 0 && ['pk','u'].includes(String(index.origin)))).toBe(true);
  const prior = db.prepare('PRAGMA ignore_check_constraints').get()!.ignore_check_constraints;
  expect(prior).toBe(0);
  let primary:unknown,failed = false;
  try {
    db.exec('BEGIN IMMEDIATE'); db.exec('DROP TABLE main.actual_foul_terminal_applications'); db.exec(replacementSql);
    if (bypass) db.exec('PRAGMA ignore_check_constraints=ON');
    const insert = db.prepare('INSERT INTO main.actual_foul_terminal_applications(rowid,'+terminalColumns.join(',')
      +') VALUES('+Array(terminalColumns.length+1).fill('?').join(',')+')');
    for (const row of terminal) insert.run(row.__ack_rowid,...terminalColumns.map(column => row[column]));
    if (bypass) db.exec('PRAGMA ignore_check_constraints=OFF');
    expect(db.prepare('PRAGMA ignore_check_constraints').get()!.ignore_check_constraints).toBe(0);
    expect(rawCensus(db)).toEqual(rows);
    const after = schemaCensus(db),afterShape = terminalSchema(db);
    expect(after.main.filter(row => row.tbl_name !== terminalTable)).toEqual(schema.main.filter(row => row.tbl_name !== terminalTable));
    expect(after.temp).toEqual(schema.temp); expect(after.tempVersion).toBe(schema.tempVersion);
    expect(after.userVersion).toBe(schema.userVersion); expect(after.mainVersion).toBe(Number(schema.mainVersion)+2);
    expect(afterShape.columns).toEqual(shape.columns); expect(afterShape.indexes).toEqual(shape.indexes);
    expect(afterShape.installed.filter(row => row.type !== 'table')).toEqual(shape.installed.filter(row => row.type !== 'table'));
    expect(compact(String(afterShape.installed.find(row => row.type === 'table')!.sql))).toBe(compact(replacementSql));
    db.exec('COMMIT'); return { before:schema,after,rawRowsSha256:hash(rows),beforeShape:shape,afterShape };
  } catch (error) { primary = error; failed = true; throw error; }
  finally { finishOwned(failed,primary,[() => { if (db.isTransaction) db.exec('ROLLBACK'); },
    () => { db.exec('PRAGMA ignore_check_constraints=OFF'); expect(db.prepare('PRAGMA ignore_check_constraints').get()!.ignore_check_constraints).toBe(0); }]); }
};

/** Accepts only an in-process genuine fixture, closes its owned handles, and
 * exclusively copies its byte-verified file. It cannot admit a retained file
 * path or a caller-provided success receipt. The original is kept intact. */
export const closeAndCopyGenuineFixture = (fixture:IntegrityFixture,filename:string) => {
  if (!ownedFixtures.delete(fixture)) throw new Error('schema corruption requires one owned in-process genuine fixture');
  if (!/^[a-z][a-z0-9-]*\.sqlite$/.test(filename)) throw new Error('invalid private copy filename');
  const rows = rawCensus(fixture.observer),schema = schemaCensus(fixture.observer);
  fixture.close();
  expect(() => fixture.observer.prepare('SELECT 1')).toThrow();
  expect(() => fixture.runner.read(sourceId)).toThrow(/closed|retired/);
  assertClosedTerminalSidecars(fixture.path);
  const sourceSha256 = fileHash(fixture.path),path = join(fixture.directory,filename);
  copyFileSync(fixture.path,path,constants.COPYFILE_EXCL); expect(fileHash(path)).toBe(sourceSha256);
  writeFileSync(path+'.control.json',JSON.stringify({ version:'owned_genuine_acknowledgement_corruption_copy_v1',
    originalProducerPath:fixture.producer.sourcePath,originalProducerSha256:fixture.producer.sourceSha256,
    sourcePath:fixture.path,sourceSha256,destinationPath:path,rawRowsSha256:hash(rows),schema,
    stage:fixture.acknowledged?.status ?? fixture.applied.status },null,2),{ flag:'wx' });
  const observer = new DatabaseSync(path); let failed = false,primary:unknown;
  try { expect(rawCensus(observer)).toEqual(rows); expect(schemaCensus(observer)).toEqual(schema); }
  catch (error) { failed = true; primary = error; throw error; }
  finally { if (failed) finishOwned(true,primary,[() => observer.close()]); }
  return { path,observer,assertSourcePreserved() {
    expect(fileHash(fixture.path)).toBe(sourceSha256);
    expect(fileHash(fixture.producer.sourcePath)).toBe(fixture.producer.sourceSha256);
  } };
};

export const prepareCapableQueuedCopy = () => {
  const prepared = prepareLegacyPendingCopy(),db = new DatabaseSync(prepared.path);
  let failed = false,primary:unknown;
  try {
    // prepareLegacyPendingCopy already proved exclusive creation and v2 -> v3.
    // No runner, apply or application receipt has been created on this file.
    const delta = rebuildPrivateCheck(db,frozenTerminalSql,acknowledgedTerminalSql);
    writeFileSync(join(prepared.directory,'queued-check-control.json'),JSON.stringify({
      version:'owned_genuine_queued_acknowledgement_check_v1',originalProducerPath:prepared.producer.sourcePath,
      originalProducerSha256:prepared.producer.sourceSha256,destinationPath:prepared.path,...delta },null,2),{ flag:'wx' });
  } catch (error) { failed = true; primary = error; throw error; }
  finally { finishOwned(failed,primary,[() => db.close(),
    () => expect(fileHash(prepared.producer.sourcePath)).toBe(prepared.producer.sourceSha256)]); }
  assertClosedTerminalSidecars(prepared.path); return prepared;
};
