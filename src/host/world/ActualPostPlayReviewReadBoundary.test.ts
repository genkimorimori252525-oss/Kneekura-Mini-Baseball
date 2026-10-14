import { createRequire } from 'node:module';
import { expect, it, vi } from 'vitest';
import { actualPostPlayReviewEvidenceFromSqlite } from './ActualPostPlayReviewFromSqlite';
import { memoSamePaLifecycleRead, withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { activeBattedWorldFieldReadFrame } from './SqliteBattedWorldFieldStore';
import type { AcceptedActualPostPlayReviewSession } from './ActualPostPlayReviewSource';
import type { PostPlayReviewDb } from './ActualPostPlayReviewNativeScope';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const ref = <O extends string>(owner: O) => ({ owner, sourceId: 'missing-original', sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) });
const source: AcceptedActualPostPlayReviewSession = { sourceId: 'session', sourceVersion: 'test', capability: 'actual_post_play_review_session_v1',
  adjudicationSourceId: 'seed', adjudicationSnapshotHash: 'c'.repeat(64), officialPolicy: null, policy: null,
  reservedCatchSeed: { sourceId: 'seed', sourceVersion: 'test', capability: 'same_pa_catch_review_seed_v1', policy: null,
    viewReference: ref('pa_lifecycle_v1_execution_views'), catchWorkReference: ref('pa_catch_v1_work'),
    physicalOperationReference: ref('pa_physical_v1_field_steps') } };

/** Real SQLite and actual lifecycle proof gates, without fabricating baseball
 * archives. The probe observes SQL entry; every statement still uses Native. */
it.each(['BEGIN', 'BEGIN IMMEDIATE'] as const)('PPRB01 protects the evidence read and restores writable state inside %s', begin => {
  const db = new DatabaseSync(':memory:'); db.exec('CREATE TABLE journal_probe(value INTEGER); ' + begin);
  const prepare = db.prepare.bind(db); let probes = 0, materializations = 0;
  const originals: Readonly<{ count: number }>[] = [];
  const readOriginal = () => withSamePaLifecycleReadPhase(db, () => memoSamePaLifecycleRead(db, 'review-original-test', () => {
    materializations++;
    return Object.freeze({ count: Number(db.prepare('SELECT count(*) AS n FROM journal_probe').get()!.n) });
  }));
  const spy = vi.spyOn(db, 'prepare').mockImplementation(sql => {
    if (sql === "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?") {
      probes++;
      // These are separate child scopes; only the production owner proof can
      // retain their completed Native evidence until this operation returns.
      const first = readOriginal(); expect(readOriginal()).toBe(first); originals.push(first);
      withSamePaLifecycleReadPhase(db, () => {
        expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
        expect(activeBattedWorldFieldReadFrame(db)).not.toBeNull();
        expect(() => db.exec('INSERT INTO journal_probe VALUES(99)')).toThrow(/readonly/i);
      });
    }
    return prepare(sql);
  });
  try {
    const owner = actualPostPlayReviewEvidenceFromSqlite(db);
    expect(owner.readSession('absent')).toBeNull(); expect(probes).toBe(1); expect(materializations).toBe(1);
    expect(owner.readSession('absent')).toBeNull(); expect(probes).toBe(2); expect(materializations).toBe(2);
    expect(originals).toEqual([{ count: 0 }, { count: 0 }]); expect(originals[1]).not.toBe(originals[0]);
    expect(db.isTransaction).toBe(true); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    expect(activeBattedWorldFieldReadFrame(db)).toBeNull();
    db.exec('INSERT INTO journal_probe VALUES(1)');
    expect(db.prepare('SELECT value FROM journal_probe').all()).toEqual([{ value: 1 }]); db.exec('COMMIT');
  } finally { spy.mockRestore(); if (db.isTransaction) db.exec('ROLLBACK'); db.close(); }
});

it('PPRB03 preserves missing-session fallback without a Native transaction', () => {
  const prepareOnly = { prepare(sql: string) {
    if (sql !== "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?") throw new Error('unexpected fallback query');
    return { get: () => undefined };
  } } as unknown as PostPlayReviewDb;
  expect(actualPostPlayReviewEvidenceFromSqlite(prepareOnly).readSession('absent')).toBeNull();
  const db = new DatabaseSync(':memory:');
  try {
    expect(actualPostPlayReviewEvidenceFromSqlite(db).readSession('absent')).toBeNull();
    expect(db.isTransaction).toBe(false); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  } finally { db.close(); }
});

it.each(['BEGIN', 'BEGIN IMMEDIATE'] as const)('PPRB02 reaches the original reserved-catch reader and restores %s after its missing-owner failure', begin => {
  const db = new DatabaseSync(':memory:'); db.exec('CREATE TABLE journal_probe(value INTEGER); ' + begin);
  try {
    expect(() => actualPostPlayReviewEvidenceFromSqlite(db).deriveSession(source)).toThrow(/missing|namespace|no such table/);
    expect(db.isTransaction).toBe(true); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    expect(activeBattedWorldFieldReadFrame(db)).toBeNull();
    db.exec('INSERT INTO journal_probe VALUES(2)');
    expect(db.prepare('SELECT value FROM journal_probe').all()).toEqual([{ value: 2 }]); db.exec('COMMIT');
  } finally { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); }
});
