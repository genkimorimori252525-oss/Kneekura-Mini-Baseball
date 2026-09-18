import type { Vec3 } from '../../model/geometry';
import type {
  PlayerPerceivedWorldState,
} from '../perception/PlayerPerceivedWorldState';
import {
  sampleDefenderBodyKinematicsSegment,
  type DefenderBodyKinematicsSegment,
} from './DefenderBodyKinematics';

export type PerceivedGloveTargetParameters = Readonly<{
  minimumBallConfidence: number;
  maximumReachMeters: number;
}>;

export type PerceivedGloveTargetAssessment = Readonly<{
  plannedFromTick: number;
  targetTick: number;
  ticksPerSecond: number;
  predictedBallPosition: Vec3;
  predictedBodyPosition: Vec3;
  desiredOffset: Vec3;
  reachDistanceMeters: number;
  maximumReachMeters: number;
  withinReach: boolean;
  sourceBallConfidence: number;
  sourceObservedAt: number;
}>;

const validateUnit = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be finite and within [0, 1]`);
  }
};

const validateParameters = (
  parameters: PerceivedGloveTargetParameters,
): void => {
  validateUnit('minimumBallConfidence', parameters.minimumBallConfidence);
  if (
    !Number.isFinite(parameters.maximumReachMeters)
    || parameters.maximumReachMeters <= 0
  ) {
    throw new Error('maximumReachMeters must be finite and positive');
  }
};

const validateTick = (name: string, tick: number): void => {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new Error(`${name} must be a non-negative safe integer tick`);
  }
};

const subtract = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});

export const assessPerceivedGloveTarget = <TKnownContext>(
  perceivedWorld: PlayerPerceivedWorldState<TKnownContext>,
  body: DefenderBodyKinematicsSegment,
  targetTick: number,
  parameters: PerceivedGloveTargetParameters,
): PerceivedGloveTargetAssessment | null => {
  validateParameters(parameters);
  validateTick('observationTime', perceivedWorld.observationTime);
  validateTick('targetTick', targetTick);

  if (
    perceivedWorld.observationTime < body.startTick
    || perceivedWorld.observationTime > body.endTick
  ) {
    throw new Error('observationTime must be inside the supplied body kinematics segment');
  }
  if (targetTick < perceivedWorld.observationTime) {
    throw new Error('targetTick must be at or after observationTime');
  }
  if (targetTick < body.startTick || targetTick > body.endTick) {
    throw new Error('targetTick must be inside the supplied body kinematics segment');
  }

  const ball = perceivedWorld.ball;
  if (ball === null) {
    return null;
  }
  validateUnit('perceived ball confidence', ball.confidence);
  if (ball.predictedAt !== perceivedWorld.observationTime) {
    throw new Error('perceived ball must be resolved at observationTime');
  }
  if (ball.confidence < parameters.minimumBallConfidence) {
    return null;
  }

  const elapsedSeconds = (
    targetTick - perceivedWorld.observationTime
  ) / body.ticksPerSecond;
  const predictedBallPosition: Vec3 = {
    x: ball.estimate.position.x + ball.estimate.velocity.x * elapsedSeconds,
    y: ball.estimate.position.y + ball.estimate.velocity.y * elapsedSeconds,
    z: ball.estimate.position.z + ball.estimate.velocity.z * elapsedSeconds,
  };
  const predictedBodyPosition = sampleDefenderBodyKinematicsSegment(
    body,
    targetTick,
  ).position;
  const desiredOffset = subtract(
    predictedBallPosition,
    predictedBodyPosition,
  );
  const reachDistanceMeters = Math.hypot(
    desiredOffset.x,
    desiredOffset.y,
    desiredOffset.z,
  );

  return {
    plannedFromTick: perceivedWorld.observationTime,
    targetTick,
    ticksPerSecond: body.ticksPerSecond,
    predictedBallPosition,
    predictedBodyPosition,
    desiredOffset,
    reachDistanceMeters,
    maximumReachMeters: parameters.maximumReachMeters,
    withinReach: reachDistanceMeters <= parameters.maximumReachMeters,
    sourceBallConfidence: ball.confidence,
    sourceObservedAt: ball.sourceObservedAt,
  };
};
