import { createFreeBaseballTrajectory, type FreeBaseballSample, type FreeBaseballGroundContact } from '../../core/sim/ball/FreeBaseballTrajectory';
import type { BaseballGroundParameters } from '../../core/sim/ball/BaseballGroundDynamics';
import type { AerodynamicPitchTrajectoryParameters } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import type { Quaternion } from '../../core/sim/pitching/BaseballOrientation';
import { adaptRigidBatBallContactToCanonicalContact } from '../../core/sim/pitching/RigidBatContactCanonicalAdapter';
import type { NativeAerodynamicObservation } from './NativeAerodynamicObserver';

export type NativeFreeBallObserveInput = Readonly<{
  observation: NativeAerodynamicObservation;
  throughTick: number;
  /** Explicit physical source calibration, never renderer settings. */
  aerodynamics: AerodynamicPitchTrajectoryParameters;
  ground: BaseballGroundParameters;
  sampleTicks?: readonly number[];
  orientationAtContact?: Quaternion;
}>;
export type NativeFreeBallObservation = Readonly<{
  authority: 'NATIVE_CORE_FREE_BALL_CONTINUATION';
  samples: readonly FreeBaseballSample[];
  groundContacts: readonly FreeBaseballGroundContact[];
  orientationProvenance: NativeAerodynamicObservation['spinFrames'][number]['orientationProvenance'];
  /** Free motion is still pending the real actor/custody/field/rule owners. */
  requiresOfficialLiveBallResolution: true;
  officialResult: null;
}>;

const vectorEqual = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  a.x === b.x && a.y === b.y && a.z === b.z;

/** Connect the exact accepted rigid-contact impulse to the existing Aero Core
 * and ground dynamics. No pre-impact pitch is extrapolated beyond contact,
 * and no free-field flight is mislabeled a catch, homer, hit or completed PA. */
export function observeNativeFreeBallContinuation(input: NativeFreeBallObserveInput): NativeFreeBallObservation {
  const { observation: observed } = input, contact = observed.rigidContact;
  const event = observed.events.find(e => e.kind === 'BatBallContact');
  const status = observed.result.timeline.status;
  const materialFrame = observed.spinFrames.at(-1);
  if (observed.authority !== 'NATIVE_CORE_AERODYNAMIC_RIGID_PITCH'
    || observed.kind !== 'recorded_swing' || !contact || !event || event.kind !== 'BatBallContact'
    || status.kind !== 'batted_ball_pending' || status.contactTick !== contact.tick
    || event.tick !== contact.tick || !materialFrame || materialFrame.tick !== contact.tick
    || input.aerodynamics.ticksPerSecond !== materialFrame.ticksPerSecond) {
    throw new Error('Native free-ball continuation requires original pending rigid-impact and material observations');
  }
  const canonical = adaptRigidBatBallContactToCanonicalContact(contact), accepted = event.payload.contact;
  if (canonical.tick !== accepted.tick || canonical.segmentT !== accepted.segmentT
    || !(['ballCenter', 'point', 'batPoint', 'normal', 'exitVelocity', 'exitSpin'] as const)
      .every(key => vectorEqual(canonical[key], accepted[key]))) {
    throw new Error('Native free-ball continuation impact differs from the accepted canonical event');
  }
  if (input.orientationAtContact && !(['w', 'x', 'y', 'z'] as const)
    .every(key => input.orientationAtContact![key] === materialFrame.orientationMaterialToWorld[key])) {
    throw new Error('Native free-ball continuation cannot replace the original impact orientation');
  }
  const trajectory = createFreeBaseballTrajectory({
    initialBall: { tick: contact.tick, position: contact.ballCenter, velocity: contact.exitVelocity, spin: contact.exitSpin },
    throughTick: input.throughTick, aerodynamics: input.aerodynamics, ground: input.ground,
    orientationAtStart: materialFrame.orientationMaterialToWorld,
  });
  const ticks = input.sampleTicks ? [...input.sampleTicks] : [];
  if (!input.sampleTicks) {
    const cadence = Math.max(1, Math.round(0.0275 * input.aerodynamics.ticksPerSecond));
    for (let tick = contact.tick; tick <= input.throughTick; tick += cadence) ticks.push(tick);
    ticks.push(input.throughTick, ...trajectory.groundContacts.map(c => c.outgoing.tick));
  }
  const sampleTicks = input.sampleTicks ? ticks : [...new Set(ticks)].sort((a, b) => a - b);
  return Object.freeze({ authority: 'NATIVE_CORE_FREE_BALL_CONTINUATION',
    samples: trajectory.observe(sampleTicks), groundContacts: trajectory.groundContacts,
    orientationProvenance: materialFrame.orientationProvenance,
    requiresOfficialLiveBallResolution: true, officialResult: null });
}
