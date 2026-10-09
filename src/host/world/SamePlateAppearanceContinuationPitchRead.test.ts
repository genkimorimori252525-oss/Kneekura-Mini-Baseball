import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { expect, it, vi } from 'vitest';
import * as continuation from './SamePlateAppearanceContinuationFromSqlite';
import { withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';

const dispatch = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('./SqliteSamePlateAppearanceDispatchStore', async original => ({
  ...await original<typeof import('./SqliteSamePlateAppearanceDispatchStore')>(),
  readSamePaExecutedPitchFromSqlite: dispatch.read,
}));
const ref: SamePaReference<'pa_dispatch_v1_pitch_actions'> = {
  owner: 'pa_dispatch_v1_pitch_actions', sourceId: 'original-pitch', sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64),
};
const native = () => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE proof_input(value INTEGER); INSERT INTO proof_input VALUES(7); PRAGMA query_only=1; BEGIN');
  return db;
};
const close = (db: DatabaseSync) => { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); };

/** Real Native phase lifetime with the expensive original dispatch replay
 * substituted. This proves reuse/invalidation, not baseball Source ownership. */
it('shares the completed first-pitch replay across sibling readers only within one Native continuation phase', () => {
  const read = continuation.readSamePaContinuationOriginalPitchFromSqlite;
  expect(read).toBeTypeOf('function');
  const db = native(), other = native();
  dispatch.read.mockReset().mockImplementation((connection: DatabaseSync, pin: typeof ref) => Object.freeze({
    reference: Object.freeze({ ...pin }), value: connection.prepare('SELECT value FROM proof_input').get()!.value,
  }));
  try {
    const first = continuation.withSamePaContinuationReadPhase(db, () => {
      const value = withSamePaLifecycleReadPhase(db, () => read(db, ref));
      expect(withSamePaLifecycleReadPhase(db, () => read(db, { ...ref }))).toBe(value);
      expect(read(db, ref)).toBe(value); expect(dispatch.read).toHaveBeenCalledTimes(1);
      expect(read(other, ref)).toEqual(value); expect(dispatch.read).toHaveBeenCalledTimes(2);
      return value;
    });
    expect(read(db, ref)).toEqual(first); expect(dispatch.read).toHaveBeenCalledTimes(3);
    expect(read(db, ref)).not.toBe(first); expect(dispatch.read).toHaveBeenCalledTimes(4);
  } finally { close(db); close(other); }
});

it('keeps complete reference checks and poisons first-pitch reuse on failure, mutation, schema change, commit or cycle', () => {
  const read = continuation.readSamePaContinuationOriginalPitchFromSqlite;
  expect(read).toBeTypeOf('function');
  const db = native();
  const replay = () => Object.freeze({ reference: Object.freeze({ ...ref }), value: db.prepare('SELECT value FROM proof_input').get()!.value });
  dispatch.read.mockReset().mockImplementation(replay);
  try {
    expect(() => continuation.withSamePaContinuationReadPhase(db, () => {
      read(db, ref);
      // Same Source id with another full reference must reach the original
      // reader, then reject its differing proof instead of borrowing this hit.
      expect(() => read(db, { ...ref, snapshotHash: 'c'.repeat(64) })).toThrow();
      expect(dispatch.read).toHaveBeenCalledTimes(2);
      expect(() => read(db, ref)).toThrow(/expired/);
    })).toThrow(/expired/);
    expect(() => continuation.withSamePaContinuationReadPhase(db, () => {
      read(db, ref);
      expect(() => read(db, { ...ref, owner: 'other' } as never)).toThrow(/reference/);
      expect(() => read(db, ref)).toThrow(/expired/);
    })).toThrow(/expired/);
    for (const mutation of [
      'PRAGMA query_only=0; UPDATE proof_input SET value=8; UPDATE proof_input SET value=7; PRAGMA query_only=1',
      'PRAGMA query_only=0; CREATE TEMP TABLE changed(value); DROP TABLE changed; PRAGMA query_only=1',
      'COMMIT; BEGIN',
    ]) {
      expect(() => continuation.withSamePaContinuationReadPhase(db, () => {
        read(db, ref); db.exec(mutation); return read(db, ref);
      })).toThrow();
      expect(read(db, ref)).toMatchObject({ value: 7 });
    }
    dispatch.read.mockImplementation(() => read(db, ref));
    expect(() => read(db, ref)).toThrow(/cycle/);
    dispatch.read.mockImplementation(replay);
    expect(read(db, ref)).toMatchObject({ value: 7 });
    db.exec('COMMIT'); expect(() => read(db, ref)).toThrow(/query-only ownership/);
  } finally { close(db); }
});
