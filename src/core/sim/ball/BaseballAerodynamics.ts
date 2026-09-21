import type { Vec3 } from '../../model/geometry';
import {
  LYU_2022_SEAM_AVERAGED_AERO_PROFILE,
  resolveBaseballAerodynamicCoefficients,
  validateBaseballAerodynamicCoefficientProfile,
  type BaseballAerodynamicCoefficientProfile,
} from './BaseballAerodynamicCoefficientProfile';

export type BaseballAerodynamicsParameters = Readonly<{
  ballMassKg: number;
  ballRadiusM: number;
  airDensityKgM3: number;
  windVelocityMps: Vec3;
  dragCoefficient: number;
  /**
   * Optional empirical coefficient profile. When absent, the frozen constant
   * drag + Nathan/Sawicki lift path is preserved.
   */
  coefficientProfile?: BaseballAerodynamicCoefficientProfile;
  /**
   * Needed only by Reynolds-aware coefficient profiles.
   */
  airKinematicViscosityM2PerSecond?: number;
}>;

/**
 * Reference sea-level baseball aerodynamics.
 *
 * This is deliberately an empirical baseball model, not a smooth-sphere model:
 * - mass/radius are regulation-baseball scale;
 * - Cd=0.35 is a representative measured baseball value;
 * - lift uses the Nathan/Sawicki spin-parameter relation in
 *   calculateBaseballLiftCoefficient().
 *
 * Ball-to-ball, seam-orientation, speed, weather and stadium variation should
 * be represented by explicit parameter changes rather than renderer-side fudge.
 */
export const REFERENCE_BASEBALL_AERODYNAMICS: BaseballAerodynamicsParameters =
  Object.freeze({
    ballMassKg: 0.145,
    ballRadiusM: 0.0366,
    airDensityKgM3: 1.225,
    windVelocityMps: Object.freeze({ x: 0, y: 0, z: 0 }),
    dragCoefficient: 0.35,
  });

export const REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS:
  BaseballAerodynamicsParameters =
  Object.freeze({
    ...REFERENCE_BASEBALL_AERODYNAMICS,
    coefficientProfile:
      LYU_2022_SEAM_AVERAGED_AERO_PROFILE,
    airKinematicViscosityM2PerSecond:
      1.5e-5,
  });

const EPSILON = 1e-12;

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

const dot = (a: Vec3, b: Vec3): number =>
  a.x * b.x + a.y * b.y + a.z * b.z;

const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

const magnitude = (value: Vec3): number =>
  Math.hypot(value.x, value.y, value.z);

const validateParameters = (
  parameters: BaseballAerodynamicsParameters,
): void => {
  if (!Number.isFinite(parameters.ballMassKg) || parameters.ballMassKg <= 0) {
    throw new Error('ballMassKg must be finite and positive');
  }
  if (!Number.isFinite(parameters.ballRadiusM) || parameters.ballRadiusM <= 0) {
    throw new Error('ballRadiusM must be finite and positive');
  }
  if (
    !Number.isFinite(parameters.airDensityKgM3)
    || parameters.airDensityKgM3 < 0
  ) {
    throw new Error('airDensityKgM3 must be finite and non-negative');
  }
  if (
    !Number.isFinite(parameters.dragCoefficient)
    || parameters.dragCoefficient < 0
  ) {
    throw new Error('dragCoefficient must be finite and non-negative');
  }
  if (
    parameters.coefficientProfile
    !== undefined
  ) {
    validateBaseballAerodynamicCoefficientProfile(
      parameters.coefficientProfile,
    );
    if (
      !Number.isFinite(
        parameters
          .airKinematicViscosityM2PerSecond,
      )
      || (
        parameters
          .airKinematicViscosityM2PerSecond
        ?? 0
      ) <= 0
    ) {
      throw new Error(
        'airKinematicViscosityM2PerSecond must be finite and positive when coefficientProfile is enabled',
      );
    }
  }
  for (const component of [
    parameters.windVelocityMps.x,
    parameters.windVelocityMps.y,
    parameters.windVelocityMps.z,
  ]) {
    if (!Number.isFinite(component)) {
      throw new Error('windVelocityMps must contain only finite values');
    }
  }
};

/**
 * Empirical lift coefficient used in baseball trajectory work.
 *
 * S = R * omega_perpendicular / v
 * CL = 1.5 S                  for S <= 0.1
 * CL = 0.09 + 0.6 S           for S > 0.1
 */
export const calculateBaseballLiftCoefficient = (
  spinFactor: number,
): number => {
  if (!Number.isFinite(spinFactor) || spinFactor < 0) {
    throw new Error('spinFactor must be finite and non-negative');
  }
  return spinFactor <= 0.1
    ? 1.5 * spinFactor
    : 0.09 + 0.6 * spinFactor;
};

export type BaseballAerodynamicState = Readonly<{
  relativeAirVelocity: Vec3;
  activeSpin: Vec3;
  spinFactor: number;
  reynoldsNumber: number | null;
  dragCoefficientUsed: number;
  liftCoefficientUsed: number;
  dragAcceleration: Vec3;
  liftAcceleration: Vec3;
  totalAcceleration: Vec3;
}>;

export const calculateBaseballAerodynamics = (
  ballVelocityMps: Vec3,
  ballSpinRadPerSecond: Vec3,
  parameters: BaseballAerodynamicsParameters =
    REFERENCE_BASEBALL_AERODYNAMICS,
): BaseballAerodynamicState => {
  validateParameters(parameters);

  const relativeAirVelocity = subtract(
    ballVelocityMps,
    parameters.windVelocityMps,
  );
  const speed = magnitude(relativeAirVelocity);

  if (speed <= EPSILON || parameters.airDensityKgM3 <= EPSILON) {
    const zero = { x: 0, y: 0, z: 0 } as const;
    return {
      relativeAirVelocity,
      activeSpin: zero,
      spinFactor: 0,
      reynoldsNumber: null,
      dragCoefficientUsed:
        parameters.dragCoefficient,
      liftCoefficientUsed: 0,
      dragAcceleration: zero,
      liftAcceleration: zero,
      totalAcceleration: zero,
    };
  }

  const velocityHat = scale(relativeAirVelocity, 1 / speed);
  const parallelSpin = scale(
    velocityHat,
    dot(ballSpinRadPerSecond, velocityHat),
  );
  const activeSpin = subtract(ballSpinRadPerSecond, parallelSpin);
  const activeSpinMagnitude = magnitude(activeSpin);
  const spinFactor =
    parameters.ballRadiusM * activeSpinMagnitude / speed;

  const area = Math.PI * parameters.ballRadiusM * parameters.ballRadiusM;
  const dynamicAccelerationScale =
    0.5
    * parameters.airDensityKgM3
    * area
    * speed
    * speed
    / parameters.ballMassKg;

  const reynoldsNumber =
    parameters.coefficientProfile
    === undefined
      ? null
      : (
          speed
          * (
            2
            * parameters.ballRadiusM
          )
          / parameters
            .airKinematicViscosityM2PerSecond!
        );

  const resolvedCoefficients =
    parameters.coefficientProfile
    === undefined
      ? {
          dragCoefficient:
            parameters.dragCoefficient,
          liftCoefficient:
            calculateBaseballLiftCoefficient(
              spinFactor,
            ),
        }
      : resolveBaseballAerodynamicCoefficients(
          parameters.coefficientProfile,
          reynoldsNumber!,
          spinFactor,
        );

  const dragAcceleration = scale(
    velocityHat,
    -dynamicAccelerationScale
      * resolvedCoefficients
        .dragCoefficient,
  );

  let liftAcceleration: Vec3 = { x: 0, y: 0, z: 0 };
  if (activeSpinMagnitude > EPSILON) {
    // Nathan convention: Magnus direction is omega-hat x v-hat.
    const liftDirectionRaw = cross(activeSpin, velocityHat);
    const liftDirectionMagnitude = magnitude(liftDirectionRaw);
    if (liftDirectionMagnitude > EPSILON) {
      liftAcceleration = scale(
        liftDirectionRaw,
        dynamicAccelerationScale
          * resolvedCoefficients
            .liftCoefficient
          / liftDirectionMagnitude,
      );
    }
  }

  return {
    relativeAirVelocity,
    activeSpin,
    spinFactor,
    reynoldsNumber,
    dragCoefficientUsed:
      resolvedCoefficients
        .dragCoefficient,
    liftCoefficientUsed:
      resolvedCoefficients
        .liftCoefficient,
    dragAcceleration,
    liftAcceleration,
    totalAcceleration: add(dragAcceleration, liftAcceleration),
  };
};
