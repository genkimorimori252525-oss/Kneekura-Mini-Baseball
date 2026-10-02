import type { Vec3 } from '../../model/geometry';
import type {
  BattedBallInitialState,
} from '../contact/BatBallContact';
import type {
  RigidBaseballProperties,
} from '../contact/RigidBatBallContact';

export type GroundBallMotionParameters = Readonly<{
  ticksPerSecond: number;
  gravityMagnitudeMps2: number;
  ball: RigidBaseballProperties;
  slidingFrictionCoefficient: number;
  rollingDecelerationMps2: number;
}>;

export type GroundBallMotionResult = Readonly<{
  state: BattedBallInitialState;
  mode:
    | 'sliding'
    | 'rolling'
    | 'stopped';
  slidingSeconds: number;
  rollingSeconds: number;
  reachedRollingConstraint: boolean;
}>;

const EPSILON = 1e-12;

const magnitude2 = (
  x: number,
  z: number,
): number => Math.hypot(x, z);

const validate = (
  state: BattedBallInitialState,
  stepTicks: number,
  parameters: GroundBallMotionParameters,
): void => {
  if (
    !Number.isSafeInteger(stepTicks)
    || stepTicks < 0
  ) {
    throw new Error(
      'ground motion stepTicks must be a non-negative safe integer',
    );
  }
  if (
    !Number.isSafeInteger(
      parameters.ticksPerSecond,
    )
    || parameters.ticksPerSecond <= 0
  ) {
    throw new Error(
      'ground motion ticksPerSecond must be a positive safe integer',
    );
  }
  if (
    !Number.isFinite(
      parameters.gravityMagnitudeMps2,
    )
    || parameters.gravityMagnitudeMps2 <= 0
  ) {
    throw new Error(
      'ground motion gravityMagnitudeMps2 must be finite and positive',
    );
  }
  if (
    !Number.isFinite(
      parameters.slidingFrictionCoefficient,
    )
    || parameters.slidingFrictionCoefficient < 0
  ) {
    throw new Error(
      'ground motion slidingFrictionCoefficient must be finite and non-negative',
    );
  }
  if (
    !Number.isFinite(
      parameters.rollingDecelerationMps2,
    )
    || parameters.rollingDecelerationMps2 < 0
  ) {
    throw new Error(
      'ground motion rollingDecelerationMps2 must be finite and non-negative',
    );
  }
  if (
    !Number.isFinite(
      parameters.ball.massKg,
    )
    || parameters.ball.massKg <= 0
    || !Number.isFinite(
      parameters.ball.radiusM,
    )
    || parameters.ball.radiusM <= 0
    || !Number.isFinite(
      parameters.ball.rotationalInertiaFactor,
    )
    || parameters.ball.rotationalInertiaFactor <= 0
  ) {
    throw new Error(
      'ground motion ball properties must be finite and positive',
    );
  }
  if (
    !Number.isFinite(state.position.x)
    || !Number.isFinite(state.position.y)
    || !Number.isFinite(state.position.z)
    || !Number.isFinite(state.velocity.x)
    || !Number.isFinite(state.velocity.y)
    || !Number.isFinite(state.velocity.z)
    || !Number.isFinite(state.spin.x)
    || !Number.isFinite(state.spin.y)
    || !Number.isFinite(state.spin.z)
  ) {
    throw new Error(
      'ground motion state must contain finite values',
    );
  }
};

export const calculateGroundContactSlipVelocity = (
  velocity: Vec3,
  spin: Vec3,
  ballRadiusM: number,
): Vec3 => ({
  x:
    velocity.x
    + ballRadiusM * spin.z,
  y: 0,
  z:
    velocity.z
    - ballRadiusM * spin.x,
});

const projectRollingSpin = (
  velocity: Vec3,
  spinY: number,
  ballRadiusM: number,
): Vec3 => ({
  x: velocity.z / ballRadiusM,
  y: spinY,
  z: -velocity.x / ballRadiusM,
});

const advanceRolling = (
  state: BattedBallInitialState,
  durationSeconds: number,
  parameters: GroundBallMotionParameters,
): BattedBallInitialState => {
  const speed = magnitude2(
    state.velocity.x,
    state.velocity.z,
  );

  if (speed <= EPSILON) {
    return {
      ...state,
      position: {
        ...state.position,
        y: parameters.ball.radiusM,
      },
      velocity: {
        x: 0,
        y: 0,
        z: 0,
      },
      spin: {
        x: 0,
        y: state.spin.y,
        z: 0,
      },
    };
  }

  const deceleration =
    parameters.rollingDecelerationMps2;
  if (deceleration <= EPSILON) {
    const velocity = {
      x: state.velocity.x,
      y: 0,
      z: state.velocity.z,
    };
    return {
      ...state,
      position: {
        x:
          state.position.x
          + velocity.x * durationSeconds,
        y: parameters.ball.radiusM,
        z:
          state.position.z
          + velocity.z * durationSeconds,
      },
      velocity,
      spin: projectRollingSpin(
        velocity,
        state.spin.y,
        parameters.ball.radiusM,
      ),
    };
  }

  const directionX =
    state.velocity.x / speed;
  const directionZ =
    state.velocity.z / speed;
  const stopSeconds =
    speed / deceleration;
  const travelSeconds =
    Math.min(
      durationSeconds,
      stopSeconds,
    );
  const distance =
    speed * travelSeconds
    - 0.5
      * deceleration
      * travelSeconds
      * travelSeconds;
  const remainingSpeed =
    Math.max(
      0,
      speed
      - deceleration
        * durationSeconds,
    );

  const velocity =
    remainingSpeed <= EPSILON
      ? {
          x: 0,
          y: 0,
          z: 0,
        }
      : {
          x:
            directionX
            * remainingSpeed,
          y: 0,
          z:
            directionZ
            * remainingSpeed,
        };

  return {
    ...state,
    position: {
      x:
        state.position.x
        + directionX * distance,
      y: parameters.ball.radiusM,
      z:
        state.position.z
        + directionZ * distance,
    },
    velocity,
    spin: projectRollingSpin(
      velocity,
      state.spin.y,
      parameters.ball.radiusM,
    ),
  };
};

/**
 * Exact reduced-order horizontal ground motion under:
 * - Coulomb sliding friction until bottom-point slip reaches zero;
 * - then a no-slip rolling constraint with independent rolling resistance.
 *
 * This keeps skid and roll as physical state transitions instead of instantly
 * snapping every settled bounce into rolling.
 */
export const advanceGroundBallMotion = (
  state: BattedBallInitialState,
  stepTicks: number,
  parameters: GroundBallMotionParameters,
): GroundBallMotionResult => {
  validate(
    state,
    stepTicks,
    parameters,
  );

  const durationSeconds =
    stepTicks
    / parameters.ticksPerSecond;

  if (durationSeconds <= EPSILON) {
    const slip =
      calculateGroundContactSlipVelocity(
        state.velocity,
        state.spin,
        parameters.ball.radiusM,
      );
    const slipSpeed =
      magnitude2(slip.x, slip.z);

    return {
      state,
      mode:
        slipSpeed > EPSILON
          ? 'sliding'
          : (
              magnitude2(
                state.velocity.x,
                state.velocity.z,
              ) > EPSILON
                ? 'rolling'
                : 'stopped'
            ),
      slidingSeconds: 0,
      rollingSeconds: 0,
      reachedRollingConstraint:
        slipSpeed <= EPSILON,
    };
  }

  const slip =
    calculateGroundContactSlipVelocity(
      state.velocity,
      state.spin,
      parameters.ball.radiusM,
    );
  const slipSpeed =
    magnitude2(slip.x, slip.z);

  if (slipSpeed <= EPSILON) {
    const rolled =
      advanceRolling(
        state,
        durationSeconds,
        parameters,
      );
    return {
      state: {
        ...rolled,
        tick:
          state.tick
          + stepTicks,
      },
      mode:
        magnitude2(
          rolled.velocity.x,
          rolled.velocity.z,
        ) <= EPSILON
          ? 'stopped'
          : 'rolling',
      slidingSeconds: 0,
      rollingSeconds:
        durationSeconds,
      reachedRollingConstraint: true,
    };
  }

  const mu =
    parameters.slidingFrictionCoefficient;

  if (mu <= EPSILON) {
    return {
      state: {
        ...state,
        tick:
          state.tick
          + stepTicks,
        position: {
          x:
            state.position.x
            + state.velocity.x
              * durationSeconds,
          y: parameters.ball.radiusM,
          z:
            state.position.z
            + state.velocity.z
              * durationSeconds,
        },
        velocity: {
          x: state.velocity.x,
          y: 0,
          z: state.velocity.z,
        },
      },
      mode: 'sliding',
      slidingSeconds:
        durationSeconds,
      rollingSeconds: 0,
      reachedRollingConstraint: false,
    };
  }

  const mass =
    parameters.ball.massKg;
  const radius =
    parameters.ball.radiusM;
  const inertia =
    parameters.ball.rotationalInertiaFactor
    * mass
    * radius
    * radius;
  const inverseTangentialMass =
    1 / mass
    + radius * radius / inertia;
  const impulseToRoll =
    slipSpeed
    / inverseTangentialMass;
  const impulseRate =
    mu
    * mass
    * parameters.gravityMagnitudeMps2;
  const secondsToRoll =
    impulseToRoll
    / impulseRate;
  const slidingSeconds =
    Math.min(
      durationSeconds,
      secondsToRoll,
    );

  const slipDirectionX =
    slip.x / slipSpeed;
  const slipDirectionZ =
    slip.z / slipSpeed;
  const impulseMagnitude =
    Math.min(
      impulseToRoll,
      impulseRate
      * slidingSeconds,
    );
  const impulseX =
    -slipDirectionX
    * impulseMagnitude;
  const impulseZ =
    -slipDirectionZ
    * impulseMagnitude;

  const accelerationX =
    slidingSeconds <= EPSILON
      ? 0
      : impulseX
        / mass
        / slidingSeconds;
  const accelerationZ =
    slidingSeconds <= EPSILON
      ? 0
      : impulseZ
        / mass
        / slidingSeconds;

  const velocityAfterSlide = {
    x:
      state.velocity.x
      + impulseX / mass,
    y: 0,
    z:
      state.velocity.z
      + impulseZ / mass,
  };

  const spinAfterSlide = {
    x:
      state.spin.x
      - radius * impulseZ
        / inertia,
    y: state.spin.y,
    z:
      state.spin.z
      + radius * impulseX
        / inertia,
  };

  let current: BattedBallInitialState = {
    tick: state.tick,
    position: {
      x:
        state.position.x
        + state.velocity.x
          * slidingSeconds
        + 0.5
          * accelerationX
          * slidingSeconds
          * slidingSeconds,
      y: parameters.ball.radiusM,
      z:
        state.position.z
        + state.velocity.z
          * slidingSeconds
        + 0.5
          * accelerationZ
          * slidingSeconds
          * slidingSeconds,
    },
    velocity:
      velocityAfterSlide,
    spin:
      spinAfterSlide,
  };

  const reachedRollingConstraint =
    secondsToRoll
    <= durationSeconds
    + EPSILON;

  if (!reachedRollingConstraint) {
    return {
      state: {
        ...current,
        tick:
          state.tick
          + stepTicks,
      },
      mode: 'sliding',
      slidingSeconds:
        durationSeconds,
      rollingSeconds: 0,
      reachedRollingConstraint: false,
    };
  }

  current = {
    ...current,
    spin: projectRollingSpin(
      current.velocity,
      current.spin.y,
      radius,
    ),
  };

  const rollingSeconds =
    Math.max(
      0,
      durationSeconds
      - secondsToRoll,
    );
  const rolled =
    advanceRolling(
      current,
      rollingSeconds,
      parameters,
    );

  return {
    state: {
      ...rolled,
      tick:
        state.tick
        + stepTicks,
    },
    mode:
      magnitude2(
        rolled.velocity.x,
        rolled.velocity.z,
      ) <= EPSILON
        ? 'stopped'
        : 'rolling',
    slidingSeconds:
      secondsToRoll,
    rollingSeconds,
    reachedRollingConstraint: true,
  };
};
