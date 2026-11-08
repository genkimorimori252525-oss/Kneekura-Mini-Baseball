import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { measuredPracticeReadFixtureV134 } from './MeasuredPracticeReadV134.test-support';
import { readStandalonePracticeRepetition } from './SqliteStandalonePracticeStore';
import { withNativeDevelopmentReadPhaseV126 } from './NativeDevelopmentReadPhaseV126';
import * as motion from './StandalonePracticeMotion';

const cleanup: (() => void)[] = [];
let f: Awaited<ReturnType<typeof measuredPracticeReadFixtureV134>>;
beforeAll(async () => { f = await measuredPracticeReadFixtureV134(cleanup); }, 60_000);
afterAll(() => { while (cleanup.length) cleanup.pop()!(); });

/** The scalar counter calls the real pure executor and changes no returned
 * value. No Native owner, occurrence, qualification or receipt is mocked. */
function counter() {
  const original = motion.executeStandalonePracticeMotion; let count = 0;
  const spy = vi.spyOn(motion, 'executeStandalonePracticeMotion').mockImplementation((s, frame, tick) => {
    if (s.sourceId === f.source.sourceId && tick === s.endTick) count++;
    return original(s, frame, tick);
  });
  return { count: () => count, restore: () => spy.mockRestore() };
}
const read = () => readStandalonePracticeRepetition(f.db, f.development, f.eventId);
const phase = <T>(body: () => T): T => {
  f.db.exec('BEGIN');
  try { return withNativeDevelopmentReadPhaseV126(f.db, body); }
  finally { if (f.db.isTransaction) f.db.exec('ROLLBACK'); }
};

it('MPR134 shares only completed measured math in one Native q1 phase while reauthenticating the real Owned guard every time', () => {
  const c = counter();
  try {
    let proof: ReturnType<typeof read>;
    phase(() => {
      proof = read(); const first = c.count(), guards = f.guardReads();
      expect(first).toBeGreaterThan(0);
      expect(Object.isFrozen(proof)).toBe(true); expect(Object.isFrozen(proof.event)).toBe(true);
      expect(read()).toEqual(proof);
      expect(f.guardReads()).toBeGreaterThan(guards);
      expect(c.count(), 'a sibling proof must not execute the same completed measured physical calculation again').toBe(first);
    });
    const previous = c.count(); phase(() => expect(read()).toEqual(proof!));
    expect(c.count()).toBeGreaterThan(previous);
    f.db.exec('BEGIN');
    try { read(); const first = c.count(); read(); expect(c.count()).toBeGreaterThan(first); }
    finally { f.db.exec('ROLLBACK'); }
  } finally { c.restore(); }
});

it('MPR135 cannot reuse math to bypass a caught mutable Owned guard rejection or a changed Native namespace', () => {
  expect(() => phase(() => {
    read(); f.rejectGuard(true);
    try { expect(() => withNativeDevelopmentReadPhaseV126(f.db, read)).toThrow(/mutable owned guard/); }
    finally { f.rejectGuard(false); }
    expect(() => withNativeDevelopmentReadPhaseV126(f.db, read)).toThrow(/expired/);
  })).toThrow(/expired/);
  expect(() => phase(() => {
    read(); f.db.exec('PRAGMA query_only=0; CREATE TEMP TABLE m134_namespace_probe(value TEXT); PRAGMA query_only=1');
    expect(() => withNativeDevelopmentReadPhaseV126(f.db, read)).toThrow();
  })).toThrow();
});

it('MPR136 cannot retain a completed result after a same-transaction DML change and query-only restoration', () => {
  expect(() => phase(() => {
    read(); f.db.exec('PRAGMA query_only=0');
    f.db.prepare('UPDATE standalone_practice_commands SET snapshot_hash=? WHERE source_id=?').run('fault-injected', f.source.sourceId);
    f.db.exec('PRAGMA query_only=1');
    expect(() => withNativeDevelopmentReadPhaseV126(f.db, read)).toThrow();
  })).toThrow();
});
