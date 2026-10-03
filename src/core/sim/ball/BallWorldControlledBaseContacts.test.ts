import { expect, it } from 'vitest';
import { deriveBallWorldPlayerBaseContactHistory } from './BallWorldPlayerBaseContactHistory';
import { findBallWorldControlledBaseContacts as contacts } from './BallWorldControlledBaseContacts';

const history = (movingHeight = false) => deriveBallWorldPlayerBaseContactHistory({ playerId: 'defender',
  base: { center: { x: 0, z: 0 }, halfSize: { x: 0.2, z: 0.2 }, rotationRadians: 0 }, baseSurfaceHeightMeters: 0,
  segments: [{ originTick: 2 ** 52, startElapsedSeconds: 0, endElapsedSeconds: 4,
    actors: (['left_foot', 'right_foot'] as const).map((role) => ({ playerId: 'defender', primitive: { role, radius: 0.1,
      startTick: 2 ** 52, endTick: 2 ** 52 + 4_000_000, ticksPerSecond: 1_000_000,
      startCenter: { x: 0, y: movingHeight ? 4 : 0, z: 0 }, startVelocity: { x: 0, y: movingHeight ? -4 : 0, z: 0 },
      acceleration: { x: 0, y: movingHeight ? 2 : 0, z: 0 } } })) }] });
it('starts controlled contact only at actual security, merges uninterrupted carried windows and keeps the original clock', () => {
  expect(contacts({ history: history(), controlWindows: [{ startElapsedSeconds: 1.0000000004, endElapsedSeconds: 2, endInclusive: true },
    { startElapsedSeconds: 2, endElapsedSeconds: 3, endInclusive: false }] })).toEqual([{ playerId: 'defender', originTick: 2 ** 52,
    elapsedSeconds: 1.0000000004, tick: 2 ** 52 + 1_000_001 }]);
});
it('excludes an isolated foot contact exactly at actual release or possession interruption', () => {
  expect(contacts({ history: history(true), controlWindows: [{ startElapsedSeconds: 0, endElapsedSeconds: 2, endInclusive: false }] })).toEqual([]);
});
it('includes a genuine isolated foot contact at the true security moment', () => {
  expect(contacts({ history: history(true), controlWindows: [{ startElapsedSeconds: 2, endElapsedSeconds: 3, endInclusive: true }] })).toEqual([
    { playerId: 'defender', originTick: 2 ** 52, elapsedSeconds: 2, tick: 2 ** 52 + 2_000_000 }]);
});
it('keeps different secured episodes separate when actual control was lost between them', () => {
  expect(contacts({ history: history(), controlWindows: [{ startElapsedSeconds: 1, endElapsedSeconds: 2, endInclusive: false },
    { startElapsedSeconds: 2.0000000001, endElapsedSeconds: 3, endInclusive: true }] }).map((e) => e.elapsedSeconds)).toEqual([1, 2.0000000001]);
});
it.each(['end', 'start', 'reversed', 'inclusive', 'result'] as const)('rejects invalid %s controlled coverage', (kind) => {
  const window = { startElapsedSeconds: kind === 'start' ? -1 : kind === 'reversed' ? 3 : 1,
    endElapsedSeconds: kind === 'end' ? 4.01 : 2, endInclusive: kind === 'inclusive' ? undefined : true,
    ...(kind === 'result' ? { out: true } : {}) };
  expect(() => contacts({ history: history(), controlWindows: [window as Parameters<typeof contacts>[0]['controlWindows'][number]] })).toThrow();
});
