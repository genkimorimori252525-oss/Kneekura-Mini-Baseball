import type { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import type { DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import type { DurableActualLocomotion } from './SqliteActualLocomotionStore';
import { actualPlayersKinematicsFromPrefix, type ActualPlayerKinematics } from './ActualPlayerKinematicsFromPrefix';
import { ownedScheduledMotionActualState } from './OwnedScheduledMotionState';
import { ownedScheduledMotionArchiveHash } from './OwnedScheduledMotionArchive';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

const observers = new Set(['whole_play_history', 'first_base_race', 'base_touch_history']);
/** Rank proof over the physical owner's already validated predecessor, before any
 * selected motor reader is entered. A plan or zero-time physical step never qualifies. */
export const ownedScheduledMotionObserverSuffix = (prefix: readonly DurableBattedWorldFieldExecution[], originalSourceId: string | null) => {
  const rank = originalSourceId === null ? -1 : prefix.findIndex(v => v.source.sourceId === originalSourceId);
  if (originalSourceId !== null && rank < 0) throw new Error('owned motor self cut is not a strict predecessor member');
  const suffix = prefix.slice(rank + 1);
  if (suffix.some(v => !observers.has(v.execution.kind) || v.source.action.kind !== v.execution.kind)) {
    throw new Error('owned motor self cut crosses a non-observer physical or plan suffix');
  }
  return { rank, suffix };
};
type Prefix = Parameters<typeof battedWorldFieldPhysicalPrefix>[0];
const pendingIdentity = (values: readonly DurableBattedWorldFieldExecution[]) => {
  const plan = [...values].reverse().find(v => ['owned_acquisition_plan_v1', 'owned_throw_plan_v1', 'acquisition_plan', 'throw_plan'].includes(v.execution.kind));
  if (!plan) return null;
  const latest = [...values].reverse().find(v => v.execution.kind === 'owned_motion_v2' && v.execution.operation?.planSourceId === plan.source.sourceId
    || (v.execution.kind === 'acquisition_advance' || v.execution.kind === 'throw_advance') && v.execution.planSourceId === plan.source.sourceId);
  const execution = latest?.execution;
  const phase = execution?.kind === 'owned_motion_v2' ? execution.operation?.progress.kind
    : execution?.kind === 'acquisition_advance' || execution?.kind === 'throw_advance' ? execution.progress.kind : 'pending';
  if (phase === 'secured' || phase === 'released' || phase === 'interrupted') return null;
  return { planSourceId: plan.source.sourceId, planSourceHash: hash(plan.source), planSnapshotHash: ownedScheduledMotionArchiveHash(plan),
    latestStepSourceId: latest?.source.sourceId ?? null, latestStepSourceHash: latest ? hash(latest.source) : null, phase };
};
/** No caller-provided prefix facade or cached truth. Both cuts are derived from the
 * same validated bounded prefix; SQLite still rechecks every exact original row. */
export const ownedScheduledMotionMotorCutProof = (motor: DurableActualLocomotion, prefix: Prefix, currentSelves: readonly ActualPlayerKinematics[]) => {
  if (motor.source.baseFieldSourceId !== prefix.baseField.source.sourceId
    || motor.source.physicalPitchSourceId !== prefix.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId) {
    throw new Error('owned motor original field cut differs');
  }
  const { rank, suffix } = ownedScheduledMotionObserverSuffix(prefix.executions, motor.source.executionSourceId);
  const original = { ...prefix, executions: prefix.executions.slice(0, rank + 1) };
  const currentState = ownedScheduledMotionActualState(prefix.baseField.field, prefix.executions);
  const originalState = ownedScheduledMotionActualState(prefix.baseField.field, original.executions);
  const originalSelves = suffix.length ? actualPlayersKinematicsFromPrefix(currentSelves.map(s => s.playerId), original) : currentSelves;
  const operation = pendingIdentity(prefix.executions), originalOperation = pendingIdentity(original.executions);
  if (json(currentState) !== json(originalState) || json(operation) !== json(originalOperation)
    || currentSelves.length !== originalSelves.length || currentSelves.some((s, i) => json(s) !== json(originalSelves[i]))) {
    throw new Error('owned observer suffix changes exact physical state, commands, coverage or pending operation');
  }
  return freeze({ version: 'owned_motion_motor_cut_v2' as const, kind: suffix.length ? 'observer_suffix' as const : 'exact_predecessor' as const,
    baseFieldSourceId: prefix.baseField.source.sourceId, originalExecutionSourceId: motor.source.executionSourceId,
    currentExecutionSourceId: prefix.executions.at(-1)?.source.sourceId ?? null,
    observerReferences: suffix.map(v => ({ owner: 'batted_world_field_executions' as const, sourceId: v.source.sourceId,
      sourceHash: hash(v.source), snapshotHash: ownedScheduledMotionArchiveHash(v) })),
    physicalStateHash: hash(currentState), kinematicsHash: hash(currentSelves.map(s => ({ playerId: s.playerId, selfHash: hash(s) }))),
    pendingOperationHash: hash(operation) });
};
export type OwnedScheduledMotionMotorCutProof = ReturnType<typeof ownedScheduledMotionMotorCutProof>;
