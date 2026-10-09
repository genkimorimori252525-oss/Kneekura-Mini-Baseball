import { withSamePaContinuationReadPhase } from './SamePlateAppearanceContinuationFromSqlite';
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';

/** Private producer transaction. Each effect discards the read traversal; no
 * caller proof, cached actor or transaction exemption can enter this helper. */
export const battingInvocationTransaction = (db: DatabaseSync, storage: () => unknown) => {
  let closed = false, retired = false;
  const check = () => { if (closed || retired) throw new Error('batting invocation owner closed or retired'); };
  const counters = () => ({ changes: Number(db.prepare('SELECT total_changes() n').get()!.n), main: db.prepare('PRAGMA main.schema_version').get()!.schema_version,
    temp: db.prepare('PRAGMA temp.schema_version').get()!.schema_version, user: db.prepare('PRAGMA main.user_version').get()!.user_version });
  const setting = () => Number(db.prepare('PRAGMA query_only').get()!.query_only);
  const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('batting invocation transaction, schema or row accounting differs'); };
  const retire = (cause: unknown, cleanup: unknown[] = []): never => { retired = true; try { db.close(); closed = true; } catch (e) { cleanup.push(e); }
    throw new AggregateError([cause, ...cleanup], 'batting invocation retired after uncertain transaction; committed effects cannot be rolled back', { cause }); };
  const run = <T>(write: boolean, body: (proof: <R>(fn: () => R) => R, step: (fn: () => void, rows: number, schemas?: number) => void) => T,
    verify: (value: T) => void): T => {
    check(); if (db.isTransaction) return retire(new Error('batting invocation unowned transaction'));
    const originalSetting = setting(), initial = counters(), marker = 'batting_invocation_' + randomUUID().replaceAll('-', '');
    let expected = { ...initial }, acquired = false, identified = false, committing = false, uncertain = false;
    const account = () => same(counters(), expected);
    const identity = () => { if (!db.isTransaction || setting() !== originalSetting) throw new Error('batting invocation transaction changed');
      try { db.exec('RELEASE ' + marker); identified = false; db.exec('SAVEPOINT ' + marker); identified = true; } catch (e) { uncertain = true; throw e; } };
    const proof = <R>(fn: () => R): R => { identity(); account(); db.exec('PRAGMA query_only=1');
      try { const value = withBattedWorldPhysicalReadTraversal(db, () => withSamePaContinuationReadPhase(db, fn)); if (!db.isTransaction || setting() !== 1) throw new Error('batting invocation proof changed'); account(); return value; }
      finally { db.exec('PRAGMA query_only=' + originalSetting); identity(); account(); } };
    const step = (fn: () => void, rows: number, schemas = 0) => { identity(); account(); fn(); expected = { ...expected, changes: expected.changes + rows, main: Number(expected.main) + schemas }; identity(); account(); };
    try {
      db.exec(write ? 'BEGIN IMMEDIATE' : 'BEGIN'); acquired = true; if (!db.isTransaction) throw new Error('batting invocation acquisition changed');
      db.exec('SAVEPOINT ' + marker); identified = true; account(); proof(storage);
      const result = body(proof, step); proof(storage); identity(); account(); db.exec('RELEASE ' + marker); identified = false; committing = true; db.exec('COMMIT');
      if (db.isTransaction || setting() !== originalSetting) throw new Error('batting invocation commit changed'); account();
      db.exec('BEGIN'); db.exec('SAVEPOINT ' + marker); identified = true; proof(() => { storage(); verify(result); }); identity(); account();
      db.exec('RELEASE ' + marker); identified = false; db.exec('COMMIT'); if (db.isTransaction || setting() !== originalSetting) throw new Error('batting invocation committed proof changed'); account();
      return result;
    } catch (cause) {
      const cleanup: unknown[] = []; uncertain ||= committing;
      try { if (db.isTransaction) { if (identified) try { db.exec('ROLLBACK TO ' + marker); } catch (e) { uncertain = true; cleanup.push(e); }
        else uncertain = true; db.exec('ROLLBACK'); } else if (acquired) uncertain = true; } catch (e) { uncertain = true; cleanup.push(e); }
      try { if (setting() !== originalSetting) { uncertain = true; db.exec('PRAGMA query_only=' + originalSetting); } if (db.isTransaction) throw new Error('batting invocation cleanup retained transaction'); }
      catch (e) { uncertain = true; cleanup.push(e); }
      if (uncertain || cleanup.length) return retire(cause, cleanup); throw cause;
    }
  };
  return { run, close() { if (!closed) { closed = true; db.close(); } } };
};
