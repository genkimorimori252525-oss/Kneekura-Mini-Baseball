import { describe, expect, it } from 'vitest';
import {
  REFERENCE_BASEBALL_RIGID_BODY,
} from '../contact/RigidBatBallContact';
import {
  IDENTITY_QUATERNION,
} from './BaseballOrientation';
import {
  createPitcherPitchSkillProfile,
  samplePitchSkillRelease,
  type PitchSkillProfile,
} from './PitchSkillProfile';

const skill = (
  repeatabilityScale = 1,
): PitchSkillProfile => ({
  pitchSkillId: 'skill-slider-like',
  releaseTemplate: {
    releasePositionOffsetM: {
      x: 0,
      y: 0,
      z: 0,
    },
    preReleaseVelocityMps: {
      x: 0,
      y: 0,
      z: -38,
    },
    preReleaseSpinRadPerSecond: {
      x: 30,
      y: 190,
      z: -20,
    },
    orientation: IDENTITY_QUATERNION,
    fingerImpulses: [
      {
        fingerId: 'index',
        contactDirectionBody: {
          x: -0.4,
          y: -0.9,
          z: 0,
        },
        impulseWorldNs: {
          x: 0.01,
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
          x: -0.01,
          y: 0,
          z: -0.20,
        },
      },
    ],
  },
  repeatability: {
    releasePositionStdDevM: {
      x: 0.005 * repeatabilityScale,
      y: 0.005 * repeatabilityScale,
      z: 0.004 * repeatabilityScale,
    },
    preReleaseVelocityStdDevMps: {
      x: 0.15 * repeatabilityScale,
      y: 0.15 * repeatabilityScale,
      z: 0.25 * repeatabilityScale,
    },
    preReleaseSpinStdDevRadPerSecond: {
      x: 2 * repeatabilityScale,
      y: 3 * repeatabilityScale,
      z: 2 * repeatabilityScale,
    },
    orientationStdDevRad: {
      x: 0.004 * repeatabilityScale,
      y: 0.004 * repeatabilityScale,
      z: 0.004 * repeatabilityScale,
    },
    fingers: [
      {
        fingerId: 'index',
        contactDirectionStdDev: {
          x: 0.005 * repeatabilityScale,
          y: 0.005 * repeatabilityScale,
          z: 0.005 * repeatabilityScale,
        },
        impulseStdDevNs: {
          x: 0.003 * repeatabilityScale,
          y: 0.003 * repeatabilityScale,
          z: 0.006 * repeatabilityScale,
        },
      },
      {
        fingerId: 'middle',
        contactDirectionStdDev: {
          x: 0.005 * repeatabilityScale,
          y: 0.005 * repeatabilityScale,
          z: 0.005 * repeatabilityScale,
        },
        impulseStdDevNs: {
          x: 0.003 * repeatabilityScale,
          y: 0.003 * repeatabilityScale,
          z: 0.006 * repeatabilityScale,
        },
      },
    ],
  },
});

const context = (
  pitchOrdinal: number,
) => ({
  matchSeed: 20260921,
  playId: 12,
  pitchOrdinal,
  tick: 1_000_000,
  releaseAnchorPosition: {
    x: 0,
    y: 1.8,
    z: 16.5,
  },
  ball: REFERENCE_BASEBALL_RIGID_BODY,
});

describe('pitch skill profile', () => {
  it('keeps pitchSkillId as stable player-owned identity', () => {
    const profile =
      createPitcherPitchSkillProfile(
        'pitcher-42',
        [
          skill(),
          {
            ...skill(),
            pitchSkillId:
              'skill-split-like',
          },
        ],
      );

    expect(
      profile.skills.map(
        (entry) => entry.pitchSkillId,
      ),
    ).toEqual([
      'skill-slider-like',
      'skill-split-like',
    ]);
  });

  it('samples the same throw deterministically from the stable pitch RNG stream', () => {
    const a = samplePitchSkillRelease(
      'pitcher-42',
      skill(),
      context(3),
    );
    const b = samplePitchSkillRelease(
      'pitcher-42',
      skill(),
      context(3),
    );

    expect(a).toEqual(b);
  });

  it('changes the physical release when pitch ordinal changes', () => {
    const first = samplePitchSkillRelease(
      'pitcher-42',
      skill(),
      context(1),
    );
    const second = samplePitchSkillRelease(
      'pitcher-42',
      skill(),
      context(2),
    );

    expect(first.release.position)
      .not.toEqual(second.release.position);
    expect(first.release.preReleaseVelocity)
      .not.toEqual(
        second.release.preReleaseVelocity,
      );
    expect(first.release.fingerImpulses)
      .not.toEqual(
        second.release.fingerImpulses,
      );
  });

  it('makes a perfectly repeatable skill produce its nominal release exactly', () => {
    const sampled = samplePitchSkillRelease(
      'pitcher-42',
      skill(0),
      context(7),
    );

    expect(sampled.release.position)
      .toEqual({
        x: 0,
        y: 1.8,
        z: 16.5,
      });
    expect(
      sampled.release.preReleaseVelocity,
    ).toEqual(
      skill(0).releaseTemplate
        .preReleaseVelocityMps,
    );
    expect(
      sampled.release.preReleaseSpin,
    ).toEqual(
      skill(0).releaseTemplate
        .preReleaseSpinRadPerSecond,
    );
    const nominal =
      skill(0).releaseTemplate
        .fingerImpulses;

    expect(
      sampled.release
        .fingerImpulses
        .map((finger) => ({
          fingerId: finger.fingerId,
          impulseWorldNs:
            finger.impulseWorldNs,
        })),
    ).toEqual(
      nominal.map((finger) => ({
        fingerId: finger.fingerId,
        impulseWorldNs:
          finger.impulseWorldNs,
      })),
    );

    for (
      let index = 0;
      index < nominal.length;
      index += 1
    ) {
      const expected =
        nominal[index]!
          .contactDirectionBody;
      const length = Math.hypot(
        expected.x,
        expected.y,
        expected.z,
      );
      expect(
        sampled.release
          .fingerImpulses[index]!
          .contactDirectionBody,
      ).toEqual({
        x: expected.x / length,
        y: expected.y / length,
        z: expected.z / length,
      });
    }
  });

  it('rejects repeatability entries for fingers that are not part of the learned release', () => {
    const invalid: PitchSkillProfile = {
      ...skill(),
      repeatability: {
        ...skill().repeatability,
        fingers: [
          ...skill().repeatability.fingers,
          {
            fingerId: 'thumb',
            contactDirectionStdDev: {
              x: 0,
              y: 0,
              z: 0,
            },
            impulseStdDevNs: {
              x: 0,
              y: 0,
              z: 0,
            },
          },
        ],
      },
    };

    expect(() =>
      samplePitchSkillRelease(
        'pitcher-42',
        invalid,
        context(1),
      ),
    ).toThrow(
      'pitch skill repeatability fingerId must exist in the release template',
    );
  });
});
