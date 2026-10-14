import type { Vec3 } from '../../core/model/geometry';
import type { PitchWorldState } from '../../core/sim/contact/BatBallContact';
import {
  advanceAerodynamicPitchState,
  type AerodynamicPitchTrajectory,
} from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import {
  advanceBaseballOrientation,
  IDENTITY_QUATERNION,
  normalizeQuaternion,
  type Quaternion,
} from '../../core/sim/pitching/BaseballOrientation';

const MAX_INTEGRATION_ANCHORS = 100_000;
const MAX_PRESENTATION_FRAMES = 20_000;
const SPIN_ZERO_EPSILON = 1e-12;
const HALF_TURN = Math.PI;
const QUARTER_TURN = Math.PI / 2;

/**
 * Native spin is WORLD-SPACE angular velocity in radians per second.
 * The source trajectory (including its aerodynamic torque/spin decay) is the
 * only authority for spin: frame cadence, camera, zoom, blur and glyph pose
 * never alter it. These are DISPLAY observations, not new physics facts.
 */
export type NativeSpinOrientationProvenance =
  | 'native_source_release_orientation'
  | 'identity_display_convention_uncalibrated';

export type NativeSpinShutterObservation = Readonly<{
  /** Requested camera exposure; no arbitrary camera exposure is chosen here. */
  requestedShutterTicks: number;
  /** Actual source interval, clipped to release/physical-stop boundaries. */
  openTick: number;
  closeTick: number;
  exposureSeconds: number;
  /** Unwrapped integral of |actual omega_world(t)| dt over the exposure. */
  angularTravelRadians: number;
  rotationsDuringExposure: number;
  /** Source-backed orientations at exposure boundaries; not interpolated
   * from two sampled 55ms glyph poses. */
  openOrientation: Quaternion;
  closeOrientation: Quaternion;
  /** Deterministic visual-sampling guidance: at most a quarter-turn between
   * sub-exposure observations. NOT a physical collision step or guarantee of
   * flicker-free output. */
  quarterTurnSampleCount: number;
  /** This is a heuristic visibility warning, never a speed/angle correction. */
  singleSamplePhaseAliasingRisk: boolean;
}>;

export type NativeSpinOrientationFrame = Readonly<{
  authority: 'PRESENTATION_ONLY_NATIVE_SPIN';
  /** An exact integer tick in the original Core flight clock. */
  tick: number;
  elapsedSecondsSinceRelease: number;
  ticksPerSecond: number;
  /** The same source physical spin Core calculates at this precise tick. */
  angularVelocityWorldRadPerSecond: Vec3;
  angularSpeedRadPerSecond: number;
  spinAxisWorld: Vec3 | null;
  /** Maps ball-local material/seam points into the physical world frame. */
  orientationMaterialToWorld: Quaternion;
  orientationProvenance: NativeSpinOrientationProvenance;
  /** False means identity is only an explicitly uncalibrated seam-phase origin. */
  hasSourceReleaseOrientation: boolean;
  /** Unwrapped angular travel, useful even after multiple quaternion turns. */
  angularTravelSinceReleaseRadians: number;
  /** Previous display frame is optional, never a simulation step. */
  previousFrameTick: number | null;
  angularTravelSincePreviousFrameRadians: number | null;
  interframePhaseAliasingRisk: boolean | null;
  shutter: NativeSpinShutterObservation;
}>;

export type NativeSpinOrientationSampleOptions = Readonly<{
  /** Explicit presentation shutter width (in exact canonical ticks).
   * A zero-width shutter yields an instantaneous observation. */
  shutterTicks: number;
  /** The previous VISUAL frame tick, not a previous physical state. */
  previousFrameTick?: number;
}>;

export type NativeSpinOrientationObserverInput = Readonly<{
  trajectory: AerodynamicPitchTrajectory;
  /** Only needed when an actual Native contact/dead-ball event stops the
   * pitch. This observer never fabricates flight or spin after that tick. */
  physicalStopTick?: number;
}>;

export type NativeSpinOrientationObserver = Readonly<{
  releaseTick: number;
  physicalStopTick: number;
  ticksPerSecond: number;
  orientationProvenance: NativeSpinOrientationProvenance;
  sampleAtTick: (tick: number, options: NativeSpinOrientationSampleOptions) => NativeSpinOrientationFrame;
  /** Explicit, strictly monotonic high-frequency source-clock render ticks.
   * Results match independent sampleAtTick calls at the exact same ticks. */
  sampleFrameTicks: (
    ticks: readonly number[],
    options: Readonly<{ shutterTicks: number }>,
  ) => readonly NativeSpinOrientationFrame[];
}>;

type SpinIntegrationAnchor = Readonly<{
  tick: number;
  physical: PitchWorldState;
  materialOrientation: Quaternion;
  unwrappedAngularTravelRadians: number;
}>;

function requireTick(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('Native spin orientation ' + name + ' must be a non-negative safe integer tick.');
  }
}

function finiteVector(value: Vec3, name: string): void {
  if (value === null || typeof value !== 'object'
    || !Number.isFinite(value.x) || !Number.isFinite(value.y) || !Number.isFinite(value.z)) {
    throw new Error('Native spin orientation requires finite ' + name + ' vector components.');
  }
}

function copyAndFreezeInert<T>(value: T): T {
  const ancestors = new Set<object>();
  let nodes = 0;
  const visit = (current: unknown, depth: number): unknown => {
    nodes++;
    if (nodes > 100_000 || depth > 64) {
      throw new Error('Native spin source exceeds pure-data size/depth limits.');
    }
    if (current === null || typeof current === 'string' || typeof current === 'boolean') return current;
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) throw new Error('Native spin source requires finite numbers.');
      return current === 0 ? 0 : current;
    }
    if (typeof current !== 'object') {
      throw new Error('Native spin source must contain inert physics data only.');
    }
    if (ancestors.has(current)) throw new Error('Native spin source must not contain cycles.');
    ancestors.add(current);
    if (Array.isArray(current)) {
      if (Reflect.ownKeys(current).length !== current.length + 1) {
        throw new Error('Native spin source requires dense arrays.');
      }
      const array: unknown[] = [];
      for (let i = 0; i < current.length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(current, String(i));
        if (!descriptor?.enumerable || !('value' in descriptor)) {
          throw new Error('Native spin source must not contain accessors.');
        }
        array.push(visit(descriptor.value, depth + 1));
      }
      ancestors.delete(current);
      return Object.freeze(array);
    }
    const prototype = Object.getPrototypeOf(current);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error('Native spin source requires plain physical-data objects.');
    }
    const out: Record<string, unknown> = {};
    for (const key of Reflect.ownKeys(current)) {
      if (typeof key !== 'string') throw new Error('Native spin source rejects symbol keys.');
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (!descriptor?.enumerable || !('value' in descriptor)) {
        throw new Error('Native spin source must not contain accessors.');
      }
      if (descriptor.value === undefined) continue;
      Object.defineProperty(out, key, {
        value: visit(descriptor.value, depth + 1),
        enumerable: true,
      });
    }
    ancestors.delete(current);
    return Object.freeze(out);
  };
  return visit(value, 0) as T;
}

function speed(spin: Vec3): number {
  return Math.hypot(spin.x, spin.y, spin.z);
}

function finiteSpin(state: PitchWorldState, tick: number): void {
  if (state.tick !== tick) {
    throw new Error('Native spin physical sampler returned a different canonical tick.');
  }
  finiteVector(state.spin, 'angular velocity');
  finiteVector(state.position, 'ball position');
  finiteVector(state.velocity, 'ball velocity');
}

/**
 * Source-locked second-order world-angular-velocity integration.
 *
 * For each interval on the Native RK4 tick grid, evaluate the actual RK4
 * angular-velocity history at start, midpoint and endpoint. Simpson
 * quadrature integrates its vector for a single world-frame axis-angle
 * increment; pre-multiplication follows BaseballOrientation's world-space
 * convention. Repeated small steps capture variable spin/spin decay without
 * inventing a separate animated RPM. This is a VISUAL quaternion integrator,
 * not a replacement for Core physics.
 */
function integrateInterval(
  current: SpinIntegrationAnchor,
  deltaTicks: number,
  trajectory: AerodynamicPitchTrajectory,
): SpinIntegrationAnchor {
  if (deltaTicks === 0) return current;
  const { parameters } = trajectory;
  const halfTicks = Math.floor(deltaTicks / 2);
  const midpoint = advanceAerodynamicPitchState(current.physical, halfTicks, parameters);
  const endpoint = advanceAerodynamicPitchState(current.physical, deltaTicks, parameters);
  const s0 = current.physical.spin;
  const sm = midpoint.spin;
  const s1 = endpoint.spin;
  const elapsedSeconds = deltaTicks / parameters.ticksPerSecond;
  const angularVelocityMean: Vec3 = {
    x: (s0.x + 4 * sm.x + s1.x) / 6,
    y: (s0.y + 4 * sm.y + s1.y) / 6,
    z: (s0.z + 4 * sm.z + s1.z) / 6,
  };
  const materialOrientation = advanceBaseballOrientation(
    current.materialOrientation,
    angularVelocityMean,
    elapsedSeconds,
  );
  const angularTravel = elapsedSeconds * (
    speed(s0) + 4 * speed(sm) + speed(s1)
  ) / 6;
  if (!Number.isFinite(angularTravel)) {
    throw new Error('Native spin physical angular travel must be finite.');
  }
  finiteSpin(endpoint, current.tick + deltaTicks);
  return {
    tick: endpoint.tick,
    physical: endpoint,
    materialOrientation,
    unwrappedAngularTravelRadians: current.unwrappedAngularTravelRadians + angularTravel,
  };
}

/** One genuine Native pitch in, source-clock poses out. No match/collision,
 * independent spin profile, camera animation state, or official ruling. */
export function createNativeSpinOrientationObserver(
  input: NativeSpinOrientationObserverInput,
): NativeSpinOrientationObserver {
  const trajectory = copyAndFreezeInert(input.trajectory);
  const { start, endTick, parameters } = trajectory;
  requireTick(start.tick, 'source release');
  requireTick(endTick, 'source end');
  requireTick(parameters.ticksPerSecond, 'ticksPerSecond');
  requireTick(parameters.integrationStepTicks, 'integrationStepTicks');
  if (endTick < start.tick || parameters.ticksPerSecond === 0
    || parameters.integrationStepTicks === 0) {
    throw new Error('Native spin requires a valid real flight interval and positive source clock.');
  }
  finiteSpin(start, start.tick);
  const physicalStopTick = input.physicalStopTick ?? endTick;
  requireTick(physicalStopTick, 'physical stop');
  if (physicalStopTick < start.tick || physicalStopTick > endTick) {
    throw new Error('Native spin stop tick must lie within the true source flight.');
  }
  if ((physicalStopTick - start.tick) / parameters.integrationStepTicks > MAX_INTEGRATION_ANCHORS) {
    throw new Error('Native spin source grid exceeds the bounded observation limit.');
  }
  const hasRelease = trajectory.releaseOrientation !== undefined;
  const releaseOrientation = hasRelease
    ? normalizeQuaternion(trajectory.releaseOrientation!)
    : IDENTITY_QUATERNION;
  const orientationProvenance: NativeSpinOrientationProvenance = hasRelease
    ? 'native_source_release_orientation'
    : 'identity_display_convention_uncalibrated';
  const anchors: SpinIntegrationAnchor[] = [{
    tick: start.tick,
    physical: start,
    materialOrientation: releaseOrientation,
    unwrappedAngularTravelRadians: 0,
  }];
  const gridStep = parameters.integrationStepTicks;

  const integrateToTick = (tick: number): SpinIntegrationAnchor => {
    requireTick(tick, 'sample');
    if (tick < start.tick || tick > physicalStopTick) {
      throw new Error('Native spin cannot observe outside actual release/physical stop.');
    }
    const gridIndex = Math.floor((tick - start.tick) / gridStep);
    while (anchors.length <= gridIndex) {
      const prior = anchors[anchors.length - 1];
      anchors.push(integrateInterval(prior, gridStep, trajectory));
    }
    const base = anchors[gridIndex];
    return integrateInterval(base, tick - base.tick, trajectory);
  };

  const sampleAtTick = (
    tick: number,
    options: NativeSpinOrientationSampleOptions,
  ): NativeSpinOrientationFrame => {
    if (!options) throw new Error('Native spin requires explicit display shutter settings.');
    requireTick(options.shutterTicks, 'shutterTicks');
    const current = integrateToTick(tick);
    const previous = options.previousFrameTick;
    if (previous !== undefined) {
      requireTick(previous, 'previous frame');
      if (previous >= tick) {
        throw new Error('Native spin previous frame must strictly precede the current tick.');
      }
    }
    const previousAnchor = previous === undefined ? null : integrateToTick(previous);
    const openTick = Math.max(start.tick, tick - Math.floor(options.shutterTicks / 2));
    const closeTick = Math.min(physicalStopTick, tick + Math.ceil(options.shutterTicks / 2));
    const opened = integrateToTick(openTick);
    const closed = integrateToTick(closeTick);
    const shutterAngle = Math.max(0,
      closed.unwrappedAngularTravelRadians - opened.unwrappedAngularTravelRadians);
    const interframeAngle = previousAnchor === null ? null : Math.max(0,
      current.unwrappedAngularTravelRadians - previousAnchor.unwrappedAngularTravelRadians);
    const instantSpin = current.physical.spin;
    const angularSpeed = speed(instantSpin);
    const axis = angularSpeed <= SPIN_ZERO_EPSILON ? null : Object.freeze({
      x: instantSpin.x / angularSpeed,
      y: instantSpin.y / angularSpeed,
      z: instantSpin.z / angularSpeed,
    });
    const shutter: NativeSpinShutterObservation = {
      requestedShutterTicks: options.shutterTicks,
      openTick,
      closeTick,
      exposureSeconds: (closeTick - openTick) / parameters.ticksPerSecond,
      angularTravelRadians: shutterAngle,
      rotationsDuringExposure: shutterAngle / (2 * Math.PI),
      openOrientation: opened.materialOrientation,
      closeOrientation: closed.materialOrientation,
      quarterTurnSampleCount: Math.max(1, Math.ceil(shutterAngle / QUARTER_TURN) + 1),
      singleSamplePhaseAliasingRisk: shutterAngle > HALF_TURN,
    };
    return copyAndFreezeInert({
      authority: 'PRESENTATION_ONLY_NATIVE_SPIN' as const,
      tick,
      elapsedSecondsSinceRelease: (tick - start.tick) / parameters.ticksPerSecond,
      ticksPerSecond: parameters.ticksPerSecond,
      angularVelocityWorldRadPerSecond: instantSpin,
      angularSpeedRadPerSecond: angularSpeed,
      spinAxisWorld: axis,
      orientationMaterialToWorld: current.materialOrientation,
      orientationProvenance,
      hasSourceReleaseOrientation: hasRelease,
      angularTravelSinceReleaseRadians: current.unwrappedAngularTravelRadians,
      previousFrameTick: previous ?? null,
      angularTravelSincePreviousFrameRadians: interframeAngle,
      interframePhaseAliasingRisk: interframeAngle === null ? null : interframeAngle > HALF_TURN,
      shutter,
    });
  };

  const sampleFrameTicks = (
    ticks: readonly number[],
    options: Readonly<{ shutterTicks: number }>,
  ): readonly NativeSpinOrientationFrame[] => {
    if (!Array.isArray(ticks) || ticks.length > MAX_PRESENTATION_FRAMES) {
      throw new Error('Native spin requires a bounded array of high-frequency frame ticks.');
    }
    if (!options) throw new Error('Native spin requires explicit display shutter settings.');
    requireTick(options.shutterTicks, 'shutterTicks');
    for (let index = 0; index < ticks.length; index++) {
      requireTick(ticks[index], 'frame tick');
      if (index > 0 && ticks[index] <= ticks[index - 1]) {
        throw new Error('Native spin presentation timestamps must be strictly increasing.');
      }
      if (ticks[index] < start.tick || ticks[index] > physicalStopTick) {
        throw new Error('Native spin frame is outside true source flight.');
      }
    }
    return Object.freeze(ticks.map((tick, i) => sampleAtTick(tick, {
      shutterTicks: options.shutterTicks,
      previousFrameTick: i === 0 ? undefined : ticks[i - 1],
    })));
  };

  return Object.freeze({
    releaseTick: start.tick,
    physicalStopTick,
    ticksPerSecond: parameters.ticksPerSecond,
    orientationProvenance,
    sampleAtTick,
    sampleFrameTicks,
  });
}
