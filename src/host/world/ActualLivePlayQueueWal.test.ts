import { createRequire } from 'node:module';
import { expect, it, vi } from 'vitest';
import { scheduledAcquisitionHistoryFixture } from './ScheduledFieldAcquisitionHistory.test-support';
import { openSqliteActualLivePlayQueueStore } from './SqliteActualLivePlayQueueStore';

it('rolls back complete queue evidence after a writer-local mutation and rejects hidden identity claims', () => {
  const x = scheduledAcquisitionHistoryFixture();
  try {
    const plan = x.accept('queue-wal-plan', { kind: 'acquisition_plan' });
    const source = { sourceId: 'queue-wal', sourceVersion: 'v1', capability: 'actual_live_play_queue_v1' as const,
      physicalPitchSourceId: x.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId,
      cut: { kind: 'field_execution' as const, baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: plan.source.sourceId } };
    const store = x.f.track(openSqliteActualLivePlayQueueStore(x.f.path, { readAcceptedCheckpoint: () => source }));
    const heads = x.f.db.prepare('SELECT * FROM batted_world_field_execution_heads').all();
    x.f.db.exec(`CREATE TRIGGER corrupt_queue AFTER INSERT ON actual_live_play_queue_checkpoints BEGIN
      UPDATE batted_world_field_execution_heads SET revision=revision+1; END;`);
    expect(() => store.accept(source.sourceId)).toThrow();
    expect(x.f.db.prepare('SELECT * FROM actual_live_play_queue_checkpoints').all()).toEqual([]);
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_execution_heads').all()).toEqual(heads);
    x.f.db.exec('DROP TRIGGER corrupt_queue'); const saved = store.accept(source.sourceId);
    const original = x.f.db.prepare('SELECT source_json FROM actual_live_play_queue_checkpoints').get()!.source_json as string;
    x.f.db.prepare('UPDATE actual_live_play_queue_checkpoints SET source_json=?').run(original.replace('"sourceId":"queue-wal"', '"sourceId":"hidden","sourceId":"queue-wal"'));
    expect(() => store.read('hidden')).toThrow(/ownership/); expect(() => store.read(source.sourceId)).toThrow(/archive/);
    x.f.db.prepare('UPDATE actual_live_play_queue_checkpoints SET source_json=?').run(original);
    expect(store.read(source.sourceId)).toEqual(saved);
  } finally { x.f.close(); }
});

it('rechecks the actual writer connection after a peer WAL mutation following preflight', () => {
  const x = scheduledAcquisitionHistoryFixture();
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  try {
    const plan = x.accept('queue-peer-plan', { kind: 'acquisition_plan' });
    const source = { sourceId: 'queue-peer', sourceVersion: 'v1', capability: 'actual_live_play_queue_v1' as const,
      physicalPitchSourceId: x.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId,
      cut: { kind: 'field_execution' as const, baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: plan.source.sourceId } };
    const store = x.f.track(openSqliteActualLivePlayQueueStore(x.f.path, { readAcceptedCheckpoint: () => source }));
    const exec = DatabaseSync.prototype.exec; let changed = false;
    const hook = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function(this: import('node:sqlite').DatabaseSync, sql: string) {
      if (sql === 'BEGIN IMMEDIATE' && !changed) { changed = true; x.f.db.exec("UPDATE batted_world_field_executions SET snapshot_hash='peer-corruption'"); }
      return exec.call(this, sql);
    });
    try { expect(() => store.accept(source.sourceId)).toThrow(); expect(changed).toBe(true); } finally { hook.mockRestore(); }
    expect(x.f.db.prepare('SELECT * FROM actual_live_play_queue_checkpoints').all()).toEqual([]);
    expect(x.f.db.prepare('SELECT snapshot_hash FROM batted_world_field_executions').get()!.snapshot_hash).toBe('peer-corruption');
  } finally { x.f.close(); }
});
