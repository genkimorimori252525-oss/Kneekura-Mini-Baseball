import { deriveSamePaRunnerControllerMotion } from './SamePlateAppearanceRunnerControllerMotion';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
/** Execute an analytic piece of the independently accepted received hold.
 * Delayed reaction and braking remain the existing runner controller's law. */
export const deriveSamePaBatterCatchMotion = (source: SamePaPhysicalFieldStepSource, root: SamePaPhysicalFieldRoot, previous: Field, prefix: readonly Field[]) => {
  const a = source.action;
  if (a?.kind !== 'batter_catch_motion_v1') throw new Error('received batter motor Source missing');
  const response = [...prefix].reverse().find(f => f.kind === 'same_pa_physical_field_step_v1' && f.actionResult?.kind === 'batter_catch_response_v1');
  if (!response || response.kind !== 'same_pa_physical_field_step_v1' || response.actionResult?.kind !== 'batter_catch_response_v1'
    || json(reference('pa_physical_v1_field_steps', response)) !== json(a.responseReference)) throw new Error('received batter motor requires its latest original response');
  const r = response.actionResult;
  const prior = prefix.some(f => f.kind === 'same_pa_physical_field_step_v1' && f.actionResult?.kind === 'batter_catch_motion_v1'
    && json(f.actionResult.responseReference) === json(a.responseReference));
  if (!prior && previous.evaluationTick !== r.controller.basis.tick) throw new Error('received batter motor cannot treat an unexecuted response as prior motion');
  const value = deriveSamePaRunnerControllerMotion({ root, previous, prefix, throughTick: source.throughTick, controller: r.controller,
    runnerMotionParameters: r.parameters, body: r.body, rootHeightMeters: r.rootHeightMeters });
  return freeze({ field: value.field, evaluationTick: value.evaluationTick, timeline: value.timeline,
    actionResult: { kind: a.kind, responseReference: a.responseReference, playerId: r.playerId, controllerSegmentIndex: value.controllerSegmentIndex,
      coverageThroughTick: value.coverageThroughTick, planThroughTick: value.planThroughTick } });
};
