import type { Vec3 } from '../../model/geometry';

export type PitchSpinDecomposition = Readonly<{
  velocityDirection: Vec3;
  activeSpin: Vec3;
  gyroSpin: Vec3;
  totalSpinRadPerSecond: number;
  activeSpinRadPerSecond: number;
  gyroSpinRadPerSecond: number;
  activeSpinFraction: number;
  gyroSpinFraction: number;
  magnusDirection: Vec3 | null;
}>;

const EPSILON = 1e-12;

const scale = (value: Vec3, scalar: number): Vec3 => ({
  x: value.x * scalar,
  y: value.y * scalar,
  z: value.z * scalar,
});

const subtract = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});

const dot = (a: Vec3, b: Vec3): number =>
  a.x * b.x + a.y * b.y + a.z * b.z;

const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

const magnitude = (value: Vec3): number =>
  Math.hypot(value.x, value.y, value.z);

const normalize = (value: Vec3): Vec3 => {
  const length = magnitude(value);
  if (length <= EPSILON) {
    throw new Error('cannot normalize a zero-length vector');
  }
  return scale(value, 1 / length);
};

/**
 * Decompose a pitch's 3D angular velocity into:
 *
 * - active/true spin: perpendicular to the instantaneous flight direction;
 * - gyro spin: parallel to the instantaneous flight direction.
 *
 * Only active spin contributes to ordinary Magnus acceleration. The ball's
 * physical spin vector itself is not rotated by this function.
 */
export const decomposePitchSpin = (
  velocityMps: Vec3,
  spinRadPerSecond: Vec3,
): PitchSpinDecomposition => {
  const speed = magnitude(velocityMps);
  if (speed <= EPSILON) {
    throw new Error(
      'pitch velocity must be non-zero for spin decomposition',
    );
  }

  const velocityDirection = scale(
    velocityMps,
    1 / speed,
  );
  const signedGyroRate = dot(
    spinRadPerSecond,
    velocityDirection,
  );
  const gyroSpin = scale(
    velocityDirection,
    signedGyroRate,
  );
  const activeSpin = subtract(
    spinRadPerSecond,
    gyroSpin,
  );

  const totalSpinRadPerSecond = magnitude(
    spinRadPerSecond,
  );
  const activeSpinRadPerSecond = magnitude(
    activeSpin,
  );
  const gyroSpinRadPerSecond = Math.abs(
    signedGyroRate,
  );

  const activeSpinFraction =
    totalSpinRadPerSecond <= EPSILON
      ? 0
      : activeSpinRadPerSecond
        / totalSpinRadPerSecond;
  const gyroSpinFraction =
    totalSpinRadPerSecond <= EPSILON
      ? 0
      : gyroSpinRadPerSecond
        / totalSpinRadPerSecond;

  const magnusRaw = cross(
    activeSpin,
    velocityDirection,
  );
  const magnusDirection =
    magnitude(magnusRaw) <= EPSILON
      ? null
      : normalize(magnusRaw);

  return {
    velocityDirection,
    activeSpin,
    gyroSpin,
    totalSpinRadPerSecond,
    activeSpinRadPerSecond,
    gyroSpinRadPerSecond,
    activeSpinFraction,
    gyroSpinFraction,
    magnusDirection,
  };
};
