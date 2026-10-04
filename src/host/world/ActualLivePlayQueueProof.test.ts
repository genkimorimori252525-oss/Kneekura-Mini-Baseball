import { expect, it } from 'vitest';
import * as queue from './ActualLivePlayQueueEvidenceFromSqlite';
import { scheduledAcquisitionHistoryFixture } from './ScheduledFieldAcquisitionHistory.test-support';
import type { AcceptedActualLivePlayScope } from './ActualLivePlayScope';

it('owns capture occurrence, confirmation availability and both still-open successors', () => {
  expect(queue).toHaveProperty('actualLivePlayQueueEvidenceFromSqlite');
  const x = scheduledAcquisitionHistoryFixture();
  try {
    const planned = x.accept('queue-capture-plan', { kind: 'acquisition_plan' });
    if (planned.execution.kind !== 'acquisition_plan') throw new Error('capture fixture');
    const saved = x.accept('queue-capture-confirmed', { kind: 'acquisition_advance', planSourceId: planned.source.sourceId,
      throughElapsedSeconds: planned.execution.plan.fenceElapsedSeconds });
    const scope: AcceptedActualLivePlayScope = { sourceId: 'queue-cut', sourceVersion: 'v1', capability: 'actual_live_play_scope_v1',
      physicalPitchSourceId: x.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId, cut: { kind: 'field_execution', baseFieldSourceId: x.baseField.source.sourceId,
        executionSourceId: saved.source.sourceId } };
    const result = queue.actualLivePlayQueueEvidenceFromSqlite(x.f.db).derive(scope);
    expect(result.coverage).toBe('represented_sources_only');
    expect(result.generation).toBe('event_generation_coverage_pending');
    expect(result.playEnd).toBeNull();
    const receipt = result.events.find(e => e.kind === 'acquisition_confirmed')!;
    expect(receipt.occurredAt.elapsedSeconds).toBe(planned.execution.plan.secureElapsedSeconds);
    expect(receipt.availableAt.elapsedSeconds).toBe(planned.execution.plan.fenceElapsedSeconds);
    expect(receipt.availableAt.elapsedSeconds).toBeGreaterThan(receipt.occurredAt.elapsedSeconds);
    expect(result.successors.map(s => s.kind)).toEqual(['custody', 'rule_evidence']);
    expect(result.successors.every(s => s.status === 'pending' && s.basisEventKey === receipt.eventKey)).toBe(true);
    expect(result.consumptions).toHaveLength(1);
    expect(result.consumptions[0]).toMatchObject({ eventKey: receipt.eventKey, consumerKind: 'physical_execution', status: 'consumed' });
  } finally { x.f.close(); }
});

it('keeps the actual released-ball successor including its post-release response', async () => {
  const { battedWorldFieldThrowFixture } = await import('./BattedWorldFieldExecutionFixtures.test-support');
  const x = battedWorldFieldThrowFixture();
  try {
    if (x.source.action.kind !== 'throw') throw new Error('throw fixture');
    const planSource = { ...x.source, sourceId: 'queue-throw-plan', action: { ...x.source.action, kind: 'throw_plan' as const } };
    x.sources.set(planSource.sourceId, planSource); const plan = x.executions.accept(planSource.sourceId);
    if (plan.execution.kind !== 'throw_plan') throw new Error('throw plan fixture');
    const source = { ...planSource, sourceId: 'queue-release', previousExecutionSourceId: planSource.sourceId,
      action: { kind: 'throw_advance' as const, planSourceId: planSource.sourceId, throughElapsedSeconds: plan.execution.plan.releaseElapsedSeconds } };
    x.sources.set(source.sourceId, source); const saved = x.executions.accept(source.sourceId);
    if (saved.execution.kind !== 'throw_advance') throw new Error('throw advance fixture');
    const result = queue.actualLivePlayQueueEvidenceFromSqlite(x.f.db).derive({ sourceId: 'release-cut', sourceVersion: 'v1',
      capability: 'actual_live_play_scope_v1', physicalPitchSourceId: x.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId,
      cut: { kind: 'field_execution', baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: saved.source.sourceId } });
    expect(result.successors.find(s => s.kind === 'released_ball')?.originalHandoff).toEqual(saved.execution.liveWork.handoff);
    expect(result.events.find(e => e.kind === 'throw_released')?.originalReceipt).toEqual(saved.execution.liveWork.receipts[0]);
    expect(result.successors.every(s => s.status === 'pending')).toBe(true);
    expect(result.playEnd).toBeNull();
  } finally { x.f.close(); }
});
