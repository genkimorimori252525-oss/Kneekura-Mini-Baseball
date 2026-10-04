import { expect, it } from 'vitest';
import * as queueStore from './SqliteActualLivePlayQueueStore';
import { scheduledAcquisitionHistoryFixture } from './ScheduledFieldAcquisitionHistory.test-support';

it('atomically owns all queue evidence, keeps bounded archives and rejects injected authority', () => {
  expect(queueStore).toHaveProperty('openSqliteActualLivePlayQueueStore');
  const x = scheduledAcquisitionHistoryFixture();
  try {
    const planned = x.accept('queue-plan', { kind: 'acquisition_plan' });
    let source = { sourceId: 'checkpoint', sourceVersion: 'v1', capability: 'actual_live_play_queue_v1' as const,
      physicalPitchSourceId: x.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId,
      cut: { kind: 'field_execution' as const, baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: planned.source.sourceId } };
    const store = x.f.track(queueStore.openSqliteActualLivePlayQueueStore(x.f.path, { readAcceptedCheckpoint: () => source }));
    const legacy = x.f.db.prepare('SELECT * FROM batted_world_field_executions').all();
    const saved = store.accept(source.sourceId);
    expect(saved.queue.events).toEqual([]);
    expect(saved.queue.represented).toHaveLength(1);
    expect(saved.queue.generation).toBe('event_generation_coverage_pending');
    expect(store.accept(source.sourceId)).toEqual(saved);
    expect(x.f.track(queueStore.openSqliteActualLivePlayQueueStore(x.f.path)).read(source.sourceId)).toEqual(saved);
    if (planned.execution.kind !== 'acquisition_plan') throw new Error('capture fixture');
    const confirmed = x.accept('queue-confirmed', { kind: 'acquisition_advance', planSourceId: planned.source.sourceId,
      throughElapsedSeconds: planned.execution.plan.fenceElapsedSeconds });
    expect(store.read(source.sourceId)).toEqual(saved);
    expect(store.accept(source.sourceId)).toEqual(saved);
    const original = source;
    source = { ...source, sourceId: 'stale-checkpoint' };
    expect(() => store.accept(source.sourceId)).toThrow(/stale|current|prefix/);
    source = { ...original, sourceId: 'next-checkpoint', cut: { ...source.cut, executionSourceId: confirmed.source.sourceId } };
    const next = store.accept(source.sourceId);
    expect(next.queue.events).toHaveLength(1); expect(next.queue.successors).toHaveLength(2);
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_executions WHERE source_id=?').get(planned.source.sourceId)).toEqual(legacy[0]);
    source = { ...source, sourceId: 'injected', settledThroughTick: 100 } as typeof source;
    expect(() => store.accept(source.sourceId)).toThrow(/invalid/);
  } finally { x.f.close(); }
});
