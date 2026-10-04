import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { ownedBattedWorldMotionFixture as fixture } from './OwnedBattedWorldMotionFixtures.test-support';
import { actualDefensiveDecisionFixture } from './ActualDefensiveDecisionFixtures.test-support';
import { actualPlayerKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { openSqliteBattedWorldFieldExecutionStore, battedWorldFieldExecutionEvidenceFromSqlite, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

it('rolls back complete composition/adoption on writer-side dependency and head trigger mutation', () => {
  const x = fixture(join(mkdtempSync(join(tmpdir(), 'owned-motion-wal-')), 'state.sqlite'));
  try {
    const source = x.retain(x.first.source.sourceId, x.at + 200); x.sources.set(source.sourceId, source);
    const tables = ['batted_world_field_actions', 'batted_world_field_executions', 'batted_world_field_execution_heads'];
    const rows = () => tables.map(t => x.f.db.prepare(`SELECT * FROM ${t}`).all()); const before = rows();
    for (const [event, mutation] of [
      ['AFTER INSERT ON batted_world_field_executions', "UPDATE batted_world_field_actions SET source_hash='uncommitted-corruption';"],
      ['AFTER INSERT ON batted_world_field_executions', "UPDATE batted_world_field_executions SET source_hash='uncommitted-self-corruption' WHERE source_id=NEW.source_id;"],
      ['AFTER UPDATE ON batted_world_field_execution_heads', 'UPDATE batted_world_field_execution_heads SET revision=revision+1;'],
    ]) {
      x.f.db.exec(`CREATE TRIGGER owned_motion_mutation ${event} BEGIN ${mutation} END;`);
      expect(() => x.executions.accept(source.sourceId)).toThrow();
      expect(rows()).toEqual(before);
      x.f.db.exec('DROP TRIGGER owned_motion_mutation');
    }
    expect(x.executions.accept(source.sourceId).execution.kind).toBe('owned_motion_v1');
  } finally { x.f.close(); }
});

it('rejects a newly committed known decision between preflight and BEGIN while preserving that peer commit', () => {
  const x = actualDefensiveDecisionFixture(join(mkdtempSync(join(tmpdir(), 'owned-motion-head-race-')), 'state.sqlite'));
  try {
    x.plans.accept(x.planSource.sourceId);
    const at = x.baseField.field.motion.world.moment.ball.tick;
    const bootstrap: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'race-bootstrap', action: { kind: 'motion_checkpoint_v1',
      availableAtTick: x.fieldSource.availableAtTick, checkpointThroughTick: at + 100, coverageThroughTick: at + 1000, commands: x.fieldSource.commands } };
    x.sources.set(bootstrap.sourceId, bootstrap); x.executions.accept(bootstrap.sourceId);
    const observation = { ...x.observationSource, sourceId: 'race-observation', executionSourceId: bootstrap.sourceId,
      previousObservationSourceId: x.observationSource.sourceId };
    x.observationSources.set(observation.sourceId, observation); x.observations.accept(observation.sourceId);
    const decision = { ...x.decisionSource, sourceId: 'peer-new-decision', observationSourceId: observation.sourceId };
    x.decisionSources.set(decision.sourceId, decision);
    const p = { baseField: x.baseField, fields: battedWorldFieldEvidenceFromSqlite(x.f.db).scope(x.baseField),
      executions: battedWorldFieldExecutionEvidenceFromSqlite(x.f.db).scope(x.baseField, bootstrap.sourceId) };
    const selves = x.fieldSource.commands.map(c => actualPlayerKinematicsFromPrefix(c.playerId, p));
    const source: AcceptedBattedWorldFieldExecution = { ...bootstrap, sourceId: 'stale-known-work', previousExecutionSourceId: bootstrap.sourceId,
      action: { kind: 'owned_motion_v1', checkpointThroughTick: at + 200,
        contributions: selves.map(s => ({ kind: 'retained', playerId: s.playerId, command: s.activeCommand })),
        knownWork: selves.map(s => ({ playerId: s.playerId, decisionSourceId: null, motorSourceId: null })) } };
    const writer = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, { read(id) {
      x.decisions.accept(decision.sourceId); return x.fields.read(id);
    } }, { readAcceptedExecution: () => source }));
    expect(() => writer.accept(source.sourceId)).toThrow(/known-work.*stale|known-work.*missing/);
    expect(x.decisions.read(decision.sourceId)?.source).toEqual(decision);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_executions WHERE source_id=?').get(source.sourceId)).toEqual({ n: 0 });
    expect(x.executions.read(bootstrap.sourceId)?.source).toEqual(bootstrap);
  } finally { x.f.close(); }
});
