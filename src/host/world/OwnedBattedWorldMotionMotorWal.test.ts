import { expect, it } from 'vitest';
import { actualLocomotionFixture } from './ActualLocomotionFixtures.test-support';
import { actualPlayerKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

it('rolls back real motor adoption when writer INSERT or head CAS changes a pinned motor or decision', () => {
  const x = actualLocomotionFixture({ hold: true });
  try {
    if (x.executed.execution.kind !== 'acquisition_advance' || x.executed.execution.progress.kind !== 'secured') {
      throw new Error('fixture must supply the actual resolved capture fence');
    }
    const motor = x.locomotion.accept(x.locomotionSource.sourceId);
    const prefix = { baseField: x.baseField, fields: battedWorldFieldEvidenceFromSqlite(x.f.db).scope(x.baseField),
      executions: battedWorldFieldExecutionEvidenceFromSqlite(x.f.db).scope(x.baseField, x.executed.source.sourceId) };
    const selves = x.fieldSource.commands.map(c => actualPlayerKinematicsFromPrefix(c.playerId, prefix));
    expect(selves).toHaveLength(10);
    expect(selves.every(s => s.roles.length === 5)).toBe(true);
    const source: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'owned-motor-wal-adoption',
      previousExecutionSourceId: x.executed.source.sourceId,
      action: { kind: 'owned_motion_v1', checkpointThroughTick: motor.receipt.coverageEndTick,
        contributions: selves.map(s => s.playerId === 'p2' ? { kind: 'motor', playerId: s.playerId, motorSourceId: motor.source.sourceId }
          : { kind: 'retained', playerId: s.playerId, command: s.activeCommand }),
        knownWork: selves.map(s => ({ playerId: s.playerId, decisionSourceId: s.playerId === 'p2' ? x.decision.source.sourceId : null,
          motorSourceId: s.playerId === 'p2' ? motor.source.sourceId : null })) } };
    x.sources.set(source.sourceId, source);

    const dependencyTables = ['actual_locomotion_receipts', 'actual_locomotion_heads', 'actual_defensive_decisions',
      'actual_defensive_decision_heads', 'actual_field_observations', 'actual_field_observation_heads',
      'world_player_locomotion_models', 'world_player_decision_models', 'batted_world_field_actions'];
    const physicalTables = ['batted_world_field_executions', 'batted_world_field_execution_heads'];
    const rows = (tables: readonly string[]) => tables.map(table => x.f.db.prepare(`SELECT * FROM ${table} ORDER BY source_id`).all());
    const dependenciesBefore = rows(dependencyTables), physicalBefore = rows(physicalTables);
    const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
    const mutations = [
      { name: 'self-cycle', sql: `UPDATE actual_locomotion_receipts SET execution_source_id=NEW.source_id,
          source_json=json_set(source_json,'$.executionSourceId',NEW.source_id),
          snapshot_json=json_set(snapshot_json,'$.source.executionSourceId',NEW.source_id,
            '$.history[0].executionSourceId',NEW.source_id,'$.receipt.self.cut.executionSourceId',NEW.source_id)
          WHERE source_id=${quote(motor.source.sourceId)};`,
        expected: /causal preflight: motor self cut differs from exact predecessor/ },
      { name: 'motor-snapshot', sql: `UPDATE actual_locomotion_receipts SET snapshot_hash='uncommitted-motor-corruption'
          WHERE source_id=${quote(motor.source.sourceId)};`, expected: /corrupt original actual locomotion archive/ },
      { name: 'decision-snapshot', sql: `UPDATE actual_defensive_decisions SET snapshot_hash='uncommitted-decision-corruption'
          WHERE source_id=${quote(x.decision.source.sourceId)};`, expected: /corrupt actual defensive decision snapshot/ },
    ];
    for (const event of ['AFTER INSERT ON batted_world_field_executions', 'AFTER UPDATE ON batted_world_field_execution_heads']) {
      for (const mutation of mutations) {
        x.f.db.exec(`CREATE TRIGGER owned_motor_wal_mutation ${event} WHEN NEW.source_id=${quote(source.sourceId)} BEGIN ${mutation.sql} END;`);
        let failure: unknown;
        try { x.executions.accept(source.sourceId); } catch (error) { failure = error; }
        finally { x.f.db.exec('DROP TRIGGER owned_motor_wal_mutation'); }
        const label = `${event}: ${mutation.name}`;
        expect(failure, label).toBeInstanceOf(Error);
        expect(failure, label).not.toBeInstanceOf(RangeError);
        expect((failure as Error).message, label).toMatch(mutation.expected);
        expect(rows(dependencyTables), label).toEqual(dependenciesBefore);
        expect(rows(physicalTables), label).toEqual(physicalBefore);
        expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_executions WHERE source_id=?').get(source.sourceId), label).toEqual({ n: 0 });
      }
    }

    const saved = x.executions.accept(source.sourceId);
    if (saved.execution.kind !== 'owned_motion_v1') throw new Error('missing physical adoption');
    expect(saved.execution.composition.mode).toBe('rebase');
    expect(saved.execution.adoption.adoptedAt).toEqual(motor.receipt.startAt);
    expect(saved.execution.adoption.executedThrough.elapsedSeconds).toBeGreaterThan(motor.receipt.startAt.elapsedSeconds);
    expect(saved.execution.adoption.contributors.filter(c => c.motorAdoptionEventId !== null)).toHaveLength(1);
    expect(saved.execution.adoption.contributors.find(c => c.playerId === 'p2')?.motorSourceId).toBe(motor.source.sourceId);
    expect(rows(dependencyTables)).toEqual(dependenciesBefore);
    expect(x.f.db.prepare('SELECT source_id FROM batted_world_field_execution_heads WHERE physical_pitch_source_id=?')
      .get(motor.source.physicalPitchSourceId)).toEqual({ source_id: source.sourceId });
    expect(x.locomotion.read(motor.source.sourceId)).toEqual(motor);
    expect(motor.receipt.lifecycle).toEqual({ status: 'adoption_pending', executedThrough: null });
  } finally { x.f.close(); }
});
