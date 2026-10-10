import { assertSamePaBatterRecoveryComplete } from './SamePlateAppearanceBatterRecoveryMotion';
import { buildRunnerMotionTrajectoryAtExactOrigin } from '../../core/sim/running/RunnerMotion';
import { deriveSamePaRunnerControllerMotion } from './SamePlateAppearanceRunnerControllerMotion';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import type { SamePaPhysicalFieldActionResult } from './SamePlateAppearancePhysicalFieldAction';
import type { DurableBatterRunPlan } from './SqliteBatterRunPlanStore';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('physical batter-run original binding differs'); };
const fieldRef = (f: Field) => reference(f.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', f);
/** Adopt one existing analytic runner piece into the actual five-part world.
 * This supported binding translates an unchanged pose; recovery rotation and
 * articulated foot motion require their own original physical evidence. */
export const deriveSamePaBatterRunMotion = (source: SamePaPhysicalFieldStepSource, root: SamePaPhysicalFieldRoot,
  previous: Field, plan: DurableBatterRunPlan, prefix: readonly Field[]) => {
  const request = source.action, motion = previous.field.motion, moment = motion.world.moment;
  if (request?.kind !== 'batter_run_motion_v1' || !motion.cursor || source.throughTick < previous.evaluationTick
    || plan.plan.physicalBinding !== 'owned_static_pose_straight_motion' && !plan.completedRecovery) throw new Error('physical batter-run requires a supported resolved moving cut');
  same(request.planReference, reference('world_batter_run_plans', plan)); same(plan.lineage, root.lineage);
  if (plan.source.physicalPitchReference.sourceId !== root.physicalPitchSourceId || root.physicalPitchSourceId !== previous.physicalPitchSourceId
    || !prefix.some(f => json(fieldRef(f)) === json(plan.exitState.source.fieldReference))) throw new Error('physical batter-run original exit is outside the prefix');
  const timeline = plan.plan.timeline, tick = moment.ball.tick;
  const prior = prefix.some(f => f.kind === 'same_pa_physical_field_step_v1' && f.actionResult?.kind === 'batter_run_motion_v1'
    && json(f.actionResult.planReference) === json(request.planReference));
  if (!prior) {
    if (plan.completedRecovery) {
      same(assertSamePaBatterRecoveryComplete(prefix,plan.exitState,timeline.route,tick),plan.completedRecovery);
      if (tick !== timeline.postLaunchController.basis.tick) throw new Error('physical batter-run recovery launch differs');
    } else if (tick !== timeline.startTick) throw new Error('physical batter-run cannot treat an unexecuted plan as prior motion');
  }
  const body = plan.exitState.body;
  if (body.playerId !== plan.playerId || body.personId !== plan.personId) throw new Error('physical batter-run original body identity differs');
  const value = deriveSamePaRunnerControllerMotion({ root, previous, prefix, throughTick: source.throughTick,
    controller: timeline.postLaunchController, runnerMotionParameters: timeline.runnerMotionParameters,
    body, rootHeightMeters: plan.exitState.root.position.y,
    ...(plan.completedRecovery ? {exactTrajectory:buildRunnerMotionTrajectoryAtExactOrigin(timeline.launchState,timeline.postLaunchIntent,
      timeline.endTick,timeline.runnerMotionParameters,plan.completedRecovery.at)} : {}), stationaryHoldContinuations: request.stationaryHoldContinuations });
  const actionResult: SamePaPhysicalFieldActionResult = { kind: request.kind, planReference: request.planReference, playerId: plan.playerId,
    ...(plan.completedRecovery ? {completedRecoveryReference:plan.completedRecovery.recoveryReference} : {}),
    controllerSegmentIndex: value.controllerSegmentIndex, coverageThroughTick: value.coverageThroughTick, planThroughTick: value.planThroughTick,
    ...(value.exactControllerPiece === undefined ? {} : { exactControllerPiece: value.exactControllerPiece }) };
  return freeze({ field: value.field, evaluationTick: value.evaluationTick, timeline: value.timeline, actionResult });
};
