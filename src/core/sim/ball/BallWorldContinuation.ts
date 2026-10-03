import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import type { BattedBallInitialState } from '../contact/BatBallContact';
import { findAcceleratedSphereContactSeconds, findAcceleratedSphereBlockedDepartureSeconds, type AcceleratedSphereContactState } from '../collision/AcceleratedSphereContact';
import { quantizeEventTick } from '../ExactEventTime';
import type { DefenderPhysicalPrimitiveRole } from '../fielding/DefenderPhysicalPrimitive';
import type { BallFlightParameters } from './BallFlight';
import type { BattedWorldActorPrimitive, BattedWorldSurface } from './BattedBallWorldContacts';
import { findBallWorldBaseBoundary, type BallWorldBaseBoundaryContact, type BallWorldBaseBoundaryInput } from './BallWorldBaseBoundary';

export type BallWorldMoment = Readonly<{ originTick: number; elapsedSeconds: number; ball: BattedBallInitialState }>;
export type BallWorldCollider = Readonly<{ kind: 'actor'; playerId: string; role: DefenderPhysicalPrimitiveRole }>
  | Readonly<{ kind: 'surface'; surfaceId: string }>;
/** A future primitive may begin at a true continuous offset from its integer clock basis. */
export type BallWorldMotionActor = BattedWorldActorPrimitive & Readonly<{ startElapsedSeconds?: number }>;
export type BallWorldBoundaryContact = Readonly<{ kind: 'ground'; moment: BallWorldMoment }>
  | Readonly<{ kind: 'rolling_stop'; moment: BallWorldMoment }>
  | Readonly<{ kind: 'actor'; playerId: string; role: DefenderPhysicalPrimitiveRole; moment: BallWorldMoment;
    center: Vec3; velocity: Vec3; normal: Vec3 | null; continuing?: true }>
  | Readonly<{ kind: 'surface'; surfaceId: string; moment: BallWorldMoment; point: Vec3; normal: Vec3 | null; continuing?: true }>;
export type BallWorldContinuationInput = Readonly<{
  moment: BallWorldMoment; throughTick: number; parameters: BallFlightParameters;
  actors: readonly BallWorldMotionActor[]; surfaces: readonly BattedWorldSurface[]; previousContacts: readonly BallWorldCollider[];
}>;
export type BallWorldContinuation = Readonly<{ kind: 'boundary'; moment: BallWorldMoment; phase: 'airborne' | 'rolling' | 'resting';
  contacts: readonly BallWorldBoundaryContact[]; pendingReason?: 'persistent_contact' }>
  | Readonly<{ kind: 'moving' | 'resting'; moment: BallWorldMoment; phase: 'airborne' | 'rolling' | 'resting'; throughTick: number }>;
export type AcceleratedBallWorldMotionInput = Omit<BallWorldContinuationInput, 'throughTick'> & Readonly<{
  acceleration: Vec3; throughElapsedSeconds: number;
}>;
export type AcceleratedBallWorldMotion = Readonly<{ kind: 'boundary'; moment: BallWorldMoment;
  contacts: readonly BallWorldBoundaryContact[]; pendingReason?: 'persistent_contact' }>
  | Readonly<{ kind: 'moving'; moment: BallWorldMoment; throughTick: number }>;
type BaseScope = Pick<BallWorldBaseBoundaryInput, 'bases' | 'previousBaseContacts'>;
export type BallWorldFieldBoundaryContact = BallWorldBoundaryContact | BallWorldBaseBoundaryContact;
export type BallWorldFieldContinuationInput = BallWorldContinuationInput & BaseScope;
export type BallWorldFieldContinuation = Exclude<BallWorldContinuation, { kind: 'boundary' }>
  | Readonly<{ kind: 'boundary'; moment: BallWorldMoment; phase: 'airborne' | 'rolling' | 'resting';
    contacts: readonly BallWorldFieldBoundaryContact[]; pendingReason?: 'persistent_contact' }>;
export type AcceleratedBallWorldFieldMotionInput = AcceleratedBallWorldMotionInput & BaseScope;
export type AcceleratedBallWorldFieldMotion = Exclude<AcceleratedBallWorldMotion, { kind: 'boundary' }>
  | Readonly<{ kind: 'boundary'; moment: BallWorldMoment; contacts: readonly BallWorldFieldBoundaryContact[]; pendingReason?: 'persistent_contact' }>;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const tick = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
const vector = (v: Vec3) => v && [v.x, v.y, v.z].every(finite);
const unit = (v: number) => finite(v) && v >= 0 && v <= 1;
const freeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const colliderKey = (c: BallWorldCollider) => JSON.stringify(c.kind === 'actor' ? [c.kind, c.playerId, c.role] : [c.kind, c.surfaceId]);
const normal = (a: Vec3, b: Vec3): Vec3 | null => {
  const length = distance(a, b);
  if (!finite(length)) throw new Error('ball World normal arithmetic overflow');
  return length === 0 ? null : { x: (a.x - b.x) / length, y: (a.y - b.y) / length, z: (a.z - b.z) / length };
};
const sample = (position: Vec3, velocity: Vec3, acceleration: Vec3, seconds: number) => {
  const point = { x: position.x + velocity.x * seconds + 0.5 * acceleration.x * seconds * seconds,
    y: position.y + velocity.y * seconds + 0.5 * acceleration.y * seconds * seconds,
    z: position.z + velocity.z * seconds + 0.5 * acceleration.z * seconds * seconds };
  const motion = { x: velocity.x + acceleration.x * seconds, y: velocity.y + acceleration.y * seconds, z: velocity.z + acceleration.z * seconds };
  if (!vector(point) || !vector(motion)) throw new Error('ball World motion arithmetic overflow');
  return { point, motion };
};
const roots = (a: number, b: number, c: number): number[] => {
  if (![a, b, c].every(finite)) throw new Error('ball World boundary arithmetic overflow');
  if (a === 0) return b === 0 ? [] : [-c / b];
  const discriminant = b * b - 4 * a * c;
  if (!finite(discriminant)) throw new Error('ball World root arithmetic overflow');
  if (discriminant < 0) return [];
  if (discriminant === 0) return [-b / (2 * a)];
  const q = -0.5 * (b + Math.sign(b || 1) * Math.sqrt(discriminant));
  return [q / a, c / q].sort((x, y) => x - y);
};
// The field path's axial contact has one signed coordinate, just like a prism
// face. Its exact physical root must not acquire a different squared-root
// roundoff solely because the other collider is an actor.
const axialSphereTime = (first: AcceleratedSphereContactState, second: AcceleratedSphereContactState,
  duration: number, previous: boolean): number | null | undefined => {
  const axes = ['x', 'y', 'z'] as const;
  const nonzero = axes.filter((axis) => first.center[axis] !== second.center[axis]
    || first.velocity[axis] !== second.velocity[axis] || first.acceleration[axis] !== second.acceleration[axis]);
  if (nonzero.length !== 1) return undefined;
  const axis = nonzero[0], d = first.center[axis] - second.center[axis], v = first.velocity[axis] - second.velocity[axis],
    a = first.acceleration[axis] - second.acceleration[axis], radius = first.radius + second.radius;
  if (![d, v, a, radius].every(finite)) throw new Error('ball field axial contact arithmetic overflow');
  const separated = Math.abs(d) > radius;
  if (!previous && !separated) return 0;
  return [radius, -radius].flatMap((r) => roots(0.5 * a, v, d - r))
    .filter((t) => finite(t) && t >= 0 && t <= duration).sort((a, b) => a - b).find((t) => {
      const separation = d + v * t + 0.5 * a * t * t, speed = v + a * t;
      return separated || t > 0 && (separation * speed < 0 || speed === 0 && separation * a > 0);
    }) ?? null;
};
const frame = (s: BattedWorldSurface) => {
  if (!id(s?.surfaceId) || !s.start || !s.end || ![s.start.x, s.start.z, s.end.x, s.end.z, s.minimumHeight, s.maximumHeight].every(finite)
    || s.minimumHeight < 0 || s.maximumHeight <= s.minimumHeight) throw new Error('invalid ball World surface');
  const length = Math.hypot(s.end.x - s.start.x, s.end.z - s.start.z);
  if (!finite(length) || length <= 0) throw new Error('invalid ball World surface extent');
  return { length, ux: (s.end.x - s.start.x) / length, uz: (s.end.z - s.start.z) / length };
};
const closestPoint = (s: BattedWorldSurface, p: Vec3): Vec3 => {
  const f = frame(s), u = Math.max(0, Math.min(f.length, (p.x - s.start.x) * f.ux + (p.z - s.start.z) * f.uz));
  return { x: s.start.x + u * f.ux, y: Math.max(s.minimumHeight, Math.min(s.maximumHeight, p.y)), z: s.start.z + u * f.uz };
};

/** Partition at closest-feature changes, so an invalid first face root cannot hide a later edge/corner contact. */
const surfaceTime = (ball: AcceleratedSphereContactState, s: BattedWorldSurface, seconds: number, previous: boolean,
  exactFieldFace = false): Readonly<{ time: number; blocked: boolean }> | null => {
  const f = frame(s), u0 = (ball.center.x - s.start.x) * f.ux + (ball.center.z - s.start.z) * f.uz;
  const uv = ball.velocity.x * f.ux + ball.velocity.z * f.uz, ua = ball.acceleration.x * f.ux + ball.acceleration.z * f.uz;
  if (![u0, uv, ua].every(finite)) throw new Error('ball World surface projection arithmetic overflow');
  if (!previous && distance(ball.center, closestPoint(s, ball.center)) <= ball.radius) return { time: 0, blocked: false };
  const changes = [0, seconds, ...[0, f.length].flatMap((u) => roots(0.5 * ua, uv, u0 - u)),
    ...[s.minimumHeight, s.maximumHeight].flatMap((y) => roots(0.5 * ball.acceleration.y, ball.velocity.y, ball.center.y - y))];
  const boundaries = [...new Set(changes.filter((t) => finite(t) && t >= 0 && t <= seconds))].sort((a, b) => a - b);
  let departed = !previous || distance(ball.center, closestPoint(s, ball.center)) > ball.radius;
  for (let i = 0; i + 1 < boundaries.length; i++) {
    const start = boundaries[i], end = boundaries[i + 1], middle = (start + end) / 2;
    const mid = sample(ball.center, ball.velocity, ball.acceleration, middle).point;
    const midU = u0 + uv * middle + 0.5 * ua * middle * middle;
    const movingU = midU > 0 && midU < f.length, movingY = mid.y > s.minimumHeight && mid.y < s.maximumHeight;
    const actual = sample(ball.center, ball.velocity, ball.acceleration, start);
    const u = movingU ? u0 + uv * start + 0.5 * ua * start * start : midU <= 0 ? 0 : f.length;
    const feature: AcceleratedSphereContactState = { tick: ball.tick, radius: ball.radius / 2,
      center: { x: s.start.x + f.ux * u, y: movingY ? actual.point.y : mid.y <= s.minimumHeight ? s.minimumHeight : s.maximumHeight,
        z: s.start.z + f.uz * u },
      velocity: { x: movingU ? f.ux * (uv + ua * start) : 0, y: movingY ? actual.motion.y : 0, z: movingU ? f.uz * (uv + ua * start) : 0 },
      acceleration: { x: movingU ? f.ux * ua : 0, y: movingY ? ball.acceleration.y : 0, z: movingU ? f.uz * ua : 0 } };
    const movingBall = { ...ball, center: actual.point, velocity: actual.motion, radius: ball.radius / 2 };
    const blocked = departed ? null : findAcceleratedSphereBlockedDepartureSeconds(movingBall, feature, end - start);
    if (blocked !== null) return { time: start + blocked, blocked: true };
    // A face has one signed normal coordinate. Use that same root representation
    // as a bag face on the additive field path, preserving the legacy solver.
    const signed = exactFieldFace && movingU && movingY ? axialSphereTime({ ...movingBall,
      center: { x: f.uz * (actual.point.x - s.start.x) - f.ux * (actual.point.z - s.start.z), y: 0, z: 0 },
      velocity: { x: f.uz * actual.motion.x - f.ux * actual.motion.z, y: 0, z: 0 },
      acceleration: { x: f.uz * ball.acceleration.x - f.ux * ball.acceleration.z, y: 0, z: 0 } },
      { ...feature, center: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } },
      end - start, !departed) : undefined;
    const at = signed === undefined ? findAcceleratedSphereContactSeconds(movingBall,
      feature, end - start, departed ? 'include' : 'after_departure') : signed;
    if (at !== null) return { time: start + at, blocked: false };
    const point = sample(ball.center, ball.velocity, ball.acceleration, end).point;
    if (distance(point, closestPoint(s, point)) > ball.radius) departed = true;
  }
  return null;
};

/** One actual causal segment; a horizon or a resting ball is never a baseball result or play-end fact. */
const deriveWorldSegment = (raw: BallWorldContinuationInput,
  constrained?: Readonly<{ acceleration: Vec3; throughElapsedSeconds: number }>, bases?: BaseScope): BallWorldFieldContinuation => {
  const input = cloneInert(raw), { moment, parameters: p } = input, initial = moment?.ball;
  if (!moment || !initial || !p || !tick(moment.originTick) || !finite(moment.elapsedSeconds) || moment.elapsedSeconds < 0
    || !tick(initial.tick) || !tick(input.throughTick) || input.throughTick < initial.tick || !vector(initial.position)
    || !vector(initial.velocity) || !vector(initial.spin) || !tick(p.ticksPerSecond) || p.ticksPerSecond === 0
    || !finite(p.gravityY) || !finite(p.ballRadius) || p.ballRadius <= 0 || !unit(p.groundRestitution) || !unit(p.groundFriction)
    || !finite(p.groundRollingDecelerationMps2) || p.groundRollingDecelerationMps2 < 0 || !finite(p.restingVerticalSpeed) || p.restingVerticalSpeed < 0
    || !tick(p.integrationStepTicks) || p.integrationStepTicks === 0 || initial.position.y < p.ballRadius - 1e-12
    || quantizeEventTick(moment.originTick, moment.elapsedSeconds, p.ticksPerSecond) !== initial.tick
    || !Array.isArray(input.actors) || !Array.isArray(input.surfaces) || !Array.isArray(input.previousContacts)) throw new Error('invalid ball World continuation');
  if (constrained && (!vector(constrained.acceleration) || !finite(constrained.throughElapsedSeconds)
    || constrained.throughElapsedSeconds < moment.elapsedSeconds)) throw new Error('invalid accelerated ball World interval');
  const actorKeys = new Set<string>(), surfaceIds = new Set<string>();
  for (const a of input.actors) {
    const s = a?.primitive, key = JSON.stringify([a?.playerId, s?.role]);
    if (!id(a?.playerId) || !s || actorKeys.has(key) || !['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'].includes(s.role)
      || !tick(s.startTick) || !tick(s.endTick) || s.startTick > initial.tick || s.endTick < input.throughTick || s.ticksPerSecond !== p.ticksPerSecond
      || !finite(s.radius) || s.radius <= 0 || !vector(s.startCenter) || !vector(s.startVelocity) || !vector(s.acceleration)
      || a.startElapsedSeconds !== undefined && (!finite(a.startElapsedSeconds) || a.startElapsedSeconds < 0)) throw new Error('invalid ball World actor coverage');
    const currentSeconds = (moment.originTick - s.startTick) / p.ticksPerSecond + moment.elapsedSeconds - (a.startElapsedSeconds ?? 0);
    if (currentSeconds < 0) throw new Error('ball World actor starts after the continuous moment');
    sample(s.startCenter, s.startVelocity, s.acceleration, currentSeconds);
    sample(s.startCenter, s.startVelocity, s.acceleration, (input.throughTick - s.startTick) / p.ticksPerSecond - (a.startElapsedSeconds ?? 0));
    actorKeys.add(key);
  }
  for (const s of input.surfaces) { frame(s); if (surfaceIds.has(s.surfaceId)) throw new Error('duplicate ball World surface'); surfaceIds.add(s.surfaceId); }
  const prior = new Set<string>();
  for (const c of input.previousContacts) {
    const key = c?.kind === 'actor' ? JSON.stringify([c.playerId, c.role]) : c?.kind === 'surface' ? c.surfaceId : '';
    if (!key || prior.has(colliderKey(c)) || (c.kind === 'actor' ? !actorKeys.has(key) : !surfaceIds.has(key))) throw new Error('invalid prior ball World collider');
    prior.add(colliderKey(c));
  }
  const speed = Math.hypot(initial.velocity.x, initial.velocity.z), onFloor = initial.position.y <= p.ballRadius + 1e-12 && initial.velocity.y === 0;
  if (!finite(speed)) throw new Error('ball World speed arithmetic overflow');
  const phase = constrained ? 'airborne' : onFloor ? speed === 0 ? 'resting' : 'rolling' : 'airborne';
  const acceleration = constrained?.acceleration ?? (onFloor ? { x: speed === 0 ? 0 : -initial.velocity.x / speed * p.groundRollingDecelerationMps2,
    y: 0, z: speed === 0 ? 0 : -initial.velocity.z / speed * p.groundRollingDecelerationMps2 } : { x: 0, y: p.gravityY, z: 0 });
  const duration = constrained ? constrained.throughElapsedSeconds - moment.elapsedSeconds
    : Math.max(0, (input.throughTick - moment.originTick) / p.ticksPerSecond - moment.elapsedSeconds);
  const ground = phase !== 'airborne' ? null : initial.position.y <= p.ballRadius + 1e-12
    && (initial.velocity.y < 0 || constrained && initial.velocity.y === 0 && acceleration.y < 0) ? 0
    : roots(0.5 * acceleration.y, initial.velocity.y, initial.position.y - p.ballRadius)
      .find((t) => t > 0 && t <= duration && (initial.velocity.y + acceleration.y * t < 0
        // A constrained glove may reverse exactly at the floor; that new touch is still a physical boundary.
        || constrained && acceleration.y > 0 && t === -initial.velocity.y / acceleration.y)) ?? null;
  const stop = phase === 'rolling' && p.groundRollingDecelerationMps2 > 0 && speed / p.groundRollingDecelerationMps2 <= duration
    ? speed / p.groundRollingDecelerationMps2 : null;
  const horizon = Math.min(duration, ground ?? duration, stop ?? duration);
  const atMoment = (seconds: number): BallWorldMoment => {
    const state = sample(initial.position, initial.velocity, acceleration, seconds), elapsedSeconds = moment.elapsedSeconds + seconds;
    const stopped = stop !== null && seconds === stop;
    return { originTick: moment.originTick, elapsedSeconds, ball: { tick: quantizeEventTick(moment.originTick, elapsedSeconds, p.ticksPerSecond),
      position: state.point, velocity: stopped ? { x: 0, y: 0, z: 0 } : state.motion, spin: initial.spin } };
  };
  const contacts: BallWorldFieldBoundaryContact[] = [];
  const blockedContacts = new Set<BallWorldFieldBoundaryContact>();
  if (bases) {
    const boundary = findBallWorldBaseBoundary({ moment, acceleration, throughElapsedSeconds: moment.elapsedSeconds + horizon,
      ticksPerSecond: p.ticksPerSecond, ballRadius: p.ballRadius, ...bases });
    for (const contact of boundary?.contacts ?? []) { contacts.push(contact); if (contact.continuing) blockedContacts.add(contact); }
  }
  if (ground !== null) contacts.push({ kind: 'ground', moment: atMoment(ground) });
  if (stop !== null) contacts.push({ kind: 'rolling_stop', moment: atMoment(stop) });
  const sphere: AcceleratedSphereContactState = { tick: moment.originTick, center: initial.position, velocity: initial.velocity, acceleration, radius: p.ballRadius };
  for (const a of input.actors) {
    const s = a.primitive, dt = (moment.originTick - s.startTick) / p.ticksPerSecond + moment.elapsedSeconds - (a.startElapsedSeconds ?? 0);
    const start = sample(s.startCenter, s.startVelocity, s.acceleration, dt);
    const previous = prior.has(colliderKey({ kind: 'actor', playerId: a.playerId, role: s.role }));
    const other = { tick: moment.originTick, center: start.point, velocity: start.motion, acceleration: s.acceleration, radius: s.radius };
    const blocked = previous ? findAcceleratedSphereBlockedDepartureSeconds(sphere, other, horizon) : null;
    const axial = bases && blocked === null ? axialSphereTime(sphere, other, horizon, previous) : undefined;
    const time = blocked ?? (axial === undefined ? findAcceleratedSphereContactSeconds(sphere, other, horizon, previous ? 'after_departure' : 'include') : axial);
    if (time === null) continue;
    const state = sample(start.point, start.motion, s.acceleration, time), at = atMoment(time);
    const contact: BallWorldBoundaryContact = { kind: 'actor', playerId: a.playerId, role: s.role, moment: at, center: state.point, velocity: state.motion,
      normal: normal(at.ball.position, state.point), ...(blocked === null ? {} : { continuing: true as const }) };
    contacts.push(contact); if (blocked !== null) blockedContacts.add(contact);
  }
  for (const s of input.surfaces) {
    const event = surfaceTime(sphere, s, horizon, prior.has(colliderKey({ kind: 'surface', surfaceId: s.surfaceId })), bases !== undefined);
    if (event === null) continue;
    const at = atMoment(event.time), point = closestPoint(s, at.ball.position);
    const contact: BallWorldBoundaryContact = { kind: 'surface', surfaceId: s.surfaceId, moment: at, point, normal: normal(at.ball.position, point),
      ...(event.blocked ? { continuing: true as const } : {}) };
    contacts.push(contact); if (event.blocked) blockedContacts.add(contact);
  }
  if (!contacts.length) return freeze({ kind: phase === 'resting' ? 'resting' : 'moving', throughTick: input.throughTick, phase, moment: atMoment(duration) });
  const earliestTick = Math.min(...contacts.map((c) => c.moment.ball.tick));
  const earliestTime = Math.min(...contacts.map((c) => c.moment.elapsedSeconds));
  // Legacy grouping remains byte-compatible; new field actions use physical continuous ordering.
  const selected = contacts.filter((c) => bases ? c.moment.elapsedSeconds === earliestTime : c.moment.ball.tick === earliestTick);
  const earliest = selected.reduce((a, b) => a.elapsedSeconds <= b.moment.elapsedSeconds ? a : b.moment, selected[0].moment);
  if (bases) {
    const previous = findBallWorldBaseBoundary({ moment: earliest, acceleration, throughElapsedSeconds: earliest.elapsedSeconds,
      ticksPerSecond: p.ticksPerSecond, ballRadius: p.ballRadius, ...bases });
    for (const contact of previous?.contacts ?? []) {
      if (!contact.continuing || selected.some((c) => c.kind === 'base' && c.baseId === contact.baseId)) continue;
      selected.push(contact); blockedContacts.add(contact);
    }
  }
  for (const c of input.previousContacts) {
    if (selected.some((s) => (s.kind === 'actor' || s.kind === 'surface') && colliderKey(s) === colliderKey(c))) continue;
    if (c.kind === 'surface') {
      const surface = input.surfaces.find((s) => s.surfaceId === c.surfaceId)!, point = closestPoint(surface, earliest.ball.position);
      if (distance(point, earliest.ball.position) <= p.ballRadius) selected.push({ kind: 'surface', surfaceId: c.surfaceId,
        moment: earliest, point, normal: normal(earliest.ball.position, point), continuing: true });
    } else {
      const actor = input.actors.find((a) => a.playerId === c.playerId && a.primitive.role === c.role)!, s = actor.primitive;
      const state = sample(s.startCenter, s.startVelocity, s.acceleration,
        (moment.originTick - s.startTick) / p.ticksPerSecond + earliest.elapsedSeconds - (actor.startElapsedSeconds ?? 0));
      if (distance(state.point, earliest.ball.position) <= p.ballRadius + s.radius) selected.push({ kind: 'actor', playerId: c.playerId,
        role: c.role, moment: earliest, center: state.point, velocity: state.motion, normal: normal(earliest.ball.position, state.point), continuing: true });
    }
  }
  selected.sort((a, b) => {
    const key = (c: BallWorldFieldBoundaryContact) => JSON.stringify(c.kind === 'actor' ? [c.kind, c.playerId, c.role]
      : c.kind === 'surface' ? [c.kind, c.surfaceId] : c.kind === 'base' ? [c.kind, c.baseId] : [c.kind]);
    return key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0;
  });
  return freeze({ kind: 'boundary', phase, contacts: selected, moment: earliest,
    ...(selected.some((c) => blockedContacts.has(c)) ? { pendingReason: 'persistent_contact' as const } : {}) });
};

/** Free ball motion retains its existing gravity/rolling behavior. */
export const deriveBallWorldContinuation = (raw: BallWorldContinuationInput): BallWorldContinuation => deriveWorldSegment(raw) as BallWorldContinuation;

/** Explicit physical constraints share the same actor/panel/ground geometry, without a free-flight phase label. */
export const deriveAcceleratedBallWorldMotion = (raw: AcceleratedBallWorldMotionInput): AcceleratedBallWorldMotion => {
  const input = cloneInert(raw);
  if (!input?.moment || !input.parameters) throw new Error('invalid accelerated ball World motion');
  const throughTick = quantizeEventTick(input.moment.originTick, input.throughElapsedSeconds, input.parameters.ticksPerSecond);
  const result = deriveWorldSegment({ ...input, throughTick }, { acceleration: input.acceleration, throughElapsedSeconds: input.throughElapsedSeconds }) as BallWorldContinuation;
  if (result.kind === 'boundary') return freeze({ kind: 'boundary', moment: result.moment, contacts: result.contacts,
    ...(result.pendingReason ? { pendingReason: result.pendingReason } : {}) });
  return freeze({ kind: 'moving', moment: result.moment, throughTick: result.throughTick });
};

const fieldScope = <T extends BallWorldFieldContinuationInput | AcceleratedBallWorldFieldMotionInput>(raw: T, accelerated: boolean): T => {
  const input = cloneInert(raw), names = ['moment', 'parameters', 'actors', 'surfaces', 'previousContacts', 'bases', 'previousBaseContacts',
    ...(accelerated ? ['acceleration', 'throughElapsedSeconds'] : ['throughTick'])];
  if (!input || Object.keys(input).sort().join('|') !== names.sort().join('|')) throw new Error('invalid actual ball field motion scope');
  return input;
};
/** Additive causal field physics; old archived continuation uses its original implementation. */
export const deriveBallWorldFieldContinuation = (raw: BallWorldFieldContinuationInput): BallWorldFieldContinuation => {
  const input = fieldScope(raw, false);
  return deriveWorldSegment(input, undefined, { bases: input.bases, previousBaseContacts: input.previousBaseContacts });
};
export const deriveAcceleratedBallWorldFieldMotion = (raw: AcceleratedBallWorldFieldMotionInput): AcceleratedBallWorldFieldMotion => {
  const input = fieldScope(raw, true);
  if (!input.moment || !input.parameters) throw new Error('invalid accelerated actual ball field motion');
  const throughTick = quantizeEventTick(input.moment.originTick, input.throughElapsedSeconds, input.parameters.ticksPerSecond);
  const result = deriveWorldSegment({ ...input, throughTick }, { acceleration: input.acceleration, throughElapsedSeconds: input.throughElapsedSeconds },
    { bases: input.bases, previousBaseContacts: input.previousBaseContacts });
  if (result.kind === 'boundary') return freeze({ kind: 'boundary', moment: result.moment, contacts: result.contacts,
    ...(result.pendingReason ? { pendingReason: result.pendingReason } : {}) });
  return freeze({ kind: 'moving', moment: result.moment, throughTick: result.throughTick });
};
