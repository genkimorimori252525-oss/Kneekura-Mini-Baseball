import type { CanonicalWorldSnapshot } from '../../core/model/CanonicalWorldSnapshot';
import { REFERENCE_BASEBALL_AERODYNAMICS, calculateBaseballAerodynamics, type BaseballAerodynamicsParameters } from '../../core/sim/ball/BaseballAerodynamics';
import { REALISTIC_BASEBALL_RIGID_BODY, type RigidBatPhysicalProperties } from '../../core/sim/contact/RigidBatBallContact';
import { createSwingKinematicsTrajectoryV1 } from '../../core/sim/contact/SwingKinematicsV1';
import { createRigidBatSwingWindowFromKinematicsV1 } from '../../core/sim/pitching/AerodynamicRigidBatSwingingPitchPhysicalResult';
import { findAerodynamicPitchPlateCrossing, type AerodynamicPitchTrajectory } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import type { AerodynamicRigidPitchAgainstBatterInput } from '../../core/sim/pitching/AerodynamicRigidPitchAgainstBatter';
import type { NativeAerodynamicPhysicalPitchSource } from './NativeAerodynamicSession';
import { DeterministicRng, fnv1a32 } from '../../core/rng/DeterministicRng';

/**
 * EXHIBITION PHYSICS FIXTURE ONLY. It is deliberately NOT the uncalibrated
 * NLB pitcher Tikao, Dodgers Ohtani, their scouting, catcher leadership, or
 * official multi-actor game. The user explicitly chooses the reference course,
 * and the existing real Aero/Rigid Core decides physical ball and contact.
 */
export type NativeAerodynamicReferenceFixtureInput = Readonly<{
  actorsAtTick: (tick: number) => Pick<CanonicalWorldSnapshot, 'defenders' | 'runners'>;
  pitchSpeedMps: number;
  batterAction: 'take' | 'swing';
  /**
   * Genuine Aero RK4 source parameter, rad/s in world coordinates. This
   * changes physical Magnus/spin-decay calculations, NOT just the sprite.
   * Reference comparison only: no actual pitcher rating implied.
   */
  spinVectorRadPerSec?: Readonly<{ x: number; y: number; z: number }>;
  /** Fixture-authored material starting pose (NOT inferred from RPM). */
  releaseOrientation?: Readonly<{ w: number; x: number; y: number; z: number }>;
  /** Explicit intended contact band along the same rigid bat, measured from
   * grip to tip. Omitted preserves the old comparison fixture byte-for-byte. */
  sweetSpotBand?: Readonly<{ minimumT: number; maximumT: number }>;
  /** Controlled contact experiment only: target the physically calculated
   * plate course instead of the legacy arbitrary fixed reference swing.
   * This is not a production batter perception or batting-ability model. */
  aimAtPlate?: boolean;
  /** Same explicit force/torque profile for this pitch and its continuation. */
  aerodynamics?: BaseballAerodynamicsParameters;
}>;

/** Input fixture for the real rigid-body contact resolver, not a player ability. */
const REFERENCE_BAT: RigidBatPhysicalProperties = Object.freeze({
  massKg: 0.9,
  centerOfMassT: 0.6,
  transverseMomentOfInertiaKgM2: 0.06,
  axialMomentOfInertiaKgM2: 0.00055,
  radiusProfile: { knots: [{ t: 0, radiusM: 0.033 }, { t: 1, radiusM: 0.033 }] },
});

/** Fixed explicit speed and physical constants: no hidden "win" or "hit" logic. */
export function createReferenceAerodynamicPhysicalSource(
  spec: NativeAerodynamicReferenceFixtureInput,
): NativeAerodynamicPhysicalPitchSource {
  if (!Number.isFinite(spec.pitchSpeedMps) || spec.pitchSpeedMps <= 0
    || spec.pitchSpeedMps > 151 / 3.6
    || (spec.batterAction !== 'take' && spec.batterAction !== 'swing')
    || typeof spec.actorsAtTick !== 'function') {
    throw new Error('Reference aerodynamic fixture requires explicit speed <= 151 km/h, actors and action.');
  }
  if (spec.spinVectorRadPerSec !== undefined
    && (![spec.spinVectorRadPerSec.x,spec.spinVectorRadPerSec.y,spec.spinVectorRadPerSec.z]
      .every(Number.isFinite)
      || Math.hypot(spec.spinVectorRadPerSec.x, spec.spinVectorRadPerSec.y,
        spec.spinVectorRadPerSec.z) > 5000 * 2 * Math.PI / 60)) {
    throw new Error('Reference aerodynamic spin requires finite source angular velocity <= 5000rpm.');
  }
  if (spec.releaseOrientation !== undefined
    && (![spec.releaseOrientation.w,spec.releaseOrientation.x,
      spec.releaseOrientation.y,spec.releaseOrientation.z].every(Number.isFinite)
      || Math.hypot(spec.releaseOrientation.w,spec.releaseOrientation.x,
        spec.releaseOrientation.y,spec.releaseOrientation.z) < 1e-10)) {
    throw new Error('Reference aerodynamic seam release orientation must be a valid quaternion.');
  }
  if (spec.sweetSpotBand !== undefined
    && (!Number.isFinite(spec.sweetSpotBand.minimumT) || !Number.isFinite(spec.sweetSpotBand.maximumT)
      || spec.sweetSpotBand.minimumT <= 0 || spec.sweetSpotBand.maximumT >= 1
      || spec.sweetSpotBand.minimumT > spec.sweetSpotBand.maximumT)) {
    throw new Error('Reference sweet-spot band must be ordered and inside the rigid bat');
  }
  if (spec.aimAtPlate !== undefined && typeof spec.aimAtPlate !== 'boolean') {
    throw new Error('Reference plate-aim option must be boolean');
  }
  const aerodynamicProfile = spec.aerodynamics ?? REFERENCE_BASEBALL_AERODYNAMICS;
  if (aerodynamicProfile.ballMassKg !== REALISTIC_BASEBALL_RIGID_BODY.massKg
    || aerodynamicProfile.ballRadiusM !== REALISTIC_BASEBALL_RIGID_BODY.radiusM) {
    throw new Error('Reference flight and rigid contact must use the same physical baseball');
  }
  calculateBaseballAerodynamics({ x: 0, y: 0, z: -spec.pitchSpeedMps },
    spec.spinVectorRadPerSec ?? { x: 15, y: 65, z: 0 }, aerodynamicProfile);
  return context => {
    const { pitcher, batter } = context.commandSession.command;
    const startTick = Math.max(
      context.lastEventTick + 100_000,
      (context.previousFlightEndTick ?? 0) + 100_000,
    );
    // These are REFERENCE shooting inputs, not a rating-derived command model.
    const sign = pitcher.attackZone === 'outside' ? -1 : pitcher.attackZone === 'inside' ? 1 : 0;
    const xSpeed = sign * 0.45;
    const ySpeed = pitcher.verticalPlan === 'high' ? 2.0
      : pitcher.verticalPlan === 'middle' ? 1.1 : 0.3;
    const yOffset = pitcher.aggression === 'waste' ? 0.7 : 0;
    const trajectory: AerodynamicPitchTrajectory = {
      start: {
        tick: startTick,
        position: { x: 0, y: 1.7 + yOffset, z: 18 },
        velocity: { x: xSpeed, y: ySpeed, z: -spec.pitchSpeedMps },
        spin: spec.spinVectorRadPerSec ?? { x: 15, y: 65, z: 0 },
      },
      ...(spec.releaseOrientation !== undefined
        ? { releaseOrientation: spec.releaseOrientation }
        : {}),
      endTick: startTick + 700_000,
      parameters: {
        ticksPerSecond: 1_000_000,
        integrationStepTicks: 500,
        gravityY: -9.81,
        aerodynamics: aerodynamicProfile,
      },
    };

    let pitch: AerodynamicRigidPitchAgainstBatterInput;
    if (spec.batterAction === 'take' || batter.approach === 'take') {
      pitch = {
        action: { kind: 'take' },
        trajectory,
        plateZ: 0,
        strikeZone: { centerX: 0, halfWidth: 0.2159, lowerY: 0.55, upperY: 1.5 },
        ballRadiusMeters: REALISTIC_BASEBALL_RIGID_BODY.radiusM,
      };
    } else {
      const crossing = spec.aimAtPlate ? findAerodynamicPitchPlateCrossing(trajectory, 0) : null;
      if (spec.aimAtPlate && !crossing) throw new Error('Reference plate aim requires an actual course crossing');
      const midpoint = crossing?.tick ?? startTick + 470_000;
      const intended = crossing?.position ?? { x: 0.08, y: 0.95, z: 0 };
      const smoothSwing = createSwingKinematicsTrajectoryV1({
        startTick: midpoint - 75_000,
        contactTick: midpoint,
        endTick: midpoint + 65_000,
        ticksPerSecond: 1_000_000,
        batLengthM: 0.84,
        sweetSpotT: spec.sweetSpotBand === undefined ? 0.5
          : spec.sweetSpotBand.minimumT + (spec.sweetSpotBand.maximumT - spec.sweetSpotBand.minimumT)
            * new DeterministicRng(fnv1a32(`${context.commandSession.matchSeed}:${context.commandSession.playId}:${context.ordinal}:sweet-spot`)).nextFloat(),
        start: {
          sweetSpotPosition: crossing ? { x: intended.x - 0.18, y: intended.y, z: intended.z + 0.45 }
            : { x: -0.1, y: 0.95, z: 0.45 },
          sweetSpotVelocity: { x: 0, y: 0, z: -1 },
          batAxis: { x: 1, y: 0, z: 0 },
        },
        contact: {
          sweetSpotPosition: intended,
          sweetSpotVelocity: { x: 8, y: 0, z: -2 },
          batAxis: { x: 1, y: 0, z: 0 },
        },
        finish: {
          sweetSpotPosition: crossing ? { x: intended.x + 0.37, y: intended.y + 0.05, z: intended.z - 0.3 }
            : { x: 0.45, y: 1.0, z: -0.3 },
          sweetSpotVelocity: { x: 3, y: 0, z: 0 },
          batAxis: { x: 0, y: 0, z: 1 },
        },
      });
      pitch = {
        action: {
          kind: 'swing',
          swing: createRigidBatSwingWindowFromKinematicsV1(smoothSwing, REFERENCE_BAT),
        },
        trajectory,
        ball: REALISTIC_BASEBALL_RIGID_BODY,
        parameterResolver: () => ({
          normalRestitution: 0.5, tangentialRestitution: 0.3, frictionCoefficient: 0.2,
        }),
      };
    }
    return { pitch, actorsAtTick: spec.actorsAtTick };
  };
}
