import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
export type SamePaExactRunnerControllerPiece = Readonly<{
  kind: 'same_pa_exact_runner_controller_piece_v1'; originTick: number;
  startedAtElapsedSeconds: number; coverageThroughElapsedSeconds: number;
}>;

/** Native supplies the rederived prefix. A later runner motor supersedes its
 * preceding piece; unrelated actor progress never retires this obligation. */
export const samePaExactRunnerControllerPieces = (prefix: readonly Field[]) => {
  const pieces = new Map<string, { playerId: string; reference: ReturnType<typeof reference>; piece: SamePaExactRunnerControllerPiece }>();
  for (const f of prefix) {
    const r = f.kind === 'same_pa_physical_field_step_v1' ? f.actionResult : undefined;
    if (r?.kind !== 'batter_recovery_motion_v1' && r?.kind !== 'batter_run_motion_v1' && r?.kind !== 'batter_catch_motion_v1' && r?.kind !== 'occupied_runner_motion_v1' && r?.kind !== 'occupied_runner_catch_motion_v1') continue;
    const piece = r.exactControllerPiece;
    if (!piece) { pieces.delete(r.playerId); continue; }
    const at = f.field.motion.world.moment, p = (prefix[0] as SamePaPhysicalFieldRoot).response.world.parameters;
    if (piece.kind !== 'same_pa_exact_runner_controller_piece_v1' || piece.originTick !== at.originTick
      || !Number.isFinite(piece.startedAtElapsedSeconds) || piece.startedAtElapsedSeconds < 0
      || !Number.isFinite(piece.coverageThroughElapsedSeconds) || piece.coverageThroughElapsedSeconds <= piece.startedAtElapsedSeconds
      || at.elapsedSeconds < piece.startedAtElapsedSeconds || at.elapsedSeconds > piece.coverageThroughElapsedSeconds
      || piece.coverageThroughElapsedSeconds > (r.coverageThroughTick-at.originTick)/p.ticksPerSecond)
      throw new Error('exact runner controller piece original coverage differs');
    pieces.set(r.playerId, { playerId: r.playerId, reference: reference('pa_physical_v1_field_steps',f), piece });
  }
  return [...pieces.values()];
};
export const samePaExactRunnerControllerCensus = (prefix: readonly Field[]) => {
  const at = prefix.at(-1)!.field.motion.world.moment, p = (prefix[0] as SamePaPhysicalFieldRoot).response.world.parameters;
  return samePaExactRunnerControllerPieces(prefix).map(({playerId,reference,piece})=>({playerId,controllerReference:reference,
    kind:'controller_piece' as const,dueTick:quantizeEventTick(piece.originTick,piece.coverageThroughElapsedSeconds,p.ticksPerSecond),
    dueElapsedSeconds:piece.coverageThroughElapsedSeconds,due:piece.coverageThroughElapsedSeconds<=at.elapsedSeconds?'due' as const:'future' as const}));
};
/** Quantized primitive endTick is storage coverage, never permission to execute
 * a controller past its exact analytic knot. Runner motors share the same
 * exact foreign-coverage check; other actions retain their own physical owners. */
export const assertSamePaExactRunnerControllerOwnership = (source: SamePaPhysicalFieldStepSource, prefix: readonly Field[]) => {
  const a=source.action,kind=a?.kind;
  if(kind==='batter_recovery_motion_v1'||kind==='batter_run_motion_v1'||kind==='batter_catch_motion_v1'||kind==='occupied_runner_motion_v1')return;
  if(kind==='occupied_runner_catch_motion_v1'&&prefix.some(f=>f.kind==='same_pa_physical_field_step_v1'
    &&f.actionResult?.kind==='occupied_runner_catch_response_v1'&&f.actionResult.motionBasis
    &&f.source.sourceId===a.responseReference.sourceId))return;
  if(kind==='defender_observation_v1'||kind==='defender_decision_v1'||kind==='defender_catch_response_v1'
    ||kind==='batter_catch_response_v1'||kind==='occupied_runner_catch_response_v1'||kind==='appeal_indication_v1'
    ||kind==='appeal_contact_v1'||kind==='defender_departure_purpose_v1')return;
  const root=prefix[0],at=prefix.at(-1)!.field.motion.world.moment,p=(root as SamePaPhysicalFieldRoot).response.world.parameters;
  const end=a?.kind==='throw_checkpoint_v1'||a?.kind==='capture_checkpoint_v1'?a.throughElapsedSeconds
    :(source.throughTick-at.originTick)/p.ticksPerSecond;
  for(const {piece} of samePaExactRunnerControllerPieces(prefix))
    if(kind==='retained_quantizer_checkpoint_v1' ? end>=piece.coverageThroughElapsedSeconds : end>piece.coverageThroughElapsedSeconds)
      throw new Error('exact runner controller piece requires its next owned motor before later physical work');
};
