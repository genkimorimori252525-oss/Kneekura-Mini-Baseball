import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import * as baseBoundary from './BallWorldBaseBoundary';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from './BallFlight';
import { deriveExactBallWorldFieldContinuationV1, deriveExactAcceleratedBallWorldFieldMotionV1 } from './BallWorldContinuation';
const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const bag = (x: number, z: number) => ({ region: { center: { x, z }, halfSize: { x: 0.25, z: 0.25 }, rotationRadians: 0 }, bottomY: 0, topY: 1 });
const start = 5.066471592429789e-6, end = 0.847855530938653, duration = end - start;
const shapes = [
  { name: 'face', radius: 0.125, dx: 0.125, dy: 0, dz: 0 },
  { name: 'edge', radius: 0.3125, dx: 0.25, dy: 0.1875, dz: 0 },
  { name: 'corner', radius: 0.4375, dx: 0.375, dy: 0.1875, dz: 0.125 },
] as const;
const fixture = (shape: typeof shapes[number]) => {
  const y = shape.dy === 0 ? 0.5 : 1 + shape.dy, z = -shape.dz;
  return { moment: { originTick: 0, elapsedSeconds: start, ball: { tick: 1, position: v(0, y, z), velocity: v(1), spin: v() } },
    acceleration: v(), throughElapsedSeconds: end, ticksPerSecond: 1, ballRadius: shape.radius,
    bases: { home: bag(-100, -100), first: bag(duration + shape.dx + 0.25, shape.dz === 0 ? 0 : 0.25), second: bag(100, 100), third: bag(-100, 100) }, previousBaseContacts: [] };
};
it.each(shapes)('preserves $name raw base candidate times, with no endpoint rewriting', (shape) => {
  const input = fixture(shape), short = baseBoundary.findExactBallWorldBaseBoundaryCandidatesV1(input);
  const long = baseBoundary.findExactBallWorldBaseBoundaryCandidatesV1({ ...input, throughElapsedSeconds: 1 });
  expect(long).not.toBeNull();
  expect(short).not.toBeNull();
  expect(short!.moment.elapsedSeconds).toBe(start + duration);
  expect(short!.moment.elapsedSeconds).toBeGreaterThan(end);
  expect(short).toEqual(long);
});
it('keeps original and existing piecewise endpoint-normalization archive bytes', () => {
  const outputs = shapes.flatMap((shape) => [baseBoundary.findBallWorldBaseBoundary(fixture(shape)), baseBoundary.findPiecewiseBallWorldBaseBoundary(fixture(shape))]);
  expect(createHash('sha256').update(JSON.stringify(outputs)).digest('hex')).toBe('fcc09920b57ee21a2a974c1f5df8434afe693ae649d3c15b8e5f9036eb8370d2');
});
it.each(shapes)('does not adopt an outside $name candidate in ordinary or constrained exact physics', (shape) => {
  const input = fixture(shape), { acceleration, ticksPerSecond, ballRadius, ...rest } = input;
  const scope = { ...rest, parameters: { ...DEFAULT_BALL_FLIGHT_PARAMETERS, ticksPerSecond, gravityY: 0, ballRadius }, actors: [], surfaces: [], previousContacts: [] };
  for (const query of [deriveExactBallWorldFieldContinuationV1, (s: typeof scope) => deriveExactAcceleratedBallWorldFieldMotionV1({ ...s, acceleration })]) {
    const long = query({ ...scope, throughElapsedSeconds: 1 });
    expect(long.kind).toBe('boundary');
    expect(long.moment.elapsedSeconds).toBe(start + duration);
    expect(() => query(scope)).toThrow(/exact.*horizon/);
  }
});

const colliderSets = [['actor'], ['surface'], ['actor', 'base'], ['base', 'surface'], ['actor', 'surface'], ['actor', 'base', 'surface']] as const;
it.each(shapes.flatMap((shape) => colliderSets.map((colliders) => ({ shape, colliders, name: `${shape.name}: ${colliders.join('+')}` }))))(
  'preserves raw simultaneous roots and fails closed for $name', ({ shape, colliders }) => {
    const input = fixture(shape), { acceleration, ticksPerSecond, ballRadius, ...rest } = input, position = input.moment.ball.position;
    const included: readonly string[] = colliders;
    const actor = { playerId: 'defender', primitive: { role: 'body' as const, radius: shape.radius, startTick: 0, endTick: 3, ticksPerSecond: 1,
      startCenter: v(duration + 2 * shape.dx, position.y - 2 * shape.dy, position.z + 2 * shape.dz), startVelocity: v(), acceleration: v() } };
    const surface = { surfaceId: 'panel', start: { x: duration + shape.dx, z: shape.dz === 0 ? -1 : 0 },
      end: { x: duration + shape.dx, z: 1 }, minimumHeight: 0, maximumHeight: 1 };
    const scope = { ...rest, bases: included.includes('base') ? rest.bases : { ...rest.bases, first: bag(100, 0) },
      parameters: { ...DEFAULT_BALL_FLIGHT_PARAMETERS, ticksPerSecond, gravityY: 0, ballRadius },
      actors: included.includes('actor') ? [actor] : [], surfaces: included.includes('surface') ? [surface] : [], previousContacts: [] };
    for (const query of [deriveExactBallWorldFieldContinuationV1, (s: typeof scope) => deriveExactAcceleratedBallWorldFieldMotionV1({ ...s, acceleration })]) {
      const long = query({ ...scope, throughElapsedSeconds: 1 });
      expect(long.kind).toBe('boundary');
      if (long.kind !== 'boundary') throw new Error('expected actual boundary');
      expect(long.moment.elapsedSeconds).toBe(start + duration);
      expect(long.contacts.map((c) => c.kind)).toEqual(colliders);
      expect(() => query(scope)).toThrow(/exact.*horizon/);
    }
  });
it('retains a valid earlier actor boundary ahead of a later unrepresentable base candidate', () => {
  const input = fixture(shapes[0]), { acceleration: _, ticksPerSecond, ballRadius, ...rest } = input;
  const scope = { ...rest, parameters: { ...DEFAULT_BALL_FLIGHT_PARAMETERS, ticksPerSecond, gravityY: 0, ballRadius }, surfaces: [], previousContacts: [],
    actors: [{ playerId: 'early', primitive: { role: 'body' as const, radius: 0.125, startTick: 0, endTick: 3, ticksPerSecond: 1,
      startCenter: v(0.75, 0.5), startVelocity: v(), acceleration: v() } }] };
  const result = deriveExactBallWorldFieldContinuationV1(scope);
  expect(result).toMatchObject({ kind: 'boundary', moment: { elapsedSeconds: start + 0.5 }, contacts: [{ kind: 'actor', playerId: 'early' }] });
});
