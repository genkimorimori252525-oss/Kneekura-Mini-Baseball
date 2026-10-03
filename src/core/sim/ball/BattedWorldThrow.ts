import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { DefensiveRatings } from '../../model/DefensiveRatings';
import type { Vec3 } from '../../model/geometry';
import { SeedRoot } from '../../rng/SeedRoot';
import { resolveRatedBallTransferTiming, createDefensiveRatedThrowLaunch } from '../fielding/DefensiveRatingAdapters';
import type { BallTransferTiming, BallTransferTimingParameters } from '../fielding/BallTransferTiming';
import type { ThrowLaunch, ThrowLaunchCalibration } from '../fielding/ThrowLaunch';
import { deriveAcceleratedBallWorldMotion, deriveBallWorldContinuation } from './BallWorldContinuation';
import { deriveBattedWorldMotionActors, type BattedWorldMotionInput, type BattedWorldMotion } from './BattedWorldMotion';
import { respondToBattedWorldBoundary, type BattedWorldBallCursor } from './BattedWorldContinuation';

export type BattedWorldThrowInput = Omit<BattedWorldMotionInput, 'carrierPlayerId'> & Readonly<{
  carrierPlayerId: string; receiverPlayerId: string; ratings: DefensiveRatings;
  transferParameters: BallTransferTimingParameters; throwCalibration: ThrowLaunchCalibration;
  seed: Readonly<{ matchSeed: number; playId: number; streamKey: string }>;
}>;
export type BattedWorldThrow = Readonly<{ kind: 'interrupted'; transfer: BallTransferTiming; motion: BattedWorldMotion }>
  | Readonly<{ kind: 'released'; transfer: BallTransferTiming; releaseCursor: BattedWorldBallCursor; launch: ThrowLaunch; motion: BattedWorldMotion }>;
const freeze = <T>(value: T): T => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const id = (value: unknown): value is string => typeof value === 'string' && !!value.length && value === value.trim();
const tick = (value: number) => Number.isSafeInteger(value) && value >= 0;

/** Existing ready-tick approximation; actual carried motion and all World boundaries still own physical release. */
export const deriveBattedWorldThrow = (raw: BattedWorldThrowInput): BattedWorldThrow => {
  const input = cloneInert(raw);
  if (!id(input?.carrierPlayerId) || !id(input.receiverPlayerId) || input.receiverPlayerId === input.carrierPlayerId
    || !input.seed || !tick(input.seed.matchSeed) || !tick(input.seed.playId) || !id(input.seed.streamKey)) throw new Error('invalid actual batted throw intent');
  const actors = deriveBattedWorldMotionActors(input), moment = input.cursor.moment, p = input.response.world.parameters;
  const glove = actors.find((actor) => actor.playerId === input.carrierPlayerId && actor.primitive.role === 'glove');
  const receiver = actors.find((actor) => actor.playerId === input.receiverPlayerId && actor.primitive.role === 'glove');
  if (!glove || !receiver) throw new Error('actual batted throw registered glove is missing');
  const tolerance = Number.EPSILON * Math.max(1, ...Object.values(moment.ball.velocity).map(Math.abs), ...Object.values(glove.primitive.startVelocity).map(Math.abs)) * 32;
  if (Object.keys(moment.ball.velocity).some((axis) => Math.abs(moment.ball.velocity[axis as keyof Vec3] - glove.primitive.startVelocity[axis as keyof Vec3]) > tolerance)) {
    throw new Error('actual batted throw carried velocity differs');
  }
  const transfer = resolveRatedBallTransferTiming(moment.ball.tick, input.ratings, input.transferParameters);
  if (transfer.throwReadyTick > input.throughTick) throw new Error('actual batted throw transfer exceeds accepted horizon');
  const previousContacts = [...input.cursor.previousContacts];
  if (!previousContacts.some((contact) => contact.kind === 'actor' && contact.playerId === input.carrierPlayerId && contact.role === 'glove')) {
    previousContacts.push({ kind: 'actor', playerId: input.carrierPlayerId, role: 'glove' });
  }
  const carried = deriveAcceleratedBallWorldMotion({ moment, actors, parameters: p, surfaces: input.response.world.surfaces, previousContacts,
    acceleration: glove.primitive.acceleration, throughElapsedSeconds: (transfer.throwReadyTick - moment.originTick) / p.ticksPerSecond });
  if (carried.kind === 'boundary') return freeze({ kind: 'interrupted', transfer, motion: { actors, carrierPlayerId: input.carrierPlayerId,
    world: carried, response: { kind: 'unresolved', reason: 'carried_contact', cursor: null }, cursor: null } });
  const dt = (carried.moment.originTick - receiver.primitive.startTick) / p.ticksPerSecond + carried.moment.elapsedSeconds - (receiver.startElapsedSeconds ?? 0);
  const s = receiver.primitive, component = (axis: keyof Vec3) => s.startCenter[axis] + s.startVelocity[axis] * dt + 0.5 * s.acceleration[axis] * dt * dt;
  const launch = createDefensiveRatedThrowLaunch({ releaseTick: transfer.throwReadyTick, origin: carried.moment.ball.position,
    intendedTarget: { x: component('x'), y: component('y'), z: component('z') }, ratings: input.ratings, calibration: input.throwCalibration,
    rng: new SeedRoot(input.seed.matchSeed).streamRng(input.seed.playId, 'fielding', input.seed.streamKey) });
  const releaseCursor: BattedWorldBallCursor = { moment: { ...carried.moment, ball: { ...carried.moment.ball, velocity: launch.initialVelocity } }, previousContacts };
  const world = deriveBallWorldContinuation({ moment: releaseCursor.moment, previousContacts, actors, parameters: p,
    surfaces: input.response.world.surfaces, throughTick: input.throughTick });
  const response = respondToBattedWorldBoundary(input.response, releaseCursor, world);
  return freeze({ kind: 'released', transfer, launch, releaseCursor, motion: { actors, carrierPlayerId: null, world, response, cursor: response.cursor } });
};
