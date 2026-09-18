import { describe, expect, it } from 'vitest';
import type {
  DefenderWorldState,
} from '../../model/CanonicalWorldSnapshot';
import type {
  PlayerPerceivedWorldState,
} from '../perception/PlayerPerceivedWorldState';
import type {
  BaseTouchRegion,
} from '../running/BaseTouch';
import {
  buildDefenderMotionTrajectory,
} from './DefenderMotion';
import {
  projectDefenderBodyKinematicsSegment,
} from './DefenderBodyKinematics';
import {
  planDefenderBaseFootReachPrimitive,
} from './DefenderBaseFootReach';
import {
  findDefenderFootBaseContactTick,
} from './DefenderBaseContact';
import {
  resolveDefensiveMovementTarget,
  type DefensiveFieldLandmarks,
} from './DefensiveMovementTarget';
import {
  createTeamCoveragePlan,
  type DefenderCoverageCandidateSet,
} from './TeamCoveragePlan';
import {
  applyTeamCoveragePlanToWorld,
} from './TeamCoverageWorldAdapter';

const candidate = (
  intent:
    DefenderCoverageCandidateSet['candidates'][number]['intent'],
  localPriority: number,
) => ({
  intent,
  localPriority,
  evidenceAvailableAt: 1_300_000,
  evidenceKinds: ['p5-vertical-slice'],
});

const candidateSets:
  readonly DefenderCoverageCandidateSet[] = [
    {
      playerId: 'p',
      registeredPosition: 'P',
      candidates: [
        candidate(
          { kind: 'base_cover', base: 1 },
          0.9,
        ),
        candidate(
          { kind: 'ball_handler' },
          0.3,
        ),
        candidate({ kind: 'hold' }, 0.05),
      ],
    },
    {
      playerId: 'c',
      registeredPosition: 'C',
      candidates: [
        candidate(
          { kind: 'base_cover', base: 4 },
          0.8,
        ),
        candidate({ kind: 'hold' }, 0.1),
      ],
    },
    {
      playerId: '1b',
      registeredPosition: '1B',
      candidates: [
        candidate(
          { kind: 'ball_handler' },
          0.95,
        ),
        candidate(
          { kind: 'base_cover', base: 1 },
          0.4,
        ),
        candidate({ kind: 'hold' }, 0.05),
      ],
    },
    {
      playerId: '2b',
      registeredPosition: '2B',
      candidates: [
        candidate(
          { kind: 'base_cover', base: 2 },
          0.8,
        ),
        candidate({ kind: 'hold' }, 0.1),
      ],
    },
    {
      playerId: '3b',
      registeredPosition: '3B',
      candidates: [
        candidate(
          { kind: 'base_cover', base: 3 },
          0.7,
        ),
        candidate({ kind: 'hold' }, 0.1),
      ],
    },
    {
      playerId: 'ss',
      registeredPosition: 'SS',
      candidates: [
        candidate(
          {
            kind: 'relay',
            target: { x: 12, z: 28 },
          },
          0.7,
        ),
        candidate({ kind: 'hold' }, 0.1),
      ],
    },
    {
      playerId: 'lf',
      registeredPosition: 'LF',
      candidates: [
        candidate(
          {
            kind: 'deep_coverage',
            target: { x: -28, z: 60 },
          },
          0.6,
        ),
        candidate({ kind: 'hold' }, 0.1),
      ],
    },
    {
      playerId: 'cf',
      registeredPosition: 'CF',
      candidates: [
        candidate(
          {
            kind: 'backup',
            target: { x: 0, z: 40 },
          },
          0.6,
        ),
        candidate({ kind: 'hold' }, 0.1),
      ],
    },
    {
      playerId: 'rf',
      registeredPosition: 'RF',
      candidates: [
        candidate({ kind: 'hold' }, 0.2),
      ],
    },
  ];

const world: readonly DefenderWorldState[] = [
  {
    playerId: 'p',
    registeredPosition: 'P',
    position: { x: 26.1, z: 0 },
    velocity: { x: 0, z: 0 },
    assignment: { kind: 'hold' },
  },
  {
    playerId: 'c',
    registeredPosition: 'C',
    position: { x: 0, z: -2 },
    velocity: { x: 0, z: 0 },
    assignment: { kind: 'hold' },
  },
  {
    playerId: '1b',
    registeredPosition: '1B',
    position: { x: 25.4, z: 2.1 },
    velocity: { x: 0, z: 0 },
    assignment: { kind: 'hold' },
  },
  {
    playerId: '2b',
    registeredPosition: '2B',
    position: { x: 8, z: 24 },
    velocity: { x: 0, z: 0 },
    assignment: { kind: 'hold' },
  },
  {
    playerId: '3b',
    registeredPosition: '3B',
    position: { x: -20, z: 20 },
    velocity: { x: 0, z: 0 },
    assignment: { kind: 'hold' },
  },
  {
    playerId: 'ss',
    registeredPosition: 'SS',
    position: { x: -8, z: 24 },
    velocity: { x: 0, z: 0 },
    assignment: { kind: 'hold' },
  },
  {
    playerId: 'lf',
    registeredPosition: 'LF',
    position: { x: -30, z: 55 },
    velocity: { x: 0, z: 0 },
    assignment: { kind: 'hold' },
  },
  {
    playerId: 'cf',
    registeredPosition: 'CF',
    position: { x: -2, z: 23 },
    velocity: { x: 0, z: 0 },
    assignment: { kind: 'hold' },
  },
  {
    playerId: 'rf',
    registeredPosition: 'RF',
    position: { x: 30, z: 55 },
    velocity: { x: 0, z: 0 },
    assignment: { kind: 'hold' },
  },
];

const landmarks: DefensiveFieldLandmarks = {
  basePositions: {
    1: { x: 27.43, z: 0 },
    2: { x: 27.43, z: 27.43 },
    3: { x: 0, z: 27.43 },
    4: { x: 0, z: 0 },
  },
  baseCoverBodyPositions: {
    1: { x: 26.6, z: 0 },
    2: { x: 26.9, z: 26.9 },
    3: { x: 0.15, z: 26.6 },
    4: { x: 0.6, z: 0.6 },
  },
};

const perceivedWorld:
  PlayerPerceivedWorldState<null> = {
    observerId: 'p',
    observationTime: 1_300_000,
    attention: {
      target: { kind: 'ball' },
      focusedSinceTick: 1_200_000,
    },
    ball: {
      estimate: {
        position: { x: 25.4, y: 0.4, z: 2.1 },
        velocity: { x: 2, y: -1, z: 1 },
      },
      sourceObservedAt: 1_250_000,
      predictedAt: 1_300_000,
      confidence: 0.9,
    },
    players: [],
    communications: [],
    knownContext: null,
  };

describe('P5 team coverage physical vertical slice', () => {
  it('carries a globally coordinated first-base cover into actual foot/base contact while all nine players retain one role', () => {
    const plan = createTeamCoveragePlan({
      defenders: candidateSets,
      requireBallHandler: true,
    });

    expect(plan.assignments).toHaveLength(9);
    expect(plan.assignments.filter(
      (assignment) => (
        assignment.intent.kind === 'ball_handler'
      ),
    )).toHaveLength(1);

    const assignedWorld =
      applyTeamCoveragePlanToWorld(
        world,
        plan,
      );

    expect(
      assignedWorld.find(
        (defender) => defender.playerId === '1b',
      )?.assignment,
    ).toEqual({ kind: 'ball_handler' });

    const pitcher = assignedWorld.find(
      (defender) => defender.playerId === 'p',
    );
    expect(pitcher?.assignment).toEqual({
      kind: 'base_cover',
      base: 1,
    });

    const shiftedCenter = assignedWorld.find(
      (defender) => defender.playerId === 'cf',
    );
    expect(shiftedCenter?.registeredPosition)
      .toBe('CF');
    expect(shiftedCenter?.position)
      .toEqual({ x: -2, z: 23 });
    expect(shiftedCenter?.assignment).toEqual({
      kind: 'backup',
      target: { x: 0, z: 40 },
    });

    if (pitcher === undefined) {
      throw new Error(
        'fixture must include pitcher',
      );
    }

    const bodyTarget =
      resolveDefensiveMovementTarget(
        pitcher.assignment,
        perceivedWorld,
        landmarks,
      );
    expect(bodyTarget).toEqual({
      x: 26.6,
      z: 0,
    });
    expect(bodyTarget).not.toEqual(
      landmarks.basePositions[1],
    );

    const bodyMotion =
      buildDefenderMotionTrajectory(
        {
          tick: 1_300_000,
          position: pitcher.position,
          velocity: pitcher.velocity,
        },
        bodyTarget,
        500_000,
        {
          ticksPerSecond: 1_000_000,
          maxIntegrationStepTicks: 500_000,
          accelerationMps2: 4,
          brakingMps2: 4,
          topSpeedMps: 8,
          arrivalRadiusMeters: 0.05,
        },
      );
    expect(bodyMotion).toHaveLength(1);

    const body =
      projectDefenderBodyKinematicsSegment(
        bodyMotion[0],
        1,
      );

    const firstBase: BaseTouchRegion = {
      center: landmarks.basePositions[1],
      halfSize: { x: 0.2, z: 0.2 },
      rotationRadians: 0,
    };

    const foot =
      planDefenderBaseFootReachPrimitive({
        body,
        footState: {
          tick: body.startTick,
          offset: {
            x: 0.4,
            y: -1,
            z: 0,
          },
          velocity: {
            x: 0,
            y: 0,
            z: 0,
          },
        },
        role: 'left_foot',
        targetTick: body.endTick,
        base: firstBase,
        baseLocalContactPoint: {
          x: 0,
          z: 0,
        },
        baseSurfaceHeightMeters: 0,
        parameters: {
          footRadiusMeters: 0.12,
          maximumLegReachMeters: 1.5,
          maxRelativeReachSpeedMps: 3,
          maxRelativeReachAccelerationMps2: 4,
        },
      });

    expect(foot).not.toBeNull();
    if (foot === null) {
      throw new Error(
        'fixture must produce reachable first-base foot',
      );
    }

    const contactTick =
      findDefenderFootBaseContactTick(
        foot,
        firstBase,
        0,
        foot.startTick,
        foot.endTick,
      );

    expect(contactTick).not.toBeNull();
    if (contactTick === null) {
      throw new Error(
        'fixture must physically contact first base',
      );
    }
    expect(contactTick).toBeLessThan(
      foot.endTick,
    );
  });
});
