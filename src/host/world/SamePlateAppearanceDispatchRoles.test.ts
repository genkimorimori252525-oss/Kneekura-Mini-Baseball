import { afterAll, expect, test, vi } from 'vitest';
import { enrollmentFixture } from './SamePlateAppearanceEnrollment.test-support';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { openSqliteSamePlateAppearanceEnrollmentStore } from './SqliteSamePlateAppearanceEnrollmentStore';
import { openSqliteSamePlateAppearanceExecutionStore } from './SqliteSamePlateAppearanceExecutionStore';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import type { SamePaExecutionView } from './SamePlateAppearanceExecutionView';

const modules = import.meta.glob('./SamePlateAppearanceDispatchRoles.ts');
const implementation = async () => {
  const load = modules['./SamePlateAppearanceDispatchRoles.ts'];
  expect(load, 'dispatch role implementation missing').toBeTypeOf('function');
  return await load() as {
    deriveSamePaDispatchRoles(actor: unknown, view: unknown): readonly { role: string; member: any; routes: readonly string[] }[];
    samePaDispatchPrerequisites(actor: unknown, view: unknown, participantInputs: unknown): readonly { playerId: string; route: string; reason: string }[];
  };
};
const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
const battingRoutes = ['batter_observation', 'batter_decision', 'batter_motor', 'batter_swing'];
const fieldRoutes = ['defender_observation', 'defender_decision', 'defender_locomotion'];
const disposers: (() => void)[] = [];
afterAll(() => { disposers.splice(0).reverse().forEach(close => close()); vi.restoreAllMocks(); });

/** Isolated real Native enrollment/view owners with the existing mocked actor
 * seam. Position names only are added; no numerical response is declared. */
let prepared: ReturnType<typeof prepareFixture> | undefined;
const fixture = () => prepared ??= prepareFixture();
const prepareFixture = () => {
  const f = enrollmentFixture(); disposers.push(f.close);
  Object.assign(f.actor.match, { balls: 0, strikes: 0 }); Object.assign(f.actor.world, { tick: 100 });
  f.actor.world.defenders.forEach((d, i) => Object.assign(d, { registeredPosition: positions[i] })); f.persistActor();
  const enrollmentSource = { ...f.source, actorReference: reference('physical_plate_appearance_actors', f.actor) };
  const enrollmentOwner = openSqliteSamePlateAppearanceEnrollmentStore(f.path, { readAcceptedEnrollment: () => enrollmentSource });
  disposers.push(enrollmentOwner.close);
  const enrollment = enrollmentOwner.accept(enrollmentSource.sourceId);
  if (enrollment.kind !== 'reserved') throw new Error('fixture enrollment missing');
  const prefixSource = { sourceId: 'prefix', sourceVersion: 'fixture-v1', capability: 'reserved_same_pa_empty_prefix_v1', enrollmentReference: reference('same_pa_enrollments', enrollment) };
  const totals = new Map<string, unknown>(), views = new Map<string, unknown>();
  const owner = openSqliteSamePlateAppearanceExecutionStore(f.path, { readAcceptedPrefix: () => prefixSource,
    readAcceptedTotal: id => totals.get(id) ?? null, readAcceptedView: id => views.get(id) ?? null }); disposers.push(owner.close);
  const prefix = owner.acceptPrefix('prefix'); if (prefix.kind !== 'empty_prefix') throw new Error('fixture prefix missing');
  const accepted = enrollment.participants.map(p => {
    const source = { sourceId: 'total-' + p.binding.playerId, sourceVersion: 'fixture-v1', capability: 'reserved_same_pa_cumulative_total_v1',
      enrollmentReference: prefixSource.enrollmentReference, prefixReference: reference('reserved_pa_work_prefixes', prefix),
      participantReference: { playerId: p.binding.playerId, bindingHash: hash(p.binding), personHash: p.personHash,
        baselineSourceId: p.baselineSourceId, revision: p.state.revision, stateHash: hash(p.state) }, effortUnits: 0,
      provenance: { assessmentSourceId: 'assessment-' + p.binding.playerId, assessmentVersion: 'fixture-only-zero-total-v1',
        calibrationSourceId: 'explicit-empty-fixture', calibrationVersion: 'fixture-only-zero-total-v1' } };
    totals.set(source.sourceId, source); const value = owner.acceptTotal(source.sourceId);
    if (value.kind !== 'cumulative_total') throw new Error('fixture total missing'); return value;
  });
  const viewSource = { sourceId: 'view', sourceVersion: 'fixture-v1', capability: 'reserved_same_pa_cumulative_view_v1',
    enrollmentReference: prefixSource.enrollmentReference, prefixReference: reference('reserved_pa_work_prefixes', prefix),
    participantTotalReferences: accepted.map(value => ({ playerId: value.source.participantReference.playerId,
      assessmentReference: reference('reserved_pa_total_assessments', value) })) };
  views.set('view', viewSource); const view = owner.acceptView('view');
  if (view.kind !== 'basis_prepared') throw new Error('fixture view missing');
  return { ...f, view };
};
const calibrationRef = (id: string) => ({ owner: 'pa_dispatch_v1_execution_calibrations', sourceId: id, sourceHash: hash(id), snapshotHash: hash('result:' + id) });

test('DR01 the original actor derives ten immutable members and exactly 32 code-owned routes', async () => {
  const api = await implementation(), f = fixture(), roles = api.deriveSamePaDispatchRoles(f.actor, f.view);
  expect(roles.map(r => r.role)).toEqual(['batter', ...positions]); expect(roles.map(r => r.member.playerId)).toEqual(f.players);
  expect(roles[0].routes).toEqual(battingRoutes); expect(roles[1].routes).toEqual(['pitch_delivery', ...fieldRoutes]);
  expect(roles.slice(2).every(r => JSON.stringify(r.routes) === JSON.stringify(fieldRoutes))).toBe(true);
  expect(roles.flatMap(r => r.routes)).toHaveLength(32);
  for (const role of roles) {
    const original = f.view.lineage.participantReferences.find(p => p.playerId === role.member.playerId)!;
    const projected = f.view.participants.find(p => p.playerId === role.member.playerId)!;
    expect(role.member).toEqual({ playerId: original.playerId, bindingHash: original.bindingHash, personHash: original.personHash,
      baselineSourceId: original.baselineSourceId, reservedRevision: original.revision, reservedStateHash: original.stateHash,
      projectedStateHash: projected.projectedStateHash });
    expect(Object.isFrozen(role.member)).toBe(true); expect(Object.isFrozen(role.routes)).toBe(true);
  }
  expect(Object.isFrozen(roles)).toBe(true);
});

test('DR02 missing duplicate renamed and foreign original roles reject without a caller override', async () => {
  const api = await implementation(), f = fixture();
  for (const alter of [
    (actor: any) => actor.world.defenders.pop(),
    (actor: any) => actor.world.defenders[0].registeredPosition = 'C',
    (actor: any) => actor.world.defenders[0].registeredPosition = 'pitcher',
    (actor: any) => actor.world.defenders[0].playerId = 'foreign',
    (actor: any) => actor.defenderBindings[0].personId = actor.binding.personId,
  ]) {
    const actor = structuredClone(f.actor); alter(actor);
    expect(() => api.deriveSamePaDispatchRoles(actor, f.view)).toThrow();
  }
});

test('DR03 foreign binding Person reserved state and projected state references reject', async () => {
  const api = await implementation(), f = fixture();
  for (const alter of [
    (view: SamePaExecutionView) => (view.lineage.participantReferences[0] as any).bindingHash = hash('foreign'),
    (view: SamePaExecutionView) => (view.lineage.participantReferences[0] as any).personHash = hash('foreign'),
    (view: SamePaExecutionView) => (view.lineage.participantReferences[0] as any).revision += 1,
    (view: SamePaExecutionView) => (view.participants[0] as any).projectedStateHash = hash('foreign'),
    (view: SamePaExecutionView) => (view.participants as any).pop(),
  ]) {
    const view = structuredClone(f.view); alter(view);
    expect(() => api.deriveSamePaDispatchRoles(f.actor, view)).toThrow();
  }
});

test('DR04 missing inputs enumerate exact player routes and implemented adapters cannot be caller-claimed', async () => {
  const api = await implementation(), f = fixture(), roles = api.deriveSamePaDispatchRoles(f.actor, f.view);
  const participantInputs = roles.map(r => ({ member: r.member, calibrationReferences: [] }));
  const missing = api.samePaDispatchPrerequisites(f.actor, f.view, participantInputs);
  expect(missing.filter(p => p.reason === 'missing_calibration_reference')).toEqual(roles.flatMap(r => r.routes.map(route =>
    ({ playerId: r.member.playerId, route, reason: 'missing_calibration_reference' }))));
  expect(missing.filter(p => p.reason === 'unsupported_core_adapter')).toHaveLength(32);
  const supplied = roles.map(r => ({ member: r.member, calibrationReferences: r.routes.map(route => ({ route,
    calibrationReference: calibrationRef(r.member.playerId + ':' + route) })) }));
  expect(api.samePaDispatchPrerequisites(f.actor, f.view, supplied)).toEqual(roles.flatMap(r => r.routes.map(route =>
    ({ playerId: r.member.playerId, route, reason: 'unsupported_core_adapter' }))));
  expect(() => api.samePaDispatchPrerequisites(f.actor, f.view, supplied.map(r => ({ ...r, supported: true })))).toThrow();
});

test('DR05 incomplete foreign duplicate unordered and caller-skipped participant inputs reject', async () => {
  const api = await implementation(), f = fixture(), roles = api.deriveSamePaDispatchRoles(f.actor, f.view);
  const inputs = roles.map(r => ({ member: r.member, calibrationReferences: [] as unknown[] }));
  for (const alter of [
    (value: any[]) => value.pop(),
    (value: any[]) => value[1] = value[0],
    (value: any[]) => value.reverse(),
    (value: any[]) => value[0].member.playerId = 'former-batter',
    (value: any[]) => value[0].skip = true,
    (value: any[]) => value[0].calibrationReferences = [{ route: 'defender_locomotion', calibrationReference: calibrationRef('foreign-role') }],
    (value: any[]) => value[0].calibrationReferences = ['batter_motor', 'batter_motor'].map(route => ({ route, calibrationReference: calibrationRef(route) })),
  ]) {
    const changed = structuredClone(inputs); alter(changed);
    expect(() => api.samePaDispatchPrerequisites(f.actor, f.view, changed)).toThrow();
  }
});
