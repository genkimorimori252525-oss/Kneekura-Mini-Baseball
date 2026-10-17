import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { createBattedBallInitialStateFromContact, type BatBallContactResult, type BattedBallInitialState } from '../contact/BatBallContact';
import type { AerodynamicPitchTrajectoryParameters } from '../pitching/AerodynamicPitchTrajectory';
import type { BaseballGroundParameters } from './BaseballGroundDynamics';
import type { BattedBallFlightEvidence } from './BattedBallFlightEvidence';
import { createFreeBaseballTrajectory, type FreeBaseballTrajectory } from './FreeBaseballTrajectory';

export const AERO_GROUND_BATTED_FLIGHT_SOURCE_VERSION = 'batted_ball_flight_aero_ground_v1';
export const CONTINUOUS_AERO_GROUND_BATTED_FLIGHT_SOURCE_VERSION = 'batted_ball_flight_aero_ground_continuous_v2';
export const assertLegacyBallPhysicsConsumer = (sourceVersion: string, ballPhysics: unknown, consumer: string): void => {
  if ([AERO_GROUND_BATTED_FLIGHT_SOURCE_VERSION, CONTINUOUS_AERO_GROUND_BATTED_FLIGHT_SOURCE_VERSION].includes(sourceVersion)
    || ballPhysics !== undefined) throw new Error(`unsupported versioned Aero/ground ball consumer: ${consumer}`);
};
export type AeroGroundBallPhysicsV1 = Readonly<{
  kind: 'aero_ground_v1';
  air: AerodynamicPitchTrajectoryParameters;
  ground: BaseballGroundParameters;
}>;

const fields = (value: unknown, required: readonly string[], optional: readonly string[] = []): boolean => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return required.every(key => keys.includes(key)) && keys.every(key => required.includes(key) || optional.includes(key));
};
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

/** Explicit authored physics, never inferred from a desired baseball result.
 * Validation is fresh and descriptor-safe even for a frozen caller object. */
export const createAeroGroundBallPhysicsProfile = (raw: unknown): AeroGroundBallPhysicsV1 => {
  const p = cloneInert(raw) as AeroGroundBallPhysicsV1;
  const air = p?.air, aero = air?.aerodynamics, ground = p?.ground, coefficients = aero?.coefficientProfile;
  if (!fields(p, ['kind', 'air', 'ground']) || p.kind !== 'aero_ground_v1'
    || !fields(air, ['ticksPerSecond', 'integrationStepTicks', 'gravityY', 'aerodynamics'])
    || !fields(aero, ['ballMassKg', 'ballRadiusM', 'airDensityKgM3', 'windVelocityMps', 'dragCoefficient'],
      ['coefficientProfile', 'airKinematicViscosityM2PerSecond', 'spinDecay'])
    || !fields(aero.windVelocityMps, ['x', 'y', 'z'])
    || 'airKinematicViscosityM2PerSecond' in aero && (typeof aero.airKinematicViscosityM2PerSecond !== 'number'
      || !Number.isFinite(aero.airKinematicViscosityM2PerSecond) || aero.airKinematicViscosityM2PerSecond <= 0)
    || !fields(ground, ['radiusM', 'inertiaRatio', 'gravityMps2', 'ticksPerSecond', 'restingVerticalSpeedMps', 'material'])
    || !fields(ground.material, ['restitution', 'slidingFriction', 'rollingDecelerationMps2', 'normalSpinDecayPerSecond'])
    || 'spinDecay' in aero && !fields(aero.spinDecay, ['referenceSpeedMps', 'timeConstantSecondsAtReferenceSpeed'])
    || 'coefficientProfile' in aero && (!fields(coefficients, ['profileId', 'version', 'referenceReynoldsNumber',
      'spinKnots', 'reynoldsKnots', 'reynoldsCorrectionFullThroughSpinFactor', 'reynoldsCorrectionZeroAtSpinFactor'])
      || !Array.isArray(coefficients?.spinKnots) || !Array.isArray(coefficients?.reynoldsKnots)
      || typeof coefficients?.profileId !== 'string' || !coefficients.profileId.length
      || typeof coefficients.version !== 'string' || !coefficients.version.length
      || !coefficients.spinKnots.every(k => fields(k, ['spinFactor', 'dragCoefficientAtReferenceRe', 'liftCoefficient']))
      || !coefficients.reynoldsKnots.every(k => fields(k, ['reynoldsNumber', 'dragCorrectionFactorAtLowSpin'])))) {
    throw new Error('invalid versioned Aero/ground ball physics profile');
  }
  // Exercise both original Core validation paths at a zero-duration floor state.
  // No calibration, material or spin-decay default is supplied at this boundary.
  const ball = { tick: 0, position: { x: 0, y: ground.radiusM, z: 0 },
    velocity: { x: 0, y: 0, z: 0 }, spin: { x: 0, y: 0, z: 0 } };
  createFreeBaseballTrajectory({ initialBall: ball, throughTick: 0, aerodynamics: air, ground });
  return freeze(p);
};

/** One original kernel, rooted at the source ball and integration lattice.
 * Callers must retain this basis when observing a checkpoint: restarting at a
 * sampled observation changes RK4 partitioning and is not source replay. */
export const createVersionedFreeBallTrajectory = (initialBall: BattedBallInitialState, throughTick: number,
  raw: AeroGroundBallPhysicsV1): FreeBaseballTrajectory => {
  const profile = createAeroGroundBallPhysicsProfile(raw);
  return createFreeBaseballTrajectory({ initialBall: cloneInert(initialBall), throughTick,
    aerodynamics: profile.air, ground: profile.ground });
};

export const createAeroGroundBattedBallFlightEvidence = (contact: BatBallContactResult, searchDurationTicks: number,
  raw: AeroGroundBallPhysicsV1): BattedBallFlightEvidence => {
  if (!Number.isSafeInteger(searchDurationTicks) || searchDurationTicks < 0) throw new Error('invalid versioned batted flight horizon');
  const originalContact = cloneInert(contact), initialBall = createBattedBallInitialStateFromContact(originalContact);
  const profile = createAeroGroundBallPhysicsProfile(raw);
  const trajectory = createVersionedFreeBallTrajectory(initialBall, initialBall.tick + searchDurationTicks, profile);
  const first = trajectory.groundContacts[0];
  return freeze({ contact: originalContact, initialBall, ballRadiusMeters: profile.ground.radiusM,
    firstGroundContact: first ? { tick: first.incoming.tick, state: first.incoming } : null });
};
