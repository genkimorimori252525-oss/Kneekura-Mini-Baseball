import { describe, expect, it } from 'vitest';
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
  createCommandedSwingKinematicsV1PitchInput,
  type CommandedPhysicalPitchEnvironmentV1,
} from './CommandedSwingKinematicsV1PitchAdapter';

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
): AerodynamicPitchTrajectory => ({
  start: {
    tick: startTick,
    position: {
      x: 0,
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
  pitchOrdinal: number,
): CommandedPhysicalPitchEnvironmentV1 => ({
  pitchOrdinal,
  actualTrajectory:
    trajectory(
      1_000_000
      + pitchOrdinal * 1_000_000,
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
  swingBias:
    'early'
    | 'neutral'
    | 'late' = 'neutral',
) => createPlateAppearanceCommandSession({
  playId: 70,
  batterRunnerId: 'batter-70',
  acceptedAtTick: 900_000,
  matchSeed: 12345,
  command: createPlateAppearanceCommand({
    pitcher: {
      attackZone: 'middle',
      verticalPlan: 'middle',
      aggression: 'balanced',
    },
    batter: {
      approach,
      swingBias,
    },
    runners: {
      posture: 'balanced',
    },
  }),
});

describe('production commanded Swing Kinematics v1 pitch adapter', () => {
  it('keeps deterministic batter decisions by ordinal', () => {
    const run = (pitchOrdinal: number) =>
      createCommandedSwingKinematicsV1PitchInput({
        session:
          session('balanced'),
        environment:
          environment(pitchOrdinal),
      });

    expect(run(2)).toEqual(run(2));
    expect(
      run(2).batterDecisionRoll,
    ).not.toBe(
      run(3).batterDecisionRoll,
    );
  });

  it('creates a take from the physical aerodynamic pitch without a legacy swing seed', () => {
    const result =
      createCommandedSwingKinematicsV1PitchInput({
        session:
          session('take'),
        environment:
          environment(0),
      });

    expect(result.input.action.kind)
      .toBe('take');
    expect(
      result.input
        .actualTrajectory.start.tick,
    ).toBe(1_000_000);
  });

  it('maps early/late bias to whole-trajectory timing input for Swing Kinematics v1', () => {
    const early =
      createCommandedSwingKinematicsV1PitchInput({
        session:
          session(
            'aggressive',
            'early',
          ),
        environment:
          environment(0),
      });
    const late =
      createCommandedSwingKinematicsV1PitchInput({
        session:
          session(
            'aggressive',
            'late',
          ),
        environment:
          environment(0),
      });

    expect(early.input.action.kind)
      .toBe('swing');
    expect(late.input.action.kind)
      .toBe('swing');
    if (
      early.input.action.kind
        !== 'swing'
      || late.input.action.kind
        !== 'swing'
    ) {
      throw new Error(
        'fixtures must swing',
      );
    }

    expect(
      early.input.action
        .timingOffsetTicks,
    ).toBe(-20_000);
    expect(
      late.input.action
        .timingOffsetTicks,
    ).toBe(20_000);
  });
});