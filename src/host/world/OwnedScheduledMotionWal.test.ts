import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { ownedScheduledMotionFixture } from './OwnedScheduledMotionFixtures.test-support';
import { installOwnedScheduledDecision } from './OwnedScheduledMotionDecisionFixtures.test-support';
import { openSqliteBattedWorldFieldExecutionStore } from './SqliteBattedWorldFieldExecutionStore';

it('rolls back operation, composition, successor and head together on writer-local trigger corruption', () => {
  const x = ownedScheduledMotionFixture(join(mkdtempSync(join(tmpdir(), 'owned-scheduled-wal-')), 'state.sqlite'), 1000);
  try {
    const plan = x.plan('wal-owned-plan');
    if (plan.execution.kind !== 'owned_acquisition_plan_v1') throw new Error('plan');
    const initialized = x.step('wal-owned-init', plan.source.sourceId,
      { kind: 'operation', planSourceId: plan.source.sourceId, throughElapsedSeconds: plan.execution.plan.contactMoment.elapsedSeconds });
    const p = plan.execution.plan, tps = x.baseField.response.touch.worldContact.flight.source.execution.ballFlightParameters.ticksPerSecond;
    const exact = (p.contactMoment.ball.tick + 10 - p.contactMoment.originTick) / tps;
    const atInteger = x.step('wal-owned-integer', initialized.source.sourceId,
      { kind: 'operation', planSourceId: plan.source.sourceId, throughElapsedSeconds: exact });
    const player = x.playerIds.find(id => id !== p.acquirerPlayerId && id !== x.baseField.response.touch.worldContact.flight.physicalPitch.frame.batterActor!.binding.playerId)!;
    const issued = installOwnedScheduledDecision(x, player, atInteger.source.sourceId), motor = issued.issue(atInteger.source.sourceId);
    const source = x.stepSource('wal-owned-adoption', atInteger.source.sourceId,
      { kind: 'operation', planSourceId: plan.source.sourceId, throughElapsedSeconds: exact + 10 / tps }, [player]);
    const tables = ['batted_world_field_executions', 'batted_world_field_execution_heads', 'actual_locomotion_receipts', 'actual_locomotion_heads',
      'actual_defensive_decisions', 'actual_defensive_decision_heads', 'actual_field_observations', 'actual_field_observation_heads',
      'world_player_locomotion_models', 'world_player_decision_models', 'world_player_observation_models', 'batted_world_field_actions'];
    const rows = () => tables.map(t => x.f.db.prepare(`SELECT * FROM ${t} ORDER BY source_id`).all());
    const before = rows();
    const quote = (s: string) => `'${s.replaceAll("'", "''")}'`;
    const mutations = [
      `UPDATE batted_world_field_executions SET snapshot_hash='changed-operation' WHERE source_id=${quote(plan.source.sourceId)};`,
      `UPDATE batted_world_field_executions SET snapshot_json=json_set(snapshot_json,'$.execution.composition.coverageThroughTick',0) WHERE source_id=NEW.source_id;`,
      `UPDATE actual_locomotion_receipts SET snapshot_hash='changed-motor' WHERE source_id=${quote(motor.source.sourceId)};`,
      `UPDATE actual_defensive_decisions SET snapshot_hash='changed-decision';`,
      `UPDATE actual_field_observations SET snapshot_hash='changed-observation';`,
      `UPDATE world_player_locomotion_models SET snapshot_hash='changed-model';`,
      `UPDATE actual_locomotion_receipts SET execution_source_id=NEW.source_id,source_json=json_set(source_json,'$.executionSourceId',NEW.source_id),
        snapshot_json=json_set(snapshot_json,'$.source.executionSourceId',NEW.source_id,'$.history[0].executionSourceId',NEW.source_id,
          '$.receipt.self.cut.executionSourceId',NEW.source_id) WHERE source_id=${quote(motor.source.sourceId)};`,
      `UPDATE actual_defensive_decision_heads SET revision=revision+1;`,
    ];
    for (const event of ['AFTER INSERT ON batted_world_field_executions', 'AFTER UPDATE ON batted_world_field_execution_heads']) {
      for (const mutation of mutations) {
        x.f.db.exec(`CREATE TRIGGER owned_scheduled_mutation ${event} WHEN NEW.source_id=${quote(source.sourceId)} BEGIN ${mutation} END;`);
        let error: unknown;
        try { x.executions.accept(source.sourceId); } catch (e) { error = e; }
        finally { x.f.db.exec('DROP TRIGGER owned_scheduled_mutation'); }
        expect(error).toBeInstanceOf(Error); expect(error).not.toBeInstanceOf(RangeError);
        expect(rows()).toEqual(before);
      }
    }
    const saved = x.executions.accept(source.sourceId);
    expect(saved.execution.kind).toBe('owned_motion_v2');
    expect(issued.motors.read(motor.source.sourceId)).toEqual(motor);
  } finally { x.f.close(); }
});

it('rejects a committed peer known-head change before BEGIN even when the peer caches the old physical snapshot', () => {
  const x = ownedScheduledMotionFixture(join(mkdtempSync(join(tmpdir(), 'owned-scheduled-peer-')), 'state.sqlite'), 1000);
  try {
    const plan = x.plan('peer-owned-plan');
    if (plan.execution.kind !== 'owned_acquisition_plan_v1') throw new Error('plan');
    const initialized = x.step('peer-owned-init', plan.source.sourceId,
      { kind: 'operation', planSourceId: plan.source.sourceId, throughElapsedSeconds: plan.execution.plan.contactMoment.elapsedSeconds });
    const peerPlayerId = plan.execution.plan.acquirerPlayerId;
    const source = x.stepSource('peer-stale-known', initialized.source.sourceId,
      { kind: 'operation', planSourceId: plan.source.sourceId, throughElapsedSeconds: plan.execution.plan.secureElapsedSeconds });
    const before = x.f.db.prepare('SELECT * FROM batted_world_field_executions').all();
    let issued: ReturnType<typeof installOwnedScheduledDecision> | null = null;
    const writer = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, { read() {
      issued = installOwnedScheduledDecision(x, peerPlayerId, initialized.source.sourceId, 100); return x.baseField;
    } }, { readAcceptedExecution: () => source }));
    expect(() => writer.accept(source.sourceId)).toThrow(/known-work.*stale|known-work.*missing/);
    expect(issued).not.toBeNull();
    expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_defensive_decisions').get()!.n).toBe(1);
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_executions').all()).toEqual(before);
  } finally { x.f.close(); }
});
