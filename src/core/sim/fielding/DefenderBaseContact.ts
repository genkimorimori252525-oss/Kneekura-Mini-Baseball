import type { BaseTouchRegion } from '../running/BaseTouch';
import { quantizeEventTick } from '../ExactEventTime';
import type {
  DefenderPhysicalPrimitiveSegment,
} from './DefenderPhysicalPrimitive';

const EPSILON = 1e-12;
const ROOT_TOLERANCE_SECONDS = 1e-10;
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

  if (Math.abs(a) <= EPSILON) {
    if (Math.abs(b) <= EPSILON) {
      return [];
    }
    return [-c / b];
  }

  const discriminant = b * b - 4 * a * c;
  if (!Number.isFinite(discriminant)) throw new Error('defender base-contact arithmetic overflow');
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

const addCandidate = (
  candidates: number[],
  value: number,
  startSeconds: number,
  endSeconds: number,
): void => {
  if (
    value < startSeconds - ROOT_TOLERANCE_SECONDS
    || value > endSeconds + ROOT_TOLERANCE_SECONDS
  ) {
    return;
  }
  candidates.push(
    Math.max(startSeconds, Math.min(endSeconds, value)),
  );
};

const uniqueSorted = (
  values: readonly number[],
): readonly number[] => {
  const sorted = [...values].sort((first, second) => first - second);
  const result: number[] = [];
  for (const value of sorted) {
    if (
      result.length === 0
      || Math.abs(value - result[result.length - 1])
        > ROOT_TOLERANCE_SECONDS
    ) {
      result.push(value);
    }
  }
  return result;
};

const isInsideBase = (
  local: BaseLocalKinematics,
  base: BaseTouchRegion,
  seconds: number,
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

  return (
    Math.abs(x) <= base.halfSize.x + BOUNDARY_TOLERANCE_METERS
    && Math.abs(z) <= base.halfSize.z + BOUNDARY_TOLERANCE_METERS
    && Math.abs(y) <= BOUNDARY_TOLERANCE_METERS
  );
};

/** Physical foot-center contact, measured from the primitive's true motion basis. */
export const findDefenderFootBaseContactSeconds = (
  primitive: DefenderPhysicalPrimitiveSegment,
  base: BaseTouchRegion,
  baseSurfaceHeightMeters: number,
  startSeconds: number,
  endSeconds: number,
): number | null => {
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

  for (const root of rootsAtCoordinate(
    local.position.x,
    local.velocity.x,
    local.acceleration.x,
    base.halfSize.x,
  )) {
    addCandidate(candidates, root, startSeconds, endSeconds);
  }
  for (const root of rootsAtCoordinate(
    local.position.x,
    local.velocity.x,
    local.acceleration.x,
    -base.halfSize.x,
  )) {
    addCandidate(candidates, root, startSeconds, endSeconds);
  }
  for (const root of rootsAtCoordinate(
    local.position.z,
    local.velocity.z,
    local.acceleration.z,
    base.halfSize.z,
  )) {
    addCandidate(candidates, root, startSeconds, endSeconds);
  }
  for (const root of rootsAtCoordinate(
    local.position.z,
    local.velocity.z,
    local.acceleration.z,
    -base.halfSize.z,
  )) {
    addCandidate(candidates, root, startSeconds, endSeconds);
  }

  for (const root of rootsAtCoordinate(
    local.position.y,
    local.velocity.y,
    local.acceleration.y,
    0,
  )) {
    addCandidate(candidates, root, startSeconds, endSeconds);
  }

  const times = uniqueSorted(candidates);
  for (let index = 0; index < times.length; index += 1) {
    const current = times[index];
    if (isInsideBase(local, base, current)) {
      return current;
    }

    const next = times[index + 1];
    if (next === undefined) {
      continue;
    }
    const midpoint = current + (next - current) / 2;
    if (isInsideBase(local, base, midpoint)) {
      return current;
    }
  }

  return null;
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
