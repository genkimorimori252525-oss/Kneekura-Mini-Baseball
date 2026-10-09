import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { memoSamePaContinuationRead as memo, withSamePaContinuationReadPhase } from './SamePlateAppearanceContinuationFromSqlite';
import { withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';

/** Native proof-lifetime regression only. BI01 covers complete perception
 * row/head/reference replay; this fixture needs no accepted baseball Sources. */
it('reuses a completed historical proof across child readers only until the enclosing continuation phase ends', () => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE proof_input(value INTEGER); INSERT INTO proof_input VALUES(7); PRAGMA query_only=1; BEGIN');
  let reads = 0;
  const read = () => memo(db, 'perception-history', () => {
    reads++;
    return Object.freeze({ value: Number(db.prepare('SELECT value FROM proof_input').get()!.value) });
  });
  try {
    const first = withSamePaContinuationReadPhase(db, () => {
      const value = withSamePaLifecycleReadPhase(db, read);
      expect(withSamePaLifecycleReadPhase(db, read)).toBe(value);
      expect(read()).toBe(value);
      expect(reads).toBe(1);
      return value;
    });
    const next = withSamePaContinuationReadPhase(db, read);
    expect(next).toEqual(first); expect(next).not.toBe(first); expect(reads).toBe(2);
    expect(db.isTransaction).toBe(true);
    expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);

    // A caught nested failure still poisons this parent's completed proofs.
    expect(() => withSamePaContinuationReadPhase(db, () => {
      read();
      expect(() => memo(db, 'failure', () => { throw new Error('read failed'); })).toThrow('read failed');
      expect(read).toThrow(/expired/);
    })).toThrow(/expired/);
    expect(withSamePaContinuationReadPhase(db, read)).toEqual(first);

    expect(() => withSamePaContinuationReadPhase(db, () =>
      memo(db, 'cycle', () => memo(db, 'cycle', () => 0)))).toThrow(/cycle/);
    for (const mutation of [
      'PRAGMA query_only=0; UPDATE proof_input SET value=8; UPDATE proof_input SET value=7; PRAGMA query_only=1',
      'PRAGMA query_only=0; CREATE TEMP TABLE changed(value); DROP TABLE changed; PRAGMA query_only=1',
      'COMMIT; BEGIN',
    ]) {
      expect(() => withSamePaContinuationReadPhase(db, () => {
        read(); db.exec(mutation); return read();
      })).toThrow();
      expect(withSamePaContinuationReadPhase(db, read)).toEqual(first);
    }
    db.exec('COMMIT');
    expect(read).toThrow(/query-only ownership/);
  } finally { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); }
});
