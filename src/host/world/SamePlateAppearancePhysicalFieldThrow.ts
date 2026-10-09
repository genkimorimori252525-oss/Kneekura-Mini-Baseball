import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { prepareBattedWorldScheduledFieldThrow, advanceBattedWorldScheduledFieldThrow } from '../../core/sim/ball/BattedWorldScheduledFieldThrow';
import type { SamePaPhysicalAction, SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import type { SamePaPhysicalFieldActionResult } from './SamePlateAppearancePhysicalFieldAction';
import type { SamePaFieldThrowValues } from './SamePlateAppearanceLifecycleCalibrationSource';
import type { DurablePlayerFieldingModel } from './SqlitePlayerFieldingModelStore';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
const result = (field: Field) => field.kind === 'same_pa_physical_field_step_v1' ? field.actionResult : undefined;
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('physical throw original dependency differs'); };
/** Sensory work does not retire a transfer. Only its own next Core checkpoint
 * can adopt physical progress until it has released or hit a real boundary. */
export const samePaPhysicalPendingThrow = (prefix: readonly Field[]) => {
  const last = [...prefix].reverse().find(f => { const r = result(f); return r?.kind !== 'defender_observation_v1' && r?.kind !== 'defender_decision_v1' && r?.kind !== 'defender_catch_response_v1' && r?.kind !== 'batter_catch_response_v1' && r?.kind !== 'occupied_runner_catch_response_v1'; });
  if (!last || last.kind !== 'same_pa_physical_field_step_v1') return null;
  const r = last.actionResult;
  if (r?.kind === 'throw_plan_v1') return { step: last, plan: r.plan, progress: null };
  if (r?.kind !== 'throw_checkpoint_v1' || r.progress.kind !== 'transfer') return null;
  const plan = prefix.find(f => f.kind === 'same_pa_physical_field_step_v1' && f.source.sourceId === r.planReference.sourceId);
  if (!plan || plan.kind !== 'same_pa_physical_field_step_v1' || plan.actionResult?.kind !== 'throw_plan_v1') throw new Error('physical pending transfer original plan missing');
  same(reference('pa_physical_v1_field_steps', plan), r.planReference);
  return { step: plan, plan: plan.actionResult.plan, progress: r.progress };
};
export const assertSamePaPhysicalThrowOwnership = (source: SamePaPhysicalFieldStepSource, prefix: readonly Field[]): void => {
  const pending = samePaPhysicalPendingThrow(prefix), a = source.action;
  if (pending && a?.kind !== 'throw_checkpoint_v1' && a?.kind !== 'defender_observation_v1' && a?.kind !== 'defender_decision_v1' && a?.kind !== 'defender_catch_response_v1') {
    throw new Error('physical pending transfer owns field progress');
  }
  if (a?.kind === 'throw_checkpoint_v1') {
    if (!pending) throw new Error('physical throw checkpoint requires pending transfer');
    same(a.planReference, reference('pa_physical_v1_field_steps', pending.step));
  }
};
export const samePaPhysicalHasThrowRelease = (prefix: readonly Field[]): boolean => prefix.some(f => {
  const r = result(f); return r?.kind === 'throw_checkpoint_v1' && r.progress.kind === 'released';
});
/** Retain every owned acceleration and the original fielding ratings. The two
 * effective parameter groups come only from the accepted current-view Source. */
export const deriveSamePaPhysicalThrowPlan = (source: SamePaPhysicalFieldStepSource, root: SamePaPhysicalFieldRoot,
  previous: Field, action: SamePaPhysicalAction, model: DurablePlayerFieldingModel, values: SamePaFieldThrowValues) => {
  const a = source.action, motion = previous.field.motion;
  if (a?.kind !== 'throw_plan_v1' || root.physicalPitchSourceId !== previous.physicalPitchSourceId || root.physicalPitchSourceId !== action.physicalPitchSourceId
    || source.throughTick !== previous.evaluationTick || !motion.cursor || motion.response.kind !== 'carried'
    || motion.carrierPlayerId !== a.member.playerId || model.source.playerId !== a.member.playerId) throw new Error('physical throw requires the actual owned carrier cut');
  if (!action.actor.defenderBindings.some(b => b.playerId === a.receiverPlayerId)
    || a.coverageThroughTick > Math.min(...motion.actors.map(actor => actor.primitive.endTick))) throw new Error('physical throw original receiver or coverage differs');
  const plan = prepareBattedWorldScheduledFieldThrow({ response: root.response, geometry: root.geometry, actors: motion.actors, cursor: motion.cursor,
    carrierPlayerId: a.member.playerId, receiverPlayerId: a.receiverPlayerId, availableAtTick: previous.evaluationTick, throughTick: a.coverageThroughTick,
    commands: motion.actors.map(actor => ({ playerId: actor.playerId, role: actor.primitive.role, acceleration: actor.primitive.acceleration })),
    ratings: model.source.ratings, transferParameters: values.transferParameters, throwCalibration: values.throwCalibration,
    seed: { matchSeed: action.source.nominalPitch.delivery.matchSeed, playId: root.lineage.playId, streamKey: source.sourceId } });
  const actionResult: SamePaPhysicalFieldActionResult = { kind: 'throw_plan_v1', plan, fieldingModelHash: hash(model) };
  return freeze({ field: previous.field, evaluationTick: previous.evaluationTick, timeline: previous.timeline, actionResult });
};
export const deriveSamePaPhysicalThrowCheckpoint = (source: SamePaPhysicalFieldStepSource, root: SamePaPhysicalFieldRoot,
  previous: Field, prefix: readonly Field[]) => {
  assertSamePaPhysicalThrowOwnership(source, prefix);
  const a = source.action, pending = samePaPhysicalPendingThrow(prefix);
  if (a?.kind !== 'throw_checkpoint_v1' || !pending || root.physicalPitchSourceId !== previous.physicalPitchSourceId
    || pending.step.physicalPitchSourceId !== root.physicalPitchSourceId) throw new Error('physical throw checkpoint original scope differs');
  same(previous.field, pending.progress?.field ?? pending.step.field);
  if (source.throughTick !== quantizeEventTick(pending.plan.input.cursor.moment.originTick, a.throughElapsedSeconds,
    root.response.world.parameters.ticksPerSecond)) throw new Error('physical throw exact horizon differs');
  const progress = advanceBattedWorldScheduledFieldThrow({ plan: pending.plan, previous: pending.progress, throughElapsedSeconds: a.throughElapsedSeconds });
  const actionResult: SamePaPhysicalFieldActionResult = { kind: 'throw_checkpoint_v1', planReference: a.planReference, progress };
  return freeze({ field: progress.field, evaluationTick: progress.field.motion.world.moment.ball.tick, timeline: previous.timeline, actionResult });
};
