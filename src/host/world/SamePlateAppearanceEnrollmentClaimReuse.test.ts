import { afterEach, expect, it, vi } from 'vitest';
import { executionViewFixture } from './SamePlateAppearanceExecutionView.test-support';
import { readSamePlateAppearanceEnrollmentBasis } from './SamePlateAppearanceEnrollmentFromSqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { actorJson } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { paDispatchSchema } from './SamePlateAppearanceDispatchStorage';
import { withSamePaContinuationReadPhase } from './SamePlateAppearanceContinuationFromSqlite';
import { assertReservedPaClaims } from './SamePlateAppearanceProvisionalClaimGuard';

const fixtures: ReturnType<typeof executionViewFixture>[] = [];
afterEach(() => { vi.restoreAllMocks(); fixtures.splice(0).reverse().forEach(f => f.close()); });
const setup = () => { const f = executionViewFixture(); fixtures.push(f); f.acceptPrefix(); return f; };

it('reuses the authenticated claim census for all participant fences in one enrollment proof (actor mocked)', () => {
  const f = setup(), original = f.db.prepare.bind(f.db); let censuses = 0, dispatchCensuses = 0;
  for (const sql of Object.values(paDispatchSchema)) f.db.exec(sql);
  vi.spyOn(f.db, 'prepare').mockImplementation(sql => {
    if (sql === 'SELECT * FROM main.reserved_pa_work_prefixes') censuses++;
    if (sql === 'SELECT * FROM main.pa_dispatch_v1_action_plans') dispatchCensuses++;
    return original(sql);
  });
  const read = () => withSqliteReadTransaction(f.db, () => readSamePlateAppearanceEnrollmentBasis(f.db, f.enrollment.source.sourceId));
  const first = read(); expect(first?.enrollment).toEqual(f.enrollment); expect(censuses).toBe(1);
  expect(dispatchCensuses).toBe(1);
  expect(read()).toEqual(first); expect(censuses).toBe(2); expect(dispatchCensuses).toBe(2);
  expect(f.db.isTransaction).toBe(false); expect(f.db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
});

it('invalidates completed claim evidence after a caught mutation inside the same Native proof (actor mocked)', () => {
  const f = setup();
  expect(() => withSqliteReadTransaction(f.db, () => withSamePaContinuationReadPhase(f.db, () => {
    assertReservedPaClaims(f.db);
    f.db.exec("PRAGMA query_only=0; UPDATE reserved_pa_work_prefixes SET snapshot_hash='changed'; PRAGMA query_only=1");
    expect(() => assertReservedPaClaims(f.db)).toThrow();
    expect(() => assertReservedPaClaims(f.db)).toThrow(/expired/);
  }))).toThrow(/expired/);
  expect(withSqliteReadTransaction(f.db, () => readSamePlateAppearanceEnrollmentBasis(f.db, f.enrollment.source.sourceId))?.enrollment).toEqual(f.enrollment);
});

it('reauthenticates original claim dependencies after a completed enrollment proof (actor mocked)', () => {
  const f = setup(), read = () => withSqliteReadTransaction(f.db, () => readSamePlateAppearanceEnrollmentBasis(f.db, f.enrollment.source.sourceId));
  expect(read()?.enrollment).toEqual(f.enrollment);
  const row = f.db.prepare('SELECT source_json FROM world_player_workload_baselines WHERE player_id=?').get(f.players[1])!;
  const source = JSON.parse(String(row.source_json)); source.sourceVersion = 'changed-between-proofs';
  f.db.prepare('UPDATE world_player_workload_baselines SET source_json=? WHERE player_id=?').run(actorJson(source), f.players[1]);
  expect(read).toThrow(/authority|prerequisite|differ/);
  expect(f.db.isTransaction).toBe(false); expect(f.db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
});
