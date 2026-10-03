import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import { SeedRoot } from '../../rng/SeedRoot';
import { createDefensiveRatedThrowLaunch, resolveRatedBallTransferTiming } from '../fielding/DefensiveRatingAdapters';
import type { BallTransferTiming } from '../fielding/BallTransferTiming';
import type { ThrowLaunch } from '../fielding/ThrowLaunch';
import { deriveAcceleratedBallWorldFieldMotion, deriveBallWorldFieldContinuation } from './BallWorldContinuation';
import { respondToBattedWorldBoundary, type BattedWorldBallCursor } from './BattedWorldContinuation';
import { deriveBattedWorldMotionActors } from './BattedWorldMotion';
import type { BattedWorldThrowInput } from './BattedWorldThrow';
import type { BattedWorldFieldGeometry, BattedWorldFieldMotion } from './BattedWorldFieldMotion';
import { assertBattedWorldFieldExecutionScope, battedWorldFieldExecutionBoundary, battedWorldFieldExecutionPrevious,
  battedWorldFieldExecutionResponse, freezeBattedWorldField, hasBattedWorldFieldFields } from './BattedWorldFieldExecution';

export type BattedWorldFieldThrowInput = BattedWorldThrowInput & Readonly<{ geometry: BattedWorldFieldGeometry }>;
export type BattedWorldFieldThrow = Readonly<{ kind: 'interrupted'; transfer: BallTransferTiming; field: BattedWorldFieldMotion }>
  | Readonly<{ kind: 'released'; transfer: BallTransferTiming; releaseCursor: BattedWorldBallCursor; launch: ThrowLaunch; field: BattedWorldFieldMotion }>;
const id = (value: unknown): value is string => typeof value === 'string' && !!value.length && value === value.trim();
const tick = (value: number) => Number.isSafeInteger(value) && value >= 0;

/** Both the retained transfer and the released ball use actual field collision geometry, never the archived World-only route. */
export const deriveBattedWorldFieldThrow = (raw: BattedWorldFieldThrowInput): BattedWorldFieldThrow => {
  const input = cloneInert(raw);
  if (!hasBattedWorldFieldFields(input, ['response', 'geometry', 'cursor', 'actors', 'carrierPlayerId', 'availableAtTick', 'throughTick', 'commands',
    'receiverPlayerId', 'ratings', 'transferParameters', 'throwCalibration', 'seed']) || !id(input.carrierPlayerId)
    || !id(input.receiverPlayerId) || input.receiverPlayerId === input.carrierPlayerId || !hasBattedWorldFieldFields(input.seed, ['matchSeed', 'playId', 'streamKey'])
    || !tick(input.seed.matchSeed) || !tick(input.seed.playId) || !id(input.seed.streamKey)) throw new Error('invalid actual field throw intent');
  assertBattedWorldFieldExecutionScope(input.response, input.geometry);
  const actors = deriveBattedWorldMotionActors(input), moment = input.cursor.moment, p = input.response.world.parameters;
  const glove = actors.find((actor) => actor.playerId === input.carrierPlayerId && actor.primitive.role === 'glove');
  const receiver = actors.find((actor) => actor.playerId === input.receiverPlayerId && actor.primitive.role === 'glove');
  if (!glove || !receiver) throw new Error('actual field throw registered glove is missing');
  const tolerance = Number.EPSILON * Math.max(1, ...Object.values(moment.ball.velocity).map(Math.abs), ...Object.values(glove.primitive.startVelocity).map(Math.abs)) * 32;
  if ((['x', 'y', 'z'] as const).some((axis) => Math.abs(moment.ball.velocity[axis] - glove.primitive.startVelocity[axis]) > tolerance)) {
    throw new Error('actual field throw carried velocity differs');
  }
  const transfer = resolveRatedBallTransferTiming(moment.ball.tick, input.ratings, input.transferParameters);
  if (transfer.throwReadyTick > input.throughTick) throw new Error('actual field throw transfer exceeds accepted horizon');
  const previousContacts = [...input.cursor.previousContacts];
  if (!previousContacts.some((contact) => contact.kind === 'actor' && contact.playerId === input.carrierPlayerId && contact.role === 'glove')) {
    previousContacts.push({ kind: 'actor', playerId: input.carrierPlayerId, role: 'glove' });
  }
  const query = { actors, parameters: p, surfaces: input.response.world.surfaces, bases: input.geometry.bases,
    ...battedWorldFieldExecutionPrevious(previousContacts) };
  const carried = battedWorldFieldExecutionBoundary(deriveAcceleratedBallWorldFieldMotion({ ...query, moment,
    acceleration: glove.primitive.acceleration, throughElapsedSeconds: (transfer.throwReadyTick - moment.originTick) / p.ticksPerSecond }));
  if (carried.world.kind === 'boundary') return freezeBattedWorldField({ kind: 'interrupted', transfer,
    field: { baseContacts: carried.baseContacts, motion: { actors, carrierPlayerId: input.carrierPlayerId, world: carried.world,
      response: { kind: 'unresolved', reason: 'carried_contact', cursor: null }, cursor: null } } });
  const dt = (carried.world.moment.originTick - receiver.primitive.startTick) / p.ticksPerSecond + carried.world.moment.elapsedSeconds - (receiver.startElapsedSeconds ?? 0);
  const s = receiver.primitive, component = (axis: keyof Vec3) => s.startCenter[axis] + s.startVelocity[axis] * dt + 0.5 * s.acceleration[axis] * dt * dt;
  const launch = createDefensiveRatedThrowLaunch({ releaseTick: transfer.throwReadyTick, origin: carried.world.moment.ball.position,
    intendedTarget: { x: component('x'), y: component('y'), z: component('z') }, ratings: input.ratings, calibration: input.throwCalibration,
    rng: new SeedRoot(input.seed.matchSeed).streamRng(input.seed.playId, 'fielding', input.seed.streamKey) });
  const releaseCursor: BattedWorldBallCursor = { moment: { ...carried.world.moment,
    ball: { ...carried.world.moment.ball, velocity: launch.initialVelocity } }, previousContacts };
  const released = battedWorldFieldExecutionBoundary(deriveBallWorldFieldContinuation({ ...query, moment: releaseCursor.moment, throughTick: input.throughTick }));
  const response = respondToBattedWorldBoundary(battedWorldFieldExecutionResponse(input.response, input.geometry), releaseCursor, released.world);
  return freezeBattedWorldField({ kind: 'released', transfer, releaseCursor, launch, field: { baseContacts: released.baseContacts,
    motion: { actors, carrierPlayerId: null, world: released.world, response, cursor: response.cursor } } });
};
