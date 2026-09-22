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
import type {
  AerodynamicPitchTrajectory,
} from './AerodynamicPitchTrajectory';
import {
  resolveAndRecordAerodynamicRigidPitchAgainstBatter,
} from './AerodynamicRigidPitchAgainstBatter';

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
  playId: 90,
});

const trajectory = (): AerodynamicPitchTrajectory => ({
  start: {
    tick: 1_000_000,
    position: {
      x: 0,
      y: 1,
      z: 0.2,
    },
    velocity: {
      x: 0,
      y: 0,
      z: -60,
    },
    spin: {
      x: 0,
      y: 0,
      z: 0,
    },
  },
  endTick: 1_006_000,
  parameters: {
    ticksPerSecond: 1_000_000,
    integrationStepTicks: 100,
    gravityY: -9.81,
    aerodynamics:
      REFERENCE_BASEBALL_AERODYNAMICS,
  },
});

const physical:
  RigidBatPhysicalProperties = {
    massKg: 0.9,
    centerOfMassT: 0.6,
    transverseMomentOfInertiaKgM2:
      0.06,
    axialMomentOfInertiaKgM2:
      0.00055,
    radiusProfile: {
      knots: [
        {
          t: 0,
          radiusM: 0.033,
        },
        {
          t: 1,
          radiusM: 0.033,
        },
      ],
    },
  };

const swing = {
  startTick: 1_000_000,
  endTick: 1_006_000,
  ticksPerSecond: 1_000_000,
  stateAtStart: {
    pose: {
      grip: {
        x: -0.42,
        y: 1,
        z: 0,
      },
      tip: {
        x: 0.42,
        y: 1,
        z: 0,
      },
    },
    linearVelocity: {
      x: 0,
      y: 0,
      z: 0,
    },
    angularVelocity: {
      x: 0,
      y: 0,
      z: 0,
    },
  },
  physical,
} as const;

describe('aerodynamic rigid pitch against batter', () => {
  it('records rigid physical contact through the existing canonical timeline', () => {
    const timeline =
      createCanonicalPlateAppearanceTimeline(
        match(),
        900_000,
      );

    const result =
      resolveAndRecordAerodynamicRigidPitchAgainstBatter(
        timeline,
        {
          action: {
            kind: 'swing',
            swing,
          },
          trajectory: trajectory(),
          ball:
            REALISTIC_BASEBALL_RIGID_BODY,
          parameterResolver: () => ({
            normalRestitution: 0.5,
            tangentialRestitution: 0.3,
            frictionCoefficient: 0.2,
          }),
        },
      );

    expect(result.kind)
      .toBe('recorded_swing');
    expect(result.timeline.status.kind)
      .toBe('batted_ball_pending');
    expect(
      result.timeline.events.some(
        (event) =>
          event.kind
          === 'BatBallContact',
      ),
    ).toBe(true);
  });

  it('records a rigid-path swinging miss through the same canonical strike path', () => {
    const timeline =
      createCanonicalPlateAppearanceTimeline(
        match(),
        900_000,
      );

    const result =
      resolveAndRecordAerodynamicRigidPitchAgainstBatter(
        timeline,
        {
          action: {
            kind: 'swing',
            swing: {
              ...swing,
              stateAtStart: {
                ...swing.stateAtStart,
                pose: {
                  grip: {
                    x: 1,
                    y: 1,
                    z: 0,
                  },
                  tip: {
                    x: 1.8,
                    y: 1,
                    z: 0,
                  },
                },
              },
            },
          },
          trajectory: trajectory(),
          ball:
            REALISTIC_BASEBALL_RIGID_BODY,
          parameterResolver: () => ({
            normalRestitution: 0.5,
            tangentialRestitution: 0.3,
            frictionCoefficient: 0.2,
          }),
        },
      );

    expect(result.kind)
      .toBe('recorded_swing');
    expect(result.timeline.status.kind)
      .toBe('active');
    if (
      result.timeline.status.kind
      !== 'active'
    ) {
      throw new Error(
        'fixture must remain active after first swinging strike',
      );
    }
    expect(
      result.timeline.status.count.strikes,
    ).toBe(1);
  });

  it('keeps taken-pitch adjudication on the same aerodynamic plate crossing', () => {
    const timeline =
      createCanonicalPlateAppearanceTimeline(
        match(),
        900_000,
      );

    const result =
      resolveAndRecordAerodynamicRigidPitchAgainstBatter(
        timeline,
        {
          action: {
            kind: 'take',
          },
          trajectory: trajectory(),
          plateZ: 0,
          strikeZone: {
            centerX: 0,
            halfWidth: 0.25,
            lowerY: 0.5,
            upperY: 1.5,
          },
          ballRadiusMeters:
            REALISTIC_BASEBALL_RIGID_BODY
              .radiusM,
        },
      );

    expect(result.kind)
      .toBe('recorded_take');
  });
});
