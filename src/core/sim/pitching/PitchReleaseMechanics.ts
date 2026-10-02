import type { Vec3 } from '../../model/geometry';
import type { PitchWorldState } from '../contact/BatBallContact';
import type { RigidBaseballProperties } from '../contact/RigidBatBallContact';
import {
  normalizeQuaternion,
  rotateVectorByQuaternion,
  type Quaternion,
} from './BaseballOrientation';

export type PitchFingerImpulse = Readonly<{
  fingerId: string;
  /**
   * Unit vector from the ball center to the finger contact location in the
   * ball/material frame. Grip relative to the seams is therefore explicit.
   */
  contactDirectionBody: Vec3;
  /**
   * Time-integrated world-space force applied by the hand to the ball.
   * Units: N*s.
   */
  impulseWorldNs: Vec3;
}>;

export type PitchFingerForcePulse = Readonly<{
  fingerId: string;
  contactDirectionBody: Vec3;
  averageForceWorldN: Vec3;
  durationSeconds: number;
}>;

export type PitchReleaseMechanicsInput = Readonly<{
  tick: number;
  position: Vec3;
  preReleaseVelocity: Vec3;
  preReleaseSpin: Vec3;
  orientation: Quaternion;
  ball: RigidBaseballProperties;
  fingerImpulses: readonly PitchFingerImpulse[];
}>;

export type AppliedPitchFingerImpulse = Readonly<{
  fingerId: string;
  contactPointWorld: Vec3;
  leverArmWorld: Vec3;
  impulseWorldNs: Vec3;
  angularImpulseWorldNms: Vec3;
}>;

export type PitchReleaseMechanicsResult = Readonly<{
  state: PitchWorldState;
  orientation: Quaternion;
  totalLinearImpulseNs: Vec3;
  totalAngularImpulseNms: Vec3;
  appliedFingerImpulses: readonly AppliedPitchFingerImpulse[];
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

const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

const magnitude = (value: Vec3): number =>
  Math.hypot(value.x, value.y, value.z);

const validateFiniteVec3 = (
  name: string,
  value: Vec3,
): void => {
  if (
    !Number.isFinite(value.x)
    || !Number.isFinite(value.y)
    || !Number.isFinite(value.z)
  ) {
    throw new Error(`${name} must contain finite values`);
  }
};

const validateBall = (
  ball: RigidBaseballProperties,
): void => {
  if (!Number.isFinite(ball.massKg) || ball.massKg <= 0) {
    throw new Error('release ball massKg must be finite and positive');
  }
  if (!Number.isFinite(ball.radiusM) || ball.radiusM <= 0) {
    throw new Error('release ball radiusM must be finite and positive');
  }
  if (
    !Number.isFinite(ball.rotationalInertiaFactor)
    || ball.rotationalInertiaFactor <= 0
  ) {
    throw new Error(
      'release ball rotationalInertiaFactor must be finite and positive',
    );
  }
};

const normalizeDirection = (
  value: Vec3,
): Vec3 => {
  validateFiniteVec3(
    'finger contactDirectionBody',
    value,
  );
  const length = magnitude(value);
  if (length <= EPSILON) {
    throw new Error(
      'finger contactDirectionBody must be non-zero',
    );
  }
  return scale(value, 1 / length);
};

export const createPitchFingerImpulseFromForcePulse = (
  pulse: PitchFingerForcePulse,
): PitchFingerImpulse => {
  validateFiniteVec3(
    'finger averageForceWorldN',
    pulse.averageForceWorldN,
  );
  if (
    !Number.isFinite(pulse.durationSeconds)
    || pulse.durationSeconds < 0
  ) {
    throw new Error(
      'finger force-pulse durationSeconds must be finite and non-negative',
    );
  }

  return {
    fingerId: pulse.fingerId,
    contactDirectionBody:
      pulse.contactDirectionBody,
    impulseWorldNs: scale(
      pulse.averageForceWorldN,
      pulse.durationSeconds,
    ),
  };
};

/**
 * Reduced-order release mechanics.
 *
 * Finger forces are integrated into impulses before this boundary. Each
 * off-center impulse changes both the ball's linear momentum and angular
 * momentum:
 *
 *   Δv = J / m
 *   Δω = I^-1 (r × J)
 *
 * No finger/ball deformation state is introduced.
 */
export const resolvePitchReleaseMechanics = (
  input: PitchReleaseMechanicsInput,
): PitchReleaseMechanicsResult => {
  if (!Number.isSafeInteger(input.tick) || input.tick < 0) {
    throw new Error(
      'pitch release tick must be a non-negative safe integer',
    );
  }
  validateFiniteVec3(
    'pitch release position',
    input.position,
  );
  validateFiniteVec3(
    'pitch preReleaseVelocity',
    input.preReleaseVelocity,
  );
  validateFiniteVec3(
    'pitch preReleaseSpin',
    input.preReleaseSpin,
  );
  validateBall(input.ball);

  const orientation = normalizeQuaternion(
    input.orientation,
  );
  const rotationalInertiaKgM2 =
    input.ball.rotationalInertiaFactor
    * input.ball.massKg
    * input.ball.radiusM
    * input.ball.radiusM;

  let totalLinearImpulseNs: Vec3 = {
    x: 0,
    y: 0,
    z: 0,
  };
  let totalAngularImpulseNms: Vec3 = {
    x: 0,
    y: 0,
    z: 0,
  };
  const applied: AppliedPitchFingerImpulse[] = [];

  for (const finger of input.fingerImpulses) {
    validateFiniteVec3(
      'finger impulseWorldNs',
      finger.impulseWorldNs,
    );
    const bodyDirection = normalizeDirection(
      finger.contactDirectionBody,
    );
    const worldDirection = rotateVectorByQuaternion(
      bodyDirection,
      orientation,
    );
    const leverArmWorld = scale(
      worldDirection,
      input.ball.radiusM,
    );
    const contactPointWorld = add(
      input.position,
      leverArmWorld,
    );
    const angularImpulseWorldNms = cross(
      leverArmWorld,
      finger.impulseWorldNs,
    );

    totalLinearImpulseNs = add(
      totalLinearImpulseNs,
      finger.impulseWorldNs,
    );
    totalAngularImpulseNms = add(
      totalAngularImpulseNms,
      angularImpulseWorldNms,
    );
    applied.push({
      fingerId: finger.fingerId,
      contactPointWorld,
      leverArmWorld,
      impulseWorldNs: finger.impulseWorldNs,
      angularImpulseWorldNms,
    });
  }

  const velocity = add(
    input.preReleaseVelocity,
    scale(
      totalLinearImpulseNs,
      1 / input.ball.massKg,
    ),
  );
  const spin = add(
    input.preReleaseSpin,
    scale(
      totalAngularImpulseNms,
      1 / rotationalInertiaKgM2,
    ),
  );

  return {
    state: {
      tick: input.tick,
      position: input.position,
      velocity,
      spin,
    },
    orientation,
    totalLinearImpulseNs,
    totalAngularImpulseNms,
    appliedFingerImpulses: applied,
  };
};
