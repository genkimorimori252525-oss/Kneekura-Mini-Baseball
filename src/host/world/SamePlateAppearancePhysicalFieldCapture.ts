import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { prepareBattedWorldScheduledFieldAcquisition, advanceBattedWorldScheduledFieldAcquisition } from '../../core/sim/ball/BattedWorldScheduledFieldAcquisition';
import type { BattedWorldFieldMotion } from '../../core/sim/ball/BattedWorldFieldMotion';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import type { SamePaPhysicalFieldActionResult } from './SamePlateAppearancePhysicalFieldAction';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
/** Native supplies the original owned candidate and immediate predecessor. The
 * Core kernel alone decides dissipation, fence completion and possession. */
export const deriveSamePaPhysicalFieldCapture = (source: SamePaPhysicalFieldStepSource, root: SamePaPhysicalFieldRoot,
  previous: SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep, candidate: SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep) => {
  const a = source.action;
  if (a?.kind !== 'capture_checkpoint_v1' || root.physicalPitchSourceId !== previous.physicalPitchSourceId
    || candidate.physicalPitchSourceId !== root.physicalPitchSourceId) throw new Error('physical capture original scope differs');
  const prior = previous.kind === 'same_pa_physical_field_step_v1' && previous.actionResult?.kind === 'capture_checkpoint_v1' ? previous.actionResult : null;
  if (prior ? json(prior.candidateReference) !== json(a.candidateReference) : json(reference(previous.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', previous)) !== json(a.candidateReference)) throw new Error('physical capture original candidate or progress differs');
  const plan = prepareBattedWorldScheduledFieldAcquisition({ response: root.response, geometry: root.geometry, field: candidate.field });
  if (source.throughTick !== quantizeEventTick(plan.contactMoment.originTick, a.throughElapsedSeconds, root.response.world.parameters.ticksPerSecond)) throw new Error('physical capture exact horizon differs');
  const progress = advanceBattedWorldScheduledFieldAcquisition({ plan, previous: prior?.progress ?? null, throughElapsedSeconds: a.throughElapsedSeconds });
  const secured = progress.kind === 'secured';
  const field: BattedWorldFieldMotion = { motion: { actors: candidate.field.motion.actors, carrierPlayerId: secured ? plan.acquirerPlayerId : null,
    world: progress.world, cursor: progress.cursor,
    response: secured ? { kind: 'carried', cursor: progress.cursor } : { kind: progress.kind === 'interrupted' ? 'capture_interrupted' : 'capture_pending', cursor: null } }, baseContacts: progress.baseContacts };
  const actionResult: SamePaPhysicalFieldActionResult = { kind: 'capture_checkpoint_v1', candidateReference: a.candidateReference, progress };
  return freeze({ field, actionResult, evaluationTick: progress.world.moment.ball.tick, timeline: previous.timeline });
};
