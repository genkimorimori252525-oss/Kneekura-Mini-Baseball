import type { BaseTouchRegion } from '../running/BaseTouch';
import { quantizeEventTick } from '../ExactEventTime';
import type {
  DefenderPhysicalPrimitiveSegment,
} from './DefenderPhysicalPrimitive';

const BOUNDARY_TOLERANCE_METERS = 1e-9;

type BaseLocalKinematics = Readonly<{
  position: Readonly<{ x: number; y: number; z: number }>;
  velocity: Readonly<{ x: number; y: number; z: number }>;
  acceleration: Readonly<{ x: number; y: number; z: number }>;
}>;

const validateFinite = (
  name: string,
  value: number,
): void => {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be finite`);
  }
};

const validatePrimitive = (
  primitive: DefenderPhysicalPrimitiveSegment,
): void => {
  if (
    primitive.role !== 'left_foot'
    && primitive.role !== 'right_foot'
  ) {
    throw new Error(
      'defender base contact requires a left_foot or right_foot primitive',
    );
  }
  if (
    !Number.isSafeInteger(primitive.startTick)
    || primitive.startTick < 0
    || !Number.isSafeInteger(primitive.endTick)
    || primitive.endTick < primitive.startTick
  ) {
    throw new Error(
      'defender foot primitive must use a valid authoritative tick interval',
    );
  }
  if (
    !Number.isSafeInteger(primitive.ticksPerSecond)
    || primitive.ticksPerSecond <= 0
  ) {
    throw new Error(
      'defender foot primitive ticksPerSecond must be a positive safe integer',
    );
  }

  for (const [name, value] of [
    ['startCenter.x', primitive.startCenter.x],
    ['startCenter.y', primitive.startCenter.y],
    ['startCenter.z', primitive.startCenter.z],
    ['startVelocity.x', primitive.startVelocity.x],
    ['startVelocity.y', primitive.startVelocity.y],
    ['startVelocity.z', primitive.startVelocity.z],
    ['acceleration.x', primitive.acceleration.x],
    ['acceleration.y', primitive.acceleration.y],
    ['acceleration.z', primitive.acceleration.z],
  ] as const) {
    validateFinite(`primitive.${name}`, value);
  }
};

const validateBase = (
  base: BaseTouchRegion,
): void => {
  for (const [name, value] of [
    ['center.x', base.center.x],
    ['center.z', base.center.z],
    ['halfSize.x', base.halfSize.x],
    ['halfSize.z', base.halfSize.z],
    ['rotationRadians', base.rotationRadians],
  ] as const) {
    validateFinite(`base.${name}`, value);
  }
  if (base.halfSize.x <= 0 || base.halfSize.z <= 0) {
    throw new Error('base halfSize components must be positive');
  }
};

const rotateWorldToBase = (
  x: number,
  z: number,
  cosine: number,
  sine: number,
): Readonly<{ x: number; z: number }> => ({
  x: x * cosine + z * sine,
  z: -x * sine + z * cosine,
});

const localKinematics = (
  primitive: DefenderPhysicalPrimitiveSegment,
  base: BaseTouchRegion,
  baseSurfaceHeightMeters: number,
): BaseLocalKinematics => {
  const cosine = Math.cos(base.rotationRadians);
  const sine = Math.sin(base.rotationRadians);

  const position = rotateWorldToBase(
    primitive.startCenter.x - base.center.x,
    primitive.startCenter.z - base.center.z,
    cosine,
    sine,
  );
  const velocity = rotateWorldToBase(
    primitive.startVelocity.x,
    primitive.startVelocity.z,
    cosine,
    sine,
  );
  const acceleration = rotateWorldToBase(
    primitive.acceleration.x,
    primitive.acceleration.z,
    cosine,
    sine,
  );

  return {
    position: {
      x: position.x,
      y: primitive.startCenter.y - baseSurfaceHeightMeters,
      z: position.z,
    },
    velocity: {
      x: velocity.x,
      y: primitive.startVelocity.y,
      z: velocity.z,
    },
    acceleration: {
      x: acceleration.x,
      y: primitive.acceleration.y,
      z: acceleration.z,
    },
  };
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

const rootsAtCoordinate = (
  position: number,
  velocity: number,
  acceleration: number,
  target: number,
): readonly number[] => {
  const a = 0.5 * acceleration;
  const b = velocity;
  const c = position - target;
  if (![a, b, c].every(Number.isFinite)) throw new Error('defender base-contact arithmetic overflow');

  if (a === 0) {
    if (b === 0) {
      return [];
    }
    return [-c / b];
  }

  // A binary scale protects tiny products without rounding exact tangencies into two or zero roots.
  const largestCoefficient = Math.max(Math.abs(a), Math.abs(b), Math.abs(c));
  const scale = 2 ** Math.min(1023, Math.floor(Math.log2(largestCoefficient)));
  const scaledA = a / scale, scaledB = b / scale, scaledC = c / scale;
  const discriminant = scaledB * scaledB - 4 * scaledA * scaledC;
  if (!Number.isFinite(discriminant)) throw new Error('defender base-contact arithmetic overflow');
  if (discriminant < 0) {
    return [];
  }

  const root = Math.sqrt(discriminant);
  const q = -0.5 * (scaledB + (scaledB < 0 ? -root : root));
  return q === 0 ? [-scaledB / (2 * scaledA)] : [q / scaledA, scaledC / q];
};

const isInsideBase = (
  local: BaseLocalKinematics,
  base: BaseTouchRegion,
  seconds: number,
  edgeRoots: Readonly<{ x: readonly number[]; z: readonly number[] }>,
  atBoundary = true,
): boolean => {
  const x = evaluateCoordinate(
    local.position.x,
    local.velocity.x,
    local.acceleration.x,
    seconds,
  );
  const y = evaluateCoordinate(
    local.position.y,
    local.velocity.y,
    local.acceleration.y,
    seconds,
  );
  const z = evaluateCoordinate(
    local.position.z,
    local.velocity.z,
    local.acceleration.z,
    seconds,
  );

  if (![x, y, z].every(Number.isFinite)) throw new Error('defender base-contact arithmetic overflow');
  const inside = (coordinate: number, axis: 'x' | 'z') => Math.abs(coordinate) <= base.halfSize[axis]
    || atBoundary && edgeRoots[axis].includes(seconds) && Math.abs(coordinate) <= base.halfSize[axis] + BOUNDARY_TOLERANCE_METERS;
  return (
    inside(x, 'x')
    && inside(z, 'z')
    && Math.abs(y) <= BOUNDARY_TOLERANCE_METERS
  );
};

const projectBaseContact = (
  primitive: DefenderPhysicalPrimitiveSegment,
  base: BaseTouchRegion,
  baseSurfaceHeightMeters: number,
  startSeconds: number,
  endSeconds: number,
): Readonly<{ local: BaseLocalKinematics; times: readonly number[]; planeRoots: readonly number[];
  edgeRoots: Readonly<{ x: readonly number[]; z: readonly number[] }> }> => {
  validatePrimitive(primitive);
  validateBase(base);
  validateFinite(
    'baseSurfaceHeightMeters',
    baseSurfaceHeightMeters,
  );

  if (
    !Number.isFinite(startSeconds)
    || !Number.isFinite(endSeconds)
    || startSeconds < 0
    || endSeconds > (primitive.endTick - primitive.startTick) / primitive.ticksPerSecond
    || endSeconds < startSeconds
  ) {
    throw new Error(
      'defender base-contact search window must lie inside the primitive interval',
    );
  }

  const local = localKinematics(
    primitive,
    base,
    baseSurfaceHeightMeters,
  );
  if (![local.position, local.velocity, local.acceleration].every((vector) => Object.values(vector).every(Number.isFinite))
    || !(['x', 'y', 'z'] as const).every((axis) => [startSeconds, endSeconds].every((seconds) =>
      Number.isFinite(evaluateCoordinate(local.position[axis], local.velocity[axis], local.acceleration[axis], seconds))))) {
    throw new Error('defender base-contact arithmetic overflow');
  }

  const candidates: number[] = [
    startSeconds,
    endSeconds,
  ];
  const add = (root: number) => { if (root >= startSeconds && root <= endSeconds) candidates.push(root); };
  const edges = (axis: 'x' | 'z') => [base.halfSize[axis], -base.halfSize[axis]].flatMap((target) =>
    rootsAtCoordinate(local.position[axis], local.velocity[axis], local.acceleration[axis], target));
  const edgeRoots = { x: edges('x'), z: edges('z') };
  [...edgeRoots.x, ...edgeRoots.z].forEach(add);

  const planeRoots = rootsAtCoordinate(
    local.position.y,
    local.velocity.y,
    local.acceleration.y,
    0,
  );
  for (const root of planeRoots) {
    add(root);
  }

  return { local, planeRoots, edgeRoots, times: [...new Set(candidates)].sort((a, b) => a - b) };
};

/** Physical foot-center contact, measured from the primitive's true motion basis. */
export const findDefenderFootBaseContactSeconds = (
  primitive: DefenderPhysicalPrimitiveSegment,
  base: BaseTouchRegion,
  baseSurfaceHeightMeters: number,
  startSeconds: number,
  endSeconds: number,
): number | null => {
  return findDefenderFootBaseContactIntervalsSeconds(primitive, base, baseSurfaceHeightMeters, startSeconds, endSeconds)[0]?.startSeconds ?? null;
};

export type DefenderFootBaseContactIntervalSeconds = Readonly<{ startSeconds: number; endSeconds: number }>;

/** Closed contact episodes in the foot-center/top-plane model. Distinct physical breakpoints are not time-deduplicated. */
export const findDefenderFootBaseContactIntervalsSeconds = (
  primitive: DefenderPhysicalPrimitiveSegment,
  base: BaseTouchRegion,
  baseSurfaceHeightMeters: number,
  startSeconds: number,
  endSeconds: number,
): readonly DefenderFootBaseContactIntervalSeconds[] => {
  const { local, times, planeRoots, edgeRoots } = projectBaseContact(primitive, base, baseSurfaceHeightMeters, startSeconds, endSeconds);
  const intervals: DefenderFootBaseContactIntervalSeconds[] = [];
  const add = (start: number, end: number) => {
    const last = intervals.at(-1);
    if (last && start <= last.endSeconds) intervals[intervals.length - 1] = Object.freeze({ startSeconds: last.startSeconds, endSeconds: Math.max(end, last.endSeconds) });
    else intervals.push(Object.freeze({ startSeconds: start, endSeconds: end }));
  };
  const stationaryHeight = local.velocity.y === 0 && local.acceleration.y === 0;
  for (let index = 0; index < times.length; index++) {
    const current = times[index], next = times[index + 1];
    // A moving height touches the top plane at its roots, not throughout a numerical distance band.
    const atPlane = stationaryHeight || planeRoots.includes(current)
      || evaluateCoordinate(local.position.y, local.velocity.y, local.acceleration.y, current) === 0;
    if (atPlane && isInsideBase(local, base, current, edgeRoots)) add(current, current);
    if (next === undefined || !stationaryHeight) continue;
    const checks = [current + (next - current) / 2];
    for (const axis of ['x', 'z'] as const) {
      if (local.acceleration[axis] === 0) continue;
      const vertex = -local.velocity[axis] / local.acceleration[axis];
      if (vertex > current && vertex < next) checks.push(vertex);
    }
    if (isInsideBase(local, base, current, edgeRoots) && isInsideBase(local, base, next, edgeRoots)
      && checks.every((at) => isInsideBase(local, base, at, edgeRoots, false))) add(current, next);
  }
  return Object.freeze(intervals);
};

export const findDefenderFootBaseContactTick = (
  primitive: DefenderPhysicalPrimitiveSegment,
  base: BaseTouchRegion,
  baseSurfaceHeightMeters: number,
  searchStartTick: number,
  searchEndTick: number,
): number | null => {
  validatePrimitive(primitive);
  validateBase(base);
  validateFinite('baseSurfaceHeightMeters', baseSurfaceHeightMeters);
  if (!Number.isSafeInteger(searchStartTick) || !Number.isSafeInteger(searchEndTick) || searchStartTick < primitive.startTick
    || searchEndTick > primitive.endTick || searchEndTick < searchStartTick) {
    throw new Error('defender base-contact search window must lie inside the primitive interval');
  }
  const at = findDefenderFootBaseContactSeconds(primitive, base, baseSurfaceHeightMeters,
    (searchStartTick - primitive.startTick) / primitive.ticksPerSecond, (searchEndTick - primitive.startTick) / primitive.ticksPerSecond);
  return at === null ? null : quantizeEventTick(primitive.startTick, at, primitive.ticksPerSecond);
};
