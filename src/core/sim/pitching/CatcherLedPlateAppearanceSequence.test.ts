import { describe, expect, it } from 'vitest';
import type {
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
import {
  asRuleProfileId,
} from '../../model/RuleProfileRef';
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
  REALISTIC_BASEBALL_RIGID_BODY,
  type RigidBatPhysicalProperties,
} from '../contact/RigidBatBallContact';
import {
  NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1,
} from '../contact/WoodBatProductionProfileV1';
import {
  resolveWoodBatSpeedResponse,
} from '../contact/WoodBatSpeedResponseProfile';
import {
  IDENTITY_QUATERNION,
} from './BaseballOrientation';
import type {
  CatcherLeadProfile,
} from './CatcherLead';
import {
  resolveCatcherLedPlateAppearanceSequence,
  type CatcherLedPhysicalPlateAppearanceEnvironment,
} from './CatcherLedPlateAppearanceSequence';
import type {
  PitchSkillCommandResponseProfile,
} from './PitchSkillCommandResponse';
import {
  createPitcherPitchSkillProfile,
  type PitchSkillProfile,
} from './PitchSkillProfile';
import type {
  SwingKinematicsV1BatterRuntime,
} from './SwingKinematicsV1PitchAgainstBatter';

const match = (): CanonicalMatchState => ({
  ruleProfileId:
    asRuleProfileId('npb-2026'),
  inning: 1,
  half: 'top',
  outs: 0,
  balls: 0,
  strikes: 0,
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
      x: 0,
      y: 0,
      z: 0,
    },
    orientation:
      IDENTITY_QUATERNION,
    fingerImpulses: [],
  },
  repeatability: {
    releasePositionStdDevM: {
      x: 0,
      y: 0,
      z: 0,
    },
    preReleaseVelocityStdDevMps: {
      x: 0,
      y: 0,
      z: 0,
    },
    preReleaseSpinStdDevRadPerSecond: {
      x: 0,
      y: 0,
      z: 0,
    },
    orientationStdDevRad: {
      x: 0,
      y: 0,
      z: 0,
    },
    fingers: [],
  },
};

const catcherLead:
  CatcherLeadProfile = {
    catcherId: 'catcher-1',
    pitcherId: 'pitcher-1',
    pitchSkillWeights: {
      'skill-physical-1': 1,
    },
    defaultPitchSkillWeight: 0,
    attackZoneWeights: {
      inside: 0,
      middle: 1,
      outside: 0,
    },
    verticalPlanWeights: {
      low: 0,
      middle: 1,
      high: 0,
    },
    aggressionWeights: {
      challenge: 1,
      balanced: 0,
      waste: 0,
    },
    managerDirectiveMultiplier: 1,
    repeatPitchSkillMultiplier: 1,
    repeatAttackZoneMultiplier: 1,
    repeatVerticalPlanMultiplier: 1,
    countAdjustments: [],
  };

const response:
  PitchSkillCommandResponseProfile = {
    pitchSkillId:
      'skill-physical-1',
    attackZone: {
      inside: {},
      middle: {},
      outside: {},
    },
    verticalPlan: {
      low: {},
      middle: {},
      high: {},
    },
    aggression: {
      challenge: {},
      balanced: {},
      waste: {},
    },
  };

const batPhysical:
  RigidBatPhysicalProperties = {
    massKg: 0.9,
    centerOfMassT: 0.58,
    transverseMomentOfInertiaKgM2:
      0.055,
    axialMomentOfInertiaKgM2:
      0.0005,
    radiusProfile: {
      knots: [
        { t: 0, radiusM: 0.025 },
        { t: 0.55, radiusM: 0.031 },
        { t: 1, radiusM: 0.033 },
      ],
    },
  };

const batter:
  SwingKinematicsV1BatterRuntime = {
    handedness: 'R',
    centerOfMass: {
      x: -0.78,
      y: 1,
      z: -0.16,
    },
    batPhysical,
    ball:
      REALISTIC_BASEBALL_RIGID_BODY,
    contactParameterResolver:
      (kinematics) =>
        resolveWoodBatSpeedResponse(
          NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1,
          kinematics
            .normalApproachSpeedMps,
        ),
  };

const managerSession = (
  approach:
    'take'
    | 'balanced'
    | 'aggressive',
) => createPlateAppearanceCommandSession({
  playId: 50,
  batterRunnerId: 'batter-1',
  acceptedAtTick: 900_000,
  matchSeed: 20260921,
  command:
    createPlateAppearanceCommand({
      pitcher: {
        attackZone: 'middle',
        verticalPlan: 'middle',
        aggression: 'challenge',
      },
      batter: {
        approach,
        swingBias: 'neutral',
      },
      runners: {
        posture: 'balanced',
      },
    }),
});

const environment = (
  pitchOrdinal: number,
): CatcherLedPhysicalPlateAppearanceEnvironment => {
  const tick =
    1_000_000
    + pitchOrdinal * 1_000_000;
  return {
    sampling: {
      matchSeed: 20260921,
      playId: 50,
      pitchOrdinal,
      tick,
      releaseAnchorPosition: {
        x: 0,
        y: 0.87,
        z: 15,
      },
      ball:
        REALISTIC_BASEBALL_RIGID_BODY,
    },
    endTick:
      tick + 800_000,
    plateZ: 0,
    strikeZone: {
      centerX: 0,
      halfWidth: 0.2159,
      lowerY: 0.5,
      upperY: 1.1,
    },
    batterCalibration: {
      balancedSwingProbability: 0.5,
      aggressiveSwingProbability: 1,
      earlyTimingOffsetTicks:
        -20_000,
      lateTimingOffsetTicks:
        20_000,
    },
    batter,
  };
};

const trajectoryParameters = {
  ticksPerSecond: 1_000_000,
  integrationStepTicks: 1_000,
  gravityY: 0,
  aerodynamics: {
    ...REFERENCE_BASEBALL_AERODYNAMICS,
    airDensityKgM3: 0,
  },
} as const;

describe('catcher-led physical plate appearance sequence', () => {
  it('uses pitch-skill aerodynamic execution for taken-pitch canonical count flow', () => {
    const result =
      resolveCatcherLedPlateAppearanceSequence({
        match: match(),
        managerSession:
          managerSession('take'),
        catcherLead,
        startedAtTick: 900_000,
        environments: [
          environment(0),
          environment(1),
          environment(2),
        ],
        pitcherSkills:
          createPitcherPitchSkillProfile(
            'pitcher-1',
            [skill],
          ),
        commandResponses: [
          response,
        ],
        trajectoryParameters,
      });

    expect(result.pitchesGenerated)
      .toBe(3);
    expect(
      result.timeline.status.kind,
    ).toBe('strikeout');
    expect(
      result.generatedPitches.every(
        (entry) =>
          entry.commanded
            .input.actualTrajectory
          === entry.physicalPitch
            .execution.physical
            .flight.trajectory,
      ),
    ).toBe(true);
  });

  it('routes an aggressive batter through Swing Kinematics v1 rigid contact', () => {
    const result =
      resolveCatcherLedPlateAppearanceSequence({
        match: match(),
        managerSession:
          managerSession('aggressive'),
        catcherLead,
        startedAtTick: 900_000,
        environments: [
          environment(0),
        ],
        pitcherSkills:
          createPitcherPitchSkillProfile(
            'pitcher-1',
            [skill],
          ),
        commandResponses: [
          response,
        ],
        trajectoryParameters,
      });

    expect(result.pitchesGenerated)
      .toBe(1);
    expect(
      result.generatedPitches[0]!
        .commanded.input.action.kind,
    ).toBe('swing');
    expect(
      result.generatedPitches[0]!
        .batterResolution.kind,
    ).toBe('recorded_swing');
    expect(
      result.timeline.status.kind,
    ).toBe('batted_ball_pending');
  });

  it('applies anticipation mismatch as whole-v1-trajectory recognition delay', () => {
    const result =
      resolveCatcherLedPlateAppearanceSequence({
        match: match(),
        managerSession:
          managerSession('aggressive'),
        catcherLead,
        startedAtTick: 900_000,
        environments: [
          environment(0),
        ],
        pitcherSkills:
          createPitcherPitchSkillProfile(
            'pitcher-1',
            [skill],
          ),
        commandResponses: [
          response,
        ],
        trajectoryParameters,
        batterAnticipation: {
          anticipatedPitchSkillId:
            'wrong-skill',
          anticipatedAttackZone:
            'outside',
          anticipatedVerticalPlan:
            'high',
          confidence: 1,
        },
        anticipationTimingCalibration: {
          maxRecognitionDelayTicks:
            12_000,
        },
      });

    const resolved =
      result.generatedPitches[0]!
        .batterResolution;
    expect(resolved.kind)
      .toBe('recorded_swing');
    if (
      resolved.kind
      !== 'recorded_swing'
    ) {
      throw new Error(
        'fixture must record a swing',
      );
    }
    expect(
      resolved.timing
        .recognitionDelayTicks,
    ).toBe(12_000);
    expect(
      resolved.timing
        .shiftedTrajectory.startTick
      - resolved.timing
        .baseTrajectory.startTick,
    ).toBe(12_000);
    expect(
      resolved.timing
        .shiftedTrajectory.contactTick
      - resolved.timing
        .baseTrajectory.contactTick,
    ).toBe(12_000);
    expect(
      resolved.timing
        .shiftedTrajectory.endTick
      - resolved.timing
        .baseTrajectory.endTick,
    ).toBe(12_000);
  });

  it('is deterministic for the same battery/player numerical state', () => {
    const input = {
      match: match(),
      managerSession:
        managerSession('take'),
      catcherLead,
      startedAtTick: 900_000,
      environments: [
        environment(0),
        environment(1),
      ],
      pitcherSkills:
        createPitcherPitchSkillProfile(
          'pitcher-1',
          [skill],
        ),
      commandResponses: [
        response,
      ],
      trajectoryParameters,
    } as const;

    expect(
      resolveCatcherLedPlateAppearanceSequence(
        input,
      ),
    ).toEqual(
      resolveCatcherLedPlateAppearanceSequence(
        input,
      ),
    );
  });
});