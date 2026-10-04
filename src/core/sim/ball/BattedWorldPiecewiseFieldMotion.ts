import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import { quantizeEventTick } from '../ExactEventTime';
import { deriveGloveConstrainedBallWorldFieldMotion, type BallWorldCollider, type BallWorldMoment, type BallWorldMotionActor } from './BallWorldContinuation';
import type { BattedBallContactResponseInput } from './BattedBallContactResponse';
import type { BattedWorldFieldGeometry } from './BattedWorldFieldMotion';
import { battedWorldFieldExecutionBoundary, battedWorldFieldExecutionPrevious, freezeBattedWorldField, hasBattedWorldFieldFields } from './BattedWorldFieldExecution';
import { deriveBattedWorldMotionActorsAtExactCoverage } from './BattedWorldMotion';

/** Internal Core input. Native alone owns command selection and provenance. */
export type PiecewiseFieldMotionStep = Readonly<{ throughElapsedSeconds: number;
  actors: Readonly<{ kind: 'retained' }> | Readonly<{ kind: 'adopted'; actors: readonly BallWorldMotionActor[] }>; }>;
export type BattedWorldPiecewiseFieldMotionPiece = Readonly<{ anchorMoment: BallWorldMoment; actors: readonly BallWorldMotionActor[];
  constraint: Readonly<{ playerId: string; contactOffset: Vec3 }>; previousContacts: readonly BallWorldCollider[]; }>;
export const piecewiseFiniteData = (value: unknown): boolean => typeof value === 'number' ? Number.isFinite(value)
  : value !== null && typeof value === 'object' ? Object.values(value).every(piecewiseFiniteData) : true;
export const piecewiseEqual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const tick = (value: number) => Number.isSafeInteger(value) && value >= 0;
const vector = (value: Vec3) => hasBattedWorldFieldFields(value, ['x', 'y', 'z']) && Object.values(value).every(Number.isFinite);

/** Validate actual current coverage only; never require or execute an operation's future due time. */
export const validatePiecewiseFieldActors = (response: BattedBallContactResponseInput, moment: BallWorldMoment,
  actors: readonly BallWorldMotionActor[]): number => {
  const p = response.world.parameters;
  if (!tick(moment.originTick) || moment.originTick !== response.world.flight.initialBall.tick || !Number.isFinite(moment.elapsedSeconds) || moment.elapsedSeconds < 0
    || !tick(moment.ball.tick) || quantizeEventTick(moment.originTick, moment.elapsedSeconds, p.ticksPerSecond) !== moment.ball.tick
    || !vector(moment.ball.position) || !vector(moment.ball.velocity) || !vector(moment.ball.spin)
    || !Array.isArray(actors) || actors.length !== response.actors.length || !actors.length) throw new Error('invalid piecewise actor clock or coverage');
  const keys = new Set<string>(); let endTick = Number.MAX_SAFE_INTEGER;
  for (const a of actors) {
    const s = a?.primitive, key = JSON.stringify([a?.playerId, s?.role]);
    const original = response.world.actors.find((o) => o.playerId === a?.playerId && o.primitive.role === s?.role);
    if (!s || !original || keys.has(key) || !hasBattedWorldFieldFields(a, a.startElapsedSeconds === undefined ? ['playerId', 'primitive'] : ['playerId', 'primitive', 'startElapsedSeconds'])
      || !hasBattedWorldFieldFields(s, ['role', 'radius', 'startTick', 'endTick', 'ticksPerSecond', 'startCenter', 'startVelocity', 'acceleration'])
      || !tick(s.startTick) || !tick(s.endTick) || s.startTick > moment.ball.tick || s.ticksPerSecond !== p.ticksPerSecond
      || !Number.isFinite(s.radius) || s.radius <= 0 || s.radius !== original.primitive.radius
      || !vector(s.startCenter) || !vector(s.startVelocity) || !vector(s.acceleration)
      || a.startElapsedSeconds !== undefined && (!Number.isFinite(a.startElapsedSeconds) || a.startElapsedSeconds < 0)
      || moment.elapsedSeconds > (s.endTick - moment.originTick) / p.ticksPerSecond
      || !response.actors.some((o) => o.playerId === a.playerId && o.profile.role === s.role)) throw new Error('piecewise actor identity or coverage differs');
    samplePiecewiseFieldActor(a, moment); keys.add(key); endTick = Math.min(endTick, s.endTick);
  }
  return endTick;
};
export const samplePiecewiseFieldActor = (actor: BallWorldMotionActor, moment: BallWorldMoment) => {
  const s = actor.primitive, dt = (moment.originTick - s.startTick) / s.ticksPerSecond + moment.elapsedSeconds - (actor.startElapsedSeconds ?? 0);
  if (!Number.isFinite(dt) || dt < 0) throw new Error('piecewise actor starts after actual moment');
  const component = (axis: keyof Vec3) => s.startCenter[axis] + s.startVelocity[axis] * dt + 0.5 * s.acceleration[axis] * dt * dt;
  const velocity = (axis: keyof Vec3) => s.startVelocity[axis] + s.acceleration[axis] * dt;
  const state = { center: { x: component('x'), y: component('y'), z: component('z') }, velocity: { x: velocity('x'), y: velocity('y'), z: velocity('z') } };
  if (!piecewiseFiniteData(state)) throw new Error('piecewise actor arithmetic overflow');
  return state;
};
export const piecewiseGloveContacts = (contacts: readonly BallWorldCollider[], playerId: string): readonly BallWorldCollider[] =>
  contacts.some((c) => c.kind === 'actor' && c.playerId === playerId && c.role === 'glove') ? contacts
    : [...contacts, { kind: 'actor', playerId, role: 'glove' }];

/** Retention keeps the exact anchor. Adoption proves every primitive's position and velocity at the current cut. */
export const adoptPiecewiseFieldMotionStep = (response: BattedBallContactResponseInput, piece: BattedWorldPiecewiseFieldMotionPiece,
  current: BallWorldMoment, raw: PiecewiseFieldMotionStep): BattedWorldPiecewiseFieldMotionPiece => {
  const step = cloneInert(raw);
  if (!hasBattedWorldFieldFields(step, ['throughElapsedSeconds', 'actors']) || !Number.isFinite(step.throughElapsedSeconds)
    || step.throughElapsedSeconds < current.elapsedSeconds || !step.actors) throw new Error('invalid piecewise motion step');
  quantizeEventTick(current.originTick, step.throughElapsedSeconds, response.world.parameters.ticksPerSecond);
  validatePiecewiseFieldActors(response, current, piece.actors);
  if (step.actors.kind === 'retained' && hasBattedWorldFieldFields(step.actors, ['kind'])) return piece;
  if (step.actors.kind !== 'adopted' || !hasBattedWorldFieldFields(step.actors, ['kind', 'actors'])) throw new Error('invalid piecewise actor selection');
  const actors = step.actors.actors, coverage = validatePiecewiseFieldActors(response, current, actors);
  const expected = deriveBattedWorldMotionActorsAtExactCoverage({ response, actors: piece.actors, cursor: { moment: current, previousContacts: piece.previousContacts },
    carrierPlayerId: piece.constraint.playerId, availableAtTick: current.originTick, throughTick: coverage,
    commands: actors.map((a) => ({ playerId: a.playerId, role: a.primitive.role, acceleration: a.primitive.acceleration })) });
  if (!piecewiseEqual(expected.map((a, index) => ({ ...a, primitive: { ...a.primitive, endTick: actors[index].primitive.endTick } })), actors)) {
    throw new Error('piecewise adopted actors are discontinuous or change original identity');
  }
  return freezeBattedWorldField({ ...piece, anchorMoment: current, actors });
};
export const queryPiecewiseFieldMotion = (response: BattedBallContactResponseInput, geometry: BattedWorldFieldGeometry,
  piece: BattedWorldPiecewiseFieldMotionPiece, throughElapsedSeconds: number) => {
  const glove = piece.actors.find((a) => a.playerId === piece.constraint.playerId && a.primitive.role === 'glove');
  if (!glove) throw new Error('piecewise constrained glove is missing');
  const executed = battedWorldFieldExecutionBoundary(deriveGloveConstrainedBallWorldFieldMotion({ moment: piece.anchorMoment,
    actors: piece.actors, constraint: piece.constraint, acceleration: glove.primitive.acceleration, parameters: response.world.parameters,
    surfaces: response.world.surfaces, bases: geometry.bases, ...battedWorldFieldExecutionPrevious(piece.previousContacts), throughElapsedSeconds }));
  if (executed.world.kind === 'boundary') return executed;
  // The contact-free query establishes this exact endpoint, without changing sampled position or velocity.
  const moment = { ...executed.world.moment, elapsedSeconds: throughElapsedSeconds,
    ball: { ...executed.world.moment.ball, tick: quantizeEventTick(piece.anchorMoment.originTick, throughElapsedSeconds, response.world.parameters.ticksPerSecond) } };
  return { ...executed, world: { ...executed.world, moment } };
};


/** A long recorded sequence is a list of separately bounded inert payloads,
 * never one recursively nested snapshot subject to an aggregate clone cap. */
export const clonePiecewiseReplayInput = <T extends Readonly<{ steps: readonly PiecewiseFieldMotionStep[] }>>(
  raw: T, fields: readonly string[]): T => {
  if (!hasBattedWorldFieldFields(raw, fields) || (Object.getPrototypeOf(raw) !== Object.prototype && Object.getPrototypeOf(raw) !== null)
    || Reflect.ownKeys(raw).length !== fields.length) throw new Error('invalid piecewise replay scope');
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(raw, field);
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) throw new Error('piecewise replay requires inert fields');
    if (field !== 'steps') { result[field] = cloneInert(descriptor.value); continue; }
    const steps = descriptor.value;
    if (!Array.isArray(steps) || !steps.length || Reflect.ownKeys(steps).length !== steps.length + 1) throw new Error('invalid piecewise replay steps');
    result.steps = Array.from({ length: steps.length }, (_, index) => {
      const item = Object.getOwnPropertyDescriptor(steps, String(index));
      if (!item || !item.enumerable || !('value' in item)) throw new Error('piecewise replay requires dense inert steps');
      return cloneInert(item.value);
    });
  }
  return result as T;
};
