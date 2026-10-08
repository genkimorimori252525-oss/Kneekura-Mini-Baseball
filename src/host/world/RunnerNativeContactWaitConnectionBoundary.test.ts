import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { runnerContactWaitPolicyViewEvidenceFromSqlite } from './SqliteActualLocomotionStore';

it('requires the actual native connection before exposing saved runner contact wait evidence', () => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  try {
    const real = runnerContactWaitPolicyViewEvidenceFromSqlite(db);
    expect(real.readPolicy('unsaved-policy')).toBeNull(); expect(real.readView('unsaved-view')).toBeNull();
    let facadeReads = 0;
    const facade = { prepare(sql: string) { facadeReads++; return db.prepare(sql); } };
    let rejected = false;
    try { runnerContactWaitPolicyViewEvidenceFromSqlite(facade); }
    catch (error) {
      expect(error).toBeInstanceOf(Error); expect((error as Error).message).toMatch(/native/i); rejected = true;
    }
    expect(facadeReads).toBe(0);
    expect(rejected).toBe(true);
  } finally { db.close(); }
});
