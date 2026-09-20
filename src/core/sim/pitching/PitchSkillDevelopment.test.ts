import { describe, expect, it } from 'vitest';
import {
  IDENTITY_QUATERNION,
  quaternionFromAxisAngle,
} from './BaseballOrientation';
import {
  adaptPitchSkillTowardPhysicalTarget,
} from './PitchSkillDevelopment';
import type {
  PitchSkillProfile,
} from './PitchSkillProfile';

const profile = (
  spinY: number,
  velocityZ: number,
  stdDevScale: number,
): PitchSkillProfile => ({
  pitchSkillId: 'skill-1',
  releaseTemplate: {
    releasePositionOffsetM: {
      x: 0,
      y: 0,
      z: 0,
    },
    preReleaseVelocityMps: {
      x: 0,
      y: 0,
      z: velocityZ,
    },
    preReleaseSpinRadPerSecond: {
      x: 0,
      y: spinY,
      z: 0,
    },
    orientation:
      spinY < 150
        ? IDENTITY_QUATERNION
        : quaternionFromAxisAngle(
            { x: 0, y: 0, z: 1 },
            0.2,
          ),
    fingerImpulses: [
      {
        fingerId: 'middle',
        contactDirectionBody: {
          x: 0,
          y: -1,
          z: 0,
        },
        impulseWorldNs: {
          x: 0,
          y: 0,
          z: -0.2
            - spinY / 2000,
        },
      },
    ],
  },
  repeatability: {
    releasePositionStdDevM: {
      x: 0.01 * stdDevScale,
      y: 0.01 * stdDevScale,
      z: 0.01 * stdDevScale,
    },
    preReleaseVelocityStdDevMps: {
      x: 0.5 * stdDevScale,
      y: 0.5 * stdDevScale,
      z: 0.5 * stdDevScale,
    },
    preReleaseSpinStdDevRadPerSecond: {
      x: 8 * stdDevScale,
      y: 8 * stdDevScale,
      z: 8 * stdDevScale,
    },
    orientationStdDevRad: {
      x: 0.02 * stdDevScale,
      y: 0.02 * stdDevScale,
      z: 0.02 * stdDevScale,
    },
    fingers: [
      {
        fingerId: 'middle',
        contactDirectionStdDev: {
          x: 0.02 * stdDevScale,
          y: 0.02 * stdDevScale,
          z: 0.02 * stdDevScale,
        },
        impulseStdDevNs: {
          x: 0.01 * stdDevScale,
          y: 0.01 * stdDevScale,
          z: 0.01 * stdDevScale,
        },
      },
    ],
  },
});

describe('pitch skill development', () => {
  it('preserves stable pitchSkillId while physical technique evolves', () => {
    const current = profile(
      100,
      -37,
      1,
    );
    const target = profile(
      200,
      -40,
      0.4,
    );

    const next =
      adaptPitchSkillTowardPhysicalTarget(
        current,
        target,
        0.25,
      );

    expect(next.pitchSkillId)
      .toBe('skill-1');
    expect(
      next.releaseTemplate
        .preReleaseSpinRadPerSecond.y,
    ).toBeCloseTo(125, 12);
    expect(
      next.releaseTemplate
        .preReleaseVelocityMps.z,
    ).toBeCloseTo(-37.75, 12);
  });

  it('can improve repeatability as a physical reduction in release variance', () => {
    const current = profile(
      100,
      -37,
      1,
    );
    const target = profile(
      100,
      -37,
      0.2,
    );

    const next =
      adaptPitchSkillTowardPhysicalTarget(
        current,
        target,
        0.5,
      );

    expect(
      next.repeatability
        .releasePositionStdDevM.x,
    ).toBeLessThan(
      current.repeatability
        .releasePositionStdDevM.x,
    );
    expect(
      next.repeatability
        .preReleaseSpinStdDevRadPerSecond.y,
    ).toBeCloseTo(4.8, 12);
  });

  it('rate zero and one are exact physical endpoints', () => {
    const current = profile(
      100,
      -37,
      1,
    );
    const target = profile(
      200,
      -40,
      0.4,
    );

    expect(
      adaptPitchSkillTowardPhysicalTarget(
        current,
        target,
        0,
      ),
    ).toEqual(current);
    expect(
      adaptPitchSkillTowardPhysicalTarget(
        current,
        target,
        1,
      ),
    ).toEqual(target);
  });

  it('rejects development that silently changes pitch identity', () => {
    const current = profile(
      100,
      -37,
      1,
    );
    const target: PitchSkillProfile = {
      ...profile(
        200,
        -40,
        0.4,
      ),
      pitchSkillId: 'different',
    };

    expect(() =>
      adaptPitchSkillTowardPhysicalTarget(
        current,
        target,
        0.5,
      ),
    ).toThrow(
      'pitch skill development target must preserve pitchSkillId',
    );
  });
});
