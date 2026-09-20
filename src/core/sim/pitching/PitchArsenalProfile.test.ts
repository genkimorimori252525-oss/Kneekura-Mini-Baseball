import { describe, expect, it } from 'vitest';
import {
  classifyPitchMovementDirection,
  type PitchMovementSignature,
} from './PitchMovementSignature';
import {
  calibratePitchNameRegistry,
} from './PitchNameRegistry';
import {
  MLB_STATCAST_2025_PITCH_NAME_REGISTRY,
} from './MlbStatcast2025PitchNameRegistry';
import {
  buildPitchArsenalEntry,
  buildPitcherPitchArsenalProfile,
} from './PitchArsenalProfile';

const registry = calibratePitchNameRegistry(
  'fixture-v1',
  [
    {
      pitchNameId: 'four_seam',
      displayName: 'フォーシーム',
      signature: {
        inducedHorizontalM: 0,
        inducedVerticalM: 0.38,
      },
    },
    {
      pitchNameId: 'slider',
      displayName: 'スライダー',
      signature: {
        inducedHorizontalM: -0.28,
        inducedVerticalM: -0.06,
      },
    },
    {
      pitchNameId: 'splitter',
      displayName: 'スプリット',
      signature: {
        inducedHorizontalM: 0,
        inducedVerticalM: -0.22,
      },
    },
  ],
);

const sample = (
  horizontal: number,
  vertical: number,
  speed = 40,
): PitchMovementSignature => ({
  inducedHorizontalM: horizontal,
  inducedVerticalM: vertical,
  inducedMagnitudeM: Math.hypot(
    horizontal,
    vertical,
  ),
  directionFamily:
    classifyPitchMovementDirection(
      horizontal,
      vertical,
    ),
  releaseSpeedMps: speed,
  plateSpeedMps: speed - 3,
  totalSpinRadPerSecond: 180,
  activeSpinFractionAtRelease: 0.75,
  activeSpinFractionAtPlate: 0.74,
});

describe('pitch arsenal profile', () => {
  it('registers one readable pitch name from the aggregate physical cluster', () => {
    const entry = buildPitchArsenalEntry({
      pitchSkillId: 'pitch-skill-17',
      registry,
      samples: [
        sample(-0.26, -0.05, 39.8),
        sample(-0.30, -0.07, 40.2),
        sample(-0.27, -0.06, 40.0),
      ],
    });

    expect(entry.pitchSkillId)
      .toBe('pitch-skill-17');
    expect(entry.physical.directionFamily)
      .toBe('x_negative');
    expect(entry.registeredName.displayName)
      .toBe('スライダー');
    expect(entry.physical.samples)
      .toBe(3);
  });

  it('preserves pitcher-specific variation instead of reducing a pitch to its name', () => {
    const stable = buildPitchArsenalEntry({
      pitchSkillId: 'stable',
      registry,
      samples: [
        sample(-0.28, -0.06, 40),
        sample(-0.281, -0.061, 40.05),
        sample(-0.279, -0.059, 39.95),
      ],
    });
    const variable = buildPitchArsenalEntry({
      pitchSkillId: 'variable',
      registry,
      samples: [
        sample(-0.20, -0.01, 39),
        sample(-0.35, -0.11, 41),
        sample(-0.29, -0.06, 40),
      ],
    });

    expect(stable.registeredName.pitchNameId)
      .toBe('slider');
    expect(variable.registeredName.pitchNameId)
      .toBe('slider');
    expect(variable.physical.horizontalStdDevM)
      .toBeGreaterThan(
        stable.physical.horizontalStdDevM,
      );
    expect(variable.physical.releaseSpeedStdDevMps)
      .toBeGreaterThan(
        stable.physical.releaseSpeedStdDevMps,
      );
  });

  it('does not rename individual throws when samples wobble around a boundary', () => {
    const entry = buildPitchArsenalEntry({
      pitchSkillId: 'aggregate-first',
      registry,
      samples: [
        sample(-0.25, -0.04),
        sample(-0.31, -0.08),
        sample(-0.26, -0.05),
        sample(-0.30, -0.07),
      ],
    });

    expect(entry.registeredName.pitchNameId)
      .toBe('slider');
    expect(entry.physical.meanInducedHorizontalM)
      .toBeCloseTo(-0.28, 12);
  });

  it('can mirror Core horizontal movement into an arm-side-positive naming registry without changing stored physics', () => {
    const worldHorizontalM = 4.8 * 0.0254;
    const entry = buildPitchArsenalEntry({
      pitchSkillId: 'rhp-slider-world-frame',
      registry:
        MLB_STATCAST_2025_PITCH_NAME_REGISTRY,
      namingHorizontalMultiplier: -1,
      samples: [
        {
          inducedHorizontalM:
            worldHorizontalM,
          inducedVerticalM:
            1.8 * 0.0254,
          inducedMagnitudeM:
            Math.hypot(
              worldHorizontalM,
              1.8 * 0.0254,
            ),
          directionFamily:
            'x_positive',
          releaseSpeedMps: 38,
          plateSpeedMps: 35,
          totalSpinRadPerSecond: 220,
          activeSpinFractionAtRelease: 0.35,
          activeSpinFractionAtPlate: 0.34,
        },
      ],
    });

    expect(
      entry.physical.meanInducedHorizontalM,
    ).toBeCloseTo(worldHorizontalM, 12);
    expect(entry.registeredName.pitchNameId)
      .toBe('SL');
    expect(entry.registeredName.horizontalFrame)
      .toBe('pitcher_arm_side_positive');
  });

  it('builds player data with stable internal pitch identity and readable registered names', () => {
    const slider = buildPitchArsenalEntry({
      pitchSkillId: 'skill-slider-like',
      registry,
      samples: [
        sample(-0.28, -0.06),
      ],
    });
    const splitter = buildPitchArsenalEntry({
      pitchSkillId: 'skill-split-like',
      registry,
      samples: [
        sample(0, -0.22, 37),
      ],
    });

    const profile =
      buildPitcherPitchArsenalProfile(
        'pitcher-42',
        [slider, splitter],
        registry.version,
      );

    expect(
      profile.pitches.map(
        (pitch) =>
          pitch.registeredName.displayName,
      ),
    ).toEqual([
      'スライダー',
      'スプリット',
    ]);
  });
});
