import type { BallWorldPlayerBaseContactSegment } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import { battedWorldOriginalContactPrefix, type BattedWorldOriginalContactPrefix } from './BattedWorldOriginalContactPrefix';
import type { DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
import { actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type OwnedRunnerFieldPhysicalPrefix = Omit<BattedWorldOriginalContactPrefix, 'version'> & Readonly<{
  version: 'owned_runner_field_physical_prefix_v1'; fieldSourceId: string; fieldRevision: number;
  geometrySourceId: string; geometryHash: string;
}>;
const actorKey = (actor: BallWorldPlayerBaseContactSegment['actors'][number]) => JSON.stringify([actor.playerId, actor.primitive.role]);

/** Physical-only projection of the bounded chain already rederived by the field owner.
 * Its public reader accepts Source IDs, never caller-provided snapshots or results. */
export const ownedRunnerFieldPhysicalPrefix = (fields: readonly DurableBattedWorldFieldAction[]): OwnedRunnerFieldPhysicalPrefix => {
  const first = fields[0], last = fields.at(-1);
  if (!first || !last) throw new Error('owned runner field prefix is empty');
  const world = first.response.touch.worldContact, original = battedWorldOriginalContactPrefix(world);
  if (original.at.elapsedSeconds !== 0 || first.source.previousFieldSourceId !== null
    || world.flight.source.searchDurationTicks !== 0) throw new Error('owned runner field prefix requires the original zero-time contact');
  const runner = world.flight.physicalPitch.frame.prePitchRunner!;
  const responseHash = hash(first.response), geometryHash = hash(first.geometry), keys = new Set(world.actors.map(actorKey));
  const segments: BallWorldPlayerBaseContactSegment[] = [...original.segments];
  let elapsed = 0;
  for (const [index, value] of fields.entries()) {
    const source = value.source, motion = value.field.motion, moment = motion.world.moment;
    if (source.kind !== 'owned_runner_field_v1' || source.prePitchRunnerSourceId !== runner.source.sourceId
      || value.revision !== index + 1 || source.previousFieldSourceId !== (fields[index - 1]?.source.sourceId ?? null)
      || source.responseSourceId !== first.source.responseSourceId || source.geometrySourceId !== first.source.geometrySourceId
      || hash(value.response) !== responseHash || hash(value.geometry) !== geometryHash
      || moment.originTick !== original.at.originTick || !Number.isFinite(moment.elapsedSeconds) || moment.elapsedSeconds < elapsed
      || moment.elapsedSeconds > (source.throughTick - original.at.originTick) / original.ticksPerSecond
      || motion.carrierPlayerId !== null || motion.actors.length !== 55 || new Set(motion.actors.map(actorKey)).size !== 55
      || motion.actors.some(actor => !keys.has(actorKey(actor)))) {
      throw new Error('owned runner field prefix ownership, interval or actor coverage differs');
    }
    segments.push({ originTick: original.at.originTick, startElapsedSeconds: elapsed, endElapsedSeconds: moment.elapsedSeconds, actors: motion.actors });
    elapsed = moment.elapsedSeconds;
  }
  const moment = last.field.motion.world.moment;
  return freeze({ ...original, version: 'owned_runner_field_physical_prefix_v1', fieldSourceId: last.source.sourceId,
    fieldRevision: last.revision, geometrySourceId: first.source.geometrySourceId, geometryHash,
    at: { originTick: moment.originTick, elapsedSeconds: moment.elapsedSeconds, tick: moment.ball.tick }, segments });
};
