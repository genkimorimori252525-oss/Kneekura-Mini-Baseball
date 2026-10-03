import { expect, it } from 'vitest';
import { findDefenderFootBaseContactIntervalsSeconds as intervals, findDefenderFootBaseContactSeconds as first } from './DefenderBaseContact';
import type { DefenderPhysicalPrimitiveSegment } from './DefenderPhysicalPrimitive';

const base = { center: { x: 0, z: 0 }, halfSize: { x: 0.2, z: 0.2 }, rotationRadians: 0 };
const primitive = (): DefenderPhysicalPrimitiveSegment => ({ role: 'left_foot', radius: 0.05,
  startTick: 0, endTick: 4_000_000, ticksPerSecond: 1_000_000,
  startCenter: { x: 3, y: 0, z: 0 }, startVelocity: { x: -4, y: 0, z: 0 }, acceleration: { x: 2, y: 0, z: 0 } });
it('retains departure and reentry within one actually executed accelerated foot segment', () => {
  const result = intervals(primitive(), base, 0, 0, 4);
  expect(result).toHaveLength(2);
  expect(result[0].startSeconds).toBeCloseTo(2 - Math.sqrt(1.2), 12);
  expect(result[0].endSeconds).toBeCloseTo(2 - Math.sqrt(0.8), 12);
  expect(result[1].startSeconds).toBeCloseTo(2 + Math.sqrt(0.8), 12);
  expect(result[1].endSeconds).toBeCloseTo(2 + Math.sqrt(1.2), 12);
});
it('records standing contact only over the actually covered search window', () => {
  const p = primitive(), standing = { ...p, startCenter: { x: 0, y: 0, z: 0 }, startVelocity: { x: 0, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } };
  expect(intervals(standing, base, 0, 1.25, 2.75)).toEqual([{ startSeconds: 1.25, endSeconds: 2.75 }]);
  expect(intervals({ ...standing, startCenter: { x: 0, y: 0.2, z: 0 } }, base, 0, 0, 4)).toEqual([]);
});
it('keeps a genuine isolated vertical tangency without fabricating a continuous standing period', () => {
  const p = primitive(), tangent = { ...p, startCenter: { x: 0, y: 4, z: 0 }, startVelocity: { x: 0, y: -4, z: 0 }, acceleration: { x: 0, y: 2, z: 0 } };
  expect(intervals(tangent, base, 0, 0, 4)).toEqual([{ startSeconds: 2, endSeconds: 2 }]);
});
it('does not replace a genuine tiny vertical root with tolerated but airborne window endpoints', () => {
  const p = primitive(), crossing = { ...p, startCenter: { x: 0, y: -2e-13, z: 0 }, startVelocity: { x: 0, y: 1e-13, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } };
  expect(intervals(crossing, base, 0, 0, 4)).toEqual([{ startSeconds: 2, endSeconds: 2 }]);
  expect(first(crossing, base, 0, 0, 4)).toBe(2);
});
it('keeps first contact at the actual moving-height root instead of the old numerical endpoint shortcut', () => {
  const p = primitive(), crossing = { ...p, startCenter: { x: 0, y: -2e-13, z: 0 }, startVelocity: { x: 0, y: 1e-13, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } };
  expect(first(crossing, base, 0, 0, 4)).toBe(2);
});
it('does not collapse a genuine executed standing window shorter than the old root deduplication tolerance', () => {
  const p = primitive(), standing = { ...p, startCenter: { x: 0, y: 0, z: 0 }, startVelocity: { x: 0, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } };
  expect(intervals(standing, base, 0, 1, 1 + 2e-11)).toEqual([{ startSeconds: 1, endSeconds: 1 + 2e-11 }]);
});
it('retains a genuine departure smaller than the old spatial classification tolerance', () => {
  const p = primitive(), departing = { ...p, startCenter: { x: -3.8 + 5e-10, y: 0, z: 0 },
    startVelocity: { x: 4, y: 0, z: 0 }, acceleration: { x: -2, y: 0, z: 0 } };
  const result = intervals(departing, base, 0, 0, 4);
  expect(result).toHaveLength(2);
  expect(result[0].endSeconds).toBeLessThan(2);
  expect(result[1].startSeconds).toBeGreaterThan(2);
});
it('does not enlarge a base to accept a stationary foot outside its real edge', () => {
  const p = primitive(), outside = { ...p, startCenter: { x: 0.2 + 5e-10, y: 0, z: 0 },
    startVelocity: { x: 0, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } };
  expect(intervals(outside, base, 0, 0, 4)).toEqual([]);
  expect(first(outside, base, 0, 0, 4)).toBeNull();
});
it('keeps the first-contact query outside an actual stationary base edge', () => {
  const p = primitive(), outside = { ...p, startCenter: { x: 0.2 + 5e-10, y: 0, z: 0 },
    startVelocity: { x: 0, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } };
  expect(first(outside, base, 0, 0, 4)).toBeNull();
});
it('clips both accelerated episodes to the actual execution window', () => {
  const result = intervals(primitive(), base, 0, 1, 3);
  expect(result).toHaveLength(2);
  expect(result[0].startSeconds).toBe(1);
  expect(result[1].endSeconds).toBe(3);
});
it('uses rotated world coordinates and the actual base top height', () => {
  const p = primitive(), rotated = { ...p, startCenter: { x: 10, y: 0.15, z: 23 },
    startVelocity: { x: 0, y: 0, z: -4 }, acceleration: { x: 0, y: 0, z: 2 } };
  const result = intervals(rotated, { ...base, center: { x: 10, z: 20 }, rotationRadians: Math.PI / 2 }, 0.15, 0, 4);
  expect(result).toHaveLength(2);
  expect(result[0].startSeconds).toBeCloseTo(2 - Math.sqrt(1.2), 12);
  expect(result[1].endSeconds).toBeCloseTo(2 + Math.sqrt(1.2), 12);
});
it.each([[-1, 4], [0, 4.01], [3, 2], [NaN, 4], [0, Infinity]])('rejects uncovered interval %s..%s', (start, end) => {
  expect(() => intervals(primitive(), base, 0, start, end)).toThrow(/window/);
});
it('fails closed when the actual base projection cannot be represented', () => {
  expect(() => intervals({ ...primitive(), startCenter: { x: -Number.MAX_VALUE, y: 0, z: 0 } },
    { ...base, center: { x: Number.MAX_VALUE, z: 0 } }, 0, 0, 4)).toThrow(/arithmetic/);
});
it('preserves two genuine vertical plane crossings when unscaled discriminant products underflow', () => {
  const p = primitive(), crossing = { ...p, startCenter: { x: 0, y: 3e-200, z: 0 },
    startVelocity: { x: 0, y: -4e-200, z: 0 }, acceleration: { x: 0, y: 2e-200, z: 0 } };
  const result = intervals(crossing, base, 0, 0, 4);
  expect(result).toHaveLength(2);
  expect(result[0].startSeconds).toBeCloseTo(1, 14);
  expect(result[1].startSeconds).toBeCloseTo(3, 14);
});
it.each([2.5, 4.75])('preserves the single exact vertical tangency at %s seconds', (seconds) => {
  const tangent = { ...primitive(), endTick: 5_000_000,
    startCenter: { x: 0, y: seconds * seconds, z: 0 },
    startVelocity: { x: 0, y: -2 * seconds, z: 0 }, acceleration: { x: 0, y: 2, z: 0 } };
  expect(intervals(tangent, base, 0, 0, 5)).toEqual([{ startSeconds: seconds, endSeconds: seconds }]);
  expect(first(tangent, base, 0, 0, 5)).toBe(seconds);
});
