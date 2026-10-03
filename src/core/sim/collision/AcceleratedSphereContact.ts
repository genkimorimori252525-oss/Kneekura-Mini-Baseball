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
  // Scale each finite squared term before summation. Summing near-limit
  // squares first can overflow the floating-point error bound to Infinity and
  // fabricate a tangent contact that never physically occurs.
  const errorScale = 8 * Number.EPSILON;
  const squaredTerms = [
    relativePosition.x * relativePosition.x,
    relativePosition.y * relativePosition.y,
    relativePosition.z * relativePosition.z,
    contactRadius * contactRadius,
  ];
  if (squaredTerms.some((value) => !Number.isFinite(value))) {
    throw new Error('accelerated contact squared geometry overflow');
  }
  const scaledErrorBound = squaredTerms.reduce(
    (sum, value) => sum + value * errorScale,
    0,
  );
  if (!Number.isFinite(scaledErrorBound)) {
    throw new Error('accelerated contact error bound overflow');
  }
  const valueTolerance = Math.max(
    COEFFICIENT_EPSILON,
    scaledErrorBound,
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

const continuousPolynomialValue = (coefficients: readonly number[], time: number): number => (
  coefficients.reduceRight((value, coefficient) => value * time + coefficient, 0)
);

const continuousPolynomialIsZero = (coefficients: readonly number[], time: number): boolean => {
  const magnitude = coefficients.reduceRight((value, coefficient) => value * Math.abs(time) + Math.abs(coefficient), 0);
  return Math.abs(continuousPolynomialValue(coefficients, time)) <= 8 * Number.EPSILON * magnitude;
};

// Normalized intervals can have roots arbitrarily close to zero. Refine until
// adjacent floating-point times, rather than spending a fixed absolute budget.
const continuousBisect = (evaluate: (time: number) => number, start: number, end: number, firstNonPositive: boolean): number => {
  let low = start, high = end, lowValue = evaluate(low);
  while (true) {
    const middle = low + (high - low) / 2;
    if (middle === low || middle === high) return firstNonPositive ? high : middle;
    const value = evaluate(middle);
    if (!firstNonPositive && value === 0) return middle;
    if (firstNonPositive ? value <= 0 : (lowValue < 0 && value > 0) || (lowValue > 0 && value < 0)) high = middle;
    else { low = middle; lowValue = value; }
  }
};

// These roots use relative roundoff and retain distinct normalized times. The legacy
// tick API's absolute coefficient/root tolerances are not valid for arbitrary horizons.
const continuousPolynomialRoots = (input: readonly number[], start: number, end: number): number[] => {
  const coefficients = [...input];
  while (coefficients.length > 1 && coefficients[coefficients.length - 1] === 0) coefficients.pop();
  if (coefficients.length < 2) return [];
  if (coefficients.length === 2) {
    const root = -coefficients[0] / coefficients[1];
    return root >= start && root <= end ? [root] : [];
  }
  const derivative = coefficients.slice(1).map((value, index) => value * (index + 1));
  const critical = continuousPolynomialRoots(derivative, start, end).filter((time) => time > start && time < end);
  const boundaries = [...new Set([start, ...critical, end])].sort((a, b) => a - b);
  const roots = boundaries.filter((time) => continuousPolynomialIsZero(coefficients, time));
  const evaluate = (time: number) => continuousPolynomialValue(coefficients, time);
  for (let index = 0; index + 1 < boundaries.length; index++) {
    const left = boundaries[index], right = boundaries[index + 1];
    const a = evaluate(left), b = evaluate(right);
    if ((a < 0 && b > 0) || (a > 0 && b < 0)) roots.push(continuousBisect(evaluate, left, right, false));
  }
  return [...new Set(roots)].sort((a, b) => a - b);
};

const continuousSpherePolynomial = (
  first: AcceleratedSphereContactState,
  second: AcceleratedSphereContactState,
  durationSeconds: number,
) => {
  validateState(first, 'first'); validateState(second, 'second');
  if (first.tick !== second.tick || !Number.isFinite(durationSeconds) || durationSeconds < 0) throw new Error('invalid continuous sphere contact interval');
  const position = subtract(first.center, second.center), velocity = subtract(first.velocity, second.velocity);
  const acceleration = subtract(first.acceleration, second.acceleration), radius = first.radius + second.radius;
  const c0 = magnitudeSquared(position) - radius * radius;
  const c1 = 2 * dot(position, velocity);
  const c2 = magnitudeSquared(velocity) + dot(position, acceleration);
  const c3 = dot(velocity, acceleration), c4 = 0.25 * magnitudeSquared(acceleration);
  if (![radius, c0, c1, c2, c3, c4].every(Number.isFinite)) throw new Error('continuous sphere geometry arithmetic overflow');
  // Normalize both time and coefficients. A small physical departure must not disappear
  // because an absolute coefficient threshold treats its real acceleration as zero.
  const scaled = [c0, c1 * durationSeconds, c2 * durationSeconds * durationSeconds,
    c3 * durationSeconds * durationSeconds * durationSeconds,
    c4 * durationSeconds * durationSeconds * durationSeconds * durationSeconds];
  if (!scaled.every(Number.isFinite)) throw new Error('continuous sphere horizon arithmetic overflow');
  const scale = Math.max(...scaled.map(Math.abs)) || 1;
  const [a0, a1, a2, a3, a4] = scaled.map((value) => value / scale);
  const evaluate = (t: number) => ((((a4 * t + a3) * t + a2) * t + a1) * t + a0);
  const tangentSeparation = (t: number) => {
    const seconds = t * durationSeconds;
    const coordinates = (['x', 'y', 'z'] as const).map((axis) => {
      const coordinate = position[axis] + velocity[axis] * seconds + 0.5 * acceleration[axis] * seconds * seconds;
      return coordinate * coordinate;
    }).sort((a, b) => b - a);
    // Subtract the radius from the dominant squared component first. Otherwise
    // adding tiny tangent-axis squares to radius^2 can round an earlier point to contact.
    const value = ((coordinates[0] - radius * radius) + coordinates[1]) + coordinates[2];
    if (!Number.isFinite(value)) throw new Error('continuous sphere sample arithmetic overflow');
    // Scale each finite squared term before summation so the error bound itself
    // cannot overflow and admit a real gap near the finite numeric limit.
    const roundoff = [radius * radius, ...coordinates].reduce((sum, term) => sum + 8 * Number.EPSILON * term, 0);
    return { value, roundoff };
  };
  const derivativeCoefficients = [a1, 2 * a2, 3 * a3, 4 * a4];
  const stationaryAt = (t: number) => continuousPolynomialIsZero(derivativeCoefficients, t);
  const curvature = (t: number) => ((12 * a4 * t + 6 * a3) * t + 2 * a2);
  const stationary = continuousPolynomialRoots(derivativeCoefficients, 0, 1)
    .filter((time) => time > 0 && time < 1);
  const boundaries = [...new Set([0, ...stationary, 1])].sort((a, b) => a - b);
  return { c0, a1, a2, a3, a4, evaluate, tangentSeparation, stationaryAt, curvature, boundaries };
};

/** Relative continuous time for a causal motion segment; prior contacts must depart before re-entering. */
export const findAcceleratedSphereContactSeconds = (
  first: AcceleratedSphereContactState, second: AcceleratedSphereContactState, durationSeconds: number, initialContact: 'include' | 'after_departure',
): number | null => {
  if (!['include', 'after_departure'].includes(initialContact)) throw new Error('invalid continuous sphere contact policy');
  const { c0, evaluate, tangentSeparation, stationaryAt, curvature, boundaries } = continuousSpherePolynomial(first, second, durationSeconds);
  if (initialContact === 'include' && c0 <= 0) return 0;
  if (durationSeconds === 0) return null;
  let departed = c0 > 0;
  for (let index = 0; index + 1 < boundaries.length; index += 1) {
    const left = boundaries[index], right = boundaries[index + 1];
    const leftValue = evaluate(left), rightValue = evaluate(right);
    if (leftValue > 0) departed = true;
    // Tolerance only refines a tangent minimum, never a separating maximum or
    // an approaching contact beyond the supplied physical horizon.
    if (departed && stationaryAt(right) && curvature(right) > 0) {
      const separation = tangentSeparation(right);
      if (separation.value >= 0 && separation.value <= separation.roundoff) return right * durationSeconds;
    }
    if (departed && leftValue > 0 && rightValue <= 0) {
      return continuousBisect(evaluate, left, right, true) * durationSeconds;
    }
    if (rightValue > 0) departed = true;
  }
  return null;
};

/** Detect an unresolved inward constraint before a previous contact actually departs; do not ghost through its collider. */
export const findAcceleratedSphereBlockedDepartureSeconds = (
  first: AcceleratedSphereContactState, second: AcceleratedSphereContactState, durationSeconds: number,
): number | null => {
  const p = continuousSpherePolynomial(first, second, durationSeconds);
  if (p.c0 > 0 || durationSeconds === 0) return null;
  const firstMotion = [p.a1, p.a2, p.a3, p.a4].find((v) => v !== 0);
  if (firstMotion === undefined) return null;
  if (firstMotion < 0) return 0;
  for (let index = 1; index < p.boundaries.length; index++) {
    const time = p.boundaries[index], value = p.evaluate(time);
    if (value > 0) return null; // Genuine departure occurred on this monotonic interval.
    if (p.curvature(time) < 0 && p.stationaryAt(time)) return time * durationSeconds;
  }
  return null;
};
