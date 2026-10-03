import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { battedWorldFieldExecutionFixture } from './BattedWorldFieldExecutionFixtures.test-support';
import { openSqliteBattedWorldFieldExecutionStore, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

const fixture = () => {
  const x = battedWorldFieldExecutionFixture(join(mkdtempSync(join(tmpdir(), 'whole-play-history-wal-')), 'state.sqlite'));
  const source: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'whole-history', action: { kind: 'whole_play_history' } };
  x.sources.set(source.sourceId, source); return { ...x, source };
};
it.each([
  ['pitch', "UPDATE physical_pitch_progress_actions SET source_hash='changed';"],
  ['Person', "UPDATE world_player_person_links SET person_id='changed';"],
  ['geometry', "UPDATE batted_world_field_geometries SET snapshot_hash='changed';"],
  ['field', "UPDATE batted_world_field_actions SET source_hash='changed';"],
  ['observation', "UPDATE batted_world_field_executions SET snapshot_hash='changed';"],
])('rolls back whole-play observation on late %s mutation without rewriting the original causal history', (_name, mutation) => {
  const x = fixture();
  try {
    const before = x.f.db.prepare('SELECT source_id,source_hash,snapshot_hash FROM physical_pitch_progress_actions').all();
    x.f.db.exec(`CREATE TRIGGER mutate_whole_history AFTER INSERT ON batted_world_field_executions BEGIN ${mutation} END`);
    expect(() => x.executions.accept(x.source.sourceId)).toThrow();
    expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_executions').get()).toEqual({ n: 0 });
    expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_execution_heads').get()).toEqual({ n: 0 });
    expect(x.f.db.prepare('SELECT source_id,source_hash,snapshot_hash FROM physical_pitch_progress_actions').all()).toEqual(before);
    expect(x.fields.read(x.baseField.source.sourceId)).toEqual(x.baseField);
    x.f.db.exec('DROP TRIGGER mutate_whole_history');
    expect(x.executions.accept(x.source.sourceId).execution.kind).toBe('whole_play_history');
  } finally { x.f.close(); }
});

it('does not trust a cached peer field return after the original pitch head changed', () => {
  const x = fixture();
  try {
    const executions = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, { read() {
      x.f.db.exec('UPDATE physical_pitch_progress_heads SET progress_revision=progress_revision+1'); return x.baseField;
    } }, x.authority));
    expect(() => executions.accept(x.source.sourceId)).toThrow();
    expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_executions').get()).toEqual({ n: 0 });
  } finally { x.f.close(); }
});

it('preserves bounded whole history after legitimate recovery and rejects a new stale observation', () => {
  const x = fixture();
  try {
    const first = x.executions.accept(x.source.sourceId);
    const before = x.f.db.prepare('SELECT snapshot_json,snapshot_hash FROM batted_world_field_executions WHERE source_id=?').get(first.source.sourceId);
    const rest = { sourceEventId: 'whole-history-rest', sourceVersion: 'fixture-v1', evidenceId: 'actual-rest',
      careerId: 'career-a', playerId: 'p2', atDay: 11, kind: 'RECOVERY' as const, durationHours: 8, quality: 1, medicalAvailability: 1 };
    x.f.activities.set(rest.sourceEventId, rest); x.f.workload.apply(rest.sourceEventId, 0);
    expect(x.executions.read(first.source.sourceId)).toEqual(first);
    expect(x.executions.accept(first.source.sourceId)).toEqual(first);
    const reopened = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields));
    expect(reopened.read(first.source.sourceId)).toEqual(first);
    expect(x.f.db.prepare('SELECT snapshot_json,snapshot_hash FROM batted_world_field_executions WHERE source_id=?').get(first.source.sourceId)).toEqual(before);
    const after = { ...x.source, sourceId: 'new-whole-after-rest', previousExecutionSourceId: first.source.sourceId };
    x.sources.set(after.sourceId, after);
    expect(() => x.executions.accept(after.sourceId)).toThrow(/workload/);
  } finally { x.f.close(); }
});
