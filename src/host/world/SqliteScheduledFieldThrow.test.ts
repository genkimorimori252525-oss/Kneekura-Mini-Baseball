import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { battedWorldFieldThrowFixture } from './BattedWorldFieldExecutionFixtures.test-support';
import { openSqliteBattedWorldFieldExecutionStore, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

it('owns an admitted actual transfer across a bounded checkpoint and reopen, then releases exactly once', () => {
  const x = battedWorldFieldThrowFixture(join(mkdtempSync(join(tmpdir(), 'scheduled-field-throw-')), 'state.sqlite'));
  try {
    if (x.source.action.kind !== 'throw') throw new Error('fixture throw');
    const planSource = { ...x.source, sourceId: 'scheduled-throw-plan', action: { ...x.source.action, kind: 'throw_plan' } } as unknown as AcceptedBattedWorldFieldExecution;
    x.sources.set(planSource.sourceId, planSource);
    const plan = x.executions.accept(planSource.sourceId);
    expect(plan.execution.kind).toBe('throw_plan');
    if (plan.execution.kind !== 'throw_plan') throw new Error('missing planned throw');
    expect(plan.execution.field).toEqual(x.acquired.execution.field);
    expect(plan.execution.liveWork.phase).toBe('pending');
    expect(plan.execution.liveWork.receipts).toEqual([]);
    expect(plan.execution.liveWork.source).not.toHaveProperty('completion');
    const start = plan.execution.plan.input.cursor.moment.elapsedSeconds;
    const due = plan.execution.plan.releaseElapsedSeconds;
    const midSource = { ...planSource, sourceId: 'scheduled-before-release', previousExecutionSourceId: planSource.sourceId,
      action: { kind: 'throw_advance', planSourceId: planSource.sourceId, throughElapsedSeconds: (start + due) / 2 } } as unknown as AcceptedBattedWorldFieldExecution;
    x.sources.set(midSource.sourceId, midSource);
    const middle = x.executions.accept(midSource.sourceId);
    expect(middle.execution.kind).toBe('throw_advance');
    if (middle.execution.kind !== 'throw_advance') throw new Error('missing transfer progress');
    expect(middle.execution.progress.kind).toBe('transfer');
    expect(middle.execution.liveWork.source.sourceId).toBe(plan.execution.liveWork.source.sourceId);
    expect(middle.execution.liveWork.source.queue?.nextPendingTick).toBe(plan.execution.plan.transfer.throwReadyTick);
    expect(middle.execution.liveWork.receipts).toEqual([]);
    expect(middle.execution.field.motion.carrierPlayerId).toBe(x.capture.acquirerPlayerId);
    expect(middle.execution.field.motion.world.moment.elapsedSeconds).toBeLessThan(due);
    const saved = x.f.db.prepare('SELECT snapshot_json,snapshot_hash FROM batted_world_field_executions WHERE source_id=?').get(midSource.sourceId);
    x.executions.close();
    const reopened = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields, x.authority));
    expect(reopened.read(midSource.sourceId)).toEqual(middle);
    expect(reopened.accept(midSource.sourceId)).toEqual(middle);
    const endSource = { ...midSource, sourceId: 'scheduled-release', previousExecutionSourceId: midSource.sourceId,
      action: { ...midSource.action, throughElapsedSeconds: due + 0.001 } } as unknown as AcceptedBattedWorldFieldExecution;
    x.sources.set(endSource.sourceId, endSource);
    const released = reopened.accept(endSource.sourceId);
    if (released.execution.kind !== 'throw_advance' || released.execution.progress.kind !== 'released') throw new Error('missing actual release');
    expect(released.execution.progress.transfer).toEqual(plan.execution.plan.transfer);
    expect(released.execution.field.motion.world.moment.elapsedSeconds).toBe(due);
    expect(released.execution.field.motion.carrierPlayerId).toBeNull();
    expect(released.execution.liveWork.receipts).toHaveLength(1);
    expect(released.execution.liveWork.receipts[0]).toMatchObject({ kind: 'throw_released', status: 'consumed', executionSourceId: endSource.sourceId });
    expect(released.execution.liveWork.handoff?.cursor).toEqual(released.execution.progress.releaseCursor);
    expect(released.execution.liveWork.handoff?.source.physical).toMatchObject([{ kind: 'ball_motion' }]);
    expect(released.execution.liveWork.handoff?.source).not.toHaveProperty('completion');
    expect(reopened.accept(endSource.sourceId)).toEqual(released);
    expect(x.f.db.prepare('SELECT snapshot_json,snapshot_hash FROM batted_world_field_executions WHERE source_id=?').get(midSource.sourceId)).toEqual(saved);
    const duplicate = { ...endSource, sourceId: 'second-release', previousExecutionSourceId: endSource.sourceId };
    x.sources.set(duplicate.sourceId, duplicate);
    expect(() => reopened.accept(duplicate.sourceId)).toThrow();
    const continuation = { ...x.source, sourceId: 'released-ball-motion', previousExecutionSourceId: endSource.sourceId,
      action: { kind: 'motion', availableAtTick: released.execution.progress.releaseCursor.moment.ball.tick,
        throughTick: released.execution.progress.releaseCursor.moment.ball.tick + 1000, commands: x.fieldSource.commands } } as AcceptedBattedWorldFieldExecution;
    x.sources.set(continuation.sourceId, continuation);
    const moved = reopened.accept(continuation.sourceId);
    expect(moved.execution.kind).toBe('motion');
    expect(moved.execution.field.motion.carrierPlayerId).toBeNull();
    // This original fixture aims back into the releasing glove: the real next
    // free query stops on an immediate boundary, rather than inventing flight.
    expect(moved.execution.field.motion.world).toMatchObject({ kind: 'boundary', moment: { elapsedSeconds: due } });
    if (moved.execution.field.motion.world.kind !== 'boundary') throw new Error('missing actual post-release contact');
    expect(moved.execution.field.motion.world.contacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'actor', playerId: x.capture.acquirerPlayerId, role: 'glove' }),
    ]));
  } finally { x.f.close(); }
});

it('preserves pending physical ownership across observations and rejects competing actions without changing the head', () => {
  const x = battedWorldFieldThrowFixture();
  try {
    if (x.source.action.kind !== 'throw') throw new Error('fixture throw');
    const planSource: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'pending-plan', action: { ...x.source.action, kind: 'throw_plan' } };
    x.sources.set(planSource.sourceId, planSource);
    const plan = x.executions.accept(planSource.sourceId);
    if (plan.execution.kind !== 'throw_plan') throw new Error('missing plan');
    const observation: AcceptedBattedWorldFieldExecution = { ...planSource, sourceId: 'pending-observation', previousExecutionSourceId: planSource.sourceId,
      action: { kind: 'whole_play_history' } };
    x.sources.set(observation.sourceId, observation);
    const observed = x.executions.accept(observation.sourceId);
    if (observed.execution.kind !== 'whole_play_history') throw new Error('missing physical history');
    expect(observed.execution.physicalHistory.horizon).toEqual(x.capture.moment);
    expect(observed.execution.physicalHistory.end).toEqual({ kind: 'unestablished' });
    const before = x.f.db.prepare('SELECT * FROM batted_world_field_execution_heads').all();
    const competing: AcceptedBattedWorldFieldExecution['action'][] = [{ kind: 'acquisition' }, x.source.action,
      { ...x.source.action, kind: 'throw_plan', modelSourceId: x.model.source.sourceId },
      { kind: 'motion', availableAtTick: x.capture.secureTick, throughTick: x.capture.secureTick + 1000, commands: x.fieldSource.commands }];
    for (const [index, action] of competing.entries()) {
      const source = { ...planSource, sourceId: `competing-${index}`, previousExecutionSourceId: observation.sourceId, action };
      x.sources.set(source.sourceId, source); expect(() => x.executions.accept(source.sourceId)).toThrow(/pending/);
    }
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_execution_heads').all()).toEqual(before);
    const advance: AcceptedBattedWorldFieldExecution = { ...planSource, sourceId: 'advance-after-observer', previousExecutionSourceId: observation.sourceId,
      action: { kind: 'throw_advance', planSourceId: planSource.sourceId,
        throughElapsedSeconds: (plan.execution.plan.input.cursor.moment.elapsedSeconds + plan.execution.plan.releaseElapsedSeconds) / 2 } };
    x.sources.set(advance.sourceId, advance);
    const moved = x.executions.accept(advance.sourceId);
    if (moved.execution.kind !== 'throw_advance') throw new Error('missing progress');
    expect(moved.execution.progress.kind).toBe('transfer');
    expect(moved.execution.progress.transfer).toEqual(plan.execution.plan.transfer);
  } finally { x.f.close(); }
});

it('rejects caller release, plan, event, completion, watermark and replacement model fields', () => {
  const x = battedWorldFieldThrowFixture();
  try {
    if (x.source.action.kind !== 'throw') throw new Error('fixture throw');
    const planSource: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'guarded-plan', action: { ...x.source.action, kind: 'throw_plan' } };
    x.sources.set(planSource.sourceId, planSource); const plan = x.executions.accept(planSource.sourceId);
    if (plan.execution.kind !== 'throw_plan') throw new Error('missing plan');
    const action = { kind: 'throw_advance', planSourceId: planSource.sourceId, throughElapsedSeconds: plan.execution.plan.releaseElapsedSeconds };
    const before = x.f.db.prepare('SELECT * FROM batted_world_field_execution_heads').all();
    for (const key of ['releaseCursor', 'launch', 'plan', 'liveWork', 'event', 'completion', 'settledThroughTick', 'modelSourceId', 'receiverPlayerId', 'commands', 'terminal', 'playEnd']) {
      const source = { ...planSource, sourceId: `injected-${key}`, previousExecutionSourceId: planSource.sourceId,
        action: { ...action, [key]: key === 'settledThroughTick' ? 1 : {} } } as unknown as AcceptedBattedWorldFieldExecution;
      x.sources.set(source.sourceId, source); expect(() => x.executions.accept(source.sourceId)).toThrow(/invalid/);
    }
    const wrong = { ...planSource, sourceId: 'wrong-plan', previousExecutionSourceId: planSource.sourceId,
      action: { ...action, planSourceId: 'unknown-plan' } } as AcceptedBattedWorldFieldExecution;
    x.sources.set(wrong.sourceId, wrong); expect(() => x.executions.accept(wrong.sourceId)).toThrow(/plan/);
    const stale = { ...planSource, sourceId: 'stale-advance', previousExecutionSourceId: x.acquired.source.sourceId, action } as AcceptedBattedWorldFieldExecution;
    x.sources.set(stale.sourceId, stale); expect(() => x.executions.accept(stale.sourceId)).toThrow(/predecessor/);
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_execution_heads').all()).toEqual(before);
  } finally { x.f.close(); }
});
