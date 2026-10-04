import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import type { DefenderPhysicalPrimitiveRole } from '../fielding/DefenderPhysicalPrimitive';
import { deriveAcceleratedBallWorldMotion, deriveBallWorldContinuation, type AcceleratedBallWorldMotion,
  type BallWorldContinuation, type BallWorldMotionActor } from './BallWorldContinuation';
import type { BattedBallContactResponseInput } from './BattedBallContactResponse';
import { respondToBattedWorldBoundary, type BattedWorldBallCursor, type BattedWorldContinuationStepResponse } from './BattedWorldContinuation';

export type BattedWorldPrimitiveMotionCommand = Readonly<{ playerId: string; role: DefenderPhysicalPrimitiveRole; acceleration: Vec3 }>;
export type BattedWorldMotionInput = Readonly<{
  response: BattedBallContactResponseInput; cursor: BattedWorldBallCursor; actors: readonly BallWorldMotionActor[];
  carrierPlayerId: string | null; availableAtTick: number; throughTick: number; commands: readonly BattedWorldPrimitiveMotionCommand[];
}>;
type CarriedResponse = Readonly<{ kind: 'carried'; cursor: BattedWorldBallCursor }>
  | Readonly<{ kind: 'unresolved'; reason: 'carried_contact'; cursor: null }>;
export type BattedWorldMotion = Readonly<{
  actors: readonly BallWorldMotionActor[]; carrierPlayerId: string | null;
  world: BallWorldContinuation | AcceleratedBallWorldMotion;
  response: BattedWorldContinuationStepResponse | CarriedResponse; cursor: BattedWorldBallCursor | null;
}>;
const vector = (value: Vec3) => !!value && [value.x, value.y, value.z].every(Number.isFinite);
const tick = (value: number) => Number.isSafeInteger(value) && value >= 0;
const key = (playerId: string, role: string) => JSON.stringify([playerId, role]);
const freeze = <T>(value: T): T => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

/** Shared actor basis for accepted future motion, including a transfer that must stop before its release. */
const prepareMotion = (raw: BattedWorldMotionInput, exactCoverage = false) => {
  const input = cloneInert(raw), moment = input?.cursor?.moment, p = input?.response?.world?.parameters;
  if (!moment || !p || !tick(input.availableAtTick)
    || (exactCoverage ? (input.availableAtTick - moment.originTick) / p.ticksPerSecond > moment.elapsedSeconds : input.availableAtTick > moment.ball.tick)
    || !tick(input.throughTick)
    || (exactCoverage ? (input.throughTick - moment.originTick) / p.ticksPerSecond <= moment.elapsedSeconds : input.throughTick <= moment.ball.tick) || !Array.isArray(input.actors) || !input.actors.length
    || !Array.isArray(input.commands) || input.commands.length !== input.actors.length
    || input.carrierPlayerId !== null && (typeof input.carrierPlayerId !== 'string' || !input.carrierPlayerId.length)) throw new Error('invalid accepted batted motion interval');
  const commands = new Map(input.commands.map((command) => [key(command.playerId, command.role), command]));
  if (commands.size !== input.commands.length || input.commands.some((command) => !vector(command.acceleration)
    || Object.keys(command).sort().join('|') !== 'acceleration|playerId|role')) throw new Error('invalid accepted batted motion commands');
  const actorKeys = new Set<string>();
  const actors = input.actors.map((actor): BallWorldMotionActor => {
    const s = actor.primitive, actorKey = key(actor.playerId, s.role), command = commands.get(actorKey);
    const dt = (moment.originTick - s.startTick) / p.ticksPerSecond + moment.elapsedSeconds - (actor.startElapsedSeconds ?? 0);
    if (!command || actorKeys.has(actorKey) || !tick(s.startTick) || !tick(s.endTick) || (exactCoverage ? moment.elapsedSeconds > (s.endTick - moment.originTick) / p.ticksPerSecond : s.endTick < moment.ball.tick)
      || s.ticksPerSecond !== p.ticksPerSecond || !Number.isFinite(dt) || dt < 0 || !vector(s.startCenter)
      || !vector(s.startVelocity) || !vector(s.acceleration) || actor.startElapsedSeconds !== undefined
        && (!Number.isFinite(actor.startElapsedSeconds) || actor.startElapsedSeconds < 0)
      || !input.response.actors.some((profile) => key(profile.playerId, profile.profile.role) === actorKey)) throw new Error('batted motion prior actor basis differs');
    actorKeys.add(actorKey);
    const component = (axis: keyof Vec3) => s.startCenter[axis] + s.startVelocity[axis] * dt + 0.5 * s.acceleration[axis] * dt * dt;
    const velocity = (axis: keyof Vec3) => s.startVelocity[axis] + s.acceleration[axis] * dt;
    const startCenter = { x: component('x'), y: component('y'), z: component('z') }, startVelocity = { x: velocity('x'), y: velocity('y'), z: velocity('z') };
    if (!vector(startCenter) || !vector(startVelocity)) throw new Error('batted motion actor arithmetic overflow');
    return { playerId: actor.playerId, startElapsedSeconds: moment.elapsedSeconds, primitive: { ...s,
      startTick: moment.originTick, endTick: input.throughTick, startCenter, startVelocity, acceleration: command.acceleration } };
  });
  if (actors.length !== input.response.actors.length) throw new Error('batted motion complete actor coverage differs');
  return { input, actors };
};
/** Exact-time preparation used only by the additive versioned checkpoint contract. */
export const deriveBattedWorldMotionActorsAtExactCoverage = (raw: BattedWorldMotionInput): readonly BallWorldMotionActor[] => freeze(prepareMotion(raw, true).actors);
export const deriveBattedWorldMotionActors = (raw: BattedWorldMotionInput): readonly BallWorldMotionActor[] => freeze(prepareMotion(raw).actors);

/** Starts accepted future motion at the true preceding state. A caller result or old trajectory never selects a new start. */
export const deriveBattedWorldMotion = (raw: BattedWorldMotionInput): BattedWorldMotion => {
  const { input, actors } = prepareMotion(raw), moment = input.cursor.moment, p = input.response.world.parameters;
  const query = { moment, parameters: p, actors, surfaces: input.response.world.surfaces, previousContacts: input.cursor.previousContacts };
  if (input.carrierPlayerId !== null) {
    const glove = actors.find((actor) => actor.playerId === input.carrierPlayerId && actor.primitive.role === 'glove');
    if (!glove) throw new Error('actual batted motion acquiring glove is missing');
    const tolerance = Number.EPSILON * Math.max(1, ...Object.values(moment.ball.velocity).map(Math.abs), ...Object.values(glove.primitive.startVelocity).map(Math.abs)) * 32;
    if (Object.keys(moment.ball.velocity).some((axis) => Math.abs(moment.ball.velocity[axis as keyof Vec3] - glove.primitive.startVelocity[axis as keyof Vec3]) > tolerance)) {
      throw new Error('actual batted motion carried velocity differs');
    }
    const previousContacts = [...query.previousContacts];
    if (!previousContacts.some((contact) => contact.kind === 'actor' && contact.playerId === input.carrierPlayerId && contact.role === 'glove')) {
      previousContacts.push({ kind: 'actor', playerId: input.carrierPlayerId, role: 'glove' });
    }
    const world = deriveAcceleratedBallWorldMotion({ ...query, previousContacts, acceleration: glove.primitive.acceleration,
      throughElapsedSeconds: (input.throughTick - moment.originTick) / p.ticksPerSecond });
    const response: CarriedResponse = world.kind === 'boundary' ? { kind: 'unresolved', reason: 'carried_contact', cursor: null }
      : { kind: 'carried', cursor: { moment: world.moment, previousContacts } };
    return freeze({ actors, carrierPlayerId: input.carrierPlayerId, world, response, cursor: response.cursor });
  }
  const world = deriveBallWorldContinuation({ ...query, throughTick: input.throughTick });
  const response = respondToBattedWorldBoundary(input.response, input.cursor, world);
  return freeze({ actors, carrierPlayerId: null, world, response, cursor: response.cursor });
};
