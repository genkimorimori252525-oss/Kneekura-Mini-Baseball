import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
/** Once its original hold choice is admitted, the first physical continuation
 * must adopt that controller at the same cut. Unrelated progress must not strand
 * it behind a newer body state or replay the superseded advance command. */
export const assertSamePaBatterCatchOwnership = (source: SamePaPhysicalFieldStepSource, prefix: readonly Field[]) => {
  const response = [...prefix].reverse().find(f => f.kind === 'same_pa_physical_field_step_v1' && f.actionResult?.kind === 'batter_catch_response_v1');
  if (!response) return;
  if (source.action?.kind === 'batter_run_motion_v1') throw new Error('received batter response supersedes the original advance controller');
  const responseReference = reference('pa_physical_v1_field_steps', response);
  const adopted = prefix.some(f => f.kind === 'same_pa_physical_field_step_v1' && f.actionResult?.kind === 'batter_catch_motion_v1'
    && json(f.actionResult.responseReference) === json(responseReference)
    && f.field.motion.world.moment.elapsedSeconds > response.field.motion.world.moment.elapsedSeconds);
  const kind = source.action?.kind;
  if (!adopted && kind !== 'batter_catch_motion_v1' && kind !== 'defender_observation_v1' && kind !== 'defender_decision_v1' && kind !== 'defender_catch_response_v1')
    throw new Error('received batter response owns the first physical motor cut');
};
