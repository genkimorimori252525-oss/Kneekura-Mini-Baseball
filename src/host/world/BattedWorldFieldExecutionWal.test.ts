import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { battedWorldFieldExecutionFixture as fixture } from './BattedWorldFieldExecutionFixtures.test-support';
import { openSqliteBattedWorldFieldExecutionStore } from './SqliteBattedWorldFieldExecutionStore';

const path = () => join(mkdtempSync(join(tmpdir(), 'batted-field-execution-wal-')), 'state.sqlite');
it.each([
  ['original Source', "UPDATE batted_contact_responses SET source_hash='changed';"],
  ['Person', "UPDATE world_player_person_links SET person_id='changed';"],
  ['field geometry', "UPDATE batted_world_field_geometries SET snapshot_hash='changed';"],
  ['field root', "UPDATE batted_world_field_actions SET source_hash='changed';"],
  ['own Source', "UPDATE batted_world_field_executions SET source_hash='changed';"],
  ['own mirror', "UPDATE batted_world_field_executions SET base_field_source_id='changed';"],
  ['own snapshot', "UPDATE batted_world_field_executions SET snapshot_hash='changed';"],
  ['own head', 'UPDATE batted_world_field_execution_heads SET revision=revision+1;'],
])('rolls back late %s mutation atomically and retains the original field archive', (name, sql) => {
  const x = fixture(path());
  try {
    const table = name === 'own head' ? 'batted_world_field_execution_heads' : 'batted_world_field_executions';
    x.f.db.exec(`CREATE TRIGGER mutate_field_execution AFTER INSERT ON ${table} BEGIN ${sql} END`);
    expect(() => x.executions.accept(x.source.sourceId)).toThrow();
    expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_executions').get()).toEqual({ n: 0 });
    expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_execution_heads').get()).toEqual({ n: 0 });
    expect(x.fields.read(x.baseField.source.sourceId)).toEqual(x.baseField);
    x.f.db.exec('DROP TRIGGER mutate_field_execution');
    expect(x.executions.accept(x.source.sourceId).revision).toBe(1);
  } finally { x.f.close(); }
});

it('rechecks original field evidence after the peer read instead of trusting a transported snapshot', () => {
  const x = fixture(path());
  try {
    const executions = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, { read() {
      x.f.db.exec("UPDATE batted_world_field_geometries SET source_hash='changed'"); return x.baseField;
    } }, x.authority));
    expect(() => executions.accept(x.source.sourceId)).toThrow();
    expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_executions').get()).toEqual({ n: 0 });
  } finally { x.f.close(); }
});

it('preserves historical field execution after legitimate recovery but rejects a fresh stale append', () => {
  const x = fixture(path());
  try {
    const first = x.executions.accept(x.source.sourceId), rest = { sourceEventId: 'field-execution-rest', sourceVersion: 'fixture-v1', evidenceId: 'actual-rest',
      careerId: 'career-a', playerId: 'p2', atDay: 11, kind: 'RECOVERY' as const, durationHours: 8, quality: 1, medicalAvailability: 1 };
    x.f.activities.set(rest.sourceEventId, rest); x.f.workload.apply(rest.sourceEventId, 0);
    expect(x.executions.read(first.source.sourceId)).toEqual(first);
    expect(x.executions.accept(first.source.sourceId)).toEqual(first);
    const end = first.execution.field.motion.world.moment.ball.tick;
    const next = { ...x.source, sourceId: 'field-after-recovery', previousExecutionSourceId: first.source.sourceId,
      action: { kind: 'motion' as const, availableAtTick: end, throughTick: end + 1000, commands: x.fieldSource.commands } };
    x.sources.set(next.sourceId, next);
    expect(() => x.executions.accept(next.sourceId)).toThrow(/workload/);
  } finally { x.f.close(); }
});

it('finds hidden execution ownership through original Source and rejects both a restart and lower append', () => {
  const x = fixture(path());
  try {
    x.executions.accept(x.source.sourceId);
    x.f.db.exec("UPDATE batted_world_field_executions SET physical_pitch_source_id='foreign',base_field_source_id='foreign',snapshot_json='invalid-hidden-snapshot'; UPDATE batted_world_field_execution_heads SET physical_pitch_source_id='foreign',base_field_source_id='foreign';");
    x.sources.set('restart', { ...x.source, sourceId: 'restart', previousExecutionSourceId: null });
    expect(() => x.executions.accept('restart')).toThrow(/prefix|metadata/);
    const lower = { ...x.fieldSource, sourceId: 'lower-after-hidden', previousFieldSourceId: x.baseField.source.sourceId,
      throughTick: x.baseField.field.motion.world.moment.ball.tick + 2000 };
    x.fieldSources.set(lower.sourceId, lower);
    expect(() => x.fields.accept(lower.sourceId)).toThrow(/owner|execution/);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_actions').get()).toEqual({ n: 1 });
  } finally { x.f.close(); }
});
