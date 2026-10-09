import { expect } from 'vitest';
import type { samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import type { DurableBattingInvocationPosture } from './NativeBattingPerception';
import { samplePiecewiseFieldActor } from '../../core/sim/ball/BattedWorldPiecewiseFieldMotion';
import { input as runnerFixture } from './PrePitchRunnerFixtures.test-support';
import { openSqlitePlayerRunnerDecisionMotionModelStore, type AcceptedPlayerRunnerDecisionMotionModel } from './SqlitePlayerRunnerDecisionMotionModelStore';
import { openSqlitePlayerBatterRunTransitionModelStore } from './SqlitePlayerBatterRunTransitionModelStore';
import { openSqliteBatterSwingExitStateStore } from './SqliteBatterSwingExitStateStore';
import { openSqliteBatterRunPlanStore } from './SqliteBatterRunPlanStore';
import type { AcceptedPlayerBatterRunTransitionModel } from './PlayerBatterRunTransitionModel';
import type { AcceptedBatterSwingExitState } from './BatterSwingExitState';
import type { AcceptedBatterRunPlan } from './BatterRunPlan';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { readSamePaAdmittedLiveWorkFromSqlite } from './SamePlateAppearanceAdmittedLiveWorkFromSqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';

/** Extend IFN01's same genuine chain by one covered tick. All numerical model
 * declarations reuse explicit runner/recovery fixtures. The separately accepted
 * aligned facing and advance intention are synthetic inputs, never deductions
 * from the swing, bat axis or contact outcome. No foreign command is renewed. */
export const appendNativeBatterRunCheckpoint = (h: ReturnType<typeof samePaPhysicalLifecycleFixture>, root: SamePaPhysicalFieldRoot,
  previous: SamePaPhysicalFieldStep, posture: DurableBattingInvocationPosture, label: string) => {
  const { f } = h, binding = f.actor.binding, track = f.x.f.track, moment = previous.field.motion.world.moment;
  const throughTick = previous.evaluationTick + 1, endTick = throughTick + 1;
  expect(previous.field.motion.cursor).not.toBeNull();
  expect(endTick).toBeLessThanOrEqual(Math.min(...previous.field.motion.actors.map(a => a.primitive.endTick)));
  const modelSource: AcceptedPlayerRunnerDecisionMotionModel = { sourceId: label + ':runner-model', sourceVersion: 'explicit-existing-core-fixture-v1',
    capability: 'runner_decision_motion_v1', careerId: binding.careerId, playerId: binding.playerId, personLinkSourceId: binding.personLinkSourceId,
    acceptedAtDay: binding.gameDay, decision: { minimumCueConfidence: 0.5, coachTrust: 1, minimumAdvanceSafetyMarginTicks: 50_000, decisionAbility: 0.8,
      timingParameters: { minimumDecisionDelayTicks: 30_000, maximumDecisionDelayTicks: 180_000, fixedRecognitionOffsetTicks: 10_000 } }, motion: runnerFixture().parameters };
  const runner = track(openSqlitePlayerRunnerDecisionMotionModelStore(f.path, { readAcceptedModel: id => id === modelSource.sourceId ? modelSource : null })).accept(modelSource.sourceId);
  const recoverySource: AcceptedPlayerBatterRunTransitionModel = { sourceId: label + ':recovery-model', sourceVersion: 'explicit-existing-core-fixture-v1',
    capability: 'batter_run_transition_model_v1', careerId: binding.careerId, playerId: binding.playerId, personLinkSourceId: binding.personLinkSourceId,
    acceptedAtDay: binding.gameDay, runnerModelReference: reference('world_player_runner_decision_motion_models', runner),
    parameters: { ticksPerSecond: runner.source.motion.ticksPerSecond, maximumBodyTurnRateRadiansPerSecond: Math.PI,
      lateralRealignmentAccelerationMps2: 4, backwardRecoveryAccelerationMps2: 3 } };
  const recovery = track(openSqlitePlayerBatterRunTransitionModelStore(f.path, { readAcceptedModel: id => id === recoverySource.sourceId ? recoverySource : null })).accept(recoverySource.sourceId);
  const actor = previous.field.motion.actors.find(a => a.playerId === binding.playerId && a.primitive.role === 'body');
  const shape = posture.model.bodyMaterialization.actor.primitives.find(p => p.role === 'body');
  if (!actor || !shape) throw new Error('IFN01 original batter body is missing');
  const before = samplePiecewiseFieldActor(actor, moment), start = { x: before.center.x - shape.offset.x, z: before.center.z - shape.offset.z };
  const first = root.geometry.baseGeometry.bases.first.region.center, delta = { x: first.x - start.x, z: first.z - start.z }, distance = Math.hypot(delta.x, delta.z);
  expect(distance).toBeGreaterThan(0);
  const stateSource: AcceptedBatterSwingExitState = { sourceId: label + ':exit-state', sourceVersion: 'explicit-aligned-facing-fixture-v1',
    capability: 'same_pa_batter_swing_exit_state_v1', fieldReference: reference('pa_physical_v1_field_steps', previous),
    transitionModelReference: reference('world_player_batter_run_transition_models', recovery), bodyForwardUnit: { x: delta.x / distance, z: delta.z / distance } };
  const state = track(openSqliteBatterSwingExitStateStore(f.path, { readAcceptedState: id => id === stateSource.sourceId ? stateSource : null })).accept(stateSource.sourceId);
  expect(state.state.planarVelocity).toEqual({ x: 0, z: 0 }); expect(state.motionIssued).toBe(false);
  const source: AcceptedBatterRunPlan = { sourceId: label + ':issued-plan', sourceVersion: 'explicit-advance-fixture-v1', capability: 'same_pa_batter_run_plan_v1',
    viewReference: h.current().viewReference, physicalPitchReference: previous.source.launchReference, exitStateReference: reference('world_batter_swing_exit_states', state),
    playerId: binding.playerId, personId: binding.personId, route: { segments: [{ kind: 'line', start, end: { x: start.x + 2 * delta.x, z: start.z + 2 * delta.z } }] },
    intent: { kind: 'advance', issuedTick: previous.evaluationTick }, endTick, provenance: { sourceRecordId: label + ':independent-intent', sourceVersion: 'fixture-v1' } };
  const owner = track(openSqliteBatterRunPlanStore(f.path, { readAcceptedPlan: id => id === source.sourceId ? source : null })), plan = owner.accept(source.sourceId);
  const planReference = reference('world_batter_run_plans', plan); h.advance(planReference);
  expect(plan.plan.motionExecuted).toBe(false);
  const previousReference = reference('pa_physical_v1_field_steps', previous);
  const stepSource: SamePaPhysicalFieldStepSource = h.save({ sourceId: label + ':checkpoint', sourceVersion: 'fixture-v1', capability: 'same_pa_physical_field_step_v1',
    viewReference: h.current().viewReference, launchReference: previous.source.launchReference, previousOperationReference: previousReference,
    fieldRootReference: reference('pa_physical_v1_field_roots', root), previousFieldReference: previousReference, throughTick,
    action: { kind: 'batter_run_motion_v1', planReference } });
  const moved = h.physical.acceptOperation(stepSource.sourceId);
  if (moved.kind !== 'same_pa_physical_field_step_v1' || moved.actionResult?.kind !== 'batter_run_motion_v1') throw new Error('IFN01 real batter motion is pending');
  expect(moved.evaluationTick).toBe(throughTick); expect(moved.field.motion.actors).toHaveLength(50);
  const afterActor = moved.field.motion.actors.find(a => a.playerId === binding.playerId && a.primitive.role === 'body')!;
  const after = samplePiecewiseFieldActor(afterActor, moved.field.motion.world.moment);
  expect(Math.hypot(after.center.x - before.center.x, after.center.z - before.center.z)).toBeGreaterThan(0);
  expect(Math.hypot(after.velocity.x, after.velocity.z)).toBeGreaterThan(0);
  const movedReference = reference('pa_physical_v1_field_steps', moved); h.advance(movedReference);
  const census = withSqliteReadTransaction(f.db, () => readSamePaAdmittedLiveWorkFromSqlite(f.db, h.current().viewReference, 'current'));
  if (census.kind !== 'same_pa_live_work_read_v1') throw new Error('IFN01 batter run census is pending');
  expect(census.census.runnerPlans).toHaveLength(1);
  expect(census.census.runnerPlans[0]).toMatchObject({ planReference, plannedThroughTick: endTick, status: 'pending_motion' });
  expect(census.census.runnerPlans[0].executions.map(e => e.reference)).toEqual([movedReference]);
  expect(census.closure.physicalEnd).toBeNull();
  owner.close();
  const reopened = track(openSqliteBatterRunPlanStore(f.path));
  const rows = f.db.prepare('SELECT rowid,* FROM world_batter_run_plans').all();
  expect(reopened.read(source.sourceId)).toEqual(plan); expect(reopened.accept(source.sourceId)).toEqual(plan);
  expect(f.db.prepare('SELECT rowid,* FROM world_batter_run_plans').all()).toEqual(rows);
  expect(h.physical.readOperation(movedReference).record).toEqual(moved);
  return { state, plan, moved, census };
};
