export type RunnerDriveDirection = -1 | 0 | 1;
export type RunnerBodyMode = 'upright' | 'sliding';

export type RunnerMotionState = Readonly<{
  tick: number;
  routeDistanceMeters: number;
  /** Signed speed along the runner route. Positive advances, negative retreats. */
  speedMps: number;
  /** Motor command currently active in the body, before any newly issued intent reacts. */
  driveDirection: RunnerDriveDirection;
  bodyMode: RunnerBodyMode;
}>;

export type RunnerMotionIntent = Readonly<{
  kind: 'advance' | 'retreat' | 'hold' | 'slide';
  issuedTick: number;
}>;

export type RunnerMotionParameters = Readonly<{
  ticksPerSecond: number;
  reactionDelayTicks: number;
  accelerationMps2: number;
  brakingMps2: number;
  slideDecelerationMps2: number;
  topSpeedMps: number;
}>;

type IntegratedMotion = Readonly<{
  routeDistanceMeters: number;
  speedMps: number;
}>;

type ActiveRunnerControl = Readonly<{
  driveDirection: RunnerDriveDirection;
  bodyMode: RunnerBodyMode;
}>;

const EPSILON = 1e-12;

const isDriveDirection = (value: number): value is RunnerDriveDirection => (
  value === -1 || value === 0 || value === 1
);

const validateFinite = (name: string, value: number): void => {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be finite`);
  }
};

const validateState = (
  state: RunnerMotionState,
  parameters: RunnerMotionParameters,
): void => {
  if (!Number.isSafeInteger(state.tick) || state.tick < 0) {
    throw new Error('state.tick must be a non-negative safe integer tick');
  }
  validateFinite('state.routeDistanceMeters', state.routeDistanceMeters);
  validateFinite('state.speedMps', state.speedMps);
  if (!isDriveDirection(state.driveDirection)) {
    throw new Error('state.driveDirection must be -1, 0, or 1');
  }
  if (state.bodyMode !== 'upright' && state.bodyMode !== 'sliding') {
    throw new Error("state.bodyMode must be 'upright' or 'sliding'");
  }
  if (state.bodyMode === 'sliding' && state.driveDirection !== 0) {
    throw new Error('sliding runner state must not have an active drive direction');
  }
  if (Math.abs(state.speedMps) - parameters.topSpeedMps > EPSILON) {
    throw new Error('state.speedMps must not exceed topSpeedMps');
  }
};

const validateIntent = (intent: RunnerMotionIntent): void => {
  if (!Number.isSafeInteger(intent.issuedTick) || intent.issuedTick < 0) {
    throw new Error('intent.issuedTick must be a non-negative safe integer tick');
  }
};

const validateParameters = (parameters: RunnerMotionParameters): void => {
  if (!Number.isSafeInteger(parameters.ticksPerSecond) || parameters.ticksPerSecond <= 0) {
    throw new Error('ticksPerSecond must be a positive safe integer');
  }
  if (!Number.isSafeInteger(parameters.reactionDelayTicks) || parameters.reactionDelayTicks < 0) {
    throw new Error('reactionDelayTicks must be a non-negative safe integer');
  }
  for (const [name, value] of [
    ['accelerationMps2', parameters.accelerationMps2],
    ['brakingMps2', parameters.brakingMps2],
    ['slideDecelerationMps2', parameters.slideDecelerationMps2],
    ['topSpeedMps', parameters.topSpeedMps],
  ] as const) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${name} must be finite and positive`);
    }
  }
};

const controlForIntent = (intent: RunnerMotionIntent): ActiveRunnerControl => {
  switch (intent.kind) {
    case 'advance':
      return { driveDirection: 1, bodyMode: 'upright' };
    case 'retreat':
      return { driveDirection: -1, bodyMode: 'upright' };
    case 'hold':
      return { driveDirection: 0, bodyMode: 'upright' };
    case 'slide':
      return { driveDirection: 0, bodyMode: 'sliding' };
  }
};

const integrateHold = (
  routeDistanceMeters: number,
  speedMps: number,
  durationSeconds: number,
  brakingMps2: number,
): IntegratedMotion => {
  const speedMagnitude = Math.abs(speedMps);
  if (durationSeconds <= 0 || speedMagnitude <= EPSILON) {
    return {
      routeDistanceMeters,
      speedMps: speedMagnitude <= EPSILON ? 0 : speedMps,
    };
  }

  const direction = Math.sign(speedMps);
  const stopSeconds = speedMagnitude / brakingMps2;
  if (durationSeconds >= stopSeconds) {
    const displacement = direction * (
      speedMagnitude * stopSeconds
      - 0.5 * brakingMps2 * stopSeconds * stopSeconds
    );
    return {
      routeDistanceMeters: routeDistanceMeters + displacement,
      speedMps: 0,
    };
  }

  const acceleration = -direction * brakingMps2;
  return {
    routeDistanceMeters:
      routeDistanceMeters
      + speedMps * durationSeconds
      + 0.5 * acceleration * durationSeconds * durationSeconds,
    speedMps: speedMps + acceleration * durationSeconds,
  };
};

const integrateFromRestTowardDrive = (
  routeDistanceMeters: number,
  driveDirection: -1 | 1,
  durationSeconds: number,
  parameters: RunnerMotionParameters,
): IntegratedMotion => {
  if (durationSeconds <= 0) {
    return { routeDistanceMeters, speedMps: 0 };
  }

  const timeToTopSpeed = parameters.topSpeedMps / parameters.accelerationMps2;
  if (durationSeconds <= timeToTopSpeed) {
    const acceleration = driveDirection * parameters.accelerationMps2;
    return {
      routeDistanceMeters:
        routeDistanceMeters + 0.5 * acceleration * durationSeconds * durationSeconds,
      speedMps: acceleration * durationSeconds,
    };
  }

  const acceleratedDisplacement = driveDirection * (
    0.5
    * parameters.accelerationMps2
    * timeToTopSpeed
    * timeToTopSpeed
  );
  const cruiseSeconds = durationSeconds - timeToTopSpeed;
  return {
    routeDistanceMeters:
      routeDistanceMeters
      + acceleratedDisplacement
      + driveDirection * parameters.topSpeedMps * cruiseSeconds,
    speedMps: driveDirection * parameters.topSpeedMps,
  };
};

const integrateDrive = (
  routeDistanceMeters: number,
  speedMps: number,
  driveDirection: RunnerDriveDirection,
  durationSeconds: number,
  parameters: RunnerMotionParameters,
): IntegratedMotion => {
  if (durationSeconds <= 0) {
    return { routeDistanceMeters, speedMps };
  }

  if (driveDirection === 0) {
    return integrateHold(
      routeDistanceMeters,
      speedMps,
      durationSeconds,
      parameters.brakingMps2,
    );
  }

  if (Math.abs(speedMps) <= EPSILON) {
    return integrateFromRestTowardDrive(
      routeDistanceMeters,
      driveDirection,
      durationSeconds,
      parameters,
    );
  }

  if (Math.sign(speedMps) !== driveDirection) {
    const speedMagnitude = Math.abs(speedMps);
    const stopSeconds = speedMagnitude / parameters.brakingMps2;
    if (durationSeconds <= stopSeconds) {
      const acceleration = driveDirection * parameters.brakingMps2;
      return {
        routeDistanceMeters:
          routeDistanceMeters
          + speedMps * durationSeconds
          + 0.5 * acceleration * durationSeconds * durationSeconds,
        speedMps: speedMps + acceleration * durationSeconds,
      };
    }

    const brakingAcceleration = driveDirection * parameters.brakingMps2;
    const stopDisplacement =
      speedMps * stopSeconds
      + 0.5 * brakingAcceleration * stopSeconds * stopSeconds;
    return integrateFromRestTowardDrive(
      routeDistanceMeters + stopDisplacement,
      driveDirection,
      durationSeconds - stopSeconds,
      parameters,
    );
  }

  const speedMagnitude = Math.min(Math.abs(speedMps), parameters.topSpeedMps);
  const timeToTopSpeed = (
    parameters.topSpeedMps - speedMagnitude
  ) / parameters.accelerationMps2;

  if (timeToTopSpeed <= EPSILON) {
    return {
      routeDistanceMeters:
        routeDistanceMeters + driveDirection * parameters.topSpeedMps * durationSeconds,
      speedMps: driveDirection * parameters.topSpeedMps,
    };
  }

  if (durationSeconds <= timeToTopSpeed) {
    const acceleration = driveDirection * parameters.accelerationMps2;
    return {
      routeDistanceMeters:
        routeDistanceMeters
        + speedMps * durationSeconds
        + 0.5 * acceleration * durationSeconds * durationSeconds,
      speedMps: speedMps + acceleration * durationSeconds,
    };
  }

  const acceleration = driveDirection * parameters.accelerationMps2;
  const acceleratedDisplacement =
    speedMps * timeToTopSpeed
    + 0.5 * acceleration * timeToTopSpeed * timeToTopSpeed;
  const cruiseSeconds = durationSeconds - timeToTopSpeed;
  return {
    routeDistanceMeters:
      routeDistanceMeters
      + acceleratedDisplacement
      + driveDirection * parameters.topSpeedMps * cruiseSeconds,
    speedMps: driveDirection * parameters.topSpeedMps,
  };
};

const integrateActiveControl = (
  routeDistanceMeters: number,
  speedMps: number,
  control: ActiveRunnerControl,
  durationSeconds: number,
  parameters: RunnerMotionParameters,
): IntegratedMotion => {
  if (control.bodyMode === 'sliding') {
    return integrateHold(
      routeDistanceMeters,
      speedMps,
      durationSeconds,
      parameters.slideDecelerationMps2,
    );
  }
  return integrateDrive(
    routeDistanceMeters,
    speedMps,
    control.driveDirection,
    durationSeconds,
    parameters,
  );
};

export const advanceRunnerMotion = (
  state: RunnerMotionState,
  intent: RunnerMotionIntent,
  deltaTicks: number,
  parameters: RunnerMotionParameters,
): RunnerMotionState => {
  validateParameters(parameters);
  validateState(state, parameters);
  validateIntent(intent);
  if (!Number.isSafeInteger(deltaTicks) || deltaTicks < 0) {
    throw new Error('deltaTicks must be a non-negative safe integer');
  }
  const endTick = state.tick + deltaTicks;
  if (!Number.isSafeInteger(endTick)) {
    throw new Error('runner motion end tick must be a safe integer');
  }
  const reactionTick = intent.issuedTick + parameters.reactionDelayTicks;
  if (!Number.isSafeInteger(reactionTick)) {
    throw new Error('runner intent reaction tick must be a safe integer');
  }

  let routeDistanceMeters = state.routeDistanceMeters;
  let speedMps = state.speedMps;
  let control: ActiveRunnerControl = {
    driveDirection: state.driveDirection,
    bodyMode: state.bodyMode,
  };
  let cursorTick = state.tick;

  if (cursorTick < reactionTick) {
    const oldControlEndTick = Math.min(endTick, reactionTick);
    const durationSeconds = (oldControlEndTick - cursorTick) / parameters.ticksPerSecond;
    const integrated = integrateActiveControl(
      routeDistanceMeters,
      speedMps,
      control,
      durationSeconds,
      parameters,
    );
    routeDistanceMeters = integrated.routeDistanceMeters;
    speedMps = integrated.speedMps;
    cursorTick = oldControlEndTick;
  }

  if (cursorTick >= reactionTick) {
    control = controlForIntent(intent);
  }

  if (cursorTick < endTick) {
    const durationSeconds = (endTick - cursorTick) / parameters.ticksPerSecond;
    const integrated = integrateActiveControl(
      routeDistanceMeters,
      speedMps,
      control,
      durationSeconds,
      parameters,
    );
    routeDistanceMeters = integrated.routeDistanceMeters;
    speedMps = integrated.speedMps;
  }

  if (Math.abs(speedMps) <= EPSILON) {
    speedMps = 0;
  }

  return {
    tick: endTick,
    routeDistanceMeters,
    speedMps,
    driveDirection: control.driveDirection,
    bodyMode: control.bodyMode,
  };
};
