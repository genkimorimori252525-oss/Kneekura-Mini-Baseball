import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { scheduledAcquisitionHistoryFixture } from './ScheduledFieldAcquisitionHistory.test-support';
import { openSqliteActualLivePlayQueueStore } from './SqliteActualLivePlayQueueStore';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const assertDiskWal = (db: import('node:sqlite').DatabaseSync, path: string) => {
  expect(db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
  expect(db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')?.file).toBe(path);
};

it('rolls back complete queue evidence after a writer-local mutation and rejects hidden identity claims', () => {
  const directory = mkdtempSync(join(tmpdir(), 'actual-live-queue-wal-')), path = join(directory, 'world.sqlite');
  const x = scheduledAcquisitionHistoryFixture(path); let fixtureClosed = false;
  try {
    assertDiskWal(x.f.db, path);
    const plan = x.accept('queue-wal-plan', { kind: 'acquisition_plan' });
    const source = { sourceId: 'queue-wal', sourceVersion: 'v1', capability: 'actual_live_play_queue_v1' as const,
      physicalPitchSourceId: x.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId,
      cut: { kind: 'field_execution' as const, baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: plan.source.sourceId } };
    const store = x.f.track(openSqliteActualLivePlayQueueStore(x.f.path, { readAcceptedCheckpoint: () => source }));
    const heads = x.f.db.prepare('SELECT * FROM batted_world_field_execution_heads').all();
    const executions = x.f.db.prepare('SELECT * FROM batted_world_field_executions').all();
    x.f.db.exec(`CREATE TRIGGER corrupt_queue AFTER INSERT ON actual_live_play_queue_checkpoints BEGIN
      UPDATE batted_world_field_execution_heads SET revision=revision+1; END;`);
    expect(() => store.accept(source.sourceId)).toThrow();
    expect(x.f.db.prepare('SELECT * FROM actual_live_play_queue_checkpoints').all()).toEqual([]);
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_execution_heads').all()).toEqual(heads);
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_executions').all()).toEqual(executions);
    x.f.db.exec('DROP TRIGGER corrupt_queue'); const saved = store.accept(source.sourceId);
    const original = x.f.db.prepare('SELECT source_json FROM actual_live_play_queue_checkpoints').get()!.source_json as string;
    x.f.db.prepare('UPDATE actual_live_play_queue_checkpoints SET source_json=?').run(original.replace('"sourceId":"queue-wal"', '"sourceId":"hidden","sourceId":"queue-wal"'));
    expect(() => store.read('hidden')).toThrow(/ownership/); expect(() => store.read(source.sourceId)).toThrow(/archive/);
    x.f.db.prepare('UPDATE actual_live_play_queue_checkpoints SET source_json=?').run(original);
    expect(store.read(source.sourceId)).toEqual(saved);
    const rows = x.f.db.prepare('SELECT * FROM actual_live_play_queue_checkpoints').all();
    // Close every original connection before inspecting disk or reopening the owner.
    x.f.close(); fixtureClosed = true;
    const disk = new DatabaseSync(path, { readOnly: true });
    try {
      assertDiskWal(disk, path);
      expect(disk.prepare('SELECT * FROM actual_live_play_queue_checkpoints').all()).toEqual(rows);
      expect(disk.prepare('SELECT * FROM batted_world_field_execution_heads').all()).toEqual(heads);
      expect(disk.prepare('SELECT * FROM batted_world_field_executions').all()).toEqual(executions);
    } finally { disk.close(); }
    const reopened = openSqliteActualLivePlayQueueStore(path);
    try { expect(reopened.read(source.sourceId)).toEqual(saved); } finally { reopened.close(); }
  } finally {
    if (!fixtureClosed) x.f.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

it('rechecks the actual writer connection after a peer WAL mutation following preflight', () => {
  const directory = mkdtempSync(join(tmpdir(), 'actual-live-queue-peer-wal-')), path = join(directory, 'world.sqlite');
  const x = scheduledAcquisitionHistoryFixture(path); let fixtureClosed = false;
  try {
    assertDiskWal(x.f.db, path);
    const plan = x.accept('queue-peer-plan', { kind: 'acquisition_plan' });
    const source = { sourceId: 'queue-peer', sourceVersion: 'v1', capability: 'actual_live_play_queue_v1' as const,
      physicalPitchSourceId: x.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId,
      cut: { kind: 'field_execution' as const, baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: plan.source.sourceId } };
    const store = x.f.track(openSqliteActualLivePlayQueueStore(x.f.path, { readAcceptedCheckpoint: () => source }));
    const heads = x.f.db.prepare('SELECT * FROM batted_world_field_execution_heads').all();
    const executions = x.f.db.prepare('SELECT * FROM batted_world_field_executions').all();
    const exec = DatabaseSync.prototype.exec; let changed = false;
    const hook = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function(this: import('node:sqlite').DatabaseSync, sql: string) {
      if (sql === 'BEGIN IMMEDIATE' && !changed) {
        // This is the production writer; the fixture DB is a distinct committed peer.
        expect(this).not.toBe(x.f.db); assertDiskWal(this, path);
        changed = true; x.f.db.exec("UPDATE batted_world_field_executions SET snapshot_hash='peer-corruption'");
      }
      return exec.call(this, sql);
    });
    try { expect(() => store.accept(source.sourceId)).toThrow(); expect(changed).toBe(true); } finally { hook.mockRestore(); }
    expect(x.f.db.prepare('SELECT * FROM actual_live_play_queue_checkpoints').all()).toEqual([]);
    expect(x.f.db.prepare('SELECT snapshot_hash FROM batted_world_field_executions').get()!.snapshot_hash).toBe('peer-corruption');
    const committed = executions.map(row => ({ ...row, snapshot_hash: 'peer-corruption' }));
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_executions').all()).toEqual(committed);
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_execution_heads').all()).toEqual(heads);
    x.f.close(); fixtureClosed = true;
    const disk = new DatabaseSync(path, { readOnly: true });
    try {
      assertDiskWal(disk, path);
      expect(disk.prepare('SELECT * FROM actual_live_play_queue_checkpoints').all()).toEqual([]);
      expect(disk.prepare('SELECT * FROM batted_world_field_executions').all()).toEqual(committed);
      expect(disk.prepare('SELECT * FROM batted_world_field_execution_heads').all()).toEqual(heads);
    } finally { disk.close(); }
  } finally {
    if (!fixtureClosed) x.f.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
