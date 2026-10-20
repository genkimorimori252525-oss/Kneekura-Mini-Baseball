import type { Vec2 } from '../../model/geometry';
import { validateTechnicalSkillControlsV75, type TechnicalSkillControlsV75 } from '../TechnicalSkillControlsV75';
import { buildLiveSpeedPlanV84, createLiveLocomotionProfileV84, liveReachableSpeedV84, type LiveLocomotionProfileV84 } from '../locomotion/LiveLocomotionV84';
import { getRunnerRouteLength, sampleRunnerRoute, type RunnerRoute, type RunnerRouteSegment } from './RunnerRoute';

export type LiveRunnerMotionBaseV1 = Readonly<{ base: number; position: Vec2 }>;
export type LiveRunnerMotionInputV1 = Readonly<{
  position: Vec2;
  velocity?: Vec2;
  /** All preceding bases are committed through-bases; the last base is a stop target. */
  bases: readonly LiveRunnerMotionBaseV1[];
  topSpeedMps: number;
  accelerationMps2: number;
  brakingMps2?: number;
  roundingRadiusMeters?: number;
  technicalSkills?: TechnicalSkillControlsV75;
  lateralAccelerationMps2?: number;
  baseTouchRadiusMeters?: number;
}>;
export type LiveRunnerMotionSampleV1 = Readonly<{
  position: Vec2; velocity: Vec2; speedMps: number; distanceMeters: number;
}>;
export type LiveRunnerMotionSpeedSegmentV1 = Readonly<{
  startElapsedSeconds: number; endElapsedSeconds: number;
  startDistanceMeters: number; endDistanceMeters: number;
  startSpeedMps: number; accelerationMps2: number;
}>;
export type LiveRunnerMotionTouchV1 = Readonly<{
  base: number; distanceMeters: number; elapsedSeconds: number; position: Vec2;
  /** The route really passes through this base center, after entering its touch disk. */
  centerDistanceMeters: number; centerElapsedSeconds: number;
}>;
export type LiveRunnerMotionV1 = Readonly<{
  route: RunnerRoute; lengthMeters: number; durationSeconds: number;
  speedSegments: readonly LiveRunnerMotionSpeedSegmentV1[];
  touches: readonly LiveRunnerMotionTouchV1[];
  sampleAtElapsedSeconds: (elapsedSeconds: number) => LiveRunnerMotionSampleV1;
  elapsedSecondsAtDistanceMeters: (distanceMeters: number) => number;
}>;

const EPSILON = 1e-10;
const TWO_PI = 2 * Math.PI;
const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, z: a.z + b.z });
const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, z: a.z - b.z });
const mul = (a: Vec2, n: number): Vec2 => ({ x: a.x * n, z: a.z * n });
const norm = (a: Vec2) => Math.hypot(a.x, a.z);
const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.z * b.z;
const normal = (a: Vec2): Vec2 => ({ x: -a.z, z: a.x });
const unit = (a: Vec2): Vec2 => mul(a, 1 / norm(a));
const angle = (a: Vec2) => Math.atan2(a.z, a.x);
const polar = (a: number): Vec2 => ({ x: Math.cos(a), z: Math.sin(a) });
const positiveAngle = (a: number) => (a % TWO_PI + TWO_PI) % TWO_PI;
const finite = (a: Vec2) => !!a && Number.isFinite(a.x) && Number.isFinite(a.z);
const segmentLength = (s: RunnerRouteSegment) => s.kind === 'line'
  ? norm(sub(s.end, s.start)) : s.radiusMeters * Math.abs(s.sweepRadians);

const arc = (center: Vec2, radiusMeters: number, from: Vec2, to: Vec2, direction: number): RunnerRouteSegment => ({
  kind: 'arc', center, radiusMeters, startAngleRadians: angle(sub(from, center)),
  sweepRadians: direction * positiveAngle(direction * (angle(sub(to, center)) - angle(sub(from, center)))),
});

/** Enumerate tangent circle/line/circle and circle/circle/circle paths. Every
 * join shares its directed unit tangent. No position or heading is reset. */
function connect(from: Vec2, heading: Vec2, to: Vec2, endHeading: Vec2, radius: number): RunnerRouteSegment[] | null {
  if (norm(sub(from, to)) <= EPSILON && dot(heading, endHeading) > 1 - EPSILON) return [];
  const candidates: RunnerRouteSegment[][] = [];
  for (const left of [-1, 1]) for (const right of [-1, 1]) {
    const first = add(from, mul(normal(heading), left * radius));
    const last = add(to, mul(normal(endHeading), right * radius));
    const delta = sub(last, first), length = norm(delta), shift = (left - right) * radius;
    if (length > EPSILON && length + EPSILON >= Math.abs(shift)) {
      const tangent = polar(angle(delta) + Math.asin(Math.max(-1, Math.min(1, shift / length))));
      const a = sub(first, mul(normal(tangent), left * radius));
      const b = sub(last, mul(normal(tangent), right * radius));
      candidates.push([arc(first, radius, from, a, left), { kind: 'line', start: a, end: b }, arc(last, radius, b, to, right)]);
    }
    if (left !== right || length > 4 * radius + EPSILON) continue;
    if (length <= EPSILON) {
      candidates.push([arc(first, radius, from, to, left)]);
      continue;
    }
    const midpoint = mul(add(first, last), .5);
    const offset = Math.sqrt(Math.max(0, 4 * radius * radius - .25 * length * length));
    for (const side of [-1, 1]) {
      const middle = add(midpoint, mul(normal(unit(delta)), side * offset));
      const a = mul(add(first, middle), .5), b = mul(add(middle, last), .5);
      candidates.push([arc(first, radius, from, a, left), arc(middle, radius, a, b, -left), arc(last, radius, b, to, left)]);
    }
  }
  const cleaned = candidates.map(parts => parts.filter(part => segmentLength(part) > EPSILON)).filter(parts => {
    const winding = parts.reduce((sum, s) => sum + (s.kind === 'arc' ? Math.abs(s.sweepRadians) : 0), 0);
    const pathLength = parts.reduce((sum, s) => sum + segmentLength(s), 0);
    // A late commitment must fail rather than manufacture a loop around a bag
    // to make a mathematically possible fixed-radius heading change.
    return winding <= Math.PI + EPSILON && pathLength <= norm(sub(to, from)) + 2 * radius + EPSILON;
  });
  cleaned.sort((a, b) => a.reduce((sum, s) => sum + segmentLength(s), 0) - b.reduce((sum, s) => sum + segmentLength(s), 0));
  return cleaned[0] ?? null;
}

function buildRoute(input: LiveRunnerMotionInputV1, radius: number, lateral: number, initialSpeed: number) {
  const segments: RunnerRouteSegment[] = [], centerDistances: number[] = [];
  const append = (parts: readonly RunnerRouteSegment[]) => { segments.push(...parts); };
  const length = () => segments.reduce((sum, s) => sum + segmentLength(s), 0);
  let position = input.position;
  let heading = initialSpeed > EPSILON ? unit(input.velocity!) : unit(sub(input.bases[0].position, position));
  for (let index = 0; index < input.bases.length; index++) {
    const bag = input.bases[index].position;
    const previous = index ? input.bases[index - 1].position : input.position;
    const incoming = unit(sub(bag, previous));
    // Round only the velocity-derived radius outward, so its reconstructed
    // lateral speed cap cannot land below the unchanged incoming speed.
    const connectorRadius = segments.length === 0 ? Math.max(radius, initialSpeed * initialSpeed / lateral * (1 + 4 * Number.EPSILON)) : radius;
    if (index === input.bases.length - 1) {
      const connector = connect(position, heading, bag, incoming, connectorRadius);
      if (!connector) return null;
      append(connector);
      centerDistances.push(length());
      break;
    }
    const outgoing = unit(sub(input.bases[index + 1].position, bag));
    const turn = Math.atan2(incoming.x * outgoing.z - incoming.z * outgoing.x, dot(incoming, outgoing));
    if (Math.abs(turn) < EPSILON) {
      const connector = connect(position, heading, bag, incoming, connectorRadius);
      if (!connector) return null;
      append(connector);
      centerDistances.push(length()); position = bag; heading = incoming;
      continue;
    }
    const sign = Math.sign(turn), middleHeading = polar(angle(incoming) + turn / 2);
    // Translate the usual corner fillet outward until its midpoint is the bag.
    // The smooth approach/exit connectors absorb that offset; the arc cannot
    // cut the inside corner and invent a touch at a point it never visits.
    const center = add(bag, mul(normal(middleHeading), sign * radius));
    const entry = sub(center, mul(normal(incoming), sign * radius));
    const exit = sub(center, mul(normal(outgoing), sign * radius));
    const connector = connect(position, heading, entry, incoming, connectorRadius);
    if (!connector) return null;
    append(connector);
    const beforeArc = length();
    append([{ kind: 'arc', center, radiusMeters: radius, startAngleRadians: angle(sub(entry, center)), sweepRadians: turn }]);
    centerDistances.push(beforeArc + radius * Math.abs(turn) / 2);
    position = exit; heading = outgoing;
  }
  const route: RunnerRoute = { segments };
  return { route, centerDistances, lengthMeters: getRunnerRouteLength(route) };
}

function buildSpeedSegments(route: RunnerRoute, initialSpeed: number, profile: LiveLocomotionProfileV84) {
  const { topSpeedMps: topSpeed, brakingMps2: braking, lateralAccelerationMps2: lateral } = profile;
  const lengths = route.segments.map(segmentLength);
  const caps = route.segments.map(s => s.kind === 'line' ? topSpeed : Math.min(topSpeed, Math.sqrt(lateral * s.radiusMeters)));
  if (initialSpeed > caps[0]) return null;
  const speeds = [initialSpeed];
  for (let i = 0; i < lengths.length; i++) speeds.push(Math.min(
    i === lengths.length - 1 ? 0 : Math.min(caps[i], caps[i + 1]),
    liveReachableSpeedV84(profile, speeds[i], lengths[i], caps[i]),
  ));
  for (let i = lengths.length - 1; i >= 0; i--) {
    let limit = Math.sqrt(speeds[i + 1] ** 2 + 2 * braking * lengths[i]);
    // The inverse square root may round above the feasible braking envelope.
    // Keep this derived boundary conservative, without resetting source speed.
    if ((limit - speeds[i + 1]) * (limit + speeds[i + 1]) / (2 * braking) > lengths[i])
      limit *= 1 - 4 * Number.EPSILON;
    speeds[i] = Math.min(speeds[i], limit);
  }
  if (speeds[0] < initialSpeed - EPSILON) return null;
  speeds[0] = initialSpeed;
  const segments: LiveRunnerMotionSpeedSegmentV1[] = [];
  let time = 0, distance = 0;
  for (let i = 0; i < lengths.length; i++) {
    const plan = buildLiveSpeedPlanV84({ profile, distanceMeters: lengths[i], initialSpeedMps: speeds[i],
      finalSpeedMps: speeds[i + 1], speedLimitMps: caps[i] });
    if (!plan) return null;
    segments.push(...plan.segments.map(s => ({ ...s,
      startElapsedSeconds: s.startElapsedSeconds + time, endElapsedSeconds: s.endElapsedSeconds + time,
      startDistanceMeters: s.startDistanceMeters + distance, endDistanceMeters: s.endDistanceMeters + distance })));
    time += plan.durationSeconds; distance += lengths[i];
  }
  return { segments, durationSeconds: time };
}

function firstTouchDistance(route: RunnerRoute, bag: Vec2, radius: number, centerDistance: number): number {
  let traversed = 0;
  for (const part of route.segments) {
    const length = segmentLength(part), maximum = Math.min(length, centerDistance - traversed);
    if (maximum < -EPSILON) break;
    const candidates = [0];
    if (part.kind === 'line') {
      const heading = unit(sub(part.end, part.start)), offset = sub(part.start, bag), b = dot(offset, heading);
      const discriminant = b * b - dot(offset, offset) + radius * radius;
      if (discriminant >= 0) candidates.push(-b - Math.sqrt(discriminant), -b + Math.sqrt(discriminant));
    } else {
      const offset = sub(bag, part.center), d = norm(offset);
      if (d > 0) {
        const cosine = (part.radiusMeters ** 2 + d * d - radius * radius) / (2 * part.radiusMeters * d);
        if (cosine >= -1 && cosine <= 1) for (const sign of [-1, 1]) {
          const theta = angle(offset) + sign * Math.acos(cosine);
          candidates.push(part.radiusMeters * positiveAngle(Math.sign(part.sweepRadians) * (theta - part.startAngleRadians)));
        }
      }
    }
    candidates.sort((a, b) => a - b);
    for (const local of candidates) {
      if (local < -EPSILON || local > maximum + EPSILON) continue;
      let candidate = Math.max(traversed, Math.min(centerDistance, traversed + local));
      // Require an actual in-disk witness, including at floating-point roots.
      for (let attempt = 0; attempt < 12; attempt++) {
        if (norm(sub(sampleRunnerRoute(route, candidate).position, bag)) <= radius) return candidate;
        candidate = Math.min(centerDistance, candidate + Number.EPSILON * Math.max(1, centerDistance) * 2 ** attempt);
      }
    }
    traversed += length;
  }
  if (norm(sub(sampleRunnerRoute(route, centerDistance).position, bag)) <= radius) return centerDistance;
  throw new Error('live runner motion: planned base lacks a physical touch');
}

/** Finite C1 motion, with analytic longitudinal acceleration/braking and the
 * centripetal bound v²/r <= lateralAccelerationMps2 on every circular segment.
 * Default radius and lateral/longitudinal ratio are authored control settings,
 * not calibrated player measurements.
 * Null means the current velocity cannot reach an upcoming constraint without
 * exceeding braking/lateral acceleration or requiring a looping detour; the
 * caller must retain its plan. */
export function createLiveRunnerMotionV1(input: LiveRunnerMotionInputV1): LiveRunnerMotionV1 | null {
  if (input.technicalSkills !== undefined) validateTechnicalSkillControlsV75(input.technicalSkills);
  const braking = input.brakingMps2 ?? 1.8 * input.accelerationMps2;
  const authoredRadius = input.roundingRadiusMeters ?? 4.5, skill = input.technicalSkills?.baserunning ?? 0;
  // Technique selects a slightly wider/narrower through-base route, never extra motor capacity.
  const radius = skill !== 0 && input.bases.length > 1 ? authoredRadius * (1 + .04 * skill) : authoredRadius;
  const lateral = input.lateralAccelerationMps2 ?? 1.5 * input.accelerationMps2;
  const touchRadius = input.baseTouchRadiusMeters ?? .28;
  if (!finite(input.position) || input.velocity && !finite(input.velocity)
    || !input.bases.length || !input.bases.every(b => Number.isInteger(b.base) && b.base >= 1 && b.base <= 4 && finite(b.position))
    || ![input.topSpeedMps, input.accelerationMps2, braking, radius, lateral, touchRadius].every(n => Number.isFinite(n) && n > 0)) {
    throw new Error('live runner motion: finite positive motor and base geometry required');
  }
  let previous = input.position;
  for (const bag of input.bases) {
    if (norm(sub(bag.position, previous)) <= EPSILON) throw new Error('live runner motion: consecutive positions must differ');
    previous = bag.position;
  }
  const initialSpeed = input.velocity ? norm(input.velocity) : 0;
  if (initialSpeed > input.topSpeedMps) return null;
  const geometry = buildRoute(input, radius, lateral, initialSpeed);
  if (!geometry) return null;
  const profile = createLiveLocomotionProfileV84({ topSpeedMps: input.topSpeedMps, accelerationMps2: input.accelerationMps2,
    brakingMps2: braking, lateralAccelerationMps2: lateral });
  const timing = buildSpeedSegments(geometry.route, initialSpeed, profile);
  if (!timing) return null;
  const elapsedSecondsAtDistanceMeters = (rawDistance: number) => {
    if (!Number.isFinite(rawDistance) || rawDistance < 0 || rawDistance > geometry.lengthMeters + EPSILON)
      throw new Error('live runner motion: distance must lie on finite route');
    const distance = Math.min(rawDistance, geometry.lengthMeters);
    if (distance === geometry.lengthMeters) return timing.durationSeconds;
    const s = timing.segments.find(s => distance <= s.endDistanceMeters + EPSILON) ?? timing.segments[timing.segments.length - 1];
    const local = Math.max(0, Math.min(s.endDistanceMeters - s.startDistanceMeters, distance - s.startDistanceMeters));
    const endSpeed = Math.sqrt(Math.max(0, s.startSpeedMps ** 2 + 2 * s.accelerationMps2 * local));
    return s.startElapsedSeconds + (local === 0 ? 0 : 2 * local / (s.startSpeedMps + endSpeed));
  };
  const sampleAtElapsedSeconds = (elapsed: number): LiveRunnerMotionSampleV1 => {
    if (!Number.isFinite(elapsed)) throw new Error('live runner motion: elapsed time must be finite');
    if (elapsed <= 0) return { position: { ...input.position }, velocity: { ...(input.velocity ?? { x: 0, z: 0 }) }, speedMps: initialSpeed, distanceMeters: 0 };
    if (elapsed >= timing.durationSeconds) return { position: { ...input.bases[input.bases.length - 1].position }, velocity: { x: 0, z: 0 }, speedMps: 0, distanceMeters: geometry.lengthMeters };
    const s = timing.segments.find(s => elapsed <= s.endElapsedSeconds) ?? timing.segments[timing.segments.length - 1];
    const dt = Math.max(0, elapsed - s.startElapsedSeconds);
    const distance = Math.min(geometry.lengthMeters, Math.max(0, s.startDistanceMeters + s.startSpeedMps * dt + .5 * s.accelerationMps2 * dt * dt));
    const point = sampleRunnerRoute(geometry.route, distance);
    const part = geometry.route.segments[point.segmentIndex],
      cap = part.kind === 'line' ? input.topSpeedMps : Math.min(input.topSpeedMps, Math.sqrt(lateral * part.radiusMeters)),
      speed = Math.min(cap, Math.max(0, s.startSpeedMps + s.accelerationMps2 * dt));
    let velocity = mul(point.tangent, speed);
    const reconstructedSpeed = norm(velocity);
    // Only derived roundoff is corrected: a unit tangent times a capped scalar
    // may reconstruct one ULP above that scalar and invalidate the next plan.
    // Incoming velocity at elapsed zero remains exactly as supplied.
    if (reconstructedSpeed > speed) velocity = mul(velocity, speed / reconstructedSpeed * (1 - 4 * Number.EPSILON));
    return { position: point.position, velocity, speedMps: speed, distanceMeters: distance };
  };
  const touches = input.bases.map((bag, index) => {
    const centerDistanceMeters = geometry.centerDistances[index];
    const distanceMeters = firstTouchDistance(geometry.route, bag.position, touchRadius, centerDistanceMeters);
    return { base: bag.base, distanceMeters, elapsedSeconds: elapsedSecondsAtDistanceMeters(distanceMeters),
      position: sampleRunnerRoute(geometry.route, distanceMeters).position,
      centerDistanceMeters, centerElapsedSeconds: elapsedSecondsAtDistanceMeters(centerDistanceMeters) };
  });
  return Object.freeze({ route: geometry.route, lengthMeters: geometry.lengthMeters,
    durationSeconds: timing.durationSeconds, speedSegments: timing.segments, touches,
    sampleAtElapsedSeconds, elapsedSecondsAtDistanceMeters });
}
