import { createRequire } from 'node:module';
import { expect, it, vi } from 'vitest';
import * as ruleStore from './SqliteActualLiveRuleConsumptionStore';
import { scheduledAcquisitionHistoryFixture } from './ScheduledFieldAcquisitionHistory.test-support';

it('rolls back acknowledgement and its successor together after trigger corruption and rejects hidden duplicate claims', () => {
  expect(ruleStore).toHaveProperty('openSqliteActualLiveRuleConsumptionStore');
  const x = scheduledAcquisitionHistoryFixture();
  try {
    const planned = x.accept('ack-wal-plan', { kind: 'acquisition_plan' });
    if (planned.execution.kind !== 'acquisition_plan') throw new Error('fixture');
    const capture = x.accept('ack-wal-capture', { kind: 'acquisition_advance', planSourceId: planned.source.sourceId,
      throughElapsedSeconds: planned.execution.plan.fenceElapsedSeconds });
    const race = x.accept('ack-wal-race', { kind: 'first_base_race' });
    let source = { sourceId: 'ack-wal', sourceVersion: 'v1', capability: 'actual_first_base_rule_consumption_v1' as const,
      captureExecutionSourceId: capture.source.sourceId, ruleExecutionSourceId: race.source.sourceId };
    const store = x.f.track(ruleStore.openSqliteActualLiveRuleConsumptionStore(x.f.path, { readAcceptedConsumption: () => source }));
    const old = x.f.db.prepare('SELECT * FROM batted_world_field_executions').all();
    x.f.db.exec(`CREATE TRIGGER corrupt_ack AFTER INSERT ON actual_live_rule_consumptions BEGIN
      UPDATE batted_world_field_executions SET snapshot_hash='trigger-corruption' WHERE source_id='ack-wal-race'; END;`);
    expect(() => store.accept(source.sourceId)).toThrow();
    expect(x.f.db.prepare('SELECT * FROM actual_live_rule_consumptions').all()).toEqual([]);
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_executions').all()).toEqual(old);
    x.f.db.exec('DROP TRIGGER corrupt_ack'); const saved = store.accept(source.sourceId);
    const row = x.f.db.prepare('SELECT * FROM actual_live_rule_consumptions').get()!;
    x.f.db.prepare('UPDATE actual_live_rule_consumptions SET ownership_key=?').run('hidden-ownership');
    source = { ...source, sourceId: 'ack-wal-duplicate' };
    expect(() => store.accept(source.sourceId)).toThrow(/ownership|consumed/);
    x.f.db.prepare('UPDATE actual_live_rule_consumptions SET ownership_key=?').run(row.ownership_key!);
    expect(store.read('ack-wal')).toEqual(saved);
    x.f.db.prepare('UPDATE actual_live_rule_consumptions SET source_json=?').run(String(row.source_json).replace('"sourceId":"ack-wal"', '"sourceId":"hidden-id","sourceId":"ack-wal"'));
    expect(() => store.read('hidden-id')).toThrow(/ownership/);
  } finally { x.f.close(); }
});

it('rejects a peer WAL replacement of the canonical rule receipt between preflight and admission', () => {
  expect(ruleStore).toHaveProperty('openSqliteActualLiveRuleConsumptionStore');
  const x = scheduledAcquisitionHistoryFixture();
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  try {
    const planned = x.accept('ack-peer-plan', { kind: 'acquisition_plan' });
    if (planned.execution.kind !== 'acquisition_plan') throw new Error('fixture');
    const capture = x.accept('ack-peer-capture', { kind: 'acquisition_advance', planSourceId: planned.source.sourceId,
      throughElapsedSeconds: planned.execution.plan.fenceElapsedSeconds });
    const race = x.accept('ack-peer-race', { kind: 'first_base_race' });
    const source = { sourceId: 'ack-peer', sourceVersion: 'v1', capability: 'actual_first_base_rule_consumption_v1' as const,
      captureExecutionSourceId: capture.source.sourceId, ruleExecutionSourceId: race.source.sourceId };
    const store = x.f.track(ruleStore.openSqliteActualLiveRuleConsumptionStore(x.f.path, { readAcceptedConsumption: () => source }));
    const exec = DatabaseSync.prototype.exec; let changed = false;
    const hook = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function(this: import('node:sqlite').DatabaseSync, sql: string) {
      if (sql === 'BEGIN IMMEDIATE' && !changed) { changed = true; x.f.db.prepare('UPDATE batted_world_field_executions SET snapshot_hash=? WHERE source_id=?').run('peer-rule-corruption', race.source.sourceId); }
      return exec.call(this, sql);
    });
    try { expect(() => store.accept(source.sourceId)).toThrow(); expect(changed).toBe(true); } finally { hook.mockRestore(); }
    expect(x.f.db.prepare('SELECT * FROM actual_live_rule_consumptions').all()).toEqual([]);
  } finally { x.f.close(); }
});
