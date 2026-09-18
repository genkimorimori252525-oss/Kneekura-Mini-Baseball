import { describe, expect, it } from 'vitest';
import type { DefenderBodyKinematicsSegment } from './DefenderBodyKinematics';
import {
  composeDefenderPhysicalPrimitiveSegment,
  sampleDefenderPhysicalPrimitiveSegment,
  type DefenderPosePrimitiveSegment,
} from './DefenderPhysicalPrimitive';

const body = (): DefenderBodyKinematicsSegment => ({
  startTick: 1_000_000,
  endTick: 1_100_000,
  ticksPerSecond: 1_000_000,
  startPosition: { x: 4, y: 0.95, z: 7 },
  startVelocity: { x: 2, y: 0, z: -1 },
  acceleration: { x: 3, y: 0, z: 4 },
});

const pose = (
  overrides: Partial<DefenderPosePrimitiveSegment> = {},
): DefenderPosePrimitiveSegment => ({
  role: 'glove',
  radius: 0.08,
  startTick: 1_000_000,
  endTick: 1_100_000,
  ticksPerSecond: 1_000_000,
  startOffset: { x: 0.4, y: 0.25, z: 0.1 },
  offsetVelocity: { x: 0, y: 0, z: 0 },
  offsetAcceleration: { x: 0, y: 0, z: 0 },
  ...overrides,
});

describe('DefenderPhysicalPrimitive', () => {
  it('composes a neutral pose offset with canonical body motion', () => {
    expect(composeDefenderPhysicalPrimitiveSegment(body(), pose())).toEqual({
      role: 'glove',
      radius: 0.08,
      startTick: 1_000_000,
      endTick: 1_100_000,
      ticksPerSecond: 1_000_000,
      startCenter: { x: 4.4, y: 1.2, z: 7.1 },
      startVelocity: { x: 2, y: 0, z: -1 },
      acceleration: { x: 3, y: 0, z: 4 },
    });
  });

  it('adds end-effector reach velocity to body velocity', () => {
    const primitive = composeDefenderPhysicalPrimitiveSegment(
      body(),
      pose({
        offsetVelocity: { x: 1.5, y: 0.2, z: -0.5 },
      }),
    );

    expect(primitive.startVelocity).toEqual({
      x: 3.5,
      y: 0.2,
      z: -1.5,
    });
  });

  it('adds end-effector reach acceleration to body acceleration', () => {
    const primitive = composeDefenderPhysicalPrimitiveSegment(
      body(),
      pose({
        offsetAcceleration: { x: -2, y: 6, z: 1 },
      }),
    );

    expect(primitive.acceleration).toEqual({
      x: 1,
      y: 6,
      z: 5,
    });
  });

  it('allows vertical glove motion independently of 2D body motion', () => {
    const primitive = composeDefenderPhysicalPrimitiveSegment(
      body(),
      pose({
        offsetVelocity: { x: 0, y: 2, z: 0 },
        offsetAcceleration: { x: 0, y: -4, z: 0 },
      }),
    );

    const sampled = sampleDefenderPhysicalPrimitiveSegment(
      primitive,
      1_100_000,
    );

    expect(sampled.center.y).toBeCloseTo(1.38, 12);
    expect(sampled.velocity.y).toBeCloseTo(1.6, 12);
  });

  it('rejects body and pose segments with mismatched authoritative timing', () => {
    expect(() => composeDefenderPhysicalPrimitiveSegment(
      body(),
      pose({ startTick: 1_000_001 }),
    )).toThrow('body and pose segments must share authoritative timing');
  });

  it('rejects invalid contact geometry instead of silently repairing it', () => {
    expect(() => composeDefenderPhysicalPrimitiveSegment(
      body(),
      pose({ radius: 0 }),
    )).toThrow('pose.radius must be finite and positive');

    expect(() => composeDefenderPhysicalPrimitiveSegment(
      body(),
      pose({
        startOffset: { x: Number.NaN, y: 0, z: 0 },
      }),
    )).toThrow('pose.startOffset must contain finite coordinates');
  });
});
