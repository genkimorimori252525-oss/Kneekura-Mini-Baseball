import type { Vec3 } from '../../model/geometry';
import { findFirstTrueTick, quantizeEventTick } from '../ExactEventTime';
import type { BattedBallInitialState } from '../contact/BatBallContact';
import {
  REFERENCE_BASEBALL_AERODYNAMICS,
  calculateBaseballAerodynamics,
  type BaseballAerodynamicsParameters,
} from './BaseballAerodynamics';
import {
  resolveBallSurfaceContact,
  type BallSurfaceContactParameters,
} from './BallSurfaceContact';
import type {
  RigidBaseballProperties,
} from '../contact/RigidBatBallContact';
import {
  resolveBallSurfaceResponse,
  validateBallSurfaceResponseProfile,
  type BallSurfaceResponseProfile,
} from './BallSurfaceResponseProfile';
import {
  resolveBallSurfaceResponseGrid,
  validateBallSurfaceResponseGrid,
  type BallSurfaceResponseGrid,
} from './BallSurfaceResponseGrid';
import {
  advanceGroundBallMotion,
} from './GroundBallMotion';
import {
  resolveBallSurfaceMaterialContact,
  validateBallSurfaceMaterialProfile,
  type BallSurfaceMaterialProfile,
} from './BallSurfaceMaterial';

export type GroundSurfacePhysics = Readonly<{
  ball: RigidBaseballProperties;
  /**
   * Static compatibility form. Use responseProfile when empirical data show
   * material response varies with incident speed.
   */
  contact?: BallSurfaceContactParameters;
  responseProfile?: BallSurfaceResponseProfile;
  responseGrid?: BallSurfaceResponseGrid;
  /**
   * Unified material form for new callers. When present it replaces the
   * contact/responseProfile/responseGrid compatibility forms above.
   */
  material?: BallSurfaceMaterialProfile;
  /**
   * Post-impact kinetic sliding friction used to evolve residual bottom-point
   * slip into no-slip rolling. Omit to preserve the earlier immediate rolling
   * projection behavior.
   */
  slidingFrictionCoefficient?: number;
  enforceRollingConstraint?: boolean;
}>;

export type BallFlightParameters = Readonly<{
  ticksPerSecond: number;
  gravityY: number;
  ballRadius: number;
  groundRestitution: number;
  groundFriction: number;
  groundRollingDecelerationMps2?: number;
  integrationStepTicks: number;
  restingVerticalSpeed: number;
  aerodynamics?: BaseballAerodynamicsParameters | null;
  /**
   * Optional spin-coupled physical ground contact. Null preserves the frozen
   * legacy ground response for compatibility.
   */
  groundSurfacePhysics?: GroundSurfacePhysics | null;
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
  aerodynamics: null,
  groundSurfacePhysics: null,
});

export const REALISTIC_BASEBALL_FLIGHT_PARAMETERS: BallFlightParameters =
  Object.freeze({
    ...DEFAULT_BALL_FLIGHT_PARAMETERS,
    aerodynamics: REFERENCE_BASEBALL_AERODYNAMICS,
  });

const GROUND_EPSILON = 1e-12;

const add = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
});

const scale = (value: Vec3, scalar: number): Vec3 => ({
  x: value.x * scalar,
  y: value.y * scalar,
  z: value.z * scalar,
});

const weightedSum = (
  a: Vec3,
  b: Vec3,
  c: Vec3,
  d: Vec3,
): Vec3 => ({
  x: a.x + 2 * b.x + 2 * c.x + d.x,
  y: a.y + 2 * b.y + 2 * c.y + d.y,
  z: a.z + 2 * b.z + 2 * c.z + d.z,
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
  if (
    parameters.aerodynamics !== null
    && parameters.aerodynamics !== undefined
    && Math.abs(parameters.aerodynamics.ballRadiusM - parameters.ballRadius) > 1e-9
  ) {
    throw new Error(
      'aerodynamics.ballRadiusM must match ballRadius',
    );
  }

  const surface =
    parameters.groundSurfacePhysics;
  if (
    surface !== null
    && surface !== undefined
  ) {
    if (
      Math.abs(
        surface.ball.radiusM
        - parameters.ballRadius,
      ) > 1e-9
    ) {
      throw new Error(
        'groundSurfacePhysics.ball.radiusM must match ballRadius',
      );
    }
    if (
      parameters.aerodynamics !== null
      && parameters.aerodynamics !== undefined
      && Math.abs(
        surface.ball.massKg
        - parameters.aerodynamics.ballMassKg,
      ) > 1e-9
    ) {
      throw new Error(
        'ground surface ball mass must match aerodynamic ball mass',
      );
    }

    const hasStatic =
      surface.contact !== undefined;
    const hasProfile =
      surface.responseProfile !== undefined;
    const hasGrid =
      surface.responseGrid !== undefined;
    const hasMaterial =
      surface.material !== undefined;
    const responseKinds = [
      hasStatic,
      hasProfile,
      hasGrid,
      hasMaterial,
    ].filter(Boolean).length;

    if (responseKinds !== 1) {
      throw new Error(
        'groundSurfacePhysics requires exactly one of contact, responseProfile, responseGrid, or material',
      );
    }

    if (
      surface.responseProfile
      !== undefined
    ) {
      validateBallSurfaceResponseProfile(
        surface.responseProfile,
      );
    }
    if (
      surface.responseGrid
      !== undefined
    ) {
      validateBallSurfaceResponseGrid(
        surface.responseGrid,
      );
    }
    if (
      surface.material
      !== undefined
    ) {
      validateBallSurfaceMaterialProfile(
        surface.material,
      );
    }
    if (
      surface.slidingFrictionCoefficient
      !== undefined
      && (
        !Number.isFinite(
          surface.slidingFrictionCoefficient,
        )
        || surface.slidingFrictionCoefficient < 0
      )
    ) {
      throw new Error(
        'groundSurfacePhysics.slidingFrictionCoefficient must be finite and non-negative',
      );
    }
  }
};

const calculateFreeFlightAcceleration = (
  velocity: Vec3,
  spin: Vec3,
  parameters: BallFlightParameters,
): Vec3 => {
  const gravity = { x: 0, y: parameters.gravityY, z: 0 } as const;
  if (
    parameters.aerodynamics === null
    || parameters.aerodynamics === undefined
  ) {
    return gravity;
  }

  return add(
    gravity,
    calculateBaseballAerodynamics(
      velocity,
      spin,
      parameters.aerodynamics,
    ).totalAcceleration,
  );
};

const advanceAerodynamicFreeFlight = (
  state: BattedBallInitialState,
  stepTicks: number,
  parameters: BallFlightParameters,
): BattedBallInitialState => {
  const dt = stepTicks / parameters.ticksPerSecond;

  const k1Position = state.velocity;
  const k1Velocity = calculateFreeFlightAcceleration(
    state.velocity,
    state.spin,
    parameters,
  );

  const k2VelocityInput = add(
    state.velocity,
    scale(k1Velocity, dt / 2),
  );
  const k2Position = k2VelocityInput;
  const k2Velocity = calculateFreeFlightAcceleration(
    k2VelocityInput,
    state.spin,
    parameters,
  );

  const k3VelocityInput = add(
    state.velocity,
    scale(k2Velocity, dt / 2),
  );
  const k3Position = k3VelocityInput;
  const k3Velocity = calculateFreeFlightAcceleration(
    k3VelocityInput,
    state.spin,
    parameters,
  );

  const k4VelocityInput = add(
    state.velocity,
    scale(k3Velocity, dt),
  );
  const k4Position = k4VelocityInput;
  const k4Velocity = calculateFreeFlightAcceleration(
    k4VelocityInput,
    state.spin,
    parameters,
  );

  return {
    tick: state.tick + stepTicks,
    position: add(
      state.position,
      scale(
        weightedSum(
          k1Position,
          k2Position,
          k3Position,
          k4Position,
        ),
        dt / 6,
      ),
    ),
    velocity: add(
      state.velocity,
      scale(
        weightedSum(
          k1Velocity,
          k2Velocity,
          k3Velocity,
          k4Velocity,
        ),
        dt / 6,
      ),
    ),
    spin: state.spin,
  };
};

const advanceFreeFlight = (
  state: BattedBallInitialState,
  stepTicks: number,
  parameters: BallFlightParameters,
): BattedBallInitialState => {
  if (
    parameters.aerodynamics !== null
    && parameters.aerodynamics !== undefined
  ) {
    return advanceAerodynamicFreeFlight(
      state,
      stepTicks,
      parameters,
    );
  }

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

export const sampleUninterruptedBallFreeFlight = (
  state: BattedBallInitialState,
  deltaTicks: number,
  parameters: BallFlightParameters =
    DEFAULT_BALL_FLIGHT_PARAMETERS,
): BattedBallInitialState => {
  validateParameters(parameters);
  if (
    !Number.isSafeInteger(deltaTicks)
    || deltaTicks < 0
  ) {
    throw new Error(
      'uninterrupted free-flight deltaTicks must be a non-negative safe integer',
    );
  }

  if (
    parameters.aerodynamics === null
    || parameters.aerodynamics === undefined
  ) {
    return advanceFreeFlight(
      state,
      deltaTicks,
      parameters,
    );
  }

  let current = state;
  let remaining = deltaTicks;

  while (remaining > 0) {
    const stepTicks = Math.min(
      parameters.integrationStepTicks,
      remaining,
    );
    current = advanceFreeFlight(
      current,
      stepTicks,
      parameters,
    );
    remaining -= stepTicks;
  }

  return current;
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

    if (
      parameters.aerodynamics !== null
      && parameters.aerodynamics !== undefined
    ) {
      return sampleUninterruptedBallFreeFlight(
        state,
        tick - state.tick,
        parameters,
      ).position.y <= parameters.ballRadius;
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
  parameters.groundSurfacePhysics
    ?.material
    ?.rollingDecelerationMps2
  ?? parameters.groundRollingDecelerationMps2
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

const applyRollingSpinConstraint = (
  state: BattedBallInitialState,
  parameters: BallFlightParameters,
): BattedBallInitialState => {
  const surface =
    parameters.groundSurfacePhysics;
  if (
    surface === null
    || surface === undefined
    || surface.enforceRollingConstraint === false
  ) {
    return state;
  }

  return {
    ...state,
    spin: {
      x: state.velocity.z
        / parameters.ballRadius,
      y: state.spin.y,
      z: -state.velocity.x
        / parameters.ballRadius,
    },
  };
};

const advanceGroundRoll = (
  state: BattedBallInitialState,
  stepTicks: number,
  parameters: BallFlightParameters,
): BattedBallInitialState => {
  const surface =
    parameters.groundSurfacePhysics;
  if (
    surface !== null
    && surface !== undefined
    && (
      surface.slidingFrictionCoefficient
      !== undefined
      || surface.material
        ?.slidingFrictionCoefficient
        !== undefined
    )
  ) {
    return advanceGroundBallMotion(
      state,
      stepTicks,
      {
        ticksPerSecond:
          parameters.ticksPerSecond,
        gravityMagnitudeMps2:
          Math.abs(parameters.gravityY),
        ball: surface.ball,
        slidingFrictionCoefficient:
          surface.slidingFrictionCoefficient
          ?? surface.material!
            .slidingFrictionCoefficient!,
        rollingDecelerationMps2:
          getGroundRollingDeceleration(
            parameters,
          ),
      },
    ).state;
  }

  const speed = Math.hypot(
    state.velocity.x,
    state.velocity.z,
  );
  if (speed <= GROUND_EPSILON) {
    return applyRollingSpinConstraint({
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
    }, parameters);
  }

  const deceleration =
    getGroundRollingDeceleration(parameters);
  const durationSeconds =
    stepTicks / parameters.ticksPerSecond;

  if (deceleration <= GROUND_EPSILON) {
    return applyRollingSpinConstraint({
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
    }, parameters);
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

  return applyRollingSpinConstraint({
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
  }, parameters);
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

    const surface =
      parameters.groundSurfacePhysics;

    if (
      surface !== null
      && surface !== undefined
      && freeAtContact.velocity.y < 0
    ) {
      const contact =
        resolveBallSurfaceContact({
          tick: contactTick,
          ballCenter: {
            x: freeAtContact.position.x,
            y: parameters.ballRadius,
            z: freeAtContact.position.z,
          },
          ballVelocity:
            freeAtContact.velocity,
          ballSpin:
            freeAtContact.spin,
          ball: surface.ball,
          surfaceNormal: {
            x: 0,
            y: 1,
            z: 0,
          },
          parameters:
            surface.material !== undefined
              ? resolveBallSurfaceMaterialContact(
                  surface.material,
                  freeAtContact.velocity,
                  {
                    x: 0,
                    y: 1,
                    z: 0,
                  },
                )
              : surface.responseGrid !== undefined
                ? resolveBallSurfaceResponseGrid(
                    surface.responseGrid,
                    Math.hypot(
                      freeAtContact.velocity.x,
                      freeAtContact.velocity.y,
                      freeAtContact.velocity.z,
                    ),
                    Math.atan2(
                      Math.abs(
                        freeAtContact.velocity.y,
                      ),
                      Math.hypot(
                        freeAtContact.velocity.x,
                        freeAtContact.velocity.z,
                      ),
                    ),
                  )
                : surface.responseProfile !== undefined
                  ? resolveBallSurfaceResponse(
                      surface.responseProfile,
                      Math.hypot(
                        freeAtContact.velocity.x,
                        freeAtContact.velocity.y,
                        freeAtContact.velocity.z,
                      ),
                    )
                  : surface.contact!,
        });

      if (contact === null) {
        throw new Error(
          'ground surface contact unexpectedly resolved as separating',
        );
      }

      const settled =
        contact.exitVelocity.y
        < parameters.restingVerticalSpeed;

      current = {
        tick: contactTick,
        position: {
          x: freeAtContact.position.x,
          y: parameters.ballRadius,
          z: freeAtContact.position.z,
        },
        velocity: {
          x: contact.exitVelocity.x,
          y: settled
            ? 0
            : contact.exitVelocity.y,
          z: contact.exitVelocity.z,
        },
        spin: contact.exitSpin,
      };

      if (
        settled
        && surface
          .slidingFrictionCoefficient
          === undefined
        && surface.material
          ?.slidingFrictionCoefficient
          === undefined
      ) {
        current =
          applyRollingSpinConstraint(
            current,
            parameters,
          );
      }
    } else {
      let impactVelocity =
        freeAtContact.velocity;
      if (impactVelocity.y < 0) {
        const reflectedY =
          -impactVelocity.y
          * parameters.groundRestitution;
        impactVelocity = {
          x: impactVelocity.x
            * parameters.groundFriction,
          y: reflectedY
            < parameters.restingVerticalSpeed
            ? 0
            : reflectedY,
          z: impactVelocity.z
            * parameters.groundFriction,
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
    }
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
