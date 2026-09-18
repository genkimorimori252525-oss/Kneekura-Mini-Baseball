import { describe, expect, it } from 'vitest';
import type { BaseTouchRegion } from '../running/BaseTouch';
import type {
  DefenderPhysicalPrimitiveSegment,
} from './DefenderPhysicalPrimitive';
import {
  findDefenderFootBaseContactTick,
} from './DefenderBaseContact';

const base: BaseTouchRegion = {
  center: { x: 3, z: 0 },
  halfSize: { x: 0.2, z: 0.2 },
  rotationRadians: 0,
};

const foot = (
  overrides: Partial<DefenderPhysicalPrimitiveSegment> = {},
): DefenderPhysicalPrimitiveSegment => ({
  role: 'left_foot',
  radius: 0.12,
  startTick: 0,
  endTick: 2_000_000,
  ticksPerSecond: 1_000_000,
  startCenter: { x: 0, y: 0, z: 0 },
  startVelocity: { x: 2, y: 0, z: 0 },
  acceleration: { x: 0, y: 0, z: 0 },
  ...overrides,
});

describe('findDefenderFootBaseContactTick', () => {
  it('finds the exact first foot contact with the base rectangle', () => {
    expect(findDefenderFootBaseContactTick(
      foot(),
      base,
      0,
      2_000_000,
    )).toBe(1_400_000);
  });

  it('returns the search-start tick when the foot is already on the base then', () => {
    expect(findDefenderFootBaseContactTick(
      foot(),
      base,
      1_450_000,
      2_000_000,
    )).toBe(1_450_000);
  });

  it('returns null when an earlier foot contact has already ended before the search window', () => {
    expect(findDefenderFootBaseContactTick(
      foot({ startVelocity: { x: 4, y: 0, z: 0 } }),
      base,
      1_000_000,
      2_000_000,
    )).toBeNull();
  });

  it('solves accelerated foot contact without relying on frame cadence', () => {
    expect(findDefenderFootBaseContactTick(
      foot({
        startVelocity: { x: 0, y: 0, z: 0 },
        acceleration: { x: 2, y: 0, z: 0 },
      }),
      base,
      0,
      2_000_000,
    )).toBe(1_673_321);
  });

  it('preserves an isolated tangential touch instead of requiring a positive-duration overlap', () => {
    const tangentBase: BaseTouchRegion = {
      center: { x: 3, z: 0 },
      halfSize: { x: 0.3, z: 0.2 },
      rotationRadians: 0,
    };

    expect(findDefenderFootBaseContactTick(
      foot({
        startCenter: { x: 1.7, y: 0, z: 0 },
        startVelocity: { x: 2, y: 0, z: 0 },
        acceleration: { x: -2, y: 0, z: 0 },
      }),
      tangentBase,
      0,
      2_000_000,
    )).toBe(1_000_000);
  });

  it('rejects non-foot primitives and search windows outside the primitive segment', () => {
    expect(() => findDefenderFootBaseContactTick(
      foot({ role: 'glove' }),
      base,
      0,
      2_000_000,
    )).toThrow(
      'defender base contact requires a left_foot or right_foot primitive',
    );

    expect(() => findDefenderFootBaseContactTick(
      foot(),
      base,
      0,
      2_000_001,
    )).toThrow(
      'defender base-contact search window must lie inside the primitive interval',
    );
  });
});
