import { deriveBattedWorldFieldMotionCheckpoint, deriveInitialBattedWorldFieldMotion, type BattedWorldFieldMotion } from '../../core/sim/ball/BattedWorldFieldMotion';
import type { BallWorldMotionActor } from '../../core/sim/ball/BallWorldContinuation';
import { prePitchRunnerContactPrimitives } from './PrePitchRunnerExecution';
import { ownedRunnerFieldResponseInput } from './OwnedRunnerFieldRoot';
import { battedWorldMotionCommandsInput } from './SqliteBattedWorldMotionStore';
import type { DurableBattedContactResponse } from './SqliteBattedContactResponseStore';
import type { AcceptedBattedWorldFieldAction, DurableBattedWorldFieldAction, DurableBattedWorldFieldGeometry } from './SqliteBattedWorldFieldStore';

export type OwnedRunnerFieldCapability = Readonly<{ kind?: never; prePitchRunnerSourceId?: never }>
  | Readonly<{ kind: 'owned_runner_field_v1'; prePitchRunnerSourceId: string }>;
const key = (actor: BallWorldMotionActor) => JSON.stringify([actor.playerId, actor.primitive.role]);
const sameNumber = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b)
  && Math.abs(a - b) <= Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b)) * 32;

/** Executes an already owned original controller segment. This is not runner command issuance or renewal. */
export const deriveOwnedRunnerFieldMotion = (source: AcceptedBattedWorldFieldAction,
  root: Readonly<{ response: DurableBattedContactResponse; geometry: DurableBattedWorldFieldGeometry }>,
  previous: DurableBattedWorldFieldAction | null): BattedWorldFieldMotion => {
  const response = ownedRunnerFieldResponseInput(root.response), world = root.response.touch.worldContact;
  const frame = world.flight.physicalPitch.frame, runner = frame.prePitchRunner!, batter = frame.batterActor!;
  if (source.kind !== 'owned_runner_field_v1' || source.prePitchRunnerSourceId !== runner.source.sourceId
    || previous && (previous.source.kind !== source.kind || previous.source.prePitchRunnerSourceId !== source.prePitchRunnerSourceId)
    || previous && previous.field.motion.carrierPlayerId !== null) throw new Error('owned runner field capability or predecessor differs');
  const initial = world.flight.flight.initialBall, tps = response.world.parameters.ticksPerSecond;
  const cursor = previous?.field.motion.cursor ?? (previous ? null : { moment: { originTick: initial.tick, elapsedSeconds: 0, ball: initial }, previousContacts: [] });
  if (!cursor) throw new Error('owned runner field physical boundary is pending');
  const at = cursor.moment;
  if (at.originTick !== initial.tick || !Number.isFinite(at.elapsedSeconds) || at.elapsedSeconds < 0
    || (source.availableAtTick - at.originTick) / tps > at.elapsedSeconds
    || (source.throughTick - at.originTick) / tps <= at.elapsedSeconds) throw new Error('owned runner field exact command interval differs');
  const model = world.model.actors.find(actor => actor.playerId === runner.binding.playerId)!;
  // Reconstruct from original contact to the requested endpoint. This deliberately
  // rejects every later analytic boundary instead of extrapolating across one.
  const originalRunner = prePitchRunnerContactPrimitives(runner.source, runner.canonical, runner.controller,
    model.primitives, model.bodyOriginHeightMeters, initial.tick, source.throughTick, tps);
  const actors: readonly BallWorldMotionActor[] = previous?.field.motion.actors ?? world.actors;
  const originalKeys = new Set(world.actors.map(key));
  if (actors.length !== 55 || originalKeys.size !== 55 || new Set(actors.map(key)).size !== 55
    || actors.some(actor => !originalKeys.has(key(actor)))) throw new Error('owned runner field original active participant coverage differs');
  for (const original of originalRunner) {
    const actor = actors.find(candidate => key(candidate) === key(original))!, s = actor.primitive, basis = original.primitive;
    const actualSeconds = (at.originTick - s.startTick) / tps + at.elapsedSeconds - (actor.startElapsedSeconds ?? 0);
    if (!Number.isFinite(actualSeconds) || actualSeconds < 0 || s.radius !== basis.radius || s.ticksPerSecond !== tps
      || !Number.isSafeInteger(s.endTick) || at.elapsedSeconds > (s.endTick - at.originTick) / tps) {
      throw new Error('owned runner field preceding physical coverage differs');
    }
    for (const axis of ['x', 'y', 'z'] as const) {
      const actualPosition = s.startCenter[axis] + s.startVelocity[axis] * actualSeconds + 0.5 * s.acceleration[axis] * actualSeconds * actualSeconds;
      const actualVelocity = s.startVelocity[axis] + s.acceleration[axis] * actualSeconds;
      const expectedPosition = basis.startCenter[axis] + basis.startVelocity[axis] * at.elapsedSeconds + 0.5 * basis.acceleration[axis] * at.elapsedSeconds * at.elapsedSeconds;
      const expectedVelocity = basis.startVelocity[axis] + basis.acceleration[axis] * at.elapsedSeconds;
      if (s.acceleration[axis] !== basis.acceleration[axis] || !sameNumber(actualPosition, expectedPosition) || !sameNumber(actualVelocity, expectedVelocity)) {
        throw new Error('owned runner field preceding curve differs from its original controller');
      }
    }
  }
  const accepted = battedWorldMotionCommandsInput(source.commands), commanded = [...batter.defenderBindings, batter.binding];
  if (commanded.length !== 10 || accepted.some(command => !commanded.some(binding => binding.playerId === command.playerId)
    || command.playerId !== batter.binding.playerId && command.bodyAcceleration.y !== 0)) {
    throw new Error('owned runner field ten commanded participants differ');
  }
  const commands = accepted.flatMap(command => command.primitiveMotions.map(motion => ({ playerId: command.playerId, role: motion.role,
    acceleration: { x: command.bodyAcceleration.x + motion.offsetAcceleration.x, y: command.bodyAcceleration.y + motion.offsetAcceleration.y,
      z: command.bodyAcceleration.z + motion.offsetAcceleration.z } })));
  // Internal kernel inputs retain canonical source-derived curves. They do not
  // create an accepted runner command or extend the original controller authority.
  commands.push(...originalRunner.map(actor => ({ playerId: actor.playerId, role: actor.primitive.role, acceleration: actor.primitive.acceleration })));
  const common = { response, geometry: root.geometry.geometry, commands, availableAtTick: source.availableAtTick, throughTick: source.throughTick };
  return previous ? deriveBattedWorldFieldMotionCheckpoint({ response, geometry: root.geometry.geometry,
    cursor, actors, carrierPlayerId: null, commands, availableAtTick: source.availableAtTick,
    coverageThroughTick: source.throughTick, checkpointThroughTick: source.throughTick })
    : deriveInitialBattedWorldFieldMotion(common);
};
