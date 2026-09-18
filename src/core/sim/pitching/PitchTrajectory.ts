import type { Vec3 } from '../../model/geometry';
import {
  quantizeEventTick,
} from '../ExactEventTime';
import type {
  PitchWorldState,
} from '../contact/BatBallContact';

export type PitchTrajectorySegment = Readonly<{
  start: PitchWorldState;
  acceleration: Vec3;
  endTick: number;
  ticksPerSecond: number;
}>;

export type PitchPlateCrossing = Readonly<{
  tick: number;
  elapsedSeconds: number;
  position: Vec3;
  velocity: Vec3;
  spin: Vec3;
}>;

const EPSILON = 1e-12;

const validateVec3 = (
  name: string,
  value: Vec3,
): void => {
  if (
    !Number.isFinite(value.x)
    || !Number.isFinite(value.y)
    || !Number.isFinite(value.z)
  ) {
    throw new Error(
      `${name} must contain finite coordinates`,
    );
  }
};

const validateSegment = (
  segment: PitchTrajectorySegment,
): void => {
  if (
    !Number.isSafeInteger(segment.start.tick)
    || segment.start.tick < 0
  ) {
    throw new Error(
      'pitch trajectory start tick must be a non-negative safe integer',
    );
  }
  if (
    !Number.isSafeInteger(segment.endTick)
    || segment.endTick < segment.start.tick
  ) {
    throw new Error(
      'pitch trajectory endTick must be a safe integer at or after start',
    );
  }
  if (
    !Number.isSafeInteger(segment.ticksPerSecond)
    || segment.ticksPerSecond <= 0
  ) {
    throw new Error(
      'pitch trajectory ticksPerSecond must be a positive safe integer',
    );
  }
  validateVec3(
    'pitch trajectory start position',
    segment.start.position,
  );
  validateVec3(
    'pitch trajectory start velocity',
    segment.start.velocity,
  );
  validateVec3(
    'pitch trajectory start spin',
    segment.start.spin,
  );
  validateVec3(
    'pitch trajectory acceleration',
    segment.acceleration,
  );
};

const evaluateCoordinate = (
  position: number,
  velocity: number,
  acceleration: number,
  seconds: number,
): number => (
  position
  + velocity * seconds
  + 0.5 * acceleration * seconds * seconds
);

const evaluateVelocity = (
  velocity: number,
  acceleration: number,
  seconds: number,
): number => (
  velocity + acceleration * seconds
);

const rootsAtCoordinate = (
  position: number,
  velocity: number,
  acceleration: number,
  target: number,
): readonly number[] => {
  const a = 0.5 * acceleration;
  const b = velocity;
  const c = position - target;

  if (Math.abs(a) <= EPSILON) {
    if (Math.abs(b) <= EPSILON) {
      return Math.abs(c) <= EPSILON ? [0] : [];
    }
    return [-c / b];
  }

  const discriminant = b * b - 4 * a * c;
  if (discriminant < -EPSILON) {
    return [];
  }

  const root = Math.sqrt(Math.max(0, discriminant));
  const denominator = 2 * a;
  return [
    (-b - root) / denominator,
    (-b + root) / denominator,
  ];
};

const sampleContinuous = (
  segment: PitchTrajectorySegment,
  elapsedSeconds: number,
): Readonly<{
  position: Vec3;
  velocity: Vec3;
}> => ({
  position: {
    x: evaluateCoordinate(
      segment.start.position.x,
      segment.start.velocity.x,
      segment.acceleration.x,
      elapsedSeconds,
    ),
    y: evaluateCoordinate(
      segment.start.position.y,
      segment.start.velocity.y,
      segment.acceleration.y,
      elapsedSeconds,
    ),
    z: evaluateCoordinate(
      segment.start.position.z,
      segment.start.velocity.z,
      segment.acceleration.z,
      elapsedSeconds,
    ),
  },
  velocity: {
    x: evaluateVelocity(
      segment.start.velocity.x,
      segment.acceleration.x,
      elapsedSeconds,
    ),
    y: evaluateVelocity(
      segment.start.velocity.y,
      segment.acceleration.y,
      elapsedSeconds,
    ),
    z: evaluateVelocity(
      segment.start.velocity.z,
      segment.acceleration.z,
      elapsedSeconds,
    ),
  },
});

export const samplePitchTrajectorySegment = (
  segment: PitchTrajectorySegment,
  tick: number,
): PitchWorldState => {
  validateSegment(segment);
  if (
    !Number.isSafeInteger(tick)
    || tick < segment.start.tick
    || tick > segment.endTick
  ) {
    throw new Error(
      'pitch sample tick must lie inside the trajectory segment',
    );
  }

  const elapsedSeconds = (
    tick - segment.start.tick
  ) / segment.ticksPerSecond;
  const sampled = sampleContinuous(
    segment,
    elapsedSeconds,
  );

  return {
    tick,
    position: sampled.position,
    velocity: sampled.velocity,
    spin: segment.start.spin,
  };
};

export const findPitchPlateCrossing = (
  segment: PitchTrajectorySegment,
  plateZ: number,
): PitchPlateCrossing | null => {
  validateSegment(segment);
  if (!Number.isFinite(plateZ)) {
    throw new Error('plateZ must be finite');
  }

  const durationSeconds = (
    segment.endTick - segment.start.tick
  ) / segment.ticksPerSecond;

  const roots = rootsAtCoordinate(
    segment.start.position.z,
    segment.start.velocity.z,
    segment.acceleration.z,
    plateZ,
  )
    .filter((seconds) => (
      seconds >= -EPSILON
      && seconds <= durationSeconds + EPSILON
    ))
    .map((seconds) => (
      Math.max(0, Math.min(durationSeconds, seconds))
    ))
    .sort((first, second) => first - second);

  if (roots.length === 0) {
    return null;
  }

  const elapsedSeconds = roots[0];
  const sampled = sampleContinuous(
    segment,
    elapsedSeconds,
  );

  return {
    tick: quantizeEventTick(
      segment.start.tick,
      elapsedSeconds,
      segment.ticksPerSecond,
    ),
    elapsedSeconds,
    position: {
      ...sampled.position,
      z: plateZ,
    },
    velocity: sampled.velocity,
    spin: segment.start.spin,
  };
};
