import type { Vec3 } from '../../model/geometry';
import type { PitchWorldState } from '../contact/BatBallContact';
import { validateBaseballMaterialOrientationV1, validateBaseballSeamForceV1 } from '../ball/BaseballSeamForceV1';
import {
  calculateBaseballAerodynamics,
  type BaseballAerodynamicsParameters,
} from '../ball/BaseballAerodynamics';
import {
  calculateBaseballSpinDecayDerivative,
} from '../ball/BaseballSpinDecay';
import {
  findFirstTrueTick,
  quantizeEventTick,
} from '../ExactEventTime';
import {
  decomposePitchSpin,
  type PitchSpinDecomposition,
} from './PitchSpinPhysics';
import {
  advanceBaseballOrientation,
  normalizeQuaternion,
  type Quaternion,
} from './BaseballOrientation';

export type AerodynamicPitchTrajectoryParameters = Readonly<{
  ticksPerSecond: number;
  integrationStepTicks: number;
  gravityY: number;
  aerodynamics: BaseballAerodynamicsParameters;
}>;
export type MaterialAerodynamicPitchStateV1 = PitchWorldState & Readonly<{ materialOrientation?: Quaternion }>;

export type AerodynamicPitchTrajectory = Readonly<{
  start: PitchWorldState;
  endTick: number;
  parameters: AerodynamicPitchTrajectoryParameters;
  /**
   * Material/seam orientation at release. Optional until seam-aware force
   * models are enabled; when present it is advanced from the physical spin.
   */
  releaseOrientation?: Quaternion;
}>;

export type AerodynamicPitchPlateCrossing = Readonly<{
  tick: number;
  elapsedSeconds: number;
  position: Vec3;
  velocity: Vec3;
  spin: Vec3;
  spinDecomposition: PitchSpinDecomposition;
  orientation?: Quaternion;
}>;

const EPSILON = 1e-12;

/** A source-rooted physical lattice, refined only by an explicitly enabled seam
 * model. Quarter-radian cells prevent high-spin seam phase aliasing. Recompute
 * only at a real new free basis/impulse; observations keep the original basis. */
export function resolveAerodynamicIntegrationStepTicksV1(spin: Vec3, parameters: AerodynamicPitchTrajectoryParameters): number {
  if (!(parameters.aerodynamics.seamForce?.coefficientScale)) return parameters.integrationStepTicks;
  const rate = Math.hypot(spin.x, spin.y, spin.z);
  if (!Number.isFinite(rate) || rate > .25 * parameters.ticksPerSecond)
    throw new Error('baseball seam force: material rotation exceeds source clock phase resolution');
  return rate <= EPSILON ? parameters.integrationStepTicks
    : Math.min(parameters.integrationStepTicks, Math.max(1, Math.floor(.25 * parameters.ticksPerSecond / rate)));
}

const add = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
});

const subtract = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
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

const lerpVec3 = (
  a: Vec3,
  b: Vec3,
  t: number,
): Vec3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});

const validateParameters = (
  parameters: AerodynamicPitchTrajectoryParameters,
): void => {
  if (parameters.aerodynamics.seamForce !== undefined) validateBaseballSeamForceV1(parameters.aerodynamics.seamForce);
  if (
    !Number.isSafeInteger(parameters.ticksPerSecond)
    || parameters.ticksPerSecond <= 0
  ) {
    throw new Error(
      'pitch aerodynamics ticksPerSecond must be a positive safe integer',
    );
  }
  if (
    !Number.isSafeInteger(parameters.integrationStepTicks)
    || parameters.integrationStepTicks <= 0
  ) {
    throw new Error(
      'pitch aerodynamics integrationStepTicks must be a positive safe integer',
    );
  }
  if (!Number.isFinite(parameters.gravityY)) {
    throw new Error(
      'pitch aerodynamics gravityY must be finite',
    );
  }
};

const validateTrajectory = (
  trajectory: AerodynamicPitchTrajectory,
): void => {
  validateParameters(trajectory.parameters);
  if (
    !Number.isSafeInteger(trajectory.start.tick)
    || trajectory.start.tick < 0
  ) {
    throw new Error(
      'aerodynamic pitch start tick must be a non-negative safe integer',
    );
  }
  if (
    !Number.isSafeInteger(trajectory.endTick)
    || trajectory.endTick < trajectory.start.tick
  ) {
    throw new Error(
      'aerodynamic pitch endTick must be a safe integer at or after start',
    );
  }
};

const accelerationAt = (
  velocity: Vec3,
  spin: Vec3,
  parameters: AerodynamicPitchTrajectoryParameters,
  materialOrientation?: Quaternion,
): Vec3 => {
  const aerodynamic = calculateBaseballAerodynamics(
    velocity,
    spin,
    parameters.aerodynamics,
    materialOrientation,
  );

  return {
    x: aerodynamic.totalAcceleration.x,
    y: aerodynamic.totalAcceleration.y
      + parameters.gravityY,
    z: aerodynamic.totalAcceleration.z,
  };
};

const spinDerivativeAt = (
  velocity: Vec3,
  spin: Vec3,
  parameters: AerodynamicPitchTrajectoryParameters,
): Vec3 => {
  const decay =
    parameters.aerodynamics.spinDecay;
  if (decay === undefined) {
    return {
      x: 0,
      y: 0,
      z: 0,
    };
  }

  return calculateBaseballSpinDecayDerivative(
    spin,
    subtract(
      velocity,
      parameters.aerodynamics
        .windVelocityMps,
    ),
    decay,
  );
};

const advanceAerodynamicPitchStep = (
  state: MaterialAerodynamicPitchStateV1,
  stepTicks: number,
  parameters: AerodynamicPitchTrajectoryParameters,
): MaterialAerodynamicPitchStateV1 => {
  const dt = stepTicks / parameters.ticksPerSecond;

  const k1Position = state.velocity;
  const k1Velocity = accelerationAt(
    state.velocity,
    state.spin,
    parameters,
    state.materialOrientation,
  );
  const k1Spin = spinDerivativeAt(
    state.velocity,
    state.spin,
    parameters,
  );

  const k2VelocityInput = add(
    state.velocity,
    scale(k1Velocity, dt / 2),
  );
  const k2SpinInput = add(
    state.spin,
    scale(k1Spin, dt / 2),
  );
  const k2Position = k2VelocityInput;
  const q2 = state.materialOrientation === undefined ? undefined : advanceBaseballOrientation(state.materialOrientation, state.spin, dt / 2);
  const k2Velocity = accelerationAt(
    k2VelocityInput,
    k2SpinInput,
    parameters,
    q2,
  );
  const k2Spin = spinDerivativeAt(
    k2VelocityInput,
    k2SpinInput,
    parameters,
  );

  const k3VelocityInput = add(
    state.velocity,
    scale(k2Velocity, dt / 2),
  );
  const k3SpinInput = add(
    state.spin,
    scale(k2Spin, dt / 2),
  );
  const k3Position = k3VelocityInput;
  const q3 = state.materialOrientation === undefined ? undefined : advanceBaseballOrientation(state.materialOrientation, k2SpinInput, dt / 2);
  const k3Velocity = accelerationAt(
    k3VelocityInput,
    k3SpinInput,
    parameters,
    q3,
  );
  const k3Spin = spinDerivativeAt(
    k3VelocityInput,
    k3SpinInput,
    parameters,
  );

  const k4VelocityInput = add(
    state.velocity,
    scale(k3Velocity, dt),
  );
  const k4SpinInput = add(
    state.spin,
    scale(k3Spin, dt),
  );
  const k4Position = k4VelocityInput;
  const q4 = state.materialOrientation === undefined ? undefined : advanceBaseballOrientation(state.materialOrientation, k3SpinInput, dt);
  const k4Velocity = accelerationAt(
    k4VelocityInput,
    k4SpinInput,
    parameters,
    q4,
  );
  const k4Spin = spinDerivativeAt(
    k4VelocityInput,
    k4SpinInput,
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
    // Aerodynamic torque changes spin magnitude only in the current model;
    // no unmeasured precession is manufactured.
    spin: add(
      state.spin,
      scale(
        weightedSum(
          k1Spin,
          k2Spin,
          k3Spin,
          k4Spin,
        ),
        dt / 6,
      ),
    ),
    ...(state.materialOrientation === undefined ? {} : { materialOrientation: advanceBaseballOrientation(state.materialOrientation,
      scale(weightedSum(state.spin, k2SpinInput, k3SpinInput, k4SpinInput), 1 / 6), dt) }),
  };
};

export const advanceAerodynamicPitchState = (
  state: PitchWorldState,
  deltaTicks: number,
  parameters: AerodynamicPitchTrajectoryParameters,
  materialOrientationAtStart?: Quaternion,
): MaterialAerodynamicPitchStateV1 => {
  validateParameters(parameters);
  if (!Number.isSafeInteger(deltaTicks) || deltaTicks < 0) {
    throw new Error(
      'aerodynamic pitch deltaTicks must be a non-negative safe integer',
    );
  }

  let current: MaterialAerodynamicPitchStateV1 = materialOrientationAtStart === undefined ? state
    : { ...state, materialOrientation: validateBaseballMaterialOrientationV1(materialOrientationAtStart) };
  if (parameters.aerodynamics.seamForce?.coefficientScale) validateBaseballMaterialOrientationV1(current.materialOrientation);
  const integrationStepTicks = resolveAerodynamicIntegrationStepTicksV1(state.spin, parameters);
  let remaining = deltaTicks;

  while (remaining > 0) {
    const stepTicks = Math.min(
      integrationStepTicks,
      remaining,
    );
    current = advanceAerodynamicPitchStep(
      current,
      stepTicks,
      parameters,
    );
    remaining -= stepTicks;
  }

  return current;
};

/** Additive continuous evaluation of the original RK4 kernel. The returned
 * clock is quantized; position, velocity and spin retain the requested physical
 * elapsed time. The integer-tick API and its arithmetic remain unchanged. */
export const sampleAerodynamicPitchStateAtElapsedSeconds = (
  state: PitchWorldState,
  elapsedSeconds: number,
  parameters: AerodynamicPitchTrajectoryParameters,
  materialOrientationAtStart?: Quaternion,
): MaterialAerodynamicPitchStateV1 => {
  validateParameters(parameters);
  if (!state || !Number.isSafeInteger(state.tick) || state.tick < 0
    || ![state.position, state.velocity, state.spin].every(v => v && [v.x, v.y, v.z].every(Number.isFinite))) {
    throw new Error('continuous aerodynamic evaluation requires an original finite source ball');
  }
  const throughTick = quantizeEventTick(state.tick, elapsedSeconds, parameters.ticksPerSecond);
  const rawTicks = elapsedSeconds * parameters.ticksPerSecond, nearest = Math.round(rawTicks);
  // An explicit clock quotient must share the old integer RK4 partition exactly.
  let remaining = elapsedSeconds === nearest / parameters.ticksPerSecond ? nearest : rawTicks;
  let current: MaterialAerodynamicPitchStateV1 = materialOrientationAtStart === undefined ? state
    : { ...state, materialOrientation: validateBaseballMaterialOrientationV1(materialOrientationAtStart) };
  if (parameters.aerodynamics.seamForce?.coefficientScale) validateBaseballMaterialOrientationV1(current.materialOrientation);
  const integrationStepTicks = resolveAerodynamicIntegrationStepTicksV1(state.spin, parameters);
  while (remaining > 0) {
    const stepTicks = Math.min(integrationStepTicks, remaining);
    current = advanceAerodynamicPitchStep(current, stepTicks, parameters);
    remaining -= stepTicks;
  }
  return { ...current, tick: throughTick };
};

export const sampleAerodynamicPitchTrajectory = (
  trajectory: AerodynamicPitchTrajectory,
  tick: number,
): PitchWorldState => {
  validateTrajectory(trajectory);
  if (
    !Number.isSafeInteger(tick)
    || tick < trajectory.start.tick
    || tick > trajectory.endTick
  ) {
    throw new Error(
      'aerodynamic pitch sample tick must lie inside the trajectory interval',
    );
  }

  return advanceAerodynamicPitchState(
    trajectory.start,
    tick - trajectory.start.tick,
    trajectory.parameters,
    trajectory.parameters.aerodynamics.seamForce?.coefficientScale ? trajectory.releaseOrientation : undefined,
  );
};

export const sampleAerodynamicPitchOrientation = (
  trajectory: AerodynamicPitchTrajectory,
  elapsedSeconds: number,
): Quaternion | undefined => {
  if (trajectory.releaseOrientation === undefined) {
    return undefined;
  }
  if (
    !Number.isFinite(elapsedSeconds)
    || elapsedSeconds < 0
  ) {
    throw new Error(
      'pitch orientation elapsedSeconds must be finite and non-negative',
    );
  }

  if (trajectory.parameters.aerodynamics.seamForce?.coefficientScale) {
    return sampleAerodynamicPitchStateAtElapsedSeconds(trajectory.start, elapsedSeconds, trajectory.parameters, trajectory.releaseOrientation).materialOrientation;
  }

  return advanceBaseballOrientation(
    normalizeQuaternion(
      trajectory.releaseOrientation,
    ),
    trajectory.start.spin,
    elapsedSeconds,
  );
};

const crossedPlate = (
  startZ: number,
  currentZ: number,
  plateZ: number,
): boolean => (
  startZ > plateZ
    ? currentZ <= plateZ
    : currentZ >= plateZ
);

export const findAerodynamicPitchPlateCrossing = (
  trajectory: AerodynamicPitchTrajectory,
  plateZ: number,
): AerodynamicPitchPlateCrossing | null => {
  validateTrajectory(trajectory);
  if (!Number.isFinite(plateZ)) {
    throw new Error('plateZ must be finite');
  }

  if (
    Math.abs(
      trajectory.start.position.z - plateZ,
    ) <= EPSILON
  ) {
    return {
      tick: trajectory.start.tick,
      elapsedSeconds: 0,
      position: {
        ...trajectory.start.position,
        z: plateZ,
      },
      velocity: trajectory.start.velocity,
      spin: trajectory.start.spin,
      spinDecomposition: decomposePitchSpin(
        trajectory.start.velocity,
        trajectory.start.spin,
      ),
      orientation: sampleAerodynamicPitchOrientation(
        trajectory,
        0,
      ),
    };
  }

  const end = sampleAerodynamicPitchTrajectory(
    trajectory,
    trajectory.endTick,
  );

  if (!crossedPlate(
    trajectory.start.position.z,
    end.position.z,
    plateZ,
  )) {
    return null;
  }

  const crossingTick = findFirstTrueTick(
    trajectory.start.tick,
    trajectory.endTick,
    (tick) => {
      const sampled = sampleAerodynamicPitchTrajectory(
        trajectory,
        tick,
      );
      return crossedPlate(
        trajectory.start.position.z,
        sampled.position.z,
        plateZ,
      );
    },
  );

  if (crossingTick === null) {
    return null;
  }

  if (crossingTick === trajectory.start.tick) {
    return {
      tick: crossingTick,
      elapsedSeconds: 0,
      position: {
        ...trajectory.start.position,
        z: plateZ,
      },
      velocity: trajectory.start.velocity,
      spin: trajectory.start.spin,
      spinDecomposition: decomposePitchSpin(
        trajectory.start.velocity,
        trajectory.start.spin,
      ),
      orientation: sampleAerodynamicPitchOrientation(
        trajectory,
        0,
      ),
    };
  }

  const before = sampleAerodynamicPitchTrajectory(
    trajectory,
    crossingTick - 1,
  );
  const after = sampleAerodynamicPitchTrajectory(
    trajectory,
    crossingTick,
  );
  const denominator =
    after.position.z - before.position.z;
  const interpolation =
    Math.abs(denominator) <= EPSILON
      ? 1
      : Math.max(
          0,
          Math.min(
            1,
            (plateZ - before.position.z)
              / denominator,
          ),
        );

  const position = lerpVec3(
    before.position,
    after.position,
    interpolation,
  );
  const velocity = lerpVec3(
    before.velocity,
    after.velocity,
    interpolation,
  );
  const elapsedTicks =
    (crossingTick - 1 - trajectory.start.tick)
    + interpolation;

  return {
    tick: crossingTick,
    elapsedSeconds:
      elapsedTicks
      / trajectory.parameters.ticksPerSecond,
    position: {
      ...position,
      z: plateZ,
    },
    velocity,
    spin: lerpVec3(
      before.spin,
      after.spin,
      interpolation,
    ),
    spinDecomposition: decomposePitchSpin(
      velocity,
      lerpVec3(
        before.spin,
        after.spin,
        interpolation,
      ),
    ),
    orientation: sampleAerodynamicPitchOrientation(
      trajectory,
      elapsedTicks
        / trajectory.parameters.ticksPerSecond,
    ),
  };
};
