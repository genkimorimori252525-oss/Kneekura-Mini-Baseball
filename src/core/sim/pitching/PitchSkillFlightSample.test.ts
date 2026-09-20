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
  simulatePitchSkillFlightSample,
} from './PitchSkillFlightSample';
import type {
  PitchSkillProfile,
} from './PitchSkillProfile';

const skill = (
  pitchSkillId: string,
  sidespinRadPerSecond: number,
  repeatabilityScale = 1,
): PitchSkillProfile => ({
  pitchSkillId,
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
      x: 40,
      y: sidespinRadPerSecond,
      z: -20,
    },
    orientation:
      IDENTITY_QUATERNION,
    fingerImpulses: [
      {
        fingerId: 'index',
        contactDirectionBody: {
          x: -0.4,
          y: -0.9,
          z: 0,
        },
        impulseWorldNs: {
          x: 0,
          y: 0,
          z: -0.18,
        },
      },
      {
        fingerId: 'middle',
        contactDirectionBody: {
          x: 0.4,
          y: -0.9,
          z: 0,
        },
        impulseWorldNs: {
          x: 0,
          y: 0,
          z: -0.20,
        },
      },
    ],
  },
  repeatability: {
    releasePositionStdDevM: {
      x: 0.004 * repeatabilityScale,
      y: 0.004 * repeatabilityScale,
      z: 0.003 * repeatabilityScale,
    },
    preReleaseVelocityStdDevMps: {
      x: 0.12 * repeatabilityScale,
      y: 0.12 * repeatabilityScale,
      z: 0.20 * repeatabilityScale,
    },
    preReleaseSpinStdDevRadPerSecond: {
      x: 2 * repeatabilityScale,
      y: 3 * repeatabilityScale,
      z: 2 * repeatabilityScale,
    },
    orientationStdDevRad: {
      x: 0.003 * repeatabilityScale,
      y: 0.003 * repeatabilityScale,
      z: 0.003 * repeatabilityScale,
    },
    fingers: [],
  },
});

const input = (
  pitchSkill: PitchSkillProfile,
  pitchOrdinal: number,
) => ({
  pitcherId: 'pitcher-42',
  skill: pitchSkill,
  sampling: {
    matchSeed: 20260921,
    playId: 4,
    pitchOrdinal,
    tick: 1_000_000,
    releaseAnchorPosition: {
      x: 0,
      y: 1.8,
      z: 16.5,
    },
    ball: REFERENCE_BASEBALL_RIGID_BODY,
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
} as const);

describe('pitch skill -> flight -> movement sample', () => {
  it('keeps one stable pitchSkillId through release and physical observation', () => {
    const result =
      simulatePitchSkillFlightSample(
        input(
          skill(
            'skill-slider-like',
            180,
          ),
          1,
        ),
      );

    expect(result.pitchSkillId)
      .toBe('skill-slider-like');
    expect(
      result.sampledRelease.pitchSkillId,
    ).toBe('skill-slider-like');
    expect(result.flight.plateCrossing)
      .not.toBeNull();
    expect(
      result.movement.inducedMagnitudeM,
    ).toBeGreaterThan(0);
  });

  it('is deterministic for the same pitcher skill and pitch ordinal', () => {
    const sampleInput = input(
      skill('skill-a', 170),
      8,
    );

    const a =
      simulatePitchSkillFlightSample(
        sampleInput,
      );
    const b =
      simulatePitchSkillFlightSample(
        sampleInput,
      );

    expect(a).toEqual(b);
  });

  it('lets two learned release patterns produce different movement without changing a pitch-type flag', () => {
    const first =
      simulatePitchSkillFlightSample(
        input(
          skill('skill-a', 80, 0),
          1,
        ),
      );
    const second =
      simulatePitchSkillFlightSample(
        input(
          skill('skill-b', 230, 0),
          1,
        ),
      );

    expect(
      first.movement.inducedHorizontalM,
    ).not.toBeCloseTo(
      second.movement.inducedHorizontalM,
      6,
    );
    expect(first.pitchSkillId)
      .not.toBe(second.pitchSkillId);
  });

  it('creates a physical cluster across repeated throws of the same learned skill', () => {
    const learned = skill(
      'skill-repeatable',
      180,
      1,
    );
    const samples = [
      0,
      1,
      2,
      3,
      4,
      5,
    ].map((ordinal) =>
      simulatePitchSkillFlightSample(
        input(
          learned,
          ordinal,
        ),
      ),
    );

    const horizontalValues =
      samples.map(
        (sample) =>
          sample.movement
            .inducedHorizontalM,
      );
    const uniqueRounded =
      new Set(
        horizontalValues.map(
          (value) =>
            value.toFixed(6),
        ),
      );

    expect(uniqueRounded.size)
      .toBeGreaterThan(1);
    expect(
      samples.every(
        (sample) =>
          sample.pitchSkillId
          === 'skill-repeatable',
      ),
    ).toBe(true);
  });
});
