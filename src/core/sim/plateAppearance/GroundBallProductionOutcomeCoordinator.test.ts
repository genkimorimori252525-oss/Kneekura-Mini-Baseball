import { describe, expect, it } from 'vitest';
import {
  createDefensiveRatings,
} from '../../model/DefensiveRatings';
import type {
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
import {
  asRuleProfileId,
} from '../../model/RuleProfileRef';
import {
  DeterministicRng,
} from '../../rng/DeterministicRng';
import {
  createBattedBallFlightEvidence,
} from '../ball/BattedBallFlightEvidence';
import {
  advanceBallState,
  DEFAULT_BALL_FLIGHT_PARAMETERS,
} from '../ball/BallFlight';
import type {
  DefenderPhysicalPrimitiveSegment,
} from '../fielding/DefenderPhysicalPrimitive';
import type {
  TeamCoveragePlan,
} from '../fielding/TeamCoveragePlan';
import {
  resolveBatBallContact,
  type BatterSwingState,
  type PitchWorldState,
} from '../contact/BatBallContact';
import {
  buildBatterSwingExitRecoveryTrajectory,
} from '../running/BatterSwingExitRecoveryTrajectory';
import {
  buildBatterRunnerWorldTimeline,
} from '../running/BatterRunnerWorldTimeline';
import type {
  RunnerRoute,
} from '../running/RunnerRoute';
import {
  createCanonicalPlateAppearanceTimeline,
  recordBatBallContact,
  recordFairBattedBall,
} from './CanonicalPlateAppearanceTimeline';
import {
  resolveCanonicalGroundBallFirstBaseOutcome,
  type CanonicalGroundBallFirstBaseOutcomeInput,
} from './GroundBallProductionOutcomeCoordinator';

const ratings = createDefensiveRatings({
  positionSuitability: {
    P: 0.5,
    C: 0.5,
    '1B': 0.8,
    '2B': 0.8,
    '3B': 0.5,
    SS: 0.5,
    LF: 0.5,
    CF: 0.5,
    RF: 0.5,
  },
  firstStep: 0.6,
  acceleration: 0.6,
  battedBallRead: 0.7,
  routeEfficiency: 0.7,
  catching: 0.8,
  transfer: 0.8,
  armStrength: 0.8,
  throwingAccuracy: 1,
  situationalAwareness: 0.8,
  tagSkill: 0.6,
});

const match = (): CanonicalMatchState => ({
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 4,
  half: 'top',
  outs: 1,
  balls: 0,
  strikes: 1,
  bases: {
    first: null,
    second: null,
    third: null,
  },
  score: {
    away: 1,
    home: 2,
  },
  playId: 44,
});

const contactAndTimeline = (state: CanonicalMatchState) => {
  const pitch: PitchWorldState = {
    tick: 10_000_000,
    position: { x: 0, y: 1, z: 0.06 },
    velocity: { x: 0, y: -1.5, z: -35 },
    spin: { x: 0, y: 0, z: 0 },
  };
  const swing: BatterSwingState = {
    pose: {
      grip: { x: -0.42, y: 1, z: 0 },
      tip: { x: 0.42, y: 1, z: 0 },
    },
    linearVelocity: { x: 0, y: -7, z: 17 },
    angularVelocity: { x: 0, y: 0, z: 0 },
  };
  const contact = resolveBatBallContact(pitch, swing);
  if (contact === null) {
    throw new Error('fixture must create contact');
  }

  const timeline = recordFairBattedBall(
    recordBatBallContact(
      createCanonicalPlateAppearanceTimeline(
        state,
        contact.tick - 100_000,
      ),
      contact,
    ),
    contact.tick + 1,
  );
  return { contact, timeline };
};

const runnerTimeline = (contactTick: number) => {
  const route: RunnerRoute = {
    segments: [{
      kind: 'line',
      start: { x: 0, z: 0 },
      end: { x: 35, z: 0 },
    }],
  };
  const recovery = buildBatterSwingExitRecoveryTrajectory(
    {
      tick: contactTick,
      planarVelocity: { x: 1, z: 0 },
      bodyForwardUnit: { x: 1, z: 0 },
    },
    route,
    {
      ticksPerSecond: 1_000_000,
      maximumBodyTurnRateRadiansPerSecond: Math.PI,
      lateralRealignmentAccelerationMps2: 3,
      backwardRecoveryAccelerationMps2: 4,
    },
  );
  return buildBatterRunnerWorldTimeline({
    playerId: 'batter',
    route,
    recovery,
    postLaunchIntent: {
      kind: 'advance',
      issuedTick: recovery.transition.launchTick,
    },
    runnerMotionParameters: {
      ticksPerSecond: 1_000_000,
      reactionDelayTicks: 0,
      accelerationMps2: 4,
      brakingMps2: 4,
      slideDecelerationMps2: 5,
      topSpeedMps: 8,
    },
    endTick: recovery.transition.launchTick + 7_000_000,
  });
};

const coverage: TeamCoveragePlan = {
  totalPriority: 9,
  assignments: [
    { playerId: 'p', registeredPosition: 'P', intent: { kind: 'hold' }, selectedPriority: 1, evidenceAvailableAt: 0, evidenceKinds: ['fixture'] },
    { playerId: 'c', registeredPosition: 'C', intent: { kind: 'hold' }, selectedPriority: 1, evidenceAvailableAt: 0, evidenceKinds: ['fixture'] },
    { playerId: '1b', registeredPosition: '1B', intent: { kind: 'base_cover', base: 1 }, selectedPriority: 1, evidenceAvailableAt: 0, evidenceKinds: ['fixture'] },
    { playerId: '2b', registeredPosition: '2B', intent: { kind: 'ball_handler' }, selectedPriority: 1, evidenceAvailableAt: 0, evidenceKinds: ['fixture'] },
    { playerId: '3b', registeredPosition: '3B', intent: { kind: 'hold' }, selectedPriority: 1, evidenceAvailableAt: 0, evidenceKinds: ['fixture'] },
    { playerId: 'ss', registeredPosition: 'SS', intent: { kind: 'hold' }, selectedPriority: 1, evidenceAvailableAt: 0, evidenceKinds: ['fixture'] },
    { playerId: 'lf', registeredPosition: 'LF', intent: { kind: 'hold' }, selectedPriority: 1, evidenceAvailableAt: 0, evidenceKinds: ['fixture'] },
    { playerId: 'cf', registeredPosition: 'CF', intent: { kind: 'hold' }, selectedPriority: 1, evidenceAvailableAt: 0, evidenceKinds: ['fixture'] },
    { playerId: 'rf', registeredPosition: 'RF', intent: { kind: 'hold' }, selectedPriority: 1, evidenceAvailableAt: 0, evidenceKinds: ['fixture'] },
  ],
};

const findRollingTick = (
  flight: ReturnType<typeof createBattedBallFlightEvidence>,
): number => {
  if (flight.firstGroundContact === null) {
    throw new Error('fixture must hit the ground');
  }
  for (
    let tick = flight.firstGroundContact.tick;
    tick <= flight.firstGroundContact.tick + 3_000_000;
    tick += 10_000
  ) {
    const state = advanceBallState(
      flight.initialBall,
      tick - flight.initialBall.tick,
      DEFAULT_BALL_FLIGHT_PARAMETERS,
    );
    if (
      Math.abs(
        state.position.y
        - DEFAULT_BALL_FLIGHT_PARAMETERS.ballRadius,
      ) <= 1e-9
      && Math.abs(state.velocity.y) <= 1e-9
    ) {
      return tick;
    }
  }
  throw new Error('fixture must enter rolling state');
};

describe('GroundBallProductionOutcomeCoordinator', () => {
  it('derives a terminal no-runner first-base out without caller-supplied outcome state', () => {
    const before = match();
    const { contact, timeline } = contactAndTimeline(before);
    const flight = createBattedBallFlightEvidence({
      contact,
      searchDurationTicks: 3_000_000,
      parameters: DEFAULT_BALL_FLIGHT_PARAMETERS,
    });
    const pickupStartTick = findRollingTick(flight);
    const pickupBall = advanceBallState(
      flight.initialBall,
      pickupStartTick - flight.initialBall.tick,
      DEFAULT_BALL_FLIGHT_PARAMETERS,
    );

    const pickupGlove: DefenderPhysicalPrimitiveSegment = {
      role: 'glove',
      radius: 0.04,
      startTick: pickupStartTick,
      endTick: pickupStartTick + 1_000_000,
      ticksPerSecond: 1_000_000,
      startCenter: {
        x: pickupBall.position.x,
        y: pickupBall.position.y,
        z: pickupBall.position.z + 0.06,
      },
      startVelocity: { x: 0, y: 0, z: 0 },
      acceleration: { x: 0, y: 0, z: 0 },
    };

    const runner = runnerTimeline(contact.tick);
    const firstBase = {
      center: { x: 27, z: 0 },
      halfSize: { x: 0.2, z: 0.2 },
      rotationRadians: 0,
    };
    const receiverGlove: DefenderPhysicalPrimitiveSegment = {
      role: 'glove',
      radius: 0.08,
      startTick: contact.tick,
      endTick: runner.endTick,
      ticksPerSecond: 1_000_000,
      startCenter: { x: 27, y: 1.2, z: 0 },
      startVelocity: { x: 0, y: 0, z: 0 },
      acceleration: { x: 0, y: 0, z: 0 },
    };
    const baseFoot: DefenderPhysicalPrimitiveSegment = {
      role: 'left_foot',
      radius: 0.12,
      startTick: contact.tick,
      endTick: runner.endTick,
      ticksPerSecond: 1_000_000,
      startCenter: { x: 27, y: 0, z: 0 },
      startVelocity: { x: 0, y: 0, z: 0 },
      acceleration: { x: 0, y: 0, z: 0 },
    };

    const scenario: CanonicalGroundBallFirstBaseOutcomeInput = {
      match: before,
      timeline,
      flight,
      ballFlightParameters: DEFAULT_BALL_FLIGHT_PARAMETERS,
      coverage,
      throwCandidates: [{
        id: 'first',
        targetBase: 1,
        receiverId: '1b',
        estimatedCompletionTick: runner.endTick,
        outProbability: 0.99,
        scoringThreats: [],
        expectedExtraBasesAllowed: 0,
      }],
      regulationInnings: 9,
      handler: {
        playerId: '2b',
        ratings,
        pickupGlovePrimitive: pickupGlove,
        pickupPocketOffsetMeters: 0,
        pickupBodyStability: 1,
        pickupRetentionParameters: {
          ticksPerSecond: 1_000_000,
          ballMassKg: 0.145,
          ballRadiusMeters: 0.0366,
          pocketRadiusMeters: 0.1,
          centerRetentionCapacityJ: 10_000,
          captureDissipationPowerW: 1_000_000,
          failedContactRestitution: 0.25,
          failedTangentialDamping: 0.4,
          failedSpinDamping: 0.2,
        },
        transferParameters: {
          minimumTransferDelayTicks: 10_000,
          maximumTransferDelayTicks: 20_000,
          fixedGripOffsetTicks: 0,
        },
      },
      firstBaseReceiver: {
        playerId: '1b',
        receptionGlovePrimitive: receiverGlove,
        receptionPocketOffsetMeters: 0,
        receptionBodyStability: 1,
        receptionRetentionParameters: {
          ticksPerSecond: 1_000_000,
          ballMassKg: 0.145,
          ballRadiusMeters: 0.0366,
          pocketRadiusMeters: 0.12,
          centerRetentionCapacityJ: 10_000,
          captureDissipationPowerW: 1_000_000,
          failedContactRestitution: 0.25,
          failedTangentialDamping: 0.4,
          failedSpinDamping: 0.2,
        },
        baseRegion: firstBase,
        baseSurfaceHeightMeters: 0,
        receiverTargetHeightMeters: 1.2,
        baseContactPrimitives: [baseFoot],
      },
      runnerTimeline: runner,
      runnerBodyParameters: {
        uprightLeadMeters: 0.25,
        slideLeadMeters: 0.6,
      },
      rng: new DeterministicRng(20260919),
      throwCalibration: {
        minimumReleaseSpeedMps: 30,
        maximumReleaseSpeedMps: 30,
        minimumTargetErrorMeters: 0,
        maximumTargetErrorMeters: 0,
      },
      throwBallAcceleration: { x: 0, y: 0, z: 0 },
    };
    const result = resolveCanonicalGroundBallFirstBaseOutcome(
      scenario,
    );
    const replay = resolveCanonicalGroundBallFirstBaseOutcome({
      ...scenario,
      rng: new DeterministicRng(20260919),
    });
    const advisoryProbabilityVariant =
      resolveCanonicalGroundBallFirstBaseOutcome({
        ...scenario,
        throwCandidates: scenario.throwCandidates.map(
          (candidate) => ({
            ...candidate,
            outProbability:
              candidate.outProbability === 0 ? 1 : 0,
          }),
        ),
        rng: new DeterministicRng(20260919),
      });

    expect(replay).toEqual(result);
    expect(advisoryProbabilityVariant).toEqual(result);

    const safeAtFirstVariant =
      resolveCanonicalGroundBallFirstBaseOutcome({
        ...scenario,
        rng: new DeterministicRng(20260919),
        throwCalibration: {
          ...scenario.throwCalibration,
          minimumReleaseSpeedMps: 8,
          maximumReleaseSpeedMps: 8,
        },
      });
    expect(safeAtFirstVariant).toMatchObject({
      kind: 'live_ball_continues',
      reason: 'first_base_race_non_terminal',
    });
    if (
      safeAtFirstVariant.kind === 'live_ball_continues'
      && safeAtFirstVariant.physicalRace !== null
    ) {
      expect(
        safeAtFirstVariant.physicalRace.race.correctRuleResult.kind,
      ).toBe('safe');
    }

    const failedPickupVariant =
      resolveCanonicalGroundBallFirstBaseOutcome({
        ...scenario,
        handler: {
          ...scenario.handler,
          pickupRetentionParameters: {
            ...scenario.handler.pickupRetentionParameters,
            centerRetentionCapacityJ: 1e-12,
          },
        },
        rng: new DeterministicRng(20260919),
      });
    expect(failedPickupVariant).toMatchObject({
      kind: 'live_ball_continues',
      reason: 'pickup_not_secured',
      transfer: null,
      throwExecution: null,
      physicalRace: null,
    });

    expect(() =>
      resolveCanonicalGroundBallFirstBaseOutcome({
        ...scenario,
        firstBaseReceiver: {
          ...scenario.firstBaseReceiver,
          receptionRetentionParameters: {
            ...scenario.firstBaseReceiver.receptionRetentionParameters,
            ticksPerSecond: 500_000,
          },
        },
        rng: new DeterministicRng(20260919),
      })
    ).toThrow(
      'canonical ground-ball outcome subsystems must share ticksPerSecond',
    );

    expect(result.kind).toBe('completed');
    if (result.kind !== 'completed') {
      return;
    }

    expect(result.classification)
      .toBe('batter_runner_out_before_first');
    expect(result.physicalRace.race.correctRuleResult.kind)
      .toBe('out');
    expect(result.completion.resolution.basesAfter).toEqual({
      first: null,
      second: null,
      third: null,
    });
    expect(result.completion.nextMatchState).toMatchObject({
      outs: 2,
      bases: {
        first: null,
        second: null,
        third: null,
      },
      playId: 45,
    });
    expect(result.completion.resolution.playEnd.tick)
      .toBe(
        result.physicalRace.ruleEngine.correctRuleResult.kind === 'resolved'
          && result.physicalRace.ruleEngine.correctRuleResult.batterRunnerFirstBase.kind === 'out'
          ? result.physicalRace.ruleEngine.correctRuleResult.batterRunnerFirstBase.outTick
          : -1,
      );
  });

  it('refuses to finalize when pre-pitch runners exist', () => {
    const before = {
      ...match(),
      bases: {
        first: 'r1',
        second: null,
        third: null,
      },
    };
    const { contact, timeline } = contactAndTimeline(before);
    const flight = createBattedBallFlightEvidence({
      contact,
      searchDurationTicks: 3_000_000,
      parameters: DEFAULT_BALL_FLIGHT_PARAMETERS,
    });
    const runner = runnerTimeline(contact.tick);
    const dummyGlove: DefenderPhysicalPrimitiveSegment = {
      role: 'glove',
      radius: 0.04,
      startTick: contact.tick,
      endTick: runner.endTick,
      ticksPerSecond: 1_000_000,
      startCenter: { x: 0, y: 1, z: 0 },
      startVelocity: { x: 0, y: 0, z: 0 },
      acceleration: { x: 0, y: 0, z: 0 },
    };

    const result = resolveCanonicalGroundBallFirstBaseOutcome({
      match: before,
      timeline,
      flight,
      ballFlightParameters: DEFAULT_BALL_FLIGHT_PARAMETERS,
      coverage,
      throwCandidates: [],
      regulationInnings: 9,
      handler: {
        playerId: '2b',
        ratings,
        pickupGlovePrimitive: dummyGlove,
        pickupPocketOffsetMeters: 0,
        pickupBodyStability: 1,
        pickupRetentionParameters: {
          ticksPerSecond: 1_000_000,
          ballMassKg: 0.145,
          ballRadiusMeters: 0.0366,
          pocketRadiusMeters: 0.1,
          centerRetentionCapacityJ: 1,
          captureDissipationPowerW: 1,
          failedContactRestitution: 0,
          failedTangentialDamping: 0,
          failedSpinDamping: 0,
        },
        transferParameters: {
          minimumTransferDelayTicks: 0,
          maximumTransferDelayTicks: 0,
          fixedGripOffsetTicks: 0,
        },
      },
      firstBaseReceiver: {
        playerId: '1b',
        receptionGlovePrimitive: dummyGlove,
        receptionPocketOffsetMeters: 0,
        receptionBodyStability: 1,
        receptionRetentionParameters: {
          ticksPerSecond: 1_000_000,
          ballMassKg: 0.145,
          ballRadiusMeters: 0.0366,
          pocketRadiusMeters: 0.1,
          centerRetentionCapacityJ: 1,
          captureDissipationPowerW: 1,
          failedContactRestitution: 0,
          failedTangentialDamping: 0,
          failedSpinDamping: 0,
        },
        baseRegion: {
          center: { x: 27, z: 0 },
          halfSize: { x: 0.2, z: 0.2 },
          rotationRadians: 0,
        },
        baseSurfaceHeightMeters: 0,
        receiverTargetHeightMeters: 1.2,
        baseContactPrimitives: [],
      },
      runnerTimeline: runner,
      runnerBodyParameters: {
        uprightLeadMeters: 0.25,
        slideLeadMeters: 0.6,
      },
      rng: new DeterministicRng(1),
      throwCalibration: {
        minimumReleaseSpeedMps: 30,
        maximumReleaseSpeedMps: 30,
        minimumTargetErrorMeters: 0,
        maximumTargetErrorMeters: 0,
      },
      throwBallAcceleration: { x: 0, y: 0, z: 0 },
    });

    expect(result).toMatchObject({
      kind: 'live_ball_continues',
      reason: 'unsupported_pre_pitch_runners',
    });
  });
});