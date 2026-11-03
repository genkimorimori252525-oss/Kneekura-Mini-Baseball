import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { assertNoMutableSamePaContinuationReadPhase, memoSamePaContinuationRead, withSamePaContinuationReadPhase } from './SamePlateAppearanceContinuationFromSqlite';

/** Complete DB-only guard evidence within an already immutable Native proof.
 * Providers/current admission are never cached. q0 and partial adapters keep
 * their existing direct path; writes and later operations start fresh proofs. */
export function memoNativeWorkloadGuardV127<T>(db: Pick<DatabaseSync, 'prepare'>, key: string, read: () => T): T {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof Native)) return read();
  if (!db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 1) {
    assertNoMutableSamePaContinuationReadPhase(db); return read();
  }
  return withSamePaContinuationReadPhase(db, () => {
    // Same main-only rule as the Venue reader, before every hit. These guards
    // read DB metadata only: opening a physical field replay traversal here
    // would repeatedly discard the caller's dependent physical read frame.
    const databases = db.prepare('PRAGMA database_list').all();
    if (databases.filter(row => row.name === 'main').length !== 1
      || databases.some(row => row.name !== 'main' && row.name !== 'temp')
      || db.prepare("SELECT name FROM temp.sqlite_master WHERE type IN ('table','view') LIMIT 1").get()) {
      throw new Error('workload guard requires main-only authority storage');
    }
    return memoSamePaContinuationRead(db, 'workload-guard-v127:' + key, read);
  });
}
