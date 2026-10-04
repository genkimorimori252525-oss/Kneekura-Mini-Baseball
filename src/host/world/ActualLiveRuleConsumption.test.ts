import { expect, it } from 'vitest';
import * as ruleStore from './SqliteActualLiveRuleConsumptionStore';
import { actualLivePlayQueueConsumersFromSqlite } from './ActualLivePlayQueueConsumersFromSqlite';
import { actualLivePlayQueueEvidenceFromSqlite } from './ActualLivePlayQueueEvidenceFromSqlite';
import { scheduledAcquisitionRaceFixture } from './ScheduledFieldAcquisitionRace.test-support';

it('acknowledges one actual capture rule successor, preserves exact time and leaves its true result successor open', () => {
  expect(ruleStore).toHaveProperty('openSqliteActualLiveRuleConsumptionStore');
  const x = scheduledAcquisitionRaceFixture();
  try {
    const planned = x.accept('ack-plan', { kind: 'acquisition_plan' });
    if (planned.execution.kind !== 'acquisition_plan') throw new Error('capture fixture');
    const confirmed = x.accept('ack-confirmed', { kind: 'acquisition_advance', planSourceId: planned.source.sourceId,
      throughElapsedSeconds: planned.execution.plan.fenceElapsedSeconds });
    const race = x.accept('ack-first-base', { kind: 'first_base_race' });
    if (race.execution.kind !== 'first_base_race') throw new Error('rule fixture');
    const scope = { sourceId: 'ack-cut', sourceVersion: 'v1', capability: 'actual_live_play_scope_v1' as const,
      physicalPitchSourceId: x.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId,
      cut: { kind: 'field_execution' as const, baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: race.source.sourceId } };
    const before = actualLivePlayQueueEvidenceFromSqlite(x.f.db).derive(scope);
    expect(before.successors.find(s => s.kind === 'rule_evidence')?.status).toBe('pending');
    let source = { sourceId: 'rule-ack', sourceVersion: 'v1', capability: 'actual_first_base_rule_consumption_v1' as const,
      captureExecutionSourceId: confirmed.source.sourceId, ruleExecutionSourceId: race.source.sourceId };
    const store = x.f.track(ruleStore.openSqliteActualLiveRuleConsumptionStore(x.f.path, { readAcceptedConsumption: () => source }));
    expect(actualLivePlayQueueConsumersFromSqlite(x.f.db).derive(scope).acceptedConsumptions).toEqual([]);
    const oldRows = x.f.db.prepare('SELECT * FROM batted_world_field_executions').all();
    const saved = store.accept(source.sourceId), receipt = saved.consumption;
    expect(receipt.status).toBe('consumed');
    expect(receipt.successorKey).toBe(before.successors.find(s => s.kind === 'rule_evidence')!.successorKey);
    expect(receipt.occurredAt.elapsedSeconds).toBe(planned.execution.plan.secureElapsedSeconds);
    expect(receipt.availableAt.elapsedSeconds).toBe(planned.execution.plan.fenceElapsedSeconds);
    expect(receipt.availableAt.elapsedSeconds).toBeGreaterThan(receipt.occurredAt.elapsedSeconds);
    expect(saved.successor).toMatchObject({ kind: 'first_base_rule_result', status: 'pending', pendingReason: 'next_rule_consumer_unowned' });
    expect(saved.successor.result).toEqual(race.execution);
    expect(saved.successor.result.groundRule?.correctRuleResult.batterRunnerFirstBase.kind).toBe('out');
    const consumed = actualLivePlayQueueConsumersFromSqlite(x.f.db).derive(scope);
    expect(consumed.acceptedConsumptions).toEqual([saved]);
    expect(consumed.successors.find(s => s.original.kind === 'rule_evidence')?.consumption).toEqual(receipt);
    expect(consumed.successors.find(s => s.original.kind === 'custody')?.consumption).toBeNull();
    expect(consumed.ruleResultSuccessors).toEqual([saved.successor]);
    expect(consumed.playEnd).toBeNull();
    expect(saved).not.toHaveProperty('terminal'); expect(saved).not.toHaveProperty('playEnd');
    const earlier = { ...scope, sourceId: 'before-rule-cut', cut: { ...scope.cut, executionSourceId: confirmed.source.sourceId } };
    expect(actualLivePlayQueueConsumersFromSqlite(x.f.db).derive(earlier).acceptedConsumptions).toEqual([]);
    const ackRow = x.f.db.prepare('SELECT snapshot_json FROM actual_live_rule_consumptions').get()!;
    x.f.db.exec("UPDATE actual_live_rule_consumptions SET snapshot_json=json_set(snapshot_json,'$.successor.result',json('{}'))");
    expect(actualLivePlayQueueConsumersFromSqlite(x.f.db).derive(earlier).acceptedConsumptions).toEqual([]);
    expect(() => store.read(source.sourceId)).toThrow(/archive/);
    x.f.db.prepare('UPDATE actual_live_rule_consumptions SET snapshot_json=?').run(ackRow.snapshot_json!);
    x.f.db.exec("UPDATE actual_live_rule_consumptions SET snapshot_json=json_set(snapshot_json,'$.revision',1.5)");
    expect(() => actualLivePlayQueueConsumersFromSqlite(x.f.db).derive(earlier)).toThrow(/metadata/);
    x.f.db.prepare('UPDATE actual_live_rule_consumptions SET snapshot_json=?').run(ackRow.snapshot_json!);
    expect(store.accept(source.sourceId)).toEqual(saved);
    expect(x.f.track(ruleStore.openSqliteActualLiveRuleConsumptionStore(x.f.path)).read(source.sourceId)).toEqual(saved);
    source = { ...source, sourceId: 'duplicate-ack' };
    expect(() => store.accept(source.sourceId)).toThrow(/consumed|ownership/);
    expect(x.f.db.prepare('SELECT * FROM actual_live_rule_consumptions').all()).toHaveLength(1);
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_executions').all()).toEqual(oldRows);
    const later = x.accept('ack-later-rule-read', { kind: 'first_base_race' });
    expect(store.read('rule-ack')).toEqual(saved);
    source = { ...source, sourceId: 'changed-observer-ack', ruleExecutionSourceId: later.source.sourceId };
    expect(() => store.accept(source.sourceId)).toThrow(/consumed|ownership/);
  } finally { x.f.close(); }
});
