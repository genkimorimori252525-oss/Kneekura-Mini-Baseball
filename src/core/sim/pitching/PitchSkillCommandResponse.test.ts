import { describe, expect, it } from 'vitest';
import {
  IDENTITY_QUATERNION,
} from './BaseballOrientation';
import {
  applyCatcherCallToPitchSkill,
  type PitchSkillCommandResponseProfile,
} from './PitchSkillCommandResponse';
import type {
  CatcherPitchCall,
} from './CatcherLead';
import type {
  PitchSkillProfile,
} from './PitchSkillProfile';

const skill: PitchSkillProfile = {
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
      z: -39,
    },
    preReleaseSpinRadPerSecond: {
      x: 40,
      y: 180,
      z: -20,
    },
    orientation:
      IDENTITY_QUATERNION,
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
          z: -0.2,
        },
      },
    ],
  },
  repeatability: {
    releasePositionStdDevM: {
      x: 0.004,
      y: 0.004,
      z: 0.003,
    },
    preReleaseVelocityStdDevMps: {
      x: 0.15,
      y: 0.15,
      z: 0.2,
    },
    preReleaseSpinStdDevRadPerSecond: {
      x: 2,
      y: 3,
      z: 2,
    },
    orientationStdDevRad: {
      x: 0.003,
      y: 0.003,
      z: 0.003,
    },
    fingers: [],
  },
};

const zero = {};
const response:
  PitchSkillCommandResponseProfile = {
    pitchSkillId: 'skill-1',
    attackZone: {
      inside: {
        preReleaseVelocityDeltaMps: {
          x: -0.35,
          y: 0,
          z: 0,
        },
      },
      middle: zero,
      outside: {
        preReleaseVelocityDeltaMps: {
          x: 0.35,
          y: 0,
          z: 0,
        },
      },
    },
    verticalPlan: {
      low: {
        preReleaseVelocityDeltaMps: {
          x: 0,
          y: -0.3,
          z: 0,
        },
      },
      middle: zero,
      high: {
        preReleaseVelocityDeltaMps: {
          x: 0,
          y: 0.3,
          z: 0,
        },
      },
    },
    aggression: {
      challenge: {
        preReleaseVelocityDeltaMps: {
          x: 0,
          y: 0,
          z: -0.4,
        },
      },
      balanced: zero,
      waste: {
        preReleaseVelocityDeltaMps: {
          x: 0,
          y: 0,
          z: 0.2,
        },
      },
    },
  };

const call = (
  attackZone:
    'inside' | 'middle' | 'outside',
  verticalPlan:
    'low' | 'middle' | 'high',
): CatcherPitchCall => ({
  catcherId: 'catcher-1',
  pitcherId: 'pitcher-1',
  pitchOrdinal: 1,
  pitchSkillId: 'skill-1',
  attackZone,
  verticalPlan,
  aggression: 'balanced',
  count: {
    balls: 1,
    strikes: 1,
  },
  managerDirective: {
    attackZone: 'outside',
    verticalPlan: 'low',
    aggression: 'balanced',
  },
});

describe('pitch skill command response', () => {
  it('turns coarse catcher location into physical release adjustment, not an exact plate coordinate', () => {
    const inside =
      applyCatcherCallToPitchSkill(
        skill,
        response,
        call(
          'inside',
          'middle',
        ),
      );
    const outside =
      applyCatcherCallToPitchSkill(
        skill,
        response,
        call(
          'outside',
          'middle',
        ),
      );

    expect(
      inside.releaseTemplate
        .preReleaseVelocityMps.x,
    ).toBeLessThan(
      skill.releaseTemplate
        .preReleaseVelocityMps.x,
    );
    expect(
      outside.releaseTemplate
        .preReleaseVelocityMps.x,
    ).toBeGreaterThan(
      skill.releaseTemplate
        .preReleaseVelocityMps.x,
    );
  });

  it('composes horizontal and vertical motor-plan adjustments', () => {
    const adjusted =
      applyCatcherCallToPitchSkill(
        skill,
        response,
        call(
          'outside',
          'high',
        ),
      );

    expect(
      adjusted.releaseTemplate
        .preReleaseVelocityMps,
    ).toEqual({
      x: 0.35,
      y: 0.3,
      z: -39,
    });
  });

  it('preserves the stable pitch skill identity and repeatability model', () => {
    const adjusted =
      applyCatcherCallToPitchSkill(
        skill,
        response,
        call(
          'inside',
          'low',
        ),
      );

    expect(adjusted.pitchSkillId)
      .toBe(skill.pitchSkillId);
    expect(adjusted.repeatability)
      .toEqual(skill.repeatability);
  });

  it('rejects a catcher call for a different learned pitch skill', () => {
    expect(() =>
      applyCatcherCallToPitchSkill(
        skill,
        response,
        {
          ...call(
            'inside',
            'low',
          ),
          pitchSkillId:
            'different',
        },
      ),
    ).toThrow(
      'catcher call, pitch skill, and command response must share pitchSkillId',
    );
  });
});
