import { expect, it } from 'vitest';
import { findAcceleratedSphereContactSeconds, findAcceleratedSphereBlockedDepartureSeconds, type AcceleratedSphereContactState } from './AcceleratedSphereContact';

const state = (x: number, vx = 0, ax = 0, tick = 0): AcceleratedSphereContactState => ({
  tick, center: { x, y: 0, z: 0 }, velocity: { x: vx, y: 0, z: 0 }, acceleration: { x: ax, y: 0, z: 0 }, radius: 0.5,
});
it('searches a continuous horizon without requiring a fractional absolute tick', () => {
  expect(findAcceleratedSphereContactSeconds(state(0), state(1.1, -1), 0.15, 'include')).toBeCloseTo(0.1, 12);
  expect(findAcceleratedSphereContactSeconds(state(0), state(1.1, -1), 0.05, 'include')).toBeNull();
});
it('preserves the initial overlap for an ordinary first contact', () => {
  expect(findAcceleratedSphereContactSeconds(state(0), state(0.9, 1), 2, 'include')).toBe(0);
});
it('does not repeat a separating contact or skip its actual accelerated return', () => {
  expect(findAcceleratedSphereContactSeconds(state(0), state(1, 1), 2, 'after_departure')).toBeNull();
  expect(findAcceleratedSphereContactSeconds(state(0), state(1, 1, -1), 3, 'after_departure')).toBeCloseTo(2, 12);
});
it('requires actual departure when the previous pair remains overlapped', () => {
  expect(findAcceleratedSphereContactSeconds(state(0), state(0.9), 3, 'after_departure')).toBeNull();
  expect(findAcceleratedSphereContactSeconds(state(0), state(0.9, 1, -1), 3, 'after_departure'))
    .toBeCloseTo(1 + Math.sqrt(0.8), 12);
});
it('does not equate a zero-speed turning boundary with re-entry before departure', () => {
  expect(findAcceleratedSphereContactSeconds(state(0), state(1, 0, 1), 2, 'after_departure')).toBeNull();
  expect(findAcceleratedSphereContactSeconds(state(0), state(1, 0, -1), 2, 'after_departure')).toBeNull();
});
it('finds ordinary future contact when a prior pair is already separated at the start', () => {
  expect(findAcceleratedSphereContactSeconds(state(0), state(2, -1), 3, 'after_departure')).toBeCloseTo(1, 12);
});
it('preserves an actual small departure and its later return without a position epsilon', () => {
  expect(findAcceleratedSphereContactSeconds(state(0), state(1, 1e-13, -2e-13), 2, 'after_departure')).toBeCloseTo(1, 12);
});
it('detects a tangent future contact and does not accept an approaching root beyond the horizon', () => {
  const tangent = { ...state(-2, 1), center: { x: -2, y: 1, z: 0 } };
  expect(findAcceleratedSphereContactSeconds(state(0), tangent, 3, 'include')).toBeCloseTo(2, 12);
  expect(findAcceleratedSphereContactSeconds(state(0), state(2, -1), 1 - 1e-13, 'include')).toBeNull();
});
it.each([0, 2 ** 52])('retains the relative root at original integer tick %s', (tick) => {
  expect(findAcceleratedSphereContactSeconds(state(0, 0, 0, tick), state(2, 0, -2, tick), 2, 'include')).toBeCloseTo(1, 12);
});
it.each([NaN, Infinity, -1])('rejects invalid continuous horizon %s', (seconds) => {
  expect(() => findAcceleratedSphereContactSeconds(state(0), state(2), seconds, 'include')).toThrow();
});
it('rejects incompatible clocks, invalid policy and overflowing relative geometry', () => {
  expect(() => findAcceleratedSphereContactSeconds(state(0), state(2, 0, 0, 1), 1, 'include')).toThrow();
  expect(() => findAcceleratedSphereContactSeconds(state(0), state(2), 1, 'skip' as 'include')).toThrow();
  expect(() => findAcceleratedSphereContactSeconds(state(-1e308), state(1e308), 1, 'include')).toThrow();
});
it('identifies an inward constrained motion instead of pretending a contacted pair departed', () => {
  expect(findAcceleratedSphereBlockedDepartureSeconds(state(0), state(1, 0, -1), 2)).toBe(0);
  expect(findAcceleratedSphereBlockedDepartureSeconds(state(0), state(0.9, 1, -10), 2)).toBeCloseTo(0.1, 12);
});
it('does not manufacture a blocked departure for static tangency, actual departure or ordinary re-entry', () => {
  expect(findAcceleratedSphereBlockedDepartureSeconds(state(0), state(1), 2)).toBeNull();
  expect(findAcceleratedSphereBlockedDepartureSeconds(state(0), state(1, 1), 2)).toBeNull();
  expect(findAcceleratedSphereBlockedDepartureSeconds(state(0), state(1, 1, -1), 3)).toBeNull();
});
it('keeps a genuine grazing miss independent of the continuous horizon', () => {
  const first = { ...state(0), radius: 0.1 };
  const second = { ...state(-1, 10), center: { x: -1, y: 0.20000001, z: 0 }, radius: 0.1 };
  expect(findAcceleratedSphereContactSeconds(first, second, 1, 'include')).toBeNull();
  expect(findAcceleratedSphereContactSeconds(first, second, 10, 'include')).toBeNull();
});
it('preserves an early contact within a much longer valid continuous horizon', () => {
  expect(findAcceleratedSphereContactSeconds(state(0), state(2, -1), 2, 'include')).toBeCloseTo(1, 10);
  expect(findAcceleratedSphereContactSeconds(state(0), state(2, -1), 1e12, 'include')).toBeCloseTo(1, 10);
});
it.each([
  { acceleration: -2, horizon: 1e30, expected: 1 },
  { acceleration: -2e60, horizon: 1, expected: 1e-30 },
])('preserves an accelerated contact near the normalized boundary: %j', ({ acceleration, horizon, expected }) => {
  const actual = findAcceleratedSphereContactSeconds(state(0), state(2, 0, acceleration), horizon, 'include');
  expect(actual).not.toBeNull();
  expect(actual! / expected).toBeCloseTo(1, 12);
});
it('does not overflow tangent roundoff when finite squared geometry approaches the numeric limit', () => {
  const first = { ...state(0), radius: 5e153 };
  const second = { ...state(-1, 10), center: { x: -1, y: 1e154 * (1 + 1e-7), z: 0 }, radius: 5e153 };
  expect(findAcceleratedSphereContactSeconds(first, second, 1, 'include')).toBeNull();
});
