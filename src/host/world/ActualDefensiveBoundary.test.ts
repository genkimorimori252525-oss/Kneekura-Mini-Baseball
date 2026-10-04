import { expect, it } from 'vitest';
import { actualDefensiveBoundary } from './ActualDefensiveContext';

it('proves exact availability after effective-integer tick rounding with no invented tolerance', () => {
  for (const originTick of [0, 1234, Number.MAX_SAFE_INTEGER - 100]) {
    for (const elapsedSeconds of [0, 0.01, 0.010000000000000002, 0.01000000000001, 0.0109]) {
      const at = { originTick, elapsedSeconds, tick: originTick + 10 };
      const boundary = actualDefensiveBoundary(at, 1000);
      expect((boundary - originTick) / 1000).toBeGreaterThanOrEqual(elapsedSeconds);
      expect(boundary).toBe(originTick + (elapsedSeconds === 0 ? 0 : elapsedSeconds === 0.01 ? 10 : 11));
    }
  }
  expect(() => actualDefensiveBoundary({ originTick: Number.MAX_SAFE_INTEGER, elapsedSeconds: 1, tick: 0 }, 1000)).toThrow(/overflow/);
});

it('uses the least exact valid boundary without adding an unconfigured floating multiplication delay', () => {
  expect(actualDefensiveBoundary({ originTick: 0, elapsedSeconds: 2.007, tick: 2007 }, 1000)).toBe(2007);
  expect(actualDefensiveBoundary({ originTick: 1000, elapsedSeconds: 0.07, tick: 1007 }, 100)).toBe(1007);
  expect(actualDefensiveBoundary({ originTick: Number.MAX_SAFE_INTEGER - 7, elapsedSeconds: 0.07, tick: Number.MAX_SAFE_INTEGER }, 100)).toBe(Number.MAX_SAFE_INTEGER);
});
