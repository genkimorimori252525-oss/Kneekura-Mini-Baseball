import type { BallWorldMoment, BallWorldMotionActor } from '../../core/sim/ball/BallWorldContinuation';
import { advanceBattedWorldFieldMotionExactCheckpointV1, type BattedWorldFieldMotion } from '../../core/sim/ball/BattedWorldFieldMotion';
import type { BattedWorldBallCursor } from '../../core/sim/ball/BattedWorldContinuation';
import { deriveBattedWorldMotionActorsAtExactCoverage } from '../../core/sim/ball/BattedWorldMotion';
import { prePitchRunnerFieldPieces } from './PrePitchRunnerFieldPieces';
import { ownedRunnerFieldResponseInput } from './OwnedRunnerFieldRoot';
import { battedWorldMotionCommandsInput } from './SqliteBattedWorldMotionStore';
import type { DurableBattedContactResponse } from './SqliteBattedContactResponseStore';
import type { AcceptedBattedWorldFieldAction, DurableBattedWorldFieldAction, DurableBattedWorldFieldGeometry } from './SqliteBattedWorldFieldStore';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type OwnedRunnerFieldPiecesCapability = Readonly<{ kind: 'owned_runner_field_pieces_v1'; prePitchRunnerSourceId: string }>;
export type OwnedRunnerFieldPiece = Readonly<{ ordinal: number; controllerSegmentIndex: number; startMoment: BallWorldMoment;
  throughElapsedSeconds: number; coverageThroughElapsedSeconds: number; field: BattedWorldFieldMotion }>;
export type OwnedRunnerFieldPieceExecution = Readonly<{ version: 'owned_runner_field_pieces_execution_v1'; pieces: readonly OwnedRunnerFieldPiece[] }>;
const key = (actor: BallWorldMotionActor) => JSON.stringify([actor.playerId, actor.primitive.role]);
const sameNumber = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b)
  && Math.abs(a - b) <= Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b)) * 32;

/** Executes only original analytic pieces. Each boundary uses the existing free-ball field kernel. */
export const deriveOwnedRunnerFieldPieces = (source: AcceptedBattedWorldFieldAction,
  root: Readonly<{ response: DurableBattedContactResponse; geometry: DurableBattedWorldFieldGeometry }>,
  previous: DurableBattedWorldFieldAction | null): OwnedRunnerFieldPieceExecution => {
  const response = ownedRunnerFieldResponseInput(root.response), world = root.response.touch.worldContact;
  const frame = world.flight.physicalPitch.frame, runner = frame.prePitchRunner!, batter = frame.batterActor!;
  if (source.kind !== 'owned_runner_field_pieces_v1' || source.prePitchRunnerSourceId !== runner.source.sourceId
    || previous && (previous.source.kind !== 'owned_runner_field_v1' && previous.source.kind !== 'owned_runner_field_pieces_v1'
      || previous.source.prePitchRunnerSourceId !== source.prePitchRunnerSourceId || previous.field.motion.carrierPlayerId !== null)) {
    throw new Error('retained runner field capability or predecessor differs');
  }
  const initial = world.flight.flight.initialBall, tps = response.world.parameters.ticksPerSecond;
  let cursor: BattedWorldBallCursor | null = previous?.field.motion.cursor ?? (previous ? null
    : { moment: { originTick: initial.tick, elapsedSeconds: 0, ball: initial }, previousContacts: [] });
  if (!cursor) throw new Error('retained runner field physical boundary is pending');
  const at = cursor.moment;
  if (at.originTick !== initial.tick || (source.availableAtTick - at.originTick) / tps > at.elapsedSeconds
    || (source.throughTick - at.originTick) / tps <= at.elapsedSeconds) throw new Error('retained runner exact command interval differs');
  const model = world.model.actors.find(actor => actor.playerId === runner.binding.playerId)!;
  const projections = prePitchRunnerFieldPieces({ source: runner.source, canonical: runner.canonical, controller: runner.controller,
    shapes: model.primitives, bodyOriginHeightMeters: model.bodyOriginHeightMeters, originTick: initial.tick,
    startElapsedSeconds: at.elapsedSeconds, throughElapsedSeconds: (source.throughTick - initial.tick) / tps });
  let actors: readonly BallWorldMotionActor[] = previous?.field.motion.actors ?? world.actors;
  const originals = new Map(world.actors.map(actor => [key(actor), actor]));
  if (actors.length !== 55 || originals.size !== 55 || new Set(actors.map(key)).size !== 55
    || actors.some(actor => originals.get(key(actor))?.primitive.radius !== actor.primitive.radius)) {
    throw new Error('retained runner original active participant coverage differs');
  }
  const accepted = battedWorldMotionCommandsInput(source.commands), commanded = [...batter.defenderBindings, batter.binding];
  if (commanded.length !== 10 || accepted.some(command => !commanded.some(binding => binding.playerId === command.playerId)
    || command.playerId !== batter.binding.playerId && command.bodyAcceleration.y !== 0)) {
    throw new Error('retained runner ten commanded participants differ');
  }
  const playerCommands = accepted.flatMap(command => command.primitiveMotions.map(motion => ({ playerId: command.playerId, role: motion.role,
    acceleration: { x: command.bodyAcceleration.x + motion.offsetAcceleration.x, y: command.bodyAcceleration.y + motion.offsetAcceleration.y,
      z: command.bodyAcceleration.z + motion.offsetAcceleration.z } })));
  const pieces: OwnedRunnerFieldPiece[] = [];
  for (const projection of projections) {
    const startMoment: BallWorldMoment = cursor.moment;
    if (startMoment.elapsedSeconds !== projection.startElapsedSeconds) throw new Error('retained runner physical and analytic cursors differ');
    for (const basis of projection.actors) {
      const actual = actors.find(actor => key(actor) === key(basis))!, p = actual.primitive;
      const dt = (startMoment.originTick - p.startTick) / tps + startMoment.elapsedSeconds - (actual.startElapsedSeconds ?? 0);
      if (!Number.isFinite(dt) || dt < 0 || p.ticksPerSecond !== tps || startMoment.elapsedSeconds > (p.endTick - initial.tick) / tps) {
        throw new Error('retained runner preceding physical coverage differs');
      }
      for (const axis of ['x', 'y', 'z'] as const) {
        const position = p.startCenter[axis] + p.startVelocity[axis] * dt + 0.5 * p.acceleration[axis] * dt * dt;
        const velocity = p.startVelocity[axis] + p.acceleration[axis] * dt;
        if (!sameNumber(position, basis.primitive.startCenter[axis]) || !sameNumber(velocity, basis.primitive.startVelocity[axis])) {
          throw new Error('retained runner preceding curve differs from its original controller');
        }
      }
    }
    const prepared = deriveBattedWorldMotionActorsAtExactCoverage({ response, cursor, actors, carrierPlayerId: null,
      availableAtTick: source.availableAtTick, throughTick: source.throughTick, commands: [...playerCommands,
        ...projection.actors.map(actor => ({ playerId: actor.playerId, role: actor.primitive.role, acceleration: actor.primitive.acceleration }))] });
    // Only the five source-owned runner parts change phase. The other curves
    // retain the single adoption at this accepted action's actual start.
    actors = prepared.map(actor => actor.playerId === runner.binding.playerId
      ? { ...actor, primitive: { ...actor.primitive, endTick: projection.actors.find(part => key(part) === key(actor))!.primitive.endTick } }
      : pieces.length ? actors.find(part => key(part) === key(actor))! : actor);
    const field: BattedWorldFieldMotion = advanceBattedWorldFieldMotionExactCheckpointV1({ response, geometry: root.geometry.geometry, cursor, actors,
      carrierPlayerId: null, checkpointThroughElapsedSeconds: projection.coverageThroughElapsedSeconds });
    pieces.push({ ordinal: pieces.length, controllerSegmentIndex: projection.controllerSegmentIndex, startMoment,
      throughElapsedSeconds: field.motion.world.moment.elapsedSeconds, coverageThroughElapsedSeconds: projection.coverageThroughElapsedSeconds, field });
    if (field.motion.world.kind === 'boundary') break;
    cursor = field.motion.cursor;
    if (!cursor || cursor.moment.elapsedSeconds !== projection.coverageThroughElapsedSeconds) throw new Error('retained runner contact-free checkpoint differs');
  }
  return freeze({ version: 'owned_runner_field_pieces_execution_v1', pieces });
};
