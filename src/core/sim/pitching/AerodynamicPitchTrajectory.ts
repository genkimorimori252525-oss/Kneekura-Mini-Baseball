import type { Vec3 } from '../../model/geometry';
import type { PitchWorldState } from '../contact/BatBallContact';
import {
  calculateBaseballAerodynamics,
  type BaseballAerodynamicsParameters,
} from '../ball/BaseballAerodynamics';
import {
  findFirstTrueTick,
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
): Vec3 => {
  const aerodynamic = calculateBaseballAerodynamics(
    velocity,
    spin,
    parameters.aerodynamics,
  );

  return {
    x: aerodynamic.totalAcceleration.x,
    y: aerodynamic.totalAcceleration.y
      + parameters.gravityY,
    z: aerodynamic.totalAcceleration.z,
  };
};

const advanceAerodynamicPitchStep = (
  state: PitchWorldState,
  stepTicks: number,
  parameters: AerodynamicPitchTrajectoryParameters,
): PitchWorldState => {
  const dt = stepTicks / parameters.ticksPerSecond;

  const k1Position = state.velocity;
  const k1Velocity = accelerationAt(
    state.velocity,
    state.spin,
    parameters,
  );

  const k2VelocityInput = add(
    state.velocity,
    scale(k1Velocity, dt / 2),
  );
  const k2Position = k2VelocityInput;
  const k2Velocity = accelerationAt(
    k2VelocityInput,
    state.spin,
    parameters,
  );

  const k3VelocityInput = add(
    state.velocity,
    scale(k2Velocity, dt / 2),
  );
  const k3Position = k3VelocityInput;
  const k3Velocity = accelerationAt(
    k3VelocityInput,
    state.spin,
    parameters,
  );

  const k4VelocityInput = add(
    state.velocity,
    scale(k3Velocity, dt),
  );
  const k4Position = k4VelocityInput;
  const k4Velocity = accelerationAt(
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
    // Current evidence supports treating the spin axis as nearly inertially
    // fixed through an ordinary pitch. Do not manufacture precession here.
    spin: state.spin,
  };
};

export const advanceAerodynamicPitchState = (
  state: PitchWorldState,
  deltaTicks: number,
  parameters: AerodynamicPitchTrajectoryParameters,
): PitchWorldState => {
  validateParameters(parameters);
  if (!Number.isSafeInteger(deltaTicks) || deltaTicks < 0) {
    throw new Error(
      'aerodynamic pitch deltaTicks must be a non-negative safe integer',
    );
  }

  let current = state;
  let remaining = deltaTicks;

  while (remaining > 0) {
    const stepTicks = Math.min(
      parameters.integrationStepTicks,
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
    spin: trajectory.start.spin,
    spinDecomposition: decomposePitchSpin(
      velocity,
      trajectory.start.spin,
    ),
    orientation: sampleAerodynamicPitchOrientation(
      trajectory,
      elapsedTicks
        / trajectory.parameters.ticksPerSecond,
    ),
  };
};
