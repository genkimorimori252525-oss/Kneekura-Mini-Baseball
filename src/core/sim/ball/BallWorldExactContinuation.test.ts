import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from './BallFlight';
import * as world from './BallWorldContinuation';
import type { AcceleratedBallWorldFieldMotionInput, BallWorldFieldContinuationInput, BallWorldMotionActor } from './BallWorldContinuation';
import { quantizeEventTick } from '../ExactEventTime';

const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const bag = (x: number, z: number) => ({ region: { center: { x, z }, halfSize: { x: 0.25, z: 0.25 }, rotationRadians: 0 }, bottomY: 0, topY: 1 });
const bases = { home: bag(-100, -100), first: bag(100, 0), second: bag(100, 100), third: bag(0, 100) };
const actor = (x = 20, y = 2, z = 0, endTick = 3, playerId = 'defender'): BallWorldMotionActor => ({ playerId,
  primitive: { role: 'body', radius: 0.125, startTick: 0, endTick, ticksPerSecond: 1,
    startCenter: v(x, y, z), startVelocity: v(), acceleration: v() } });
const fixture = () => ({ moment: { originTick: 0, elapsedSeconds: 0, ball: { tick: 0, position: v(0, 2), velocity: v(1), spin: v() } },
  throughElapsedSeconds: 1.25, parameters: { ...DEFAULT_BALL_FLIGHT_PARAMETERS, ticksPerSecond: 1, gravityY: 0, ballRadius: 0.125,
    groundRollingDecelerationMps2: 1 }, actors: [actor()], surfaces: [], previousContacts: [], bases, previousBaseContacts: [] });
type ExactInput = Omit<BallWorldFieldContinuationInput, 'throughTick'> & { throughElapsedSeconds: number };
const query = (input: ExactInput) => {
  expect(world.deriveExactBallWorldFieldContinuationV1).toBeTypeOf('function');
  return world.deriveExactBallWorldFieldContinuationV1(input);
};
const constrained = (input: AcceleratedBallWorldFieldMotionInput) => {
  expect(world.deriveExactAcceleratedBallWorldFieldMotionV1).toBeTypeOf('function');
  return world.deriveExactAcceleratedBallWorldFieldMotionV1(input);
};
it('executes a real just-above-mathematical-T actor event that still quantizes to T', () => {
  const eventTime = 1 + 4e-10, throughElapsedSeconds = 1 + 8e-10;
  expect(quantizeEventTick(0, eventTime, 1)).toBe(1);
  const result = query({ ...fixture(), throughElapsedSeconds, actors: [actor(eventTime + 0.25)] });
  expect(result).toMatchObject({ kind: 'boundary', phase: 'airborne', contacts: [{ kind: 'actor', playerId: 'defender' }] });
  expect(result.moment.elapsedSeconds).toBe(eventTime);
  expect(result.moment.ball.tick).toBe(1);
  expect(result.moment.elapsedSeconds).not.toBe(throughElapsedSeconds);
});
it('refuses a quantized-T tail query with mathematical-T actor coverage but accepts the original T+1 curve', () => {
  const input = { ...fixture(), throughElapsedSeconds: 1 + 8e-10 };
  expect(() => query({ ...input, actors: [actor(20, 2, 0, 1)] })).toThrow(/coverage/);
  expect(query({ ...input, actors: [actor(20, 2, 0, 2)] })).toMatchObject({ kind: 'moving', throughTick: 1,
    moment: { elapsedSeconds: input.throughElapsedSeconds } });
  expect(query({ ...input, throughElapsedSeconds: 1, actors: [actor(20, 2, 0, 1)] }).moment.elapsedSeconds).toBe(1);
});
it('selects only the first distinct fractional contact in the same recorded bucket', () => {
  const result = query({ ...fixture(), actors: [actor(0.75, 2, 0, 3, 'first'), actor(1, 2, 0, 3, 'later')] });
  expect(result).toMatchObject({ kind: 'boundary', contacts: [{ kind: 'actor', playerId: 'first' }] });
  if (result.kind !== 'boundary') throw new Error('expected actual contact');
  expect(result.contacts).toHaveLength(1);
  expect(result.moment.elapsedSeconds).toBe(0.5);
});
it('retains actual simultaneous actor/panel/base contacts without a fake joint or collider exclusion', () => {
  const result = query({ ...fixture(), moment: { ...fixture().moment, ball: { ...fixture().moment.ball, position: v(0, 0.5) } },
    actors: [actor(1.25, 0.5)], surfaces: [{ surfaceId: 'panel', start: { x: 1.125, z: -2 }, end: { x: 1.125, z: 2 }, minimumHeight: 0, maximumHeight: 2 }],
    bases: { ...bases, first: bag(1.375, 0) } });
  expect(result).toMatchObject({ kind: 'boundary', moment: { elapsedSeconds: 1 }, contacts: [{ kind: 'actor' }, { kind: 'base' }, { kind: 'surface' }] });
});
it('preserves free airborne gravity and first ground boundary', () => {
  const input = fixture(), result = query({ ...input, parameters: { ...input.parameters, gravityY: -2 }, throughElapsedSeconds: 2 });
  expect(result).toMatchObject({ kind: 'boundary', phase: 'airborne', contacts: [{ kind: 'ground' }] });
  expect(result.moment.elapsedSeconds).toBe(Math.sqrt(1.875));
  expect(result.moment.ball.velocity.y).toBe(-2 * Math.sqrt(1.875));
});
it('preserves ordinary rolling deceleration, exact stop, then resting phase', () => {
  const input = fixture(), moment = { ...input.moment, ball: { ...input.moment.ball, position: v(0, 0.125) } };
  const rolling = query({ ...input, moment, throughElapsedSeconds: 0.25 });
  expect(rolling).toMatchObject({ kind: 'moving', phase: 'rolling', moment: { elapsedSeconds: 0.25, ball: { position: v(0.21875, 0.125), velocity: v(0.75) } } });
  const stopped = query({ ...input, moment, throughElapsedSeconds: 1.25 });
  expect(stopped).toMatchObject({ kind: 'boundary', phase: 'rolling', moment: { elapsedSeconds: 1, ball: { position: v(0.5, 0.125), velocity: v() } }, contacts: [{ kind: 'rolling_stop' }] });
  const resting = query({ ...input, moment: stopped.moment });
  expect(resting).toMatchObject({ kind: 'resting', phase: 'resting', moment: { elapsedSeconds: 1.25, ball: { position: v(0.5, 0.125), velocity: v() } } });
});
it('detects an actor striking a resting ball and an actor before a rolling stop', () => {
  const input = fixture(), a = actor(1, 0.125);
  const movingActor = { ...a, primitive: { ...a.primitive, startVelocity: v(-1) } };
  const moment = { ...input.moment, ball: { ...input.moment.ball, position: v(0, 0.125), velocity: v() } };
  expect(query({ ...input, moment, actors: [movingActor] })).toMatchObject({ kind: 'boundary', phase: 'resting', moment: { elapsedSeconds: 0.75 } });
  const roll = query({ ...input, moment: { ...moment, ball: { ...moment.ball, velocity: v(1) } }, actors: [actor(0.5, 0.125)] });
  expect(roll).toMatchObject({ kind: 'boundary', phase: 'rolling', contacts: [{ kind: 'actor' }] });
  expect(roll.moment.elapsedSeconds).toBeLessThan(1);
});
it('retains a prior touching panel as a simultaneous companion of the next actor', () => {
  const input = fixture(), panel = { surfaceId: 'panel', start: { x: -2, z: 0 }, end: { x: 2, z: 0 }, minimumHeight: 0, maximumHeight: 3 };
  const result = query({ ...input, moment: { ...input.moment, ball: { ...input.moment.ball, position: v(0, 2, 0.125) } },
    actors: [actor(1.25, 2, 0.125)], surfaces: [panel], previousContacts: [{ kind: 'surface', surfaceId: 'panel' }] });
  expect(result).toMatchObject({ kind: 'boundary', contacts: [{ kind: 'actor' }, { kind: 'surface', continuing: true }] });
});
it('keeps initial persistent contact pending and does not fake progress', () => {
  const input = fixture(), a = actor(0.25);
  const result = query({ ...input, actors: [{ ...a, primitive: { ...a.primitive, startVelocity: v(-1) } }],
    previousContacts: [{ kind: 'actor', playerId: 'defender', role: 'body' }] });
  expect(result).toMatchObject({ kind: 'boundary', pendingReason: 'persistent_contact', moment: { elapsedSeconds: 0 } });
});
it('uses horizon-independent non-axial contact roots with every ordinary collider present', () => {
  const input = fixture(), scope = { ...input, actors: [actor(1.25, 2.1)] };
  const short = query(scope), long = query({ ...scope, throughElapsedSeconds: 2 });
  expect(short.kind).toBe('boundary');
  expect(short).toEqual(long);
  expect(short.moment.elapsedSeconds).toBeCloseTo(1.25 - Math.sqrt(0.25 ** 2 - 0.1 ** 2), 12);
});
it('finds finite-panel corners without turning the extension into a surface', () => {
  const input = fixture(), panel = { surfaceId: 'corner', start: { x: 1, z: 0 }, end: { x: 1, z: 1 }, minimumHeight: 1, maximumHeight: 2 };
  const result = query({ ...input, moment: { ...input.moment, ball: { ...input.moment.ball, position: v(0, 0.95, -0.05) } }, surfaces: [panel] });
  expect(result).toMatchObject({ kind: 'boundary', contacts: [{ kind: 'surface', point: v(1, 1, 0) }] });
  expect(result.moment.elapsedSeconds).toBeCloseTo(1 - Math.sqrt(0.125 ** 2 - 0.05 ** 2 * 2), 12);
});
it('owns the exact contact-free endpoint without normalizing a real endpoint collision', () => {
  const input = fixture(), elapsedSeconds = 0.0000004, end = 0.000005;
  const result = query({ ...input, moment: { ...input.moment, elapsedSeconds, ball: { ...input.moment.ball, tick: 1 } }, throughElapsedSeconds: end });
  expect(result.moment.elapsedSeconds).toBe(end);
  const edge = query({ ...input, throughElapsedSeconds: 1, actors: [actor(1.25)] });
  expect(edge).toMatchObject({ kind: 'boundary', moment: { elapsedSeconds: 1 } });
});
it('preserves existing accelerated carried physics while checking exact coverage and all colliders', () => {
  const input = fixture(), a = actor(0, 2), glove = { ...a, primitive: { ...a.primitive, role: 'glove' as const, startVelocity: v(1), acceleration: v(0.25) } };
  const scope = { ...input, actors: [glove], acceleration: v(0.25), previousContacts: [{ kind: 'actor' as const, playerId: 'defender', role: 'glove' as const }] };
  expect(constrained(scope)).toMatchObject({ kind: 'moving', moment: { elapsedSeconds: 1.25, ball: { position: v(1.4453125, 2), velocity: v(1.3125) } } });
  expect(() => constrained({ ...scope, throughElapsedSeconds: 1 + 4e-10, actors: [{ ...glove, primitive: { ...glove.primitive, endTick: 1 } }] })).toThrow(/coverage/);
  const hit = constrained({ ...scope, actors: [glove, actor(1.375, 2, 0, 3, 'other')] });
  expect(hit).toMatchObject({ kind: 'boundary', contacts: [{ kind: 'actor', playerId: 'defender', continuing: true }, { kind: 'actor', playerId: 'other' }] });
});
it.each([0, 2 ** 52])('preserves exact non-binary clock domains from origin %s', (originTick) => {
  const input = fixture(), throughElapsedSeconds = 1 / 3 + 1e-10;
  const result = query({ ...input, moment: { ...input.moment, originTick, ball: { ...input.moment.ball, tick: originTick } }, throughElapsedSeconds,
    parameters: { ...input.parameters, ticksPerSecond: 3 }, actors: [{ ...actor(), primitive: { ...actor().primitive, startTick: originTick, endTick: originTick + 2, ticksPerSecond: 3 } }] });
  expect(result.moment.elapsedSeconds).toBe(throughElapsedSeconds);
  expect(result.moment.ball.tick).toBe(originTick + 1);
});
it('rejects invalid intervals, unsafe clocks, arithmetic overflow and active payloads', () => {
  const input = fixture();
  for (const throughElapsedSeconds of [-1, NaN, Infinity]) expect(() => query({ ...input, throughElapsedSeconds })).toThrow();
  expect(() => query({ ...input, throughElapsedSeconds: Number.MAX_SAFE_INTEGER + 1 })).toThrow();
  expect(() => query({ ...input, moment: { ...input.moment, ball: { ...input.moment.ball, velocity: v(Number.MAX_VALUE) } }, throughElapsedSeconds: 2 })).toThrow(/overflow/);
  let called = false;
  const active = { ...input, get throughElapsedSeconds() { called = true; return 1; } };
  expect(() => query(active)).toThrow();
  expect(called).toBe(false);
  expect(() => query({ ...input, result: 'completed' } as ExactInput)).toThrow();
});
it('keeps legacy free, field and accelerated query archive bytes unchanged', () => {
  const { throughElapsedSeconds: _, ...input } = fixture(), field = { ...input, throughTick: 2 };
  const { bases: _b, previousBaseContacts: _p, ...legacy } = field;
  const panel = { surfaceId: 'archive-panel', start: { x: 1.125, z: -1 }, end: { x: 1.125, z: 1 }, minimumHeight: 0, maximumHeight: 3 };
  const glove = { ...actor(0, 2), primitive: { ...actor(0, 2).primitive, role: 'glove' as const, startVelocity: v(1) } };
  const outputs = [world.deriveBallWorldContinuation(legacy), world.deriveBallWorldFieldContinuation(field),
    world.deriveAcceleratedBallWorldFieldMotion({ ...input, throughElapsedSeconds: 1.25, acceleration: v(0.25) }),
    world.deriveBallWorldContinuation({ ...legacy, actors: [actor(0.75)], surfaces: [panel] }),
    world.deriveBallWorldFieldContinuation({ ...field, actors: [actor(1.25)], surfaces: [panel] }),
    world.deriveBallWorldContinuation({ ...legacy, parameters: { ...legacy.parameters, gravityY: -2 } }),
    world.deriveBallWorldContinuation({ ...legacy, moment: { ...legacy.moment, ball: { ...legacy.moment.ball, position: v(10, 0.125) } } }),
    world.deriveGloveConstrainedBallWorldFieldMotion({ ...input, throughElapsedSeconds: 1.25, acceleration: v(), actors: [glove],
      previousContacts: [{ kind: 'actor', playerId: 'defender', role: 'glove' }], constraint: { playerId: 'defender', contactOffset: v() } })];
  expect(createHash('sha256').update(JSON.stringify(outputs)).digest('hex')).toBe('ce457e99eae1f2ba73fae54a8b358aac76ab435a776606b52e45bd8badd61d51');
});

it('samples every actual actor endpoint rather than its quantized endpoint', () => {
  const input = fixture(), a = actor(0, 20);
  expect(() => query({ ...input, throughElapsedSeconds: 1 + 4e-10, actors: [{ ...a, primitive: { ...a.primitive, startVelocity: v(Number.MAX_VALUE) } }] }))
    .toThrow('ball World motion arithmetic overflow');
  expect(() => query({ ...input, throughElapsedSeconds: 1 + 4e-10, actors: [actor(), actor(20, 10, 0, 1, 'uncovered')] })).toThrow(/coverage/);
});
it('refuses actors starting after the continuous cut even inside the same recorded tick', () => {
  const input = fixture(), moment = { ...input.moment, elapsedSeconds: 0.5, ball: { ...input.moment.ball, tick: 1 } };
  expect(() => query({ ...input, moment, actors: [{ ...actor(), startElapsedSeconds: 0.75 }] })).toThrow(/starts after/);
});
it('does not promote a near actor root after the exact horizon into an endpoint contact', () => {
  const input = fixture(), result = query({ ...input, throughElapsedSeconds: 1, actors: [actor(1.25 + 4e-10)] });
  expect(result).toMatchObject({ kind: 'moving', moment: { elapsedSeconds: 1 } });
  expect(query({ ...input, throughElapsedSeconds: 1 + 8e-10, actors: [actor(1.25 + 4e-10)] }).kind).toBe('boundary');
});
it('fails closed if a selected physical root composes beyond the exact requested horizon', () => {
  const input = fixture(), start = 5.066471592429789e-6, end = 0.847855530938653, duration = end - start;
  expect(start + duration).toBeGreaterThan(end);
  const scope = { ...input, moment: { ...input.moment, elapsedSeconds: start, ball: { ...input.moment.ball, tick: 1 } },
    throughElapsedSeconds: end, actors: [actor(duration + 0.25)] };
  expect(() => query(scope)).toThrow(/exact.*horizon/);
});

it.each([false, true])('does not retime an outside base endpoint or discard its simultaneous actor (actor=%s)', (includeActor) => {
  const input = fixture(), start = 5.066471592429789e-6, end = 0.847855530938653, duration = end - start;
  const scope = { ...input, moment: { ...input.moment, elapsedSeconds: start, ball: { ...input.moment.ball, tick: 1, position: v(0, 0.5) } },
    throughElapsedSeconds: end, actors: includeActor ? [actor(duration + 0.25, 0.5)] : [],
    bases: { ...bases, first: bag(duration + 0.375, 0) } };
  const long = query({ ...scope, throughElapsedSeconds: 1 });
  expect(long).toMatchObject({ kind: 'boundary', moment: { elapsedSeconds: start + duration } });
  if (long.kind !== 'boundary') throw new Error('expected actual boundary');
  expect(long.contacts.map((c) => c.kind)).toEqual(includeActor ? ['actor', 'base'] : ['base']);
  expect(() => query(scope)).toThrow(/exact.*horizon/);
});
