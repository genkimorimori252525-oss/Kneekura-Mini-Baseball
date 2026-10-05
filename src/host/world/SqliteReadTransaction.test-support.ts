import type { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

/** One synchronous helper-owned read group on the caller's real connection.
 * Writers stay outside this bracket; no evidence survives as a cached proof. */
export const withSqliteReadTransaction = <T>(db: DatabaseSync, body: () => T): T => {
  if (db.isTransaction) throw new Error('helper read requires its own transaction');
  const queryOnly = () => db.prepare('PRAGMA query_only').get()!.query_only;
  const beforeQueryOnly = queryOnly();
  if (beforeQueryOnly !== 0 && beforeQueryOnly !== 1) throw new Error('helper read query-only state is unavailable');
  const savepoint = `helper_read_${randomUUID().replaceAll('-', '')}`;
  let began = false, failed = false, failure: unknown, value!: T;
  const cleanupErrors: unknown[] = [];
  try {
    db.exec('BEGIN'); began = true;
    db.exec(`SAVEPOINT ${savepoint}`);
    if (beforeQueryOnly === 0) db.exec('PRAGMA query_only=ON');
    if (queryOnly() !== 1) throw new Error('helper read query-only guard is unavailable');
    value = body();
    if (!db.isTransaction) throw new Error('helper read transaction ended during its read group');
    if (queryOnly() !== 1) throw new Error('helper read query-only guard changed during its read group');
    // A private savepoint detects rollback/rebegin even when isTransaction is true.
    db.exec(`RELEASE ${savepoint}`);
    db.exec('COMMIT'); began = false;
  } catch (error) { failed = true; failure = error; }
  finally {
    if (began) {
      try { if (db.isTransaction) db.exec('ROLLBACK'); }
      catch (error) { cleanupErrors.push(error); }
    }
    try {
      if (queryOnly() !== beforeQueryOnly) db.exec(`PRAGMA query_only=${beforeQueryOnly}`);
      if (queryOnly() !== beforeQueryOnly) throw new Error('helper read query-only setting could not be restored');
    } catch (error) { cleanupErrors.push(error); }
  }
  if (cleanupErrors.length) throw new AggregateError([...(failed ? [failure] : []), ...cleanupErrors],
    'helper read transaction or setting cleanup failed', { cause: failed ? failure : cleanupErrors[0] });
  if (failed) throw failure;
  return value;
};
