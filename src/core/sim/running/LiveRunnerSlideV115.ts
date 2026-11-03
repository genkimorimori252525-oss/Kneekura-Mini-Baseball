import type { Vec2 } from '../../model/geometry';
import { createLiveRunnerMotionV1, type LiveRunnerMotionInputV1, type LiveRunnerMotionSampleV1,
  type LiveRunnerMotionSpeedSegmentV1, type LiveRunnerMotionV1 } from './LiveRunnerMotionV1';
import { sampleRunnerRoute } from './RunnerRoute';

export type LiveRunnerSlideInputV115 = LiveRunnerMotionInputV1 & Readonly<{
  style: 'feet_first' | 'head_first';
  heightMeters: number;
  reachMeters?: number;
  frictionCoefficient: number;
  gravityMps2: number;
  /** Minimum time for the grounded rise; motor limits can lengthen it. */
  recoverySeconds: number;
}>;
export type LiveRunnerSlideBodyPointV115 = Readonly<{
  position: Vec2; heightMeters: number; velocity: Vec2; heightVelocityMps: number;
}>;
export type LiveRunnerSlideBodyV115 = Readonly<{
  phase: 'run' | 'slide' | 'recover' | 'stand';
  /** Horizontal ground projection of the same COM anchor as the motion sample. */
  position: Vec2;
  hip: LiveRunnerSlideBodyPointV115;
  torso: LiveRunnerSlideBodyPointV115;
  head: LiveRunnerSlideBodyPointV115;
  /** Active foot (feet-first) or hand (head-first), in world ground coordinates. */
  contactPoint: Vec2;
  contactHeightMeters: number;
}>;
export type LiveRunnerSlideMotionV115 = LiveRunnerMotionV1 & Readonly<{
  slideV115: Readonly<{
    style: LiveRunnerSlideInputV115['style'];
    fromSeconds: number;
    touchSeconds: number;
    stopSeconds: number;
    recoveryEndSeconds: number;
    reachMeters: number;
    maximumContactSpeedMps: number;
    /** Includes lowering/rising head and torso, for continuous tag queries. */
    maximumBodySpeedMps: number;
  }>;
  sampleBodyAtElapsedSeconds: (elapsedSeconds: number) => LiveRunnerSlideBodyV115;
}>;

const norm = (v: Vec2) => Math.hypot(v.x, v.z);
const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, z: a.z - b.z });
const along = (p: Vec2, heading: Vec2, d: number): Vec2 => ({ x: p.x + heading.x * d, z: p.z + heading.z * d });
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
const smooth = (n: number) => { const u = clamp(n, 0, 1); return u * u * (3 - 2 * u); };
const smoothRate = (u: number) => u <= 0 || u >= 1 ? 0 : 6 * u * (1 - u);
/** Return the upper (inside/arrived) witness, without a simulation time step. */
const root = (low: number, high: number, f: (n: number) => number) => {
  for (let i = 0; i < 70; i++) {
    const middle = (low + high) / 2;
    if (f(middle) < 0) low = middle; else high = middle;
  }
  return high;
};

/** A grounded body proxy, not motion-capture calibration. Running supplies the
 * exact source velocity. A straight friction slide stops behind the bag; the
 * active limb bends after reaching it, then a motor-limited rise moves the COM
 * to the bag while retaining contact. Null leaves the caller's old plan intact. */
export function createLiveRunnerSlideV115(input: LiveRunnerSlideInputV115): LiveRunnerSlideMotionV115 | null {
  if (input.style !== 'feet_first' && input.style !== 'head_first') throw new Error('live runner slide: unknown style');
  if (input.bases.length !== 1) throw new Error('live runner slide: a single target base is required');
  if (input.style === 'feet_first' && input.bases[0].base === 1)
    throw new Error('live runner slide: feet-first at first base is forbidden');
  const reach = input.reachMeters ?? .48 * input.heightMeters + (input.style === 'head_first' ? .05 : 0);
  if (![input.heightMeters, reach, input.frictionCoefficient, input.gravityMps2, input.recoverySeconds]
    .every(n => Number.isFinite(n) && n > 0)) throw new Error('live runner slide: finite positive body and surface controls required');
  const run = createLiveRunnerMotionV1({ ...input, terminalMode: 'through' });
  if (!run) return null;
  const last = run.route.segments.at(-1)!;
  // No turning while the body is grounded in a slide. A curved final approach
  // must remain with the ordinary runner controller until a feasible replan.
  if (last.kind !== 'line') return null;
  const bag = { ...input.bases[0].position }, length = run.lengthMeters,
    finalStraightLength = norm(sub(last.end, last.start)), straightStart = length - finalStraightLength,
    heading = { x: (last.end.x - last.start.x) / finalStraightLength, z: (last.end.z - last.start.z) / finalStraightLength },
    deceleration = input.frictionCoefficient * input.gravityMps2,
    touchRadius = input.baseTouchRadiusMeters ?? .28,
    // Stop before the center within limb reach. A small runner's COM may enter
    // the disk after the forward limb; disk entry is not a minimum body size.
    // The remaining displacement belongs to recovery.
    stopOffset = .4 * reach, stopDistance = length - stopOffset;
  if (!(stopOffset > 0 && stopDistance > straightStart)) return null;
  const stoppingResidual = (d: number) => {
    const speed = run.sampleAtElapsedSeconds(run.elapsedSecondsAtDistanceMeters(d)).speedMps;
    return d + speed * speed / (2 * deceleration) - stopDistance;
  };
  if (stoppingResidual(straightStart) > 1e-9) return null;
  const launchDistance = root(straightStart, stopDistance, stoppingResidual),
    fromSeconds = run.elapsedSecondsAtDistanceMeters(launchDistance), launch = run.sampleAtElapsedSeconds(fromSeconds),
    slideDuration = launch.speedMps / deceleration;
  // If ordinary ground contact has already entered the bag disk, retain that
  // plan rather than manufacture a later "first" touch while lowering the body.
  if (!(slideDuration > .08 && launch.speedMps > .2 && launchDistance < length - touchRadius)) return null;
  const stopSeconds = fromSeconds + slideDuration,
    deploymentSeconds = Math.min(.28, slideDuration * .25),
    stopPosition = sampleRunnerRoute(run.route, stopDistance).position,
    braking = input.brakingMps2 ?? 1.8 * input.accelerationMps2,
    recoveryDuration = Math.max(input.recoverySeconds, 2 * stopOffset / input.topSpeedMps,
      Math.sqrt(4 * stopOffset / Math.min(input.accelerationMps2, braking))),
    recoveryEndSeconds = stopSeconds + recoveryDuration,
    recoveryAcceleration = 4 * stopOffset / (recoveryDuration * recoveryDuration),
    recoveryMidSeconds = stopSeconds + recoveryDuration / 2;
  const segments: LiveRunnerMotionSpeedSegmentV1[] = run.speedSegments.filter(s => s.startElapsedSeconds < fromSeconds).map(s => ({
    ...s, endElapsedSeconds: Math.min(s.endElapsedSeconds, fromSeconds), endDistanceMeters: Math.min(s.endDistanceMeters, launchDistance),
  }));
  segments.push({ startElapsedSeconds: fromSeconds, endElapsedSeconds: stopSeconds,
    startDistanceMeters: launchDistance, endDistanceMeters: stopDistance, startSpeedMps: launch.speedMps, accelerationMps2: -deceleration },
  { startElapsedSeconds: stopSeconds, endElapsedSeconds: recoveryMidSeconds,
    startDistanceMeters: stopDistance, endDistanceMeters: stopDistance + stopOffset / 2, startSpeedMps: 0, accelerationMps2: recoveryAcceleration },
  { startElapsedSeconds: recoveryMidSeconds, endElapsedSeconds: recoveryEndSeconds,
    startDistanceMeters: stopDistance + stopOffset / 2, endDistanceMeters: length,
    startSpeedMps: recoveryAcceleration * recoveryDuration / 2, accelerationMps2: -recoveryAcceleration });

  const sampleAtElapsedSeconds = (elapsed: number): LiveRunnerMotionSampleV1 => {
    if (!Number.isFinite(elapsed)) throw new Error('live runner slide: elapsed time must be finite');
    if (elapsed <= fromSeconds) return run.sampleAtElapsedSeconds(elapsed);
    if (elapsed >= recoveryEndSeconds) return { position: { ...bag }, velocity: { x: 0, z: 0 }, speedMps: 0, distanceMeters: length };
    if (elapsed <= stopSeconds) {
      const t = elapsed - fromSeconds, speed = Math.max(0, launch.speedMps - deceleration * t),
        distance = Math.min(stopDistance, launchDistance + launch.speedMps * t - .5 * deceleration * t * t);
      return { position: along(launch.position, heading, distance - launchDistance),
        velocity: { x: heading.x * speed, z: heading.z * speed }, speedMps: speed, distanceMeters: distance };
    }
    const local = elapsed - stopSeconds, remaining = recoveryEndSeconds - elapsed,
      firstHalf = elapsed <= recoveryMidSeconds,
      distance = firstHalf ? .5 * recoveryAcceleration * local * local : stopOffset - .5 * recoveryAcceleration * remaining * remaining,
      speed = recoveryAcceleration * (firstHalf ? local : remaining);
    return { position: along(stopPosition, heading, distance), velocity: { x: heading.x * speed, z: heading.z * speed },
      speedMps: speed, distanceMeters: stopDistance + distance };
  };
  const elapsedSecondsAtDistanceMeters = (distance: number): number => {
    if (!Number.isFinite(distance) || distance < 0 || distance > length + 1e-10)
      throw new Error('live runner slide: distance must lie on finite route');
    if (distance <= launchDistance) return run.elapsedSecondsAtDistanceMeters(distance);
    if (distance >= length) return recoveryEndSeconds;
    const s = segments.find(s => distance <= s.endDistanceMeters)!;
    const local = distance - s.startDistanceMeters,
      speed = Math.sqrt(Math.max(0, s.startSpeedMps ** 2 + 2 * s.accelerationMps2 * local));
    return s.startElapsedSeconds + (local === 0 ? 0 : 2 * local / (s.startSpeedMps + speed));
  };
  const sampleBodyAtElapsedSeconds = (elapsed: number): LiveRunnerSlideBodyV115 => {
    const motion = sampleAtElapsedSeconds(elapsed), phase = elapsed < fromSeconds ? 'run' : elapsed < stopSeconds ? 'slide'
      : elapsed < recoveryEndSeconds ? 'recover' : 'stand',
      lowered = elapsed < stopSeconds ? smooth((elapsed - fromSeconds) / deploymentSeconds)
        : 1 - smooth((elapsed - stopSeconds) / recoveryDuration),
      loweredRate = elapsed < stopSeconds ? smoothRate((elapsed - fromSeconds) / deploymentSeconds) / deploymentSeconds
        : -smoothRate((elapsed - stopSeconds) / recoveryDuration) / recoveryDuration,
      height = input.heightMeters,
      torsoOffset = (input.style === 'head_first' ? .22 : -.13) * height * lowered,
      headOffset = (input.style === 'head_first' ? .38 : -.33) * height * lowered,
      point = (offset: number, standingHeight: number, heightDrop: number, forwardFactor: number): LiveRunnerSlideBodyPointV115 => ({
        position: along(motion.position, heading, offset), heightMeters: height * (standingHeight - heightDrop * lowered),
        velocity: along(motion.velocity, heading, forwardFactor * height * loweredRate), heightVelocityMps: -height * heightDrop * loweredRate,
      });
    let contactPoint: Vec2;
    if (elapsed < fromSeconds) contactPoint = { ...motion.position };
    else if (elapsed < stopSeconds) contactPoint = along(motion.position, heading,
      Math.min(reach * smooth((elapsed - fromSeconds) / deploymentSeconds), Math.max(0, length - motion.distanceMeters)));
    else contactPoint = { ...bag };
    return { phase, position: motion.position,
      hip: point(0, .53, .39, 0),
      torso: point(torsoOffset, .74, .56, input.style === 'head_first' ? .22 : -.13),
      head: point(headOffset, .94, .71, input.style === 'head_first' ? .38 : -.33),
      contactPoint, contactHeightMeters: 0 };
  };
  let touchSeconds = root(fromSeconds, stopSeconds, elapsed => {
    const sample = sampleAtElapsedSeconds(elapsed);
    return sample.distanceMeters + reach * smooth((elapsed - fromSeconds) / deploymentSeconds) - (length - touchRadius);
  });
  // Retain an actual in-disk floating-point witness for strict touch consumers.
  for (let attempt = 0; attempt < 12 && norm(sub(sampleBodyAtElapsedSeconds(touchSeconds).contactPoint, bag)) > touchRadius; attempt++)
    touchSeconds = Math.min(stopSeconds, touchSeconds + Number.EPSILON * Math.max(1, touchSeconds) * 2 ** attempt);
  const touch = sampleAtElapsedSeconds(touchSeconds);
  return Object.freeze({ route: run.route, lengthMeters: length, durationSeconds: recoveryEndSeconds,
    speedSegments: segments, touches: [{ base: input.bases[0].base, distanceMeters: touch.distanceMeters,
      elapsedSeconds: touchSeconds, position: sampleBodyAtElapsedSeconds(touchSeconds).contactPoint,
      centerDistanceMeters: length, centerElapsedSeconds: recoveryEndSeconds }],
    slideV115: { style: input.style, fromSeconds, touchSeconds, stopSeconds, recoveryEndSeconds,
      reachMeters: reach, maximumContactSpeedMps: input.topSpeedMps + 1.5 * reach / deploymentSeconds,
      maximumBodySpeedMps: Math.max(input.topSpeedMps + 1.5 * reach / deploymentSeconds,
        input.topSpeedMps + 1.5 * input.heightMeters * Math.hypot(.38, .71) / Math.min(deploymentSeconds, recoveryDuration)) },
    sampleAtElapsedSeconds, elapsedSecondsAtDistanceMeters, sampleBodyAtElapsedSeconds });
}
