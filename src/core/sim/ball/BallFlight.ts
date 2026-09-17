import type { Vec3 } from '../../model/geometry';
import type { BattedBallInitialState } from '../contact/BatBallContact';

export type BallFlightParameters = Readonly<{
  ticksPerSecond: number;
  gravityY: number;
  ballRadius: number;
  groundRestitution: number;
  groundFriction: number;
  integrationStepTicks: number;
  restingVerticalSpeed: number;
}>;

export const DEFAULT_BALL_FLIGHT_PARAMETERS: BallFlightParameters = Object.freeze({
  ticksPerSecond: 1_000_000,
  gravityY: -9.81,
  ballRadius: 0.0366,
  groundRestitution: 0.35,
  groundFriction: 0.78,
  integrationStepTicks: 2_000,
  restingVerticalSpeed: 0.5,
});

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
  if (parameters.restingVerticalSpeed < 0) {
    throw new Error('restingVerticalSpeed must be non-negative');
  }
};

const advanceStep = (
  state: BattedBallInitialState,
  stepTicks: number,
  parameters: BallFlightParameters,
): BattedBallInitialState => {
  const dt = stepTicks / parameters.ticksPerSecond;
  const onGround =
    state.position.y <= parameters.ballRadius + 1e-12 &&
    state.velocity.y === 0;

  if (onGround) {
    return {
      tick: state.tick + stepTicks,
      position: {
        x: state.position.x + state.velocity.x * dt,
        y: parameters.ballRadius,
        z: state.position.z + state.velocity.z * dt,
      },
      velocity: state.velocity,
      spin: state.spin,
    };
  }

  const nextPosition: Vec3 = {
    x: state.position.x + state.velocity.x * dt,
    y: state.position.y + state.velocity.y * dt + 0.5 * parameters.gravityY * dt * dt,
    z: state.position.z + state.velocity.z * dt,
  };
  let nextVelocity: Vec3 = {
    x: state.velocity.x,
    y: state.velocity.y + parameters.gravityY * dt,
    z: state.velocity.z,
  };

  if (nextPosition.y < parameters.ballRadius) {
    nextPosition.y = parameters.ballRadius;
    if (nextVelocity.y < 0) {
      const reflectedY = -nextVelocity.y * parameters.groundRestitution;
      nextVelocity = {
        x: nextVelocity.x * parameters.groundFriction,
        y: reflectedY < parameters.restingVerticalSpeed ? 0 : reflectedY,
        z: nextVelocity.z * parameters.groundFriction,
      };
    }
  }

  return {
    tick: state.tick + stepTicks,
    position: nextPosition,
    velocity: nextVelocity,
    spin: state.spin,
  };
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
