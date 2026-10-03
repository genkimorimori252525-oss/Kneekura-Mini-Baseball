import { expect, it } from 'vitest';
import { findDefenderFootBaseContactSeconds, findDefenderFootBaseContactTick } from './DefenderBaseContact';
import type { DefenderPhysicalPrimitiveSegment } from './DefenderPhysicalPrimitive';

const base = { center: { x: 3, z: 0 }, halfSize: { x: 0.2, z: 0.2 }, rotationRadians: 0 };
const foot: DefenderPhysicalPrimitiveSegment = { role: 'left_foot', radius: 0.12, startTick: 0, endTick: 2_000_000, ticksPerSecond: 1_000_000,
  startCenter: { x: 0, y: 0, z: 0 }, startVelocity: { x: 2, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } };
it('returns the true continuous foot/base moment and leaves old Tick quantization unchanged', () => {
  expect(findDefenderFootBaseContactSeconds(foot, base, 0, 0, 2)).toBe(1.4);
  expect(findDefenderFootBaseContactTick(foot, base, 0, 0, 2_000_000)).toBe(1_400_000);
  const faster = { ...foot, startVelocity: { x: 3, y: 0, z: 0 } };
  expect(findDefenderFootBaseContactSeconds(faster, base, 0, 0, 2)).toBeCloseTo(2.8 / 3, 14);
  expect(findDefenderFootBaseContactTick(faster, base, 0, 0, 2_000_000)).toBe(933_334);
});
it('keeps a continuous search start without shifting it onto a recorded tick', () => {
  expect(findDefenderFootBaseContactSeconds(foot, base, 0, 1.4500000004, 2)).toBe(1.4500000004);
  expect(findDefenderFootBaseContactSeconds({ ...foot, startVelocity: { x: 4, y: 0, z: 0 } }, base, 0, 1, 2)).toBeNull();
});
it.each([[-1, 2], [0, 2.01], [1, 0.9], [NaN, 2], [0, Infinity]])('rejects invalid seconds window %s..%s', (start, end) => {
  expect(typeof findDefenderFootBaseContactSeconds).toBe('function');
  expect(() => findDefenderFootBaseContactSeconds(foot, base, 0, start, end)).toThrow(/window/);
});
it('rejects unrepresentable projected base geometry instead of reporting no physical contact', () => {
  expect(typeof findDefenderFootBaseContactSeconds).toBe('function');
  expect(() => findDefenderFootBaseContactSeconds({ ...foot, startCenter: { x: -Number.MAX_VALUE, y: 0, z: 0 } },
    { ...base, center: { x: Number.MAX_VALUE, z: 0 } }, 0, 0, 2)).toThrow(/arithmetic/);
});
