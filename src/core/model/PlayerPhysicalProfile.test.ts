import { describe, expect, it } from 'vitest';
import {
  REFERENCE_PLAYER_HEIGHT_METERS,
  createPlayerPhysicalProfile,
  getPlayerHeightScale,
} from './PlayerPhysicalProfile';

describe('PlayerPhysicalProfile', () => {
  it('uses 1.80m as a game calibration reference without changing the supplied height', () => {
    const profile = createPlayerPhysicalProfile(1.8);

    expect(profile).toEqual({
      heightMeters: 1.8,
    });
    expect(REFERENCE_PLAYER_HEIGHT_METERS).toBe(1.8);
    expect(getPlayerHeightScale(profile)).toBe(1);
  });

  it('returns deterministic relative height scale above and below the reference', () => {
    expect(getPlayerHeightScale(
      createPlayerPhysicalProfile(1.98),
    )).toBeCloseTo(1.1, 12);

    expect(getPlayerHeightScale(
      createPlayerPhysicalProfile(1.62),
    )).toBeCloseTo(0.9, 12);
  });

  it('supports an explicit alternative calibration reference without mutating the profile', () => {
    const profile = createPlayerPhysicalProfile(1.8);

    expect(getPlayerHeightScale(
      profile,
      1.5,
    )).toBeCloseTo(1.2, 12);
    expect(profile).toEqual({
      heightMeters: 1.8,
    });
  });

  it('rejects non-physical height values', () => {
    expect(() => createPlayerPhysicalProfile(0))
      .toThrow(
        'heightMeters must be finite and positive',
      );
    expect(() => createPlayerPhysicalProfile(
      Number.NaN,
    )).toThrow(
      'heightMeters must be finite and positive',
    );
    expect(() => getPlayerHeightScale(
      createPlayerPhysicalProfile(1.8),
      0,
    )).toThrow(
      'referenceHeightMeters must be finite and positive',
    );
  });
});
