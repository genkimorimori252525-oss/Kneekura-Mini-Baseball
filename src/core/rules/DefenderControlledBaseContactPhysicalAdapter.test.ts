import { describe, expect, it } from 'vitest';
import type { BaseTouchRegion } from '../sim/running/BaseTouch';
import {
  createSecuredCatchOutcome,
} from '../sim/fielding/CatchOutcome';
import type {
  DefenderPhysicalPrimitiveSegment,
} from '../sim/fielding/DefenderPhysicalPrimitive';
import {
  createControlledBaseContactFactFromDefenderPhysics,
} from './DefenderControlledBaseContactPhysicalAdapter';

const base: BaseTouchRegion = {
  center: { x: 3, z: 0 },
  halfSize: { x: 0.2, z: 0.2 },
  rotationRadians: 0,
};

const foot: DefenderPhysicalPrimitiveSegment = {
  role: 'left_foot',
  radius: 0.12,
  startTick: 0,
  endTick: 2_000_000,
  ticksPerSecond: 1_000_000,
  startCenter: { x: 0, y: 0, z: 0 },
  startVelocity: { x: 2, y: 0, z: 0 },
  acceleration: { x: 0, y: 0, z: 0 },
};

describe('DefenderControlledBaseContactPhysicalAdapter', () => {
  it('converts the exact controlled-contact tick into the existing physical rule fact', () => {
    expect(createControlledBaseContactFactFromDefenderPhysics({
      defenderId: 'first-baseman',
      base: 1,
      baseRegion: base,
      securedCatch: createSecuredCatchOutcome(
        900_000,
        1_000_000,
      ),
      controlThroughTick: 1_900_000,
      contactPrimitives: [foot],
    })).toEqual({
      kind: 'controlled_base_contact',
      defenderId: 'first-baseman',
      base: 1,
      tick: 1_400_000,
    });
  });

  it('returns null when the physical layer finds no overlap of control and foot contact', () => {
    expect(createControlledBaseContactFactFromDefenderPhysics({
      defenderId: 'first-baseman',
      base: 1,
      baseRegion: base,
      securedCatch: createSecuredCatchOutcome(
        900_000,
        1_000_000,
      ),
      controlThroughTick: 1_300_000,
      contactPrimitives: [foot],
    })).toBeNull();
  });
});
