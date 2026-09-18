import { describe, expect, it } from 'vitest';
import {
  resolveCatchRetention,
  type CatchRetentionParameters,
} from './CatchRetention';
import type {
  DefenderPhysicalPrimitiveSegment,
} from './DefenderPhysicalPrimitive';
import {
  createCatchRetentionContactFromAcceleratedReception,
} from './DefenderThrowReceptionContact';
import type { LiveBallState } from './GloveBallContact';

const ball = (
  overrides: Partial<LiveBallState> = {},
): LiveBallState => ({
  tick: 2_000_000,
  position: { x: 0, y: 1.2, z: 0.2 },
  velocity: { x: 0, y: 0, z: -60 },
  spin: { x: 0, y: 0, z: 0 },
  ...overrides,
});

const glove = (
  overrides: Partial<DefenderPhysicalPrimitiveSegment> = {},
): DefenderPhysicalPrimitiveSegment => ({
  role: 'glove',
  radius: 0.0334,
  startTick: 2_000_000,
  endTick: 2_005_000,
  ticksPerSecond: 1_000_000,
  startCenter: { x: 0, y: 1.2, z: 0 },
  startVelocity: { x: 0, y: 0, z: 0 },
  acceleration: { x: 0, y: 0, z: 0 },
  ...overrides,
});

describe('DefenderThrowReceptionContact', () => {
  it('preserves the existing exact glove-ball contact tick and samples both states there', () => {
    const contact = createCatchRetentionContactFromAcceleratedReception({
      ball: ball(),
      ballAcceleration: { x: 0, y: 0, z: 0 },
      glovePrimitive: glove(),
      ballRadiusMeters: 0.0366,
      pocketOffsetMeters: 0,
      bodyStability: 1,
    });

    expect(contact).not.toBeNull();
    expect(contact?.contactTick).toBe(2_002_167);
    expect(contact?.ball.tick).toBe(2_002_167);
    expect(contact?.glove.tick).toBe(2_002_167);
    expect(contact?.ball.position.z).toBeCloseTo(0.06998, 10);
    expect(contact?.contactNormal).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('samples gravity and glove acceleration from the same authoritative contact tick', () => {
    const contact = createCatchRetentionContactFromAcceleratedReception({
      ball: ball({
        position: { x: 0, y: 1.2, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
      }),
      ballAcceleration: { x: 0, y: -9.81, z: 0 },
      glovePrimitive: glove({
        endTick: 2_200_000,
        startCenter: { x: 0, y: 1, z: 0 },
      }),
      ballRadiusMeters: 0.0366,
      pocketOffsetMeters: 0.01,
      bodyStability: 0.9,
    });

    expect(contact?.contactTick).toBe(2_162_800);
    expect(contact?.ball.velocity.y).toBeCloseTo(
      -9.81 * 0.1628,
      8,
    );
    expect(contact?.glove.position).toEqual({
      x: 0,
      y: 1,
      z: 0,
    });
    expect(contact?.pocketOffsetMeters).toBe(0.01);
    expect(contact?.bodyStability).toBe(0.9);
  });

  it('returns null when the accelerated ball never reaches the glove', () => {
    expect(createCatchRetentionContactFromAcceleratedReception({
      ball: ball({
        position: { x: 0.5, y: 1.2, z: 0.2 },
      }),
      ballAcceleration: { x: 0, y: 0, z: 0 },
      glovePrimitive: glove(),
      ballRadiusMeters: 0.0366,
      pocketOffsetMeters: 0,
      bodyStability: 1,
    })).toBeNull();
  });

  it('rejects non-glove primitives and mismatched start clocks', () => {
    expect(() => createCatchRetentionContactFromAcceleratedReception({
      ball: ball(),
      ballAcceleration: { x: 0, y: 0, z: 0 },
      glovePrimitive: glove({ role: 'left_foot' }),
      ballRadiusMeters: 0.0366,
      pocketOffsetMeters: 0,
      bodyStability: 1,
    })).toThrow(
      "throw reception contact requires a 'glove' primitive",
    );

    expect(() => createCatchRetentionContactFromAcceleratedReception({
      ball: ball({ tick: 1_999_999 }),
      ballAcceleration: { x: 0, y: 0, z: 0 },
      glovePrimitive: glove(),
      ballRadiusMeters: 0.0366,
      pocketOffsetMeters: 0,
      bodyStability: 1,
    })).toThrow(
      'ball and glove reception window must share the same start tick',
    );
  });

  it('feeds the physical reception contact into existing catch-retention physics without a success roll', () => {
    const contact = createCatchRetentionContactFromAcceleratedReception({
      ball: ball(),
      ballAcceleration: { x: 0, y: 0, z: 0 },
      glovePrimitive: glove(),
      ballRadiusMeters: 0.0366,
      pocketOffsetMeters: 0,
      bodyStability: 1,
    });
    if (contact === null) {
      throw new Error('fixture must produce glove-ball contact');
    }

    const baseParameters: CatchRetentionParameters = {
      ticksPerSecond: 1_000_000,
      ballMassKg: 0.145,
      ballRadiusMeters: 0.0366,
      pocketRadiusMeters: 0.1,
      centerRetentionCapacityJ: 400,
      captureDissipationPowerW: 100_000,
      failedContactRestitution: 0.25,
      failedTangentialDamping: 0.4,
      failedSpinDamping: 0.2,
    };

    const secured = resolveCatchRetention(
      contact,
      baseParameters,
    );
    const failed = resolveCatchRetention(
      contact,
      {
        ...baseParameters,
        centerRetentionCapacityJ: 100,
      },
    );

    expect(secured.outcome.kind).toBe('secured');
    expect(failed.outcome.kind).toBe('live-ball');
  });
});
