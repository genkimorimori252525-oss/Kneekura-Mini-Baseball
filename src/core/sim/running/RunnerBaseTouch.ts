import type { Vec2 } from '../../model/geometry';
import { quantizeEventTick } from '../ExactEventTime';
import type { BaseTouchRegion } from './BaseTouch';
import type { RunnerBodyContactParameters } from './RunnerBodyContact';
import {
  buildRunnerMotionTrajectory,
  type RunnerMotionIntent,
  type RunnerMotionParameters,
  type RunnerMotionState,
  type RunnerMotionTrajectory,
  type RunnerMotionTrajectorySegment,
} from './RunnerMotion';
import {
  getRunnerRouteLength,
  sampleRunnerRoute,
  type RunnerRoute,
  type RunnerRouteSegment,
} from './RunnerRoute';

const EPSILON = 1e-10;
const TWO_PI = Math.PI * 2;

type BaseFrame = Readonly<{
  cosine: number;
  sine: number;
}>;

const validateVec2 = (name: string, value: Vec2): void => {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.z)) {
    throw new Error(`${name} must be finite`);
  }
};

const validateBase = (base: BaseTouchRegion): void => {
  validateVec2('base.center', base.center);
  validateVec2('base.halfSize', base.halfSize);
  if (base.halfSize.x <= 0 || base.halfSize.z <= 0) {
    throw new Error('base halfSize must be positive');
  }
  if (!Number.isFinite(base.rotationRadians)) {
    throw new Error('base rotationRadians must be finite');
  }
};

const validateBodyParameters = (parameters: RunnerBodyContactParameters): void => {
  for (const [name, value] of [
    ['uprightLeadMeters', parameters.uprightLeadMeters],
    ['slideLeadMeters', parameters.slideLeadMeters],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`${name} must be finite and non-negative`);
    }
  }
};

const baseFrame = (base: BaseTouchRegion): BaseFrame => ({
  cosine: Math.cos(base.rotationRadians),
  sine: Math.sin(base.rotationRadians),
});

const toBaseLocal = (
  point: Vec2,
  base: BaseTouchRegion,
  frame: BaseFrame,
): Vec2 => {
  const dx = point.x - base.center.x;
  const dz = point.z - base.center.z;
  return {
    x: frame.cosine * dx + frame.sine * dz,
    z: -frame.sine * dx + frame.cosine * dz,
  };
};

const fromBaseLocal = (
  point: Vec2,
  base: BaseTouchRegion,
  frame: BaseFrame,
): Vec2 => ({
  x: base.center.x + frame.cosine * point.x - frame.sine * point.z,
  z: base.center.z + frame.sine * point.x + frame.cosine * point.z,
});

const isInsideBase = (
  point: Vec2,
  base: BaseTouchRegion,
  frame: BaseFrame,
): boolean => {
  const local = toBaseLocal(point, base, frame);
  return (
    Math.abs(local.x) <= base.halfSize.x + EPSILON
    && Math.abs(local.z) <= base.halfSize.z + EPSILON
  );
};

const segmentLength = (segment: RunnerRouteSegment): number => (
  segment.kind === 'line'
    ? Math.hypot(segment.end.x - segment.start.x, segment.end.z - segment.start.z)
    : segment.radiusMeters * Math.abs(segment.sweepRadians)
);

const lineBoundaryDistances = (
  segment: Extract<RunnerRouteSegment, { kind: 'line' }>,
  routeStartDistance: number,
  base: BaseTouchRegion,
  frame: BaseFrame,
): readonly number[] => {
  const start = toBaseLocal(segment.start, base, frame);
  const end = toBaseLocal(segment.end, base, frame);
  const delta = { x: end.x - start.x, z: end.z - start.z };
  let enter = 0;
  let exit = 1;

  const clipAxis = (origin: number, velocity: number, halfSize: number): boolean => {
    if (Math.abs(velocity) <= EPSILON) {
      return Math.abs(origin) <= halfSize + EPSILON;
    }
    let first = (-halfSize - origin) / velocity;
    let second = (halfSize - origin) / velocity;
    if (first > second) {
      [first, second] = [second, first];
    }
    enter = Math.max(enter, first);
    exit = Math.min(exit, second);
    return enter <= exit + EPSILON;
  };

  if (!clipAxis(start.x, delta.x, base.halfSize.x)) return [];
  if (!clipAxis(start.z, delta.z, base.halfSize.z)) return [];
  if (exit < -EPSILON || enter > 1 + EPSILON) return [];

  const length = segmentLength(segment);
  const result: number[] = [];
  const clampedEnter = Math.max(0, Math.min(1, enter));
  const clampedExit = Math.max(0, Math.min(1, exit));
  result.push(routeStartDistance + clampedEnter * length);
  if (Math.abs(clampedExit - clampedEnter) > EPSILON) {
    result.push(routeStartDistance + clampedExit * length);
  }
  return result;
};

const normalizePositiveAngle = (radians: number): number => {
  const normalized = radians % TWO_PI;
  return normalized < 0 ? normalized + TWO_PI : normalized;
};

const arcProgressRadians = (
  segment: Extract<RunnerRouteSegment, { kind: 'arc' }>,
  point: Vec2,
): readonly number[] => {
  const angle = Math.atan2(point.z - segment.center.z, point.x - segment.center.x);
  const sweepMagnitude = Math.abs(segment.sweepRadians);
  const initialProgress = segment.sweepRadians > 0
    ? normalizePositiveAngle(angle - segment.startAngleRadians)
    : normalizePositiveAngle(segment.startAngleRadians - angle);

  const progresses: number[] = [];
  if (initialProgress <= sweepMagnitude + EPSILON) {
    progresses.push(Math.max(0, initialProgress));
  }
  for (
    let progress = initialProgress + TWO_PI;
    progress <= sweepMagnitude + EPSILON;
    progress += TWO_PI
  ) {
    progresses.push(progress);
  }
  return progresses;
};

const arcBoundaryDistances = (
  segment: Extract<RunnerRouteSegment, { kind: 'arc' }>,
  routeStartDistance: number,
  base: BaseTouchRegion,
  frame: BaseFrame,
): readonly number[] => {
  const center = toBaseLocal(segment.center, base, frame);
  const radius = segment.radiusMeters;
  const localPoints: Vec2[] = [];

  for (const x of [-base.halfSize.x, base.halfSize.x]) {
    const dx = x - center.x;
    const squared = radius * radius - dx * dx;
    if (squared < -EPSILON) continue;
    const zOffset = Math.sqrt(Math.max(0, squared));
    for (const z of [center.z - zOffset, center.z + zOffset]) {
      if (Math.abs(z) <= base.halfSize.z + EPSILON) {
        localPoints.push({ x, z });
      }
    }
  }

  for (const z of [-base.halfSize.z, base.halfSize.z]) {
    const dz = z - center.z;
    const squared = radius * radius - dz * dz;
    if (squared < -EPSILON) continue;
    const xOffset = Math.sqrt(Math.max(0, squared));
    for (const x of [center.x - xOffset, center.x + xOffset]) {
      if (Math.abs(x) <= base.halfSize.x + EPSILON) {
        localPoints.push({ x, z });
      }
    }
  }

  const distances: number[] = [];
  for (const localPoint of localPoints) {
    const worldPoint = fromBaseLocal(localPoint, base, frame);
    for (const progress of arcProgressRadians(segment, worldPoint)) {
      distances.push(routeStartDistance + radius * progress);
    }
  }
  return distances;
};

const uniqueSorted = (values: readonly number[]): readonly number[] => {
  const sorted = [...values].sort((first, second) => first - second);
  const unique: number[] = [];
  for (const value of sorted) {
    if (unique.length === 0 || Math.abs(value - unique[unique.length - 1]) > EPSILON) {
      unique.push(value);
    }
  }
  return unique;
};

const collectBaseBoundaryRouteDistances = (
  route: RunnerRoute,
  base: BaseTouchRegion,
  frame: BaseFrame,
): readonly number[] => {
  getRunnerRouteLength(route);
  let routeStartDistance = 0;
  const distances: number[] = [];
  for (const segment of route.segments) {
    distances.push(...(
      segment.kind === 'line'
        ? lineBoundaryDistances(segment, routeStartDistance, base, frame)
        : arcBoundaryDistances(segment, routeStartDistance, base, frame)
    ));
    routeStartDistance += segmentLength(segment);
  }
  return uniqueSorted(distances);
};

const evaluateSegmentDistance = (
  segment: RunnerMotionTrajectorySegment,
  localSeconds: number,
): number => (
  segment.startRouteDistanceMeters
  + segment.startSpeedMps * localSeconds
  + 0.5 * segment.accelerationMps2 * localSeconds * localSeconds
);

const segmentTravelDirection = (segment: RunnerMotionTrajectorySegment): -1 | 0 | 1 => {
  if (Math.abs(segment.startSpeedMps) > EPSILON) {
    return Math.sign(segment.startSpeedMps) as -1 | 1;
  }
  if (Math.abs(segment.accelerationMps2) > EPSILON) {
    return Math.sign(segment.accelerationMps2) as -1 | 1;
  }
  return 0;
};

const solveSegmentSecondsForDistance = (
  segment: RunnerMotionTrajectorySegment,
  targetRouteDistanceMeters: number,
): number | null => {
  const durationSeconds = segment.endElapsedSeconds - segment.startElapsedSeconds;
  const displacement = targetRouteDistanceMeters - segment.startRouteDistanceMeters;
  const velocity = segment.startSpeedMps;
  const acceleration = segment.accelerationMps2;

  if (Math.abs(acceleration) <= EPSILON) {
    if (Math.abs(velocity) <= EPSILON) {
      return Math.abs(displacement) <= EPSILON ? 0 : null;
    }
    const seconds = displacement / velocity;
    return seconds >= -EPSILON && seconds <= durationSeconds + EPSILON
      ? Math.max(0, Math.min(durationSeconds, seconds))
      : null;
  }

  const discriminant = velocity * velocity + 2 * acceleration * displacement;
  if (discriminant < -EPSILON) {
    return null;
  }
  const root = Math.sqrt(Math.max(0, discriminant));
  const candidates = [
    (-velocity - root) / acceleration,
    (-velocity + root) / acceleration,
  ]
    .filter((seconds) => seconds >= -EPSILON && seconds <= durationSeconds + EPSILON)
    .map((seconds) => Math.max(0, Math.min(durationSeconds, seconds)))
    .sort((first, second) => first - second);
  return candidates[0] ?? null;
};

const leadMetersForSegment = (
  segment: RunnerMotionTrajectorySegment,
  parameters: RunnerBodyContactParameters,
): number => (
  segment.bodyMode === 'sliding'
    ? parameters.slideLeadMeters
    : parameters.uprightLeadMeters
);

const firstBoundaryInTravel = (
  boundaries: readonly number[],
  startDistance: number,
  endDistance: number,
  direction: -1 | 1,
): number | null => {
  if (direction > 0) {
    for (const boundary of boundaries) {
      if (boundary >= startDistance - EPSILON && boundary <= endDistance + EPSILON) {
        return boundary;
      }
    }
    return null;
  }

  for (let index = boundaries.length - 1; index >= 0; index -= 1) {
    const boundary = boundaries[index];
    if (boundary <= startDistance + EPSILON && boundary >= endDistance - EPSILON) {
      return boundary;
    }
  }
  return null;
};

export const findRunnerBaseTouchTickOnTrajectory = (
  trajectory: RunnerMotionTrajectory,
  route: RunnerRoute,
  base: BaseTouchRegion,
  bodyParameters: RunnerBodyContactParameters,
): number | null => {
  validateBase(base);
  validateBodyParameters(bodyParameters);
  const frame = baseFrame(base);
  const boundaries = collectBaseBoundaryRouteDistances(
    route,
    base,
    frame,
  );

  const initialRouteDistance = (
    trajectory.segments[0]?.startRouteDistanceMeters
    ?? trajectory.endState.routeDistanceMeters
  );
  const initialPoint = sampleRunnerRoute(
    route,
    initialRouteDistance,
  ).position;
  if (isInsideBase(initialPoint, base, frame)) {
    return trajectory.startTick;
  }

  for (const segment of trajectory.segments) {
    const direction = segmentTravelDirection(segment);
    if (direction === 0) {
      const stationaryPoint = sampleRunnerRoute(
        route,
        segment.startRouteDistanceMeters,
      ).position;
      if (isInsideBase(stationaryPoint, base, frame)) {
        return quantizeEventTick(
          trajectory.startTick,
          segment.startElapsedSeconds,
          trajectory.ticksPerSecond,
        );
      }
      continue;
    }

    const leadMeters = leadMetersForSegment(
      segment,
      bodyParameters,
    );
    const segmentDurationSeconds = (
      segment.endElapsedSeconds
      - segment.startElapsedSeconds
    );
    const centerStartDistance =
      segment.startRouteDistanceMeters;
    const centerEndDistance = evaluateSegmentDistance(
      segment,
      segmentDurationSeconds,
    );
    const touchStartDistance = (
      centerStartDistance + direction * leadMeters
    );
    const touchEndDistance = (
      centerEndDistance + direction * leadMeters
    );

    const touchStartPoint = sampleRunnerRoute(
      route,
      touchStartDistance,
    ).position;
    if (isInsideBase(touchStartPoint, base, frame)) {
      return quantizeEventTick(
        trajectory.startTick,
        segment.startElapsedSeconds,
        trajectory.ticksPerSecond,
      );
    }

    const boundary = firstBoundaryInTravel(
      boundaries,
      touchStartDistance,
      touchEndDistance,
      direction,
    );
    if (boundary === null) {
      continue;
    }

    const targetCenterDistance = (
      boundary - direction * leadMeters
    );
    const localSeconds = solveSegmentSecondsForDistance(
      segment,
      targetCenterDistance,
    );
    if (localSeconds === null) {
      continue;
    }
    return quantizeEventTick(
      trajectory.startTick,
      segment.startElapsedSeconds + localSeconds,
      trajectory.ticksPerSecond,
    );
  }

  return null;
};

export const findRunnerBaseTouchTick = (
  start: RunnerMotionState,
  intent: RunnerMotionIntent,
  route: RunnerRoute,
  base: BaseTouchRegion,
  deltaTicks: number,
  motionParameters: RunnerMotionParameters,
  bodyParameters: RunnerBodyContactParameters,
): number | null => {
  const trajectory = buildRunnerMotionTrajectory(
    start,
    intent,
    deltaTicks,
    motionParameters,
  );
  return findRunnerBaseTouchTickOnTrajectory(
    trajectory,
    route,
    base,
    bodyParameters,
  );
};
