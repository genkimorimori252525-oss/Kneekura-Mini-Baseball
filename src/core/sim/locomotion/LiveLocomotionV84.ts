import type { Vec2 } from '../../model/geometry';

export type LiveLocomotionProfileV84 = Readonly<{
  topSpeedMps: number;
  accelerationMps2: number;
  brakingMps2: number;
  lateralAccelerationMps2: number;
  propulsionBands: readonly Readonly<{ throughSpeedMps: number; accelerationMps2: number }>[];
  basis: 'AVERAGED_ALTERNATING_SUPPORT_UNCALIBRATED_V84';
}>;
export type LiveSpeedSegmentV84 = Readonly<{
  startElapsedSeconds: number; endElapsedSeconds: number;
  startDistanceMeters: number; endDistanceMeters: number;
  startSpeedMps: number; accelerationMps2: number;
}>;
export type LiveSpeedPlanV84 = Readonly<{ durationSeconds: number; segments: readonly LiveSpeedSegmentV84[] }>;
export type LiveDefenderMotionStepV84 = Readonly<{
  acceleration: Vec2; stopAfter?: number; phase: 'launch' | 'run' | 'brake' | 'plant' | 'hold';
}>;

function requireFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new Error('live locomotion V84: ' + name + ' must be finite');
}
function requirePositive(value: number, name: string): void {
  requireFinite(value, name);
  if (value <= 0) throw new Error('live locomotion V84: ' + name + ' must be positive');
}
function requireNonnegative(value: number, name: string): void {
  requireFinite(value, name);
  if (value < 0) throw new Error('live locomotion V84: ' + name + ' must be non-negative');
}
function finiteDerived(value: number): number {
  requireFinite(value, 'derived arithmetic');
  return value;
}
function validateProfile(profile: LiveLocomotionProfileV84): void {
  if (!profile) throw new Error('live locomotion V84: profile required');
  requirePositive(profile.topSpeedMps, 'top speed');
  requirePositive(profile.accelerationMps2, 'acceleration');
  requirePositive(profile.brakingMps2, 'braking');
  requirePositive(profile.lateralAccelerationMps2, 'lateral acceleration');
  if (profile.basis !== 'AVERAGED_ALTERNATING_SUPPORT_UNCALIBRATED_V84'
    || !Array.isArray(profile.propulsionBands) || profile.propulsionBands.length !== 3
    || profile.propulsionBands.some((band, i) => !band
      || band.throughSpeedMps !== profile.topSpeedMps * [.25, .65, 1][i]
      || band.accelerationMps2 !== profile.accelerationMps2 * [1, .7, .35][i]
      || !Number.isFinite(band.throughSpeedMps) || band.throughSpeedMps <= 0
      || !Number.isFinite(band.accelerationMps2) || band.accelerationMps2 <= 0)) {
    throw new Error('live locomotion V84: invalid propulsion profile');
  }
}
function validateSpeed(profile: LiveLocomotionProfileV84, speed: number): void {
  requireNonnegative(speed, 'speed');
  if (speed > profile.topSpeedMps) throw new Error('live locomotion V84: speed exceeds top speed');
}
const magnitude = (a: Vec2): number => Math.hypot(a.x, a.z);
const finiteVector = (a: Vec2): boolean => !!a && Number.isFinite(a.x) && Number.isFinite(a.z);
const zero = (): Vec2 => ({ x: 0, z: 0 });

/** An authored, averaged model of alternating foot support. These three speed
 * bands and braking ratio are control settings, not measured player mechanics.
 * The original SI abilities remain the propulsion ceiling and speed limit. */
export function createLiveLocomotionProfileV84(input: Readonly<{
  topSpeedMps: number; accelerationMps2: number; brakingMps2?: number; lateralAccelerationMps2?: number;
}>): LiveLocomotionProfileV84 {
  const profile: LiveLocomotionProfileV84 = {
    topSpeedMps: input.topSpeedMps, accelerationMps2: input.accelerationMps2,
    brakingMps2: input.brakingMps2 ?? 1.8 * input.accelerationMps2,
    lateralAccelerationMps2: input.lateralAccelerationMps2 ?? input.accelerationMps2,
    propulsionBands: [.25, .65, 1].map((factor, i) => Object.freeze({
      throughSpeedMps: input.topSpeedMps * factor, accelerationMps2: input.accelerationMps2 * [1, .7, .35][i],
    })), basis: 'AVERAGED_ALTERNATING_SUPPORT_UNCALIBRATED_V84',
  };
  validateProfile(profile);
  Object.freeze(profile.propulsionBands);
  return Object.freeze(profile);
}

/** Available forward propulsion at this speed; the caller separately enforces
 * the speed limit. Exact band boundaries select the following, weaker band. */
export function livePropulsionAccelerationV84(profile: LiveLocomotionProfileV84, speedMps: number): number {
  validateProfile(profile); validateSpeed(profile, speedMps);
  return (profile.propulsionBands.find(band => speedMps < band.throughSpeedMps) ?? profile.propulsionBands[2]).accelerationMps2;
}

function accelerationPieces(profile: LiveLocomotionProfileV84, from: number, to: number) {
  const pieces: { from: number; to: number; acceleration: number }[] = [];
  let speed = from;
  for (const band of profile.propulsionBands) {
    if (speed >= to) break;
    if (speed >= band.throughSpeedMps) continue;
    const through = Math.min(to, band.throughSpeedMps);
    pieces.push({ from: speed, to: through, acceleration: band.accelerationMps2 });
    speed = through;
  }
  return pieces;
}
function increasingSpeeds(profile: LiveLocomotionProfileV84, from: number, to: number): void {
  validateProfile(profile); validateSpeed(profile, from); validateSpeed(profile, to);
  if (to < from) throw new Error('live locomotion V84: acceleration speeds must be ordered');
}
const speedChangeDistance = (from: number, to: number, acceleration: number) =>
  finiteDerived((to - from) * (to + from) / (2 * acceleration));

export function liveAccelerationDistanceV84(profile: LiveLocomotionProfileV84, fromSpeed: number, toSpeed: number): number {
  increasingSpeeds(profile, fromSpeed, toSpeed);
  return finiteDerived(accelerationPieces(profile, fromSpeed, toSpeed)
    .reduce((sum, piece) => sum + speedChangeDistance(piece.from, piece.to, piece.acceleration), 0));
}
export function liveAccelerationTimeV84(profile: LiveLocomotionProfileV84, fromSpeed: number, toSpeed: number): number {
  increasingSpeeds(profile, fromSpeed, toSpeed);
  return finiteDerived(accelerationPieces(profile, fromSpeed, toSpeed)
    .reduce((sum, piece) => sum + (piece.to - piece.from) / piece.acceleration, 0));
}

export function liveReachableSpeedV84(profile: LiveLocomotionProfileV84, fromSpeed: number,
  distanceMeters: number, speedLimit = profile.topSpeedMps): number {
  increasingSpeeds(profile, fromSpeed, speedLimit); requireNonnegative(distanceMeters, 'distance');
  let speed = fromSpeed, remaining = distanceMeters;
  for (const piece of accelerationPieces(profile, fromSpeed, speedLimit)) {
    const distance = speedChangeDistance(piece.from, piece.to, piece.acceleration);
    if (remaining < distance) return finiteDerived(Math.sqrt(speed * speed + 2 * piece.acceleration * remaining));
    remaining -= distance; speed = piece.to;
  }
  return speed;
}

/** Finite fastest forward traversal of a known path interval. Each emitted
 * segment has constant acceleration and is used for both movement and ETA.
 * Null retains an infeasible current plan; inherited speed is never clamped. */
export function buildLiveSpeedPlanV84(input: Readonly<{
  profile: LiveLocomotionProfileV84; distanceMeters: number; initialSpeedMps: number; finalSpeedMps: number; speedLimitMps?: number;
}>): LiveSpeedPlanV84 | null {
  const { profile, distanceMeters: distance, initialSpeedMps: initial, finalSpeedMps: final } = input,
    limit = input.speedLimitMps ?? profile.topSpeedMps;
  validateProfile(profile); requireNonnegative(distance, 'distance');
  requireNonnegative(initial, 'initial speed'); requireNonnegative(final, 'final speed');
  validateSpeed(profile, limit);
  if (initial > limit || final > limit) return null;
  if (distance === 0) return initial === final ? Object.freeze({ durationSeconds: 0, segments: Object.freeze([]) }) : null;
  if (limit === 0) return null;
  const brakingDistance = (from: number, to: number) => speedChangeDistance(to, from, profile.brakingMps2),
    distanceAtPeak = (peak: number) => finiteDerived(liveAccelerationDistanceV84(profile, initial, peak) + brakingDistance(peak, final));
  const minimumPeak = Math.max(initial, final);
  let peak = minimumPeak;
  const minimumDistance = distanceAtPeak(peak),
    roundingDistance = 8 * Number.EPSILON * Math.max(distance, minimumDistance);
  // A caller's forward/backward square root can differ by one ULP from its
  // inverse distance. This covers derived arithmetic, never an overspeed state.
  if (minimumDistance - distance > roundingDistance) return null;
  if (minimumDistance >= distance) { /* Exact minimal leg, within derived rounding. */ }
  else if (distanceAtPeak(limit) <= distance) peak = limit;
  else {
    // Within one propulsion band, acceleration plus stopping distance is
    // affine in peak squared. At most three band checks replace a rollout.
    for (const band of profile.propulsionBands) {
      const upper = Math.min(limit, band.throughSpeedMps);
      if (upper <= peak) continue;
      if (distanceAtPeak(upper) < distance) { peak = upper; continue; }
      const atLower = distanceAtPeak(peak);
      peak = Math.max(minimumPeak, Math.min(upper, Math.sqrt(finiteDerived(peak * peak + 2 * (distance - atLower)
        / (1 / band.accelerationMps2 + 1 / profile.brakingMps2)))));
      // Round the derived root toward feasibility, never alter source speed.
      for (let rounding = 0; rounding < 4 && peak > minimumPeak && distanceAtPeak(peak) > distance; rounding++)
        peak = Math.max(minimumPeak, peak * (1 - Number.EPSILON));
      break;
    }
  }
  if (peak === 0) throw new Error('live locomotion V84: positive path has no representable moving speed');
  const segments: LiveSpeedSegmentV84[] = [];
  let time = 0, travelled = 0;
  const append = (seconds: number, fromSpeed: number, acceleration: number, endDistance: number) => {
    if (seconds === 0) return;
    requirePositive(seconds, 'segment duration'); requireNonnegative(endDistance, 'segment end distance');
    const endTime = finiteDerived(time + seconds);
    // A root's sub-ULP coast has no distinct clock boundary. It changes no
    // velocity; the following endpoint already covers that rounding distance.
    if (endTime === time && acceleration === 0) return;
    if (endTime <= time) throw new Error('live locomotion V84: segment duration exceeds finite clock precision');
    segments.push(Object.freeze({ startElapsedSeconds: time, endElapsedSeconds: endTime,
      startDistanceMeters: travelled, endDistanceMeters: endDistance, startSpeedMps: fromSpeed, accelerationMps2: acceleration }));
    time = endTime; travelled = endDistance;
  };
  for (const piece of accelerationPieces(profile, initial, peak)) append((piece.to - piece.from) / piece.acceleration,
    piece.from, piece.acceleration, finiteDerived(travelled + speedChangeDistance(piece.from, piece.to, piece.acceleration)));
  const residual = distance - distanceAtPeak(peak), coast = residual >= 0 ? residual : 0;
  if (residual < -roundingDistance) throw new Error('live locomotion V84: negative coast distance');
  if (coast > 0) append(coast / peak, peak, 0, peak === final ? distance : finiteDerived(travelled + coast));
  if (peak > final) append((peak - final) / profile.brakingMps2, peak, -profile.brakingMps2, distance);
  return Object.freeze({ durationSeconds: time, segments: Object.freeze(segments) });
}

function propulsionOverSeconds(profile: LiveLocomotionProfileV84, speed: number, seconds: number): number {
  let remaining = seconds, speedGain = 0;
  for (const piece of accelerationPieces(profile, speed, profile.topSpeedMps)) {
    const duration = (piece.to - piece.from) / piece.acceleration, used = Math.min(remaining, duration);
    // Integrate the increment directly. Subtracting two almost identical
    // absolute speeds would lose the force budget at tiny contact-time cuts.
    speedGain += piece.acceleration * used;
    remaining -= used;
    if (remaining === 0) break;
  }
  return finiteDerived(speedGain / seconds);
}

/** One continuous, constant-acceleration body command. A large heading change
 * first dissipates momentum instead of steering a full-speed body sideways.
 * Forward propulsion, braking and lateral support share an acceleration ellipse.
 * StopAfter is an actual zero-speed boundary, never a position/velocity reset.
 * The 40ms caller, not Presentation cadence, determines the control interval. */
export function stepLiveDefenderMotionV84(state: Readonly<{ position: Vec2; velocity: Vec2 }>, target: Vec2 | null,
  deltaSeconds: number, profile: LiveLocomotionProfileV84, arrivalRadiusMeters = .02): LiveDefenderMotionStepV84 {
  validateProfile(profile); requirePositive(deltaSeconds, 'control duration'); requireNonnegative(arrivalRadiusMeters, 'arrival radius');
  if (!state || !finiteVector(state.position) || !finiteVector(state.velocity) || target !== null && !finiteVector(target))
    throw new Error('live locomotion V84: finite actual planar state/target required');
  const speed = magnitude(state.velocity); validateSpeed(profile, speed);
  const brake = (phase: 'brake' | 'plant'): LiveDefenderMotionStepV84 => {
    if (speed === 0) return { acceleration: zero(), phase: 'hold' };
    const stopAfter = finiteDerived(speed / profile.brakingMps2), acceleration = {
      x: state.velocity.x === 0 ? 0 : -state.velocity.x / speed * profile.brakingMps2,
      z: state.velocity.z === 0 ? 0 : -state.velocity.z / speed * profile.brakingMps2,
    };
    return { acceleration, ...(stopAfter <= deltaSeconds ? { stopAfter } : {}), phase };
  };
  if (target === null) return brake('brake');
  const dx = finiteDerived(target.x - state.position.x), dz = finiteDerived(target.z - state.position.z),
    distance = finiteDerived(Math.hypot(dx, dz));
  if (distance <= arrivalRadiusMeters) return brake('brake');
  const direction = { x: dx / distance, z: dz / distance },
    along = finiteDerived(state.velocity.x * direction.x + state.velocity.z * direction.z),
    cosine = speed > 0 ? along / speed : 1;
  // A reversal always stops first; a fast cross-direction change plants first.
  if (speed > 0 && (along < 0 || speed >= .25 * profile.topSpeedMps && cosine < .5)) return brake('plant');
  const remaining = distance - arrivalRadiusMeters,
    available = remaining - Math.max(0, along) * deltaSeconds / 2,
    halfBrakingStep = finiteDerived(profile.brakingMps2 * deltaSeconds / 2),
    radicand = available > 0 ? finiteDerived(halfBrakingStep * halfBrakingStep + 2 * profile.brakingMps2 * available) : 0,
    // Stable positive root: average step displacement plus the following stop.
    stopLimitedSpeed = available <= 0 ? 0 : finiteDerived(2 * profile.brakingMps2 * available / (Math.sqrt(radicand) + halfBrakingStep)),
    // Reserve a few ULPs in the derived intent so rotation/reconstruction of
    // its components cannot manufacture inherited overspeed on the next cut.
    // Neither the accepted source velocity nor its published speed is changed.
    desiredSpeed = Math.min(profile.topSpeedMps * (1 - 8 * Number.EPSILON), stopLimitedSpeed);
  if (desiredSpeed === 0) return brake('brake');
  const desired = { x: direction.x * desiredSpeed, z: direction.z * desiredSpeed },
    delta = { x: desired.x - state.velocity.x, z: desired.z - state.velocity.z },
    heading = speed > 0 ? { x: state.velocity.x / speed, z: state.velocity.z / speed } : direction,
    forwardDelta = delta.x * heading.x + delta.z * heading.z,
    sidewaysDelta = delta.x * -heading.z + delta.z * heading.x,
    availablePropulsion = speed < profile.topSpeedMps ? propulsionOverSeconds(profile, speed, deltaSeconds)
      : livePropulsionAccelerationV84(profile, speed),
    longitudinalLimit = forwardDelta > 0 ? availablePropulsion : profile.brakingMps2,
    ellipse = finiteDerived(Math.hypot(forwardDelta / (longitudinalLimit * deltaSeconds),
      sidewaysDelta / (profile.lateralAccelerationMps2 * deltaSeconds))),
    fraction = ellipse > 1 ? 1 / ellipse : 1,
    acceleration = { x: finiteDerived(delta.x * fraction / deltaSeconds), z: finiteDerived(delta.z * fraction / deltaSeconds) },
    phase = forwardDelta < 0 && desiredSpeed < speed ? 'brake' : speed < .25 * profile.topSpeedMps ? 'launch' : 'run';
  // End velocity lies on the segment between two in-limit velocities. No state
  // is normalized or teleported to enforce that convex speed constraint.
  return { acceleration, phase };
}
