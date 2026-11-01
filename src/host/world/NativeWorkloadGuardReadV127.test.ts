import { createRequire } from 'node:module';
import { afterEach, expect, it, vi } from 'vitest';
import { assertNoLegacyPitchWorkloadCharge } from './ActualRoleWorkloadChargeGuard';
import { assertNoSamePaWorkReservation, samePaSchema } from './SamePlateAppearanceReservationGuard';
import { withSamePaContinuationReadPhase } from './SamePlateAppearanceContinuationFromSqlite';
import { memoNativeWorkloadGuardV127 } from './NativeWorkloadGuardReadV127';

const cleanup: (() => void)[] = [];
afterEach(() => { vi.restoreAllMocks(); while (cleanup.length) cleanup.pop()!(); });
function fixture() {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:'); cleanup.push(() => db.close());
  db.exec('CREATE TABLE mutation_probe(n INTEGER)'); db.exec('BEGIN'); db.exec('PRAGMA query_only=1');
  const original = db.prepare.bind(db), sqls: string[] = [];
  vi.spyOn(db, 'prepare').mockImplementation(sql => { sqls.push(sql); return original(sql); });
  const count = () => sqls.filter(sql => sql === "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").length;
  return { db, count };
}
const scope = { careerId: 'career', gameId: 'game', playId: 1, playerId: 'player' };

it('shares only completed DB guard proofs inside one Native read phase and reauthenticates the next phase', () => {
  const { db, count } = fixture(); let once = 0;
  withSamePaContinuationReadPhase(db, () => {
    assertNoLegacyPitchWorkloadCharge(db, scope); once = count(); expect(once).toBeGreaterThan(0);
    assertNoLegacyPitchWorkloadCharge(db, scope); expect(count()).toBe(once);
  });
  withSamePaContinuationReadPhase(db, () => assertNoLegacyPitchWorkloadCharge(db, scope));
  expect(count()).toBeGreaterThan(once);
});

it('separates player/play/own-enrollment keys and retains direct q0 behavior', () => {
  const { db, count } = fixture();
  withSamePaContinuationReadPhase(db, () => {
    assertNoLegacyPitchWorkloadCharge(db, scope, 'own-a'); let prior = count();
    for (const [value, own] of [[{ ...scope, playerId: 'other' }, 'own-a'], [{ ...scope, playId: 2 }, 'own-a'], [scope, 'own-b']] as const) {
      assertNoLegacyPitchWorkloadCharge(db, value, own); expect(count()).toBeGreaterThan(prior); prior = count();
    }
  });
  db.exec('PRAGMA query_only=0');
  assertNoLegacyPitchWorkloadCharge(db, scope); const first = count();
  assertNoLegacyPitchWorkloadCharge(db, scope); expect(count()).toBeGreaterThan(first);
});

it('refuses a cached guard after DML and poisons a caught failed read', () => {
  const { db } = fixture(); let caught: unknown;
  expect(() => withSamePaContinuationReadPhase(db, () => {
    assertNoLegacyPitchWorkloadCharge(db, scope);
    db.exec('PRAGMA query_only=0'); db.exec('INSERT INTO mutation_probe VALUES(1)'); db.exec('PRAGMA query_only=1');
    try { assertNoLegacyPitchWorkloadCharge(db, scope); } catch (error) { caught = error; }
  })).toThrow(/phase expired/);
  expect(caught).toBeInstanceOf(Error);
});

it('checks the main-only namespace before a cached reservation guard hit', () => {
  const { db } = fixture(); let caught: unknown;
  expect(() => withSamePaContinuationReadPhase(db, () => {
    assertNoSamePaWorkReservation(db, scope);
    db.exec("ATTACH DATABASE ':memory:' AS foreign_owner");
    try { assertNoSamePaWorkReservation(db, scope); } catch (error) { caught = error; }
  })).toThrow(/phase expired/);
  expect(String(caught)).toMatch(/main-only/);
});

it('reauthenticates moved raw charge mirrors after a completed phase and retains caught-failure poisoning', () => {
  const { db } = fixture();
  db.exec('PRAGMA query_only=0');
  db.exec(`CREATE TABLE official_pitch_workload_sources (
    source_id TEXT PRIMARY KEY, career_id TEXT, player_id TEXT, game_id TEXT, played_play_id INTEGER,
    scoring_application_id TEXT, policy_source_id TEXT, request_json TEXT, source_json TEXT, proof_json TEXT)`);
  db.prepare('INSERT INTO official_pitch_workload_sources VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run('other-source', 'other-career', 'other-player', 'other-game', 9, 'other-score', 'policy', '{}', '{invalid', '{invalid');
  db.exec('PRAGMA query_only=1');
  withSamePaContinuationReadPhase(db, () => {
    assertNoLegacyPitchWorkloadCharge(db, scope); assertNoLegacyPitchWorkloadCharge(db, scope);
  });
  db.exec('PRAGMA query_only=0');
  // Raw identities are not replaced by the unrelated indexed mirrors, even
  // when the same object's escaped duplicate key attempts to hide the claim.
  const proof = '{"pitcher":{"binding":{"careerId":"career","gameId":"game","playerId":"player"},"playedPlayId":1},"pitch\\u0065r":{"binding":{"careerId":"other-career","gameId":"other-game","playerId":"other-player"},"playedPlayId":9}}';
  db.prepare('UPDATE official_pitch_workload_sources SET proof_json=?').run(proof);
  db.exec('PRAGMA query_only=1');
  let chargeError: unknown, retryError: unknown;
  expect(() => withSamePaContinuationReadPhase(db, () => {
    try { assertNoLegacyPitchWorkloadCharge(db, scope); } catch (error) { chargeError = error; }
    try { assertNoSamePaWorkReservation(db, { gameId: 'different', playId: 4 }); } catch (error) { retryError = error; }
  })).toThrow(/phase expired/);
  expect(String(chargeError)).toMatch(/workload.*charge/); expect(String(retryError)).toMatch(/phase expired/);
});

it('keeps a structural extra physical-pitch scope in the outer workload guard key', () => {
  const { db } = fixture();
  db.exec('PRAGMA query_only=0');
  for (const ddl of Object.values(samePaSchema)) db.exec(ddl);
  // Only the reservation metadata is under test. Even a corrupt domain payload
  // must preserve its indexed first-pitch claim; it is never admitted as a PA.
  db.prepare('INSERT INTO same_pa_enrollments VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run('claimed-enrollment', 'another-career', 'another-game', 8, 'another-actor', 'physical-B', '{}', 'invalid', '{}', 'invalid');
  const first = { ...scope, physicalPitchSourceId: 'physical-A' }, second = { ...scope, physicalPitchSourceId: 'physical-B' };
  expect(() => assertNoLegacyPitchWorkloadCharge(db, second)).toThrow(/same-PA reservation/);
  db.exec('PRAGMA query_only=1');
  let caught: unknown;
  expect(() => withSamePaContinuationReadPhase(db, () => {
    assertNoLegacyPitchWorkloadCharge(db, first);
    try { assertNoLegacyPitchWorkloadCharge(db, second); } catch (error) { caught = error; }
  })).toThrow(/phase expired/);
  expect(String(caught)).toMatch(/same-PA reservation/);
});

it('does not revive a completed guard after a caught mutable-phase read and q1 restoration', () => {
  const { db } = fixture(); let mutableError: unknown, retryError: unknown;
  expect(() => withSamePaContinuationReadPhase(db, () => {
    assertNoLegacyPitchWorkloadCharge(db, scope);
    db.exec('PRAGMA query_only=0');
    try { memoNativeWorkloadGuardV127(db, 'mutable-read', () => { throw Error('descendant read failed'); }); }
    catch (error) { mutableError = error; }
    db.exec('PRAGMA query_only=1');
    try { assertNoLegacyPitchWorkloadCharge(db, scope); } catch (error) { retryError = error; }
  })).toThrow(/phase expired/);
  expect(mutableError).toBeInstanceOf(Error); expect(String(retryError)).toMatch(/phase expired/);
});
