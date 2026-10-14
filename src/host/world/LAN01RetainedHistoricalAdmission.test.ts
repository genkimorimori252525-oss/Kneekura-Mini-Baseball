import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { expect, it, vi } from 'vitest';
import { readLAN01RetainedHistoricalAdmission } from './LAN01RetainedHistoricalAdmission.test-support';
import { withSamePaContinuationReadPhase } from './SamePlateAppearanceContinuationFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';

const boundary = vi.hoisted(() => ({
  enrollment: { kind: 'reserved', source: { sourceId: 'lan01:occupied:enrollment' } },
  view: { source: { sourceId: '' } } as { kind?: string; source: { sourceId: string;
    enrollmentReference?: import('./SamePlateAppearanceWorkPrefix').SamePaReference<'same_pa_enrollments'> } },
  reads: [] as string[], failure: null as Error | null,
}));
vi.mock('./SamePlateAppearanceEnrollmentFromSqlite', async importOriginal => ({
  ...await importOriginal<typeof import('./SamePlateAppearanceEnrollmentFromSqlite')>(),
  readSamePlateAppearanceEnrollment: () => { throw new Error('current enrollment is blocked by completed continuation'); },
  readHistoricalSamePlateAppearanceEnrollment: (db: DatabaseSync, id: string) => withSamePaContinuationReadPhase(db, () => {
    boundary.reads.push(id); return boundary.enrollment;
  }),
}));
vi.mock('./SamePlateAppearanceExecutionFromSqlite', async importOriginal => ({
  ...await importOriginal<typeof import('./SamePlateAppearanceExecutionFromSqlite')>(),
  proveSamePaExecution: () => { throw new Error('current empty execution is blocked by completed continuation'); },
}));
// Substitute expensive original evidence only. The helper, Native read scope,
// immutable-phase ownership and reference comparison remain real.
vi.mock('./SamePlateAppearanceHistoricalExecutionEvidenceFromSqlite', () => ({
  readHistoricalSamePaExecutionView: (db: DatabaseSync, pin: { sourceId: string }) => withSamePaContinuationReadPhase(db, () => {
    boundary.reads.push(pin.sourceId); if (boundary.failure) throw boundary.failure;
    return { view: boundary.view };
  }),
}));
const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fixture = () => {
  boundary.reads = []; boundary.failure = null;
  boundary.view = { kind: 'basis_prepared', source: { sourceId: 'lan01:occupied:view',
    enrollmentReference: reference('same_pa_enrollments', boundary.enrollment) } };
  return { db: new Native(':memory:'), pin: reference('reserved_pa_execution_views', boundary.view) };
};
const restored = (db: DatabaseSync) => {
  expect(db.isTransaction).toBe(false);
  expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  expect(db.prepare('SELECT total_changes() n').get()!.n).toBe(0);
};
it('authenticates the original enrollment and empty view after current continuation claims without fresh admission', () => {
  const { db, pin } = fixture();
  try {
    expect(readLAN01RetainedHistoricalAdmission(db, pin)).toEqual({ enrollment: boundary.enrollment, view: boundary.view });
    expect(boundary.reads).toEqual(['lan01:occupied:enrollment', 'lan01:occupied:view']); restored(db);
  } finally { db.close(); }
});
it('propagates rejection of historical evidence and restores its query-only scope without a write', () => {
  const { db, pin } = fixture(); const failure = new Error('original historical TOTAL ownership differs'); boundary.failure = failure;
  try { expect(() => readLAN01RetainedHistoricalAdmission(db, pin)).toThrow(failure); restored(db); }
  finally { db.close(); }
});
it('rejects a foreign historical view even when its immutable evidence reader returns', () => {
  const { db, pin } = fixture(); boundary.view = { ...boundary.view, source: { ...boundary.view.source, sourceId: 'foreign-view' } };
  try { expect(() => readLAN01RetainedHistoricalAdmission(db, pin)).toThrow(/view reference/); restored(db); }
  finally { db.close(); }
});
it('rejects a view bound to a different original enrollment', () => {
  const { db } = fixture();
  boundary.view = { ...boundary.view, source: { ...boundary.view.source,
    enrollmentReference: reference('same_pa_enrollments', { source: { sourceId: 'foreign-enrollment' } }) } };
  const pin = reference('reserved_pa_execution_views', boundary.view);
  try { expect(() => readLAN01RetainedHistoricalAdmission(db, pin)).toThrow(/enrollment reference/); restored(db); }
  finally { db.close(); }
});
it('rejects an alternate view identity before reading historical evidence', () => {
  const { db, pin } = fixture();
  try {
    expect(() => readLAN01RetainedHistoricalAdmission(db, { ...pin, sourceId: 'other:view' })).toThrow(/view reference identity/);
    expect(boundary.reads).toEqual([]); restored(db);
  } finally { db.close(); }
});
