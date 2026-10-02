import { describe, expect, it } from 'vitest';
import {
  buildPitchArsenalEntry,
  buildPitcherPitchArsenalProfile,
} from '../../core/sim/pitching/PitchArsenalProfile';
import type {
  PitchMovementSignature,
} from '../../core/sim/pitching/PitchMovementSignature';
import {
  calibratePitchNameRegistry,
} from '../../core/sim/pitching/PitchNameRegistry';
import {
  buildMiniPitchArsenalState,
} from './MiniPitchArsenalState';

const registry = calibratePitchNameRegistry(
  'fixture-v1',
  [
    {
      pitchNameId: 'slider',
      displayName: 'スライダー',
      signature: {
        inducedHorizontalM: 0.25,
        inducedVerticalM: -0.08,
      },
    },
  ],
);

const signature = (
  horizontal: number,
  vertical: number,
  speed: number,
): PitchMovementSignature => ({
  inducedHorizontalM: horizontal,
  inducedVerticalM: vertical,
  inducedMagnitudeM:
    Math.hypot(horizontal, vertical),
  directionFamily: 'down_x_positive',
  releaseSpeedMps: speed,
  plateSpeedMps: speed - 3,
  totalSpinRadPerSecond: 180,
  activeSpinFractionAtRelease: 0.7,
  activeSpinFractionAtPlate: 0.69,
});

describe('MiniPitchArsenalState', () => {
  it('presents a readable pitch name while retaining physical movement numbers', () => {
    const entry = buildPitchArsenalEntry({
      pitchSkillId: 'skill-1',
      registry,
      samples: [
        signature(0.24, -0.07, 40),
        signature(0.26, -0.09, 41),
      ],
    });
    const profile =
      buildPitcherPitchArsenalProfile(
        'pitcher-1',
        [entry],
        registry.version,
      );

    const state = buildMiniPitchArsenalState(
      profile,
      'positive_x_is_right',
    );

    expect(state.pitches[0]).toMatchObject({
      pitchName: 'スライダー',
      direction: 'right',
      meanHorizontalBreakCm: 25,
      meanVerticalBreakCm: -8,
      meanReleaseSpeedKph: 145.8,
      samples: 2,
    });
    expect(
      state.pitches[0]!.horizontalStdDevCm,
    ).toBeGreaterThan(0);
  });

  it('can flip only the display convention without changing the physical profile', () => {
    const entry = buildPitchArsenalEntry({
      pitchSkillId: 'skill-1',
      registry,
      samples: [
        signature(0.25, -0.08, 40),
      ],
    });
    const profile =
      buildPitcherPitchArsenalProfile(
        'pitcher-1',
        [entry],
        registry.version,
      );

    const rightPositive =
      buildMiniPitchArsenalState(
        profile,
        'positive_x_is_right',
      );
    const leftPositive =
      buildMiniPitchArsenalState(
        profile,
        'positive_x_is_left',
      );

    expect(
      rightPositive.pitches[0]!.direction,
    ).toBe('right');
    expect(
      leftPositive.pitches[0]!.direction,
    ).toBe('left');
    expect(
      leftPositive.pitches[0]!
        .meanHorizontalBreakCm,
    ).toBe(
      rightPositive.pitches[0]!
        .meanHorizontalBreakCm,
    );
  });
});
