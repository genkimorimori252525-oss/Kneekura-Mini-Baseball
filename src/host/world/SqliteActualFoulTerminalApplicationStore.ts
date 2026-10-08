import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { actualLivePlayId as id } from './ActualLivePlayScope';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualFoulTerminalApplicationInput as input, type AcceptedFoulTerminalApplication,
  type FoulTerminalApplicationAuthority, type SqliteActualFoulTerminalApplicationStore,
  type DurableFoulTerminalApplication } from './ActualFoulTerminalApplication';
import { foulTerminalApplicationEvidenceFromSqlite, foulTerminalApplicationTableSql,
  assertFoulTerminalApplicationStorage } from './ActualFoulTerminalApplicationEvidenceFromSqlite';

/** Immutable queue admission and authenticated historical stage reads. This
 * opener never applies the Match, acknowledges E or grants a next-play right. */
export const openSqliteActualFoulTerminalApplicationStore = (path: string,
  authority?: FoulTerminalApplicationAuthority): SqliteActualFoulTerminalApplicationStore => {
  if (!id(path) || authority !== undefined && typeof authority.readAcceptedApplication !== 'function') {
    throw new Error('invalid foul terminal queue authority');
  }
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(path); let closed = false, failed = false;
  const same = (actual: unknown, expected: unknown, message: string) => {
    if (json(actual) !== json(expected)) throw new Error(message);
  };
  const schema = () => ({ main:db.prepare('PRAGMA main.schema_version').get()!.schema_version,
    temp:db.prepare('PRAGMA temp.schema_version').get()!.schema_version,
    user:db.prepare('PRAGMA main.user_version').get()!.user_version });
  const counters = () => ({ schema:schema(),changes:db.prepare('SELECT total_changes() AS n').get()!.n });
  const queryOnly = () => {
    const value = db.prepare('PRAGMA query_only').get()!.query_only;
    if (value !== 0 && value !== 1) throw new Error('foul terminal queue query_only setting differs');
    return value;
  };
  const check = () => { if (closed || failed) throw new Error('closed foul terminal queue store'); };
  const snapshot = <T>(body: () => T): T => withBattedVenueLegalReadSnapshot(db,body);
  try {
    db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000');
    const version = schema().user;
    db.exec('BEGIN IMMEDIATE');
    // Own rollback here so an additional cleanup failure retains its cause.
    // Main-only authority is checked before constructor DDL, not only on reads.
    snapshot(() => assertFoulTerminalApplicationStorage(db));
    db.exec(foulTerminalApplicationTableSql);
    if (!snapshot(() => assertFoulTerminalApplicationStorage(db)) || schema().user !== version) {
      throw new Error('foul terminal queue constructor changed schema version authority');
    }
    db.exec('COMMIT');
  } catch (error) {
    const errors = [error];
    try { if (db.isTransaction) db.exec('ROLLBACK'); } catch (cleanup) { errors.push(cleanup); }
    try { db.close(); } catch (cleanup) { errors.push(cleanup); }
    if (errors.length > 1) throw new AggregateError(errors,'foul terminal queue constructor cleanup failed',{ cause:error });
    throw error;
  }
  const owner = foulTerminalApplicationEvidenceFromSqlite(db);
  const retire = (error: unknown, cleanup: unknown[]): never => {
    failed = true;
    try { db.close(); closed = true; } catch (closeError) { cleanup.push(closeError); }
    throw new AggregateError([error,...cleanup],'foul terminal queue cleanup failed; store is retired',{ cause:error });
  };
  const idleRead = <T>(body: () => T): T => {
    check();
    if (db.isTransaction) return retire(new Error('foul terminal queue unexpected transaction'),[]);
    const setting = queryOnly(), savepoint = 'foul_terminal_queue_read_'+randomUUID().replaceAll('-','');
    db.exec('BEGIN');
    try {
      db.exec('SAVEPOINT '+savepoint);
      db.exec('PRAGMA query_only=1');
      const before = counters(), value = snapshot(body);
      if (!db.isTransaction || queryOnly() !== 1) throw new Error('foul terminal queue read transaction changed');
      same(counters(),before,'foul terminal queue read changed schema or rows');
      try { db.exec('RELEASE '+savepoint); }
      catch (error) { failed = true; throw error; }
      db.exec('PRAGMA query_only='+setting);
      if (!db.isTransaction || queryOnly() !== setting) { failed = true; throw new Error('foul terminal queue read restoration differs'); }
      db.exec('COMMIT'); return value;
    } catch (error) {
      const cleanup: unknown[] = [];
      try {
        if (db.isTransaction) {
          try { db.exec('ROLLBACK TO '+savepoint); }
          catch (identity) { failed = true; cleanup.push(identity); }
          db.exec('ROLLBACK');
        } else failed = true;
      } catch (rollback) { failed = true; cleanup.push(rollback); }
      try {
        if (queryOnly() !== setting) db.exec('PRAGMA query_only='+setting);
        if (db.isTransaction || queryOnly() !== setting) { failed = true; cleanup.push(new Error('foul terminal queue read cleanup state differs')); }
      } catch (restore) { failed = true; cleanup.push(restore); }
      if (failed || cleanup.length) return retire(error,cleanup);
      throw error;
    }
  };
  const capture = (sourceId: string): AcceptedFoulTerminalApplication | null => {
    check(); if (!id(sourceId)) throw new Error('invalid foul terminal queue Source identity');
    const raw = authority?.readAcceptedApplication(sourceId) ?? null;
    check();
    return raw === null ? null : input(raw,sourceId);
  };
  const matchSource = (queued: DurableFoulTerminalApplication, source: AcceptedFoulTerminalApplication | null) => {
    if (source !== null) same(source,queued.source,'foul terminal queue Source is frozen differently');
  };
  const observe = (sourceId: string, source: AcceptedFoulTerminalApplication | null) => {
    const prior = owner.read(sourceId);
    if (prior) { matchSource(prior,source); return { kind:'prior' as const,queued:prior,schema:schema() }; }
    if (!source) throw new Error('accepted foul terminal application Source is missing');
    const prepared = owner.prepare(source);
    return { kind:'fresh' as const,...prepared,schema:schema() };
  };
  const preflight = (sourceId: string) => {
    const source = capture(sourceId), state = idleRead(() => observe(sourceId,source));
    // A callback may commit a peer WAL write. It runs outside the completed
    // read snapshot; the operation must subsequently reauthenticate that state.
    const recaptured = capture(sourceId);
    same(recaptured,source,'accepted foul terminal application Source changed after preflight');
    return { source,state };
  };
  const retry = (sourceId: string, source: AcceptedFoulTerminalApplication | null,
    expected: DurableFoulTerminalApplication): DurableFoulTerminalApplication => idleRead(() => {
    const saved = owner.read(sourceId);
    if (!saved) throw new Error('foul terminal queue disappeared during historical retry');
    matchSource(saved,source);
    same(saved,expected,'foul terminal queue archive changed during historical retry');
    return saved;
  });
  const proof = <T>(body: () => T): T => {
    if (!db.isTransaction) { failed = true; throw new Error('foul terminal queue proof transaction is missing'); }
    const savepoint = 'foul_terminal_queue_proof_'+randomUUID().replaceAll('-','');
    db.exec('SAVEPOINT '+savepoint);
    const setting = queryOnly(); let primary: unknown, bodyFailed = false;
    try {
      db.exec('PRAGMA query_only=1');
      if (queryOnly() !== 1) throw new Error('foul terminal queue proof query_only guard is unavailable');
      const before = counters(), value = snapshot(body);
      if (!db.isTransaction || queryOnly() !== 1) throw new Error('foul terminal queue proof transaction changed');
      same(counters(),before,'foul terminal queue proof changed schema or rows');
      // RELEASE proves that the owned transaction/savepoint was not replaced.
      try { db.exec('RELEASE '+savepoint); }
      catch (error) { failed = true; throw error; }
      if (!db.isTransaction) { failed = true; throw new Error('foul terminal queue proof transaction ended'); }
      return value;
    } catch (error) { primary = error; bodyFailed = true; throw error; }
    finally {
      try {
        db.exec('PRAGMA query_only='+setting);
        if (queryOnly() !== setting) throw new Error('foul terminal queue proof query_only restoration differs');
      } catch (cleanup) {
        failed = true;
        if (bodyFailed) throw new AggregateError([primary,cleanup],'foul terminal queue proof restoration failed',{ cause:primary });
        throw cleanup;
      }
    }
  };
  const write = <T>(body: () => { value:T; changes:0|1 }): T => {
    check();
    if (db.isTransaction) return retire(new Error('foul terminal queue writer has an unowned transaction'),[]);
    const setting = queryOnly(), before = counters(), savepoint = 'foul_terminal_queue_write_'+randomUUID().replaceAll('-','');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec('SAVEPOINT '+savepoint);
      const result = body(), after = counters();
      if (!db.isTransaction || queryOnly() !== setting || typeof before.changes !== 'number'
        || !Number.isSafeInteger(before.changes+result.changes) || after.changes !== before.changes+result.changes) {
        throw new Error('foul terminal queue write accounting or transaction differs');
      }
      same(after.schema,before.schema,'foul terminal queue schema changed during write');
      try { db.exec('RELEASE '+savepoint); }
      catch (error) { failed = true; throw error; }
      if (!db.isTransaction) { failed = true; throw new Error('foul terminal queue owned transaction disappeared'); }
      db.exec('COMMIT'); return result.value;
    } catch (error) {
      const cleanup: unknown[] = [];
      try {
        if (db.isTransaction) {
          try { db.exec('ROLLBACK TO '+savepoint); }
          catch (identity) { failed = true; cleanup.push(identity); }
          db.exec('ROLLBACK');
        }
        else failed = true;
      } catch (rollback) { failed = true; cleanup.push(rollback); }
      try {
        if (queryOnly() !== setting) { db.exec('PRAGMA query_only='+setting); failed = true; }
        if (db.isTransaction || queryOnly() !== setting) { failed = true; cleanup.push(new Error('foul terminal queue cleanup state differs')); }
      } catch (restore) { failed = true; cleanup.push(restore); }
      if (failed || cleanup.length) return retire(error,cleanup);
      throw error;
    }
  };
  return Object.freeze({
    read(sourceId: string) { check(); return idleRead(() => owner.read(sourceId)); },
    evaluate(sourceId: string) {
      const { source,state } = preflight(sourceId);
      if (state.kind === 'prior') return retry(sourceId,source,state.queued).proposal;
      return idleRead(() => {
        const current = observe(sourceId,source);
        same(current.schema,state.schema,'foul terminal queue schema changed after callback');
        if (current.kind === 'prior') {
          same(current.queued.proposal,state.evaluation,'foul terminal queue appeared with a different proposal');
          return current.queued.proposal;
        }
        same(current,state,'foul terminal queue evidence changed after callback');
        return current.evaluation;
      });
    },
    enqueue(sourceId: string) {
      const { source,state } = preflight(sourceId);
      if (state.kind === 'prior') return retry(sourceId,source,state.queued);
      if (state.evaluation.kind === 'pending') {
        return idleRead(() => {
          const current = observe(sourceId,source);
          if (current.kind !== 'fresh' || current.evaluation.kind !== 'pending') throw new Error('foul terminal pending evidence changed after callback');
          same(current,state,'foul terminal pending evidence changed after callback');
          return current.evaluation;
        });
      }
      const proposed = state.evaluation;
      return write(() => {
        same(schema(),state.schema,'foul terminal queue schema changed before writer acquisition');
        const current = snapshot(() => observe(sourceId,source));
        // An exact peer enqueue that won writer acquisition is an authentic
        // historical retry, never fresh admission from a stale selected fence.
        if (current.kind === 'prior') {
          same(current.queued.proposal,proposed,'foul terminal queue appeared with a different proposal');
          return { value:current.queued,changes:0 };
        }
        same(current,state,'foul terminal queue original evidence changed before write');
        db.prepare('INSERT INTO main.actual_foul_terminal_applications VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
          sourceId,proposed.gameId,proposed.playId,proposed.source.applicationId,proposed.physicalPitchSourceId,
          proposed.physicalEndReference.sourceId,proposed.officialObligation.obligationKey,'QUEUED',
          json(proposed.source),hash(proposed.source),json(proposed),hash(proposed),null);
        // Outside read proof snapshots, but still under this owned write.
        same(capture(sourceId),source,'accepted foul terminal application Source changed during write');
        const saved = proof(() => {
          const after = owner.proveQueuedCurrent(sourceId);
          same(after.queued,{ source:proposed.source,proposal:proposed,status:'QUEUED',officialApplied:false,result:null },
            'foul terminal queue changed after insert');
          if (!state.pin) throw new Error('foul terminal queue original claim pin is missing');
          same({ ...after.pin,terminal:[] },state.pin,'foul terminal queue original ownership or policy changed during insert');
          return after.queued;
        });
        return { value:saved,changes:1 };
      });
    },
    close() { if (!closed) { closed = true; db.close(); } },
  });
};
