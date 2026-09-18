import { findFirstTrueTick } from '../ExactEventTime';
import type { BattedBallInitialState } from '../contact/BatBallContact';

export type BallFlightParameters = Readonly<{
  ticksPerSecond: number;
  gravityY: number;
  ballRadius: number;
  groundRestitution: number;
  groundFriction: number;
  groundRollingDecelerationMps2?: number;
  integrationStepTicks: number;
  restingVerticalSpeed: number;
}>;

export const DEFAULT_BALL_FLIGHT_PARAMETERS: BallFlightParameters = Object.freeze({
  ticksPerSecond: 1_000_000,
  gravityY: -9.81,
  ballRadius: 0.0366,
  groundRestitution: 0.35,
  groundFriction: 0.78,
  groundRollingDecelerationMps2: 4,
  integrationStepTicks: 2_000,
  restingVerticalSpeed: 0.5,
});

const GROUND_EPSILON = 1e-12;

const validateParameters = (parameters: BallFlightParameters): void => {
  if (!Number.isInteger(parameters.ticksPerSecond) || parameters.ticksPerSecond <= 0) {
    throw new Error('ticksPerSecond must be a positive integer');
  }
  if (!Number.isInteger(parameters.integrationStepTicks) || parameters.integrationStepTicks <= 0) {
    throw new Error('integrationStepTicks must be a positive integer');
  }
  if (parameters.ballRadius <= 0) {
    throw new Error('ballRadius must be positive');
  }
  if (parameters.groundRestitution < 0 || parameters.groundRestitution > 1) {
    throw new Error('groundRestitution must be within [0, 1]');
  }
  if (parameters.groundFriction < 0 || parameters.groundFriction > 1) {
    throw new Error('groundFriction must be within [0, 1]');
  }
  const rollingDeceleration =
    parameters.groundRollingDecelerationMps2
    ?? DEFAULT_BALL_FLIGHT_PARAMETERS.groundRollingDecelerationMps2
    ?? 0;
  if (
    !Number.isFinite(rollingDeceleration)
    || rollingDeceleration < 0
  ) {
    throw new Error(
      'groundRollingDecelerationMps2 must be finite and non-negative',
    );
  }
  if (parameters.restingVerticalSpeed < 0) {
    throw new Error('restingVerticalSpeed must be non-negative');
  }
};

const advanceFreeFlight = (
  state: BattedBallInitialState,
  stepTicks: number,
  parameters: BallFlightParameters,
): BattedBallInitialState => {
  const dt = stepTicks / parameters.ticksPerSecond;
  return {
    tick: state.tick + stepTicks,
    position: {
      x: state.position.x + state.velocity.x * dt,
      y: state.position.y + state.velocity.y * dt + 0.5 * parameters.gravityY * dt * dt,
      z: state.position.z + state.velocity.z * dt,
    },
    velocity: {
      x: state.velocity.x,
      y: state.velocity.y + parameters.gravityY * dt,
      z: state.velocity.z,
    },
    spin: state.spin,
  };
};

export const findGroundContactTick = (
  state: BattedBallInitialState,
  deltaTicks: number,
  parameters: BallFlightParameters = DEFAULT_BALL_FLIGHT_PARAMETERS,
): number | null => {
  validateParameters(parameters);
  if (!Number.isInteger(deltaTicks) || deltaTicks < 0) {
    throw new Error('deltaTicks must be a non-negative integer');
  }

  const atGround = state.position.y <= parameters.ballRadius + GROUND_EPSILON;
  if (state.position.y < parameters.ballRadius - GROUND_EPSILON) {
    return state.tick;
  }
  if (atGround && state.velocity.y < 0) {
    return state.tick;
  }
  if (atGround && state.velocity.y === 0) {
    return null;
  }
  if (deltaTicks === 0) {
    return null;
  }

  return findFirstTrueTick(state.tick, state.tick + deltaTicks, (tick) => {
    if (tick === state.tick) {
      return false;
    }
    const dt = (tick - state.tick) / parameters.ticksPerSecond;
    const y =
      state.position.y +
      state.velocity.y * dt +
      0.5 * parameters.gravityY * dt * dt;
    return y <= parameters.ballRadius;
  });
};

const getGroundRollingDeceleration = (
  parameters: BallFlightParameters,
): number => (
  parameters.groundRollingDecelerationMps2
  ?? DEFAULT_BALL_FLIGHT_PARAMETERS.groundRollingDecelerationMps2
  ?? 0
);

const isOnGround = (
  state: BattedBallInitialState,
  parameters: BallFlightParameters,
): boolean => (
  state.position.y <= parameters.ballRadius + GROUND_EPSILON
  && Math.abs(state.velocity.y) <= GROUND_EPSILON
);

const advanceGroundRoll = (
  state: BattedBallInitialState,
  stepTicks: number,
  parameters: BallFlightParameters,
): BattedBallInitialState => {
  const speed = Math.hypot(
    state.velocity.x,
    state.velocity.z,
  );
  if (speed <= GROUND_EPSILON) {
    return {
      ...state,
      tick: state.tick + stepTicks,
      position: {
        ...state.position,
        y: parameters.ballRadius,
      },
      velocity: {
        x: 0,
        y: 0,
        z: 0,
      },
    };
  }

  const deceleration =
    getGroundRollingDeceleration(parameters);
  const durationSeconds =
    stepTicks / parameters.ticksPerSecond;

  if (deceleration <= GROUND_EPSILON) {
    return {
      tick: state.tick + stepTicks,
      position: {
        x: state.position.x
          + state.velocity.x * durationSeconds,
        y: parameters.ballRadius,
        z: state.position.z
          + state.velocity.z * durationSeconds,
      },
      velocity: {
        x: state.velocity.x,
        y: 0,
        z: state.velocity.z,
      },
      spin: state.spin,
    };
  }

  const directionX = state.velocity.x / speed;
  const directionZ = state.velocity.z / speed;
  const stopSeconds = speed / deceleration;
  const travelSeconds = Math.min(
    durationSeconds,
    stopSeconds,
  );
  const distance = (
    speed * travelSeconds
    - 0.5
      * deceleration
      * travelSeconds
      * travelSeconds
  );
  const remainingSpeed = Math.max(
    0,
    speed - deceleration * durationSeconds,
  );

  return {
    tick: state.tick + stepTicks,
    position: {
      x: state.position.x + directionX * distance,
      y: parameters.ballRadius,
      z: state.position.z + directionZ * distance,
    },
    velocity: remainingSpeed <= GROUND_EPSILON
      ? {
          x: 0,
          y: 0,
          z: 0,
        }
      : {
          x: directionX * remainingSpeed,
          y: 0,
          z: directionZ * remainingSpeed,
        },
    spin: state.spin,
  };
};

export const findGroundRollingStopTick = (
  state: BattedBallInitialState,
  deltaTicks: number,
  parameters: BallFlightParameters = DEFAULT_BALL_FLIGHT_PARAMETERS,
): number | null => {
  validateParameters(parameters);
  if (!Number.isInteger(deltaTicks) || deltaTicks < 0) {
    throw new Error(
      'deltaTicks must be a non-negative integer',
    );
  }
  if (!isOnGround(state, parameters)) {
    return null;
  }

  const speed = Math.hypot(
    state.velocity.x,
    state.velocity.z,
  );
  if (speed <= GROUND_EPSILON) {
    return state.tick;
  }

  const deceleration =
    getGroundRollingDeceleration(parameters);
  if (deceleration <= GROUND_EPSILON) {
    return null;
  }

  const stopSeconds = speed / deceleration;
  const stopTick = quantizeEventTick(
    state.tick,
    stopSeconds,
    parameters.ticksPerSecond,
  );

  return stopTick - state.tick <= deltaTicks
    ? stopTick
    : null;
};

const advanceStep = (
  state: BattedBallInitialState,
  stepTicks: number,
  parameters: BallFlightParameters,
): BattedBallInitialState => {
  let current = state;
  let remaining = stepTicks;

  while (remaining > 0) {
    if (isOnGround(current, parameters)) {
      return advanceGroundRoll(
        current,
        remaining,
        parameters,
      );
    }

    const contactTick = findGroundContactTick(current, remaining, parameters);
    if (contactTick === null) {
      return advanceFreeFlight(current, remaining, parameters);
    }

    const ticksToContact = contactTick - current.tick;
    const freeAtContact =
      ticksToContact === 0
        ? current
        : advanceFreeFlight(current, ticksToContact, parameters);

    let impactVelocity = freeAtContact.velocity;
    if (impactVelocity.y < 0) {
      const reflectedY = -impactVelocity.y * parameters.groundRestitution;
      impactVelocity = {
        x: impactVelocity.x * parameters.groundFriction,
        y: reflectedY < parameters.restingVerticalSpeed ? 0 : reflectedY,
        z: impactVelocity.z * parameters.groundFriction,
      };
    }

    current = {
      tick: contactTick,
      position: {
        x: freeAtContact.position.x,
        y: parameters.ballRadius,
        z: freeAtContact.position.z,
      },
      velocity: impactVelocity,
      spin: freeAtContact.spin,
    };
    remaining -= ticksToContact;
  }

  return current;
};

export const advanceBallState = (
  state: BattedBallInitialState,
  deltaTicks: number,
  parameters: BallFlightParameters = DEFAULT_BALL_FLIGHT_PARAMETERS,
): BattedBallInitialState => {
  validateParameters(parameters);
  if (!Number.isInteger(deltaTicks) || deltaTicks < 0) {
    throw new Error('deltaTicks must be a non-negative integer');
  }

  let current = state;
  let remaining = deltaTicks;
  while (remaining > 0) {
    const stepTicks = Math.min(parameters.integrationStepTicks, remaining);
    current = advanceStep(current, stepTicks, parameters);
    remaining -= stepTicks;
  }
  return current;
};

export const sampleBallFlight = (
  initial: BattedBallInitialState,
  durationTicks: number,
  cadenceTicks: number,
  parameters: BallFlightParameters = DEFAULT_BALL_FLIGHT_PARAMETERS,
): readonly BattedBallInitialState[] => {
  validateParameters(parameters);
  if (!Number.isInteger(durationTicks) || durationTicks < 0) {
    throw new Error('durationTicks must be a non-negative integer');
  }
  if (!Number.isInteger(cadenceTicks) || cadenceTicks <= 0) {
    throw new Error('cadenceTicks must be a positive integer');
  }

  const samples: BattedBallInitialState[] = [initial];
  let current = initial;
  let elapsed = 0;

  while (elapsed + cadenceTicks <= durationTicks) {
    current = advanceBallState(current, cadenceTicks, parameters);
    samples.push(current);
    elapsed += cadenceTicks;
  }

  return samples;
};
