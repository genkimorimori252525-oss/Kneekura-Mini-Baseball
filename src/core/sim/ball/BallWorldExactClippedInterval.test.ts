import { expect, it } from 'vitest';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from './BallFlight';
import { findExactBallWorldBaseBoundaryCandidatesV1 } from './BallWorldBaseBoundary';
import { deriveExactBallWorldFieldContinuationV1 as free, deriveExactAcceleratedBallWorldFieldMotionV1 as constrained } from './BallWorldContinuation';
const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const bag = (x: number, z: number, topY = 1) => ({ region: { center: { x, z }, halfSize: { x: 0.25, z: 0.25 }, rotationRadians: 0 }, bottomY: topY - 1, topY });
const fixture = (start: number, local: number, rolling = false) => ({
  moment: { originTick: 0, elapsedSeconds: start, ball: { tick: start === 0 ? 0 : 1, position: v(0, rolling ? 0.125 : local + 0.125), velocity: v(1, rolling ? 0 : -1), spin: v() } },
  throughElapsedSeconds: 1, parameters: { ...DEFAULT_BALL_FLIGHT_PARAMETERS, ticksPerSecond: 1, gravityY: 0, ballRadius: 0.125, groundRollingDecelerationMps2: 16 },
  actors: [], surfaces: [], previousContacts: [], bases: { home: bag(-100, -100), first: bag(rolling ? 0.40625 : local + 0.375, 0), second: bag(100, 100), third: bag(-100, 100) }, previousBaseContacts: [],
});
it.each(['free', 'constrained'] as const)('preserves a positive-height base side simultaneous with %s ground at the original local cut', (kind) => {
  const start = 0.0006065495116636157, local = 0.06196985277347267, scope = fixture(start, local);
  expect((start + local) - start).toBeLessThan(local);
  const result = kind === 'free' ? free(scope) : constrained({ ...scope, acceleration: v() });
  expect(result.kind).toBe('boundary');
  if (result.kind !== 'boundary') throw new Error('expected actual boundary');
  expect(result.contacts.map((c) => c.kind)).toEqual(['base', 'ground']);
  expect(result.moment.elapsedSeconds).toBe(start + local);
});
it('preserves a base contact simultaneous with the original local rolling-stop cut', () => {
  const start = 0.00034382994892075656, local = 0.0625;
  expect((start + local) - start).toBeLessThan(local);
  const result = free(fixture(start, local, true));
  expect(result.kind).toBe('boundary');
  if (result.kind !== 'boundary') throw new Error('expected actual boundary');
  expect(result.contacts.map((c) => c.kind)).toEqual(['base', 'rolling_stop']);
  expect(result.moment.elapsedSeconds).toBe(start + local);
});

const starts = [0, 0.00034382994892075656, 0.965, 0.999];
const durations = [0.0625, 0.09375];
const kinds = ['free_ground', 'constrained_ground', 'rolling_stop'] as const;
const clippedCases = kinds.flatMap((kind) => starts.flatMap((start) => durations.map((local) => ({ kind, start, local }))));
const mixed = (kind: typeof kinds[number], start: number, local: number) => {
  const rolling = kind === 'rolling_stop', radius = 4.375, speed = rolling ? 16 * local : 1;
  const atX = rolling ? speed * local - 8 * local * local : local;
  const base = (x: number, z: number, topY: number) => ({ ...bag(x, z, topY), bottomY: 0 });
  const scope = { moment: { originTick: 0, elapsedSeconds: start, ball: { tick: start === 0 ? 0 : 1, position: v(0, radius + (rolling ? 0 : local)),
    velocity: v(speed, rolling ? 0 : -1), spin: v() } }, throughElapsedSeconds: 2,
    parameters: { ...DEFAULT_BALL_FLIGHT_PARAMETERS, ticksPerSecond: 1, gravityY: 0, ballRadius: radius, groundRollingDecelerationMps2: 16 },
    actors: [{ playerId: 'ordinary', primitive: { role: 'body' as const, radius: 0.125, startTick: 0, endTick: 3, ticksPerSecond: 1,
      startCenter: v(atX + 4.5, radius), startVelocity: v(), acceleration: v() } }],
    surfaces: [{ surfaceId: 'panel', start: { x: atX + radius, z: -10 }, end: { x: atX + radius, z: 10 }, minimumHeight: 0, maximumHeight: radius + 2 }], previousContacts: [],
    bases: { home: base(atX + radius + 0.25, 0, radius + 2), first: base(atX + 3.5 + 0.25, 0, radius - 2.625),
      second: base(atX + 3.75 + 0.25, 1.5, radius - 1.875), third: base(100, 100, radius + 2) }, previousBaseContacts: [] };
  return scope;
};
const run = (kind: typeof kinds[number], scope: ReturnType<typeof mixed>) => kind === 'constrained_ground' ? constrained({ ...scope, acceleration: v() }) : free(scope);
it.each(clippedCases)('retains mixed face/edge/corner/actor/panel at $kind, origin $start, local $local', ({ kind, start, local }) => {
  const result = run(kind, mixed(kind, start, local));
  expect(result.kind).toBe('boundary');
  if (result.kind !== 'boundary') throw new Error('expected clipped physical boundary');
  expect(result.moment.elapsedSeconds).toBe(start + local);
  expect(result.contacts.map((c) => c.kind === 'base' ? c.baseId : c.kind)).toEqual(['actor', 'first', 'home', 'second', kind === 'rolling_stop' ? 'rolling_stop' : 'ground', 'surface']);
  expect(result.contacts.filter((c) => c.kind === 'base').map((c) => c.point)).toEqual([
    v((kind === 'rolling_stop' ? 8 * local * local : local) + 3.5, 1.75),
    v((kind === 'rolling_stop' ? 8 * local * local : local) + 4.375, 4.375),
    v((kind === 'rolling_stop' ? 8 * local * local : local) + 3.75, 2.5, 1.25),
  ]);
});
it('exercises both shrinking and widening add/subtract round trips without changing the local phase cut', () => {
  expect((starts[1] + 0.0625) - starts[1]).toBeLessThan(0.0625);
  expect((starts[2] + 0.09375) - starts[2]).toBeLessThan(0.09375);
  expect((starts[3] + 0.0625) - starts[3]).toBeGreaterThan(0.0625);
  expect((starts[3] + 0.09375) - starts[3]).toBeGreaterThan(0.09375);
});
it.each(kinds)('keeps a contact-free cut before $kind and the same first boundary after it', (kind) => {
  const start = 0.999, local = 0.0625, scope = mixed(kind, start, local), end = start + local / 2;
  const first = run(kind, { ...scope, throughElapsedSeconds: end });
  expect(first.kind).toBe('moving');
  expect(first.moment.elapsedSeconds).toBe(end);
  const at = run(kind, scope);
  expect(at.kind).toBe('boundary');
  if (at.kind !== 'boundary') throw new Error('expected physical boundary');
  expect(at.contacts).toHaveLength(6);
});
it.each(kinds)('retains an earlier actor before the clipped $kind family', (kind) => {
  const start = 0.999, local = 0.0625, scope = mixed(kind, start, local), actor = scope.actors[0];
  const earlier = { ...actor, primitive: { ...actor.primitive, startCenter: v(4.5 + 0.0078125, scope.moment.ball.position.y) } };
  const result = run(kind, { ...scope, actors: [earlier] });
  expect(result.kind).toBe('boundary');
  if (result.kind !== 'boundary') throw new Error('expected first actor');
  expect(result.contacts.map((c) => c.kind)).toEqual(['actor']);
  expect(result.moment.elapsedSeconds).toBeLessThan(start + local);
});

it.each(['free_ground', 'constrained_ground'] as const)('does not widen $kind to a later base root which rounds to the same absolute time', (kind) => {
  const start = 0.999, local = 0.0625, later = local + 2 ** -56;
  expect(later).toBeGreaterThan(local);
  expect((start + local) - start).toBeGreaterThan(later);
  expect(start + later).toBe(start + local);
  const input = fixture(start, local), scope = { ...input, throughElapsedSeconds: 2,
    moment: { ...input.moment, ball: { ...input.moment.ball, velocity: v(16, -1) } },
    bases: { ...input.bases, first: bag(16 * later + 0.375, 0) } };
  const result = kind === 'free_ground' ? free(scope) : constrained({ ...scope, acceleration: v() });
  expect(result.kind).toBe('boundary');
  if (result.kind !== 'boundary') throw new Error('expected ground');
  expect(result.contacts.map((c) => c.kind)).toEqual(['ground']);
});
it('checks owner-local duration bounds without replacing the original absolute request', () => {
  const input = fixture(0.999, 0.0625), raw = { moment: input.moment, acceleration: v(), throughElapsedSeconds: 2, ticksPerSecond: 1, ballRadius: 0.125,
    bases: input.bases, previousBaseContacts: [] };
  expect(findExactBallWorldBaseBoundaryCandidatesV1(raw, 0)).toBeNull();
  expect(findExactBallWorldBaseBoundaryCandidatesV1(raw, 0.0625)?.moment.elapsedSeconds).toBe(0.999 + 0.0625);
  for (const duration of [-1, NaN, Infinity, 1.002]) expect(() => findExactBallWorldBaseBoundaryCandidatesV1(raw, duration)).toThrow(/local duration/);
});
it.each([0.965, 0.999])('preserves mixed nonzero-acceleration ground clips at origin %s', (start) => {
  const local = 0.0625, scope = mixed('free_ground', start, local), radius = scope.parameters.ballRadius;
  const falling = { ...scope, parameters: { ...scope.parameters, gravityY: -2 },
    moment: { ...scope.moment, ball: { ...scope.moment.ball, position: v(0, radius + local * local), velocity: v(1) } } };
  const turning = { ...scope, moment: { ...scope.moment, ball: { ...scope.moment.ball,
    position: v(0, radius + local * local), velocity: v(1, -2 * local) } }, acceleration: v(0, 2) };
  for (const result of [free(falling), constrained(turning)]) {
    expect(result.kind).toBe('boundary');
    if (result.kind !== 'boundary') throw new Error('expected accelerated ground clip');
    expect(result.moment.elapsedSeconds).toBe(start + local);
    expect(result.contacts.map((c) => c.kind === 'base' ? c.baseId : c.kind)).toEqual(['actor', 'first', 'home', 'second', 'ground', 'surface']);
  }
});
