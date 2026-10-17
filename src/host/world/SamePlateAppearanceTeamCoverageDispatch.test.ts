import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DefensivePosition } from '../../core/model/CanonicalWorldSnapshot';
import type { DefensiveIntent } from '../../core/sim/fielding/DefensiveDecision';
import { calculateSelectedTeamCoveragePlan, openSqliteSamePlateAppearanceTeamCoverageDispatch } from './SamePlateAppearanceTeamCoverageDispatch';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { SamePaPhysicalFieldStepSource, SamePaPhysicalOperationProof } from './SamePlateAppearancePhysicalEpisode';

// Mocked owner boundary tests carry NO Native admission credit. TN01 exercises
// the unmocked original SQLite owner and independent readback separately.
const boundary = vi.hoisted(() => ({ proofs: new Map<string, unknown>(), admitted: vi.fn() }));
vi.mock('./SqliteSamePlateAppearancePhysicalEpisodeStore', () => ({ openSqliteSamePlateAppearancePhysicalEpisodeStore: () => ({
  readOperation: (r: { sourceId: string }) => { const value = boundary.proofs.get(r.sourceId); if (!value) throw new Error('missing original'); return value; },
  acceptOperation: boundary.admitted, close: () => {},
}) }));
beforeEach(() => { boundary.proofs.clear(); boundary.admitted.mockReset(); });

const positions: DefensivePosition[] = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
const defenders = positions.map((registeredPosition, i) => ({ playerId: 'original:' + i, registeredPosition }));
const selected = (intents: DefensiveIntent[]) => intents.map((intent, i) => ({ playerId: defenders[i].playerId,
  selected: { intent, localPriority: 1, evidenceAvailableAt: 123, evidenceKinds: ['original-perception-fixture'] } }));
const intents: DefensiveIntent[] = [{ kind: 'ball_handler' }, { kind: 'base_cover', base: 4 }, { kind: 'base_cover', base: 1 },
  { kind: 'base_cover', base: 2 }, { kind: 'base_cover', base: 3 }, { kind: 'relay', target: { x: 5, z: 10 } },
  { kind: 'backup', target: { x: 20, z: 8 } }, { kind: 'deep_coverage', target: { x: 10, z: 40 } }, { kind: 'hold' }];

describe('selected-only team plan calculation (no Native execution credit)', () => {
  it('preserves all nine selected intents and evidence without future-world inputs', () => {
    const selections = selected(intents), plan = calculateSelectedTeamCoveragePlan(defenders, selections);
    expect(plan.assignments).toHaveLength(9);
    for (const d of selections) expect(plan.assignments.find(a => a.playerId === d.playerId)).toMatchObject({
      intent: d.selected.intent, selectedPriority: 1, evidenceAvailableAt: 123, evidenceKinds: d.selected.evidenceKinds });
    expect(plan.totalPriority).toBe(9);
    expect(Object.isFrozen(plan)).toBe(true);
  });
  it('fails closed for conflicting independently selected handlers and bags', () => {
    expect(() => calculateSelectedTeamCoveragePlan(defenders, selected(intents.map((v, i) => i === 1 ? { kind: 'ball_handler' } : v)))).toThrow();
    expect(() => calculateSelectedTeamCoveragePlan(defenders, selected(intents.map((v, i) => i === 1 ? { kind: 'base_cover', base: 1 } : v)))).toThrow();
  });
  it('rejects missing, duplicate and foreign selection identities', () => {
    expect(() => calculateSelectedTeamCoveragePlan(defenders, selected(intents).slice(1))).toThrow();
    expect(() => calculateSelectedTeamCoveragePlan(defenders, selected(intents).map((s, i) => i === 8 ? { ...s, playerId: 'foreign' } : s))).toThrow();
    expect(() => calculateSelectedTeamCoveragePlan(defenders, selected(intents).map((s, i) => i === 8 ? { ...s, playerId: defenders[0].playerId } : s))).toThrow();
  });
});

const requestFixture = () => {
  const ref = <O extends string>(owner: O, sourceId: string) => ({ owner, sourceId, sourceHash: hash(sourceId), snapshotHash: hash('snapshot:' + sourceId) });
  const previousFieldReference = ref('pa_physical_v1_field_steps', 'previous'), fieldRootReference = ref('pa_physical_v1_field_roots', 'root');
  const launchReference = ref('pa_physical_v1_launches', 'launch'), lineage = { playId: 1 };
  const previous = { kind: 'same_pa_physical_field_step_v1', source: { launchReference, fieldRootReference }, evaluationTick: 200, lineage };
  boundary.proofs.set('previous', { record: previous, reference: previousFieldReference, actor: { world: { defenders } } });
  const selections = selected(intents).map((d, i) => {
    const decisionReference = ref('pa_physical_v1_field_steps', 'decision:' + i), observationReference = ref('pa_physical_v1_field_steps', 'observation:' + i);
    const decision = { kind: 'defender_decision_v1', playerId: d.playerId, observationReference,
      target: 'target' in d.selected.intent ? d.selected.intent.target : d.selected.intent.kind === 'hold' ? null : { x: i, z: i },
      availability: { tick: 123 }, calculation: { selected: d.selected, scheduling: { movementStartTick: 150 } } };
    boundary.proofs.set(decisionReference.sourceId, { record: { kind: 'same_pa_physical_field_step_v1', lineage,
      source: { launchReference, fieldRootReference, action: { kind: 'defender_decision_v1', observationReference } }, actionResult: decision } });
    boundary.proofs.set(observationReference.sourceId, { record: { kind: 'same_pa_physical_field_step_v1',
      actionResult: { kind: 'defender_observation_v1', playerId: d.playerId } } });
    return { member: { playerId: d.playerId, bindingHash: hash('binding:' + i), personHash: hash('person:' + i), baselineSourceId: 'baseline:' + i,
      reservedRevision: 0, reservedStateHash: hash('reserved:' + i), projectedStateHash: hash('projected:' + i) }, decisionReference,
      calibrationReference: ref('pa_lifecycle_v1_execution_calibrations', 'calibration:' + i) };
  });
  const source: SamePaPhysicalFieldStepSource = { sourceId: 'group', sourceVersion: 'contract-fixture-v1', capability: 'same_pa_physical_field_step_v1',
    launchReference, previousFieldReference, previousOperationReference: previousFieldReference, fieldRootReference,
    viewReference: ref('pa_lifecycle_v1_execution_views', 'view'), throughTick: 201, action: { kind: 'defender_motion_v1', selections } };
  return { source, readDecision: (i: number) => boundary.proofs.get('decision:' + i) as SamePaPhysicalOperationProof };
};

describe('team dispatch wrapper boundary (mocked owner, no execution credit)', () => {
  it('prepares only original selected references and exposes no execution credit', () => {
    const f = requestFixture(), store = openSqliteSamePlateAppearanceTeamCoverageDispatch('mocked.sqlite');
    const prepared = store.prepare(f.source);
    expect(prepared).toMatchObject({ selectionScope: 'accepted_individual_selected_only', teamPlanAdopted: false, bodiesMoved: false,
      physicalOutsConfirmed: null, officialResult: null });
    expect(prepared.decisions).toHaveLength(9);
    expect(boundary.admitted).not.toHaveBeenCalled();
    expect(() => store.prepare({ ...f.source, targets: [] } as SamePaPhysicalFieldStepSource)).toThrow();
  });
  it('rejects future or other-play decisions before owner admission', () => {
    const f = requestFixture(), store = openSqliteSamePlateAppearanceTeamCoverageDispatch('mocked.sqlite');
    const original = f.readDecision(8), record = original.record;
    if (record.kind !== 'same_pa_physical_field_step_v1' || record.actionResult?.kind !== 'defender_decision_v1') throw new Error('contract fixture decision');
    boundary.proofs.set('decision:8', { ...original, record: { ...record, actionResult: { ...record.actionResult,
      calculation: { ...record.actionResult.calculation, scheduling: { ...record.actionResult.calculation.scheduling, movementStartTick: 201 } } } } });
    expect(() => store.prepare(f.source)).toThrow(/not due/);
    boundary.proofs.set('decision:8', { ...original, record: { ...record, lineage: { playId: 2 } } });
    expect(() => store.prepare(f.source)).toThrow(/lineage/);
    expect(boundary.admitted).not.toHaveBeenCalled();
  });
  it('binds the prepared Source before invoking the original writer', () => {
    const f = requestFixture();
    let published = f.source;
    const store = openSqliteSamePlateAppearanceTeamCoverageDispatch('mocked.sqlite', { readAcceptedOperation: () => published });
    const prepared = store.prepare(f.source);
    published = { ...f.source, throughTick: 202 };
    expect(() => store.accept(f.source.sourceId, prepared)).toThrow(/prepared Source binding/);
    expect(boundary.admitted).not.toHaveBeenCalled();
    const noAuthority = openSqliteSamePlateAppearanceTeamCoverageDispatch('mocked.sqlite');
    expect(() => noAuthority.accept(f.source.sourceId, prepared)).toThrow(/unavailable/);
  });
});
