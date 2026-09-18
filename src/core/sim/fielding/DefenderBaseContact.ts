import type { BaseTouchRegion } from '../running/BaseTouch';
import { quantizeEventTick } from '../ExactEventTime';
import type {
  DefenderPhysicalPrimitiveSegment,
} from './DefenderPhysicalPrimitive';

const EPSILON = 1e-12;
const ROOT_TOLERANCE_SECONDS = 1e-10;
const BOUNDARY_TOLERANCE_METERS = 1e-9;

type PlanarKinematics = Readonly<{
  position: Readonly<{ x: number; z: number }>;
  velocity: Readonly<{ x: number; z: number }>;
  acceleration: Readonly<{ x: number; z: number }>;
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
    ['startCenter.z', primitive.startCenter.z],
    ['startVelocity.x', primitive.startVelocity.x],
    ['startVelocity.z', primitive.startVelocity.z],
    ['acceleration.x', primitive.acceleration.x],
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
): PlanarKinematics => {
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
    position,
    velocity,
    acceleration,
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

  if (Math.abs(a) <= EPSILON) {
    if (Math.abs(b) <= EPSILON) {
      return [];
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
  local: PlanarKinematics,
  base: BaseTouchRegion,
  seconds: number,
): boolean => {
  const x = evaluateCoordinate(
    local.position.x,
    local.velocity.x,
    local.acceleration.x,
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
  );
};

export const findDefenderFootBaseContactTick = (
  primitive: DefenderPhysicalPrimitiveSegment,
  base: BaseTouchRegion,
  searchStartTick: number,
  searchEndTick: number,
): number | null => {
  validatePrimitive(primitive);
  validateBase(base);

  if (
    !Number.isSafeInteger(searchStartTick)
    || !Number.isSafeInteger(searchEndTick)
    || searchStartTick < primitive.startTick
    || searchEndTick > primitive.endTick
    || searchEndTick < searchStartTick
  ) {
    throw new Error(
      'defender base-contact search window must lie inside the primitive interval',
    );
  }

  const startSeconds = (
    searchStartTick - primitive.startTick
  ) / primitive.ticksPerSecond;
  const endSeconds = (
    searchEndTick - primitive.startTick
  ) / primitive.ticksPerSecond;
  const local = localKinematics(primitive, base);

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

  const times = uniqueSorted(candidates);
  for (let index = 0; index < times.length; index += 1) {
    const current = times[index];
    if (isInsideBase(local, base, current)) {
      return quantizeEventTick(
        primitive.startTick,
        current,
        primitive.ticksPerSecond,
      );
    }

    const next = times[index + 1];
    if (next === undefined) {
      continue;
    }
    const midpoint = current + (next - current) / 2;
    if (isInsideBase(local, base, midpoint)) {
      return quantizeEventTick(
        primitive.startTick,
        current,
        primitive.ticksPerSecond,
      );
    }
  }

  return null;
};
