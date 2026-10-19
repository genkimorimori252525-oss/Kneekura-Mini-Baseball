import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { quantizeEventTick } from '../ExactEventTime';
import { createBattedBallInitialStateFromContact, type BatBallContactResult } from '../contact/BatBallContact';
import { resolveAerodynamicIntegrationStepTicksV1, sampleAerodynamicPitchStateAtElapsedSeconds } from '../pitching/AerodynamicPitchTrajectory';
import { advanceBaseballOrientation, IDENTITY_QUATERNION, type Quaternion } from '../pitching/BaseballOrientation';
import { validateBaseballMaterialOrientationV1 } from './BaseballSeamForceV1';
import type { BallWorldMoment } from './BallWorldContinuation';
import { resolveBaseballGroundImpact, sampleBaseballGroundMotionAtElapsedSeconds } from './BaseballGroundDynamics';
import type { BattedBallFlightEvidence } from './BattedBallFlightEvidence';
import type { FreeBaseballSample } from './FreeBaseballTrajectory';
import { createAeroGroundBallPhysicsProfile, type AeroGroundBallPhysicsV1 } from './VersionedBattedBallPhysics';
import { boundSourceRk4PositionSpeed } from './SourceFreeBallSpeedBound';

export type SourceFreeBallDescriptorV2 = Readonly<{
  kind: 'aero_ground_continuous_source_kernel_v2';
  initial: BallWorldMoment;
  throughElapsedSeconds: number;
  profile: AeroGroundBallPhysicsV1;
  materialOrientationAtStart?: Quaternion;
}>;
export type SourceFreeBallEvaluation = Readonly<{
  moment: BallWorldMoment;
  /** Relative rotation since this descriptor's basis, initialized to identity.
   * It is not the material/seam orientation across prior collision or custody
   * history; a separate history observer must carry that initial phase. */
  orientation: FreeBaseballSample['orientation'];
  /** Absolute material-to-world orientation, present only for an explicit basis. */
  materialOrientation?: Quaternion;
  phase: FreeBaseballSample['phase'];
}>;
export type SourceFreeBallBoundary = Readonly<{
  kind: 'ground' | 'rolling_started' | 'rolling_stop';
  elapsedSeconds: number;
}>;
export type SourceFreeBallKernel = Readonly<{
  descriptor: SourceFreeBallDescriptorV2;
  boundaries: readonly SourceFreeBallBoundary[];
  cells: readonly Readonly<{ fromElapsedSeconds: number; throughElapsedSeconds: number;
    maximumPositionSpeedMps: number; positionRoundingBoundMeters: number }>[];
  evaluateAt: (elapsedSeconds: number, side?: 'incoming' | 'outgoing') => SourceFreeBallEvaluation;
}>;
const fields = (value: unknown, names: readonly string[], optional: readonly string[] = []) => value && typeof value === 'object' && !Array.isArray(value)
  && names.every(k => Object.hasOwn(value, k)) && Object.keys(value).every(k => names.includes(k) || optional.includes(k));
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

/** A new continuous numerical model, never a replacement for archived v1
 * integer-ground trajectories. Core RK4 and analytic coupled ground friction
 * own the motion. Physical boundaries split a source-rooted integration lattice;
 * observations neither restart it nor interpolate a rendering frame. No field
 * collider, custody, rule or accepted Source authority is granted here. */
export const createSourceFreeBallKernel = (raw: SourceFreeBallDescriptorV2): SourceFreeBallKernel => {
  const descriptor = cloneInert(raw), initial = descriptor?.initial, ball = initial?.ball;
  if (!fields(descriptor, ['kind', 'initial', 'throughElapsedSeconds', 'profile'], ['materialOrientationAtStart'])
    || descriptor.kind !== 'aero_ground_continuous_source_kernel_v2'
    || !fields(initial, ['originTick', 'elapsedSeconds', 'ball'])
    || !fields(ball, ['tick', 'position', 'velocity', 'spin'])
    || ![ball.position, ball.velocity, ball.spin].every(v => fields(v, ['x', 'y', 'z']) && Object.values(v).every(Number.isFinite))
    || !Number.isFinite(descriptor.throughElapsedSeconds) || descriptor.throughElapsedSeconds < initial.elapsedSeconds
    || descriptor.throughElapsedSeconds - initial.elapsedSeconds > 120) throw new Error('invalid nonlinear free ball Source descriptor');
  const profile = createAeroGroundBallPhysicsProfile(descriptor.profile), p = profile.air.ticksPerSecond;
  const materialBasis = descriptor.materialOrientationAtStart === undefined ? undefined : validateBaseballMaterialOrientationV1(descriptor.materialOrientationAtStart);
  if (profile.air.aerodynamics.seamForce?.coefficientScale && materialBasis === undefined)
    throw new Error('baseball seam force: explicit material orientation required');
  if (ball.tick !== quantizeEventTick(initial.originTick, initial.elapsedSeconds, p)
    || ball.position.y < profile.ground.radiusM - 1e-10) throw new Error('free ball Source descriptor physical clock or floor differs');
  const boundaryToleranceSeconds = 1e-12;
  const samples: SourceFreeBallEvaluation[] = [], boundaries: SourceFreeBallBoundary[] = [];
  const groundIncoming = new Map<number, SourceFreeBallEvaluation>();
  const groundPositionCorrections = new Map<number, number>();
  const phaseAt = (moment: BallWorldMoment): FreeBaseballSample['phase'] => Math.abs(moment.ball.position.y - profile.ground.radiusM) <= 1e-10
    && moment.ball.velocity.y === 0 ? sampleBaseballGroundMotionAtElapsedSeconds(moment.ball, 0, profile.ground).phase : 'airborne';
  const advance = (anchor: SourceFreeBallEvaluation, elapsedSeconds: number): SourceFreeBallEvaluation => {
    const seconds = elapsedSeconds - anchor.moment.elapsedSeconds;
    const ground = anchor.phase === 'airborne' ? null : sampleBaseballGroundMotionAtElapsedSeconds(anchor.moment.ball, seconds, profile.ground);
    const sampled = ground?.ball ?? sampleAerodynamicPitchStateAtElapsedSeconds(anchor.moment.ball, seconds, profile.air, anchor.materialOrientation),
      { materialOrientation: integratedMaterial, ...b } = sampled as typeof sampled & { materialOrientation?: Quaternion };
    const moment = { originTick: initial.originTick, elapsedSeconds,
      ball: { ...b, tick: quantizeEventTick(initial.originTick, elapsedSeconds, p) } };
    const a = anchor.moment.ball.spin, meanSpin = { x: (a.x + b.spin.x) / 2, y: (a.y + b.spin.y) / 2, z: (a.z + b.spin.z) / 2 };
    return { moment, phase: ground?.phase ?? 'airborne', orientation: advanceBaseballOrientation(anchor.orientation, meanSpin, seconds),
      ...(anchor.materialOrientation === undefined ? {} : { materialOrientation: integratedMaterial ?? advanceBaseballOrientation(anchor.materialOrientation, meanSpin, seconds) }) };
  };
  const firstTrue = (lower: number, upper: number, predicate: (seconds: number) => boolean): number => {
    if (!predicate(upper)) throw new Error('continuous physical boundary is not bracketed');
    let lo = lower, hi = upper;
    for (let i = 0; i < 96 && hi - lo > boundaryToleranceSeconds; i++) {
      const middle = (lo + hi) / 2;
      if (middle === lo || middle === hi) break;
      if (predicate(middle)) hi = middle; else lo = middle;
    }
    return hi;
  };
  const impact = (incoming: SourceFreeBallEvaluation): SourceFreeBallEvaluation => {
    const moment = incoming.moment, b = { ...moment.ball, position: { ...moment.ball.position, y: profile.ground.radiusM } };
    const at = { ...incoming, moment: { ...moment, ball: b } };
    groundIncoming.set(moment.elapsedSeconds, at);
    groundPositionCorrections.set(moment.elapsedSeconds, Math.abs(moment.ball.position.y - profile.ground.radiusM));
    boundaries.push({ kind: 'ground', elapsedSeconds: moment.elapsedSeconds });
    const outgoing = { ...moment, ball: resolveBaseballGroundImpact(b, profile.ground) };
    return { moment: outgoing, phase: phaseAt(outgoing), orientation: incoming.orientation,
      ...(incoming.materialOrientation === undefined ? {} : { materialOrientation: incoming.materialOrientation }) };
  };
  let current: SourceFreeBallEvaluation = { moment: initial, phase: phaseAt(initial), orientation: IDENTITY_QUATERNION,
    ...(materialBasis === undefined ? {} : { materialOrientation: materialBasis }) };
  if (ball.position.y <= profile.ground.radiusM && ball.velocity.y <= 0) current = impact(current);
  samples.push(current);
  const materialForce = (profile.air.aerodynamics.seamForce?.coefficientScale ?? 0) > 0;
  let stepSeconds = resolveAerodynamicIntegrationStepTicksV1(current.moment.ball.spin, profile.air) / p,
    latticeOrigin = initial.elapsedSeconds;
  let cellIndex = 1;
  while (current.moment.elapsedSeconds < descriptor.throughElapsedSeconds) {
    if (samples.length > 250_000) throw new Error('continuous Source trajectory exceeds bounded integration work');
    const cellEnd = latticeOrigin + cellIndex * stepSeconds;
    let resetLattice = false;
    const requestedEnd = Math.min(cellEnd, descriptor.throughElapsedSeconds);
    // Boundaries are located in the same original cell even when the requested
    // horizon cuts that cell. No future boundary/sample is published.
    let end = cellEnd;
    if (requestedEnd <= current.moment.elapsedSeconds) throw new Error('continuous Source lattice loses physical time resolution');
    if (current.phase !== 'airborne') {
      const motion = sampleBaseballGroundMotionAtElapsedSeconds(current.moment.ball, end - current.moment.elapsedSeconds, profile.ground);
      const transition = motion.transitions[0];
      if (transition && transition.elapsedSeconds > 0) {
        const time = current.moment.elapsedSeconds + transition.elapsedSeconds;
        if (time <= end) {
          end = time;
          if (time <= descriptor.throughElapsedSeconds) boundaries.push({
            kind: transition.kind === 'rolling_stopped' ? 'rolling_stop' : 'rolling_started', elapsedSeconds: time });
        }
      }
    }
    const proposed = advance(current, end);
    let floorHorizon = end;
    if (current.phase === 'airborne' && current.moment.ball.velocity.y < 0 && proposed.moment.ball.velocity.y >= 0) {
      floorHorizon = firstTrue(current.moment.elapsedSeconds, end, time => advance(current, time).moment.ball.velocity.y >= 0);
    }
    if (current.phase === 'airborne' && advance(current, floorHorizon).moment.ball.position.y <= profile.ground.radiusM) {
      const time = firstTrue(current.moment.elapsedSeconds, floorHorizon,
        at => advance(current, at).moment.ball.position.y <= profile.ground.radiusM);
      if (time <= current.moment.elapsedSeconds) throw new Error('continuous ground boundary cannot advance source time');
      current = time <= descriptor.throughElapsedSeconds ? impact(advance(current, time)) : advance(current, requestedEnd);
      if (materialForce && time <= descriptor.throughElapsedSeconds) {
        latticeOrigin = current.moment.elapsedSeconds;
        stepSeconds = resolveAerodynamicIntegrationStepTicksV1(current.moment.ball.spin, profile.air) / p;
        cellIndex = 1; resetLattice = true;
      }
    } else current = end <= descriptor.throughElapsedSeconds ? proposed : advance(current, requestedEnd);
    samples.push(current);
    if (!resetLattice && current.moment.elapsedSeconds === cellEnd) cellIndex++;
  }
  freeze(samples); freeze(boundaries);
  const norm = (v: Readonly<{ x: number; y: number; z: number }>) => Math.hypot(v.x, v.y, v.z);
  const cells = freeze(samples.slice(0, -1).map((anchor, index) => {
    const next = samples[index + 1], duration = next.moment.elapsedSeconds - anchor.moment.elapsedSeconds;
    const maximumPositionSpeedMps = anchor.phase === 'airborne'
      ? boundSourceRk4PositionSpeed(anchor.moment.ball, duration, profile.air)
      : Math.max(norm(anchor.moment.ball.velocity), norm(next.moment.ball.velocity));
    const positionRoundingBoundMeters = (groundPositionCorrections.get(next.moment.elapsedSeconds) ?? 0)
      + (anchor.phase === 'airborne' ? 0 : Math.abs(anchor.moment.ball.position.y - profile.ground.radiusM))
      + 64 * Number.EPSILON * Math.max(1, norm(anchor.moment.ball.position), norm(next.moment.ball.position));
    if (![maximumPositionSpeedMps, positionRoundingBoundMeters].every(Number.isFinite)) throw new Error('nonlinear Source cell bound overflows');
    return { fromElapsedSeconds: anchor.moment.elapsedSeconds, throughElapsedSeconds: next.moment.elapsedSeconds,
      maximumPositionSpeedMps, positionRoundingBoundMeters };
  }));
  const evaluateAt = (elapsedSeconds: number, side: 'incoming' | 'outgoing' = 'outgoing'): SourceFreeBallEvaluation => {
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < initial.elapsedSeconds
      || elapsedSeconds > descriptor.throughElapsedSeconds || !['incoming', 'outgoing'].includes(side)) {
      throw new Error('nonlinear free ball Source evaluation exceeds its physical horizon');
    }
    if (side === 'incoming' && groundIncoming.has(elapsedSeconds)) return freeze(groundIncoming.get(elapsedSeconds)!);
    let low = 0, high = samples.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (samples[middle].moment.elapsedSeconds <= elapsedSeconds) low = middle; else high = middle - 1;
    }
    const anchor = samples[low];
    return anchor.moment.elapsedSeconds === elapsedSeconds ? anchor : freeze(advance(anchor, elapsedSeconds));
  };
  return Object.freeze({ descriptor: freeze(descriptor), boundaries, cells, evaluateAt });
};

export const createContinuousBattedBallFlightEvidence = (contact: BatBallContactResult, searchDurationTicks: number,
  profile: AeroGroundBallPhysicsV1, materialOrientationAtStart?: Quaternion): BattedBallFlightEvidence => {
  if (!Number.isSafeInteger(searchDurationTicks) || searchDurationTicks < 0) throw new Error('invalid continuous batted flight horizon');
  const original = cloneInert(contact), initialBall = createBattedBallInitialStateFromContact(original);
  const kernel = createSourceFreeBallKernel({ kind: 'aero_ground_continuous_source_kernel_v2',
    initial: { originTick: initialBall.tick, elapsedSeconds: 0, ball: initialBall },
    throughElapsedSeconds: searchDurationTicks / profile.air.ticksPerSecond, profile,
    ...(materialOrientationAtStart === undefined ? {} : { materialOrientationAtStart }) });
  const first = kernel.boundaries.find(b => b.kind === 'ground');
  const incoming = first ? kernel.evaluateAt(first.elapsedSeconds, 'incoming').moment.ball : null;
  return freeze({ contact: original, initialBall, ballRadiusMeters: profile.ground.radiusM,
    firstGroundContact: incoming ? { tick: incoming.tick, state: incoming } : null });
};

