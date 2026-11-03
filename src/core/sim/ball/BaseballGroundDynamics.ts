import type { BattedBallInitialState } from '../contact/BatBallContact';
import { quantizeEventTick } from '../ExactEventTime';

/** Explicit surface calibration. Callers own the dirt/grass/turf material map;
 * these coefficients are never inferred from an animation or baseball result. */
export type BaseballGroundMaterial = Readonly<{
  restitution: number;
  slidingFriction: number;
  rollingDecelerationMps2: number;
  normalSpinDecayPerSecond: number;
}>;

export type BaseballGroundParameters = Readonly<{
  radiusM: number;
  /** I / (mass * radius^2); 0.4 describes a uniform solid sphere. */
  inertiaRatio: number;
  gravityMps2: number;
  ticksPerSecond: number;
  restingVerticalSpeedMps: number;
  material: BaseballGroundMaterial;
}>;

export type BaseballGroundMotion = Readonly<{
  ball: BattedBallInitialState;
  phase: 'sliding' | 'rolling' | 'resting';
  transitions: readonly Readonly<{
    kind: 'rolling_started' | 'rolling_stopped';
    /** Continuous physical instant, measured from input.ball.tick. */
    elapsedSeconds: number;
  }>[];
}>;

const EPSILON = 1e-10;

function validate(ball: BattedBallInitialState, p: BaseballGroundParameters): void {
  if (!ball || !Number.isSafeInteger(ball.tick) || ball.tick < 0
    || ![ball.position, ball.velocity, ball.spin].every(v => v && Object.values(v).every(Number.isFinite))) {
    throw new Error('ground dynamics requires a finite physical ball and source clock');
  }
  if (!p || !p.material || !Number.isSafeInteger(p.ticksPerSecond) || p.ticksPerSecond <= 0
    || ![p.radiusM, p.inertiaRatio, p.gravityMps2].every(v => Number.isFinite(v) && v > 0)
    || ![p.restingVerticalSpeedMps, p.material.slidingFriction, p.material.rollingDecelerationMps2,
      p.material.normalSpinDecayPerSecond].every(v => Number.isFinite(v) && v >= 0)
    || !Number.isFinite(p.material.restitution) || p.material.restitution < 0 || p.material.restitution > 1) {
    throw new Error('invalid ground dynamics physical parameters');
  }
}

/** Horizontal velocity of the bottom surface point: v + omega cross (0,-R,0). */
function slip(ball: BattedBallInitialState, radius: number) {
  return { x: ball.velocity.x + radius * ball.spin.z, z: ball.velocity.z - radius * ball.spin.x };
}

/** A Coulomb-limited impulse at an actual floor contact. The same impulse
 * changes linear and angular momentum, so backspin/topspin affect the bounce. */
export function resolveBaseballGroundImpact(
  ball: BattedBallInitialState,
  p: BaseballGroundParameters,
): BattedBallInitialState {
  validate(ball, p);
  if (Math.abs(ball.position.y - p.radiusM) > EPSILON || ball.velocity.y > 0) {
    throw new Error('ground impact requires an actual incoming floor contact');
  }
  const normalImpulsePerMass = -(1 + p.material.restitution) * ball.velocity.y;
  const relative = slip(ball, p.radiusM), speed = Math.hypot(relative.x, relative.z);
  const impulse = Math.min(speed / (1 + 1 / p.inertiaRatio), p.material.slidingFriction * normalImpulsePerMass);
  const dx = speed <= EPSILON ? 0 : -relative.x / speed * impulse;
  const dz = speed <= EPSILON ? 0 : -relative.z / speed * impulse;
  const rebound = -p.material.restitution * ball.velocity.y;
  const result = {
    ...ball, position: { ...ball.position, y: p.radiusM },
    velocity: { x: ball.velocity.x + dx, y: rebound < p.restingVerticalSpeedMps ? 0 : rebound, z: ball.velocity.z + dz },
    spin: { x: ball.spin.x - dz / (p.inertiaRatio * p.radiusM), y: ball.spin.y,
      z: ball.spin.z + dx / (p.inertiaRatio * p.radiusM) },
  };
  validate(result, p);
  return result;
}

/** Analytic sliding -> rolling -> rest on one homogeneous floor segment.
 * Event boundaries split the integration; changing render cadence cannot
 * change the path. Airborne motion remains owned by the existing Aero Core. */
export function advanceBaseballGroundMotion(
  initial: BattedBallInitialState,
  deltaTicks: number,
  p: BaseballGroundParameters,
): BaseballGroundMotion {
  validate(initial, p);
  if (!Number.isSafeInteger(deltaTicks) || deltaTicks < 0 || !Number.isSafeInteger(initial.tick + deltaTicks)) {
    throw new Error('ground motion requires a bounded non-negative source-clock interval');
  }
  return advanceBaseballGroundMotionSeconds(initial, deltaTicks / p.ticksPerSecond, initial.tick + deltaTicks, p);
}

/** The same analytic slip/rolling kernel at a continuous physical instant.
 * Only the event clock is quantized; no polynomial or frame interpolation is
 * substituted for linear/angular friction coupling. */
export function sampleBaseballGroundMotionAtElapsedSeconds(
  initial: BattedBallInitialState,
  elapsedSeconds: number,
  p: BaseballGroundParameters,
): BaseballGroundMotion {
  validate(initial, p);
  const throughTick = quantizeEventTick(initial.tick, elapsedSeconds, p.ticksPerSecond);
  return advanceBaseballGroundMotionSeconds(initial, elapsedSeconds, throughTick, p);
}

function advanceBaseballGroundMotionSeconds(
  initial: BattedBallInitialState,
  duration: number,
  throughTick: number,
  p: BaseballGroundParameters,
): BaseballGroundMotion {
  if (Math.abs(initial.position.y - p.radiusM) > EPSILON || initial.velocity.y !== 0) {
    throw new Error('ground motion requires a ball resting on the actual floor');
  }
  let remaining = duration, elapsed = 0;
  let x = initial.position.x, z = initial.position.z;
  let vx = initial.velocity.x, vz = initial.velocity.z;
  let wx = initial.spin.x, wz = initial.spin.z;
  const transitions: BaseballGroundMotion['transitions'][number][] = [];
  const relative = slip(initial, p.radiusM), slipSpeed = Math.hypot(relative.x, relative.z);
  const friction = p.material.slidingFriction * p.gravityMps2;
  let rolling = slipSpeed <= EPSILON;
  if (!rolling) {
    const untilRolling = friction === 0 ? Infinity : slipSpeed / (friction * (1 + 1 / p.inertiaRatio));
    const dt = Math.min(remaining, untilRolling);
    const ax = -friction * relative.x / slipSpeed, az = -friction * relative.z / slipSpeed;
    x += vx * dt + 0.5 * ax * dt * dt;
    z += vz * dt + 0.5 * az * dt * dt;
    vx += ax * dt; vz += az * dt;
    wx -= az * dt / (p.inertiaRatio * p.radiusM);
    wz += ax * dt / (p.inertiaRatio * p.radiusM);
    remaining -= dt; elapsed += dt;
    if (dt === untilRolling) {
      rolling = true;
      transitions.push({ kind: 'rolling_started', elapsedSeconds: elapsed });
    }
  }
  let phase: BaseballGroundMotion['phase'] = rolling ? 'rolling' : 'sliding';
  if (rolling) {
    const speed = Math.hypot(vx, vz), deceleration = p.material.rollingDecelerationMps2;
    const stopSeconds = speed === 0 ? 0 : deceleration === 0 ? Infinity : speed / deceleration;
    const dt = Math.min(remaining, stopSeconds);
    const distance = speed * dt - 0.5 * deceleration * dt * dt;
    if (speed > EPSILON) {
      x += vx / speed * distance; z += vz / speed * distance;
      const nextSpeed = Math.max(0, speed - deceleration * dt);
      vx = vx / speed * nextSpeed; vz = vz / speed * nextSpeed;
    } else { vx = 0; vz = 0; }
    if (stopSeconds <= remaining) {
      vx = 0; vz = 0; phase = 'resting';
      if (speed > EPSILON) transitions.push({ kind: 'rolling_stopped', elapsedSeconds: elapsed + stopSeconds });
    }
    wx = vz === 0 ? 0 : vz / p.radiusM;
    wz = vx === 0 ? 0 : -vx / p.radiusM;
  }
  const result: BattedBallInitialState = {
    tick: throughTick, position: { x, y: p.radiusM, z },
    velocity: { x: vx, y: 0, z: vz },
    spin: { x: wx, y: initial.spin.y * Math.exp(-p.material.normalSpinDecayPerSecond * duration), z: wz },
  };
  validate(result, p);
  return { ball: result, phase, transitions };
}
