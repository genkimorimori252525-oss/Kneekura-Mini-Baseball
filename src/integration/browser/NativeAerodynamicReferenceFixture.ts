import type { CanonicalWorldSnapshot } from '../../core/model/CanonicalWorldSnapshot';
import { REFERENCE_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { REALISTIC_BASEBALL_RIGID_BODY, type RigidBatPhysicalProperties } from '../../core/sim/contact/RigidBatBallContact';
import { createSwingKinematicsTrajectoryV1 } from '../../core/sim/contact/SwingKinematicsV1';
import { createRigidBatSwingWindowFromKinematicsV1 } from '../../core/sim/pitching/AerodynamicRigidBatSwingingPitchPhysicalResult';
import type { AerodynamicPitchTrajectory } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import type { AerodynamicRigidPitchAgainstBatterInput } from '../../core/sim/pitching/AerodynamicRigidPitchAgainstBatter';
import type { NativeAerodynamicPhysicalPitchSource } from './NativeAerodynamicSession';

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
        aerodynamics: REFERENCE_BASEBALL_AERODYNAMICS,
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
      const midpoint = startTick + 470_000;
      const smoothSwing = createSwingKinematicsTrajectoryV1({
        startTick: midpoint - 75_000,
        contactTick: midpoint,
        endTick: midpoint + 65_000,
        ticksPerSecond: 1_000_000,
        batLengthM: 0.84,
        sweetSpotT: 0.5,
        start: {
          sweetSpotPosition: { x: -0.1, y: 0.95, z: 0.45 },
          sweetSpotVelocity: { x: 0, y: 0, z: -1 },
          batAxis: { x: 1, y: 0, z: 0 },
        },
        contact: {
          sweetSpotPosition: { x: 0.08, y: 0.95, z: 0 },
          sweetSpotVelocity: { x: 8, y: 0, z: -2 },
          batAxis: { x: 1, y: 0, z: 0 },
        },
        finish: {
          sweetSpotPosition: { x: 0.45, y: 1.0, z: -0.3 },
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
