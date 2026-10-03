import { expect, it } from 'vitest';
import { deriveBallWorldPlayerBaseContactHistory as history, type BallWorldPlayerBaseContactSegment } from './BallWorldPlayerBaseContactHistory';

const base = { center: { x: 0, z: 0 }, halfSize: { x: 0.2, z: 0.2 }, rotationRadians: 0 };
const segment = (start = 0, end = 4, x = 3, velocity = -4, acceleration = 2, originTick = 0): BallWorldPlayerBaseContactSegment => ({
  originTick, startElapsedSeconds: start, endElapsedSeconds: end,
  actors: (['left_foot', 'right_foot'] as const).map((role) => ({ playerId: 'runner', startElapsedSeconds: start,
    primitive: { role, radius: 0.1, startTick: originTick, endTick: originTick + 4_000_000, ticksPerSecond: 1_000_000,
      startCenter: { x, y: 0, z: 0 }, startVelocity: { x: velocity, y: 0, z: 0 }, acceleration: { x: acceleration, y: 0, z: 0 } } })) });
const query = (segments: readonly BallWorldPlayerBaseContactSegment[]) => ({ segments, playerId: 'runner', base, baseSurfaceHeightMeters: 0 });
it.each([2.5, 4.75])('does not fabricate departure and retouch around an exact %s-second tangency', (seconds) => {
  const s = segment(0, 5, 0, 0, 0), actors = s.actors.map((actor) => ({ ...actor,
    primitive: { ...actor.primitive, endTick: 5_000_000,
      startCenter: { x: 0, y: seconds * seconds, z: 0 },
      startVelocity: { x: 0, y: -2 * seconds, z: 0 }, acceleration: { x: 0, y: 2, z: 0 } } }));
  const actual = history(query([{ ...s, actors }]));
  expect(actual.episodes).toEqual([{ startElapsedSeconds: seconds, endElapsedSeconds: seconds }]);
  expect(actual.events.map(({ kind, elapsedSeconds, tick }) => ({ kind, elapsedSeconds, tick }))).toEqual([
    { kind: 'touch', elapsedSeconds: seconds, tick: seconds * 1_000_000 },
    { kind: 'departure', elapsedSeconds: seconds, tick: seconds * 1_000_000 },
  ]);
});
it('records actual touch, departure and retouch inside one accelerating segment without choosing a baseball ruling', () => {
  const result = history(query([segment()]));
  expect(result.episodes).toHaveLength(2);
  expect(result.events.map((e) => e.kind)).toEqual(['touch', 'departure', 'touch', 'departure']);
  expect(result.events[0].elapsedSeconds).toBeCloseTo(2 - Math.sqrt(1.2), 14);
  expect(result.events[1].elapsedSeconds).toBeCloseTo(2 - Math.sqrt(0.8), 14);
  expect(result.contactAtHorizon).toBe(false);
  expect(result).not.toHaveProperty('safe'); expect(result).not.toHaveProperty('officialOccupancy');
});
it('does not report departure while the other foot still contacts the base', () => {
  const source = segment(0, 2, 0, 1, 0), actors = source.actors.map((a, i) => i === 0 ? a : { ...a, primitive: { ...a.primitive,
    startCenter: { x: -0.1, y: 0, z: 0 }, startVelocity: { x: 0.2, y: 0, z: 0 } } });
  const result = history(query([{ ...source, actors }]));
  expect(result.episodes).toHaveLength(1);
  expect(result.events.map((e) => e.kind)).toEqual(['touch', 'departure']);
  expect(result.events[1].elapsedSeconds).toBeCloseTo(1.5, 14);
});
it('merges continuous rebases and repeated identical observations without duplicate facts', () => {
  const first = segment(0, 2), second = segment(2, 4, -1, 0, 2);
  const result = history(query([first, first, second, second]));
  expect(result).toEqual(history(query([first, second])));
  const uninterrupted = history(query([segment()]));
  expect(result.events.map(({ kind, tick }) => ({ kind, tick }))).toEqual(uninterrupted.events.map(({ kind, tick }) => ({ kind, tick })));
  result.events.forEach((event, index) => expect(event.elapsedSeconds).toBeCloseTo(uninterrupted.events[index].elapsedSeconds, 14));
});
it('preserves standing contact across a new acceleration without fabricating departure at the old horizon', () => {
  const standing = segment(0, 1, 0, 0, 0);
  const open = history(query([standing]));
  expect(open.contactAtHorizon).toBe(true);
  expect(open.events.map((e) => e.kind)).toEqual(['touch']);
  const continued = history(query([standing, segment(1, 2, 0, 0, 2)]));
  expect(continued.events.map((e) => e.kind)).toEqual(['touch', 'departure']);
  expect(continued.events[1].elapsedSeconds).toBeCloseTo(1 + Math.sqrt(0.2), 14);
});
it('records an isolated touch and departure only once future executed motion proves departure', () => {
  const s = segment(0, 2, 0, 0, 0), actors = s.actors.map((a) => ({ ...a, primitive: { ...a.primitive,
    startCenter: { x: 0, y: 4, z: 0 }, startVelocity: { x: 0, y: -4, z: 0 }, acceleration: { x: 0, y: 2, z: 0 } } }));
  const first = { ...s, actors };
  expect(history(query([first])).events.map((e) => e.kind)).toEqual(['touch']);
  const next = segment(2, 4, 0, 0, 0), later = { ...next, actors: next.actors.map((a) => ({ ...a, primitive: { ...a.primitive,
    acceleration: { x: 0, y: 2, z: 0 } } })) };
  expect(history(query([first, later])).events.map((e) => e.kind)).toEqual(['touch', 'departure']);
});
it('keeps sub-tick departures separate despite equal recorded event ticks and a large origin', () => {
  const apex = 2.0000005;
  const s = segment(0, 4, 0.2 + 5e-14 - apex * apex, 2 * apex, -2, 2 ** 52), result = history(query([s]));
  expect(result.episodes).toHaveLength(2);
  expect(result.events[1].elapsedSeconds).toBeLessThan(result.events[2].elapsedSeconds);
  expect(result.events[1].tick).toBe(result.events[2].tick);
  expect(result.events[1].originTick).toBe(2 ** 52);
});
it.each(['gap', 'position', 'velocity', 'clock', 'missing', 'duplicate', 'reversed', 'changed_observation'] as const)(
  'rejects %s instead of inventing an unexecuted movement', (kind) => {
    const first = segment(0, 2), s = segment(2, 4, -1, 0, 2);
    const second = kind === 'gap' ? { ...s, startElapsedSeconds: 2.000001 }
      : kind === 'position' ? { ...s, actors: s.actors.map((a) => ({ ...a, primitive: { ...a.primitive, startCenter: { x: -0.99, y: 0, z: 0 } } })) }
      : kind === 'velocity' ? { ...s, actors: s.actors.map((a) => ({ ...a, primitive: { ...a.primitive, startVelocity: { x: 0.1, y: 0, z: 0 } } })) }
      : kind === 'clock' ? { ...s, originTick: 1 }
      : kind === 'missing' ? { ...s, actors: s.actors.slice(0, 1) }
      : kind === 'duplicate' ? { ...s, actors: [s.actors[0], s.actors[0]] }
      : kind === 'reversed' ? { ...s, endElapsedSeconds: 1 }
      : { ...first, actors: first.actors.map((a) => ({ ...a, primitive: { ...a.primitive, acceleration: { x: 3, y: 0, z: 0 } } })) };
    expect(() => history(query([first, second]))).toThrow();
  });
it('rejects caller-supplied routes and desired results in the history contract', () => {
  expect(() => history({ ...query([segment()]), route: ['first'], result: 'safe' } as Parameters<typeof history>[0])).toThrow();
});
