import { describe, expect, it } from 'vitest';
import type { PitchTrajectorySegment } from './PitchTrajectory';
import {
  resolveTakenPitchPhysicalResult,
  type StrikeZoneRegion,
} from './TakenPitchPhysicalResult';

const zone: StrikeZoneRegion = {
  centerX: 0,
  halfWidth: 0.2159,
  lowerY: 0.5,
  upperY: 1.5,
};

const trajectory = (
  x: number,
  y: number,
): PitchTrajectorySegment => ({
  start: {
    tick: 1_000_000,
    position: { x, y, z: 10 },
    velocity: { x: 0, y: 0, z: -20 },
    spin: { x: 0, y: 100, z: 0 },
  },
  acceleration: { x: 0, y: 0, z: 0 },
  endTick: 1_600_000,
  ticksPerSecond: 1_000_000,
});

describe('TakenPitchPhysicalResult', () => {
  it('classifies a pitch whose center crosses inside the zone as a called strike', () => {
    const result = resolveTakenPitchPhysicalResult({
      trajectory: trajectory(0, 1),
      plateZ: 0,
      strikeZone: zone,
      ballRadiusMeters: 0.0366,
    });

    expect(result?.kind).toBe('called_strike');
    expect(result?.crossing.tick).toBe(1_500_000);
  });

  it('counts a ball-edge clip of the zone as a geometric called strike', () => {
    const result = resolveTakenPitchPhysicalResult({
      trajectory: trajectory(0.24, 1),
      plateZ: 0,
      strikeZone: zone,
      ballRadiusMeters: 0.0366,
    });

    expect(result?.kind).toBe('called_strike');
    expect(result?.geometry).toMatchObject({
      overlapsHorizontalZone: true,
      overlapsVerticalZone: true,
    });
  });

  it('classifies a ball fully outside the horizontal zone as a ball', () => {
    const result = resolveTakenPitchPhysicalResult({
      trajectory: trajectory(0.253, 1),
      plateZ: 0,
      strikeZone: zone,
      ballRadiusMeters: 0.0366,
    });

    expect(result?.kind).toBe('ball');
    expect(result?.geometry.overlapsHorizontalZone).toBe(false);
  });

  it('classifies a ball fully below the vertical zone as a ball', () => {
    const result = resolveTakenPitchPhysicalResult({
      trajectory: trajectory(0, 0.45),
      plateZ: 0,
      strikeZone: zone,
      ballRadiusMeters: 0.0366,
    });

    expect(result?.kind).toBe('ball');
    expect(result?.geometry.overlapsVerticalZone).toBe(false);
  });

  it('returns null when the pitch never reaches the plate plane', () => {
    const miss: PitchTrajectorySegment = {
      ...trajectory(0, 1),
      start: {
        ...trajectory(0, 1).start,
        velocity: { x: 0, y: 0, z: 20 },
      },
    };

    expect(resolveTakenPitchPhysicalResult({
      trajectory: miss,
      plateZ: 0,
      strikeZone: zone,
      ballRadiusMeters: 0.0366,
    })).toBeNull();
  });

  it('rejects invalid zone and ball geometry', () => {
    expect(() => resolveTakenPitchPhysicalResult({
      trajectory: trajectory(0, 1),
      plateZ: 0,
      strikeZone: {
        ...zone,
        lowerY: 1.6,
      },
      ballRadiusMeters: 0.0366,
    })).toThrow(
      'strike zone upperY must be greater than lowerY',
    );

    expect(() => resolveTakenPitchPhysicalResult({
      trajectory: trajectory(0, 1),
      plateZ: 0,
      strikeZone: zone,
      ballRadiusMeters: 0,
    })).toThrow(
      'ballRadiusMeters must be finite and positive',
    );
  });
});
