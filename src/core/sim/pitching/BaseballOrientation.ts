import type { Vec3 } from '../../model/geometry';

export type Quaternion = Readonly<{
  w: number;
  x: number;
  y: number;
  z: number;
}>;

export const IDENTITY_QUATERNION: Quaternion = Object.freeze({
  w: 1,
  x: 0,
  y: 0,
  z: 0,
});

const EPSILON = 1e-12;

const magnitude = (value: Vec3): number =>
  Math.hypot(value.x, value.y, value.z);

const scale = (value: Vec3, scalar: number): Vec3 => ({
  x: value.x * scalar,
  y: value.y * scalar,
  z: value.z * scalar,
});

export const normalizeQuaternion = (
  value: Quaternion,
): Quaternion => {
  const length = Math.hypot(
    value.w,
    value.x,
    value.y,
    value.z,
  );
  if (!Number.isFinite(length) || length <= EPSILON) {
    throw new Error(
      'quaternion must have finite non-zero magnitude',
    );
  }
  return {
    w: value.w / length,
    x: value.x / length,
    y: value.y / length,
    z: value.z / length,
  };
};

export const multiplyQuaternions = (
  a: Quaternion,
  b: Quaternion,
): Quaternion => ({
  w:
    a.w * b.w
    - a.x * b.x
    - a.y * b.y
    - a.z * b.z,
  x:
    a.w * b.x
    + a.x * b.w
    + a.y * b.z
    - a.z * b.y,
  y:
    a.w * b.y
    - a.x * b.z
    + a.y * b.w
    + a.z * b.x,
  z:
    a.w * b.z
    + a.x * b.y
    - a.y * b.x
    + a.z * b.w,
});

export const quaternionFromAxisAngle = (
  axis: Vec3,
  angleRadians: number,
): Quaternion => {
  if (!Number.isFinite(angleRadians)) {
    throw new Error('angleRadians must be finite');
  }
  const axisMagnitude = magnitude(axis);
  if (axisMagnitude <= EPSILON) {
    if (Math.abs(angleRadians) <= EPSILON) {
      return IDENTITY_QUATERNION;
    }
    throw new Error(
      'axis must be non-zero for a non-zero rotation',
    );
  }

  const unitAxis = scale(
    axis,
    1 / axisMagnitude,
  );
  const half = angleRadians / 2;
  const sine = Math.sin(half);
  return normalizeQuaternion({
    w: Math.cos(half),
    x: unitAxis.x * sine,
    y: unitAxis.y * sine,
    z: unitAxis.z * sine,
  });
};

export const rotateVectorByQuaternion = (
  value: Vec3,
  orientation: Quaternion,
): Vec3 => {
  const q = normalizeQuaternion(orientation);
  const vectorQ: Quaternion = {
    w: 0,
    x: value.x,
    y: value.y,
    z: value.z,
  };
  const conjugate: Quaternion = {
    w: q.w,
    x: -q.x,
    y: -q.y,
    z: -q.z,
  };
  const rotated = multiplyQuaternions(
    multiplyQuaternions(q, vectorQ),
    conjugate,
  );
  return {
    x: rotated.x,
    y: rotated.y,
    z: rotated.z,
  };
};

/**
 * Advance the material orientation of the baseball under a world-space
 * angular-velocity vector. This tracks seam phase/orientation only; it does
 * not itself add any aerodynamic seam force.
 */
export const advanceBaseballOrientation = (
  orientation: Quaternion,
  angularVelocityWorldRadPerSecond: Vec3,
  elapsedSeconds: number,
): Quaternion => {
  if (
    !Number.isFinite(elapsedSeconds)
    || elapsedSeconds < 0
  ) {
    throw new Error(
      'elapsedSeconds must be finite and non-negative',
    );
  }

  const spinRate = magnitude(
    angularVelocityWorldRadPerSecond,
  );
  if (
    spinRate <= EPSILON
    || elapsedSeconds <= EPSILON
  ) {
    return normalizeQuaternion(orientation);
  }

  const delta = quaternionFromAxisAngle(
    angularVelocityWorldRadPerSecond,
    spinRate * elapsedSeconds,
  );

  // World-space angular velocity pre-multiplies material orientation.
  return normalizeQuaternion(
    multiplyQuaternions(
      delta,
      normalizeQuaternion(orientation),
    ),
  );
};
