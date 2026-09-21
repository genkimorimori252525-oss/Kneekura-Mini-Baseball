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
import type {
  CommandedPhysicalPitchEnvironmentV1,
} from './CommandedSwingKinematicsV1PitchAdapter';
import {
  resolveCommandedPlateAppearanceToMatchState,
} from './CommandedPlateAppearanceCoordinator';

const baseMatch = {
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
  playId: 31,
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
  x: number,
): AerodynamicPitchTrajectory => ({
  start: {
    tick: startTick,
    position: {
      x,
      y: 0.87,
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
  x: number,
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
    balancedSwingProbability: 0,
    aggressiveSwingProbability: 1,
    earlyTimingOffsetTicks:
      -20_000,
    lateTimingOffsetTicks:
      20_000,
  },
  batter,
});

const session = (
  matchSeed: number,
) => createPlateAppearanceCommandSession({
  playId: 31,
  batterRunnerId: 'batter-31',
  acceptedAtTick: 900_000,
  matchSeed,
  command:
    createPlateAppearanceCommand({
      pitcher: {
        attackZone: 'middle',
        verticalPlan: 'middle',
        aggression: 'challenge',
      },
      batter: {
        approach: 'take',
        swingBias: 'neutral',
      },
      runners: {
        posture: 'balanced',
      },
    }),
});

describe('CommandedPlateAppearanceCoordinator', () => {
  it('applies three physical called strikes to CanonicalMatchState', () => {
    const result =
      resolveCommandedPlateAppearanceToMatchState({
        match: baseMatch,
        session: session(111),
        startedAtTick: 900_000,
        environments: [
          environment(
            0,
            1_000_000,
            0,
          ),
          environment(
            1,
            2_000_000,
            0,
          ),
          environment(
            2,
            3_000_000,
            0,
          ),
          environment(
            3,
            4_000_000,
            0,
          ),
        ],
      });

    expect(result.kind)
      .toBe('complete');
    if (
      result.kind !== 'complete'
    ) {
      throw new Error(
        'fixture must strike out',
      );
    }
    expect(result.terminalKind)
      .toBe('strikeout');
    expect(result.pitchesGenerated)
      .toBe(3);
    expect(
      result.unusedEnvironmentCount,
    ).toBe(1);
    expect(
      result.nextMatchState.outs,
    ).toBe(1);
  });

  it('applies four physical balls as a walk', () => {
    const result =
      resolveCommandedPlateAppearanceToMatchState({
        match: baseMatch,
        session: session(222),
        startedAtTick: 900_000,
        environments: [
          environment(
            0,
            1_000_000,
            0.6,
          ),
          environment(
            1,
            2_000_000,
            0.6,
          ),
          environment(
            2,
            3_000_000,
            0.6,
          ),
          environment(
            3,
            4_000_000,
            0.6,
          ),
          environment(
            4,
            5_000_000,
            0.6,
          ),
        ],
      });

    expect(result.kind)
      .toBe('complete');
    if (
      result.kind !== 'complete'
    ) {
      throw new Error(
        'fixture must walk',
      );
    }
    expect(result.terminalKind)
      .toBe('walk');
    expect(result.pitchesGenerated)
      .toBe(4);
    expect(
      result.nextMatchState
        .bases.first,
    ).toBe('batter-31');
  });

  it('returns active when the physical pitch schedule ends early', () => {
    const result =
      resolveCommandedPlateAppearanceToMatchState({
        match: baseMatch,
        session: session(333),
        startedAtTick: 900_000,
        environments: [
          environment(
            0,
            1_000_000,
            0,
          ),
        ],
      });

    expect(result.kind)
      .toBe('active');
    if (
      result.kind !== 'active'
    ) {
      throw new Error(
        'fixture must remain active',
      );
    }
    expect(result.pitchesGenerated)
      .toBe(1);
  });
});