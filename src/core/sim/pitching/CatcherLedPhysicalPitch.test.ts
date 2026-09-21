import { describe, expect, it } from 'vitest';
import type {
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
import {
  asRuleProfileId,
} from '../../model/RuleProfileRef';
import {
  createCanonicalPlateAppearanceTimeline,
} from '../plateAppearance/CanonicalPlateAppearanceTimeline';
import {
  createPlateAppearanceCommand,
} from '../plateAppearance/PlateAppearanceCommand';
import {
  createPlateAppearanceCommandSession,
} from '../plateAppearance/PlateAppearanceCommandSession';
import {
  REFERENCE_BASEBALL_AERODYNAMICS,
} from '../ball/BaseballAerodynamics';
import {
  REFERENCE_BASEBALL_RIGID_BODY,
} from '../contact/RigidBatBallContact';
import {
  IDENTITY_QUATERNION,
} from './BaseballOrientation';
import type {
  CatcherLeadProfile,
} from './CatcherLead';
import {
  simulateCatcherLedPhysicalPitch,
} from './CatcherLedPhysicalPitch';
import type {
  PitchSkillCommandResponseProfile,
} from './PitchSkillCommandResponse';
import {
  createPitcherPitchSkillProfile,
  type PitchSkillProfile,
} from './PitchSkillProfile';

const match = (): CanonicalMatchState => ({
  ruleProfileId:
    asRuleProfileId('npb-2026'),
  inning: 1,
  half: 'top',
  outs: 0,
  balls: 1,
  strikes: 1,
  bases: {
    first: null,
    second: null,
    third: null,
  },
  score: {
    away: 0,
    home: 0,
  },
  playId: 50,
});

const managerSession =
  createPlateAppearanceCommandSession({
    playId: 50,
    batterRunnerId: 'batter-1',
    acceptedAtTick: 900_000,
    matchSeed: 20260921,
    command:
      createPlateAppearanceCommand({
        pitcher: {
          attackZone: 'outside',
          verticalPlan: 'low',
          aggression: 'balanced',
        },
        batter: {
          approach: 'balanced',
          swingBias: 'neutral',
        },
        runners: {
          posture: 'balanced',
        },
      }),
  });

const skill: PitchSkillProfile = {
  pitchSkillId: 'skill-physical-1',
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
      x: 70,
      y: 150,
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
      y: 2,
      z: 1,
    },
    orientationStdDevRad: {
      x: 0.002,
      y: 0.002,
      z: 0.002,
    },
    fingers: [],
  },
};

const catcherLead: CatcherLeadProfile = {
  catcherId: 'catcher-1',
  pitcherId: 'pitcher-1',
  pitchSkillWeights: {
    'skill-physical-1': 1,
  },
  defaultPitchSkillWeight: 1,
  attackZoneWeights: {
    inside: 0,
    middle: 0,
    outside: 1,
  },
  verticalPlanWeights: {
    low: 1,
    middle: 0,
    high: 0,
  },
  aggressionWeights: {
    challenge: 0,
    balanced: 1,
    waste: 0,
  },
  managerDirectiveMultiplier: 2,
  repeatPitchSkillMultiplier: 1,
  repeatAttackZoneMultiplier: 1,
  repeatVerticalPlanMultiplier: 1,
  countAdjustments: [],
};

const response:
  PitchSkillCommandResponseProfile = {
    pitchSkillId: 'skill-physical-1',
    attackZone: {
      inside: {
        preReleaseVelocityDeltaMps: {
          x: -0.4,
          y: 0,
          z: 0,
        },
      },
      middle: {},
      outside: {
        preReleaseVelocityDeltaMps: {
          x: 0.4,
          y: 0,
          z: 0,
        },
      },
    },
    verticalPlan: {
      low: {
        preReleaseVelocityDeltaMps: {
          x: 0,
          y: -0.25,
          z: 0,
        },
      },
      middle: {},
      high: {
        preReleaseVelocityDeltaMps: {
          x: 0,
          y: 0.25,
          z: 0,
        },
      },
    },
    aggression: {
      challenge: {},
      balanced: {},
      waste: {},
    },
  };

describe('catcher-led physical pitch', () => {
  it('runs manager macro -> catcher call -> selected pitch skill -> physical execution', () => {
    const timeline =
      createCanonicalPlateAppearanceTimeline(
        match(),
        900_000,
      );

    const result =
      simulateCatcherLedPhysicalPitch({
        managerSession,
        timeline,
        catcherLead,
        pitcherSkills:
          createPitcherPitchSkillProfile(
            'pitcher-1',
            [skill],
          ),
        commandResponses: [
          response,
        ],
        sampling: {
          matchSeed: 20260921,
          playId: 50,
          pitchOrdinal: 0,
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

    expect(result.call).toMatchObject({
      pitchSkillId:
        'skill-physical-1',
      attackZone: 'outside',
      verticalPlan: 'low',
      count: {
        balls: 1,
        strikes: 1,
      },
    });
    expect(
      result.execution.physical
        .flight.plateCrossing,
    ).not.toBeNull();
    expect(
      result.execution.physical
        .pitchSkillId,
    ).toBe('skill-physical-1');
  });

  it('lets pitcher personality override an anticipated catcher lead, creating surprise without a direct outcome bonus', () => {
    const timeline =
      createCanonicalPlateAppearanceTimeline(
        match(),
        900_000,
      );
    const alternativeSkill: PitchSkillProfile = {
      ...skill,
      pitchSkillId: 'skill-physical-2',
      releaseTemplate: {
        ...skill.releaseTemplate,
        preReleaseSpinRadPerSecond: {
          x: 20,
          y: 230,
          z: -40,
        },
      },
    };
    const alternativeResponse:
      PitchSkillCommandResponseProfile = {
        ...response,
        pitchSkillId: 'skill-physical-2',
      };

    const result =
      simulateCatcherLedPhysicalPitch({
        managerSession,
        timeline,
        catcherLead: {
          ...catcherLead,
          pitchSkillWeights: {
            'skill-physical-1': 1,
            'skill-physical-2': 0,
          },
          defaultPitchSkillWeight: 0,
        },
        pitcherSkills:
          createPitcherPitchSkillProfile(
            'pitcher-1',
            [
              skill,
              alternativeSkill,
            ],
          ),
        commandResponses: [
          response,
          alternativeResponse,
        ],
        pitcherSignBehavior: {
          pitcherId: 'pitcher-1',
          signAutonomy: 1,
          pitchSkillWeights: {
            'skill-physical-1': 0,
            'skill-physical-2': 1,
          },
          defaultPitchSkillWeight: 0,
          attackZoneWeights: {
            inside: 1,
            middle: 0,
            outside: 0,
          },
          verticalPlanWeights: {
            low: 0,
            middle: 0,
            high: 1,
          },
          aggressionWeights: {
            challenge: 1,
            balanced: 0,
            waste: 0,
          },
          catcherCallRetentionMultiplier: 1,
        },
        batterAnticipation: {
          anticipatedPitchSkillId:
            'skill-physical-1',
          anticipatedAttackZone:
            'outside',
          anticipatedVerticalPlan:
            'low',
          confidence: 1,
        },
        sampling: {
          matchSeed: 20260921,
          playId: 50,
          pitchOrdinal: 0,
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

    expect(result.catcherCall).toMatchObject({
      pitchSkillId:
        'skill-physical-1',
      attackZone: 'outside',
      verticalPlan: 'low',
    });
    expect(result.signDecision?.kind)
      .toBe('pitcher_override');
    expect(result.finalCall).toMatchObject({
      pitchSkillId:
        'skill-physical-2',
      attackZone: 'inside',
      verticalPlan: 'high',
      aggression: 'challenge',
    });
    expect(
      result.batterAnticipation
        ?.mismatchedDimensions,
    ).toBe(3);
    expect(
      result.batterAnticipation
        ?.confidenceWeightedSurprise,
    ).toBe(1);
    expect(
      result.execution.physical
        .pitchSkillId,
    ).toBe('skill-physical-2');
  });

  it('is deterministic for the same battery state and pitch ordinal', () => {
    const timeline =
      createCanonicalPlateAppearanceTimeline(
        match(),
        900_000,
      );
    const input = {
      managerSession,
      timeline,
      catcherLead,
      pitcherSkills:
        createPitcherPitchSkillProfile(
          'pitcher-1',
          [skill],
        ),
      commandResponses: [
        response,
      ],
      sampling: {
        matchSeed: 20260921,
        playId: 50,
        pitchOrdinal: 3,
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
    } as const;

    expect(
      simulateCatcherLedPhysicalPitch(
        input,
      ),
    ).toEqual(
      simulateCatcherLedPhysicalPitch(
        input,
      ),
    );
  });
});
