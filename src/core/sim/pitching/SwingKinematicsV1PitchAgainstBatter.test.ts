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
} from './AerodynamicPitchTrajectory';
import {
  resolveAndRecordSwingKinematicsV1PitchAgainstBatter,
  type SwingKinematicsV1BatterRuntime,
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
  playId: 200,
});

const trajectory = (
  x = 0,
  y = 0.82,
): AerodynamicPitchTrajectory => ({
  start: {
    tick: 1_000_000,
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
  endTick: 1_800_000,
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

const batPhysical:
  RigidBatPhysicalProperties = {
    massKg: 0.9,
    centerOfMassT: 0.58,
    transverseMomentOfInertiaKgM2:
      0.055,
    axialMomentOfInertiaKgM2:
      0.00050,
    radiusProfile: {
      knots: [
        {
          t: 0,
          radiusM: 0.025,
        },
        {
          t: 0.55,
          radiusM: 0.031,
        },
        {
          t: 1,
          radiusM: 0.033,
        },
      ],
    },
  };

const batter:
  SwingKinematicsV1BatterRuntime = {
    handedness: 'R',
    centerOfMass: {
      x: -0.78,
      y: 1.0,
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

const zone = {
  centerX: 0,
  halfWidth: 0.2159,
  lowerY: 0.50,
  upperY: 1.10,
} as const;

describe('Swing Kinematics v1 pitch-against-batter adapter', () => {
  it('records a taken aerodynamic pitch through the canonical timeline', () => {
    const timeline =
      createCanonicalPlateAppearanceTimeline(
        match(),
        900_000,
      );
    const result =
      resolveAndRecordSwingKinematicsV1PitchAgainstBatter(
        timeline,
        {
          action: {
            kind: 'take',
          },
          actualTrajectory:
            trajectory(),
          plateZ: 0,
          strikeZone: zone,
          ballRadiusMeters:
            REALISTIC_BASEBALL_RIGID_BODY
              .radiusM,
        },
      );

    expect(result.kind)
      .toBe('recorded_take');
    if (result.kind !== 'recorded_take') {
      throw new Error(
        'fixture must record a taken pitch',
      );
    }
    expect(
      result.resolution.timeline
        .events.some(
          (event) =>
            event.kind
            === 'PitchAdjudicated',
        ),
    ).toBe(true);
  });

  it('records course-aware rigid contact without a first-order BatterSwingWindow', () => {
    const timeline =
      createCanonicalPlateAppearanceTimeline(
        match(),
        900_000,
      );
    const result =
      resolveAndRecordSwingKinematicsV1PitchAgainstBatter(
        timeline,
        {
          action: {
            kind: 'swing',
          },
          actualTrajectory:
            trajectory(),
          plateZ: 0,
          strikeZone: zone,
          batter,
        },
      );

    expect(result.kind)
      .toBe('recorded_swing');
    if (result.kind !== 'recorded_swing') {
      throw new Error(
        'fixture must record a swing',
      );
    }
    expect(
      result.timing
        .shiftedTrajectory.version,
    ).toBe('swing-kinematics-v1');
    expect(
      result.resolution.physical.kind,
    ).toBe('contact');
    expect(
      result.resolution.timeline
        .status.kind,
    ).toBe('batted_ball_pending');
  });

  it('lets prediction error create a physical miss on the same planned v1 swing', () => {
    const timeline =
      createCanonicalPlateAppearanceTimeline(
        match(),
        900_000,
      );
    const result =
      resolveAndRecordSwingKinematicsV1PitchAgainstBatter(
        timeline,
        {
          action: {
            kind: 'swing',
          },
          predictedTrajectory:
            trajectory(0, 0.82),
          actualTrajectory:
            trajectory(0.55, 0.82),
          plateZ: 0,
          strikeZone: zone,
          batter,
        },
      );

    expect(result.kind)
      .toBe('recorded_swing');
    if (result.kind !== 'recorded_swing') {
      throw new Error(
        'fixture must record a swing',
      );
    }
    expect(
      result.resolution.physical.kind,
    ).toBe('swinging_miss');
  });

  it('shifts the entire trajectory for command timing and anticipation delay', () => {
    const timeline =
      createCanonicalPlateAppearanceTimeline(
        match(),
        900_000,
      );
    const result =
      resolveAndRecordSwingKinematicsV1PitchAgainstBatter(
        timeline,
        {
          action: {
            kind: 'swing',
            timingOffsetTicks:
              -20_000,
            anticipation: {
              resolution: {
                confidence: 1,
                comparedDimensions: 3,
                mismatchedDimensions: 3,
                mismatchFraction: 1,
                confidenceWeightedSurprise: 1,
                pitchSkillMatched: false,
                attackZoneMatched: false,
                verticalPlanMatched: false,
              },
              calibration: {
                maxRecognitionDelayTicks:
                  15_000,
              },
            },
          },
          actualTrajectory:
            trajectory(),
          plateZ: 0,
          strikeZone: zone,
          batter,
        },
      );

    expect(result.kind)
      .toBe('recorded_swing');
    if (result.kind !== 'recorded_swing') {
      throw new Error(
        'fixture must record a swing',
      );
    }

    expect(
      result.timing
        .commandTimingOffsetTicks,
    ).toBe(-20_000);
    expect(
      result.timing
        .recognitionDelayTicks,
    ).toBe(15_000);
    expect(
      result.timing
        .totalTimingShiftTicks,
    ).toBe(-5_000);

    const base =
      result.timing.baseTrajectory;
    const shifted =
      result.timing.shiftedTrajectory;
    expect(
      shifted.startTick
      - base.startTick,
    ).toBe(-5_000);
    expect(
      shifted.contactTick
      - base.contactTick,
    ).toBe(-5_000);
    expect(
      shifted.endTick
      - base.endTick,
    ).toBe(-5_000);
    expect(shifted.start)
      .toEqual(base.start);
    expect(shifted.contact)
      .toEqual(base.contact);
    expect(shifted.finish)
      .toEqual(base.finish);
  });

  it('is deterministic for identical numerical batter and pitch inputs', () => {
    const input = {
      action: {
        kind: 'swing' as const,
        timingOffsetTicks: 3_000,
      },
      actualTrajectory:
        trajectory(-0.04, 0.80),
      plateZ: 0,
      strikeZone: zone,
      batter,
    };

    const run = () =>
      resolveAndRecordSwingKinematicsV1PitchAgainstBatter(
        createCanonicalPlateAppearanceTimeline(
          match(),
          900_000,
        ),
        input,
      );

    expect(run()).toEqual(run());
  });
});