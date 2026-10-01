import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../model/geometry';
import {
  findAcceleratedSphereContactTick,
  findAcceleratedSphereContactTime,
  type AcceleratedSphereContactState,
} from './AcceleratedSphereContact';
import { findMovingSphereContactTick } from './MovingSphereContact';

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const parameters = { ticksPerSecond: 1_000_000 };

const state = (
  overrides: Partial<AcceleratedSphereContactState> = {},
): AcceleratedSphereContactState => ({
  tick: 2_000_000,
  center: v(0, 0, 0),
  velocity: v(0, 0, 0),
  acceleration: v(0, 0, 0),
  radius: 0.5,
  ...overrides,
});

it('exposes continuous contact time for finite geometry while preserving the authoritative rounded tick', () => {
  const p = { ticksPerSecond: 1 };
  const linear = findAcceleratedSphereContactTime(state({ tick: 0 }), state({ tick: 0, center: v(1.1, 0, 0), velocity: v(-1, 0, 0) }), 1, p)!;
  expect(linear.tick).toBe(1);
  expect(linear.elapsedSeconds).toBeCloseTo(0.1, 12);
  const accelerated = findAcceleratedSphereContactTime(state({ tick: 0 }), state({ tick: 0, center: v(1.1, 0, 0), acceleration: v(-2, 0, 0) }), 1, p)!;
  expect(accelerated.tick).toBe(1);
  expect(accelerated.elapsedSeconds).toBeCloseTo(Math.sqrt(0.1), 12);
  expect(findAcceleratedSphereContactTick(state({ tick: 0 }), state({ tick: 0, center: v(1.1, 0, 0), acceleration: v(-2, 0, 0) }), 1, p)).toBe(accelerated.tick);
});

describe('findAcceleratedSphereContactTick', () => {
  it('returns the start tick when primitives already overlap', () => {
    expect(findAcceleratedSphereContactTick(
      state(),
      state({ center: v(0.8, 0, 0) }),
      1_000_000,
      parameters,
    )).toBe(2_000_000);
  });

  it('agrees with the existing constant-velocity solver when relative acceleration is zero', () => {
    const first = state({
      center: v(0, 1.2, 0),
      velocity: v(0, 0, 0),
      radius: 0.0334,
    });
    const second = state({
      center: v(0, 1.2, 0.2),
      velocity: v(0, 0, -60),
      radius: 0.0366,
    });

    const accelerated = findAcceleratedSphereContactTick(
      first,
      second,
      5_000,
      parameters,
    );
    const moving = findMovingSphereContactTick(
      {
        tick: first.tick,
        center: first.center,
        velocity: first.velocity,
        radius: first.radius,
      },
      {
        tick: second.tick,
        center: second.center,
        velocity: second.velocity,
        radius: second.radius,
      },
      5_000,
      parameters,
    );

    expect(accelerated).toBe(moving);
    expect(accelerated).toBe(2_002_167);
  });

  it('detects acceleration-created contact with an exact authoritative tick', () => {
    expect(findAcceleratedSphereContactTick(
      state(),
      state({
        center: v(2, 0, 0),
        acceleration: v(-2, 0, 0),
      }),
      1_500_000,
      parameters,
    )).toBe(3_000_000);
  });

  it('detects contact that begins and ends inside the search interval', () => {
    expect(findAcceleratedSphereContactTick(
      state(),
      state({
        center: v(2, 0, 0),
        acceleration: v(-8, 0, 0),
      }),
      1_000_000,
      parameters,
    )).toBe(2_500_000);
  });

  it('detects a tangent contact at a stationary point of squared separation', () => {
    expect(findAcceleratedSphereContactTick(
      state(),
      state({
        center: v(-2, 1, 0),
        acceleration: v(1, 0, 0),
      }),
      2_500_000,
      parameters,
    )).toBe(4_000_000);
  });

  it('returns null when acceleration never brings the primitives into contact', () => {
    expect(findAcceleratedSphereContactTick(
      state(),
      state({
        center: v(-2, 2, 0),
        acceleration: v(1, 0, 0),
      }),
      2_500_000,
      parameters,
    )).toBeNull();
  });

  it('uses relative acceleration, so identical accelerations preserve constant-velocity timing', () => {
    const first = state({
      velocity: v(1, 0, 0),
      acceleration: v(3, -9.81, 0),
    });
    const second = state({
      center: v(2, 0, 0),
      velocity: v(-1, 0, 0),
      acceleration: v(3, -9.81, 0),
    });

    expect(findAcceleratedSphereContactTick(
      first,
      second,
      1_000_000,
      parameters,
    )).toBe(2_500_000);
  });
});
