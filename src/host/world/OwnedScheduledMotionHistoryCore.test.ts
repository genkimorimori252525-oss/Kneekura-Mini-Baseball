import { expect, it } from 'vitest';
import { acquiredHistory, fixture, historySource, throwInput } from '../../core/sim/plateAppearance/CanonicalWholePlayHistory.test-support';
import { deriveCanonicalWholePlayHistory, type WholePlayHistoryStep } from '../../core/sim/plateAppearance/CanonicalWholePlayHistory';
import { prepareBattedWorldPiecewiseFieldAcquisition, deriveBattedWorldPiecewiseFieldAcquisitionProgress, bridgeBattedWorldPiecewiseFieldAcquisitionPlan } from '../../core/sim/ball/BattedWorldPiecewiseFieldAcquisition';
import { prepareBattedWorldPiecewiseFieldThrow, deriveBattedWorldPiecewiseFieldThrowProgress } from '../../core/sim/ball/BattedWorldPiecewiseFieldThrow';
import { prepareBattedWorldScheduledFieldAcquisition, advanceBattedWorldScheduledFieldAcquisition } from '../../core/sim/ball/BattedWorldScheduledFieldAcquisition';
import type { PiecewiseFieldMotionStep } from '../../core/sim/ball/BattedWorldPiecewiseFieldMotion';
import { advanceBattedWorldFieldMotionCheckpoint } from '../../core/sim/ball/BattedWorldFieldMotion';

const retained = (throughElapsedSeconds: number): PiecewiseFieldMotionStep => ({ throughElapsedSeconds, actors: { kind: 'retained' } });
function ownedCapture() {
  const f = fixture(), input = acquiredHistory(f), first = input.steps[0];
  if (first.kind !== 'motion') throw new Error('fixture');
  const plan = prepareBattedWorldPiecewiseFieldAcquisition({ response: f.response, geometry: f.geometry, field: first.field });
  const steps: WholePlayHistoryStep[] = [first, { source: historySource(1), previousSourceId: null,
    kind: 'owned_acquisition_plan_v1', basis: first.source, horizon: plan.contactMoment, plan }];
  const executed: PiecewiseFieldMotionStep[] = [];
  const ids: string[] = [];
  for (const elapsed of [plan.contactMoment.elapsedSeconds, plan.secureElapsedSeconds]) {
    const step = retained(elapsed); executed.push(step);
    const progress = deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: executed });
    const rev = ids.length + 2, source = historySource(rev);
    steps.push({ source, previousSourceId: historySource(rev - 1).sourceId, kind: 'owned_motion_v2', startCursor: null, mode: 'retained',
      field: first.field, operation: { kind: 'acquisition', planSourceId: historySource(1).sourceId, previousStepSourceIds: [...ids],
        step, bridge: null, plan, progress } });
    ids.push(source.sourceId);
  }
  return { f, input, first, plan, steps };
}

it('retains the actual owned initialize, secure, throw and release sequence', () => {
  const x = ownedCapture();
  const captured = deriveCanonicalWholePlayHistory({ ...x.input, steps: x.steps });
  expect(captured.carrierPlayerId).toBe('carrier');
  const { availableAtTick: _a, throughTick: _t, commands: _c, ...basis } = throwInput(x.f);
  const plan = prepareBattedWorldPiecewiseFieldThrow({ ...basis, cursor: captured.cursor! });
  x.steps.push({ source: historySource(4), previousSourceId: historySource(3).sourceId, kind: 'owned_throw_plan_v1',
    basis: historySource(3), horizon: captured.horizon, plan });
  const step = retained(plan.releaseElapsedSeconds), progress = deriveBattedWorldPiecewiseFieldThrowProgress({ plan, steps: [step] });
  expect(progress.kind).toBe('released');
  x.steps.push({ source: historySource(5), previousSourceId: historySource(4).sourceId, kind: 'owned_motion_v2',
    startCursor: captured.cursor, mode: 'retained', field: progress.field,
    operation: { kind: 'throw', planSourceId: historySource(4).sourceId, previousStepSourceIds: [], step, bridge: null, plan, progress } });
  const result = deriveCanonicalWholePlayHistory({ ...x.input, steps: x.steps });
  const phases = result.frames.flatMap(frame => frame.occurrences.map(o => o.phase));
  expect(phases.filter(p => p === 'acquisition_constraint_started')).toHaveLength(1);
  expect(phases.filter(p => p === 'acquisition_confirmed')).toHaveLength(1);
  expect(phases.filter(p => p === 'throw_release')).toHaveLength(1);
  expect(result.carrierPlayerId).toBeNull();
  expect(result.end.kind).toBe('unestablished');
});

it('keeps a legacy bridge constraint transition single and validates its lineage', () => {
  const f = fixture(), input = acquiredHistory(f), first = input.steps[0];
  if (first.kind !== 'motion') throw new Error('fixture');
  const legacy = prepareBattedWorldScheduledFieldAcquisition({ response: f.response, geometry: f.geometry, field: first.field });
  const progress = advanceBattedWorldScheduledFieldAcquisition({ plan: legacy, previous: null, throughElapsedSeconds: .02 });
  const plan = bridgeBattedWorldPiecewiseFieldAcquisitionPlan({ plan: legacy, progress });
  const step = retained(progress.world.moment.elapsedSeconds);
  const bridged = deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [step] });
  const steps: WholePlayHistoryStep[] = [first,
    { source: historySource(1), previousSourceId: null, kind: 'acquisition_plan', basis: first.source, horizon: legacy.contactMoment, plan: legacy },
    { source: historySource(2), previousSourceId: historySource(1).sourceId, kind: 'acquisition_advance', planSourceId: historySource(1).sourceId,
      field: first.field, progress },
    { source: historySource(3), previousSourceId: historySource(2).sourceId, kind: 'owned_motion_v2', startCursor: null,
      mode: 'retained', field: first.field, operation: { kind: 'acquisition', planSourceId: historySource(1).sourceId,
        previousStepSourceIds: [], bridge: { legacyPlanSourceId: historySource(1).sourceId, previousAdvanceSourceId: historySource(2).sourceId },
        step, plan, progress: bridged } }];
  const result = deriveCanonicalWholePlayHistory({ ...input, steps });
  expect(result.horizon).toEqual(progress.world.moment);
  expect(result.frames.flatMap(f => f.occurrences).filter(o => o.phase === 'acquisition_constraint_started')).toHaveLength(1);
  const bad = structuredClone(steps), last = bad.at(-1)!;
  if (last.kind !== 'owned_motion_v2' || !last.operation || !last.operation.bridge) throw new Error('fixture');
  (last.operation.bridge as { previousAdvanceSourceId: string }).previousAdvanceSourceId = historySource(1).sourceId;
  expect(() => deriveCanonicalWholePlayHistory({ ...input, steps: bad })).toThrow(/bridge/);
});

it('rejects owned retained ordinary history beyond accepted actor coverage', () => {
  const x = ownedCapture(), before = deriveCanonicalWholePlayHistory({ ...x.input, steps: x.steps });
  const field = advanceBattedWorldFieldMotionCheckpoint({ response: x.f.response, geometry: x.f.geometry,
    cursor: before.cursor!, actors: x.first.field.motion.actors, carrierPlayerId: 'carrier', checkpointThroughTick: 100_000 });
  const future = { ...field.motion.world.moment, elapsedSeconds: 6, ball: { ...field.motion.world.moment.ball, tick: 6_000_000 } };
  const cursor = { ...field.motion.cursor!, moment: future };
  const forged = { ...field, motion: { ...field.motion, world: { kind: 'moving' as const, moment: future, throughTick: future.ball.tick },
    cursor, response: { kind: 'carried' as const, cursor } } };
  const source = historySource(4), previousSourceId = historySource(3).sourceId;
  const owned: WholePlayHistoryStep = { source, previousSourceId, kind: 'owned_motion_v2', startCursor: before.cursor,
    mode: 'retained', field: forged, operation: null };
  expect(deriveCanonicalWholePlayHistory({ ...x.input, steps: [...x.steps, { ...owned, field }] }).horizon).toEqual(field.motion.world.moment);
  expect(() => deriveCanonicalWholePlayHistory({ ...x.input, steps: [...x.steps, owned] })).toThrow(/coverage/);
  const legacy: WholePlayHistoryStep = { source, previousSourceId, kind: 'retained_motion_checkpoint_v1', startCursor: before.cursor!, field: forged };
  expect(() => deriveCanonicalWholePlayHistory({ ...x.input, steps: [...x.steps, legacy] })).toThrow(/coverage/);
});
