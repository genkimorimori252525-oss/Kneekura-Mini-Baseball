import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { battedWorldFieldExecutionFixture } from './BattedWorldFieldExecutionFixtures.test-support';
import { openSqliteBattedWorldFieldExecutionStore, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

const fixture = () => {
  const x = battedWorldFieldExecutionFixture(join(mkdtempSync(join(tmpdir(), 'field-rules-wal-')), 'state.sqlite'));
  const source: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'field-rule-observation', action: { kind: 'first_base_race' } };
  x.sources.set(source.sourceId, source);
  return { ...x, source };
};
it.each([
  ['geometry', "UPDATE batted_world_field_geometries SET source_hash='changed';"],
  ['Player', "UPDATE world_player_person_links SET person_id='changed';"],
  ['field prefix', "UPDATE batted_world_field_actions SET snapshot_hash='changed';"],
  ['observation', "UPDATE batted_world_field_executions SET snapshot_hash='changed';"],
])('rolls back a field-rule observation if late %s evidence changes', (_name, mutation) => {
  const x = fixture();
  try {
    x.f.db.exec(`CREATE TRIGGER change_rule_basis AFTER INSERT ON batted_world_field_executions BEGIN ${mutation} END`);
    expect(() => x.executions.accept(x.source.sourceId)).toThrow();
    expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_executions').get()).toEqual({ n: 0 });
    expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_execution_heads').get()).toEqual({ n: 0 });
    expect(x.fields.read(x.baseField.source.sourceId)).toEqual(x.baseField);
    x.f.db.exec('DROP TRIGGER change_rule_basis');
    expect(x.executions.accept(x.source.sourceId).execution.kind).toBe('first_base_race');
  } finally { x.f.close(); }
});

it('keeps a bounded field rule observation after actual continuation without reading the future payload', () => {
  const x = fixture();
  try {
    const first = x.executions.accept(x.source.sourceId), end = x.baseField.field.motion.world.moment.ball.tick;
    const move: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'field-rule-later-motion', previousExecutionSourceId: first.source.sourceId,
      action: { kind: 'motion', availableAtTick: end, throughTick: end + 1000, commands: x.fieldSource.commands } };
    x.sources.set(move.sourceId, move); x.executions.accept(move.sourceId);
    const saved = x.f.db.prepare('SELECT snapshot_json,snapshot_hash FROM batted_world_field_executions WHERE source_id=?').get(first.source.sourceId);
    x.f.db.prepare("UPDATE batted_world_field_executions SET source_json='invalid-future-rule-payload' WHERE source_id=?").run(move.sourceId);
    expect(x.executions.read(first.source.sourceId)).toEqual(first);
    expect(x.executions.accept(first.source.sourceId)).toEqual(first);
    const reopened = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields));
    expect(reopened.read(first.source.sourceId)).toEqual(first);
    expect(x.f.db.prepare('SELECT snapshot_json,snapshot_hash FROM batted_world_field_executions WHERE source_id=?').get(first.source.sourceId)).toEqual(saved);
    x.f.db.prepare('UPDATE batted_world_field_executions SET revision=1.5 WHERE source_id=?').run(move.sourceId);
    expect(() => reopened.read(first.source.sourceId)).toThrow(/metadata/);
  } finally { x.f.close(); }
});

it('rejects caller rule results, future touch/control, foreign geometry or an unregistered Player', () => {
  const x = fixture();
  try {
    for (const property of ['desired_out', 'desired_fair', 'runner_touch', 'defender_control', 'geometrySourceId', 'count', 'bunt']) {
      x.sources.set(x.source.sourceId, { ...x.source, action: { ...x.source.action, [property]: 'caller' } } as AcceptedBattedWorldFieldExecution);
      expect(() => x.executions.accept(x.source.sourceId)).toThrow();
    }
    x.sources.set(x.source.sourceId, { ...x.source, action: { kind: 'base_touch_history', playerId: 'not-an-active-Player', base: 'first' } });
    expect(() => x.executions.accept(x.source.sourceId)).toThrow(/Player/);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_executions').get()).toEqual({ n: 0 });
  } finally { x.f.close(); }
});

it('retains an original rule result after recovery but rejects fresh observations using stale current evidence', () => {
  const x = fixture();
  try {
    const first = x.executions.accept(x.source.sourceId), rest = { sourceEventId: 'field-rule-rest', sourceVersion: 'synthetic-v1', evidenceId: 'actual-rest',
      careerId: 'career-a', playerId: 'p2', atDay: 11, kind: 'RECOVERY' as const, durationHours: 8, quality: 1, medicalAvailability: 1 };
    x.f.activities.set(rest.sourceEventId, rest); x.f.workload.apply(rest.sourceEventId, 0);
    expect(x.executions.read(first.source.sourceId)).toEqual(first);
    const after = { ...x.source, sourceId: 'new-field-rule-after-recovery', previousExecutionSourceId: first.source.sourceId };
    x.sources.set(after.sourceId, after);
    expect(() => x.executions.accept(after.sourceId)).toThrow(/workload/);
  } finally { x.f.close(); }
});
