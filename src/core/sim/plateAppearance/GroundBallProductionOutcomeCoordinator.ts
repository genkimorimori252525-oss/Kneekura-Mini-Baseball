import type {
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
import type {
  DefensiveRatings,
} from '../../model/DefensiveRatings';
import type {
  Vec3,
} from '../../model/geometry';
import type {
  DeterministicRng,
} from '../../rng/DeterministicRng';
import {
  createPlayEndFact,
} from '../../rules/PhysicalRuleFacts';
import {
  resolveGroundBallFirstBasePhysicalRace,
  type GroundBallFirstBasePhysicalRaceResult,
} from '../../rules/FirstBasePhysicalRace';
import {
  advanceBallState,
  DEFAULT_BALL_FLIGHT_PARAMETERS,
  type BallFlightParameters,
} from '../ball/BallFlight';
import type {
  BattedBallFlightEvidence,
} from '../ball/BattedBallFlightEvidence';
import type {
  CatchRetentionContact,
  CatchRetentionParameters,
  CatchRetentionResolution,
} from '../fielding/CatchRetention';
import {
  resolveCatchRetention,
} from '../fielding/CatchRetention';
import {
  createCoverageThrowLaunch,
  type CoverageThrowExecution,
} from '../fielding/CoverageThrowExecution';
import {
  selectThrowPlanForCoverage,
} from '../fielding/CoverageThrowPlan';
import type {
  DefenderPhysicalPrimitiveSegment,
} from '../fielding/DefenderPhysicalPrimitive';
import {
  sampleDefenderPhysicalPrimitiveSegment,
} from '../fielding/DefenderPhysicalPrimitive';
import {
  resolveRatedBallTransferTiming,
} from '../fielding/DefensiveRatingAdapters';
import {
  createDefenseContext,
} from '../fielding/DefenseContext';
import {
  createCatchRetentionContactFromAcceleratedReception,
} from '../fielding/DefenderThrowReceptionContact';
import type {
  BallTransferTiming,
  BallTransferTimingParameters,
} from '../fielding/BallTransferTiming';
import type {
  TeamCoveragePlan,
} from '../fielding/TeamCoveragePlan';
import type {
  ThrowLaunchCalibration,
} from '../fielding/ThrowLaunch';
import type {
  ThrowPlanCandidate,
} from '../fielding/ThrowPlan';
import type {
  BaseTouchRegion,
} from '../running/BaseTouch';
import type {
  BatterRunnerWorldTimeline,
} from '../running/BatterRunnerWorldTimeline';
import type {
  RunnerBodyContactParameters,
} from '../running/RunnerBodyContact';
import type {
  CanonicalPlateAppearanceTimeline,
} from './CanonicalPlateAppearanceTimeline';
import {
  assertBattedBallFlightEvidenceMatchesTimeline,
} from './GroundBallFlightEvidenceBinding';
import {
  assertBatterRunnerTimelineMatchesPlateAppearance,
} from './GroundBallRunnerEvidenceBinding';
import {
  completeGroundBallFirstBasePlateAppearance,
  type GroundBallFirstBasePlateAppearanceCompletionResult,
} from './GroundBallPlateAppearanceCoordinator';

export type GroundBallHandlerPhysicalInput = Readonly<{
  playerId: string;
  ratings: DefensiveRatings;
  pickupGlovePrimitive: DefenderPhysicalPrimitiveSegment;
  pickupPocketOffsetMeters: number;
  pickupBodyStability: number;
  pickupRetentionParameters: CatchRetentionParameters;
  transferParameters: BallTransferTimingParameters;
}>;

export type GroundBallFirstBaseReceiverPhysicalInput = Readonly<{
  playerId: string;
  receptionGlovePrimitive: DefenderPhysicalPrimitiveSegment;
  receptionPocketOffsetMeters: number;
  receptionBodyStability: number;
  receptionRetentionParameters: CatchRetentionParameters;
  baseRegion: BaseTouchRegion;
  baseSurfaceHeightMeters: number;
  receiverTargetHeightMeters: number;
  baseContactPrimitives: readonly DefenderPhysicalPrimitiveSegment[];
}>;

export type CanonicalGroundBallFirstBaseOutcomeInput = Readonly<{
  match: CanonicalMatchState;
  timeline: CanonicalPlateAppearanceTimeline;
  flight: BattedBallFlightEvidence;
  ballFlightParameters: BallFlightParameters;
  coverage: TeamCoveragePlan;
  throwCandidates: readonly ThrowPlanCandidate[];
  regulationInnings: number;
  handler: GroundBallHandlerPhysicalInput;
  firstBaseReceiver: GroundBallFirstBaseReceiverPhysicalInput;
  runnerTimeline: BatterRunnerWorldTimeline;
  runnerBodyParameters: RunnerBodyContactParameters;
  rng: DeterministicRng;
  throwCalibration: ThrowLaunchCalibration;
  throwBallAcceleration: Vec3;
}>;

export type GroundBallPickupEvidence = Readonly<{
  contact: CatchRetentionContact;
  retention: CatchRetentionResolution;
}>;

export type CanonicalGroundBallFirstBaseCompletedOutcome = Readonly<{
  kind: 'completed';
  classification: 'batter_runner_out_before_first';
  pickup: GroundBallPickupEvidence;
  transfer: BallTransferTiming;
  throwExecution: CoverageThrowExecution;
  physicalRace: GroundBallFirstBasePhysicalRaceResult;
  completion: GroundBallFirstBasePlateAppearanceCompletionResult;
}>;

export type CanonicalGroundBallFirstBaseContinuation = Readonly<{
  kind: 'live_ball_continues';
  reason:
    | 'unsupported_pre_pitch_runners'
    | 'missing_first_ground_contact'
    | 'pickup_window_not_rolling_ground_ball'
    | 'no_pickup_contact'
    | 'pickup_not_secured'
    | 'non_first_base_throw'
    | 'first_base_race_non_terminal';
  pickup: GroundBallPickupEvidence | null;
  transfer: BallTransferTiming | null;
  throwExecution: CoverageThrowExecution | null;
  physicalRace: GroundBallFirstBasePhysicalRaceResult | null;
}>;

export type CanonicalGroundBallFirstBaseOutcome =
  | CanonicalGroundBallFirstBaseCompletedOutcome
  | CanonicalGroundBallFirstBaseContinuation;

const CLOCK_EPSILON = 1e-9;

const hasPrePitchRunner = (
  match: CanonicalMatchState,
): boolean => (
  match.bases.first !== null
  || match.bases.second !== null
  || match.bases.third !== null
);

const validateSharedClock = (
  input: CanonicalGroundBallFirstBaseOutcomeInput,
): void => {
  const ticksPerSecond = input.ballFlightParameters.ticksPerSecond;
  const clocks = [
    input.handler.pickupGlovePrimitive.ticksPerSecond,
    input.handler.pickupRetentionParameters.ticksPerSecond,
    input.firstBaseReceiver.receptionGlovePrimitive.ticksPerSecond,
    input.firstBaseReceiver.receptionRetentionParameters.ticksPerSecond,
    input.runnerTimeline.runnerMotionParameters.ticksPerSecond,
    ...input.firstBaseReceiver.baseContactPrimitives.map(
      (primitive) => primitive.ticksPerSecond,
    ),
  ];

  if (clocks.some((clock) => clock !== ticksPerSecond)) {
    throw new Error(
      'canonical ground-ball outcome subsystems must share ticksPerSecond',
    );
  }
  if (
    Math.abs(
      input.flight.ballRadiusMeters
      - input.ballFlightParameters.ballRadius,
    ) > 1e-12
    || Math.abs(
      input.flight.ballRadiusMeters
      - input.handler.pickupRetentionParameters.ballRadiusMeters,
    ) > 1e-12
    || Math.abs(
      input.flight.ballRadiusMeters
      - input.firstBaseReceiver.receptionRetentionParameters.ballRadiusMeters,
    ) > 1e-12
  ) {
    throw new Error(
      'canonical ground-ball outcome ball radius must match across physical subsystems',
    );
  }
};

const validateFairLiveBall = (
  input: CanonicalGroundBallFirstBaseOutcomeInput,
): void => {
  if (input.timeline.playId !== input.match.playId) {
    throw new Error(
      'canonical ground-ball outcome timeline playId must match CanonicalMatchState.playId',
    );
  }
  if (input.timeline.status.kind !== 'live_ball') {
    throw new Error(
      'canonical ground-ball outcome requires a fair live-ball timeline',
    );
  }
  if (
    input.runnerTimeline.playerId.length === 0
    || input.handler.playerId.length === 0
    || input.firstBaseReceiver.playerId.length === 0
  ) {
    throw new Error(
      'canonical ground-ball outcome player ids must not be empty',
    );
  }
};

const rollingAcceleration = (
  velocity: Vec3,
  parameters: BallFlightParameters,
): Vec3 => {
  const speed = Math.hypot(velocity.x, velocity.z);
  const deceleration = (
    parameters.groundRollingDecelerationMps2
    ?? DEFAULT_BALL_FLIGHT_PARAMETERS.groundRollingDecelerationMps2
    ?? 0
  );

  if (speed <= CLOCK_EPSILON || deceleration <= CLOCK_EPSILON) {
    return { x: 0, y: 0, z: 0 };
  }
  return {
    x: -velocity.x / speed * deceleration,
    y: 0,
    z: -velocity.z / speed * deceleration,
  };
};

const deriveGroundBallPickup = (
  input: CanonicalGroundBallFirstBaseOutcomeInput,
): GroundBallPickupEvidence | CanonicalGroundBallFirstBaseContinuation => {
  const firstGroundContact = input.flight.firstGroundContact;
  if (firstGroundContact === null) {
    return {
      kind: 'live_ball_continues',
      reason: 'missing_first_ground_contact',
      pickup: null,
      transfer: null,
      throwExecution: null,
      physicalRace: null,
    };
  }

  const glove = input.handler.pickupGlovePrimitive;
  if (glove.role !== 'glove') {
    throw new Error(
      "ground-ball pickup requires handler pickup primitive role 'glove'",
    );
  }
  if (glove.startTick < firstGroundContact.tick) {
    throw new Error(
      'ground-ball pickup window must not precede first ground contact',
    );
  }
  if (glove.startTick < input.flight.initialBall.tick) {
    throw new Error(
      'ground-ball pickup window must not precede bat-ball contact',
    );
  }

  const ballAtWindowStart = advanceBallState(
    input.flight.initialBall,
    glove.startTick - input.flight.initialBall.tick,
    input.ballFlightParameters,
  );
  const onGround = (
    Math.abs(
      ballAtWindowStart.position.y
      - input.ballFlightParameters.ballRadius,
    ) <= CLOCK_EPSILON
    && Math.abs(ballAtWindowStart.velocity.y) <= CLOCK_EPSILON
  );
  if (!onGround) {
    return {
      kind: 'live_ball_continues',
      reason: 'pickup_window_not_rolling_ground_ball',
      pickup: null,
      transfer: null,
      throwExecution: null,
      physicalRace: null,
    };
  }

  const contact =
    createCatchRetentionContactFromAcceleratedReception({
      ball: {
        tick: ballAtWindowStart.tick,
        position: ballAtWindowStart.position,
        velocity: ballAtWindowStart.velocity,
        spin: ballAtWindowStart.spin,
      },
      ballAcceleration: rollingAcceleration(
        ballAtWindowStart.velocity,
        input.ballFlightParameters,
      ),
      glovePrimitive: glove,
      ballRadiusMeters: input.flight.ballRadiusMeters,
      pocketOffsetMeters: input.handler.pickupPocketOffsetMeters,
      bodyStability: input.handler.pickupBodyStability,
    });

  if (contact === null) {
    return {
      kind: 'live_ball_continues',
      reason: 'no_pickup_contact',
      pickup: null,
      transfer: null,
      throwExecution: null,
      physicalRace: null,
    };
  }

  const retention = resolveCatchRetention(
    contact,
    input.handler.pickupRetentionParameters,
  );
  const pickup: GroundBallPickupEvidence = {
    contact,
    retention,
  };
  if (retention.outcome.kind !== 'secured') {
    return {
      kind: 'live_ball_continues',
      reason: 'pickup_not_secured',
      pickup,
      transfer: null,
      throwExecution: null,
      physicalRace: null,
    };
  }

  return pickup;
};

const slicePrimitiveAt = (
  primitive: DefenderPhysicalPrimitiveSegment,
  startTick: number,
): DefenderPhysicalPrimitiveSegment => {
  if (
    startTick < primitive.startTick
    || startTick > primitive.endTick
  ) {
    throw new Error(
      'derived throw release tick must lie inside receiver glove primitive',
    );
  }
  const sample = sampleDefenderPhysicalPrimitiveSegment(
    primitive,
    startTick,
  );
  return {
    role: primitive.role,
    radius: primitive.radius,
    startTick,
    endTick: primitive.endTick,
    ticksPerSecond: primitive.ticksPerSecond,
    startCenter: sample.center,
    startVelocity: sample.velocity,
    acceleration: sample.acceleration,
  };
};

export const resolveCanonicalGroundBallFirstBaseOutcome = (
  input: CanonicalGroundBallFirstBaseOutcomeInput,
): CanonicalGroundBallFirstBaseOutcome => {
  validateFairLiveBall(input);
  validateSharedClock(input);
  assertBattedBallFlightEvidenceMatchesTimeline(
    input.timeline,
    input.flight,
    input.ballFlightParameters,
  );
  assertBatterRunnerTimelineMatchesPlateAppearance(
    input.timeline,
    input.runnerTimeline,
  );

  if (hasPrePitchRunner(input.match)) {
    return {
      kind: 'live_ball_continues',
      reason: 'unsupported_pre_pitch_runners',
      pickup: null,
      transfer: null,
      throwExecution: null,
      physicalRace: null,
    };
  }

  const pickupResult = deriveGroundBallPickup(input);
  if ('kind' in pickupResult) {
    return pickupResult;
  }
  const pickup = pickupResult;
  if (pickup.retention.outcome.kind !== 'secured') {
    throw new Error('secured pickup invariant was violated');
  }

  const handlerAssignments = input.coverage.assignments.filter(
    (assignment) => assignment.intent.kind === 'ball_handler',
  );
  if (
    handlerAssignments.length !== 1
    || handlerAssignments[0].playerId !== input.handler.playerId
  ) {
    throw new Error(
      'canonical ground-ball outcome handler must match the unique coverage ball handler',
    );
  }

  const transfer = resolveRatedBallTransferTiming(
    pickup.retention.outcome.secureTick,
    input.handler.ratings,
    input.handler.transferParameters,
  );
  const handlerReleaseSample =
    sampleDefenderPhysicalPrimitiveSegment(
      input.handler.pickupGlovePrimitive,
      transfer.throwReadyTick,
    );

  const defenseContext = createDefenseContext(
    input.match,
    { regulationInnings: input.regulationInnings },
  );
  const selection = selectThrowPlanForCoverage(
    defenseContext,
    input.coverage,
    input.throwCandidates,
  );
  if (selection.selection.selected.targetBase !== 1) {
    return {
      kind: 'live_ball_continues',
      reason: 'non_first_base_throw',
      pickup,
      transfer,
      throwExecution: null,
      physicalRace: null,
    };
  }
  if (
    selection.throwerId !== input.handler.playerId
    || selection.selection.selected.receiverId
      !== input.firstBaseReceiver.playerId
  ) {
    throw new Error(
      'canonical ground-ball outcome throw selection must match handler and first-base receiver',
    );
  }

  const throwExecution = createCoverageThrowLaunch({
    selection,
    releaseTick: transfer.throwReadyTick,
    origin: handlerReleaseSample.center,
    receiverTarget: {
      playerId: input.firstBaseReceiver.playerId,
      position: {
        x: input.firstBaseReceiver.baseRegion.center.x,
        y: input.firstBaseReceiver.receiverTargetHeightMeters,
        z: input.firstBaseReceiver.baseRegion.center.z,
      },
    },
    throwerRatings: input.handler.ratings,
    rng: input.rng,
    calibration: input.throwCalibration,
  });

  const receiverGlove = slicePrimitiveAt(
    input.firstBaseReceiver.receptionGlovePrimitive,
    throwExecution.launch.releaseTick,
  );
  if (receiverGlove.role !== 'glove') {
    throw new Error(
      "first-base receiver reception primitive must have role 'glove'",
    );
  }

  const controlThroughTick = Math.max(
    receiverGlove.endTick,
    ...input.firstBaseReceiver.baseContactPrimitives.map(
      (primitive) => primitive.endTick,
    ),
  );
  const physicalRace = resolveGroundBallFirstBasePhysicalRace({
    timeline: input.runnerTimeline,
    firstBase: input.firstBaseReceiver.baseRegion,
    runnerBodyParameters: input.runnerBodyParameters,
    defender: {
      defenderId: input.firstBaseReceiver.playerId,
      baseSurfaceHeightMeters:
        input.firstBaseReceiver.baseSurfaceHeightMeters,
      controlThroughTick,
      contactPrimitives:
        input.firstBaseReceiver.baseContactPrimitives,
      reception: {
        ball: {
          tick: throwExecution.launch.releaseTick,
          position: throwExecution.launch.origin,
          velocity: throwExecution.launch.initialVelocity,
          spin: { x: 0, y: 0, z: 0 },
        },
        ballAcceleration: input.throwBallAcceleration,
        glovePrimitive: receiverGlove,
        ballRadiusMeters: input.flight.ballRadiusMeters,
        pocketOffsetMeters:
          input.firstBaseReceiver.receptionPocketOffsetMeters,
        bodyStability:
          input.firstBaseReceiver.receptionBodyStability,
      },
      retentionParameters:
        input.firstBaseReceiver.receptionRetentionParameters,
    },
    outsAtStart: input.match.outs,
    homeTouches: [],
  });

  const correct = physicalRace.ruleEngine.correctRuleResult;
  if (
    correct.kind !== 'resolved'
    || correct.batterRunnerFirstBase.kind !== 'out'
  ) {
    return {
      kind: 'live_ball_continues',
      reason: 'first_base_race_non_terminal',
      pickup,
      transfer,
      throwExecution,
      physicalRace,
    };
  }

  const playEnd = createPlayEndFact(
    correct.batterRunnerFirstBase.outTick,
    'live_action_complete',
  );
  const completion =
    completeGroundBallFirstBasePlateAppearance({
      match: input.match,
      timeline: input.timeline,
      rule: physicalRace.ruleEngine,
      playEnd,
      basesAfter: {
        first: null,
        second: null,
        third: null,
      },
    });

  return {
    kind: 'completed',
    classification: 'batter_runner_out_before_first',
    pickup,
    transfer,
    throwExecution,
    physicalRace,
    completion,
  };
};