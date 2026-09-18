import type { Vec3 } from '../../model/geometry';
import type { DefenderBodyKinematicsSegment } from './DefenderBodyKinematics';

export type DefenderPhysicalPrimitiveRole =
  | 'glove'
  | 'tag_hand'
  | 'body'
  | 'left_foot'
  | 'right_foot';

export type DefenderPosePrimitiveSegment = Readonly<{
  role: DefenderPhysicalPrimitiveRole;
  radius: number;
  startTick: number;
  endTick: number;
  ticksPerSecond: number;
  startOffset: Vec3;
  offsetVelocity: Vec3;
  offsetAcceleration: Vec3;
}>;

export type DefenderPhysicalPrimitiveSegment = Readonly<{
  role: DefenderPhysicalPrimitiveRole;
  radius: number;
  startTick: number;
  endTick: number;
  ticksPerSecond: number;
  startCenter: Vec3;
  startVelocity: Vec3;
  acceleration: Vec3;
}>;

export type DefenderPhysicalPrimitiveSample = Readonly<{
  tick: number;
  center: Vec3;
  velocity: Vec3;
  acceleration: Vec3;
  radius: number;
  role: DefenderPhysicalPrimitiveRole;
}>;

const EPSILON = 1e-12;
const clean = (value: number): number => Math.abs(value) <= EPSILON ? 0 : value;

const add = (a: Vec3, b: Vec3): Vec3 => ({
  x: clean(a.x + b.x),
  y: clean(a.y + b.y),
  z: clean(a.z + b.z),
});

const validateVec3 = (name: string, value: Vec3): void => {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y) || !Number.isFinite(value.z)) {
    throw new Error(`${name} must contain finite coordinates`);
  }
};

const validateTick = (name: string, value: number): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer tick`);
  }
};

const validatePose = (pose: DefenderPosePrimitiveSegment): void => {
  validateTick('pose.startTick', pose.startTick);
  validateTick('pose.endTick', pose.endTick);
  if (pose.endTick < pose.startTick) {
    throw new Error('pose.endTick must be greater than or equal to pose.startTick');
  }
  if (!Number.isSafeInteger(pose.ticksPerSecond) || pose.ticksPerSecond <= 0) {
    throw new Error('pose.ticksPerSecond must be a positive safe integer');
  }
  if (!Number.isFinite(pose.radius) || pose.radius <= 0) {
    throw new Error('pose.radius must be finite and positive');
  }
  validateVec3('pose.startOffset', pose.startOffset);
  validateVec3('pose.offsetVelocity', pose.offsetVelocity);
  validateVec3('pose.offsetAcceleration', pose.offsetAcceleration);
};

export const composeDefenderPhysicalPrimitiveSegment = (
  body: DefenderBodyKinematicsSegment,
  pose: DefenderPosePrimitiveSegment,
): DefenderPhysicalPrimitiveSegment => {
  validatePose(pose);
  if (
    body.startTick !== pose.startTick
    || body.endTick !== pose.endTick
    || body.ticksPerSecond !== pose.ticksPerSecond
  ) {
    throw new Error('body and pose segments must share authoritative timing');
  }
  validateVec3('body.startPosition', body.startPosition);
  validateVec3('body.startVelocity', body.startVelocity);
  validateVec3('body.acceleration', body.acceleration);

  return {
    role: pose.role,
    radius: pose.radius,
    startTick: body.startTick,
    endTick: body.endTick,
    ticksPerSecond: body.ticksPerSecond,
    startCenter: add(body.startPosition, pose.startOffset),
    startVelocity: add(body.startVelocity, pose.offsetVelocity),
    acceleration: add(body.acceleration, pose.offsetAcceleration),
  };
};

export const sampleDefenderPhysicalPrimitiveSegment = (
  segment: DefenderPhysicalPrimitiveSegment,
  tick: number,
): DefenderPhysicalPrimitiveSample => {
  validateTick('tick', tick);
  if (tick < segment.startTick || tick > segment.endTick) {
    throw new Error('tick must be inside the defender physical primitive segment');
  }
  if (!Number.isSafeInteger(segment.ticksPerSecond) || segment.ticksPerSecond <= 0) {
    throw new Error('segment.ticksPerSecond must be a positive safe integer');
  }
  const dt = (tick - segment.startTick) / segment.ticksPerSecond;
  const halfDt2 = 0.5 * dt * dt;
  return {
    tick,
    center: {
      x: clean(segment.startCenter.x + segment.startVelocity.x * dt + segment.acceleration.x * halfDt2),
      y: clean(segment.startCenter.y + segment.startVelocity.y * dt + segment.acceleration.y * halfDt2),
      z: clean(segment.startCenter.z + segment.startVelocity.z * dt + segment.acceleration.z * halfDt2),
    },
    velocity: {
      x: clean(segment.startVelocity.x + segment.acceleration.x * dt),
      y: clean(segment.startVelocity.y + segment.acceleration.y * dt),
      z: clean(segment.startVelocity.z + segment.acceleration.z * dt),
    },
    acceleration: segment.acceleration,
    radius: segment.radius,
    role: segment.role,
  };
};
