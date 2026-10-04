import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { battedWorldFieldExecutionFixture } from './BattedWorldFieldExecutionFixtures.test-support';
import { openSqliteBattedWorldFieldExecutionStore, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
const path = () => join(mkdtempSync(join(tmpdir(), 'motion-checkpoint-wal-')), 'state.sqlite');
it.each(['motion_checkpoint_v1', 'retained_motion_checkpoint_v1'] as const)('rolls back %s post-insert mutations without altering prior archives or heads', (kind) => {
  const x = battedWorldFieldExecutionFixture(path());
  try {
    const at = x.baseField.field.motion.world.moment.ball.tick;
    const source: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'initial-checkpoint', action: {
      kind: 'motion_checkpoint_v1', availableAtTick: x.fieldSource.availableAtTick, coverageThroughTick: at + 1000,
      checkpointThroughTick: at + 100, commands: x.fieldSource.commands,
    } };
    x.sources.set(source.sourceId, source); const first = x.executions.accept(source.sourceId);
    const next: AcceptedBattedWorldFieldExecution = { ...source, sourceId: 'next-checkpoint', previousExecutionSourceId: source.sourceId,
      action: kind === 'motion_checkpoint_v1' ? { ...source.action as Extract<typeof source.action, { kind: 'motion_checkpoint_v1' }>, checkpointThroughTick: at + 200 }
        : { kind, checkpointThroughTick: at + 200 } };
    x.sources.set(next.sourceId, next);
    const archive = () => ['batted_world_field_executions', 'batted_world_field_execution_heads', 'batted_world_field_actions', 'batted_world_field_geometries']
      .map(table => x.f.db.prepare(`SELECT * FROM ${table}`).all());
    const before = archive();
    for (const sql of ["UPDATE batted_world_field_executions SET source_hash='changed' WHERE source_id='next-checkpoint';",
      "UPDATE batted_world_field_executions SET snapshot_hash='changed' WHERE source_id='next-checkpoint';",
      "UPDATE batted_world_field_executions SET base_field_source_id='foreign' WHERE source_id='next-checkpoint';",
      'UPDATE batted_world_field_execution_heads SET revision=revision+1;',
      "UPDATE batted_world_field_actions SET source_hash='changed';", "UPDATE batted_world_field_geometries SET source_hash='changed';"]) {
      x.f.db.exec(`CREATE TRIGGER mutate_checkpoint AFTER INSERT ON batted_world_field_executions BEGIN ${sql} END`);
      expect(() => x.executions.accept(next.sourceId)).toThrow();
      expect(archive()).toEqual(before);
      x.f.db.exec('DROP TRIGGER mutate_checkpoint');
    }
    expect(x.executions.read(source.sourceId)).toEqual(first);
    expect(x.executions.accept(next.sourceId).revision).toBe(2);
  } finally { x.f.close(); }
});
it('rejects a checkpoint append if a separate WAL connection commits a competing predecessor during the accepted Source read', () => {
  const x = battedWorldFieldExecutionFixture(path());
  try {
    const at = x.baseField.field.motion.world.moment.ball.tick;
    const action = { kind: 'motion_checkpoint_v1' as const, availableAtTick: x.fieldSource.availableAtTick,
      coverageThroughTick: at + 1000, checkpointThroughTick: at + 100, commands: x.fieldSource.commands };
    const winner = { ...x.source, sourceId: 'winner', action }, stale = { ...winner, sourceId: 'stale' };
    x.sources.set(winner.sourceId, winner);
    const peer = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields, { readAcceptedExecution() {
      x.executions.accept(winner.sourceId); return stale;
    } }));
    expect(() => peer.accept(stale.sourceId)).toThrow(/predecessor/);
    expect(x.f.db.prepare('SELECT source_id FROM batted_world_field_executions').all()).toEqual([{ source_id: winner.sourceId }]);
    expect(x.executions.read(winner.sourceId)?.revision).toBe(1);
  } finally { x.f.close(); }
});
