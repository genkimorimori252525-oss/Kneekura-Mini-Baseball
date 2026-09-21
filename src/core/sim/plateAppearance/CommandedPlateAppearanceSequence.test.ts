import { describe, expect, it } from 'vitest';
import {
  asRuleProfileId,
} from '../../model/RuleProfileRef';
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
import type {
  AerodynamicPitchTrajectory,
} from '../pitching/AerodynamicPitchTrajectory';
import type {
  SwingKinematicsV1BatterRuntime,
} from '../pitching/SwingKinematicsV1PitchAgainstBatter';
import {
  createPlateAppearanceCommand,
} from './PlateAppearanceCommand';
import {
  createPlateAppearanceCommandSession,
} from './PlateAppearanceCommandSession';
import {
  type CommandedPhysicalPitchEnvironmentV1,
} from './CommandedSwingKinematicsV1PitchAdapter';
import {
  resolveCommandedPlateAppearanceSequence,
} from './CommandedPlateAppearanceSequence';

const match = {
  ruleProfileId:
    asRuleProfileId('npb-2026'),
  inning: 1,
  half: 'top' as const,
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
  playId: 21,
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

const trajectory = (
  startTick: number,
  x = 0,
  y = 0.82,
): AerodynamicPitchTrajectory => ({
  start: {
    tick: startTick,
    position: {
      x,
      y: y + 0.05,
      z: 15,
    },
    velocity: {
      x: 0,
      y: 0,
      z: -40,
    },
    spin: {
      x: 0,
      y: 0,
      z: 0,
    },
  },
  endTick:
    startTick + 800_000,
  parameters: {
    ticksPerSecond: 1_000_000,
    integrationStepTicks: 1_000,
    gravityY: 0,
    aerodynamics: {
      ...REFERENCE_BASEBALL_AERODYNAMICS,
      airDensityKgM3: 0,
    },
  },
});

const environment = (
  ordinal: number,
  startTick: number,
  x = 0,
): CommandedPhysicalPitchEnvironmentV1 => ({
  pitchOrdinal: ordinal,
  actualTrajectory:
    trajectory(
      startTick,
      x,
    ),
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
});

const session = (
  approach:
    'take'
    | 'balanced'
    | 'aggressive',
) => createPlateAppearanceCommandSession({
  playId: 21,
  batterRunnerId: 'batter-21',
  acceptedAtTick: 900_000,
  matchSeed: 987654,
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

describe('CommandedPlateAppearanceSequence', () => {
  it('drives multiple taken aerodynamic pitches through the migrated production resolver', () => {
    const result =
      resolveCommandedPlateAppearanceSequence({
        match,
        session:
          session('take'),
        startedAtTick: 900_000,
        environments: [
          environment(
            0,
            1_000_000,
          ),
          environment(
            1,
            2_000_000,
          ),
          environment(
            2,
            3_000_000,
          ),
        ],
      });

    expect(result.pitchesGenerated)
      .toBe(3);
    expect(
      result.timeline.events.filter(
        (event) =>
          event.kind
          === 'PitchAdjudicated',
      ),
    ).toHaveLength(3);
    expect(
      result.timeline.status.kind,
    ).toBe('strikeout');
  });

  it('stops automatically at a terminal result', () => {
    const result =
      resolveCommandedPlateAppearanceSequence({
        match: {
          ...match,
          strikes: 2,
        },
        session:
          session('take'),
        startedAtTick: 900_000,
        environments: [
          environment(
            0,
            1_000_000,
          ),
          environment(
            1,
            2_000_000,
          ),
        ],
      });

    expect(result.pitchesGenerated)
      .toBe(1);
    expect(
      result.unusedEnvironmentCount,
    ).toBe(1);
  });

  it('lets an aggressive command reach the Swing Kinematics v1 rigid contact path', () => {
    const result =
      resolveCommandedPlateAppearanceSequence({
        match,
        session:
          session('aggressive'),
        startedAtTick: 900_000,
        environments: [
          environment(
            0,
            1_000_000,
          ),
        ],
      });

    expect(result.pitchesGenerated)
      .toBe(1);
    expect(
      result.generatedPitches[0]!
        .input.action.kind,
    ).toBe('swing');
    expect(
      result.timeline.status.kind,
    ).toBe('batted_ball_pending');
    expect(
      result.timeline.events.some(
        (event) =>
          event.kind
          === 'BatBallContact',
      ),
    ).toBe(true);
  });

  it('is deterministic for the same physical pitch schedule', () => {
    const run = () =>
      resolveCommandedPlateAppearanceSequence({
        match,
        session:
          session('take'),
        startedAtTick: 900_000,
        environments: [
          environment(
            0,
            1_000_000,
          ),
          environment(
            1,
            2_000_000,
          ),
        ],
      });

    expect(run()).toEqual(run());
  });

  it('requires contiguous physical pitch ordinals', () => {
    expect(() =>
      resolveCommandedPlateAppearanceSequence({
        match,
        session:
          session('take'),
        startedAtTick: 900_000,
        environments: [
          environment(
            1,
            1_000_000,
          ),
        ],
      }),
    ).toThrow(
      'commanded physical pitch environments must use contiguous ordinals starting at zero',
    );
  });
});