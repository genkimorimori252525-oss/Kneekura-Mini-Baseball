import type { Vec3 } from '../../model/geometry';

export type BaseballSpinDecayParameters = Readonly<{
  referenceSpeedMps: number;
  timeConstantSecondsAtReferenceSpeed: number;
}>;

/**
 * Nathan 2026 scaling estimate:
 * - 1/e spin-decay time about 20 s at 100 mph;
 * - time constant varies approximately as 1 / air-relative speed.
 *
 * This is deliberately a small aerodynamic torque correction, not a spin-axis
 * precession model and not a seam-shifted-wake force.
 */
export const NATHAN_2026_BASEBALL_SPIN_DECAY_ESTIMATE:
  BaseballSpinDecayParameters = Object.freeze({
    referenceSpeedMps: 44.704,
    timeConstantSecondsAtReferenceSpeed: 20,
  });

const magnitude = (value: Vec3): number =>
  Math.hypot(
    value.x,
    value.y,
    value.z,
  );

const scale = (
  value: Vec3,
  scalar: number,
): Vec3 => ({
  x: value.x * scalar,
  y: value.y * scalar,
  z: value.z * scalar,
});

export const validateBaseballSpinDecayParameters = (
  parameters: BaseballSpinDecayParameters,
): void => {
  if (
    !Number.isFinite(
      parameters.referenceSpeedMps,
    )
    || parameters.referenceSpeedMps <= 0
    || !Number.isFinite(
      parameters
        .timeConstantSecondsAtReferenceSpeed,
    )
    || parameters
      .timeConstantSecondsAtReferenceSpeed
      <= 0
  ) {
    throw new Error(
      'baseball spin-decay reference speed and time constant must be finite and positive',
    );
  }
};

export const calculateBaseballSpinDecayTimeConstantSeconds = (
  airRelativeSpeedMps: number,
  parameters:
    BaseballSpinDecayParameters =
      NATHAN_2026_BASEBALL_SPIN_DECAY_ESTIMATE,
): number => {
  validateBaseballSpinDecayParameters(
    parameters,
  );
  if (
    !Number.isFinite(
      airRelativeSpeedMps,
    )
    || airRelativeSpeedMps < 0
  ) {
    throw new Error(
      'airRelativeSpeedMps must be finite and non-negative',
    );
  }
  if (airRelativeSpeedMps <= 1e-12) {
    return Infinity;
  }

  return (
    parameters
      .timeConstantSecondsAtReferenceSpeed
    * parameters.referenceSpeedMps
    / airRelativeSpeedMps
  );
};

export const calculateBaseballSpinDecayDerivative = (
  spinRadPerSecond: Vec3,
  airRelativeVelocityMps: Vec3,
  parameters:
    BaseballSpinDecayParameters,
): Vec3 => {
  const speed =
    magnitude(
      airRelativeVelocityMps,
    );
  const tau =
    calculateBaseballSpinDecayTimeConstantSeconds(
      speed,
      parameters,
    );

  if (!Number.isFinite(tau)) {
    return {
      x: 0,
      y: 0,
      z: 0,
    };
  }

  return scale(
    spinRadPerSecond,
    -1 / tau,
  );
};

export const advanceBaseballSpinDecay = (
  spinRadPerSecond: Vec3,
  airRelativeSpeedMps: number,
  elapsedSeconds: number,
  parameters:
    BaseballSpinDecayParameters =
      NATHAN_2026_BASEBALL_SPIN_DECAY_ESTIMATE,
): Vec3 => {
  if (
    !Number.isFinite(elapsedSeconds)
    || elapsedSeconds < 0
  ) {
    throw new Error(
      'spin-decay elapsedSeconds must be finite and non-negative',
    );
  }

  const tau =
    calculateBaseballSpinDecayTimeConstantSeconds(
      airRelativeSpeedMps,
      parameters,
    );
  if (!Number.isFinite(tau)) {
    return spinRadPerSecond;
  }

  return scale(
    spinRadPerSecond,
    Math.exp(
      -elapsedSeconds / tau,
    ),
  );
};
