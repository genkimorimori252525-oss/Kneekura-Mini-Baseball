import { expect, it } from 'vitest';
import * as ruleStore from './SqliteActualLiveRuleConsumptionStore';
import { scheduledAcquisitionHistoryFixture } from './ScheduledFieldAcquisitionHistory.test-support';

it('keeps an insufficient-evidence rule result unchanged and refuses unconfirmed or mismatched observers', () => {
  expect(ruleStore).toHaveProperty('openSqliteActualLiveRuleConsumptionStore');
  const x = scheduledAcquisitionHistoryFixture();
  try {
    const planned = x.accept('pending-ack-plan', { kind: 'acquisition_plan' });
    if (planned.execution.kind !== 'acquisition_plan') throw new Error('capture fixture');
    const before = x.accept('pending-ack-before-confirmation', { kind: 'first_base_race' });
    const confirmed = x.accept('pending-ack-confirmed', { kind: 'acquisition_advance', planSourceId: planned.source.sourceId,
      throughElapsedSeconds: planned.execution.plan.fenceElapsedSeconds });
    const race = x.accept('pending-ack-rule-read', { kind: 'first_base_race' });
    if (race.execution.kind !== 'first_base_race') throw new Error('race fixture');
    let source = { sourceId: 'pending-rule-ack', sourceVersion: 'v1', capability: 'actual_first_base_rule_consumption_v1' as const,
      captureExecutionSourceId: planned.source.sourceId, ruleExecutionSourceId: race.source.sourceId };
    const store = x.f.track(ruleStore.openSqliteActualLiveRuleConsumptionStore(x.f.path, { readAcceptedConsumption: () => source }));
    expect(() => store.accept(source.sourceId)).toThrow(/confirmed|capture/);
    source = { ...source, captureExecutionSourceId: confirmed.source.sourceId, ruleExecutionSourceId: before.source.sourceId };
    expect(() => store.accept(source.sourceId)).toThrow(/predecessor|cut|chronology/);
    source = { ...source, ruleExecutionSourceId: confirmed.source.sourceId };
    expect(() => store.accept(source.sourceId)).toThrow(/rule|race/);
    source = { ...source, ruleExecutionSourceId: race.source.sourceId, consumed: true } as typeof source;
    expect(() => store.accept(source.sourceId)).toThrow(/invalid/);
    source = { sourceId: source.sourceId, sourceVersion: source.sourceVersion, capability: source.capability,
      captureExecutionSourceId: confirmed.source.sourceId, ruleExecutionSourceId: race.source.sourceId };
    const saved = store.accept(source.sourceId);
    expect(saved.successor.result).toEqual(race.execution);
    expect(race.execution.groundRule?.correctRuleResult.kind ?? 'not_produced').not.toBe('resolved');
    expect(saved.successor.status).toBe('pending');
    expect(saved.consumption.status).toBe('consumed');
  } finally { x.f.close(); }
});
