import type { Vec3 } from '../../model/geometry';
import { quantizeEventTick } from '../ExactEventTime';
import { findMovingSphereContactTime, type SphereContactTime } from './MovingSphereContact';

export type AcceleratedSphereContactState = Readonly<{
  tick: number;
  center: Vec3;
  velocity: Vec3;
  acceleration: Vec3;
  radius: number;
}>;

export type AcceleratedSphereContactParameters = Readonly<{
  ticksPerSecond: number;
}>;

const COEFFICIENT_EPSILON = 1e-12;
const ROOT_BISECTION_ITERATIONS = 80;

const subtract = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});

const dot = (a: Vec3, b: Vec3): number => (
  a.x * b.x + a.y * b.y + a.z * b.z
);

const magnitudeSquared = (value: Vec3): number => dot(value, value);

const validateVec3 = (name: string, value: Vec3): void => {
  if (
    !Number.isFinite(value.x)
    || !Number.isFinite(value.y)
    || !Number.isFinite(value.z)
  ) {
    throw new Error(`${name} must contain finite coordinates`);
  }
};

const validateState = (
  state: AcceleratedSphereContactState,
  name: string,
): void => {
  if (!Number.isSafeInteger(state.tick) || state.tick < 0) {
    throw new Error(`${name}.tick must be a non-negative safe integer tick`);
  }
  validateVec3(`${name}.center`, state.center);
  validateVec3(`${name}.velocity`, state.velocity);
  validateVec3(`${name}.acceleration`, state.acceleration);
  if (!Number.isFinite(state.radius) || state.radius <= 0) {
    throw new Error(`${name}.radius must be a finite positive number`);
  }
};

const uniqueSorted = (values: readonly number[]): number[] => {
  const sorted = [...values].sort((a, b) => a - b);
  const result: number[] = [];
  for (const value of sorted) {
    const previous = result[result.length - 1];
    if (
      previous === undefined
      || Math.abs(value - previous) > 1e-10 * Math.max(1, Math.abs(value))
    ) {
      result.push(value);
    }
  }
  return result;
};

const solveLinearRoots = (
  a: number,
  b: number,
): number[] => {
  if (Math.abs(a) <= COEFFICIENT_EPSILON) {
    return [];
  }
  return [-b / a];
};

const solveQuadraticRoots = (
  a: number,
  b: number,
  c: number,
): number[] => {
  if (Math.abs(a) <= COEFFICIENT_EPSILON) {
    return solveLinearRoots(b, c);
  }

  const discriminant = b * b - 4 * a * c;
  const tolerance = COEFFICIENT_EPSILON * Math.max(
    1,
    Math.abs(b * b),
    Math.abs(4 * a * c),
  );

  if (discriminant < -tolerance) {
    return [];
  }
  if (Math.abs(discriminant) <= tolerance) {
    return [-b / (2 * a)];
  }

  const sqrtDiscriminant = Math.sqrt(discriminant);
  const q = -0.5 * (b + Math.sign(b || 1) * sqrtDiscriminant);
  const first = q / a;
  const second = c / q;
  return uniqueSorted([first, second]);
};

const bisectSignChange = (
  evaluate: (time: number) => number,
  start: number,
  end: number,
): number => {
  let low = start;
  let high = end;
  let lowValue = evaluate(low);

  for (let iteration = 0; iteration < ROOT_BISECTION_ITERATIONS; iteration += 1) {
    const middle = (low + high) / 2;
    const middleValue = evaluate(middle);

    if (middleValue === 0) {
      return middle;
    }

    if (
      (lowValue < 0 && middleValue > 0)
      || (lowValue > 0 && middleValue < 0)
    ) {
      high = middle;
    } else {
      low = middle;
      lowValue = middleValue;
    }
  }

  return (low + high) / 2;
};

const findCubicRootsInInterval = (
  a: number,
  b: number,
  c: number,
  d: number,
  start: number,
  end: number,
): number[] => {
  if (Math.abs(a) <= COEFFICIENT_EPSILON) {
    return solveQuadraticRoots(b, c, d)
      .filter((root) => root >= start && root <= end);
  }

  const evaluate = (time: number): number => (
    ((a * time + b) * time + c) * time + d
  );

  const criticalPoints = solveQuadraticRoots(3 * a, 2 * b, c)
    .filter((root) => root > start && root < end);
  const boundaries = uniqueSorted([start, ...criticalPoints, end]);
  const roots: number[] = [];

  for (const boundary of boundaries) {
    const value = evaluate(boundary);
    const tolerance = COEFFICIENT_EPSILON * Math.max(
      1,
      Math.abs(a * boundary * boundary * boundary),
      Math.abs(b * boundary * boundary),
      Math.abs(c * boundary),
      Math.abs(d),
    );
    if (Math.abs(value) <= tolerance) {
      roots.push(boundary);
    }
  }

  for (let index = 0; index + 1 < boundaries.length; index += 1) {
    const left = boundaries[index];
    const right = boundaries[index + 1];
    const leftValue = evaluate(left);
    const rightValue = evaluate(right);
    if (
      (leftValue < 0 && rightValue > 0)
      || (leftValue > 0 && rightValue < 0)
    ) {
      roots.push(bisectSignChange(evaluate, left, right));
    }
  }

  return uniqueSorted(
    roots.filter((root) => root >= start && root <= end),
  );
};

const bisectFirstNonPositive = (
  evaluate: (time: number) => number,
  start: number,
  end: number,
): number => {
  let low = start;
  let high = end;

  for (let iteration = 0; iteration < ROOT_BISECTION_ITERATIONS; iteration += 1) {
    const middle = (low + high) / 2;
    if (evaluate(middle) <= 0) {
      high = middle;
    } else {
      low = middle;
    }
  }

  return high;
};

export const findAcceleratedSphereContactTime = (
  first: AcceleratedSphereContactState,
  second: AcceleratedSphereContactState,
  deltaTicks: number,
  parameters: AcceleratedSphereContactParameters,
): SphereContactTime | null => {
  validateState(first, 'first');
  validateState(second, 'second');
  if (
    !Number.isSafeInteger(parameters.ticksPerSecond)
    || parameters.ticksPerSecond <= 0
  ) {
    throw new Error('ticksPerSecond must be a positive safe integer');
  }
  if (first.tick !== second.tick) {
    throw new Error('accelerated contact states must use the same start tick');
  }
  if (!Number.isSafeInteger(deltaTicks) || deltaTicks < 0) {
    throw new Error('deltaTicks must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(first.tick + deltaTicks)) {
    throw new Error('contact search end tick must be a safe integer');
  }

  const relativePosition = subtract(first.center, second.center);
  const relativeVelocity = subtract(first.velocity, second.velocity);
  const relativeAcceleration = subtract(
    first.acceleration,
    second.acceleration,
  );
  const contactRadius = first.radius + second.radius;
  const initialSeparationValue = (
    magnitudeSquared(relativePosition)
    - contactRadius * contactRadius
  );

  if (initialSeparationValue <= 0) {
    return { tick: first.tick, elapsedSeconds: 0 };
  }
  if (deltaTicks === 0) {
    return null;
  }

  if (magnitudeSquared(relativeAcceleration) <= COEFFICIENT_EPSILON ** 2) {
    return findMovingSphereContactTime(
      {
        tick: first.tick,
        center: first.center,
        velocity: first.velocity,
        radius: first.radius,
      },
      {
        tick: second.tick,
        center: second.center,
        velocity: second.velocity,
        radius: second.radius,
      },
      deltaTicks,
      parameters,
    );
  }

  const c0 = initialSeparationValue;
  const c1 = 2 * dot(relativePosition, relativeVelocity);
  const c2 = (
    dot(relativeVelocity, relativeVelocity)
    + dot(relativePosition, relativeAcceleration)
  );
  const c3 = dot(relativeVelocity, relativeAcceleration);
  const c4 = 0.25 * dot(relativeAcceleration, relativeAcceleration);

  const evaluateSeparation = (time: number): number => (
    ((((c4 * time) + c3) * time + c2) * time + c1) * time + c0
  );

  const durationSeconds = deltaTicks / parameters.ticksPerSecond;
  const stationaryTimes = findCubicRootsInInterval(
    4 * c4,
    3 * c3,
    2 * c2,
    c1,
    0,
    durationSeconds,
  ).filter((time) => time > 0 && time < durationSeconds);

  const boundaries = uniqueSorted([
    0,
    ...stationaryTimes,
    durationSeconds,
  ]);
  const valueTolerance = COEFFICIENT_EPSILON * Math.max(
    1,
    contactRadius * contactRadius,
    magnitudeSquared(relativePosition),
  );

  let contactSeconds: number | null = null;

  for (let index = 0; index < boundaries.length; index += 1) {
    const boundary = boundaries[index];
    const boundaryValue = evaluateSeparation(boundary);

    if (boundary > 0 && boundaryValue <= valueTolerance) {
      if (boundaryValue <= 0 && index > 0) {
        const previous = boundaries[index - 1];
        const previousValue = evaluateSeparation(previous);
        contactSeconds = previousValue > 0
          ? bisectFirstNonPositive(
              evaluateSeparation,
              previous,
              boundary,
            )
          : previous;
      } else {
        contactSeconds = boundary;
      }
      break;
    }

    if (index + 1 >= boundaries.length) {
      continue;
    }

    const next = boundaries[index + 1];
    const nextValue = evaluateSeparation(next);
    if (boundaryValue > 0 && nextValue < -valueTolerance) {
      contactSeconds = bisectFirstNonPositive(
        evaluateSeparation,
        boundary,
        next,
      );
      break;
    }
  }

  if (contactSeconds === null) {
    return null;
  }

  const contactTick = quantizeEventTick(
    first.tick,
    contactSeconds,
    parameters.ticksPerSecond,
  );
  return contactTick - first.tick <= deltaTicks
    ? { tick: contactTick, elapsedSeconds: contactSeconds }
    : null;
};

export const findAcceleratedSphereContactTick = (
  first: AcceleratedSphereContactState, second: AcceleratedSphereContactState, deltaTicks: number, parameters: AcceleratedSphereContactParameters,
): number | null => findAcceleratedSphereContactTime(first, second, deltaTicks, parameters)?.tick ?? null;
