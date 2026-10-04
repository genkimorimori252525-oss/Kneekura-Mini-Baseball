import { expect, it } from 'vitest';
import * as contact from './AcceleratedSphereContact';
const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const sphere = (center = v(), velocity = v(), acceleration = v(), radius = 0.125) => ({ tick: 0, center, velocity, acceleration, radius });
it('uses a horizon-independent root for a nonaxial accelerating peer', () => {
  expect(contact).toHaveProperty('findPiecewiseAcceleratedSphereContactSeconds');
  const first = sphere(v(1, 2), v(1), v(0.1, 0.3, 0.1)), second = sphere(v(1.4, 2.05), v(), v(0.3, 0, 0.1));
  const actual = [0.2, 0.3, 0.5, 0.8, 1].map((bound) => contact.findPiecewiseAcceleratedSphereContactSeconds(first, second, bound, 'include'));
  expect(actual[0]).not.toBeNull(); expect(actual.every((time) => time === actual[0])).toBe(true);
  expect(contact.findPiecewiseAcceleratedSphereContactSeconds(first, second, 0.1, 'include')).toBeNull();
});
it('retains an exact dyadic nonaxial endpoint across longer requested horizons', () => {
  expect(contact).toHaveProperty('findPiecewiseAcceleratedSphereContactSeconds');
  const first = sphere(v(1, 2), v(1), v(0.5, 0.5)), second = sphere(v(1.453125, 2.265625), v(), v(), 0.1875);
  for (const bound of [0.25, 0.3, 0.5, 0.8, 1]) expect(contact.findPiecewiseAcceleratedSphereContactSeconds(first, second, bound, 'include')).toBe(0.25);
  expect(contact.findPiecewiseAcceleratedSphereContactSeconds(first, second, 0.25 - Number.EPSILON, 'include')).toBeNull();
});

it('preserves departure, blocked departure, tangency and genuine near misses', () => {
  const first = sphere(v(), v(), v(), 0.5), second = (x: number, vx = 0, ax = 0) => sphere(v(x), v(vx), v(ax), 0.5);
  expect(contact.findPiecewiseAcceleratedSphereContactSeconds(first, second(1, 1, -1), 3, 'after_departure')).toBeCloseTo(2, 14);
  expect(contact.findPiecewiseAcceleratedSphereContactSeconds(first, second(1, 1e-13, -2e-13), 2, 'after_departure')).toBeCloseTo(1, 12);
  expect(contact.findPiecewiseAcceleratedSphereContactSeconds(first, second(1), 2, 'after_departure')).toBeNull();
  expect(contact.findPiecewiseAcceleratedSphereBlockedDepartureSeconds(first, second(1, 0, -1), 2)).toBe(0);
  expect(contact.findPiecewiseAcceleratedSphereBlockedDepartureSeconds(first, second(0.9, 1, -10), 2)).toBeCloseTo(0.1, 12);
  expect(contact.findPiecewiseAcceleratedSphereBlockedDepartureSeconds(first, second(1, 1, -1), 3)).toBeNull();
  for (const bound of [2, 3, 10]) expect(contact.findPiecewiseAcceleratedSphereContactSeconds(first, sphere(v(-2, 1), v(1), v(), 0.5), bound, 'include')).toBe(2);
  expect(contact.findPiecewiseAcceleratedSphereContactSeconds(first, sphere(v(-2, 1.000001), v(1), v(), 0.5), 10, 'include')).toBeNull();
});
it.each([{ acceleration: -2, horizon: 1e30, expected: 1 }, { acceleration: -2e60, horizon: 1, expected: 1e-30 }])(
  'keeps early physical roots under binary coefficient scaling: %j', ({ acceleration, horizon, expected }) => {
    const first = sphere(v(), v(), v(), 0.5), second = sphere(v(2), v(), v(acceleration), 0.5);
    const result = contact.findPiecewiseAcceleratedSphereContactSeconds(first, second, horizon, 'include');
    expect(result).not.toBeNull(); expect(result! / expected).toBeCloseTo(1, 12);
  });
it('does not evaluate an unexecuted tail whose old horizon normalization would overflow', () => {
  const first = sphere(v(), v(), v(), 0.5), second = sphere(v(2), v(2e153), v(2e153), 0.5);
  expect(() => contact.findAcceleratedSphereContactSeconds(first, second, 5, 'include')).toThrow(/overflow/);
  expect(contact.findPiecewiseAcceleratedSphereContactSeconds(first, second, 0.001, 'include')).toBeNull();
});
it('retains malformed clock, interval and finite arithmetic rejection', () => {
  expect(() => contact.findPiecewiseAcceleratedSphereContactSeconds(sphere(), { ...sphere(v(2)), tick: 1 }, 1, 'include')).toThrow();
  for (const duration of [NaN, Infinity, -1]) expect(() => contact.findPiecewiseAcceleratedSphereContactSeconds(sphere(), sphere(v(2)), duration, 'include')).toThrow();
  expect(() => contact.findPiecewiseAcceleratedSphereContactSeconds(sphere(v(-1e308)), sphere(v(1e308)), 1, 'include')).toThrow(/overflow/);
});

it('does not classify the representable instant before an exact dyadic root as contact', () => {
  const first = sphere(v(), v(4, 0.25), v(), 0.15625), second = sphere(v(0.6875, 0.28125), v(), v(), 0.15625);
  const before = 0.125 - Number.EPSILON / 16;
  expect(before).toBe(0.12499999999999999);
  expect(contact.findPiecewiseAcceleratedSphereContactSeconds(first, second, before, 'include')).toBeNull();
  for (const horizon of [0.125, 0.3, 0.5, 1]) expect(contact.findPiecewiseAcceleratedSphereContactSeconds(first, second, horizon, 'include')).toBe(0.125);
});

it('rejects nonzero coefficient precision loss during binary normalization', () => {
  const first = sphere(v(), v(), v(), 0.5), second = sphere(v(2), v(1e-310), v(-2), 0.5);
  expect(() => contact.findPiecewiseAcceleratedSphereContactSeconds(first, second, 2, 'include')).toThrow(/precision/);
});

it('preserves exact dyadic approaching endpoints across sizes, speeds and accelerations', () => {
  for (const at of [0.125, 0.25, 0.5, 1, 2]) for (const radius of [0.3125, 0.625, 1.25]) {
    for (const vx of [0.125, 0.5, 1, 2, 4]) for (const vy of [0, 0.25, 1]) for (const ax of [0, 0.25, 1]) {
      const offset = v(radius * 0.6, radius * 0.8), advance = v(vx * at + 0.5 * ax * at * at, vy * at + 0.5 * ax * at * at);
      const first = sphere(v(), v(vx, vy), v(ax, ax), radius / 2), second = sphere(v(offset.x + advance.x, offset.y + advance.y), v(), v(), radius / 2);
      expect(contact.findPiecewiseAcceleratedSphereContactSeconds(first, second, at, 'include')).toBe(at);
    }
  }
});
it('keeps dyadic tangent minima out of every precontact horizon', () => {
  for (const at of [0.125, 0.25, 0.5, 1, 2]) for (const radius of [0.3125, 0.625, 1.25]) for (const speed of [0.125, 1, 4]) {
    const velocity = v(3 * speed, 4 * speed), offset = v(radius * 0.8, -radius * 0.6);
    const first = sphere(v(), velocity, v(), radius / 2), second = sphere(v(velocity.x * at + offset.x, velocity.y * at + offset.y), v(), v(), radius / 2);
    expect(contact.findPiecewiseAcceleratedSphereContactSeconds(first, second, at * 2, 'include')).toBe(at);
    expect(contact.findPiecewiseAcceleratedSphereContactSeconds(first, second, at - Number.EPSILON * at, 'include')).toBeNull();
  }
});
it('does not shift accelerating tangencies whose stationary polynomial is cubic', () => {
  for (const at of [0.125, 0.375, 0.625]) for (const acceleration of [v(0.25, 0.5), v(-0.5, 0.25), v(1, 1)]) {
    const velocity = v(4 - acceleration.x * at, -3 - acceleration.y * at);
    const advance = v(velocity.x * at + 0.5 * acceleration.x * at * at, velocity.y * at + 0.5 * acceleration.y * at * at);
    const first = sphere(v(), velocity, acceleration, 0.15625), second = sphere(v(advance.x + 0.1875, advance.y + 0.25), v(), v(), 0.15625);
    expect(contact.findPiecewiseAcceleratedSphereContactSeconds(first, second, at * 2, 'include')).toBe(at);
    expect(contact.findPiecewiseAcceleratedSphereContactSeconds(first, second, at - Number.EPSILON * at, 'include')).toBeNull();
  }
});
