import { expect, it } from 'vitest';
import { ownedScheduledMotionFixture } from './OwnedScheduledMotionFixtures.test-support';

it('keeps exact execution, original operation deadline, command coverage and custody/rule successors distinct', () => {
  const x = ownedScheduledMotionFixture(undefined, 1000);
  try {
    const planned = x.plan('live-owned-plan');
    if (planned.execution.kind !== 'owned_acquisition_plan_v1') throw new Error('plan');
    const plan = planned.execution.plan;
    let current = x.step('live-owned-init', planned.source.sourceId,
      { kind: 'operation', planSourceId: planned.source.sourceId, throughElapsedSeconds: plan.contactMoment.elapsedSeconds });
    if (current.execution.kind !== 'owned_motion_v2') throw new Error('init');
    let live = current.execution.liveWork;
    expect(live.queue).toBeNull(); expect(live.sourceCoverage).toBe('explicit_known_sources_only');
    expect(live.operation?.source).not.toHaveProperty('completion');
    expect(live.operation?.originalDueAt.elapsedSeconds).toBe(plan.secureElapsedSeconds);
    expect(live.operation?.actualExecutedThrough.elapsedSeconds).toBe(plan.contactMoment.elapsedSeconds);
    expect(live.operation?.commandCoverageThroughTick).toBe(x.baseField.source.throughTick);
    expect(live.operation?.receipts).toEqual([]); expect(live.operation?.handoffs).toEqual([]);
    expect(live.contributors.every(c => c.motorAdoption === null && c.unexecutedTail?.status === 'not_executed')).toBe(true);
    current = x.step('live-owned-secure', current.source.sourceId,
      { kind: 'operation', planSourceId: planned.source.sourceId, throughElapsedSeconds: plan.fenceElapsedSeconds });
    if (current.execution.kind !== 'owned_motion_v2') throw new Error('secure');
    expect(current.execution.liveWork.operation?.source).not.toHaveProperty('completion');
    current = x.step('live-owned-fence', current.source.sourceId,
      { kind: 'operation', planSourceId: planned.source.sourceId, throughElapsedSeconds: plan.fenceElapsedSeconds });
    if (current.execution.kind !== 'owned_motion_v2') throw new Error('fence');
    live = current.execution.liveWork;
    expect(live.operation?.receipts).toHaveLength(1);
    expect(live.operation?.receipts[0]).toMatchObject({ kind: 'acquisition_confirmed', status: 'consumed' });
    expect(live.operation?.source.completion).toBeDefined();
    expect(live.operation?.handoffs.map(h => [h.kind, h.status])).toEqual([['custody', 'pending'], ['rule_evidence', 'pending']]);
    for (const handoff of live.operation!.handoffs) expect(handoff.source).not.toHaveProperty('completion');
    expect(live.queue).toBeNull();
    expect(live).not.toHaveProperty('playEnd'); expect(live).not.toHaveProperty('settledThroughTick');
  } finally { x.f.close(); }
});
