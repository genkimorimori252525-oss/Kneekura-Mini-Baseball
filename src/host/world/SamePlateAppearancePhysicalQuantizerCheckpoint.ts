import { advanceBattedWorldFieldMotionExactCheckpointV1 } from '../../core/sim/ball/BattedWorldFieldMotion';
import { deriveQuantizerClosedGenerationBoundary } from '../../core/sim/liveAction/QuantizerClosedGenerationBoundary';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';

/** A real continuation of the current commands to the last representable time
 * in their current tick. This generates physical coverage, never PlayEnd. */
export const deriveSamePaPhysicalQuantizerCheckpoint = (source: SamePaPhysicalFieldStepSource,
  root: SamePaPhysicalFieldRoot, previous: SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep) => {
  const motion = previous.field.motion, moment = motion.world.moment;
  if (source.action?.kind !== 'retained_quantizer_checkpoint_v1' || source.throughTick !== previous.evaluationTick
    || root.physicalPitchSourceId !== previous.physicalPitchSourceId || !motion.cursor)
    throw new Error('same-PA retained quantizer checkpoint requires the current original physical cursor');
  const boundary = deriveQuantizerClosedGenerationBoundary({ originTick: moment.originTick, throughTick: previous.evaluationTick,
    ticksPerSecond: root.response.world.parameters.ticksPerSecond });
  const field = advanceBattedWorldFieldMotionExactCheckpointV1({ response: root.response, geometry: root.geometry,
    cursor: motion.cursor, actors: motion.actors, carrierPlayerId: motion.carrierPlayerId,
    checkpointThroughElapsedSeconds: boundary.lastIncludedElapsedSeconds });
  return freeze({ field, timeline: previous.timeline, evaluationTick: field.motion.world.moment.ball.tick,
    actionResult: { kind: 'retained_quantizer_checkpoint_v1' as const, boundary,
      status: field.motion.world.kind !== 'boundary' && field.motion.world.moment.elapsedSeconds === boundary.lastIncludedElapsedSeconds
        ? 'checkpoint_reached' as const : 'physical_boundary' as const } });
};
