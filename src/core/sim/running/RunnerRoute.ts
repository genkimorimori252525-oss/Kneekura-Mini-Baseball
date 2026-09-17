import type { Vec2 } from '../../model/geometry';

export type RunnerRouteSegment =
  | Readonly<{
      kind: 'line';
      start: Vec2;
      end: Vec2;
    }>
  | Readonly<{
      kind: 'arc';
      center: Vec2;
      radiusMeters: number;
      startAngleRadians: number;
      sweepRadians: number;
    }>;

export type RunnerRoute = Readonly<{
  segments: readonly RunnerRouteSegment[];
}>;

export type RunnerRouteSample = Readonly<{
  position: Vec2;
  tangent: Vec2;
  segmentIndex: number;
  distanceMeters: number;
}>;

const EPSILON = 1e-12;
const CONTINUITY_TOLERANCE_METERS = 1e-9;

const validateVec2 = (name: string, value: Vec2): void => {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.z)) {
    throw new Error(`${name} must be finite`);
  }
};

const distance = (first: Vec2, second: Vec2): number => Math.hypot(
  second.x - first.x,
  second.z - first.z,
);

const arcPoint = (
  center: Vec2,
  radiusMeters: number,
  angleRadians: number,
): Vec2 => ({
  x: center.x + radiusMeters * Math.cos(angleRadians),
  z: center.z + radiusMeters * Math.sin(angleRadians),
});

const segmentStart = (segment: RunnerRouteSegment): Vec2 => {
  if (segment.kind === 'line') {
    return segment.start;
  }
  return arcPoint(
    segment.center,
    segment.radiusMeters,
    segment.startAngleRadians,
  );
};

const segmentEnd = (segment: RunnerRouteSegment): Vec2 => {
  if (segment.kind === 'line') {
    return segment.end;
  }
  return arcPoint(
    segment.center,
    segment.radiusMeters,
    segment.startAngleRadians + segment.sweepRadians,
  );
};

const segmentLength = (segment: RunnerRouteSegment): number => {
  if (segment.kind === 'line') {
    return distance(segment.start, segment.end);
  }
  return segment.radiusMeters * Math.abs(segment.sweepRadians);
};

const validateSegment = (segment: RunnerRouteSegment, index: number): void => {
  if (segment.kind === 'line') {
    validateVec2(`segments[${index}].start`, segment.start);
    validateVec2(`segments[${index}].end`, segment.end);
    if (segmentLength(segment) <= EPSILON) {
      throw new Error('runner route line segments must have positive length');
    }
    return;
  }

  validateVec2(`segments[${index}].center`, segment.center);
  if (!Number.isFinite(segment.radiusMeters) || segment.radiusMeters <= 0) {
    throw new Error('runner route arc radiusMeters must be finite and positive');
  }
  if (!Number.isFinite(segment.startAngleRadians)) {
    throw new Error('runner route arc startAngleRadians must be finite');
  }
  if (!Number.isFinite(segment.sweepRadians) || Math.abs(segment.sweepRadians) <= EPSILON) {
    throw new Error('runner route arc sweepRadians must be finite and non-zero');
  }
};

const validateRoute = (route: RunnerRoute): readonly number[] => {
  if (route.segments.length === 0) {
    throw new Error('runner route must contain at least one segment');
  }

  const lengths: number[] = [];
  for (let index = 0; index < route.segments.length; index += 1) {
    const segment = route.segments[index];
    validateSegment(segment, index);
    lengths.push(segmentLength(segment));

    if (index > 0) {
      const previousEnd = segmentEnd(route.segments[index - 1]);
      const currentStart = segmentStart(segment);
      if (distance(previousEnd, currentStart) > CONTINUITY_TOLERANCE_METERS) {
        throw new Error('runner route segments must be continuous');
      }
    }
  }

  return lengths;
};

export const getRunnerRouteLength = (route: RunnerRoute): number => (
  validateRoute(route).reduce((sum, value) => sum + value, 0)
);

const sampleLine = (
  segment: Extract<RunnerRouteSegment, { kind: 'line' }>,
  localDistanceMeters: number,
  lengthMeters: number,
): Readonly<{ position: Vec2; tangent: Vec2 }> => {
  const dx = segment.end.x - segment.start.x;
  const dz = segment.end.z - segment.start.z;
  const tangent = {
    x: dx / lengthMeters,
    z: dz / lengthMeters,
  };
  const fraction = localDistanceMeters / lengthMeters;
  return {
    position: {
      x: segment.start.x + dx * fraction,
      z: segment.start.z + dz * fraction,
    },
    tangent,
  };
};

const sampleArc = (
  segment: Extract<RunnerRouteSegment, { kind: 'arc' }>,
  localDistanceMeters: number,
): Readonly<{ position: Vec2; tangent: Vec2 }> => {
  const sweepDirection = Math.sign(segment.sweepRadians);
  const angle = segment.startAngleRadians
    + sweepDirection * localDistanceMeters / segment.radiusMeters;
  return {
    position: arcPoint(segment.center, segment.radiusMeters, angle),
    tangent: {
      x: -Math.sin(angle) * sweepDirection,
      z: Math.cos(angle) * sweepDirection,
    },
  };
};

export const sampleRunnerRoute = (
  route: RunnerRoute,
  distanceMeters: number,
): RunnerRouteSample => {
  if (!Number.isFinite(distanceMeters)) {
    throw new Error('distanceMeters must be finite');
  }

  const lengths = validateRoute(route);
  const totalLength = lengths.reduce((sum, value) => sum + value, 0);
  if (distanceMeters < -EPSILON || distanceMeters - totalLength > EPSILON) {
    throw new Error('distanceMeters must lie on the runner route');
  }

  const authoritativeDistance = Math.min(totalLength, Math.max(0, distanceMeters));
  let traversed = 0;

  for (let index = 0; index < route.segments.length; index += 1) {
    const segment = route.segments[index];
    const lengthMeters = lengths[index];
    const segmentEndDistance = traversed + lengthMeters;
    if (authoritativeDistance <= segmentEndDistance + EPSILON || index === route.segments.length - 1) {
      const localDistanceMeters = Math.min(
        lengthMeters,
        Math.max(0, authoritativeDistance - traversed),
      );
      const sampled = segment.kind === 'line'
        ? sampleLine(segment, localDistanceMeters, lengthMeters)
        : sampleArc(segment, localDistanceMeters);
      return {
        position: sampled.position,
        tangent: sampled.tangent,
        segmentIndex: index,
        distanceMeters: authoritativeDistance,
      };
    }
    traversed = segmentEndDistance;
  }

  throw new Error('runner route sampling failed');
};
