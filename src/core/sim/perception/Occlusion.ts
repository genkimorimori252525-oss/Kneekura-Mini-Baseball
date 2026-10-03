import type { Vec3 } from '../../model/geometry';

export type SphericalOccluder = Readonly<{
  center: Vec3;
  radiusMeters: number;
}>;

const validateVec3 = (name: string, value: Vec3): void => {
  if (![value.x, value.y, value.z].every(Number.isFinite)) {
    throw new Error(`${name} must contain only finite coordinates`);
  }
};

export const estimateOcclusionVisibility = (
  observerPosition: Vec3,
  targetPosition: Vec3,
  occluders: readonly SphericalOccluder[],
): 0 | 1 => {
  validateVec3('observerPosition', observerPosition);
  validateVec3('targetPosition', targetPosition);

  const dx = targetPosition.x - observerPosition.x;
  const dy = targetPosition.y - observerPosition.y;
  const dz = targetPosition.z - observerPosition.z;
  const segmentLengthSquared = dx * dx + dy * dy + dz * dz;

  if (segmentLengthSquared === 0) {
    return 1;
  }

  for (const occluder of occluders) {
    validateVec3('occluder.center', occluder.center);
    if (!Number.isFinite(occluder.radiusMeters) || occluder.radiusMeters <= 0) {
      throw new Error('radiusMeters must be finite and positive');
    }

    const ox = occluder.center.x - observerPosition.x;
    const oy = occluder.center.y - observerPosition.y;
    const oz = occluder.center.z - observerPosition.z;

    // A center outside the segment may still have a radius overlapping an endpoint.
    const closestT = Math.max(0, Math.min(1, (
      ox * dx + oy * dy + oz * dz
    ) / segmentLengthSquared));

    const closestX = observerPosition.x + dx * closestT;
    const closestY = observerPosition.y + dy * closestT;
    const closestZ = observerPosition.z + dz * closestT;

    const ex = occluder.center.x - closestX;
    const ey = occluder.center.y - closestY;
    const ez = occluder.center.z - closestZ;
    const distanceSquared = ex * ex + ey * ey + ez * ez;

    if (distanceSquared <= occluder.radiusMeters * occluder.radiusMeters) {
      return 0;
    }
  }

  return 1;
};
