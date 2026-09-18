import { describe, expect, it } from 'vitest';
import type { BatterSwingState } from '../contact/BatBallContact';
import type { PitchTrajectorySegment } from './PitchTrajectory';
import {
  resolveSwingingPitchPhysicalResult,
  type BatterSwingWindow,
} from './SwingingPitchPhysicalResult';

const swingState = (
  xOffset = 0,
): BatterSwingState => ({
  pose: {
    grip: { x: -0.42 + xOffset, y: 1, z: 0 },
    tip: { x: 0.42 + xOffset, y: 1, z: 0 },
  },
  linearVelocity: { x: 0, y: 0, z: 0 },
  angularVelocity: { x: 0, y: 0, z: 0 },
});

const pitch = (
  accelerationZ = 0,
): PitchTrajectorySegment => ({
  start: {
    tick: 1_000_000,
    position: { x: 0, y: 1, z: 0.2 },
    velocity: { x: 0, y: 0, z: -60 },
    spin: { x: 0, y: 0, z: 0 },
  },
  acceleration: { x: 0, y: 0, z: accelerationZ },
  endTick: 1_005_000,
  ticksPerSecond: 1_000_000,
});

const window = (
  stateAtStart = swingState(),
): BatterSwingWindow => ({
  startTick: 1_000_000,
  endTick: 1_005_000,
  ticksPerSecond: 1_000_000,
  stateAtStart,
});

describe('SwingingPitchPhysicalResult', () => {
  it('finds the same contact tick as the existing constant-velocity contact sweep', () => {
    const result = resolveSwingingPitchPhysicalResult({
      trajectory: pitch(),
      swing: window(),
    });

    expect(result.kind).toBe('contact');
    if (result.kind !== 'contact') {
      throw new Error('fixture must produce contact');
    }
    expect(result.contact.tick).toBe(1_002_174);
  });

  it('lets pitch acceleration causally move the contact earlier', () => {
    const baseline = resolveSwingingPitchPhysicalResult({
      trajectory: pitch(),
      swing: window(),
    });
    const accelerated = resolveSwingingPitchPhysicalResult({
      trajectory: pitch(-100),
      swing: window(),
    });

    expect(baseline.kind).toBe('contact');
    expect(accelerated.kind).toBe('contact');
    if (
      baseline.kind !== 'contact'
      || accelerated.kind !== 'contact'
    ) {
      throw new Error('fixtures must produce contact');
    }

    expect(accelerated.contact.tick)
      .toBeLessThan(baseline.contact.tick);
  });

  it('returns a physical swinging miss when the bat never reaches the pitch', () => {
    const result = resolveSwingingPitchPhysicalResult({
      trajectory: pitch(),
      swing: window(swingState(1)),
    });

    expect(result).toEqual({
      kind: 'swinging_miss',
      adjudicationTick: 1_005_000,
    });
  });

  it('rejects a swing window outside the pitch trajectory or on a different clock', () => {
    expect(() => resolveSwingingPitchPhysicalResult({
      trajectory: pitch(),
      swing: {
        ...window(),
        startTick: 999_999,
      },
    })).toThrow(
      'swing window must lie inside the pitch trajectory interval',
    );

    expect(() => resolveSwingingPitchPhysicalResult({
      trajectory: pitch(),
      swing: {
        ...window(),
        ticksPerSecond: 500_000,
      },
    })).toThrow(
      'pitch trajectory and swing window must share ticksPerSecond',
    );
  });

  it('is deterministic for identical physical inputs', () => {
    const input = {
      trajectory: pitch(-25),
      swing: window(),
    } as const;

    expect(resolveSwingingPitchPhysicalResult(input))
      .toEqual(resolveSwingingPitchPhysicalResult(input));
  });
});
