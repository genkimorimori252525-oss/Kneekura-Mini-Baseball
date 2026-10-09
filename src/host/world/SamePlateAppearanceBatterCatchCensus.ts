import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalEpisode';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
/** Inventory the response and its actually executed controller pieces; a plan
 * or a received message alone never supplies an adoption receipt. */
export const deriveSamePaBatterCatchCensus = (fields: readonly Field[]) => {
  const root = fields[0], last = fields.at(-1);
  if (!root || root.kind !== 'same_pa_physical_field_root_v1' || !last) throw new Error('received batter census requires an original field prefix');
  const at = last.field.motion.world.moment, p = root.response.world.parameters;
  const due = (tick: number): 'due' | 'future' => (tick-at.originTick)/p.ticksPerSecond <= at.elapsedSeconds ? 'due' : 'future';
  const responses = fields.flatMap((field,index) => {
    if (field.kind !== 'same_pa_physical_field_step_v1' || field.actionResult?.kind !== 'batter_catch_response_v1') return [];
    const response = field.actionResult, responseReference = reference('pa_physical_v1_field_steps',field);
    const source = field.source.action;
    if (source?.kind !== response.kind || !index || json(field.field) !== json(fields[index-1].field)
      || source.member.playerId !== response.playerId || json(source.catchWorkReference) !== json(response.catchWorkReference)
      || json(source.intent) !== json(response.intent) || json(source.motionBasis) !== json(response.motionBasis)
      || response.intent.issuedTick !== field.evaluationTick || response.controller.basis.tick !== field.evaluationTick
      || response.reactionTick !== response.intent.issuedTick + response.parameters.reactionDelayTicks
      || source.endTick !== response.controller.trajectory.endState.tick)
      throw new Error('received batter census original response differs');
    const executions = fields.slice(index+1).flatMap(f => f.kind === 'same_pa_physical_field_step_v1' && f.actionResult?.kind === 'batter_catch_motion_v1'
      && json(f.actionResult.responseReference) === json(responseReference) ? [f] : []);
    for (const execution of executions) {
      const action = execution.source.action, result = execution.actionResult;
      if (action?.kind !== 'batter_catch_motion_v1' || result?.kind !== 'batter_catch_motion_v1'
        || json(action.responseReference) !== json(responseReference) || result.playerId !== response.playerId
        || result.planThroughTick !== source.endTick || execution.field.motion.world.moment.elapsedSeconds < field.field.motion.world.moment.elapsedSeconds)
        throw new Error('received batter census original motor differs');
    }
    const first = executions.find(f => f.field.motion.world.moment.elapsedSeconds > field.field.motion.world.moment.elapsedSeconds);
    const work = first ? [
      ...(due(response.reactionTick)==='future' ? [{kind:'reaction' as const,dueTick:response.reactionTick,due:'future' as const}] : []),
      {kind:'controller_end' as const,dueTick:source.endTick,due:due(source.endTick)},
    ] : [{kind:'adoption' as const,dueTick:response.intent.issuedTick,due:due(response.intent.issuedTick)}];
    return [{responseReference,response,work,consumer:first ? {consumerReference:reference('pa_physical_v1_field_steps',first),
      at:{originTick:at.originTick,elapsedSeconds:first.field.motion.world.moment.elapsedSeconds,tick:first.evaluationTick}} : null}];
  });
  const motors = fields.filter(f=>f.kind==='same_pa_physical_field_step_v1'&&f.actionResult?.kind==='batter_catch_motion_v1');
  if (responses.length > 1 || motors.some(f=>f.kind==='same_pa_physical_field_step_v1'&&f.actionResult?.kind==='batter_catch_motion_v1'
    &&!responses.some(r=>json(r.responseReference)===json(f.actionResult?.kind==='batter_catch_motion_v1'?f.actionResult.responseReference:null))))
    throw new Error('received batter census motor has no unique original response');
  return freeze({pending:responses.filter(r=>!r.consumer).map(({consumer:_,...r})=>r),
    adopted:responses.flatMap(({consumer,...r})=>consumer?[{...r,...consumer}]:[])});
};
