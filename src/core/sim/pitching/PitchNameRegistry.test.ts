import { describe, expect, it } from 'vitest';
import {
  calibratePitchNameRegistry,
  registerNearestPitchName,
} from './PitchNameRegistry';

const registry = calibratePitchNameRegistry(
  'fixture-v1',
  [
    {
      pitchNameId: 'four_seam',
      displayName: 'フォーシーム',
      signature: {
        inducedHorizontalM: 0.01,
        inducedVerticalM: 0.40,
      },
    },
    {
      pitchNameId: 'four_seam',
      displayName: 'フォーシーム',
      signature: {
        inducedHorizontalM: -0.01,
        inducedVerticalM: 0.38,
      },
    },
    {
      pitchNameId: 'slider',
      displayName: 'スライダー',
      signature: {
        inducedHorizontalM: -0.28,
        inducedVerticalM: -0.07,
      },
    },
    {
      pitchNameId: 'slider',
      displayName: 'スライダー',
      signature: {
        inducedHorizontalM: -0.30,
        inducedVerticalM: -0.05,
      },
    },
    {
      pitchNameId: 'splitter',
      displayName: 'スプリット',
      signature: {
        inducedHorizontalM: 0,
        inducedVerticalM: -0.23,
      },
    },
  ],
);

describe('pitch name registry', () => {
  it('calibrates names from observed movement instead of hard-coding movement into physics', () => {
    const slider = registry.archetypes.find(
      (entry) =>
        entry.pitchNameId === 'slider',
    );

    expect(slider).toMatchObject({
      displayName: 'スライダー',
      calibrationSamples: 2,
      directionFamily: 'x_negative',
    });
    expect(slider!.inducedHorizontalM)
      .toBeCloseTo(-0.29, 12);
    expect(slider!.inducedVerticalM)
      .toBeCloseTo(-0.06, 12);
  });

  it('registers the nearest named archetype inside the broad movement family', () => {
    const registration =
      registerNearestPitchName(
        {
          inducedHorizontalM: -0.27,
          inducedVerticalM: -0.08,
          directionFamily:
            'x_negative',
        },
        registry,
      );

    expect(registration.pitchNameId)
      .toBe('slider');
    expect(registration.displayName)
      .toBe('スライダー');
    expect(registration.registryVersion)
      .toBe('fixture-v1');
  });

  it('uses numeric distance rather than a pitch-type result flag', () => {
    const registration =
      registerNearestPitchName(
        {
          inducedHorizontalM: 0.005,
          inducedVerticalM: -0.21,
          directionFamily: 'down',
        },
        registry,
      );

    expect(registration.pitchNameId)
      .toBe('splitter');
    expect(registration.movementDistanceM)
      .toBeLessThan(0.03);
  });

  it('falls back to all archetypes only when a new broad direction has no calibrated name', () => {
    const registration =
      registerNearestPitchName(
        {
          inducedHorizontalM: 0.25,
          inducedVerticalM: 0.25,
          directionFamily: 'up_x_positive',
        },
        registry,
      );

    expect(registration.pitchNameId)
      .toBe('four_seam');
  });

  it('rejects conflicting display names inside one calibration version', () => {
    expect(() =>
      calibratePitchNameRegistry(
        'bad',
        [
          {
            pitchNameId: 'slider',
            displayName: 'スライダー',
            signature: {
              inducedHorizontalM: -0.2,
              inducedVerticalM: 0,
            },
          },
          {
            pitchNameId: 'slider',
            displayName: '別名',
            signature: {
              inducedHorizontalM: -0.3,
              inducedVerticalM: 0,
            },
          },
        ],
      ),
    ).toThrow(
      'one pitchNameId must use one displayName inside a registry version',
    );
  });
});
