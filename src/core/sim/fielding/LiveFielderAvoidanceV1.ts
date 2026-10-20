import type { Vec3 } from '../../model/geometry';
import { livePropulsionAccelerationV84, type LiveLocomotionProfileV84 } from '../locomotion/LiveLocomotionV84';

export type LiveFielderAvoidanceMotionV1 = Readonly<{ acceleration: Vec3; stopAfter?: number }>;
export type LiveFielderAvoidanceActorV1 = Readonly<{
  playerId: string; position: Vec3; velocity: Vec3; accelerationMps2: number; topSpeedMps: number;
  bodyRadiusMeters: number; priority: number; canSteer: boolean; preferred: LiveFielderAvoidanceMotionV1;
  locomotionProfile?: LiveLocomotionProfileV84;
  accepts: (motion: LiveFielderAvoidanceMotionV1) => boolean;
}>;
export type LiveFielderAvoidanceInputV1 = Readonly<{
  fromSeconds: number; throughSeconds: number; actors: readonly LiveFielderAvoidanceActorV1[];
}>;

/** Local controller geometry, not an empirical intelligence/ability calibration.
 * A command preserves the current position and velocity. Its complete motor
 * interval AND a subsequent maximum-acceleration stop must remain separated.
 * Failure of this bounded candidate search is not proof of unavoidable impact. */
export const LIVE_FIELDER_AVOIDANCE_POLICY_V1 = Object.freeze({
  clearanceMeters: .02, softClearanceMeters: .35, softClearanceCostWeight: 2, numericalReserveMeters: 1e-8,
  rescuePasses: 4, improvementPasses: 2,
});

const v = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
const add = (a: Vec3, b: Vec3) => v(a.x + b.x, 0, a.z + b.z);
const sub = (a: Vec3, b: Vec3) => v(a.x - b.x, 0, a.z - b.z);
const mul = (a: Vec3, k: number) => v(a.x * k, 0, a.z * k);
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.z * b.z;
const norm = (a: Vec3) => Math.hypot(a.x, a.z);
const braking = (a: LiveFielderAvoidanceActorV1) => a.locomotionProfile?.brakingMps2 ?? a.accelerationMps2;
function accelerationBudget(a: LiveFielderAvoidanceActorV1, acceleration: Vec3): number {
  const profile = a.locomotionProfile, speed = norm(a.velocity);
  if (!profile || speed === 0) return norm(acceleration) / a.accelerationMps2;
  const along = dot(acceleration, a.velocity) / speed,
    sideways = (acceleration.x * a.velocity.z - acceleration.z * a.velocity.x) / speed,
    propulsion = livePropulsionAccelerationV84(profile, Math.min(speed, profile.topSpeedMps));
  return Math.hypot(along / (along > 0 ? propulsion : profile.brakingMps2), sideways / profile.lateralAccelerationMps2);
}
const finite = (a: Vec3) => !!a && [a.x, a.y, a.z].every(Number.isFinite);
const policy = LIVE_FIELDER_AVOIDANCE_POLICY_V1;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('live fielder avoidance: ' + message);
}
const motionKey = (m: LiveFielderAvoidanceMotionV1) => [m.acceleration.x, m.acceleration.z, m.stopAfter ?? null].join(':');
const sameMotion = (a: LiveFielderAvoidanceMotionV1, b: LiveFielderAvoidanceMotionV1) => motionKey(a) === motionKey(b);
const copyMotion = (m: LiveFielderAvoidanceMotionV1): LiveFielderAvoidanceMotionV1 => ({
  acceleration: v(m.acceleration.x, 0, m.acceleration.z), ...(m.stopAfter === undefined ? {} : { stopAfter: m.stopAfter }),
});

type Sample = { position: Vec3; velocity: Vec3; acceleration: Vec3 };
type Path = { breaks: number[]; sample: (seconds: number) => Sample; duration: number };
function path(a: LiveFielderAvoidanceActorV1, m: LiveFielderAvoidanceMotionV1, dt: number): Path {
  const movingThrough = Math.min(dt, m.stopAfter ?? dt),
    endPosition = add(a.position, add(mul(a.velocity, movingThrough), mul(m.acceleration, movingThrough ** 2 / 2))),
    endVelocity = m.stopAfter !== undefined && m.stopAfter <= dt ? v() : add(a.velocity, mul(m.acceleration, dt)),
    endSpeed = norm(endVelocity), stopSeconds = endSpeed / braking(a), stopAtSeconds = dt + stopSeconds,
    stopAcceleration = endSpeed > 0 ? mul(endVelocity, -braking(a) / endSpeed) : v(),
    stoppedPosition = add(endPosition, add(mul(endVelocity, stopSeconds), mul(stopAcceleration, stopSeconds ** 2 / 2)));
  return { breaks: [0, movingThrough, dt, stopAtSeconds], duration: stopAtSeconds,
    sample: seconds => {
      if (seconds < movingThrough) return { position: add(a.position, add(mul(a.velocity, seconds), mul(m.acceleration, seconds ** 2 / 2))),
        velocity: add(a.velocity, mul(m.acceleration, seconds)), acceleration: m.acceleration };
      if (seconds < dt) return { position: endPosition, velocity: v(), acceleration: v() };
      const brakingFor = seconds - dt;
      // Select the phase using the SAME representable boundary as `breaks`.
      // With residual ~1e-17m/s, dt + stopSeconds can round to dt. Testing
      // `seconds - dt < stopSeconds` would then assign its nonzero braking
      // acceleration to the whole following interval after the cut vanished.
      // The rounded stop uses the analytically stopped position/zero velocity;
      // its displacement rounding is covered by the numerical clearance pad.
      if (seconds < stopAtSeconds) return { position: add(endPosition, add(mul(endVelocity, brakingFor), mul(stopAcceleration, brakingFor ** 2 / 2))),
        velocity: add(endVelocity, mul(stopAcceleration, brakingFor)), acceleration: stopAcceleration };
      return { position: stoppedPosition, velocity: v(), acceleration: v() };
    } };
}

/** All extrema of a quadratic relative path: the derivative of squared
 * distance is cubic. Split that cubic at its quadratic derivative roots so
 * every remaining interval is monotone, then bracket every crossing root.
 * Endpoints and stationary split points are also evaluated; render cadence
 * does not participate in this continuous clearance calculation. */
function minimumQuadraticDistance(p: Vec3, velocity: Vec3, acceleration: Vec3, through: number) {
  const coefficients = [2 * dot(p, velocity), 2 * (dot(velocity, velocity) + dot(p, acceleration)),
    3 * dot(velocity, acceleration), dot(acceleration, acceleration)],
    evaluate = (s: number) => ((coefficients[3] * s + coefficients[2]) * s + coefficients[1]) * s + coefficients[0],
    cuts = [0, through], aa = 3 * coefficients[3], bb = 2 * coefficients[2], cc = coefficients[1];
  if (aa !== 0) {
    const discriminant = bb * bb - 4 * aa * cc;
    if (discriminant >= 0) {
      const root = Math.sqrt(discriminant), q = -.5 * (bb + (bb >= 0 ? root : -root));
      if (q !== 0) cuts.push(q / aa, cc / q);
      else cuts.push(-bb / (2 * aa));
    }
  } else if (bb !== 0) cuts.push(-cc / bb);
  const intervals = [...new Set(cuts.filter(s => s >= 0 && s <= through))].sort((a, b) => a - b), candidates = [...intervals];
  for (let i = 1; i < intervals.length; i++) {
    let lo = intervals[i - 1], hi = intervals[i], left = evaluate(lo), right = evaluate(hi);
    if (left === 0 || right === 0 || (left < 0) === (right < 0)) continue;
    for (let iteration = 0; iteration < 64; iteration++) {
      const mid = (lo + hi) / 2;
      if (mid === lo || mid === hi) break;
      const value = evaluate(mid);
      if (value === 0) { lo = hi = mid; break; }
      if ((value < 0) === (left < 0)) { lo = mid; left = value; } else { hi = mid; right = value; }
    }
    candidates.push((lo + hi) / 2);
  }
  let distance = Infinity, atSeconds = 0;
  for (const seconds of candidates) {
    const sampled = norm(add(p, add(mul(velocity, seconds), mul(acceleration, seconds * seconds / 2))));
    if (sampled < distance) { distance = sampled; atSeconds = seconds; }
  }
  return { distance, atSeconds };
}

type Pair = {
  firstPlayerId: string; secondPlayerId: string; currentGapMeters: number;
  minimumStepGapMeters: number; minimumStoppingGapMeters: number; closestElapsedSeconds: number;
  softLossMeters: number;
};
function measurePair(a: LiveFielderAvoidanceActorV1, b: LiveFielderAvoidanceActorV1, pa: Path, pb: Path, dt: number, from: number): Pair {
  const radius = a.bodyRadiusMeters + b.bodyRadiusMeters, currentDistance = norm(sub(a.position, b.position)),
    softTarget = Math.min(currentDistance, radius + policy.softClearanceMeters),
    cuts = [...new Set([...pa.breaks, ...pb.breaks])].sort((a, b) => a - b);
  let stepDistance = currentDistance, stoppingDistance = currentDistance, closestSeconds = 0;
  for (let i = 1; i < cuts.length; i++) {
    const lo = cuts[i - 1], hi = cuts[i];
    if (hi <= lo) continue;
    const aa = pa.sample(lo), bb = pb.sample(lo), minimum = minimumQuadraticDistance(sub(aa.position, bb.position),
      sub(aa.velocity, bb.velocity), sub(aa.acceleration, bb.acceleration), hi - lo);
    if (minimum.distance < stoppingDistance) { stoppingDistance = minimum.distance; closestSeconds = lo + minimum.atSeconds; }
    if (hi <= dt && minimum.distance < stepDistance) stepDistance = minimum.distance;
  }
  return { firstPlayerId: a.playerId, secondPlayerId: b.playerId, currentGapMeters: currentDistance - radius,
    minimumStepGapMeters: stepDistance - radius, minimumStoppingGapMeters: stoppingDistance - radius,
    closestElapsedSeconds: from + closestSeconds, softLossMeters: Math.max(0, softTarget - stoppingDistance) };
}

function emergency(a: LiveFielderAvoidanceActorV1): LiveFielderAvoidanceMotionV1 {
  const speed = norm(a.velocity);
  return speed === 0 ? { acceleration: v() } : { acceleration: mul(a.velocity, -braking(a) / speed), stopAfter: speed / braking(a) };
}
function validMotor(a: LiveFielderAvoidanceActorV1, m: LiveFielderAvoidanceMotionV1, dt: number) {
  if (!finite(m.acceleration) || m.acceleration.y !== 0 || accelerationBudget(a, m.acceleration) > 1 + 1e-9) return false;
  if (m.stopAfter !== undefined && (!Number.isFinite(m.stopAfter) || m.stopAfter < 0
    || norm(add(a.velocity, mul(m.acceleration, m.stopAfter))) > 1e-8)) return false;
  const movingFor = Math.min(dt, m.stopAfter ?? dt);
  return norm(add(a.velocity, mul(m.acceleration, movingFor))) <= a.topSpeedMps + 1e-9;
}
function candidatesFor(a: LiveFielderAvoidanceActorV1, actors: readonly LiveFielderAvoidanceActorV1[], dt: number, preferredAccepted: boolean) {
  const candidates: LiveFielderAvoidanceMotionV1[] = [], keys = new Set<string>();
  const push = (m: LiveFielderAvoidanceMotionV1) => {
    const key = motionKey(m);
    if (!keys.has(key) && validMotor(a, m, dt)) { keys.add(key); if (sameMotion(m, a.preferred) ? preferredAccepted : a.accepts(m)) candidates.push(m); }
  };
  push(a.preferred);
  if (!a.canSteer) return candidates;
  const brake = emergency(a), preferredEnd = path(a, a.preferred, dt).sample(dt).velocity,
    brakeEnd = path(a, brake, dt).sample(dt).velocity;
  push(brake);
  const velocityCandidate = (wanted: Vec3) => {
    const difference = sub(wanted, a.velocity), budget = accelerationBudget(a, mul(difference, 1 / dt)),
      limited = budget > 1 ? add(a.velocity, mul(difference, 1 / budget)) : wanted,
      speed = norm(limited), capped = speed > a.topSpeedMps ? mul(limited, a.topSpeedMps / speed) : limited;
    push({ acceleration: mul(sub(capped, a.velocity), 1 / dt) });
  };
  for (const mix of [.75, .5, .25]) velocityCandidate(add(mul(preferredEnd, mix), mul(brakeEnd, 1 - mix)));
  let heading = norm(preferredEnd) > 1e-9 ? preferredEnd : norm(a.velocity) > 1e-9 ? a.velocity : a.preferred.acceleration;
  if (norm(heading) <= 1e-9) {
    const other = [...actors].filter(b => b !== a).sort((b, c) => norm(sub(a.position, b.position)) - norm(sub(a.position, c.position))
      || b.position.x - c.position.x || b.position.z - c.position.z)[0];
    heading = other ? sub(a.position, other.position) : v(1);
  }
  const length = norm(heading), desiredSpeed = Math.min(a.topSpeedMps, Math.max(norm(preferredEnd), norm(a.velocity), a.accelerationMps2 * dt));
  if (length > 0) for (const angle of [Math.PI / 6, -Math.PI / 6, Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2, 2 * Math.PI / 3, -2 * Math.PI / 3]) {
    const x = heading.x / length, z = heading.z / length;
    velocityCandidate(v((x * Math.cos(angle) - z * Math.sin(angle)) * desiredSpeed, 0,
      (x * Math.sin(angle) + z * Math.cos(angle)) * desiredSpeed));
  }
  return candidates;
}

export function coordinateLiveFielderMotionV1(input: LiveFielderAvoidanceInputV1) {
  const dt = input.throughSeconds - input.fromSeconds, actors = input.actors;
  assert(Number.isFinite(input.fromSeconds) && input.fromSeconds >= 0 && Number.isFinite(dt) && dt > 0, 'finite positive motor interval required');
  assert(actors.length > 0 && actors.length <= 9 && new Set(actors.map(a => a.playerId)).size === actors.length, 'one to nine distinct actors required');
  for (const a of actors) {
    assert(typeof a.playerId === 'string' && a.playerId.length > 0 && finite(a.position) && finite(a.velocity) && a.velocity.y === 0
      && [a.accelerationMps2, a.topSpeedMps, a.bodyRadiusMeters].every(n => Number.isFinite(n) && n > 0)
      && (!a.locomotionProfile || a.locomotionProfile.accelerationMps2 === a.accelerationMps2
        && a.locomotionProfile.topSpeedMps === a.topSpeedMps)
      && Number.isFinite(a.priority) && typeof a.canSteer === 'boolean' && typeof a.accepts === 'function', 'valid actor SI state required');
    assert(norm(a.velocity) <= a.topSpeedMps + 1e-9 && validMotor(a, a.preferred, dt), 'preferred motor violates speed, acceleration or stopping constraints');
  }
  // ID names are correspondence only, never an ability, tie break or side.
  const order = actors.map((_, i) => i).sort((i, j) => actors[j].priority - actors[i].priority
    || actors[i].position.x - actors[j].position.x || actors[i].position.z - actors[j].position.z
    || actors[i].velocity.x - actors[j].velocity.x || actors[i].velocity.z - actors[j].velocity.z
    || actors[i].accelerationMps2 - actors[j].accelerationMps2 || actors[i].topSpeedMps - actors[j].topSpeedMps),
    canonicalPairs = [...order].sort((i, j) => actors[i].position.x - actors[j].position.x || actors[i].position.z - actors[j].position.z
      || actors[i].velocity.x - actors[j].velocity.x || actors[i].velocity.z - actors[j].velocity.z),
    clearance = policy.clearanceMeters + policy.numericalReserveMeters;
  let evaluations = 0, pairEvaluations = 0;
  const pathCaches = actors.map(() => new Map<string, Path>()), pairCaches: Map<string, Pair>[] = [];
  const analyze = (commands: readonly LiveFielderAvoidanceMotionV1[]) => {
    evaluations++;
    const keys = commands.map(motionKey), paths = commands.map((m, i) => {
      let planned = pathCaches[i].get(keys[i]);
      if (!planned) { planned = path(actors[i], m, dt); pathCaches[i].set(keys[i], planned); }
      return planned;
    }), pairs: Pair[] = [];
    let pairIndex = 0;
    for (let a = 0; a < canonicalPairs.length; a++) for (let b = a + 1; b < canonicalPairs.length; b++) {
      const i = canonicalPairs[a], j = canonicalPairs[b], key = keys[i] + '|' + keys[j],
        cache = pairCaches[pairIndex] ?? (pairCaches[pairIndex] = new Map<string, Pair>());
      let pair = cache.get(key);
      if (!pair) {
        pair = measurePair(actors[i], actors[j], paths[i], paths[j], dt, input.fromSeconds);
        cache.set(key, pair); pairEvaluations++;
      }
      pairs.push(pair); pairIndex++;
    }
    return { pairs, safe: pairs.every(p => p.minimumStoppingGapMeters >= clearance),
      risk: pairs.reduce((sum, p) => sum + Math.max(0, clearance - p.minimumStoppingGapMeters) ** 2
        + 4 * Math.max(0, clearance - p.minimumStepGapMeters) ** 2, 0),
      softLoss: pairs.reduce((sum, p) => sum + p.softLossMeters ** 2, 0) };
  };
  const preferenceCost = (i: number, m: LiveFielderAvoidanceMotionV1) => {
    const a = actors[i], difference = sub(m.acceleration, a.preferred.acceleration),
      preferredSpeed = norm(path(a, a.preferred, dt).sample(dt).velocity), speed = norm(path(a, m, dt).sample(dt).velocity);
    return dot(difference, difference) / (a.accelerationMps2 ** 2) + .25 * Math.max(0, preferredSpeed - speed) / (a.accelerationMps2 * dt);
  };
  const preferred = actors.map(a => a.preferred), preferredAnalysis = analyze(preferred),
    initialOverlapPairs = preferredAnalysis.pairs.filter(p => p.currentGapMeters < -1e-10)
      .map(p => ({ firstPlayerId: p.firstPlayerId, secondPlayerId: p.secondPlayerId, gapMeters: p.currentGapMeters }));
  let commands = preferred.slice(), analysis = preferredAnalysis;
  let failure: 'initial_body_overlap' | 'caller_constraint_unresolved' | 'candidate_search_exhausted' | null = null;
  const preferredAccepted = actors.map(a => a.accepts(a.preferred)), callerRejectedActorIds: string[] = [];
  if (initialOverlapPairs.length) failure = 'initial_body_overlap';
  else if (!(analysis.safe && analysis.softLoss <= 1e-16 && preferredAccepted.every(Boolean))) {
    const options = actors.map((a, i) => candidatesFor(a, actors, dt, preferredAccepted[i]));
    callerRejectedActorIds.push(...actors.filter((_, i) => options[i].length === 0).map(a => a.playerId));
    if (callerRejectedActorIds.length) failure = 'caller_constraint_unresolved';
    else {
    commands = actors.map((a, i) => !a.canSteer ? options[i][0] : options[i].find(m => sameMotion(m, emergency(a))) ?? options[i][0]);
    analysis = analyze(commands);
    // A sub-event can change roles before the prior step's endpoint; its
    // all-brake continuation need not be safe. Rescue explores bounded feasible
    // commands, including higher-priority actors when yielding alone fails.
    for (let pass = 0; pass < policy.rescuePasses && !analysis.safe; pass++) {
      let changed = false;
      for (const i of [...order].reverse()) {
        let chosen = commands[i], best = analysis;
        for (const candidate of options[i]) {
          const trial = commands.slice(); trial[i] = candidate;
          const measured = analyze(trial);
          if (measured.risk < best.risk - 1e-14 || Math.abs(measured.risk - best.risk) <= 1e-14
            && measured.softLoss < best.softLoss - 1e-14) { chosen = candidate; best = measured; }
        }
        if (!sameMotion(commands[i], chosen)) { commands[i] = chosen; analysis = best; changed = true; }
      }
      if (!changed) break;
    }
    if (analysis.safe) for (let pass = 0; pass < policy.improvementPasses; pass++) for (const i of order) {
      const score = (motion: LiveFielderAvoidanceMotionV1, measured: typeof analysis) => preferenceCost(i, motion)
        + policy.softClearanceCostWeight * measured.softLoss / (policy.softClearanceMeters ** 2);
      let chosen = commands[i], best = analysis, bestScore = score(chosen, analysis);
      for (const candidate of options[i]) {
        const trial = commands.slice(); trial[i] = candidate;
        const measured = analyze(trial), candidateScore = score(candidate, measured);
        if (measured.safe && (candidateScore < bestScore - 1e-12
          || Math.abs(candidateScore - bestScore) <= 1e-12 && measured.softLoss < best.softLoss - 1e-14)) {
          chosen = candidate; best = measured; bestScore = candidateScore;
        }
      }
      commands[i] = chosen; analysis = best;
    }
      if (!analysis.safe) failure = 'candidate_search_exhausted';
    }
  }
  const safe = failure === null && analysis.safe, minimum = (key: 'minimumStepGapMeters' | 'minimumStoppingGapMeters') =>
    analysis.pairs.length ? Math.min(...analysis.pairs.map(p => p[key])) : null;
  return { safe, commands: commands.map((motion, i) => ({ playerId: actors[i].playerId, motion: copyMotion(motion),
    reason: sameMotion(motion, actors[i].preferred) ? 'preferred' as const : sameMotion(motion, emergency(actors[i])) ? 'brake' as const : 'yield' as const })),
    diagnostics: { basis: 'BOUNDED_CONTINUOUS_LOCAL_FIELDER_MOTOR_V1' as const, failure, candidateEvaluations: evaluations, pairEvaluations,
      clearanceMeters: policy.clearanceMeters, stepSafe: analysis.pairs.every(p => p.minimumStepGapMeters >= policy.clearanceMeters),
      stoppingReserveSafe: analysis.safe, minimumStepGapMeters: minimum('minimumStepGapMeters'),
      minimumStoppingGapMeters: minimum('minimumStoppingGapMeters'), initialOverlapPairs, callerRejectedActorIds, pairs: analysis.pairs,
      physicalImpactResolved: false, finiteCandidateFailureProvesUnavoidableImpact: false } };
}
