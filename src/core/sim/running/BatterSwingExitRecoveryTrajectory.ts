import type {
  BaserunnerWorldState,
} from '../../model/CanonicalWorldSnapshot';
import type { Vec2 } from '../../model/geometry';
import {
  resolveBatterSwingExitRunTransition,
  type BatterSwingExitRunTransitionParameters,
  type BatterSwingExitRunTransitionResult,
  type SwingExitBodyState,
} from './BatterSwingExitRunTransition';
import {
  sampleRunnerRoute,
  type RunnerRoute,
} from './RunnerRoute';

export type BatterSwingExitRecoveryTrajectory = Readonly<{
  startTick: number;
  endTick: number;
  ticksPerSecond: number;
  startPosition: Vec2;
  routeTangent: Vec2;
  lateralUnit: Vec2;
  initialForwardVelocityMps: number;
  initialLateralVelocityMps: number;
  signedTurnRadians: number;
  maximumBodyTurnRateRadiansPerSecond: number;
  lateralRealignmentAccelerationMps2: number;
  backwardRecoveryAccelerationMps2: number;
  transition: BatterSwingExitRunTransitionResult;
}>;

export type BatterSwingExitRecoverySample = Readonly<{
  tick: number;
  position: Vec2;
  velocity: Vec2;
  bodyForwardUnit: Vec2;
}>;

type ScalarRecoverySample = Readonly<{
  displacementMeters: number;
  velocityMps: number;
  accelerationMps2: number;
  endElapsedSeconds: number;
}>;

const EPSILON = 1e-12;
const TURN_TOLERANCE = 1e-9;

const canonicalZero = (value: number): number => (
  Math.abs(value) <= EPSILON ? 0 : value
);

const canonicalVec2 = (value: Vec2): Vec2 => ({
  x: canonicalZero(value.x),
  z: canonicalZero(value.z),
});

const dot = (first: Vec2, second: Vec2): number => (
  first.x * second.x + first.z * second.z
);

const crossScalar = (first: Vec2, second: Vec2): number => (
  first.x * second.z - first.z * second.x
);

const rotate = (
  value: Vec2,
  radians: number,
): Vec2 => {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return canonicalVec2({
    x: value.x * cosine - value.z * sine,
    z: value.x * sine + value.z * cosine,
  });
};

const sampleAdverseRecovery = (
  initialVelocityMps: number,
  accelerationMps2: number,
  elapsedSeconds: number,
): ScalarRecoverySample => {
  const speed = Math.abs(initialVelocityMps);
  if (speed <= EPSILON) {
    return {
      displacementMeters: 0,
      velocityMps: 0,
      accelerationMps2: 0, endElapsedSeconds: Infinity,
    };
  }

  const sign = Math.sign(initialVelocityMps);
  const unitSeconds = speed / accelerationMps2;
  const firstPhaseSeconds = (
    1 + 1 / Math.SQRT2
  ) * unitSeconds;
  const secondPhaseSeconds = (
    1 / Math.SQRT2
  ) * unitSeconds;
  const totalSeconds = firstPhaseSeconds + secondPhaseSeconds;

  if (elapsedSeconds >= totalSeconds - EPSILON) {
    return {
      displacementMeters: 0,
      velocityMps: 0,
      accelerationMps2: 0, endElapsedSeconds: Infinity,
    };
  }

  const firstAcceleration = -sign * accelerationMps2;
  if (elapsedSeconds < firstPhaseSeconds) {
    return {
      displacementMeters: canonicalZero(
        initialVelocityMps * elapsedSeconds
        + 0.5
          * firstAcceleration
          * elapsedSeconds
          * elapsedSeconds,
      ),
      velocityMps: canonicalZero(
        initialVelocityMps
        + firstAcceleration * elapsedSeconds,
      ),
      accelerationMps2: firstAcceleration, endElapsedSeconds: firstPhaseSeconds,
    };
  }

  const firstDisplacement = (
    initialVelocityMps * firstPhaseSeconds
    + 0.5
      * firstAcceleration
      * firstPhaseSeconds
      * firstPhaseSeconds
  );
  const firstVelocity = (
    initialVelocityMps
    + firstAcceleration * firstPhaseSeconds
  );
  const secondElapsed = elapsedSeconds - firstPhaseSeconds;
  const secondAcceleration = sign * accelerationMps2;

  return {
    displacementMeters: canonicalZero(
      firstDisplacement
      + firstVelocity * secondElapsed
      + 0.5
        * secondAcceleration
        * secondElapsed
        * secondElapsed,
    ),
    velocityMps: canonicalZero(
      firstVelocity
      + secondAcceleration * secondElapsed,
    ),
    accelerationMps2: secondAcceleration, endElapsedSeconds: totalSeconds,
  };
};

const signedTurnFromTo = (
  from: Vec2,
  to: Vec2,
): number => {
  const sine = crossScalar(from, to);
  const cosine = Math.max(-1, Math.min(1, dot(from, to)));
  const angle = Math.atan2(sine, cosine);
  return Math.abs(angle) <= TURN_TOLERANCE ? 0 : angle;
};

export const buildBatterSwingExitRecoveryTrajectory = (
  state: SwingExitBodyState,
  route: RunnerRoute,
  parameters: BatterSwingExitRunTransitionParameters,
): BatterSwingExitRecoveryTrajectory => {
  const transition = resolveBatterSwingExitRunTransition(
    state,
    route,
    parameters,
  );
  const firstSegment = route.segments[0];
  if (firstSegment === undefined || firstSegment.kind !== 'line') {
    throw new Error(
      'swing-exit recovery trajectory requires an initial straight route segment',
    );
  }

  const firstSegmentLength = Math.hypot(
    firstSegment.end.x - firstSegment.start.x,
    firstSegment.end.z - firstSegment.start.z,
  );
  if (
    transition.launchRouteDistanceMeters
    - firstSegmentLength
    > EPSILON
  ) {
    throw new Error(
      'swing-exit recovery must finish inside the initial straight route segment',
    );
  }

  const start = sampleRunnerRoute(route, 0);
  const lateralUnit = {
    x: -start.tangent.z,
    z: start.tangent.x,
  };

  return {
    startTick: state.tick,
    endTick: transition.launchTick,
    ticksPerSecond: parameters.ticksPerSecond,
    startPosition: start.position,
    routeTangent: start.tangent,
    lateralUnit,
    initialForwardVelocityMps: dot(
      state.planarVelocity,
      start.tangent,
    ),
    initialLateralVelocityMps: dot(
      state.planarVelocity,
      lateralUnit,
    ),
    signedTurnRadians: signedTurnFromTo(
      state.bodyForwardUnit,
      start.tangent,
    ),
    maximumBodyTurnRateRadiansPerSecond:
      parameters.maximumBodyTurnRateRadiansPerSecond,
    lateralRealignmentAccelerationMps2:
      parameters.lateralRealignmentAccelerationMps2,
    backwardRecoveryAccelerationMps2:
      parameters.backwardRecoveryAccelerationMps2,
    transition,
  };
};

const sampleRecoveryRoot = (trajectory: BatterSwingExitRecoveryTrajectory, elapsedSeconds: number) => {
  const forward = (
    trajectory.initialForwardVelocityMps >= 0
      ? {
          displacementMeters:
            trajectory.initialForwardVelocityMps * elapsedSeconds,
          velocityMps:
            trajectory.initialForwardVelocityMps,
          accelerationMps2: 0, endElapsedSeconds: Infinity,
        }
      : sampleAdverseRecovery(
          trajectory.initialForwardVelocityMps,
          trajectory.backwardRecoveryAccelerationMps2,
          elapsedSeconds,
        )
  );
  const lateral = sampleAdverseRecovery(
    trajectory.initialLateralVelocityMps,
    trajectory.lateralRealignmentAccelerationMps2,
    elapsedSeconds,
  );

  const position = canonicalVec2({
    x: (
      trajectory.startPosition.x
      + trajectory.routeTangent.x
        * forward.displacementMeters
      + trajectory.lateralUnit.x
        * lateral.displacementMeters
    ),
    z: (
      trajectory.startPosition.z
      + trajectory.routeTangent.z
        * forward.displacementMeters
      + trajectory.lateralUnit.z
        * lateral.displacementMeters
    ),
  });
  const velocity = canonicalVec2({
    x: (
      trajectory.routeTangent.x * forward.velocityMps
      + trajectory.lateralUnit.x * lateral.velocityMps
    ),
    z: (
      trajectory.routeTangent.z * forward.velocityMps
      + trajectory.lateralUnit.z * lateral.velocityMps
    ),
  });

  return { position, velocity, forward, lateral };
};

/** Exact coefficients of the existing root law only. Relative part offsets and
 * facing remain separately owned. No rounded tick may cross an adverse knot. */
export const batterSwingExitRecoveryMotionPieceAt = (trajectory: BatterSwingExitRecoveryTrajectory, elapsedSeconds: number) => {
  const launchSeconds = trajectory.transition.recoverySeconds;
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0 || elapsedSeconds >= launchSeconds)
    throw new Error('recovery root piece is exhausted or its elapsed cut is invalid');
  const sampled = sampleRecoveryRoot(trajectory, elapsedSeconds);
  const acceleration = canonicalVec2({
    x: trajectory.routeTangent.x * sampled.forward.accelerationMps2 + trajectory.lateralUnit.x * sampled.lateral.accelerationMps2,
    z: trajectory.routeTangent.z * sampled.forward.accelerationMps2 + trajectory.lateralUnit.z * sampled.lateral.accelerationMps2,
  });
  const endElapsedSeconds = Math.min(launchSeconds, sampled.forward.endElapsedSeconds, sampled.lateral.endElapsedSeconds);
  if (endElapsedSeconds <= elapsedSeconds) throw new Error('recovery root analytic boundary is exhausted');
  return { position: sampled.position, velocity: sampled.velocity, acceleration, endElapsedSeconds };
};

export const sampleBatterSwingExitRecoveryTrajectory = (
  trajectory: BatterSwingExitRecoveryTrajectory,
  tick: number,
): BatterSwingExitRecoverySample => {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new Error(
      'recovery sample tick must be a non-negative safe integer',
    );
  }
  if (tick < trajectory.startTick || tick > trajectory.endTick) {
    throw new Error(
      'recovery sample tick must lie inside the trajectory interval',
    );
  }

  const elapsedSeconds = Math.min(
    trajectory.transition.recoverySeconds,
    (tick - trajectory.startTick) / trajectory.ticksPerSecond,
  );

  const { position, velocity } = sampleRecoveryRoot(trajectory, elapsedSeconds);

  const turnDirection = Math.sign(trajectory.signedTurnRadians);
  const completedTurnRadians = Math.min(
    Math.abs(trajectory.signedTurnRadians),
    trajectory.maximumBodyTurnRateRadiansPerSecond
      * elapsedSeconds,
  );
  const initialFacing = rotate(
    trajectory.routeTangent,
    -trajectory.signedTurnRadians,
  );
  const bodyForwardUnit = rotate(
    initialFacing,
    turnDirection * completedTurnRadians,
  );

  return {
    tick,
    position,
    velocity,
    bodyForwardUnit,
  };
};

export const projectBatterSwingExitRecoveryRunnerWorldState = (
  playerId: string,
  sample: BatterSwingExitRecoverySample,
): BaserunnerWorldState => {
  if (playerId.length === 0) {
    throw new Error('playerId must not be empty');
  }

  return {
    playerId,
    position: sample.position,
    velocity: sample.velocity,
  };
};
