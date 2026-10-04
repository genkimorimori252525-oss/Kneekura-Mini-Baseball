import { expect, it } from 'vitest';
import { acquisitionInput } from '../../core/sim/ball/BattedWorldScheduledFieldAcquisition.test-support';
import { prepareBattedWorldPiecewiseFieldAcquisition, deriveBattedWorldPiecewiseFieldAcquisitionProgress } from '../../core/sim/ball/BattedWorldPiecewiseFieldAcquisition';
import { ownedScheduledMotionActualState } from './OwnedScheduledMotionState';
import type { DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

// Projection-only wrappers: Core derives real physical progress; no wrapper is
// accepted as a Native Source or substituted for an owned database rederivation.
const wrap = (execution: unknown) => ({ execution }) as DurableBattedWorldFieldExecution;
it('plans and observers do not initialize a capture or alter actual incoming state', () => {
  const input = acquisitionInput(), plan = prepareBattedWorldPiecewiseFieldAcquisition(input);
  const state = ownedScheduledMotionActualState(input.field, [wrap({ kind: 'owned_acquisition_plan_v1', field: input.field, plan }),
    wrap({ kind: 'whole_play_history', field: input.field })]);
  expect(state.moment).toBe(input.field.motion.world.moment);
  expect(state.moment.ball.velocity).toEqual(plan.contactMoment.ball.velocity);
  expect(state.moment.ball.velocity).not.toEqual(plan.initialConstraintMoment.ball.velocity);
  expect(state.cursor).toBeNull(); expect(state.carrierPlayerId).toBeNull();
});
it('projects real initialized damping without custody and confirmed capture at its actual fence', () => {
  const input = acquisitionInput(), plan = prepareBattedWorldPiecewiseFieldAcquisition(input);
  const first = { throughElapsedSeconds: plan.contactMoment.elapsedSeconds, actors: { kind: 'retained' as const } };
  const progress = deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [first] });
  const initialized = wrap({ kind: 'owned_motion_v2', field: input.field, operation: { kind: 'acquisition', plan, progress } });
  const current = ownedScheduledMotionActualState(input.field, [initialized, wrap({ kind: 'base_touch_history', field: input.field })]);
  expect(current.moment).toBe(progress.world.moment); expect(current.actors).toBe(progress.activePiece.actors);
  expect(current.cursor).toBeNull(); expect(current.carrierPlayerId).toBeNull();
  const confirmed = deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [first,
    { throughElapsedSeconds: plan.fenceElapsedSeconds, actors: { kind: 'retained' } }] });
  expect(confirmed.kind).toBe('secured');
  const carried = ownedScheduledMotionActualState(input.field, [initialized,
    wrap({ kind: 'owned_motion_v2', field: input.field, operation: { kind: 'acquisition', plan, progress: confirmed } })]);
  expect(carried.moment).toBe(confirmed.world.moment); expect(carried.cursor).toBe(confirmed.cursor);
  expect(carried.carrierPlayerId).toBe(plan.acquirerPlayerId);
});
it('keeps incoming world moment distinct from its separately resolved cursor', () => {
  const input = acquisitionInput(), incoming = input.field.motion.world.moment;
  const responseMoment = { ...incoming, ball: { ...incoming.ball, velocity: { x: -1, y: 2, z: 3 } } };
  const cursor = { moment: responseMoment, previousContacts: [] };
  const field = { ...input.field, motion: { ...input.field.motion, cursor } };
  const state = ownedScheduledMotionActualState(field, []);
  expect(state.moment).toBe(incoming); expect(state.cursor).toBe(cursor);
  expect(state.moment.ball.velocity).not.toEqual(state.cursor!.moment.ball.velocity);
});
