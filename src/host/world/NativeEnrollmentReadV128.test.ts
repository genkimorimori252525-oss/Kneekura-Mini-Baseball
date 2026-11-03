import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { directNativeDispatchFixture } from './SamePlateAppearanceDirectNative.test-support';
import { readHistoricalSamePlateAppearanceEnrollment, readSamePlateAppearanceEnrollmentBasis } from './SamePlateAppearanceEnrollmentFromSqlite';
import { withSamePaContinuationReadPhase } from './SamePlateAppearanceContinuationFromSqlite';
import { withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

// Keep the original Actor/Persons, nine defenders and accepted 32 calibrations.
// Only the read transaction changes between tests; no owner is replaced.
let fixture: ReturnType<typeof directNativeDispatchFixture>;
const enrollmentId = 'native-enrollment';
beforeAll(() => { fixture = directNativeDispatchFixture(); }, 90_000);
afterEach(() => { vi.restoreAllMocks(); });
afterAll(() => { fixture?.close(); });
const readPhase = <T>(body: () => T) => withSqliteReadTransaction(fixture.db,
  () => withSamePaContinuationReadPhase(fixture.db, body));
const read = (id = enrollmentId) => readSamePlateAppearanceEnrollmentBasis(fixture.db, id);

function probe() {
  const db = fixture.db, original = db.prepare.bind(db);
  let complete = 0, identity = 0;
  vi.spyOn(db, 'prepare').mockImplementation(sql => {
    // This exact original-reference check is unconditional in deriveEnrollment,
    // after root/member/right and original Actor authentication. Count actual
    // Native prepares, retaining neither StatementSync nor the large SQL text.
    if (sql.startsWith('SELECT * FROM main.physical_plate_appearance_actors WHERE source_id=$id OR')) complete++;
    if (sql.startsWith('SELECT * FROM same_pa_enrollments WHERE source_id=$id')) identity++;
    return original(sql);
  });
  return { complete: () => complete, identity: () => identity };
}

it('authenticates a complete enrollment once across sibling Lifecycle readers in one Continuation snapshot, then reauthenticates', () => {
  const counts = probe();
  let original!: NonNullable<ReturnType<typeof read>>;
  let firstAuthenticationSql = 0;
  readPhase(() => {
    original = withSamePaLifecycleReadPhase(fixture.db, () => read())!;
    expect(original.enrollment.participants).toHaveLength(10);
    expect(original.actor.defenderBindings).toHaveLength(9);
    expect(fixture.acceptedCalibrations.calibrations).toHaveLength(32);
    firstAuthenticationSql = counts.complete();
    expect(firstAuthenticationSql).toBeGreaterThan(0);
    const sibling = withSamePaLifecycleReadPhase(fixture.db, () => read());
    expect(sibling).toEqual(original);
    expect(counts.complete()).toBe(firstAuthenticationSql);
  });
  readPhase(() => expect(read()).toEqual(original));
  expect(counts.complete()).toBe(2 * firstAuthenticationSql);
});

it('freezes the complete returned basis including its wrapper, Actor and every nested array/object', () => {
  readPhase(() => {
    const basis = read()!, before = hash(basis);
    const visit = (value: unknown): void => {
      if (value === null || typeof value !== 'object') return;
      expect(Object.isFrozen(value)).toBe(true);
      for (const child of Object.values(value)) visit(child);
    };
    visit(basis);
    expect(Reflect.set(basis, 'actor', null)).toBe(false);
    expect(Reflect.set(basis.actor.binding, 'playerId', 'other-player')).toBe(false);
    expect(hash(read())).toBe(before);
  });
});

it('does not cache absent identities or share different keys, and keeps inactive q0 reads fresh', () => {
  const counts = probe();
  readPhase(() => {
    expect(read()).not.toBeNull();
    const before = counts.identity();
    expect(read('missing-enrollment-a')).toBeNull();
    expect(read('missing-enrollment-a')).toBeNull();
    expect(read('missing-enrollment-b')).toBeNull();
    expect(counts.identity() - before).toBe(3);
    expect(read()!.enrollment.source.sourceId).toBe(enrollmentId);
  });
  const before = counts.complete();
  expect(fixture.db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  expect(read()).not.toBeNull(); const afterFirst = counts.complete();
  expect(afterFirst).toBeGreaterThan(before);
  expect(read()).not.toBeNull(); expect(counts.complete()).toBeGreaterThan(afterFirst);
  withSqliteReadTransaction(fixture.db, () => {
    const before = counts.complete();
    expect(read()).not.toBeNull(); const afterFirst = counts.complete();
    expect(afterFirst).toBeGreaterThan(before);
    expect(read()).not.toBeNull(); expect(counts.complete()).toBeGreaterThan(afterFirst);
  });
});

it('poisons a caught authentication failure before another completed enrollment can be reused', () => {
  let invalid: unknown, retry: unknown;
  expect(() => readPhase(() => {
    expect(read()).not.toBeNull();
    try { read(' invalid-source-id '); } catch (error) { invalid = error; }
    try { read(); } catch (error) { retry = error; }
  })).toThrow(/phase expired/);
  expect(String(invalid)).toMatch(/invalid.*Source identity/);
  expect(String(retry)).toMatch(/phase expired/);
});

it('poisons a caught original member authentication failure before an absent-ID read can return null', () => {
  const db = fixture.db; let authentication: unknown, retry: unknown;
  db.exec('SAVEPOINT enrollment_member_fault');
  try {
    db.prepare('UPDATE same_pa_participant_reservations SET member_json=? WHERE player_id=?')
      .run('{"invalid":"original-member"}', fixture.actor.defenderBindings[8].playerId);
    db.exec('PRAGMA query_only=1');
    expect(() => withSamePaContinuationReadPhase(db, () => {
      try { read(); } catch (error) { authentication = error; }
      try { read('missing-after-member-failure'); } catch (error) { retry = error; }
    })).toThrow(/phase expired/);
    expect(String(authentication)).toMatch(/same-PA reservation/);
    expect(String(retry)).toMatch(/phase expired/);
  } finally {
    db.exec('PRAGMA query_only=0'); db.exec('ROLLBACK TO enrollment_member_fault'); db.exec('RELEASE enrollment_member_fault');
  }
});

it.each(['DML', 'namespace', 'mutable-read'] as const)('rejects a completed hit after %s and preserves caught-failure poisoning', fault => {
  const db = fixture.db; let first: unknown, retry: unknown;
  try {
    expect(() => readPhase(() => {
      expect(read()).not.toBeNull();
      if (fault === 'namespace') db.exec("ATTACH DATABASE ':memory:' AS unrelated_owner");
      else {
        db.exec('PRAGMA query_only=0');
        if (fault === 'DML') {
          db.prepare('UPDATE world_player_workload_heads SET revision=revision WHERE player_id=?').run('p2');
          db.exec('PRAGMA query_only=1');
        }
      }
      try { read(); } catch (error) { first = error; }
      if (fault === 'mutable-read') db.exec('PRAGMA query_only=1');
      try { read(); } catch (error) { retry = error; }
    })).toThrow();
    expect(first).toBeInstanceOf(Error);
    expect(String(retry)).toMatch(/phase expired/);
  } finally {
    if (fault === 'namespace') db.exec('DETACH DATABASE unrelated_owner');
  }
});

it('does not treat historical evidence as current admission after a later-phase raw head fault', () => {
  const db = fixture.db;
  const original = readPhase(() => read()!.enrollment);
  // Explicit corruption injection, not a claimed valid workload progression:
  // the reservation correctly prevents a new ordinary workload-owner apply.
  db.exec('SAVEPOINT enrollment_head_fault');
  try {
    db.prepare('UPDATE world_player_workload_heads SET revision=revision+1 WHERE player_id=?').run('p2');
    db.exec('PRAGMA query_only=1');
    expect(() => withSamePaContinuationReadPhase(db, () => read())).toThrow(/workload head differs/);
    expect(withSamePaContinuationReadPhase(db, () => readHistoricalSamePlateAppearanceEnrollment(db, enrollmentId))).toEqual(original);
  } finally {
    db.exec('PRAGMA query_only=0'); db.exec('ROLLBACK TO enrollment_head_fault'); db.exec('RELEASE enrollment_head_fault');
  }
  expect(readPhase(() => read()!.enrollment)).toEqual(original);
});

it.each(['Person', 'Actor', 'baseline'] as const)('reauthenticates original %s raw identity aliases in a later phase', owner => {
  const db = fixture.db; readPhase(() => expect(read()).not.toBeNull());
  const target = owner === 'Person'
    ? { table: 'world_player_person_links', id: fixture.actor.defenderBindings[8].personLinkSourceId }
    : owner === 'Actor'
      ? { table: 'physical_plate_appearance_actors', id: fixture.actor.source.sourceId }
      : { table: 'world_player_workload_baselines', id: 'native-baseline:' + fixture.actor.defenderBindings[8].playerId };
  db.exec('SAVEPOINT enrollment_alias_fault');
  try {
    const row = db.prepare(`SELECT source_json FROM ${target.table} WHERE source_id=?`).get(target.id)!;
    // JSON.parse sees the original final key, while raw SQLite identity census
    // sees the additional escaped duplicate. No new Person/Actor is admitted.
    const raw = '{"source\\u0049d":"hidden-enrollment-alias",' + String(row.source_json).slice(1);
    db.prepare(`UPDATE ${target.table} SET source_json=? WHERE source_id=?`).run(raw, target.id);
    db.exec('PRAGMA query_only=1');
    expect(() => withSamePaContinuationReadPhase(db, () => read())).toThrow();
  } finally {
    db.exec('PRAGMA query_only=0'); db.exec('ROLLBACK TO enrollment_alias_fault'); db.exec('RELEASE enrollment_alias_fault');
  }
  expect(readPhase(() => read())).not.toBeNull();
});
