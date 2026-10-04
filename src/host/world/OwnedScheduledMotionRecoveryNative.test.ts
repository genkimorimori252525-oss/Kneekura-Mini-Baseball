import { expect, it } from 'vitest';
import { ownedScheduledMotionFixture } from './OwnedScheduledMotionFixtures.test-support';
import { ownedScheduledMotionActualState } from './OwnedScheduledMotionState';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { openSqliteBattedWorldFieldExecutionStore } from './SqliteBattedWorldFieldExecutionStore';

it('recovers owned plan and original zero-time capture admission with immutable archive read and retry', () => {
  const x = ownedScheduledMotionFixture();
  try {
    const plan = x.plan('recovery-owned-plan');
    if (plan.execution.kind !== 'owned_acquisition_plan_v1') throw new Error('owned plan');
    const original = plan.execution.plan;
    expect(original.initialEnergyJ).toBeGreaterThan(0);
    const before = ownedScheduledMotionActualState(x.baseField.field, x.prefix(plan.source.sourceId).executions);
    expect(before.moment).toEqual(original.contactMoment); expect(before.cursor).toBeNull();
    const initialized = x.step('recovery-owned-init', plan.source.sourceId,
      { kind: 'operation', planSourceId: plan.source.sourceId, throughElapsedSeconds: original.contactMoment.elapsedSeconds });
    if (initialized.execution.kind !== 'owned_motion_v2' || initialized.execution.operation?.kind !== 'acquisition') throw new Error('owned constraint');
    expect(initialized.execution.operation.plan).toEqual(original);
    expect(initialized.execution.operation.progress.kind).toBe('capturing');
    const prefix = x.prefix(initialized.source.sourceId), state = ownedScheduledMotionActualState(x.baseField.field, prefix.executions);
    expect(state.moment).toEqual(original.initialConstraintMoment); expect(state.carrierPlayerId).toBeNull();
    const physical = battedWorldFieldPhysicalPrefix(prefix);
    expect(physical.segments.at(-1)!.actors).toHaveLength(50); expect(physical.controlWindows).toEqual([]);
    expect(() => x.step('recovery-empty-zero', initialized.source.sourceId,
      { kind: 'operation', planSourceId: plan.source.sourceId, throughElapsedSeconds: original.contactMoment.elapsedSeconds })).toThrow();
    const rows = x.f.db.prepare('SELECT * FROM batted_world_field_executions ORDER BY revision').all();
    expect(JSON.parse(String(rows.at(-1)!.snapshot_json)).snapshotFormat).toBe('owned_scheduled_field_execution_manifest_v1');
    expect(x.executions.read(initialized.source.sourceId)).toEqual(initialized);
    expect(x.executions.accept(initialized.source.sourceId)).toEqual(initialized);
    const reopened = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields));
    expect(reopened.read(initialized.source.sourceId)).toEqual(initialized);
    expect(reopened.accept(initialized.source.sourceId)).toEqual(initialized);
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_executions ORDER BY revision').all()).toEqual(rows);
  } finally { x.f.close(); }
});
