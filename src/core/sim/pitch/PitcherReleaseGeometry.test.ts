import { describe, expect, it } from 'vitest';
import {
  projectReleaseHeightTier,
  resolvePitcherReleasePosition,
  type PitcherReleaseGeometryProfile,
} from './PitcherReleaseGeometry';

const profile: PitcherReleaseGeometryProfile = {
  armSlotClass: 'OVERHAND', releaseHeightTier: 'HIGH',
  releaseHeightRatio: 0.9, releaseLateralRatio: 0.1, releaseExtensionRatio: 0.2,
  armSlotElevationDeg: 70, armSlotAzimuthDeg: 0,
};
const body = {
  heightMeters: 1.8, shoulderHeightMeters: 1.5, armReachMeters: 0.8,
  postureDropMeters: 0.1, throwingSide: 'RIGHT' as const,
  moundReference: { x: 0, y: 0, z: 18 },
};

describe('pitcher release geometry', () => {
  it('derives a repeatable world point from continuous player geometry', () => {
    const first = resolvePitcherReleasePosition(body, profile);
    expect(first.x).toBeCloseTo(0.08);
    expect(first.y).toBeCloseTo(1.52);
    expect(first.z).toBeCloseTo(17.84);
    expect(resolvePitcherReleasePosition(body, profile)).toEqual(first);
    expect(resolvePitcherReleasePosition(body, {
      ...profile, armSlotClass: 'UNDERHAND', releaseHeightTier: 'VERY_LOW',
    })).toEqual(first);
  });

  it('accepts overlapping classes and projects tiers only with supplied boundaries', () => {
    const higher = resolvePitcherReleasePosition(body, profile);
    const lower = resolvePitcherReleasePosition(body, {
      ...profile, releaseHeightRatio: 0.8,
    });
    expect(higher.y).toBeGreaterThan(lower.y);
    expect(projectReleaseHeightTier(0.9, [0.65, 0.7, 0.75, 0.8, 0.85, 0.95]))
      .toBe('HIGH');
    expect(projectReleaseHeightTier(0.8, [0.65, 0.7, 0.75, 0.8, 0.85, 0.95]))
      .toBe('HIGH_MID');
  });

  it('rejects a point outside the body reach envelope', () => {
    expect(() => resolvePitcherReleasePosition(body, {
      ...profile, releaseHeightRatio: 1.4,
    })).toThrow('reach envelope');
  });
});
