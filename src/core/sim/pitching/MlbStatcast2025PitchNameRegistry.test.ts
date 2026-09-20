import { describe, expect, it } from 'vitest';
import {
  MLB_STATCAST_2025_PITCH_NAME_REGISTRY,
  MLB_STATCAST_2025_PITCH_NAME_REGISTRY_VERSION,
  statcastCatcherXToArmSidePositiveInches,
} from './MlbStatcast2025PitchNameRegistry';

const inches = (meters: number): number =>
  meters / 0.0254;

describe('MLB Statcast 2025 pitch-name registry', () => {
  it('mirrors RHP/LHP catcher-view movement into one arm-side-positive frame', () => {
    expect(
      statcastCatcherXToArmSidePositiveInches(
        12,
        'L',
      ),
    ).toBe(12);
    expect(
      statcastCatcherXToArmSidePositiveInches(
        -12,
        'R',
      ),
    ).toBe(12);
  });

  it('is explicitly versioned and pitcher-relative', () => {
    expect(
      MLB_STATCAST_2025_PITCH_NAME_REGISTRY.version,
    ).toBe(
      MLB_STATCAST_2025_PITCH_NAME_REGISTRY_VERSION,
    );
    expect(
      MLB_STATCAST_2025_PITCH_NAME_REGISTRY
        .horizontalFrame,
    ).toBe('pitcher_arm_side_positive');
  });

  it('creates an equal-hand four-seam centroid near the published 2025 values', () => {
    const fourSeam =
      MLB_STATCAST_2025_PITCH_NAME_REGISTRY
        .archetypes
        .find((pitch) =>
          pitch.pitchNameId === 'FF',
        );

    expect(fourSeam).toBeDefined();
    expect(
      inches(fourSeam!.inducedHorizontalM),
    ).toBeCloseTo(
      (7.995300717762561
        + 7.657565632458233) / 2,
      10,
    );
    expect(
      inches(fourSeam!.inducedVerticalM),
    ).toBeCloseTo(
      (16.222589857213197
        + 16.004460927152316) / 2,
      10,
    );
    expect(fourSeam!.displayName)
      .toBe('フォーシーム');
  });

  it('keeps slider and sweeper as separate names inside the same broad glove-side family', () => {
    const slider =
      MLB_STATCAST_2025_PITCH_NAME_REGISTRY
        .archetypes
        .find((pitch) =>
          pitch.pitchNameId === 'SL',
        );
    const sweeper =
      MLB_STATCAST_2025_PITCH_NAME_REGISTRY
        .archetypes
        .find((pitch) =>
          pitch.pitchNameId === 'ST',
        );

    expect(slider).toBeDefined();
    expect(sweeper).toBeDefined();
    expect(slider!.directionFamily)
      .toBe('x_negative');
    expect(sweeper!.directionFamily)
      .toBe('x_negative');
    expect(
      Math.abs(sweeper!.inducedHorizontalM),
    ).toBeGreaterThan(
      Math.abs(slider!.inducedHorizontalM),
    );
  });

  it('separates curve and knuckle-curve by their measured centroids without giving either a trajectory bonus', () => {
    const curve =
      MLB_STATCAST_2025_PITCH_NAME_REGISTRY
        .archetypes
        .find((pitch) =>
          pitch.pitchNameId === 'CU',
        );
    const knuckleCurve =
      MLB_STATCAST_2025_PITCH_NAME_REGISTRY
        .archetypes
        .find((pitch) =>
          pitch.pitchNameId === 'KC',
        );

    expect(curve).toBeDefined();
    expect(knuckleCurve).toBeDefined();
    expect(curve!.directionFamily)
      .toBe('down_x_negative');
    expect(knuckleCurve!.directionFamily)
      .toBe('down_x_negative');
    expect(curve!.inducedHorizontalM)
      .not.toBeCloseTo(
        knuckleCurve!.inducedHorizontalM,
        10,
      );
  });

  it('contains only the common, sufficiently represented pitch labels selected for the seed registry', () => {
    expect(
      MLB_STATCAST_2025_PITCH_NAME_REGISTRY
        .archetypes
        .map((pitch) => pitch.pitchNameId),
    ).toEqual([
      'CH',
      'CU',
      'FC',
      'FF',
      'FS',
      'KC',
      'SI',
      'SL',
      'ST',
      'SV',
    ]);
  });
});
