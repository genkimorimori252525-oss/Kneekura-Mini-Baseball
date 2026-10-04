import { ownedScheduledMotionActualState } from './OwnedScheduledMotionState';
import type { DefensiveDb } from './ActualDefensiveContext';
import type { ActualPlayerKinematicsCut, OwnedActualPlayerKinematics } from './SqliteActualPlayerKinematicsReader';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite } from './SqliteBattedWorldFieldExecutionStore';
import { actorFreeze as freeze, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** A local physical admission fence, not a second execution owner. Replays only the pinned
 * original prefix and applies the existing execution owner's pending-operation/cursor rules. */
export const actualLocomotionPhysicalAvailabilityFromSqlite = (db: DefensiveDb, cut: ActualPlayerKinematicsCut,
  self: Pick<OwnedActualPlayerKinematics, 'at'>) => {
  const base = battedWorldFieldEvidenceFromSqlite(db).read(cut.baseFieldSourceId);
  if (!base) throw new Error('actual locomotion original field is missing');
  const tables = db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('batted_world_field_executions','batted_world_field_execution_heads')").get()!;
  if (tables.n !== 0 && tables.n !== 2) throw new Error('actual locomotion physical owner tables differ');
  const prefix = tables.n === 2 ? battedWorldFieldExecutionEvidenceFromSqlite(db).scope(base, cut.executionSourceId) : [];
  if ((prefix.at(-1)?.source.sourceId ?? null) !== cut.executionSourceId) throw new Error('actual locomotion original physical cut differs');
  const reversed = [...prefix].reverse();
  const metadataOnly = ['whole_play_history', 'base_touch_history', 'first_base_race', 'throw_plan', 'acquisition_plan',
    'owned_acquisition_plan_v1', 'owned_throw_plan_v1'];
  const physical = reversed.find(v => !metadataOnly.includes(v.execution.kind));
  const newPlan = reversed.find(v => v.execution.kind === 'owned_acquisition_plan_v1' || v.execution.kind === 'owned_throw_plan_v1');
  // Only a new operation or its explicitly executed bridge opens the operation-aware
  // motor seam. An old pending prefix retains its original refusal below.
  if (physical?.execution.kind === 'owned_motion_v2' || newPlan && newPlan.revision > (physical?.revision ?? 0)) {
    const state = ownedScheduledMotionActualState(base.field, prefix);
    const operation = physical?.execution.kind === 'owned_motion_v2' ? physical.execution.operation : null;
    const constrained = operation?.kind === 'acquisition'
      && (operation.progress.kind === 'capturing' || operation.progress.kind === 'fence_pending');
    if (!state.cursor && !constrained) throw new Error('actual locomotion blocked by unresolved owned physical contact');
    const actual = state.cursor?.moment ?? state.moment;
    const at = { originTick: actual.originTick, elapsedSeconds: actual.elapsedSeconds, tick: actual.ball.tick };
    if (at.originTick !== self.at.originTick || at.elapsedSeconds !== self.at.elapsedSeconds || at.tick !== self.at.tick) {
      throw new Error('actual locomotion actual owned moment differs from self cut');
    }
    const coverageThroughTick = Math.min(...state.actors.map(a => a.primitive.endTick));
    const ticksPerSecond = base.response.touch.worldContact.flight.source.execution.ballFlightParameters.ticksPerSecond;
    if ((coverageThroughTick - at.originTick) / ticksPerSecond <= at.elapsedSeconds) {
      throw new Error('actual locomotion owned physical coverage is expired');
    }
    const pending = newPlan && newPlan.revision > (physical?.revision ?? 0) && newPlan.execution.kind === 'owned_throw_plan_v1'
      ? { planSourceId: newPlan.source.sourceId, plan: newPlan.execution.plan, phase: 'transfer' as const,
        stepSourceId: null, dueElapsedSeconds: newPlan.execution.plan.releaseElapsedSeconds }
      : operation?.kind === 'acquisition' && (operation.progress.kind === 'capturing' || operation.progress.kind === 'fence_pending')
        ? { planSourceId: operation.planSourceId, plan: operation.plan, phase: operation.progress.kind,
          stepSourceId: physical!.source.sourceId, dueElapsedSeconds: operation.progress.kind === 'capturing'
            ? operation.plan.secureElapsedSeconds : operation.plan.fenceElapsedSeconds }
        : operation?.kind === 'throw' && operation.progress.kind === 'transfer'
          ? { planSourceId: operation.planSourceId, plan: operation.plan, phase: 'transfer' as const,
            stepSourceId: physical!.source.sourceId, dueElapsedSeconds: operation.plan.releaseElapsedSeconds } : null;
    if (pending && pending.dueElapsedSeconds <= at.elapsedSeconds) throw new Error('actual locomotion due owned physical transition must execute first');
    const proof = { at, owner: physical ? 'batted_world_field_executions' as const : 'batted_world_field_actions' as const,
      lastPhysicalSourceId: physical?.source.sourceId ?? base.source.sourceId,
      lastPhysicalSourceHash: hash(physical?.source ?? base.source) };
    if (pending) {
      const original = prefix.find(v => v.source.sourceId === pending.planSourceId);
      if (!original) throw new Error('actual locomotion owned operation original plan is missing');
      return freeze({ status: 'owned_scheduled_operation_at_original_cut_v1' as const, ...proof,
        planSourceId: pending.planSourceId, planSourceHash: hash(original.source), planHash: hash(pending.plan),
        stepSourceId: pending.stepSourceId, phase: pending.phase });
    }
    return freeze({ status: 'unblocked_at_original_cut' as const, ...proof });
  }
  const transfer = reversed.find(v => v.execution.kind === 'throw_plan');
  const transferAdvance = transfer && reversed.find(v => v.execution.kind === 'throw_advance' && v.execution.planSourceId === transfer.source.sourceId);
  if (transfer && (!transferAdvance || transferAdvance.execution.kind === 'throw_advance' && transferAdvance.execution.progress.kind === 'transfer')) {
    throw new Error('actual locomotion blocked by pending scheduled transfer');
  }
  const capture = reversed.find(v => v.execution.kind === 'acquisition_plan');
  const captureAdvance = capture && reversed.find(v => v.execution.kind === 'acquisition_advance' && v.execution.planSourceId === capture.source.sourceId);
  if (capture && (!captureAdvance || captureAdvance.execution.kind === 'acquisition_advance'
    && (captureAdvance.execution.progress.kind === 'capturing' || captureAdvance.execution.progress.kind === 'fence_pending'))) {
    throw new Error('actual locomotion blocked by pending scheduled acquisition');
  }
  let cursor = (prefix.at(-1)?.execution.field ?? base.field).motion.cursor;
  if (physical?.execution.kind === 'acquisition') {
    const a = physical.execution.acquisition;
    if (a.kind !== 'secured') throw new Error('actual locomotion blocked by unresolved acquisition');
    cursor = { moment: a.moment, previousContacts: [{ kind: 'actor', playerId: a.acquirerPlayerId, role: 'glove' }] };
  } else if (physical?.execution.kind === 'acquisition_advance') {
    if (physical.execution.progress.kind !== 'secured') throw new Error('actual locomotion blocked by unresolved scheduled acquisition');
    cursor = physical.execution.progress.cursor;
  }
  if (!cursor) throw new Error('actual locomotion blocked by unresolved physical contact');
  const at = { originTick: cursor.moment.originTick, elapsedSeconds: cursor.moment.elapsedSeconds, tick: cursor.moment.ball.tick };
  if (at.originTick !== self.at.originTick || at.elapsedSeconds !== self.at.elapsedSeconds || at.tick !== self.at.tick) {
    throw new Error('actual locomotion actual cursor differs from self cut');
  }
  return freeze({ status: 'unblocked_at_original_cut' as const, at,
    owner: physical ? 'batted_world_field_executions' as const : 'batted_world_field_actions' as const,
    lastPhysicalSourceId: physical?.source.sourceId ?? base.source.sourceId,
    lastPhysicalSourceHash: hash(physical?.source ?? base.source) });
};
