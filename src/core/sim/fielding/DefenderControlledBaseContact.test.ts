import { describe, expect, it } from 'vitest';
import type { BaseTouchRegion } from '../running/BaseTouch';
import {
  createSecuredCatchOutcome,
} from './CatchOutcome';
import type {
  DefenderPhysicalPrimitiveSegment,
} from './DefenderPhysicalPrimitive';
import {
  findDefenderControlledBaseContactTick,
} from './DefenderControlledBaseContact';

const base: BaseTouchRegion = {
  center: { x: 3, z: 0 },
  halfSize: { x: 0.2, z: 0.2 },
  rotationRadians: 0,
};

const primitive = (
  role: DefenderPhysicalPrimitiveSegment['role'],
  velocityX: number,
): DefenderPhysicalPrimitiveSegment => ({
  role,
  radius: 0.12,
  startTick: 0,
  endTick: 2_000_000,
  ticksPerSecond: 1_000_000,
  startCenter: { x: 0, y: 0, z: 0 },
  startVelocity: { x: velocityX, y: 0, z: 0 },
  acceleration: { x: 0, y: 0, z: 0 },
});

describe('findDefenderControlledBaseContactTick', () => {
  it('uses secureTick when the foot is already contacting the base at secure possession', () => {
    expect(findDefenderControlledBaseContactTick({
      baseRegion: base,
      baseSurfaceHeightMeters: 0,
      securedCatch: createSecuredCatchOutcome(
        1_300_000,
        1_450_000,
      ),
      controlThroughTick: 1_900_000,
      contactPrimitives: [
        primitive('left_foot', 2),
      ],
    })).toBe(1_450_000);
  });

  it('uses the later exact foot-contact tick when possession is secure first', () => {
    expect(findDefenderControlledBaseContactTick({
      baseRegion: base,
      baseSurfaceHeightMeters: 0,
      securedCatch: createSecuredCatchOutcome(
        900_000,
        1_000_000,
      ),
      controlThroughTick: 1_900_000,
      contactPrimitives: [
        primitive('left_foot', 2),
      ],
    })).toBe(1_400_000);
  });

  it('returns null when the foot left the base before secure possession began', () => {
    expect(findDefenderControlledBaseContactTick({
      baseRegion: base,
      baseSurfaceHeightMeters: 0,
      securedCatch: createSecuredCatchOutcome(
        900_000,
        1_000_000,
      ),
      controlThroughTick: 1_900_000,
      contactPrimitives: [
        primitive('left_foot', 4),
      ],
    })).toBeNull();
  });

  it('returns null when foot contact occurs only after the known control window ends', () => {
    expect(findDefenderControlledBaseContactTick({
      baseRegion: base,
      baseSurfaceHeightMeters: 0,
      securedCatch: createSecuredCatchOutcome(
        900_000,
        1_000_000,
      ),
      controlThroughTick: 1_300_000,
      contactPrimitives: [
        primitive('left_foot', 2),
      ],
    })).toBeNull();
  });

  it('ignores glove/body primitives rather than inventing body-base contact geometry', () => {
    expect(findDefenderControlledBaseContactTick({
      baseRegion: base,
      baseSurfaceHeightMeters: 0,
      securedCatch: createSecuredCatchOutcome(
        900_000,
        1_000_000,
      ),
      controlThroughTick: 1_900_000,
      contactPrimitives: [
        primitive('glove', 2),
        primitive('body', 2),
        primitive('tag_hand', 2),
      ],
    })).toBeNull();
  });

  it('chooses the earliest exact contact among left and right feet', () => {
    expect(findDefenderControlledBaseContactTick({
      baseRegion: base,
      baseSurfaceHeightMeters: 0,
      securedCatch: createSecuredCatchOutcome(
        800_000,
        900_000,
      ),
      controlThroughTick: 1_900_000,
      contactPrimitives: [
        primitive('left_foot', 2),
        primitive('right_foot', 2.5),
      ],
    })).toBe(1_120_000);
  });

  it('rejects an invalid secure/control chronology', () => {
    expect(() => findDefenderControlledBaseContactTick({
      baseRegion: base,
      baseSurfaceHeightMeters: 0,
      securedCatch: createSecuredCatchOutcome(
        1_100_000,
        1_000_000,
      ),
      controlThroughTick: 1_900_000,
      contactPrimitives: [
        primitive('left_foot', 2),
      ],
    })).toThrow(
      'secure possession tick must be at or after glove contact tick',
    );

    expect(() => findDefenderControlledBaseContactTick({
      baseRegion: base,
      baseSurfaceHeightMeters: 0,
      securedCatch: createSecuredCatchOutcome(
        900_000,
        1_000_000,
      ),
      controlThroughTick: 999_999,
      contactPrimitives: [
        primitive('left_foot', 2),
      ],
    })).toThrow(
      'controlThroughTick must be at or after secure possession tick',
    );
  });
});
