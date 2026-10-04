import { expect, it } from 'vitest';
import * as queue from './ActualLivePlayQueueEvidenceFromSqlite';
import * as rule from './ActualLiveRuleConsumptionFromSqlite';
import { acquisitionInput } from '../../core/sim/ball/BattedWorldScheduledFieldAcquisition.test-support';
import { fixture, throwInput } from '../../core/sim/ball/BattedWorldScheduledFieldThrow.test-support';
import { prepareBattedWorldPiecewiseFieldAcquisition, deriveBattedWorldPiecewiseFieldAcquisitionProgress } from '../../core/sim/ball/BattedWorldPiecewiseFieldAcquisition';
import type { OwnedScheduledMotionExecution } from './OwnedScheduledBattedWorldMotion';

const owner = { owner: 'batted_world_field_executions', sourceId: 'capture', snapshotHash: 'hash' };
// Pure projection only. Real Core derives progress; inert wrapper receipt fields
// exercise event accounting, never the separate physical Source admission boundary.
const projection = () => {
  const input = acquisitionInput(fixture(0, 0.0625 / 0.0625001));
  const plan = prepareBattedWorldPiecewiseFieldAcquisition(input);
  const steps = [{ throughElapsedSeconds: 1, actors: { kind: 'retained' as const } }];
  const secure = deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps });
  const confirmed = deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [...steps, steps[0]] });
  if (secure.kind !== 'fence_pending' || confirmed.kind !== 'secured') throw new Error('Core fixture phases');
  const at = queue.actualLiveEventMoment(confirmed.world.moment);
  const receipt = { eventId: 'confirmed', kind: 'acquisition_confirmed', status: 'consumed', at, acquisition: confirmed.acquisition };
  const handoffs = ['custody', 'rule_evidence'].map(kind => ({ kind, basisEventId: 'confirmed', toSourceId: kind, status: 'pending' }));
  const value = { kind: 'owned_motion_v2', field: input.field, operation: { kind: 'acquisition', planSourceId: 'plan', plan, progress: confirmed },
    liveWork: { operation: { receipts: [receipt], handoffs } } } as unknown as OwnedScheduledMotionExecution;
  return { input, plan, secure, confirmed, value, receipt, handoffs };
};
it('emits only confirmed actual capture, preserving secure occurrence, fence availability and independent pending consumers', () => {
  const x = projection();
  expect(queue.actualLiveScheduledEvents, 'scheduled event projection').toBeTypeOf('function');
  const result = queue.actualLiveScheduledEvents(x.value, owner);
  expect(result.events).toHaveLength(1);
  expect(result.events[0]).toMatchObject({ eventKey: queue.actualLiveEventKey(owner.owner, owner.sourceId, 'confirmed'), owner,
    occurredAt: queue.actualLiveEventMoment(x.confirmed.acquisition.moment), availableAt: queue.actualLiveEventMoment(x.confirmed.world.moment) });
  expect(result.events[0].availableAt.elapsedSeconds).toBeGreaterThan(result.events[0].occurredAt.elapsedSeconds);
  expect(result.events[0].originalReceipt).toEqual(x.receipt);
  expect(result.successors.map(s => [s.kind, s.status])).toEqual([['custody', 'pending'], ['rule_evidence', 'pending']]);
  expect(result.consumptions).toHaveLength(1); expect(result.consumptions[0].successorKey).toBeNull();
  expect(result.consumptions[0].consumerKind).toBe('physical_execution');
  for (const s of result.successors) expect(s.basisEventKey).toBe(result.events[0].eventKey);
});
it('keeps plans and physically secured but unconfirmed work free of fictional completion events', () => {
  const x = projection();
  for (const value of [{ kind: 'owned_acquisition_plan_v1', field: x.input.field, plan: x.plan },
    { ...x.value, operation: { kind: 'acquisition', progress: x.secure }, liveWork: { operation: { receipts: [], handoffs: [] } } },
    { ...x.value, operation: null, liveWork: { operation: null } }]) {
    expect(queue.actualLiveScheduledEvents(value as OwnedScheduledMotionExecution, owner)).toEqual({ events: [], successors: [], consumptions: [] });
    expect(rule.actualLiveRuleCaptureConfirmed(value as OwnedScheduledMotionExecution)).toBe(false);
  }
  expect(rule.actualLiveRuleCaptureConfirmed(x.value)).toBe(true);
  expect(rule.actualLiveRuleCaptureConfirmed({ kind: 'acquisition_advance', progress: { kind: 'secured' } } as never)).toBe(true);
});
it('qualifies identical local event and handoff ids by the actual physical Source', () => {
  const x = projection(), left = queue.actualLiveScheduledEvents(x.value, owner);
  const right = queue.actualLiveScheduledEvents(x.value, { ...owner, sourceId: 'different-capture' });
  expect(left.events[0].eventKey).not.toBe(right.events[0].eventKey);
  expect(left.successors[0].successorKey).not.toBe(right.successors[0].successorKey);
});

import { prepareBattedWorldPiecewiseFieldThrow, deriveBattedWorldPiecewiseFieldThrowProgress } from '../../core/sim/ball/BattedWorldPiecewiseFieldThrow';
it('retains the actual raw release occurrence and distinct post-release contact successor', () => {
  const { availableAtTick: _a, throughTick: _t, commands: _c, ...input } = throwInput();
  const plan = prepareBattedWorldPiecewiseFieldThrow(input);
  const progress = deriveBattedWorldPiecewiseFieldThrowProgress({ plan, steps: [{ throughElapsedSeconds: 1, actors: { kind: 'retained' } }] });
  if (progress.kind !== 'released') throw new Error('release fixture');
  const at = queue.actualLiveEventMoment(progress.field.motion.world.moment);
  const receipt = { kind: 'throw_released', eventId: 'release', status: 'consumed', at, releaseCursor: progress.releaseCursor };
  const handoff = { kind: progress.field.motion.cursor ? 'free_ball' : 'contact', basisEventId: 'release', toSourceId: 'released',
    status: 'pending', cursor: progress.field.motion.cursor, field: progress.field };
  const execution = { kind: 'owned_motion_v2', field: progress.field, operation: { kind: 'throw', planSourceId: 'throw-plan', plan, progress },
    liveWork: { operation: { receipts: [receipt], handoffs: [handoff] } } } as unknown as OwnedScheduledMotionExecution;
  const result = queue.actualLiveScheduledEvents(execution, owner);
  expect(result.events[0].occurredAt).toEqual(queue.actualLiveEventMoment(progress.releaseCursor.moment));
  expect(result.events[0].availableAt).toEqual(at); expect(result.events[0].originalReceipt).toEqual(receipt);
  expect(result.successors[0].originalHandoff).toEqual(handoff); expect(result.successors[0].status).toBe('pending');
  expect(rule.actualLiveRuleCaptureConfirmed(execution)).toBe(false);
});
