import type { Vec3 } from '../../model/geometry';
import type { DefenderMotionSegment } from './DefenderMotion';

export type DefenderBodyKinematicsSegment = Readonly<{
  startTick: number;
  endTick: number;
  ticksPerSecond: number;
  startPosition: Vec3;
  startVelocity: Vec3;
  acceleration: Vec3;
}>;

export type DefenderBodyKinematicsSample = Readonly<{
  tick: number;
  position: Vec3;
  velocity: Vec3;
  acceleration: Vec3;
}>;

const EPSILON = 1e-12;

const clean = (value: number): number => (
  Math.abs(value) <= EPSILON ? 0 : value
);

const cleanVec3 = (value: Vec3): Vec3 => ({
  x: clean(value.x),
  y: clean(value.y),
  z: clean(value.z),
});

const validateTick = (name: string, value: number): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer tick`);
  }
};

const validateVec3 = (name: string, value: Vec3): void => {
  if (
    !Number.isFinite(value.x)
    || !Number.isFinite(value.y)
    || !Number.isFinite(value.z)
  ) {
    throw new Error(`${name} must contain finite coordinates`);
  }
};

const validateSegment = (
  segment: DefenderBodyKinematicsSegment,
): void => {
  validateTick('segment.startTick', segment.startTick);
  validateTick('segment.endTick', segment.endTick);
  if (segment.endTick < segment.startTick) {
    throw new Error('segment.endTick must be greater than or equal to segment.startTick');
  }
  if (
    !Number.isSafeInteger(segment.ticksPerSecond)
    || segment.ticksPerSecond <= 0
  ) {
    throw new Error('segment.ticksPerSecond must be a positive safe integer');
  }
  validateVec3('segment.startPosition', segment.startPosition);
  validateVec3('segment.startVelocity', segment.startVelocity);
  validateVec3('segment.acceleration', segment.acceleration);
};

export const projectDefenderBodyKinematicsSegment = (
  segment: DefenderMotionSegment,
  bodyOriginHeightMeters: number,
): DefenderBodyKinematicsSegment => {
  if (
    !Number.isFinite(bodyOriginHeightMeters)
    || bodyOriginHeightMeters < 0
  ) {
    throw new Error('bodyOriginHeightMeters must be finite and non-negative');
  }

  const projected: DefenderBodyKinematicsSegment = {
    startTick: segment.startTick,
    endTick: segment.endTick,
    ticksPerSecond: segment.ticksPerSecond,
    startPosition: {
      x: clean(segment.startPosition.x),
      y: clean(bodyOriginHeightMeters),
      z: clean(segment.startPosition.z),
    },
    startVelocity: {
      x: clean(segment.startVelocity.x),
      y: 0,
      z: clean(segment.startVelocity.z),
    },
    acceleration: {
      x: clean(segment.acceleration.x),
      y: 0,
      z: clean(segment.acceleration.z),
    },
  };

  validateSegment(projected);
  return projected;
};

export const sampleDefenderBodyKinematicsSegment = (
  segment: DefenderBodyKinematicsSegment,
  tick: number,
): DefenderBodyKinematicsSample => {
  validateSegment(segment);
  validateTick('tick', tick);
  if (tick < segment.startTick || tick > segment.endTick) {
    throw new Error('tick must be inside the defender body kinematics segment');
  }

  const elapsedSeconds = (
    tick - segment.startTick
  ) / segment.ticksPerSecond;
  const halfTimeSquared = 0.5 * elapsedSeconds * elapsedSeconds;

  return {
    tick,
    position: cleanVec3({
      x: segment.startPosition.x
        + segment.startVelocity.x * elapsedSeconds
        + segment.acceleration.x * halfTimeSquared,
      y: segment.startPosition.y
        + segment.startVelocity.y * elapsedSeconds
        + segment.acceleration.y * halfTimeSquared,
      z: segment.startPosition.z
        + segment.startVelocity.z * elapsedSeconds
        + segment.acceleration.z * halfTimeSquared,
    }),
    velocity: cleanVec3({
      x: segment.startVelocity.x + segment.acceleration.x * elapsedSeconds,
      y: segment.startVelocity.y + segment.acceleration.y * elapsedSeconds,
      z: segment.startVelocity.z + segment.acceleration.z * elapsedSeconds,
    }),
    acceleration: cleanVec3(segment.acceleration),
  };
};
