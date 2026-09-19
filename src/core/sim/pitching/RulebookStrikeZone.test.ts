import { describe, expect, it } from 'vitest';
import type {
  PitchTrajectorySegment,
} from './PitchTrajectory';
import {
  resolveTakenPitchPhysicalResult,
} from './TakenPitchPhysicalResult';
import {
  HOME_PLATE_WIDTH_METERS,
  resolveRulebookStrikeZoneRegion,
} from './RulebookStrikeZone';

const trajectoryAtHeight = (
  y: number,
): PitchTrajectorySegment => ({
  start: {
    tick: 1_000_000,
    position: { x: 0, y, z: 10 },
    velocity: { x: 0, y: 0, z: -20 },
    spin: { x: 0, y: 0, z: 0 },
  },
  acceleration: { x: 0, y: 0, z: 0 },
  endTick: 1_600_000,
  ticksPerSecond: 1_000_000,
});

describe('RulebookStrikeZone', () => {
  it('uses home-plate width and batting-stance body landmarks instead of a fixed visual rectangle', () => {
    const zone = resolveRulebookStrikeZoneRegion({
      plateCenterX: 0,
      landmarks: {
        shoulderTopY: 1.62,
        uniformPantsTopY: 1.02,
        kneecapBottomY: 0.46,
      },
    });

    expect(zone).toEqual({
      centerX: 0,
      halfWidth: HOME_PLATE_WIDTH_METERS / 2,
      lowerY: 0.46,
      upperY: 1.32,
    });
  });

  it('produces different vertical zones for different batters and batting stances while preserving plate width', () => {
    const compact = resolveRulebookStrikeZoneRegion({
      plateCenterX: 0,
      landmarks: {
        shoulderTopY: 1.48,
        uniformPantsTopY: 0.94,
        kneecapBottomY: 0.5,
      },
    });
    const tall = resolveRulebookStrikeZoneRegion({
      plateCenterX: 0,
      landmarks: {
        shoulderTopY: 1.82,
        uniformPantsTopY: 1.14,
        kneecapBottomY: 0.52,
      },
    });

    expect(compact.halfWidth).toBe(tall.halfWidth);
    expect(compact.upperY).toBe(1.21);
    expect(tall.upperY).toBe(1.48);
    expect(
      tall.upperY - tall.lowerY,
    ).toBeGreaterThan(
      compact.upperY - compact.lowerY,
    );
  });

  it('feeds the same resolved StrikeZoneRegion into physical pitch adjudication', () => {
    const compact = resolveRulebookStrikeZoneRegion({
      plateCenterX: 0,
      landmarks: {
        shoulderTopY: 1.48,
        uniformPantsTopY: 0.94,
        kneecapBottomY: 0.5,
      },
    });
    const tall = resolveRulebookStrikeZoneRegion({
      plateCenterX: 0,
      landmarks: {
        shoulderTopY: 1.82,
        uniformPantsTopY: 1.14,
        kneecapBottomY: 0.52,
      },
    });

    const compactResult =
      resolveTakenPitchPhysicalResult({
        trajectory: trajectoryAtHeight(1.44),
        plateZ: 0,
        strikeZone: compact,
        ballRadiusMeters: 0.0366,
      });
    const tallResult =
      resolveTakenPitchPhysicalResult({
        trajectory: trajectoryAtHeight(1.44),
        plateZ: 0,
        strikeZone: tall,
        ballRadiusMeters: 0.0366,
      });

    expect(compactResult?.kind).toBe('ball');
    expect(tallResult?.kind).toBe('called_strike');
  });

  it('rejects invalid or non-physical landmark ordering', () => {
    expect(() => resolveRulebookStrikeZoneRegion({
      plateCenterX: 0,
      landmarks: {
        shoulderTopY: 1,
        uniformPantsTopY: 1,
        kneecapBottomY: 0.5,
      },
    })).toThrow(
      'shoulderTopY must be greater than uniformPantsTopY',
    );

    expect(() => resolveRulebookStrikeZoneRegion({
      plateCenterX: 0,
      landmarks: {
        shoulderTopY: 1.5,
        uniformPantsTopY: 0.9,
        kneecapBottomY: 0.95,
      },
    })).toThrow(
      'uniformPantsTopY must be greater than kneecapBottomY',
    );
  });
});