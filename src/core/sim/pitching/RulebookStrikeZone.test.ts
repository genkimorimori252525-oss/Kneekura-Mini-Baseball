import { describe, expect, it } from 'vitest';
import {
  createPlayerPhysicalProfile,
} from '../../model/PlayerPhysicalProfile';
import type {
  PitchTrajectorySegment,
} from './PitchTrajectory';
import {
  resolveTakenPitchPhysicalResult,
} from './TakenPitchPhysicalResult';
import {
  HEIGHT_RATIO_V1_BOTTOM_FRACTION,
  HEIGHT_RATIO_V1_TOP_FRACTION,
  HOME_PLATE_WIDTH_METERS,
  resolveHeightRatioStrikeZoneRegion,
  resolveLandmarkStrikeZoneRegion,
  resolveStrikeZoneRegion,
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

describe('RulebookStrikeZone geometry policies', () => {
  it('uses Height-Ratio V1 as a deterministic per-player zone source', () => {
    const profile =
      createPlayerPhysicalProfile(1.8);
    const zone =
      resolveHeightRatioStrikeZoneRegion({
        plateCenterX: 0,
        playerPhysicalProfile: profile,
      });

    expect(zone.centerX).toBe(0);
    expect(zone.halfWidth).toBe(
      HOME_PLATE_WIDTH_METERS / 2,
    );
    expect(zone.lowerY).toBeCloseTo(
      1.8
      * HEIGHT_RATIO_V1_BOTTOM_FRACTION,
      12,
    );
    expect(zone.upperY).toBeCloseTo(
      1.8
      * HEIGHT_RATIO_V1_TOP_FRACTION,
      12,
    );
  });

  it('moves both size and vertical position with player height', () => {
    const shorter =
      resolveHeightRatioStrikeZoneRegion({
        plateCenterX: 0,
        playerPhysicalProfile:
          createPlayerPhysicalProfile(1.7),
      });
    const taller =
      resolveHeightRatioStrikeZoneRegion({
        plateCenterX: 0,
        playerPhysicalProfile:
          createPlayerPhysicalProfile(1.9),
      });

    expect(taller.lowerY)
      .toBeGreaterThan(shorter.lowerY);
    expect(taller.upperY)
      .toBeGreaterThan(shorter.upperY);
    expect(
      taller.upperY - taller.lowerY,
    ).toBeGreaterThan(
      shorter.upperY - shorter.lowerY,
    );
    expect(taller.halfWidth)
      .toBe(shorter.halfWidth);
  });

  it('feeds the height-derived region into the same physical pitch adjudication contract', () => {
    const shorter =
      resolveHeightRatioStrikeZoneRegion({
        plateCenterX: 0,
        playerPhysicalProfile:
          createPlayerPhysicalProfile(1.7),
      });
    const taller =
      resolveHeightRatioStrikeZoneRegion({
        plateCenterX: 0,
        playerPhysicalProfile:
          createPlayerPhysicalProfile(1.9),
      });

    const shorterResult =
      resolveTakenPitchPhysicalResult({
        trajectory: trajectoryAtHeight(0.99),
        plateZ: 0,
        strikeZone: shorter,
        ballRadiusMeters: 0.0366,
      });
    const tallerResult =
      resolveTakenPitchPhysicalResult({
        trajectory: trajectoryAtHeight(0.99),
        plateZ: 0,
        strikeZone: taller,
        ballRadiusMeters: 0.0366,
      });

    expect(shorterResult?.kind).toBe('ball');
    expect(tallerResult?.kind)
      .toBe('called_strike');
  });

  it('preserves the form-aware landmark resolver behind the same StrikeZoneRegion boundary', () => {
    const landmark =
      resolveLandmarkStrikeZoneRegion({
        plateCenterX: 0,
        landmarks: {
          shoulderTopY: 1.62,
          uniformPantsTopY: 1.02,
          kneecapBottomY: 0.46,
        },
      });
    const generic =
      resolveStrikeZoneRegion({
        policy: 'batting_stance_landmarks',
        plateCenterX: 0,
        landmarks: {
          shoulderTopY: 1.62,
          uniformPantsTopY: 1.02,
          kneecapBottomY: 0.46,
        },
      });

    expect(landmark).toEqual({
      centerX: 0,
      halfWidth:
        HOME_PLATE_WIDTH_METERS / 2,
      lowerY: 0.46,
      upperY: 1.32,
    });
    expect(generic).toEqual(landmark);
  });

  it('rejects invalid height-ratio inputs', () => {
    expect(() =>
      resolveHeightRatioStrikeZoneRegion({
        plateCenterX: 0,
        playerPhysicalProfile: {
          heightMeters: Number.NaN,
        },
      }),
    ).toThrow(
      'playerPhysicalProfile.heightMeters must be finite and positive',
    );

    expect(() =>
      resolveHeightRatioStrikeZoneRegion({
        plateCenterX: 0,
        playerPhysicalProfile:
          createPlayerPhysicalProfile(1.8),
        topFraction: 0.2,
        bottomFraction: 0.3,
      }),
    ).toThrow(
      'strike-zone height fractions must be finite with topFraction > bottomFraction >= 0',
    );
  });
});