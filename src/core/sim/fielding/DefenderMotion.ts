import type { Vec2 } from '../../model/geometry';

export type DefenderMotionState = Readonly<{
  tick: number;
  position: Vec2;
  velocity: Vec2;
}>;

export type DefenderMotionParameters = Readonly<{
  ticksPerSecond: number;
  maxIntegrationStepTicks: number;
  accelerationMps2: number;
  brakingMps2: number;
  topSpeedMps: number;
  arrivalRadiusMeters: number;
}>;

export type DefenderMotionSegment = Readonly<{
  startTick: number;
  endTick: number;
  ticksPerSecond: number;
  startPosition: Vec2;
  startVelocity: Vec2;
  acceleration: Vec2;
  target: Vec2 | null;
}>;

const EPSILON = 1e-12;

const clean = (value: number): number => (
  Math.abs(value) < EPSILON ? 0 : value
);

const cleanVec = (value: Vec2): Vec2 => ({
  x: clean(value.x),
  z: clean(value.z),
});

const magnitude = (value: Vec2): number => Math.hypot(value.x, value.z);

const subtract = (a: Vec2, b: Vec2): Vec2 => ({
  x: a.x - b.x,
  z: a.z - b.z,
});

const add = (a: Vec2, b: Vec2): Vec2 => ({
  x: a.x + b.x,
  z: a.z + b.z,
});

const scale = (value: Vec2, amount: number): Vec2 => ({
  x: value.x * amount,
  z: value.z * amount,
});

const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.z * b.z;

const normalized = (value: Vec2): Vec2 => {
  const length = magnitude(value);
  if (length <= EPSILON) return { x: 0, z: 0 };
  return {
    x: value.x / length,
    z: value.z / length,
  };
};

const moveToward = (
  current: Vec2,
  target: Vec2,
  maxDelta: number,
): Vec2 => {
  const delta = subtract(target, current);
  const distance = magnitude(delta);
  if (distance <= maxDelta || distance <= EPSILON) {
    return cleanVec(target);
  }
  return cleanVec(add(current, scale(delta, maxDelta / distance)));
};

const validateVec = (name: string, value: Vec2): void => {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.z)) {
    throw new Error(`${name} must contain finite coordinates`);
  }
};

const validateTick = (name: string, value: number): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer tick`);
  }
};

const validatePositive = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be finite and positive`);
  }
};

const validateParameters = (
  parameters: DefenderMotionParameters,
): void => {
  if (!Number.isSafeInteger(parameters.ticksPerSecond) || parameters.ticksPerSecond <= 0) {
    throw new Error('ticksPerSecond must be a positive safe integer');
  }
  if (
    !Number.isSafeInteger(parameters.maxIntegrationStepTicks)
    || parameters.maxIntegrationStepTicks <= 0
  ) {
    throw new Error('maxIntegrationStepTicks must be a positive safe integer');
  }
  validatePositive('accelerationMps2', parameters.accelerationMps2);
  validatePositive('brakingMps2', parameters.brakingMps2);
  validatePositive('topSpeedMps', parameters.topSpeedMps);
  if (
    !Number.isFinite(parameters.arrivalRadiusMeters)
    || parameters.arrivalRadiusMeters < 0
  ) {
    throw new Error('arrivalRadiusMeters must be finite and non-negative');
  }
};

const validateState = (
  state: DefenderMotionState,
  parameters: DefenderMotionParameters,
): void => {
  validateTick('state.tick', state.tick);
  validateVec('state.position', state.position);
  validateVec('state.velocity', state.velocity);

  if (magnitude(state.velocity) > parameters.topSpeedMps + 1e-9) {
    throw new Error('state velocity exceeds configured top speed');
  }
};

const computeEndVelocity = (
  state: DefenderMotionState,
  target: Vec2 | null,
  deltaSeconds: number,
  parameters: DefenderMotionParameters,
): Vec2 => {
  const speed = magnitude(state.velocity);

  if (target === null) {
    return moveToward(
      state.velocity,
      { x: 0, z: 0 },
      parameters.brakingMps2 * deltaSeconds,
    );
  }

  validateVec('target', target);
  const toTarget = subtract(target, state.position);
  const distance = magnitude(toTarget);

  if (distance <= parameters.arrivalRadiusMeters + EPSILON) {
    return moveToward(
      state.velocity,
      { x: 0, z: 0 },
      parameters.brakingMps2 * deltaSeconds,
    );
  }

  const direction = normalized(toTarget);
  const forwardSpeed = dot(state.velocity, direction);
  const stoppingDistance = forwardSpeed > 0
    ? (forwardSpeed * forwardSpeed) / (2 * parameters.brakingMps2)
    : 0;
  const remainingDistance = Math.max(
    0,
    distance - parameters.arrivalRadiusMeters,
  );

  if (
    speed > EPSILON
    && forwardSpeed > 0
    && stoppingDistance + 1e-9 >= remainingDistance
  ) {
    return moveToward(
      state.velocity,
      { x: 0, z: 0 },
      parameters.brakingMps2 * deltaSeconds,
    );
  }

  const desiredVelocity = scale(direction, parameters.topSpeedMps);
  return moveToward(
    state.velocity,
    desiredVelocity,
    parameters.accelerationMps2 * deltaSeconds,
  );
};

const createSegment = (
  state: DefenderMotionState,
  target: Vec2 | null,
  stepTicks: number,
  parameters: DefenderMotionParameters,
): DefenderMotionSegment => {
  const deltaSeconds = stepTicks / parameters.ticksPerSecond;
  const endVelocity = computeEndVelocity(
    state,
    target,
    deltaSeconds,
    parameters,
  );
  const acceleration = deltaSeconds === 0
    ? { x: 0, z: 0 }
    : {
        x: (endVelocity.x - state.velocity.x) / deltaSeconds,
        z: (endVelocity.z - state.velocity.z) / deltaSeconds,
      };

  return {
    startTick: state.tick,
    endTick: state.tick + stepTicks,
    ticksPerSecond: parameters.ticksPerSecond,
    startPosition: state.position,
    startVelocity: state.velocity,
    acceleration: cleanVec(acceleration),
    target,
  };
};

export const sampleDefenderMotionSegment = (
  segment: DefenderMotionSegment,
  tick: number,
): DefenderMotionState => {
  validateTick('tick', tick);
  if (tick < segment.startTick || tick > segment.endTick) {
    throw new Error('tick must be inside the defender motion segment');
  }
  if (!Number.isSafeInteger(segment.ticksPerSecond) || segment.ticksPerSecond <= 0) {
    throw new Error('segment ticksPerSecond must be a positive safe integer');
  }

  const elapsedSeconds = (
    tick - segment.startTick
  ) / segment.ticksPerSecond;
  const halfTimeSquared = 0.5 * elapsedSeconds * elapsedSeconds;

  return {
    tick,
    position: cleanVec({
      x: segment.startPosition.x
        + segment.startVelocity.x * elapsedSeconds
        + segment.acceleration.x * halfTimeSquared,
      z: segment.startPosition.z
        + segment.startVelocity.z * elapsedSeconds
        + segment.acceleration.z * halfTimeSquared,
    }),
    velocity: cleanVec({
      x: segment.startVelocity.x
        + segment.acceleration.x * elapsedSeconds,
      z: segment.startVelocity.z
        + segment.acceleration.z * elapsedSeconds,
    }),
  };
};

export const buildDefenderMotionTrajectory = (
  state: DefenderMotionState,
  target: Vec2 | null,
  deltaTicks: number,
  parameters: DefenderMotionParameters,
): readonly DefenderMotionSegment[] => {
  validateParameters(parameters);
  validateState(state, parameters);
  validateTick('deltaTicks', deltaTicks);
  if (target !== null) validateVec('target', target);
  if (!Number.isSafeInteger(state.tick + deltaTicks)) {
    throw new Error('end tick must be a safe integer');
  }

  const segments: DefenderMotionSegment[] = [];
  let current = state;
  let remaining = deltaTicks;

  while (remaining > 0) {
    const stepTicks = Math.min(
      remaining,
      parameters.maxIntegrationStepTicks,
    );
    const segment = createSegment(
      current,
      target,
      stepTicks,
      parameters,
    );
    segments.push(segment);
    current = sampleDefenderMotionSegment(segment, segment.endTick);
    remaining -= stepTicks;
  }

  return segments;
};

export const advanceDefenderMotion = (
  state: DefenderMotionState,
  target: Vec2 | null,
  deltaTicks: number,
  parameters: DefenderMotionParameters,
): DefenderMotionState => {
  const trajectory = buildDefenderMotionTrajectory(
    state,
    target,
    deltaTicks,
    parameters,
  );
  if (trajectory.length === 0) {
    return state;
  }

  const finalSegment = trajectory[trajectory.length - 1];
  return sampleDefenderMotionSegment(
    finalSegment,
    finalSegment.endTick,
  );
};
