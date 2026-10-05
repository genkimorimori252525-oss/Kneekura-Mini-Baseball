import type { BallWorldPlayerBaseContactSegment } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import { battedWorldOriginalContactPrefix, type BattedWorldOriginalContactPrefix } from './BattedWorldOriginalContactPrefix';
import type { DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
import { actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type OwnedRunnerFieldPiecesSegment = BallWorldPlayerBaseContactSegment & Readonly<{ execution: Readonly<{
  owner: 'batted_world_contacts' | 'batted_world_field_actions'; sourceId: string; revision: number; pieceOrdinal: number | null;
}> }>;
export type OwnedRunnerFieldPiecesPhysicalPrefix = Omit<BattedWorldOriginalContactPrefix, 'version' | 'segments'> & Readonly<{
  version: 'owned_runner_field_pieces_prefix_v1'; fieldSourceId: string; fieldRevision: number; geometrySourceId: string; geometryHash: string;
  segments: readonly OwnedRunnerFieldPiecesSegment[];
}>;
const actorKey = (actor: BallWorldPlayerBaseContactSegment['actors'][number]) => JSON.stringify([actor.playerId, actor.primitive.role]);

/** Flattens authenticated executed intervals, keeping accepted rows distinct from their analytic pieces. */
export const ownedRunnerFieldPiecesPhysicalPrefix = (fields: readonly DurableBattedWorldFieldAction[]): OwnedRunnerFieldPiecesPhysicalPrefix => {
  const first = fields[0], last = fields.at(-1);
  if (!first || !last || last.source.kind !== 'owned_runner_field_pieces_v1') throw new Error('retained runner field prefix is empty or unversioned');
  const world = first.response.touch.worldContact, original = battedWorldOriginalContactPrefix(world);
  if (original.at.elapsedSeconds !== 0 || first.source.previousFieldSourceId !== null || world.flight.source.searchDurationTicks !== 0) {
    throw new Error('retained runner prefix requires the original zero-time contact');
  }
  const runner = world.flight.physicalPitch.frame.prePitchRunner!, responseHash = hash(first.response), geometryHash = hash(first.geometry);
  const keys = new Set(world.actors.map(actorKey));
  const segments: OwnedRunnerFieldPiecesSegment[] = original.segments.map(segment => ({ ...segment,
    execution: { owner: 'batted_world_contacts', sourceId: world.source.sourceId, revision: world.revision, pieceOrdinal: null } }));
  let elapsed = 0;
  for (const [index, value] of fields.entries()) {
    const source = value.source;
    if (source.kind !== 'owned_runner_field_v1' && source.kind !== 'owned_runner_field_pieces_v1'
      || source.prePitchRunnerSourceId !== runner.source.sourceId || value.revision !== index + 1
      || source.previousFieldSourceId !== (fields[index - 1]?.source.sourceId ?? null)
      || source.responseSourceId !== first.source.responseSourceId || source.geometrySourceId !== first.source.geometrySourceId
      || hash(value.response) !== responseHash || hash(value.geometry) !== geometryHash) throw new Error('retained runner prefix ownership differs');
    const execution = value.pieceExecution;
    if (source.kind === 'owned_runner_field_pieces_v1'
      ? !execution || execution.version !== 'owned_runner_field_pieces_execution_v1' || !execution.pieces.length || hash(value.field) !== hash(execution.pieces.at(-1)!.field)
      : execution !== undefined) throw new Error('retained runner prefix explicit piece history differs');
    const intervals = execution ? execution.pieces.map(piece => ({ piece, field: piece.field })) : [{ piece: null, field: value.field }];
    for (const [ordinal, interval] of intervals.entries()) {
      const { piece, field } = interval, motion = field.motion, moment = motion.world.moment;
      if (piece && (piece.ordinal !== ordinal || !Number.isSafeInteger(piece.controllerSegmentIndex) || piece.controllerSegmentIndex < 0
        || !runner.controller.trajectory.segments[piece.controllerSegmentIndex]
        || piece.startMoment.originTick !== original.at.originTick || piece.startMoment.elapsedSeconds !== elapsed
        || piece.throughElapsedSeconds !== moment.elapsedSeconds || !Number.isFinite(piece.coverageThroughElapsedSeconds)
        || piece.coverageThroughElapsedSeconds <= elapsed || piece.coverageThroughElapsedSeconds < moment.elapsedSeconds
        || piece.coverageThroughElapsedSeconds > (source.throughTick - original.at.originTick) / original.ticksPerSecond
        || ordinal < intervals.length - 1 && (motion.world.kind === 'boundary' || moment.elapsedSeconds !== piece.coverageThroughElapsedSeconds))) {
        throw new Error('retained runner prefix piece coverage differs');
      }
      if (moment.originTick !== original.at.originTick || !Number.isFinite(moment.elapsedSeconds) || moment.elapsedSeconds < elapsed
        || moment.elapsedSeconds > (source.throughTick - original.at.originTick) / original.ticksPerSecond
        || motion.carrierPlayerId !== null || motion.actors.length !== 55 || new Set(motion.actors.map(actorKey)).size !== 55
        || motion.actors.some(actor => !keys.has(actorKey(actor)))) throw new Error('retained runner prefix interval or actor coverage differs');
      segments.push({ originTick: original.at.originTick, startElapsedSeconds: elapsed, endElapsedSeconds: moment.elapsedSeconds, actors: motion.actors,
        execution: { owner: 'batted_world_field_actions', sourceId: source.sourceId, revision: value.revision, pieceOrdinal: piece?.ordinal ?? null } });
      elapsed = moment.elapsedSeconds;
    }
  }
  const moment = last.field.motion.world.moment;
  return freeze({ ...original, version: 'owned_runner_field_pieces_prefix_v1', fieldSourceId: last.source.sourceId, fieldRevision: last.revision,
    geometrySourceId: first.source.geometrySourceId, geometryHash,
    at: { originTick: moment.originTick, elapsedSeconds: moment.elapsedSeconds, tick: moment.ball.tick }, segments });
};
