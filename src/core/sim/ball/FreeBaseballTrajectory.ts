import type { BattedBallInitialState } from '../contact/BatBallContact';
import { advanceAerodynamicPitchState, type AerodynamicPitchTrajectoryParameters } from '../pitching/AerodynamicPitchTrajectory';
import { advanceBaseballOrientation, IDENTITY_QUATERNION, normalizeQuaternion, type Quaternion } from '../pitching/BaseballOrientation';
import { findFirstTrueTick, quantizeEventTick } from '../ExactEventTime';
import { calculateBaseballAerodynamics } from './BaseballAerodynamics';
import { advanceBaseballGroundMotion, resolveBaseballGroundImpact, type BaseballGroundParameters } from './BaseballGroundDynamics';

export type FreeBaseballTrajectoryInput = Readonly<{
  initialBall: BattedBallInitialState;
  throughTick: number;
  aerodynamics: AerodynamicPitchTrajectoryParameters;
  ground: BaseballGroundParameters;
  orientationAtStart?: Quaternion;
}>;
export type FreeBaseballSample = Readonly<{
  tick: number;
  ball: BattedBallInitialState;
  orientation: Quaternion;
  phase: 'airborne' | 'sliding' | 'rolling' | 'resting';
}>;
export type FreeBaseballGroundContact = Readonly<{
  incoming: BattedBallInitialState;
  outgoing: BattedBallInitialState;
}>;
export type FreeBaseballTrajectory = Readonly<{
  samples: readonly FreeBaseballSample[];
  groundContacts: readonly FreeBaseballGroundContact[];
  observe: (ticks: readonly number[]) => readonly FreeBaseballSample[];
}>;

const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

/** The real Aero kernel continues after rigid contact; ground impulses and
 * friction own subsequent velocity and spin. This free-field trajectory makes
 * no catch, fence, custody, fair/foul or official-result assertion. Those
 * boundaries must be supplied by the world/actor/rule owners before admission. */
export function createFreeBaseballTrajectory(raw: FreeBaseballTrajectoryInput): FreeBaseballTrajectory {
  const input = structuredClone(raw), { initialBall, throughTick, aerodynamics: aero, ground } = input;
  if (!initialBall || !aero || !ground || !Number.isSafeInteger(initialBall.tick) || initialBall.tick < 0
    || !Number.isSafeInteger(throughTick) || throughTick < initialBall.tick
    || !Number.isSafeInteger(aero.ticksPerSecond) || aero.ticksPerSecond <= 0
    || !Number.isSafeInteger(aero.integrationStepTicks) || aero.integrationStepTicks <= 0
    || ![initialBall.position, initialBall.velocity, initialBall.spin]
      .every(v => v && [v.x, v.y, v.z].every(Number.isFinite))
    || ground.ticksPerSecond !== aero.ticksPerSecond || ground.radiusM !== aero.aerodynamics.ballRadiusM
    || ground.gravityMps2 !== -aero.gravityY
    || (throughTick - initialBall.tick) / aero.ticksPerSecond > 120
    || initialBall.position.y < ground.radiusM - 1e-10) {
    throw new Error('free baseball trajectory requires consistent original physical parameters and a bounded horizon');
  }
  // Both validation paths must run even when no integration step is requested.
  advanceAerodynamicPitchState(initialBall, 0, aero);
  calculateBaseballAerodynamics(initialBall.velocity, initialBall.spin, aero.aerodynamics);
  // Validate even a zero-duration/airborne horizon through the ground kernel.
  advanceBaseballGroundMotion({ ...initialBall, position: { ...initialBall.position, y: ground.radiusM },
    velocity: { ...initialBall.velocity, y: 0 } }, 0, ground);
  const samples: FreeBaseballSample[] = [], groundContacts: FreeBaseballGroundContact[] = [];
  const grounded = (b: BattedBallInitialState) => Math.abs(b.position.y - ground.radiusM) <= 1e-10 && b.velocity.y === 0;
  const phaseAt = (b: BattedBallInitialState): FreeBaseballSample['phase'] => grounded(b)
    ? advanceBaseballGroundMotion(b, 0, ground).phase : 'airborne';
  const oriented = (anchor: FreeBaseballSample, ball: BattedBallInitialState): FreeBaseballSample => {
    const meanSpin = { x: (anchor.ball.spin.x + ball.spin.x) / 2, y: (anchor.ball.spin.y + ball.spin.y) / 2,
      z: (anchor.ball.spin.z + ball.spin.z) / 2 };
    return { tick: ball.tick, ball, phase: phaseAt(ball), orientation: advanceBaseballOrientation(anchor.orientation,
      meanSpin, (ball.tick - anchor.tick) / aero.ticksPerSecond) };
  };
  const advance = (anchor: FreeBaseballSample, tick: number): FreeBaseballSample => oriented(anchor,
    grounded(anchor.ball) ? advanceBaseballGroundMotion(anchor.ball, tick - anchor.tick, ground).ball
      : advanceAerodynamicPitchState(anchor.ball, tick - anchor.tick, aero));
  let current: FreeBaseballSample = { tick: initialBall.tick, ball: initialBall,
    orientation: normalizeQuaternion(input.orientationAtStart ?? IDENTITY_QUATERNION), phase: phaseAt(initialBall) };
  if (initialBall.position.y <= ground.radiusM && initialBall.velocity.y < 0) {
    const incoming = { ...initialBall, position: { ...initialBall.position, y: ground.radiusM } };
    const outgoing = resolveBaseballGroundImpact(incoming, ground);
    groundContacts.push({ incoming, outgoing });
    current = { ...current, ball: outgoing, phase: phaseAt(outgoing) };
  }
  samples.push(current);
  while (current.tick < throughTick) {
    // The physical lattice is anchored at contact, independent of render ticks.
    const lattice = initialBall.tick + (Math.floor((current.tick - initialBall.tick) / aero.integrationStepTicks) + 1) * aero.integrationStepTicks;
    let endTick = Math.min(lattice, throughTick);
    if (grounded(current.ball)) {
      const nextTransition = advanceBaseballGroundMotion(current.ball, endTick - current.tick, ground).transitions[0];
      if (nextTransition) {
        const boundaryTick = quantizeEventTick(current.tick, nextTransition.elapsedSeconds, aero.ticksPerSecond);
        if (boundaryTick > current.tick) endTick = Math.min(endTick, boundaryTick);
      }
    }
    const proposed = advance(current, endTick);
    let floorHorizon = endTick;
    if (!grounded(current.ball) && current.ball.velocity.y < 0 && proposed.ball.velocity.y >= 0) {
      // A Magnus-induced upward turn can leave both endpoints above the floor.
      // Include the local minimum, rather than extrapolating through the ground.
      const turnTick = findFirstTrueTick(current.tick, endTick, tick => advance(current, tick).ball.velocity.y >= 0);
      if (turnTick !== null) {
        const before = Math.max(current.tick, turnTick - 1);
        floorHorizon = advance(current, before).ball.position.y < advance(current, turnTick).ball.position.y ? before : turnTick;
      }
    }
    if (!grounded(current.ball) && advance(current, floorHorizon).ball.position.y <= ground.radiusM) {
      // Find the actual incoming contact inside this RK4 integration cell.
      // A floor launch with positive vy must not count its starting point twice.
      const first = current.ball.position.y <= ground.radiusM ? current.tick + 1 : current.tick;
      const contactTick = findFirstTrueTick(first, floorHorizon,
        tick => advance(current, tick).ball.position.y <= ground.radiusM);
      if (contactTick === null) throw new Error('free trajectory ground crossing has no physical contact');
      const atContact = advance(current, contactTick);
      const incoming = { ...atContact.ball, position: { ...atContact.ball.position, y: ground.radiusM } };
      const outgoing = resolveBaseballGroundImpact(incoming, ground);
      groundContacts.push({ incoming, outgoing });
      current = { ...atContact, ball: outgoing, phase: phaseAt(outgoing) };
    } else current = proposed;
    samples.push(current);
  }
  const frozenSamples = freeze(samples), frozenContacts = freeze(groundContacts);
  const observe = (ticks: readonly number[]): readonly FreeBaseballSample[] => {
    let previous = -1;
    return ticks.map(tick => {
      if (!Number.isSafeInteger(tick) || tick <= previous || tick < initialBall.tick || tick > throughTick) {
        throw new Error('free baseball observation requires strictly increasing available source ticks');
      }
      previous = tick;
      let low = 0, high = frozenSamples.length - 1;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (frozenSamples[mid].tick <= tick) low = mid; else high = mid - 1;
      }
      const anchor = frozenSamples[low];
      return anchor.tick === tick ? anchor : freeze(advance(anchor, tick));
    });
  };
  return Object.freeze({ samples: frozenSamples, groundContacts: frozenContacts, observe });
}
