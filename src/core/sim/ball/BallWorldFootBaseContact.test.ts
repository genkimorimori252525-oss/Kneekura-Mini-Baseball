import { expect, it } from 'vitest';
import { findBallWorldFootBaseContact } from './BallWorldFootBaseContact';
import type { BallWorldMotionActor } from './BallWorldContinuation';

const base = { center: { x: 3, z: 0 }, halfSize: { x: 0.2, z: 0.2 }, rotationRadians: 0 };
const input = (originTick = 0) => ({ originTick, searchStartElapsedSeconds: 0.1000000004, searchEndElapsedSeconds: 2,
  base, baseSurfaceHeightMeters: 0, actor: { playerId: 'defender', startElapsedSeconds: 0.1000000004,
    primitive: { role: 'left_foot' as const, radius: 0.12, startTick: originTick, endTick: originTick + 2_000_000, ticksPerSecond: 1_000_000,
      startCenter: { x: 0, y: 0, z: 0 }, startVelocity: { x: 2, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } } } });
it('keeps the rebased true actor basis and quantizes only the final actual base contact', () => {
  const result = findBallWorldFootBaseContact(input());
  expect(result).toMatchObject({ playerId: 'defender', role: 'left_foot', originTick: 0, tick: 1_500_001 });
  expect(result?.elapsedSeconds).toBeCloseTo(1.5000000004, 14);
  expect(result).not.toHaveProperty('possession'); expect(result).not.toHaveProperty('out');
});
it('preserves the same geometry at a large original clock', () => {
  const small = findBallWorldFootBaseContact(input()), large = findBallWorldFootBaseContact(input(2 ** 52));
  expect(large?.elapsedSeconds).toBe(small?.elapsedSeconds); expect(large?.tick).toBe(2 ** 52 + 1_500_001);
});
it('converts a different primitive integer basis without using an absolute floating clock', () => {
  const source = input(2 ** 52), actor = { ...source.actor, startElapsedSeconds: 0.0000000004,
    primitive: { ...source.actor.primitive, startTick: source.originTick + 100_000 } };
  expect(findBallWorldFootBaseContact({ ...source, actor, searchStartElapsedSeconds: 0.100001 })?.elapsedSeconds).toBeCloseTo(1.5000000004, 14);
});
it('uses actual vertical and accelerated rotated contact geometry', () => {
  const source = input(), actor: BallWorldMotionActor = { ...source.actor, primitive: { ...source.actor.primitive,
    startCenter: { x: 0, y: 1, z: 0 }, startVelocity: { x: 0, y: -1, z: 0 }, acceleration: { x: 6, y: 0, z: 0 } } };
  const result = findBallWorldFootBaseContact({ ...source, actor, base: { ...base, rotationRadians: Math.PI / 4, halfSize: { x: 0.3, z: 0.3 } } });
  expect(result?.elapsedSeconds).toBe(1.1000000004); expect(result?.tick).toBe(1_100_001);
});
it('reports no touch when the actual foot stays above the base surface', () => {
  const source = input(), actor = { ...source.actor, primitive: { ...source.actor.primitive, startCenter: { x: 0, y: 0.2, z: 0 } } };
  expect(findBallWorldFootBaseContact({ ...source, actor })).toBeNull();
});
it.each([[1, 3], [100_001, 2_100_003]])('accepts exact original coverage at ticks %i..%i', (startTick, endTick) => {
  const source = input(), actor = { playerId: 'defender', primitive: { ...source.actor.primitive,
    startTick, endTick, startCenter: { x: 3, y: 0, z: 0 }, startVelocity: { x: 0, y: 0, z: 0 } } };
  const result = findBallWorldFootBaseContact({ ...source, actor,
    searchStartElapsedSeconds: startTick / 1_000_000, searchEndElapsedSeconds: endTick / 1_000_000 });
  expect(result?.elapsedSeconds).toBe(startTick / 1_000_000); expect(result?.tick).toBe(startTick);
});
it.each([[1, 3], [100_001, 2_100_003]])('accepts an instantaneous original endpoint at tick %i..%i', (startTick, endTick) => {
  const source = input(), actor = { playerId: 'defender', primitive: { ...source.actor.primitive,
    startTick, endTick, startCenter: { x: 3, y: 0, z: 0 }, startVelocity: { x: 0, y: 0, z: 0 } } };
  const endpoint = endTick / 1_000_000;
  const result = findBallWorldFootBaseContact({ ...source, actor,
    searchStartElapsedSeconds: endpoint, searchEndElapsedSeconds: endpoint });
  expect(result?.elapsedSeconds).toBeCloseTo(endpoint, 14); expect(result?.tick).toBe(endTick);
});
it.each(['late', 'coverage', 'role', 'offset', 'player'] as const)('rejects invalid %s actual actor/query scope', (kind) => {
  const source = input(), changed = kind === 'late' ? { ...source, searchStartElapsedSeconds: 0.1 }
    : kind === 'coverage' ? { ...source, searchEndElapsedSeconds: 2.1 }
    : kind === 'role' ? { ...source, actor: { ...source.actor, primitive: { ...source.actor.primitive, role: 'glove' } } }
    : kind === 'offset' ? { ...source, actor: { ...source.actor, startElapsedSeconds: NaN } }
    : { ...source, actor: { ...source.actor, playerId: '' } };
  expect(() => findBallWorldFootBaseContact(changed as typeof source)).toThrow();
});
