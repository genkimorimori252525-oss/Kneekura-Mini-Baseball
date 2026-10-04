import type { Vec3 } from '../../core/model/geometry';
/** Explicit test motor input only; it is never a rule result or completed fact. */
export const firstBaseFixtureFootAcceleration = (position: Vec3, velocity: Vec3, bodyAcceleration: Vec3,
  target: Vec3, afterSeconds: number): Vec3 => {
  if (!Number.isFinite(afterSeconds) || afterSeconds <= 0
    || [position, velocity, bodyAcceleration, target].some(v => ['x', 'y', 'z'].some(axis => !Number.isFinite(v[axis as keyof Vec3])))) {
    throw new Error('invalid explicit first-base fixture calibration');
  }
  const axis = (key: keyof Vec3) => 2 * (target[key] - position[key] - velocity[key] * afterSeconds) / afterSeconds ** 2 - bodyAcceleration[key];
  const value = { x: axis('x'), y: axis('y'), z: axis('z') };
  if (Object.values(value).some(v => !Number.isFinite(v))) throw new Error('unrepresentable first-base fixture calibration');
  return value;
};
