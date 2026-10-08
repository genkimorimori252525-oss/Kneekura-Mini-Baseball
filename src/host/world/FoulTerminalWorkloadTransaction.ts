import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';

/** Private concrete coordinator transaction. No caller evidence or completion
 * capability is accepted; every proof runs read-only on this exact connection. */
export const foulTerminalWorkloadTransaction = (db: DatabaseSync, storage: () => void) => {
  let closed = false, failed = false;
  const check = () => { if (closed || failed) throw new Error('closed terminal workload owner'); };
  const queryOnly = () => {
    const value = db.prepare('PRAGMA query_only').get()!.query_only;
    if (value !== 0 && value !== 1) throw new Error('terminal workload query_only differs');
    return value;
  };
  const counters = () => ({ changes: db.prepare('SELECT total_changes() AS n').get()!.n,
    schema: { main: db.prepare('PRAGMA main.schema_version').get()!.schema_version,
      temp: db.prepare('PRAGMA temp.schema_version').get()!.schema_version, user: db.prepare('PRAGMA main.user_version').get()!.user_version } });
  const retire = (primary: unknown, cleanup: unknown[]): never => {
    failed = true;
    try { db.close(); closed = true; } catch (error) { cleanup.push(error); }
    throw new AggregateError([primary, ...cleanup], 'terminal workload retired after transaction cleanup failure', { cause: primary });
  };
  const proof = <T>(body: () => T): T => {
    check(); if (!db.isTransaction) throw new Error('terminal workload proof transaction missing');
    const setting = queryOnly(), savepoint = 'terminal_workload_proof_' + randomUUID().replaceAll('-', '');
    db.exec('SAVEPOINT ' + savepoint);
    let primary: unknown, bodyFailed = false;
    try {
      db.exec('PRAGMA query_only=1');
      const before = counters(), value = withBattedVenueLegalReadSnapshot(db, body);
      if (!db.isTransaction || queryOnly() !== 1 || json(counters()) !== json(before)) throw new Error('terminal workload proof changed transaction, schema or rows');
      try { db.exec('RELEASE ' + savepoint); } catch (error) { failed = true; throw error; }
      return value;
    } catch (error) { primary = error; bodyFailed = true; throw error; }
    finally {
      try {
        db.exec('PRAGMA query_only=' + setting);
        if (queryOnly() !== setting) throw new Error('terminal workload proof setting differs');
      } catch (error) {
        failed = true;
        if (bodyFailed) throw new AggregateError([primary, error], 'terminal workload proof restoration failed', { cause: primary });
        throw error;
      }
    }
  };
  const transaction = <T>(write: boolean, body: () => Readonly<{ value: T; changes: number }>): T => {
    check(); if (db.isTransaction) return retire(new Error('terminal workload unowned transaction'), []);
    const setting = queryOnly(), savepoint = 'terminal_workload_' + randomUUID().replaceAll('-', '');
    // A peer may commit before acquisition, but this connection must not write
    // while BEGIN is being acquired. Capture its counter before that boundary.
    const acquisitionChanges = db.prepare('SELECT total_changes() AS n').get()!.n;
    try {
      // BEGIN itself may fail after acquiring a real transaction. Cleanup must
      // own that failure too; a missing identity savepoint retires the handle.
      db.exec(write ? 'BEGIN IMMEDIATE' : 'BEGIN');
      db.exec('SAVEPOINT ' + savepoint);
      const before = counters();
      if (before.changes !== acquisitionChanges) throw new Error('terminal workload acquisition write accounting differs');
      proof(storage);
      const result = body(), after = counters();
      if (!Number.isSafeInteger(result.changes) || result.changes < 0 || typeof before.changes !== 'number'
        || !Number.isSafeInteger(before.changes + result.changes) || after.changes !== before.changes + result.changes
        || json(before.schema) !== json(after.schema) || !db.isTransaction || queryOnly() !== setting) throw new Error('terminal workload exact write accounting or schema differs');
      try { db.exec('RELEASE ' + savepoint); } catch (error) { failed = true; throw error; }
      if (!db.isTransaction) { failed = true; throw new Error('terminal workload owned transaction disappeared'); }
      db.exec('COMMIT');
      if (db.isTransaction || queryOnly() !== setting || json(counters()) !== json(after)) {
        failed = true;
        throw new Error('terminal workload commit state or accounting differs');
      }
      return result.value;
    } catch (error) {
      const cleanup: unknown[] = [];
      try {
        if (db.isTransaction) {
          try { db.exec('ROLLBACK TO ' + savepoint); } catch (identity) { failed = true; cleanup.push(identity); }
          db.exec('ROLLBACK');
        } else failed = true;
      } catch (rollback) { failed = true; cleanup.push(rollback); }
      try {
        if (queryOnly() !== setting) { db.exec('PRAGMA query_only=' + setting); failed = true; }
        if (db.isTransaction || queryOnly() !== setting) { failed = true; cleanup.push(new Error('terminal workload cleanup state differs')); }
      } catch (restore) { failed = true; cleanup.push(restore); }
      if (failed || cleanup.length) return retire(error, cleanup);
      throw error;
    }
  };
  return { check, proof, transaction, close() { if (!closed) { closed = true; db.close(); } } };
};
