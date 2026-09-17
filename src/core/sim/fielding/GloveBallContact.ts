import type { Vec3 } from '../../model/geometry';

export type LiveBallState = Readonly<{
  tick: number;
  position: Vec3;
  velocity: Vec3;
  spin: Vec3;
}>;

export type GloveWorldState = Readonly<{
  tick: number;
  position: Vec3;
  velocity: Vec3;
}>;

export type GloveBallContactParameters = Readonly<{
  ticksPerSecond: number;
  ballRadius: number;
  gloveContactRadius: number;
}>;

const EPSILON = 1e-12;
const INTEGER_TICK_TOLERANCE = 1e-9;

const subtract = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});

const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

const validateParameters = (parameters: GloveBallContactParameters): void => {
  if (!Number.isInteger(parameters.ticksPerSecond) || parameters.ticksPerSecond <= 0) {
    throw new Error('ticksPerSecond must be a positive integer');
  }
  if (parameters.ballRadius <= 0 || parameters.gloveContactRadius <= 0) {
    throw new Error('ballRadius and gloveContactRadius must be positive');
  }
};

const quantizeEntryTick = (seconds: number, ticksPerSecond: number): number => {
  const rawTicks = seconds * ticksPerSecond;
  const nearestInteger = Math.round(rawTicks);
  if (Math.abs(rawTicks - nearestInteger) <= INTEGER_TICK_TOLERANCE) {
    return nearestInteger;
  }
  return Math.ceil(rawTicks);
};

export const findGloveBallContactTick = (
  ball: LiveBallState,
  glove: GloveWorldState,
  deltaTicks: number,
  parameters: GloveBallContactParameters,
): number | null => {
  validateParameters(parameters);
  if (!Number.isSafeInteger(ball.tick) || ball.tick < 0) {
    throw new Error('ball.tick must be a non-negative safe integer tick');
  }
  if (!Number.isSafeInteger(glove.tick) || glove.tick < 0) {
    throw new Error('glove.tick must be a non-negative safe integer tick');
  }
  if (ball.tick !== glove.tick) {
    throw new Error('ball and glove must use the same start tick');
  }
  if (!Number.isInteger(deltaTicks) || deltaTicks < 0) {
    throw new Error('deltaTicks must be a non-negative integer');
  }
  if (!Number.isSafeInteger(ball.tick + deltaTicks)) {
    throw new Error('contact search end tick must be a safe integer');
  }

  const relativePosition = subtract(ball.position, glove.position);
  const relativeVelocity = subtract(ball.velocity, glove.velocity);
  const contactRadius = parameters.ballRadius + parameters.gloveContactRadius;
  const radiusSquared = contactRadius * contactRadius;
  const c = dot(relativePosition, relativePosition) - radiusSquared;

  if (c <= 0) {
    return ball.tick;
  }
  if (deltaTicks === 0) {
    return null;
  }

  const a = dot(relativeVelocity, relativeVelocity);
  if (a <= EPSILON) {
    return null;
  }

  const b = 2 * dot(relativePosition, relativeVelocity);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return null;
  }

  const sqrtDiscriminant = Math.sqrt(discriminant);
  const entrySeconds = (-b - sqrtDiscriminant) / (2 * a);
  const exitSeconds = (-b + sqrtDiscriminant) / (2 * a);
  const durationSeconds = deltaTicks / parameters.ticksPerSecond;

  if (exitSeconds < 0 || entrySeconds > durationSeconds) {
    return null;
  }

  const contactSeconds = Math.max(0, entrySeconds);
  const offsetTicks = quantizeEntryTick(contactSeconds, parameters.ticksPerSecond);
  if (offsetTicks > deltaTicks) {
    return null;
  }

  return ball.tick + offsetTicks;
};
