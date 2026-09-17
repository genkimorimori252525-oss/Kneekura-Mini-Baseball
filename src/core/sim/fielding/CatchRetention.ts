import type { Vec3 } from '../../model/geometry';
import { quantizeEventTick } from '../ExactEventTime';
import {
  createSecuredCatchOutcome,
  type CatchOutcome,
} from './CatchOutcome';
import type { GloveWorldState, LiveBallState } from './GloveBallContact';

export type CatchRetentionContact = Readonly<{
  contactTick: number;
  ball: LiveBallState;
  glove: GloveWorldState;
  /** Unit-length outward normal from glove toward ball at physical contact. */
  contactNormal: Vec3;
  /** Distance from the effective pocket center supplied by glove/body geometry. */
  pocketOffsetMeters: number;
  /** Pose/body-control stability in [0, 1], supplied by the body model. */
  bodyStability: number;
}>;

export type CatchRetentionParameters = Readonly<{
  ticksPerSecond: number;
  ballMassKg: number;
  ballRadiusMeters: number;
  pocketRadiusMeters: number;
  /** Maximum absorbable contact energy for a centered, fully stable catch attempt. */
  centerRetentionCapacityJ: number;
  /** Effective rate at which a retained ball/glove system dissipates capture energy. */
  captureDissipationPowerW: number;
  failedContactRestitution: number;
  failedTangentialDamping: number;
  failedSpinDamping: number;
}>;

export type CatchRetentionLoadDiagnostics = Readonly<{
  relativeVelocity: Vec3;
  translationalEnergyJ: number;
  rotationalEnergyJ: number;
  retentionLoadJ: number;
  pocketFactor: number;
  effectiveCapacityJ: number;
}>;

export type CatchRetentionResolution = Readonly<{
  outcome: CatchOutcome;
  diagnostics: CatchRetentionLoadDiagnostics;
}>;

const isFiniteNumber = (value: number): boolean => Number.isFinite(value);

const isFiniteVec3 = (value: Vec3): boolean =>
  isFiniteNumber(value.x) && isFiniteNumber(value.y) && isFiniteNumber(value.z);

const magnitudeSquared = (value: Vec3): number =>
  value.x * value.x + value.y * value.y + value.z * value.z;

const subtract = (first: Vec3, second: Vec3): Vec3 => ({
  x: first.x - second.x,
  y: first.y - second.y,
  z: first.z - second.z,
});

const validateUnitInterval = (value: number, name: string): void => {
  if (!isFiniteNumber(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be a finite number in [0, 1]`);
  }
};

const validateParameters = (parameters: CatchRetentionParameters): void => {
  if (!Number.isInteger(parameters.ticksPerSecond) || parameters.ticksPerSecond <= 0) {
    throw new Error('ticksPerSecond must be a positive integer');
  }

  const positiveParameters: ReadonlyArray<readonly [number, string]> = [
    [parameters.ballMassKg, 'ballMassKg'],
    [parameters.ballRadiusMeters, 'ballRadiusMeters'],
    [parameters.pocketRadiusMeters, 'pocketRadiusMeters'],
    [parameters.centerRetentionCapacityJ, 'centerRetentionCapacityJ'],
    [parameters.captureDissipationPowerW, 'captureDissipationPowerW'],
  ];

  for (const [value, name] of positiveParameters) {
    if (!isFiniteNumber(value) || value <= 0) {
      throw new Error(`${name} must be a finite positive number`);
    }
  }

  validateUnitInterval(parameters.failedContactRestitution, 'failedContactRestitution');
  validateUnitInterval(parameters.failedTangentialDamping, 'failedTangentialDamping');
  validateUnitInterval(parameters.failedSpinDamping, 'failedSpinDamping');
};

const validateContact = (contact: CatchRetentionContact): void => {
  if (!Number.isSafeInteger(contact.contactTick) || contact.contactTick < 0) {
    throw new Error('contactTick must be a non-negative safe integer tick');
  }
  if (contact.ball.tick !== contact.contactTick || contact.glove.tick !== contact.contactTick) {
    throw new Error('ball and glove states must be sampled at contactTick');
  }
  if (!isFiniteVec3(contact.ball.velocity) || !isFiniteVec3(contact.ball.spin) ||
      !isFiniteVec3(contact.glove.velocity) || !isFiniteVec3(contact.contactNormal)) {
    throw new Error('catch retention vectors must contain finite components');
  }
  if (!isFiniteNumber(contact.pocketOffsetMeters) || contact.pocketOffsetMeters < 0) {
    throw new Error('pocketOffsetMeters must be a finite non-negative number');
  }
  validateUnitInterval(contact.bodyStability, 'bodyStability');
};

/**
 * Computes a deterministic, physically interpretable retention load.
 *
 * The load is the ball's translational kinetic energy relative to the glove plus the
 * rotational kinetic energy of a solid sphere. Effective retention capacity is reduced
 * by body instability and by moving away from the center of an effective hemispherical
 * glove pocket. No random draw or direct catch-success percentage is used here.
 */
export const evaluateCatchRetentionLoad = (
  contact: CatchRetentionContact,
  parameters: CatchRetentionParameters,
): CatchRetentionLoadDiagnostics => {
  validateContact(contact);
  validateParameters(parameters);

  const relativeVelocity = subtract(contact.ball.velocity, contact.glove.velocity);
  const translationalEnergyJ =
    0.5 * parameters.ballMassKg * magnitudeSquared(relativeVelocity);

  const sphereInertia =
    (2 / 5) * parameters.ballMassKg * parameters.ballRadiusMeters * parameters.ballRadiusMeters;
  const rotationalEnergyJ = 0.5 * sphereInertia * magnitudeSquared(contact.ball.spin);
  const retentionLoadJ = translationalEnergyJ + rotationalEnergyJ;

  const normalizedOffset = contact.pocketOffsetMeters / parameters.pocketRadiusMeters;
  const pocketFactor = normalizedOffset >= 1
    ? 0
    : Math.sqrt(Math.max(0, 1 - normalizedOffset * normalizedOffset));
  const effectiveCapacityJ =
    parameters.centerRetentionCapacityJ * contact.bodyStability * pocketFactor;

  return {
    relativeVelocity,
    translationalEnergyJ,
    rotationalEnergyJ,
    retentionLoadJ,
    pocketFactor,
    effectiveCapacityJ,
  };
};

/**
 * Resolves the secure-possession path from retention energy and dissipation rate.
 * Failed-retention live-ball deflection is intentionally added by the next TDD slice.
 */
export const resolveCatchRetention = (
  contact: CatchRetentionContact,
  parameters: CatchRetentionParameters,
): CatchRetentionResolution => {
  const diagnostics = evaluateCatchRetentionLoad(contact, parameters);

  if (diagnostics.retentionLoadJ <= diagnostics.effectiveCapacityJ) {
    const settleSeconds = diagnostics.retentionLoadJ / parameters.captureDissipationPowerW;
    const secureTick = quantizeEventTick(
      contact.contactTick,
      settleSeconds,
      parameters.ticksPerSecond,
    );

    return {
      outcome: createSecuredCatchOutcome(contact.contactTick, secureTick),
      diagnostics,
    };
  }

  throw new Error('failed catch retention resolution is not implemented yet');
};
