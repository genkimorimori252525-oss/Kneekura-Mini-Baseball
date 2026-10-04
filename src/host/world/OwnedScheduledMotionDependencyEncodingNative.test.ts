import { expect, it, vi } from 'vitest';
import * as encoders from './OwnedScheduledMotionDependencyEncoding';
import { ownedScheduledMotionFixture } from './OwnedScheduledMotionFixtures.test-support';
import { installOwnedScheduledDecision } from './OwnedScheduledMotionDecisionFixtures.test-support';

it('rechecks predecessor row bytes after an immutable encoding cache hit and discards the failed context', () => {
  const x = ownedScheduledMotionFixture(undefined, 1000);
  try {
    const plan = x.plan('encoding-cache-plan');
    if (plan.execution.kind !== 'owned_acquisition_plan_v1') throw new Error('plan');
    let current = x.step('encoding-cache-init', plan.source.sourceId,
      { kind: 'operation', planSourceId: plan.source.sourceId, throughElapsedSeconds: plan.execution.plan.contactMoment.elapsedSeconds });
    const p = plan.execution.plan, tps = p.input.response.world.parameters.ticksPerSecond;
    const exact = (p.contactMoment.ball.tick + 1 - p.contactMoment.originTick) / tps;
    current = x.step('encoding-cache-integer', current.source.sourceId,
      { kind: 'operation', planSourceId: plan.source.sourceId, throughElapsedSeconds: exact });
    const player = x.baseField.response.touch.worldContact.flight.physicalPitch.frame.batterActor!.defenderBindings
      .find(b => b.playerId !== p.acquirerPlayerId)!.playerId;
    const chain = installOwnedScheduledDecision(x, player, current.source.sourceId); chain.issue(current.source.sourceId);
    const source = x.stepSource('encoding-cache-adoption', current.source.sourceId,
      { kind: 'operation', planSourceId: plan.source.sourceId, throughElapsedSeconds: exact }, [player]);
    const saved = x.f.db.prepare('SELECT snapshot_hash FROM batted_world_field_executions WHERE source_id=?').get(current.source.sourceId)!;
    const before = x.f.db.prepare('SELECT * FROM batted_world_field_execution_heads').all();
    const create = encoders.createOwnedScheduledMotionDependencyEncoding;
    let changed = false, hits = 0, contexts = 0;
    const spy = vi.spyOn(encoders, 'createOwnedScheduledMotionDependencyEncoding').mockImplementation(() => {
      contexts++; const encoder = create(), seen = new WeakMap<object, ReturnType<typeof encoder.snapshot>>();
      return Object.freeze({ ...encoder, snapshot(value) {
        const result = encoder.snapshot(value), prior = seen.get(value);
        if (prior === result && value.source.sourceId === current.source.sourceId) {
          hits++;
          if (!changed) {
            changed = true;
            x.f.db.prepare("UPDATE batted_world_field_executions SET snapshot_hash='changed-after-encoding-hit' WHERE source_id=?").run(current.source.sourceId);
          }
        }
        seen.set(value, result); return result;
      } });
    });
    try {
      expect(() => x.executions.accept(source.sourceId)).toThrow(/predecessor changed|corrupt actual field execution snapshot/);
      expect(changed).toBe(true); expect(hits).toBeGreaterThan(0); expect(contexts).toBeGreaterThan(0);
      expect(x.f.db.prepare('SELECT * FROM batted_world_field_execution_heads').all()).toEqual(before);
      expect(x.f.db.prepare('SELECT source_id FROM batted_world_field_executions WHERE source_id=?').get(source.sourceId)).toBeUndefined();
    } finally {
      spy.mockRestore();
      x.f.db.prepare('UPDATE batted_world_field_executions SET snapshot_hash=? WHERE source_id=?').run(saved.snapshot_hash, current.source.sourceId);
    }
    // The next independent call has a fresh private scope after the previous throw.
    expect(x.executions.accept(source.sourceId).execution.kind).toBe('owned_motion_v2');
    expect(x.executions.read(source.sourceId)!.execution.kind).toBe('owned_motion_v2');
  } finally { x.f.close(); }
});
