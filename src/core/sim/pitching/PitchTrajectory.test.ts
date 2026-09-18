import { describe, expect, it } from 'vitest';
import {
  findPitchPlateCrossing,
  samplePitchTrajectorySegment,
  type PitchTrajectorySegment,
} from './PitchTrajectory';

const straight = (): PitchTrajectorySegment => ({
  start: {
    tick: 1_000_000,
    position: { x: 0.05, y: 1.1, z: 18.44 },
    velocity: { x: 0, y: 0, z: -40 },
    spin: { x: 0, y: 150, z: 0 },
  },
  acceleration: { x: 0, y: -0.5, z: 0 },
  endTick: 1_600_000,
  ticksPerSecond: 1_000_000,
});

describe('PitchTrajectory', () => {
  it('samples constant-acceleration pitch state deterministically', () => {
    const state = samplePitchTrajectorySegment(
      straight(),
      1_250_000,
    );

    expect(state.tick).toBe(1_250_000);
    expect(state.position.x).toBeCloseTo(0.05, 12);
    expect(state.position.y).toBeCloseTo(1.084375, 12);
    expect(state.position.z).toBeCloseTo(8.44, 12);
    expect(state.velocity.x).toBeCloseTo(0, 12);
    expect(state.velocity.y).toBeCloseTo(-0.125, 12);
    expect(state.velocity.z).toBeCloseTo(-40, 12);
    expect(state.spin).toEqual({
      x: 0,
      y: 150,
      z: 0,
    });
  });

  it('finds the exact continuous front-of-plate crossing and authoritative tick', () => {
    const crossing = findPitchPlateCrossing(
      straight(),
      0,
    );

    expect(crossing).not.toBeNull();
    expect(crossing?.tick).toBe(1_461_000);
    expect(crossing?.elapsedSeconds).toBeCloseTo(0.461, 12);
    expect(crossing?.position.x).toBeCloseTo(0.05, 12);
    expect(crossing?.position.y).toBeCloseTo(
      1.1 - 0.25 * 0.461 * 0.461,
      12,
    );
    expect(crossing?.position.z).toBeCloseTo(0, 12);
    expect(crossing?.velocity.z).toBeCloseTo(-40, 12);
  });

  it('solves an accelerated Z crossing and quantizes only the authoritative event tick', () => {
    const segment: PitchTrajectorySegment = {
      start: {
        tick: 2_000_000,
        position: { x: 0, y: 1, z: 10 },
        velocity: { x: 0, y: 0, z: -10 },
        spin: { x: 0, y: 0, z: 0 },
      },
      acceleration: { x: 0, y: 0, z: -10 },
      endTick: 2_900_000,
      ticksPerSecond: 1_000_000,
    };

    const crossing = findPitchPlateCrossing(
      segment,
      0,
    );
    expect(crossing?.tick).toBe(2_732_051);
    expect(crossing?.elapsedSeconds)
      .toBeCloseTo(Math.sqrt(3) - 1, 12);
    expect(crossing?.position.z).toBeCloseTo(0, 10);
  });

  it('returns null when the segment never reaches the plate plane', () => {
    const segment: PitchTrajectorySegment = {
      ...straight(),
      start: {
        ...straight().start,
        velocity: { x: 0, y: 0, z: 10 },
      },
    };

    expect(findPitchPlateCrossing(
      segment,
      0,
    )).toBeNull();
  });

  it('rejects sampling outside the segment interval', () => {
    expect(() => samplePitchTrajectorySegment(
      straight(),
      999_999,
    )).toThrow(
      'pitch sample tick must lie inside the trajectory segment',
    );
  });
});