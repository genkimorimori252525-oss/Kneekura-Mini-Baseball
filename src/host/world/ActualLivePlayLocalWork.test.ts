import { expect, it } from 'vitest';
import { battedWorldFieldExecutionFixture } from './BattedWorldFieldExecutionFixtures.test-support';
import { openSqliteActualLivePlayStore } from './SqliteActualLivePlayStore';
import type { AcceptedActualLivePlayScope } from './ActualLivePlayScope';
it('preserves the actual scheduled acquisition source while treating its local queue as uncertified globally', () => {
  const x = battedWorldFieldExecutionFixture(undefined, 'candidate');
  try {
    const plan = { ...x.source, sourceId: 'scope-capture-plan', action: { kind: 'acquisition_plan' as const } };
    x.sources.set(plan.sourceId, plan); const saved = x.executions.accept(plan.sourceId);
    if (saved.execution.kind !== 'acquisition_plan') throw new Error('fixture plan missing');
    const liveWork = saved.execution.liveWork;
    const source: AcceptedActualLivePlayScope = { sourceId: 'planned-scope', sourceVersion: 'v1', capability: 'actual_live_play_scope_v1',
      physicalPitchSourceId: x.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId,
      cut: { kind: 'field_execution', baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: plan.sourceId } };
    const store = x.f.track(openSqliteActualLivePlayStore(x.f.path, { readAcceptedScope: () => source }));
    const scope = store.accept(source.sourceId), result = store.evaluate(source.sourceId);
    expect(scope.physicalLocalHistory).toEqual([{ owner: 'batted_world_field_executions', sourceId: plan.sourceId, revision: saved.revision, work: liveWork }]);
    expect(result.registry.registry.sources.find(s => s.sourceId === liveWork.source.sourceId)?.physical)
      .toEqual(liveWork.source.physical);
    expect(result.registry.watermark.settledThroughTick).toBe(-1);
    expect(result.playEnd).toBe(null);
  } finally { x.f.close(); }
});
