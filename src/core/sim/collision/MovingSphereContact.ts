import type { Vec3 } from '../../model/geometry';
import { quantizeEventTick } from '../ExactEventTime';

export type MovingSphereContactState = Readonly<{
  tick: number;
  center: Vec3;
  velocity: Vec3;
  radius: number;
}>;

export type MovingSphereContactParameters = Readonly<{
  ticksPerSecond: number;
}>;

const EPSILON = 1e-12;

const subtract = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});

const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

const validateState = (state: MovingSphereContactState, name: string): void => {
  if (!Number.isSafeInteger(state.tick) || state.tick < 0) {
    throw new Error(`${name}.tick must be a non-negative safe integer tick`);
  }
  if (!Number.isFinite(state.radius) || state.radius <= 0) {
    throw new Error(`${name}.radius must be a finite positive number`);
  }
};

export const findMovingSphereContactTick = (
  first: MovingSphereContactState,
  second: MovingSphereContactState,
  deltaTicks: number,
  parameters: MovingSphereContactParameters,
): number | null => {
  validateState(first, 'first');
  validateState(second, 'second');
  if (!Number.isInteger(parameters.ticksPerSecond) || parameters.ticksPerSecond <= 0) {
    throw new Error('ticksPerSecond must be a positive integer');
  }
  if (first.tick !== second.tick) {
    throw new Error('moving contact states must use the same start tick');
  }
  if (!Number.isInteger(deltaTicks) || deltaTicks < 0) {
    throw new Error('deltaTicks must be a non-negative integer');
  }
  if (!Number.isSafeInteger(first.tick + deltaTicks)) {
    throw new Error('contact search end tick must be a safe integer');
  }

  const relativePosition = subtract(first.center, second.center);
  const relativeVelocity = subtract(first.velocity, second.velocity);
  const contactRadius = first.radius + second.radius;
  const c = dot(relativePosition, relativePosition) - contactRadius * contactRadius;

  if (c <= 0) {
    return first.tick;
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

  const contactTick = quantizeEventTick(
    first.tick,
    Math.max(0, entrySeconds),
    parameters.ticksPerSecond,
  );

  return contactTick - first.tick <= deltaTicks ? contactTick : null;
};
