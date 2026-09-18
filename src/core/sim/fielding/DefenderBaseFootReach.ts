import type { Vec2, Vec3 } from '../../model/geometry';
import type { BaseTouchRegion } from '../running/BaseTouch';
import {
  sampleDefenderBodyKinematicsSegment,
  type DefenderBodyKinematicsSegment,
} from './DefenderBodyKinematics';
import {
  composeDefenderPhysicalPrimitiveSegment,
  type DefenderPhysicalPrimitiveSegment,
  type DefenderPosePrimitiveSegment,
} from './DefenderPhysicalPrimitive';

export type DefenderFootReachState = Readonly<{
  tick: number;
  offset: Vec3;
  velocity: Vec3;
}>;

export type DefenderBaseFootReachParameters = Readonly<{
  footRadiusMeters: number;
  maximumLegReachMeters: number;
  maxRelativeReachSpeedMps: number;
  maxRelativeReachAccelerationMps2: number;
}>;

export type DefenderBaseFootReachInput = Readonly<{
  body: DefenderBodyKinematicsSegment;
  footState: DefenderFootReachState;
  role: 'left_foot' | 'right_foot';
  targetTick: number;
  base: BaseTouchRegion;
  baseLocalContactPoint: Vec2;
  baseSurfaceHeightMeters: number;
  parameters: DefenderBaseFootReachParameters;
}>;

const EPSILON = 1e-12;

const magnitude = (value: Vec3): number => Math.hypot(
  value.x,
  value.y,
  value.z,
);

const validateVec2 = (
  name: string,
  value: Vec2,
): void => {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.z)) {
    throw new Error(`${name} must contain finite coordinates`);
  }
};

const validateVec3 = (
  name: string,
  value: Vec3,
): void => {
  if (
    !Number.isFinite(value.x)
    || !Number.isFinite(value.y)
    || !Number.isFinite(value.z)
  ) {
    throw new Error(`${name} must contain finite coordinates`);
  }
};

const validatePositive = (
  name: string,
  value: number,
): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be finite and positive`);
  }
};

const worldBaseContactPoint = (
  base: BaseTouchRegion,
  local: Vec2,
  y: number,
): Vec3 => {
  validateVec2('base.center', base.center);
  validateVec2('base.halfSize', base.halfSize);
  validateVec2('baseLocalContactPoint', local);
  if (
    !Number.isFinite(base.rotationRadians)
    || base.halfSize.x <= 0
    || base.halfSize.z <= 0
  ) {
    throw new Error('base geometry must be finite and positive');
  }
  if (
    Math.abs(local.x) > base.halfSize.x + EPSILON
    || Math.abs(local.z) > base.halfSize.z + EPSILON
  ) {
    throw new Error(
      'baseLocalContactPoint must lie inside the base rectangle',
    );
  }
  if (!Number.isFinite(y)) {
    throw new Error(
      'baseSurfaceHeightMeters must be finite',
    );
  }

  const cosine = Math.cos(base.rotationRadians);
  const sine = Math.sin(base.rotationRadians);
  return {
    x: (
      base.center.x
      + cosine * local.x
      - sine * local.z
    ),
    y,
    z: (
      base.center.z
      + sine * local.x
      + cosine * local.z
    ),
  };
};

export const planDefenderBaseFootReachPrimitive = (
  input: DefenderBaseFootReachInput,
): DefenderPhysicalPrimitiveSegment | null => {
  if (
    input.role !== 'left_foot'
    && input.role !== 'right_foot'
  ) {
    throw new Error(
      'base foot reach requires a left_foot or right_foot role',
    );
  }
  if (
    !Number.isSafeInteger(input.footState.tick)
    || input.footState.tick < 0
    || input.footState.tick !== input.body.startTick
  ) {
    throw new Error(
      'footState.tick must equal the body segment start tick',
    );
  }
  if (
    !Number.isSafeInteger(input.targetTick)
    || input.targetTick <= input.body.startTick
    || input.targetTick > input.body.endTick
  ) {
    throw new Error(
      'targetTick must lie after body start and inside the body segment',
    );
  }
  validateVec3('footState.offset', input.footState.offset);
  validateVec3('footState.velocity', input.footState.velocity);
  validatePositive(
    'footRadiusMeters',
    input.parameters.footRadiusMeters,
  );
  validatePositive(
    'maximumLegReachMeters',
    input.parameters.maximumLegReachMeters,
  );
  validatePositive(
    'maxRelativeReachSpeedMps',
    input.parameters.maxRelativeReachSpeedMps,
  );
  validatePositive(
    'maxRelativeReachAccelerationMps2',
    input.parameters.maxRelativeReachAccelerationMps2,
  );

  if (
    magnitude(input.footState.offset)
    > input.parameters.maximumLegReachMeters + EPSILON
  ) {
    return null;
  }

  const targetWorld = worldBaseContactPoint(
    input.base,
    input.baseLocalContactPoint,
    input.baseSurfaceHeightMeters,
  );
  const bodyAtTarget = sampleDefenderBodyKinematicsSegment(
    input.body,
    input.targetTick,
  );
  const desiredOffset: Vec3 = {
    x: targetWorld.x - bodyAtTarget.position.x,
    y: targetWorld.y - bodyAtTarget.position.y,
    z: targetWorld.z - bodyAtTarget.position.z,
  };
  if (
    magnitude(desiredOffset)
    > input.parameters.maximumLegReachMeters + EPSILON
  ) {
    return null;
  }

  const durationSeconds = (
    input.targetTick - input.body.startTick
  ) / input.body.ticksPerSecond;
  const durationSquared = durationSeconds * durationSeconds;
  const requiredAcceleration: Vec3 = {
    x: 2 * (
      desiredOffset.x
      - input.footState.offset.x
      - input.footState.velocity.x * durationSeconds
    ) / durationSquared,
    y: 2 * (
      desiredOffset.y
      - input.footState.offset.y
      - input.footState.velocity.y * durationSeconds
    ) / durationSquared,
    z: 2 * (
      desiredOffset.z
      - input.footState.offset.z
      - input.footState.velocity.z * durationSeconds
    ) / durationSquared,
  };
  if (
    magnitude(requiredAcceleration)
    > input.parameters.maxRelativeReachAccelerationMps2 + EPSILON
  ) {
    return null;
  }

  const terminalVelocity: Vec3 = {
    x: (
      input.footState.velocity.x
      + requiredAcceleration.x * durationSeconds
    ),
    y: (
      input.footState.velocity.y
      + requiredAcceleration.y * durationSeconds
    ),
    z: (
      input.footState.velocity.z
      + requiredAcceleration.z * durationSeconds
    ),
  };
  if (
    magnitude(terminalVelocity)
    > input.parameters.maxRelativeReachSpeedMps + EPSILON
  ) {
    return null;
  }

  const pose: DefenderPosePrimitiveSegment = {
    role: input.role,
    radius: input.parameters.footRadiusMeters,
    startTick: input.body.startTick,
    endTick: input.targetTick,
    ticksPerSecond: input.body.ticksPerSecond,
    startOffset: input.footState.offset,
    offsetVelocity: input.footState.velocity,
    offsetAcceleration: requiredAcceleration,
  };
  const bodyThroughTarget: DefenderBodyKinematicsSegment = {
    ...input.body,
    endTick: input.targetTick,
  };

  return composeDefenderPhysicalPrimitiveSegment(
    bodyThroughTarget,
    pose,
  );
};
