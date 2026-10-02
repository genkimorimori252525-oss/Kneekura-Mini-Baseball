import { describe, expect, it } from 'vitest';
import {
  REFERENCE_BASEBALL_AERODYNAMICS,
} from '../ball/BaseballAerodynamics';
import {
  REFERENCE_BASEBALL_RIGID_BODY,
} from '../contact/RigidBatBallContact';
import {
  IDENTITY_QUATERNION,
} from './BaseballOrientation';
import {
  calibratePitchNameRegistry,
} from './PitchNameRegistry';
import {
  buildPitchSkillArsenalEntry,
} from './PitchSkillArsenalAdapter';
import {
  simulatePitchSkillFlightSample,
  type PitchSkillFlightSample,
} from './PitchSkillFlightSample';
import type {
  PitchSkillProfile,
} from './PitchSkillProfile';

const skill: PitchSkillProfile = {
  pitchSkillId: 'learned-1',
  releaseTemplate: {
    releasePositionOffsetM: {
      x: 0,
      y: 0,
      z: 0,
    },
    preReleaseVelocityMps: {
      x: 0,
      y: 0,
      z: -39,
    },
    preReleaseSpinRadPerSecond: {
      x: 50,
      y: 175,
      z: -15,
    },
    orientation:
      IDENTITY_QUATERNION,
    fingerImpulses: [],
  },
  repeatability: {
    releasePositionStdDevM: {
      x: 0.003,
      y: 0.003,
      z: 0.002,
    },
    preReleaseVelocityStdDevMps: {
      x: 0.1,
      y: 0.1,
      z: 0.15,
    },
    preReleaseSpinStdDevRadPerSecond: {
      x: 2,
      y: 3,
      z: 1,
    },
    orientationStdDevRad: {
      x: 0,
      y: 0,
      z: 0,
    },
    fingers: [],
  },
};

const sample = (
  ordinal: number,
): PitchSkillFlightSample =>
  simulatePitchSkillFlightSample({
    pitcherId: 'pitcher-7',
    skill,
    sampling: {
      matchSeed: 20260921,
      playId: 5,
      pitchOrdinal: ordinal,
      tick: 1_000_000,
      releaseAnchorPosition: {
        x: 0,
        y: 1.8,
        z: 16.5,
      },
      ball:
        REFERENCE_BASEBALL_RIGID_BODY,
    },
    trajectoryParameters: {
      ticksPerSecond: 1_000_000,
      integrationStepTicks: 1_000,
      gravityY: -9.81,
      aerodynamics:
        REFERENCE_BASEBALL_AERODYNAMICS,
    },
    endTick: 1_600_000,
    plateZ: 0,
  });

describe('pitch skill arsenal adapter', () => {
  it('registers one name only after repeated physical skill observations exist', () => {
    const samples = [
      sample(0),
      sample(1),
      sample(2),
      sample(3),
    ];
    const meanHorizontal =
      samples.reduce(
        (sum, item) =>
          sum
          + item.movement
            .inducedHorizontalM,
        0,
      ) / samples.length;
    const meanVertical =
      samples.reduce(
        (sum, item) =>
          sum
          + item.movement
            .inducedVerticalM,
        0,
      ) / samples.length;

    const registry =
      calibratePitchNameRegistry(
        'skill-observation-fixture',
        [
          {
            pitchNameId: 'slider',
            displayName: 'スライダー',
            signature: {
              inducedHorizontalM:
                meanHorizontal,
              inducedVerticalM:
                meanVertical,
            },
          },
          {
            pitchNameId: 'other',
            displayName: '別球種',
            signature: {
              inducedHorizontalM:
                meanHorizontal + 0.4,
              inducedVerticalM:
                meanVertical + 0.4,
            },
          },
        ],
      );

    const entry =
      buildPitchSkillArsenalEntry({
        samples,
        registry,
      });

    expect(entry.pitchSkillId)
      .toBe('learned-1');
    expect(entry.registeredName.displayName)
      .toBe('スライダー');
    expect(entry.physical.samples)
      .toBe(4);
    expect(
      entry.physical
        .horizontalStdDevM,
    ).toBeGreaterThan(0);
  });

  it('rejects accidentally mixing observations from different stable pitch skills', () => {
    const a = sample(0);
    const b: PitchSkillFlightSample = {
      ...sample(1),
      pitchSkillId: 'different-skill',
    };
    const registry =
      calibratePitchNameRegistry(
        'fixture',
        [
          {
            pitchNameId: 'x',
            displayName: 'X',
            signature: {
              inducedHorizontalM: 0,
              inducedVerticalM: 0,
            },
          },
        ],
      );

    expect(() =>
      buildPitchSkillArsenalEntry({
        samples: [a, b],
        registry,
      }),
    ).toThrow(
      'pitch skill arsenal samples must share pitcherId and pitchSkillId',
    );
  });
});
