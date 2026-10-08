import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { createRequire } from 'node:module';
import { renewalOwnerSchema, installRenewalOwnerSchema, renewalOwnerTables } from './ActualReceivedUmpireRenewalSchema';
import { receivedOwnerSchema } from './ActualReceivedUmpireDefenderSchema';
import { receivedReadProofRetired } from './ActualReceivedUmpireDefenderTransaction';
const ownerSchema=(db:Pick<import('node:sqlite').DatabaseSync,'prepare'>)=>{receivedOwnerSchema(db);return renewalOwnerSchema(db);};
import { receivedId } from './ActualReceivedUmpireDefender';
type Db = import('node:sqlite').DatabaseSync;
// A private owner cannot safely reuse a connection whose proof cleanup failed,
// even when a subsequent outer ROLLBACK happens to succeed.
const failedProofCleanup = new WeakSet<Db>();
const proofRetired=(db:Db)=>failedProofCleanup.has(db)||receivedReadProofRetired(db);
const counters = (db: Db) => [db.prepare('SELECT total_changes() AS n').get()!.n,
  db.prepare('PRAGMA main.schema_version').get()!.schema_version, db.prepare('PRAGMA temp.schema_version').get()!.schema_version];
const equal = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const account = (db: Db, before: ReturnType<typeof counters>, changes = 0) => {
  const after = counters(db);
  if (typeof before[0] !== 'number' || !Number.isSafeInteger(before[0] + changes) || after[0] !== before[0] + changes
    || after[1] !== before[1] || after[2] !== before[2]) throw new Error('received renewal write accounting or schema differs');
};
/** Query-only nested proof. Only its own savepoint and entry query-only setting
 * are touched; the caller owns transaction completion and connection lifecycle. */
export const withRenewalReadProof = <T>(db: Db, body: () => T): T => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof DatabaseSync)) throw new Error('received renewal proof requires a native main connection');
  if (proofRetired(db)) throw new Error('received renewal proof connection retired after cleanup failure');
  if (!db.isTransaction) throw new Error('received renewal proof requires a caller transaction');
  const on = db.prepare('PRAGMA query_only').get()!.query_only, before = counters(db);
  if (on !== 0 && on !== 1) throw new Error('received renewal query-only state is invalid');
  let saved = false, failed = false, failure: unknown, value: T | undefined;
  const cleanup: unknown[] = [];
  try {
    db.exec('SAVEPOINT received_renewal_read_proof'); saved = true; db.exec('PRAGMA query_only=1');
    if (db.prepare('PRAGMA query_only').get()!.query_only !== 1) throw new Error('received renewal proof protection is missing');
    ownerSchema(db); value = withBattedWorldPhysicalReadTraversal(db, body); ownerSchema(db);
    if (!db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 1) throw new Error('received renewal proof transaction changed');
    account(db, before);
  } catch (error) { failed = true; failure = error; }
  finally {
    if (saved) try { db.exec('RELEASE received_renewal_read_proof'); } catch (error) { cleanup.push(error); }
    try {
      db.exec(`PRAGMA query_only=${on}`);
      if (!db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== on) throw new Error('received renewal proof caller state changed');
      account(db, before);
    } catch (error) { cleanup.push(error); }
  }
  if (cleanup.length) {
    failedProofCleanup.add(db);
    throw new AggregateError(failed ? [failure, ...cleanup] : cleanup, 'received renewal proof cleanup failed', { cause: failure });
  }
  if (failed) throw failure;
  return value as T;
};
/** Internal Native mechanics. Accepted Source callbacks belong to the concrete
 * owner and may run only through proof(); no caller-supplied evidence is used. */
export const openRenewalTransaction = (path: string) => {
  if (!receivedId(path)) throw new Error('invalid received renewal database path');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(path); let closed = false, busy = false;
  try { db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000'); ownerSchema(db); }
  catch (error) { db.close(); throw error; }
  const retire = () => { if (!closed) { closed = true; db.close(); } };
  const use = <T>(body: () => T): T => {
    if (closed || proofRetired(db)) { retire(); throw new Error('closed or retired received renewal store'); }
    if (busy) throw new Error('received renewal store re-entry');
    busy = true; try { return body(); } finally { busy = false; }
  };
  const rollback = (error: unknown): never => {
    try {
      if (db.isTransaction) db.exec('ROLLBACK');
      if (db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 0) throw new Error('received renewal rollback state differs');
    } catch (cleanup) { retire(); throw new AggregateError([error, cleanup], 'received renewal cleanup failed; retired', { cause: error }); }
    if (proofRetired(db)) retire();
    throw error;
  };
  const uncertain = (error: unknown): never => {
    const failures = [error];
    try { if (db.isTransaction) db.exec('ROLLBACK'); } catch (cleanup) { failures.push(cleanup); }
    try { retire(); } catch (cleanup) { failures.push(cleanup); }
    // A Native observer may already have committed some or all rows. Cleanup
    // cannot undo that commit and must not repair or relabel its durable state.
    throw new AggregateError(failures, 'received renewal uncertain commit or transaction ownership; store retired', { cause: error });
  };
  const entry = () => {
    if (db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 0) throw new Error('received renewal private transaction entry state differs');
  };
  const completedBoundary = (before: ReturnType<typeof counters>, changes = 0) => {
    ownerSchema(db);
    if (db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 0 || proofRetired(db)) {
      throw new Error('received renewal post-commit state differs');
    }
    account(db, before, changes);
  };
  const read = <T>(body: () => T): T => use(() => {
    let commitAttempted = false;
    try {
      entry(); const before = counters(db);
      db.exec('BEGIN'); const value = withRenewalReadProof(db, body);
      if (!db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 0 || proofRetired(db)) {
        throw new Error('received renewal read transaction state differs');
      }
      account(db, before);
      commitAttempted = true; db.exec('COMMIT'); completedBoundary(before);
      return value;
    } catch (error) { return commitAttempted ? uncertain(error) : rollback(error); }
  });
  const write = <T>(options: Readonly<{bootstrap: boolean; changes: number}>, body: () => T, verifyCommitted: () => void,
    beforeBootstrap?: () => void): T => use(() => {
    let ownerSentinel = false, finalizing = false;
    const releaseOwner = () => {
      db.exec('RELEASE received_renewal_write_owner');
      ownerSentinel = false;
    };
    try {
      entry(); db.exec('BEGIN IMMEDIATE');
      // This sentinel spans bootstrap, every producer/head/journal write and
      // their proofs. A COMMIT/ROLLBACK followed by BEGIN loses it permanently.
      ownerSentinel = true; db.exec('SAVEPOINT received_renewal_write_owner');
      // Concrete enrollment admission must reject surviving renewal claims
      // before even reversible old-family setup is attempted.
      if (beforeBootstrap) withRenewalReadProof(db,beforeBootstrap);
      const initial = ownerSchema(db);
      if (!options.bootstrap && initial === 'pristine') throw new Error('received renewal enrollment schema is missing');
      const beforeSetup = db.prepare('SELECT * FROM main.sqlite_master ORDER BY name').all(), setupCounters = counters(db);
      if (initial === 'pristine') installRenewalOwnerSchema(db);
      ownerSchema(db);
      const afterSetup = db.prepare('SELECT * FROM main.sqlite_master ORDER BY name').all();
      if (counters(db)[0] !== setupCounters[0] || counters(db)[2] !== setupCounters[2]
        || beforeSetup.some(row => !afterSetup.some(after => equal(row, after)))
        || afterSetup.some(row => !beforeSetup.some(before => equal(row, before))
          && !(renewalOwnerTables as readonly unknown[]).includes(row.tbl_name))) throw new Error('received renewal bootstrap schema conservation differs');
      const before = counters(db); const value = body();
      if (!db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 0 || proofRetired(db)) {
        throw new Error('received renewal write transaction changed');
      }
      account(db, before, options.changes); ownerSchema(db);
      // Once the identity sentinel is released, failures are conservatively
      // uncertain: an observer at either final boundary may have committed.
      finalizing = true; releaseOwner();
      db.exec('COMMIT'); completedBoundary(before, options.changes);
      db.exec('BEGIN'); withRenewalReadProof(db, verifyCommitted);
      if (!db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 0 || proofRetired(db)) {
        throw new Error('received renewal durable proof transaction state differs');
      }
      account(db, before, options.changes);
      db.exec('COMMIT'); completedBoundary(before, options.changes);
      return value;
    } catch (error) {
      if (finalizing) return uncertain(error);
      if (ownerSentinel) {
        try { releaseOwner(); }
        catch (identityError) { return uncertain(new AggregateError([error, identityError], 'received renewal write transaction ownership was lost', { cause: error })); }
      }
      return rollback(error);
    }
  });
  return Object.freeze({ db, read, write, proof: <T>(body: () => T) => withRenewalReadProof(db, body),
    close() { if (busy) throw new Error('received renewal store re-entry'); retire(); } });
};
