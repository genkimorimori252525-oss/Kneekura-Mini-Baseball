import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { battedWorldFieldExecutionFixture } from './BattedWorldFieldExecutionFixtures.test-support';
import { openSqliteBattedWorldFieldExecutionStore, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

it('owns actual capture through partial dissipation and the executed competition fence across reopen', () => {
  const x = battedWorldFieldExecutionFixture(join(mkdtempSync(join(tmpdir(), 'scheduled-field-capture-')), 'state.sqlite'), 'candidate');
  try {
    const planSource = { ...x.source, sourceId: 'capture-plan', action: { kind: 'acquisition_plan' } } as unknown as AcceptedBattedWorldFieldExecution;
    x.sources.set(planSource.sourceId, planSource);
    const planned = x.executions.accept(planSource.sourceId);
    expect(planned.execution.kind).toBe('acquisition_plan');
    if (planned.execution.kind !== 'acquisition_plan') throw new Error('missing acquisition plan');
    const plan = planned.execution.plan;
    expect(planned.execution.field).toEqual(x.baseField.field);
    expect(planned.execution.liveWork.receipts).toEqual([]);
    expect(planned.execution.liveWork.source).not.toHaveProperty('completion');
    expect(plan.secureElapsedSeconds).toBeGreaterThan(plan.contactMoment.elapsedSeconds);
    expect(plan.fenceElapsedSeconds).toBeGreaterThan(plan.secureElapsedSeconds);
    const middleSource = { ...planSource, sourceId: 'capture-middle', previousExecutionSourceId: planSource.sourceId,
      action: { kind: 'acquisition_advance', planSourceId: planSource.sourceId,
        throughElapsedSeconds: (plan.contactMoment.elapsedSeconds + plan.secureElapsedSeconds) / 2 } } as unknown as AcceptedBattedWorldFieldExecution;
    x.sources.set(middleSource.sourceId, middleSource);
    const middle = x.executions.accept(middleSource.sourceId);
    if (middle.execution.kind !== 'acquisition_advance') throw new Error('missing acquisition advance');
    expect(middle.execution.progress.kind).toBe('capturing');
    expect(middle.execution.progress.cursor).toBeNull();
    expect(middle.execution.progress.acquisition).toBeNull();
    expect(middle.execution.progress.transport.remainingEnergyJ).toBeGreaterThan(0);
    const saved = x.f.db.prepare('SELECT snapshot_json,snapshot_hash FROM batted_world_field_executions WHERE source_id=?').get(middleSource.sourceId);
    x.executions.close();
    const reopened = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields, x.authority));
    expect(reopened.read(middleSource.sourceId)).toEqual(middle);
    expect(reopened.accept(middleSource.sourceId)).toEqual(middle);
    const fenceSource = { ...middleSource, sourceId: 'capture-fence-pending', previousExecutionSourceId: middleSource.sourceId,
      action: { kind: 'acquisition_advance', planSourceId: planSource.sourceId,
        throughElapsedSeconds: (plan.secureElapsedSeconds + plan.fenceElapsedSeconds) / 2 } } as unknown as AcceptedBattedWorldFieldExecution;
    x.sources.set(fenceSource.sourceId, fenceSource);
    const fencePending = reopened.accept(fenceSource.sourceId);
    if (fencePending.execution.kind !== 'acquisition_advance') throw new Error('missing fence advance');
    expect(fencePending.execution.progress.kind).toBe('fence_pending');
    expect(fencePending.execution.progress.transport.remainingEnergyJ).toBe(0);
    expect(fencePending.execution.progress.cursor).toBeNull();
    expect(fencePending.execution.progress.acquisition).toBeNull();
    expect(fencePending.execution.liveWork.receipts).toEqual([]);
    const endSource = { ...fenceSource, sourceId: 'capture-confirmed', previousExecutionSourceId: fenceSource.sourceId,
      action: { kind: 'acquisition_advance', planSourceId: planSource.sourceId,
        throughElapsedSeconds: plan.fenceElapsedSeconds + 0.001 } } as unknown as AcceptedBattedWorldFieldExecution;
    x.sources.set(endSource.sourceId, endSource);
    const confirmed = reopened.accept(endSource.sourceId);
    if (confirmed.execution.kind !== 'acquisition_advance' || confirmed.execution.progress.kind !== 'secured') throw new Error('missing confirmed acquisition');
    const progress = confirmed.execution.progress;
    expect(progress.acquisition.moment.elapsedSeconds).toBe(plan.secureElapsedSeconds);
    expect(progress.cursor.moment.elapsedSeconds).toBe(plan.fenceElapsedSeconds);
    expect(progress.world.moment).toEqual(progress.cursor.moment);
    expect(confirmed.execution.liveWork.receipts).toHaveLength(1);
    expect(confirmed.execution.liveWork.handoffs).toHaveLength(2);
    for (const handoff of confirmed.execution.liveWork.handoffs) expect(handoff.source).not.toHaveProperty('completion');
    expect(x.f.db.prepare('SELECT snapshot_json,snapshot_hash FROM batted_world_field_executions WHERE source_id=?').get(middleSource.sourceId)).toEqual(saved);
    const duplicate = { ...endSource, sourceId: 'duplicate-capture', previousExecutionSourceId: endSource.sourceId };
    x.sources.set(duplicate.sourceId, duplicate);
    expect(() => reopened.accept(duplicate.sourceId)).toThrow(/terminal|pending|plan/);
    const moveSource: AcceptedBattedWorldFieldExecution = { ...endSource, sourceId: 'capture-carried-motion', previousExecutionSourceId: endSource.sourceId,
      action: { kind: 'motion', availableAtTick: progress.cursor.moment.ball.tick,
        throughTick: progress.cursor.moment.ball.tick + 1000, commands: x.fieldSource.commands } };
    x.sources.set(moveSource.sourceId, moveSource);
    const moved = reopened.accept(moveSource.sourceId);
    expect(moved.execution.kind).toBe('motion');
    expect(moved.execution.field.motion.carrierPlayerId).toBe(plan.acquirerPlayerId);
    expect(moved.execution.field.motion.world.moment.elapsedSeconds).toBeGreaterThanOrEqual(plan.fenceElapsedSeconds);
  } finally { x.f.close(); }
});

it('keeps pending capture authority across history observations and rejects competing or injected actions', () => {
  const x = battedWorldFieldExecutionFixture(undefined, 'candidate');
  try {
    const planSource = { ...x.source, sourceId: 'pending-capture', action: { kind: 'acquisition_plan' } } as unknown as AcceptedBattedWorldFieldExecution;
    x.sources.set(planSource.sourceId, planSource); const planned = x.executions.accept(planSource.sourceId);
    if (planned.execution.kind !== 'acquisition_plan') throw new Error('missing capture plan');
    const observation: AcceptedBattedWorldFieldExecution = { ...planSource, sourceId: 'capture-observation', previousExecutionSourceId: planSource.sourceId,
      action: { kind: 'whole_play_history' } };
    x.sources.set(observation.sourceId, observation); const observed = x.executions.accept(observation.sourceId);
    if (observed.execution.kind !== 'whole_play_history') throw new Error('missing capture observation');
    expect(observed.execution.physicalHistory.horizon).toEqual(planned.execution.plan.contactMoment);
    expect(observed.execution.physicalHistory.end).toEqual({ kind: 'unestablished' });
    const before = x.f.db.prepare('SELECT * FROM batted_world_field_execution_heads').all();
    const move = { kind: 'motion', availableAtTick: planned.execution.plan.candidateSecureTick,
      throughTick: planned.execution.plan.candidateSecureTick + 1000, commands: x.fieldSource.commands };
    for (const [index, action] of [{ kind: 'acquisition' }, { kind: 'acquisition_plan' }, move,
      { ...move, kind: 'throw', modelSourceId: 'unused-model', receiverPlayerId: 'p3' },
      { ...move, kind: 'throw_plan', modelSourceId: 'unused-model', receiverPlayerId: 'p3' },
      { kind: 'throw_advance', planSourceId: 'unused-plan', throughElapsedSeconds: planned.execution.plan.fenceElapsedSeconds }].entries()) {
      const source = { ...planSource, sourceId: `competing-capture-${index}`, previousExecutionSourceId: observation.sourceId, action } as unknown as AcceptedBattedWorldFieldExecution;
      x.sources.set(source.sourceId, source); expect(() => x.executions.accept(source.sourceId)).toThrow(/pending/);
    }
    const action = { kind: 'acquisition_advance', planSourceId: planSource.sourceId, throughElapsedSeconds: planned.execution.plan.fenceElapsedSeconds };
    for (const key of ['acquisition', 'cursor', 'plan', 'liveWork', 'event', 'completion', 'settledThroughTick', 'modelSourceId', 'commands',
      'retained', 'secureTick', 'playEnd', 'possessionEvidence', 'custodyEvidence', 'possessionGuard']) {
      const source = { ...planSource, sourceId: `injected-capture-${key}`, previousExecutionSourceId: observation.sourceId,
        action: { ...action, [key]: {} } } as unknown as AcceptedBattedWorldFieldExecution;
      x.sources.set(source.sourceId, source); expect(() => x.executions.accept(source.sourceId)).toThrow(/invalid/);
    }
    const wrong = { ...planSource, sourceId: 'wrong-capture-plan', previousExecutionSourceId: observation.sourceId,
      action: { ...action, planSourceId: 'missing-capture-plan' } } as unknown as AcceptedBattedWorldFieldExecution;
    x.sources.set(wrong.sourceId, wrong); expect(() => x.executions.accept(wrong.sourceId)).toThrow(/plan/);
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_execution_heads').all()).toEqual(before);
    const advance = { ...planSource, sourceId: 'capture-after-observer', previousExecutionSourceId: observation.sourceId, action } as unknown as AcceptedBattedWorldFieldExecution;
    x.sources.set(advance.sourceId, advance); const moved = x.executions.accept(advance.sourceId);
    if (moved.execution.kind !== 'acquisition_advance') throw new Error('missing confirmed capture');
    expect(moved.execution.progress.kind).toBe('secured');
  } finally { x.f.close(); }
});
