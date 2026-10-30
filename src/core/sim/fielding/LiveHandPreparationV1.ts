import type { Vec3 } from '../../model/geometry';

export type LiveHandPreparationInputV1 = Readonly<{
  fromElapsedSeconds: number; initialOffset: Vec3; initialRelativeVelocity: Vec3; targetOffset: Vec3;
  maximumRelativeSpeedMps: number; maximumReachMeters: number;
}>;
export type LiveHandPreparationSampleV1 = Readonly<{
  offset: Vec3; relativeVelocity: Vec3; relativeAcceleration: Vec3;
}>;
export type LiveHandPreparationBezierControlsV1 = readonly [Vec3, Vec3, Vec3, Vec3];
const zero: Vec3 = Object.freeze({ x: 0, y: 0, z: 0 });
const norm = (p: Vec3) => Math.hypot(p.x, p.y, p.z);
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const mul = (p: Vec3, scale: number): Vec3 => ({ x: p.x * scale, y: p.y * scale, z: p.z * scale });
const finiteVec = (p: Vec3) => !!p && typeof p === 'object' && [p.x, p.y, p.z].every(Number.isFinite);
const copy = (p: Vec3): Vec3 => Object.freeze({ x: p.x, y: p.y, z: p.z });
const controls = (a: Vec3, b: Vec3, c: Vec3, d: Vec3): LiveHandPreparationBezierControlsV1 =>
  Object.freeze([copy(a), copy(b), copy(c), copy(d)]);
const unreachable = (reason: 'INVALID_FINITE_HAND_PREPARATION_INPUT' | 'ENDPOINT_OUTSIDE_REACH'
  | 'INITIAL_RELATIVE_SPEED_EXCEEDS_MOTOR' | 'NO_FINITE_C1_PREPARATION_WITHIN_CONTROL_BOUNDS', candidateCount = 0) =>
  Object.freeze({ kind: 'unreachable' as const, reason, candidateCount });

/** A body-relative hand command only. The original hand position and velocity
 * are boundary data, never projected into reach or replaced with a rest pose.
 * Cubic Hermite controls are [a, a + T*v/3, b, b]. Their convex hull proves
 * continuous reach; derivative controls [v, 3*(b-a)/T-v, 0] prove motor speed.
 * Failure means this finite conservative certificate was unavailable, not that
 * every possible anatomical trajectory is impossible. No ball Source is read. */
export function createLiveHandPreparationV1(raw: LiveHandPreparationInputV1) {
  if (!raw || typeof raw !== 'object' || !Number.isFinite(raw.fromElapsedSeconds) || raw.fromElapsedSeconds < 0
    || ![raw.initialOffset, raw.initialRelativeVelocity, raw.targetOffset].every(finiteVec)
    || !Number.isFinite(raw.maximumRelativeSpeedMps) || raw.maximumRelativeSpeedMps <= 0
    || !Number.isFinite(raw.maximumReachMeters) || raw.maximumReachMeters <= 0)
    return unreachable('INVALID_FINITE_HAND_PREPARATION_INPUT');
  const from = raw.fromElapsedSeconds, a = copy(raw.initialOffset), v = copy(raw.initialRelativeVelocity), b = copy(raw.targetOffset),
    speedLimit = raw.maximumRelativeSpeedMps, reach = raw.maximumReachMeters,
    initialReach = norm(a), targetReach = norm(b), initialSpeed = norm(v), delta = sub(b, a), distance = norm(delta);
  if (initialReach > reach || targetReach > reach) return unreachable('ENDPOINT_OUTSIDE_REACH');
  if (initialSpeed > speedLimit) return unreachable('INITIAL_RELATIVE_SPEED_EXCEEDS_MOTOR');
  if (!Number.isFinite(distance)) return unreachable('NO_FINITE_C1_PREPARATION_WITHIN_CONTROL_BOUNDS');

  // Solve the derivative-control speed inequality for T >= minimumDuration.
  // Normalized roots avoid squaring SI magnitudes and cancellation when v
  // points away from the target. Zero initial speed gives T >= 3*distance/S.
  const speedRatio = initialSpeed / speedLimit, speedSlack = (1 - speedRatio) * (1 + speedRatio),
    projection = distance === 0 ? 0 : dot(mul(delta, 1 / distance), mul(v, 1 / speedLimit)),
    speedRoot = Math.sqrt(projection * projection + speedSlack),
    speedDenominator = projection < 0 ? speedSlack / (speedRoot - projection) : projection + speedRoot,
    minimumDuration = distance === 0 ? 0 : 3 * (distance / speedLimit) / speedDenominator;
  // The sole moving position control must remain in the reach sphere.
  const reachRatio = initialReach / reach, reachSlack = (1 - reachRatio) * (1 + reachRatio),
    outward = initialSpeed === 0 ? 0 : dot(mul(a, 1 / reach), mul(v, 1 / initialSpeed)),
    reachRoot = Math.sqrt(outward * outward + reachSlack),
    reachFactor = outward > 0 ? reachSlack / (reachRoot + outward) : reachRoot - outward,
    maximumDuration = initialSpeed === 0 ? Infinity : 3 * (reach / initialSpeed) * reachFactor;
  if (!Number.isFinite(minimumDuration) || minimumDuration > maximumDuration || maximumDuration <= 0)
    return unreachable('NO_FINITE_C1_PREPARATION_WITHIN_CONTROL_BOUNDS');

  const build = (durationSeconds: number, throughElapsedSeconds: number, fullControls: LiveHandPreparationBezierControlsV1,
    controlPointReachBoundMeters: number, derivativeControlSpeedBoundMps: number, candidateCount: number) => {
    const accelerationAt = (u: number): Vec3 => durationSeconds === 0 ? zero
      : add(mul(mul(delta, 1 / durationSeconds), (6 - 12 * u) / durationSeconds), mul(v, (6 * u - 4) / durationSeconds));
    const sampleAtElapsedSeconds = (t: number): LiveHandPreparationSampleV1 => {
      if (!Number.isFinite(t) || t < from || t > throughElapsedSeconds) throw new Error('live hand preparation: sample outside command interval');
      const u = durationSeconds === 0 ? 0 : (t - from) / durationSeconds;
      // Preserve actual endpoint values exactly, including an initial nonzero
      // velocity. Interior evaluation is the same Hermite polynomial.
      const offset = t === from ? a : t === throughElapsedSeconds ? b
        : add(add(a, mul(delta, u * u * (3 - 2 * u))), mul(v, durationSeconds * u * (1 - u) * (1 - u))),
        relativeVelocity = t === from ? v : t === throughElapsedSeconds ? zero
          : add(mul(delta, 6 * u * (1 - u) / durationSeconds), mul(v, (1 - u) * (1 - 3 * u)));
      return Object.freeze({ offset: copy(offset), relativeVelocity: copy(relativeVelocity), relativeAcceleration: copy(accelerationAt(u)) });
    };
    const cubicBezierControls = (startElapsedSeconds: number, endElapsedSeconds: number): LiveHandPreparationBezierControlsV1 => {
      if (!Number.isFinite(startElapsedSeconds) || !Number.isFinite(endElapsedSeconds) || startElapsedSeconds < from
        || endElapsedSeconds > throughElapsedSeconds || endElapsedSeconds < startElapsedSeconds)
        throw new Error('live hand preparation: Bezier interval outside command interval');
      if (startElapsedSeconds === from && endElapsedSeconds === throughElapsedSeconds) return fullControls;
      const start = sampleAtElapsedSeconds(startElapsedSeconds), end = sampleAtElapsedSeconds(endElapsedSeconds),
        third = (endElapsedSeconds - startElapsedSeconds) / 3;
      return controls(start.offset, add(start.offset, mul(start.relativeVelocity, third)), sub(end.offset, mul(end.relativeVelocity, third)), end.offset);
    };
    return Object.freeze({ kind: 'planned' as const, fromElapsedSeconds: from, throughElapsedSeconds, durationSeconds,
      sampleAtElapsedSeconds, cubicBezierControls, diagnostics: Object.freeze({ basis: 'CUBIC_BEZIER_CONVEX_HULL_V1' as const,
        maximumReachMeters: reach, maximumRelativeSpeedMps: speedLimit, controlPointReachBoundMeters,
        derivativeControlSpeedBoundMps, candidateCount }) });
  };
  if (distance === 0 && initialSpeed === 0) return build(0, from, controls(a, a, a, a), initialReach, 0, 0);

  // All feasible real durations lie in the analytic interval above. Try only
  // four candidates, including both bounds; verification uses the duration
  // representable by the actual absolute elapsed endpoints, without a nudge.
  const preferred = minimumDuration > 0 ? minimumDuration * 1.0625 : Math.min(1, reach / speedLimit),
    midpoint = minimumDuration / 2 + maximumDuration / 2,
    candidates = [Math.min(preferred, midpoint), minimumDuration, midpoint, maximumDuration];
  let candidateCount = 0;
  for (const candidate of candidates) {
    const through = from + candidate, duration = through - from;
    if (!Number.isFinite(candidate) || !Number.isFinite(through) || !Number.isFinite(duration) || duration <= 0) continue;
    candidateCount++;
    const fullControls = controls(a, add(a, mul(v, duration / 3)), b, b),
      middleDerivative = sub(mul(delta, 3 / duration), v),
      derivativeControls = fullControls.slice(1).map((point, n) => mul(sub(point, fullControls[n]), 3 / duration)),
      reachBound = Math.max(...fullControls.map(norm)), speedBound = Math.max(initialSpeed, norm(middleDerivative), ...derivativeControls.map(norm)),
      startAcceleration = add(mul(mul(delta, 1 / duration), 6 / duration), mul(v, -4 / duration)),
      endAcceleration = add(mul(mul(delta, 1 / duration), -6 / duration), mul(v, 2 / duration));
    if (!fullControls.every(finiteVec) || !derivativeControls.every(finiteVec) || !finiteVec(middleDerivative) || !finiteVec(startAcceleration) || !finiteVec(endAcceleration)
      || reachBound > reach || speedBound > speedLimit) continue;
    return build(duration, through, fullControls, reachBound, speedBound, candidateCount);
  }
  return unreachable('NO_FINITE_C1_PREPARATION_WITHIN_CONTROL_BOUNDS', candidateCount);
}

export type LiveHandPreparationV1 = ReturnType<typeof createLiveHandPreparationV1>;
