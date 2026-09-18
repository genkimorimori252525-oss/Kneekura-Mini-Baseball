import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../model/geometry';
import {
  findAcceleratedTagContactTick,
  findTagContactTick,
  type AcceleratedTagContactPrimitiveState,
  type TagContactParameters,
  type TagContactPrimitiveState,
} from './TagContact';

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

const parameters: TagContactParameters = {
  ticksPerSecond: 1_000_000,
};

const tagger = (
  overrides: Partial<TagContactPrimitiveState> = {},
): TagContactPrimitiveState => ({
  tick: 4_000_000,
  center: v(0, 1, 0),
  velocity: v(0, 0, 0),
  radius: 0.04,
  ...overrides,
});

const runnerPrimitive = (
  overrides: Partial<TagContactPrimitiveState> = {},
): TagContactPrimitiveState => ({
  tick: 4_000_000,
  center: v(0.2, 1, 0),
  velocity: v(-60, 0, 0),
  radius: 0.03,
  ...overrides,
});

describe('findTagContactTick', () => {
  it('finds tag contact that begins and ends inside one coarse interval', () => {
    expect(
      findTagContactTick(tagger(), runnerPrimitive(), 5_000, parameters),
    ).toBe(4_002_167);
  });

  it('uses both tagger and runner motion when resolving the authoritative time', () => {
    expect(
      findTagContactTick(
        tagger({ velocity: v(16, 0, 0) }),
        runnerPrimitive({ velocity: v(-35, 0, 0) }),
        5_000,
        parameters,
      ),
    ).toBe(4_002_550);
  });

  it('returns the start tick when supplied tag contact primitives already overlap', () => {
    expect(
      findTagContactTick(
        tagger(),
        runnerPrimitive({ center: v(0.05, 1, 0), velocity: v(0, 0, 0) }),
        5_000,
        parameters,
      ),
    ).toBe(4_000_000);
  });

  it('returns null when the supplied physical primitives pass without touching', () => {
    expect(
      findTagContactTick(
        tagger(),
        runnerPrimitive({ center: v(0.2, 1.2, 0) }),
        5_000,
        parameters,
      ),
    ).toBeNull();
  });
});


describe('findAcceleratedTagContactTick', () => {
  const accelerated = (
    base: TagContactPrimitiveState,
    acceleration: Vec3,
  ): AcceleratedTagContactPrimitiveState => ({
    ...base,
    acceleration,
  });

  it('matches the existing tag contact time when both accelerations are zero', () => {
    expect(findAcceleratedTagContactTick(
      accelerated(tagger(), v(0, 0, 0)),
      accelerated(runnerPrimitive(), v(0, 0, 0)),
      5_000,
      parameters,
    )).toBe(findTagContactTick(
      tagger(),
      runnerPrimitive(),
      5_000,
      parameters,
    ));
  });

  it('lets an accelerating tagging primitive create physical contact', () => {
    expect(findAcceleratedTagContactTick(
      accelerated(tagger({
        center: v(0, 1, 0),
        radius: 0.5,
      }), v(2, 0, 0)),
      accelerated(runnerPrimitive({
        center: v(2, 1, 0),
        velocity: v(0, 0, 0),
        radius: 0.5,
      }), v(0, 0, 0)),
      1_500_000,
      parameters,
    )).toBe(5_000_000);
  });

  it('accounts for runner acceleration when resolving physical tag time', () => {
    expect(findAcceleratedTagContactTick(
      accelerated(tagger({
        center: v(0, 1, 0),
        radius: 0.5,
      }), v(0, 0, 0)),
      accelerated(runnerPrimitive({
        center: v(2, 1, 0),
        velocity: v(0, 0, 0),
        radius: 0.5,
      }), v(-8, 0, 0)),
      1_000_000,
      parameters,
    )).toBe(4_500_000);
  });
});
