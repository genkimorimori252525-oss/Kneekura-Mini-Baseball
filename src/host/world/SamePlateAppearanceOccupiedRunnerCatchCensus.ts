import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalEpisode';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
/** Every original runner owns a separate response and actual motor adoption.
 * Preserve future reaction and controller deadlines; receipt is never adoption. */
export const deriveSamePaOccupiedRunnerCatchCensus = (fields: readonly Field[]) => {
  const root = fields[0], last = fields.at(-1);
  if (!root || root.kind !== 'same_pa_physical_field_root_v1' || !last) throw new Error('occupied response census requires original field prefix');
  const at = last.field.motion.world.moment, p = root.response.world.parameters;
  const due = (t: number): 'due' | 'future' => (t-at.originTick)/p.ticksPerSecond <= at.elapsedSeconds ? 'due' : 'future';
  const responses = fields.flatMap((field,index) => {
    if (field.kind !== 'same_pa_physical_field_step_v1' || field.actionResult?.kind !== 'occupied_runner_catch_response_v1') return [];
    const response = field.actionResult, source = field.source.action, responseReference = reference('pa_physical_v1_field_steps', field);
    if (source?.kind !== response.kind || !index || json(field.field) !== json(fields[index-1].field)
      || source.member.playerId !== response.playerId || json(source.catchWorkReference) !== json(response.catchWorkReference)
      || json(source.holdReference) !== json(response.holdReference) || json(source.intent) !== json(response.intent)
      || source.intent.issuedTick !== field.evaluationTick || source.endTick !== response.endTick
      || response.reactionTick !== response.intent.issuedTick + response.originalHold.model.source.motion.reactionDelayTicks
      || json(reference('world_same_pa_occupied_runner_holds', response.originalHold)) !== json(response.holdReference)
      || response.endTick > response.originalHold.source.coverageThroughTick)
      throw new Error('occupied response census original response differs');
    const executions = fields.slice(index+1).flatMap(f => f.kind === 'same_pa_physical_field_step_v1' && f.actionResult?.kind === 'occupied_runner_catch_motion_v1'
      && json(f.actionResult.responseReference) === json(responseReference) ? [f] : []);
    for (const f of executions) {
      const a = f.source.action, r = f.actionResult;
      if (a?.kind !== 'occupied_runner_catch_motion_v1' || r?.kind !== a.kind || json(a.responseReference) !== json(responseReference)
        || r.playerId !== response.playerId || r.planThroughTick !== response.endTick || r.coverageThroughTick > response.endTick
        || f.field.motion.world.moment.elapsedSeconds < field.field.motion.world.moment.elapsedSeconds)
        throw new Error('occupied response census original motor differs');
    }
    const first = executions.find(f => f.field.motion.world.moment.elapsedSeconds > field.field.motion.world.moment.elapsedSeconds);
    const work = first ? [
      ...(due(response.reactionTick) === 'future' ? [{ kind: 'reaction' as const, dueTick: response.reactionTick, due: 'future' as const }] : []),
      { kind: 'controller_end' as const, dueTick: response.endTick, due: due(response.endTick) },
    ] : [{ kind: 'adoption' as const, dueTick: response.intent.issuedTick, due: due(response.intent.issuedTick) }];
    return [{ responseReference, response, work, consumer: first ? { consumerReference: reference('pa_physical_v1_field_steps', first),
      at: { originTick: at.originTick, elapsedSeconds: first.field.motion.world.moment.elapsedSeconds, tick: first.evaluationTick } } : null }];
  });
  if (new Set(responses.map(r => r.response.playerId)).size !== responses.length
    || fields.some(f => f.kind === 'same_pa_physical_field_step_v1' && f.actionResult?.kind === 'occupied_runner_catch_motion_v1'
      && !responses.some(r => json(r.responseReference) === json(f.actionResult?.kind === 'occupied_runner_catch_motion_v1' ? f.actionResult.responseReference : null))))
    throw new Error('occupied response census motor has no unique original response');
  return freeze({ pending: responses.filter(r => !r.consumer).map(({consumer: _, ...r}) => r),
    adopted: responses.flatMap(({consumer, ...r}) => consumer ? [{...r, ...consumer}] : []) });
};
