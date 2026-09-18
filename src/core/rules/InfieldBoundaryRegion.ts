import type { Vec2 } from '../model/geometry';

export type InfieldBoundaryRegion = Readonly<{
  vertices: readonly Vec2[];
}>;

const EPSILON = 1e-9;

const validateVec2 = (
  name: string,
  value: Vec2,
): void => {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.z)) {
    throw new Error(`${name} coordinates must be finite`);
  }
};

const polygonSignedDoubleArea = (
  vertices: readonly Vec2[],
): number => {
  let area = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    area += current.x * next.z - next.x * current.z;
  }
  return area;
};

export const createInfieldBoundaryRegion = (
  vertices: readonly Vec2[],
): InfieldBoundaryRegion => {
  if (vertices.length < 3) {
    throw new Error('infield boundary polygon requires at least three vertices');
  }

  vertices.forEach((vertex, index) => {
    validateVec2(`vertices[${index}]`, vertex);
    const next = vertices[(index + 1) % vertices.length];
    if (
      index < vertices.length - 1
      && Math.hypot(next.x - vertex.x, next.z - vertex.z) <= EPSILON
    ) {
      throw new Error('infield boundary polygon must not contain zero-length edges');
    }
  });

  if (Math.abs(polygonSignedDoubleArea(vertices)) <= EPSILON) {
    throw new Error('infield boundary polygon must have non-zero area');
  }

  return {
    vertices: vertices.map((vertex) => ({
      x: vertex.x,
      z: vertex.z,
    })),
  };
};

const pointToSegmentDistance = (
  point: Vec2,
  start: Vec2,
  end: Vec2,
): number => {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared <= EPSILON * EPSILON) {
    return Math.hypot(point.x - start.x, point.z - start.z);
  }

  const projection = (
    (point.x - start.x) * dx
    + (point.z - start.z) * dz
  ) / lengthSquared;
  const t = Math.max(0, Math.min(1, projection));
  return Math.hypot(
    point.x - (start.x + dx * t),
    point.z - (start.z + dz * t),
  );
};

const minimumBoundaryDistance = (
  region: InfieldBoundaryRegion,
  point: Vec2,
): number => {
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 0; index < region.vertices.length; index += 1) {
    minimum = Math.min(
      minimum,
      pointToSegmentDistance(
        point,
        region.vertices[index],
        region.vertices[(index + 1) % region.vertices.length],
      ),
    );
  }
  return minimum;
};

const isStrictlyInsidePolygon = (
  region: InfieldBoundaryRegion,
  point: Vec2,
): boolean => {
  if (minimumBoundaryDistance(region, point) <= EPSILON) {
    return false;
  }

  let inside = false;
  for (
    let currentIndex = 0, previousIndex = region.vertices.length - 1;
    currentIndex < region.vertices.length;
    previousIndex = currentIndex, currentIndex += 1
  ) {
    const current = region.vertices[currentIndex];
    const previous = region.vertices[previousIndex];
    const crossesRay = (
      (current.z > point.z) !== (previous.z > point.z)
    );
    if (!crossesRay) {
      continue;
    }

    const xAtCrossing = (
      (previous.x - current.x)
      * (point.z - current.z)
      / (previous.z - current.z)
      + current.x
    );
    if (point.x < xAtCrossing) {
      inside = !inside;
    }
  }
  return inside;
};

export const isFootDiscFullyInsideInfieldBoundary = (
  region: InfieldBoundaryRegion,
  center: Vec2,
  footContactRadiusMeters: number,
): boolean => {
  validateVec2('foot center', center);
  if (
    !Number.isFinite(footContactRadiusMeters)
    || footContactRadiusMeters < 0
  ) {
    throw new Error(
      'footContactRadiusMeters must be finite and non-negative',
    );
  }

  if (!isStrictlyInsidePolygon(region, center)) {
    return false;
  }

  return (
    minimumBoundaryDistance(region, center)
    > footContactRadiusMeters + EPSILON
  );
};
