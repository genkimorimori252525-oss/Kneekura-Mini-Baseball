import { expect, it } from 'vitest';
import { findBallWorldFootBaseContactIntervals } from './BallWorldFootBaseContact';

const source = (originTick = 0) => ({ originTick, searchStartElapsedSeconds: 0.1000000004, searchEndElapsedSeconds: 4,
  base: { center: { x: 0, z: 0 }, halfSize: { x: 0.2, z: 0.2 }, rotationRadians: 0 }, baseSurfaceHeightMeters: 0,
  actor: { playerId: 'runner', startElapsedSeconds: 0.1000000004, primitive: { role: 'left_foot' as const, radius: 0.1,
    startTick: originTick, endTick: originTick + 4_000_000, ticksPerSecond: 1_000_000,
    startCenter: { x: 3, y: 0, z: 0 }, startVelocity: { x: -4, y: 0, z: 0 }, acceleration: { x: 2, y: 0, z: 0 } } } });
it('preserves both actual episodes and their true fractional origin before quantizing events', () => {
  const episodes = findBallWorldFootBaseContactIntervals(source());
  expect(episodes).toHaveLength(2);
  expect(episodes[0]).toMatchObject({ playerId: 'runner', role: 'left_foot', originTick: 0, startTick: 1_004_555, endTick: 1_205_573 });
  expect(episodes[0].startElapsedSeconds).toBeCloseTo(0.1000000004 + 2 - Math.sqrt(1.2), 14);
  expect(episodes[1].endElapsedSeconds).toBeCloseTo(0.1000000004 + 2 + Math.sqrt(1.2), 14);
});
it('keeps actual episodes unchanged on a large original clock', () => {
  const small = findBallWorldFootBaseContactIntervals(source()), large = findBallWorldFootBaseContactIntervals(source(2 ** 52));
  expect(large.map((e) => e.startElapsedSeconds)).toEqual(small.map((e) => e.startElapsedSeconds));
  expect(large[0].startTick).toBe(2 ** 52 + small[0].startTick);
});
it.each([[1, 3], [100_001, 2_100_003]])('retains the original covered endpoint despite equivalent clock subtraction at %i..%i', (startTick, endTick) => {
  const s = source(), actor = { playerId: s.actor.playerId, primitive: { ...s.actor.primitive, startTick, endTick,
    startCenter: { x: 0, y: 0, z: 0 }, startVelocity: { x: 0, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } } };
  expect(findBallWorldFootBaseContactIntervals({ ...s, actor, searchStartElapsedSeconds: startTick / 1_000_000,
    searchEndElapsedSeconds: endTick / 1_000_000 })).toEqual([{ playerId: 'runner', role: 'left_foot', originTick: 0,
    startElapsedSeconds: startTick / 1_000_000, endElapsedSeconds: endTick / 1_000_000, startTick, endTick }]);
});
it('rejects extension beyond the original actor coverage', () => {
  expect(() => findBallWorldFootBaseContactIntervals({ ...source(), searchEndElapsedSeconds: 4.000001 })).toThrow(/coverage/);
});
