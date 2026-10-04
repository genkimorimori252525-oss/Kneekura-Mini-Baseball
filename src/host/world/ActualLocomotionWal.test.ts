import { expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { actualLocomotionFixture as fixture } from './ActualLocomotionFixtures.test-support';
import { openSqliteActualLocomotionStore } from './SqliteActualLocomotionStore';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

it('rederives actual self and model on its own transaction connection after BEGIN', () => {
  const x = fixture(), exec = DatabaseSync.prototype.exec; let changed = false;
  const original = x.f.db.prepare('SELECT * FROM world_player_locomotion_models').all();
  const hook = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function(this: import('node:sqlite').DatabaseSync, sql: string) {
    exec.call(this, sql);
    if (sql === 'BEGIN IMMEDIATE' && !changed) { changed = true; exec.call(this, "UPDATE world_player_locomotion_models SET source_hash='wrong'"); }
  });
  try {
    expect(() => x.locomotion.accept(x.locomotionSource.sourceId)).toThrow(); expect(changed).toBe(true);
    expect(x.f.db.prepare('SELECT * FROM world_player_locomotion_models').all()).toEqual(original);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_locomotion_receipts').get()).toEqual({ n: 0 });
  } finally { hook.mockRestore(); x.f.close(); }
});

it('rolls back receipt/head plus every postinsert dependency mutation and preserves the original physical archives', () => {
  const x = fixture();
  try {
    const tables = ['actual_defensive_decisions', 'actual_defensive_decision_heads', 'world_player_locomotion_models', 'world_player_person_links',
      'world_player_fielding_models', 'batted_world_models', 'batted_world_field_actions', 'batted_world_field_executions', 'batted_world_field_execution_heads'];
    const archives = () => tables.map(t => x.f.db.prepare(`SELECT * FROM ${t}`).all()), before = archives();
    for (const [table, sql] of [
      ['actual_locomotion_receipts', "UPDATE actual_defensive_decisions SET snapshot_hash='wrong'"],
      ['actual_locomotion_receipts', "UPDATE world_player_locomotion_models SET snapshot_hash='wrong'"],
      ['actual_locomotion_receipts', "UPDATE world_player_person_links SET person_id='wrong'"],
      ['actual_locomotion_receipts', "UPDATE batted_world_field_executions SET source_hash='wrong'"],
      ['actual_locomotion_receipts', "UPDATE actual_locomotion_receipts SET snapshot_hash='wrong'"],
      ['actual_locomotion_heads', 'UPDATE actual_locomotion_heads SET revision=revision+1'],
    ]) {
      x.f.db.exec(`CREATE TRIGGER motor_mutation AFTER INSERT ON ${table} BEGIN ${sql}; END`);
      expect(() => x.locomotion.accept(x.locomotionSource.sourceId), sql).toThrow();
      expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_locomotion_receipts').get()).toEqual({ n: 0 });
      expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_locomotion_heads').get()).toEqual({ n: 0 });
      expect(archives()).toEqual(before); x.f.db.exec('DROP TRIGGER motor_mutation');
    }
  } finally { x.f.close(); }
});

it('preserves a competing WAL receipt committed before BEGIN and remains retryable', () => {
  const x = fixture(), exec = DatabaseSync.prototype.exec;
  const peer = x.f.track(openSqliteActualLocomotionStore(x.f.path, x.locomotionAuthority)); let changed = false;
  const hook = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function(this: import('node:sqlite').DatabaseSync, sql: string) {
    if (sql === 'BEGIN IMMEDIATE' && !changed) { changed = true; peer.accept(x.locomotionSource.sourceId); }
    return exec.call(this, sql);
  });
  try {
    expect(x.f.db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
    expect(() => x.locomotion.accept(x.locomotionSource.sourceId)).toThrow(/already/); expect(changed).toBe(true);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_locomotion_receipts').get()).toEqual({ n: 1 });
    expect(x.locomotion.accept(x.locomotionSource.sourceId)).toEqual(peer.read(x.locomotionSource.sourceId));
  } finally { hook.mockRestore(); x.f.close(); }
});

it('rejects a physical head advanced by a WAL peer before BEGIN without deleting that evidence', () => {
  const x = fixture(), exec = DatabaseSync.prototype.exec; let changed = false;
  const later = { ...x.source, sourceId: 'wal-later-physical', previousExecutionSourceId: x.executed.source.sourceId,
    action: { kind: 'motion' as const, availableAtTick: x.decision.receipt.observedThrough.tick,
      throughTick: x.decision.receipt.observedThrough.tick + 1, commands: x.fieldSource.commands } };
  x.sources.set(later.sourceId, later);
  const hook = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function(this: import('node:sqlite').DatabaseSync, sql: string) {
    if (sql === 'BEGIN IMMEDIATE' && !changed) { changed = true; x.executions.accept(later.sourceId); }
    return exec.call(this, sql);
  });
  try {
    expect(() => x.locomotion.accept(x.locomotionSource.sourceId)).toThrow(/stale|prefix|changed/); expect(changed).toBe(true);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_locomotion_receipts').get()).toEqual({ n: 0 });
    expect(x.executions.read(later.sourceId)?.source.sourceId).toBe(later.sourceId);
  } finally { hook.mockRestore(); x.f.close(); }
});
