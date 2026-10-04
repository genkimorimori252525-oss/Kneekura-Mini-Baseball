import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import { quantizeEventTick } from '../ExactEventTime';
import { findAcceleratedSphereContactSeconds, findAcceleratedSphereBlockedDepartureSeconds,
  findPiecewiseAcceleratedSphereContactSeconds, findPiecewiseAcceleratedSphereBlockedDepartureSeconds,
  type AcceleratedSphereContactState } from '../collision/AcceleratedSphereContact';
import type { BattedBallBasePrism } from './BattedBallBaseContact';
import type { BattedWorldBaseId } from './BattedWorldBaseGeometry';
import type { BallWorldMoment } from './BallWorldContinuation';

export type BallWorldBaseBoundaryInput = Readonly<{
  moment: BallWorldMoment; acceleration: Vec3; throughElapsedSeconds: number; ticksPerSecond: number; ballRadius: number;
  bases: Readonly<Record<BattedWorldBaseId, BattedBallBasePrism>>; previousBaseContacts: readonly BattedWorldBaseId[];
}>;
export type BallWorldBaseBoundaryContact = Readonly<{
  kind: 'base'; baseId: BattedWorldBaseId; moment: BallWorldMoment; point: Vec3; normal: Vec3 | null; continuing?: true;
}>;
export type BallWorldBaseBoundary = Readonly<{ moment: BallWorldMoment; contacts: readonly BallWorldBaseBoundaryContact[] }>;
const baseIds = ['home', 'first', 'second', 'third'] as const;
const axes = ['x', 'y', 'z'] as const;
const fields = (v: unknown, names: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).sort().join('|') === [...names].sort().join('|');
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const tick = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const vector = (v: Vec3) => fields(v, axes) && axes.every((axis) => finite(v[axis]));
const freeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const sample = (p: Vec3, v: Vec3, a: Vec3, t: number) => {
  const point = { x: p.x + v.x * t + 0.5 * a.x * t * t, y: p.y + v.y * t + 0.5 * a.y * t * t,
    z: p.z + v.z * t + 0.5 * a.z * t * t };
  const velocity = { x: v.x + a.x * t, y: v.y + a.y * t, z: v.z + a.z * t };
  if (!vector(point) || !vector(velocity)) throw new Error('ball/base motion arithmetic overflow');
  return { point, velocity };
};
// Binary coefficient scaling protects the discriminant without merging distinct feature times.
const roots = (a: number, b: number, c: number): number[] => {
  if (![a, b, c].every(finite)) throw new Error('ball/base feature arithmetic overflow');
  if (a === 0) return b === 0 ? [] : [-c / b];
  const maximum = Math.max(Math.abs(a), Math.abs(b), Math.abs(c));
  const scale = 2 ** Math.max(-1022, Math.min(1023, Math.floor(Math.log2(maximum))));
  a /= scale; b /= scale; c /= scale;
  const d = b * b - 4 * a * c;
  if (!finite(d)) throw new Error('ball/base root arithmetic overflow');
  if (d < 0) return [];
  if (d === 0) return [-b / (2 * a)];
  const q = -0.5 * (b + Math.sign(b || 1) * Math.sqrt(d));
  return [q / a, c / q];
};
const scope = (raw: BallWorldBaseBoundaryInput) => {
  const input = cloneInert(raw), m = input?.moment, b = m?.ball;
  if (!fields(input, ['moment', 'acceleration', 'throughElapsedSeconds', 'ticksPerSecond', 'ballRadius', 'bases', 'previousBaseContacts'])
    || !fields(m, ['originTick', 'elapsedSeconds', 'ball']) || !fields(b, ['tick', 'position', 'velocity', 'spin'])
    || !tick(m.originTick) || !finite(m.elapsedSeconds) || m.elapsedSeconds < 0 || !tick(b.tick)
    || !vector(b.position) || !vector(b.velocity) || !vector(b.spin) || !vector(input.acceleration)
    || !tick(input.ticksPerSecond) || input.ticksPerSecond === 0 || !finite(input.ballRadius) || input.ballRadius <= 0
    || !finite(input.throughElapsedSeconds) || input.throughElapsedSeconds < m.elapsedSeconds
    || quantizeEventTick(m.originTick, m.elapsedSeconds, input.ticksPerSecond) !== b.tick
    || !fields(input.bases, baseIds) || !Array.isArray(input.previousBaseContacts)
    || new Set(input.previousBaseContacts).size !== input.previousBaseContacts.length
    || input.previousBaseContacts.some((base) => !baseIds.includes(base))) throw new Error('invalid actual ball/base boundary scope');
  quantizeEventTick(m.originTick, input.throughElapsedSeconds, input.ticksPerSecond);
  for (const prism of Object.values(input.bases)) {
    const r = prism?.region;
    if (!fields(prism, ['region', 'bottomY', 'topY']) || !fields(r, ['center', 'halfSize', 'rotationRadians'])
      || !fields(r.center, ['x', 'z']) || !fields(r.halfSize, ['x', 'z'])
      || ![r.center.x, r.center.z, r.halfSize.x, r.halfSize.z, r.rotationRadians, prism.bottomY, prism.topY].every(finite)
      || r.halfSize.x <= 0 || r.halfSize.z <= 0 || prism.topY <= prism.bottomY) throw new Error('invalid actual ball/base prism');
    const extent = Math.hypot(r.halfSize.x, r.halfSize.z);
    if (![extent, r.center.x - extent, r.center.x + extent, r.center.z - extent, r.center.z + extent,
      prism.topY - prism.bottomY].every(finite)) throw new Error('ball/base prism arithmetic overflow');
  }
  const duration = input.throughElapsedSeconds - m.elapsedSeconds;
  sample(b.position, b.velocity, input.acceleration, duration);
  return { input, duration };
};
const localFrame = (prism: BattedBallBasePrism) => {
  const c = Math.cos(prism.region.rotationRadians), s = Math.sin(prism.region.rotationRadians);
  const rotate = (v: Vec3): Vec3 => ({ x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c });
  const toLocal = (p: Vec3): Vec3 => rotate({ x: p.x - prism.region.center.x, y: p.y, z: p.z - prism.region.center.z });
  const toWorld = (p: Vec3): Vec3 => ({ x: prism.region.center.x + p.x * c - p.z * s, y: p.y,
    z: prism.region.center.z + p.x * s + p.z * c });
  const low = { x: -prism.region.halfSize.x, y: prism.bottomY, z: -prism.region.halfSize.z };
  const high = { x: prism.region.halfSize.x, y: prism.topY, z: prism.region.halfSize.z };
  const closest = (p: Vec3): Vec3 => ({ x: Math.max(low.x, Math.min(high.x, p.x)),
    y: Math.max(low.y, Math.min(high.y, p.y)), z: Math.max(low.z, Math.min(high.z, p.z)) });
  return { rotate, toLocal, toWorld, low, high, closest };
};
const baseTime = (ball: AcceleratedSphereContactState, prism: BattedBallBasePrism, duration: number, previous: boolean, piecewise = false) => {
  const contactSeconds = piecewise ? findPiecewiseAcceleratedSphereContactSeconds : findAcceleratedSphereContactSeconds;
  const blockedSeconds = piecewise ? findPiecewiseAcceleratedSphereBlockedDepartureSeconds : findAcceleratedSphereBlockedDepartureSeconds;
  const f = localFrame(prism), center = f.toLocal(ball.center), velocity = f.rotate(ball.velocity), acceleration = f.rotate(ball.acceleration);
  if (![center, velocity, acceleration].every(vector)) throw new Error('ball/base local projection arithmetic overflow');
  const touching = distance(center, f.closest(center)) <= ball.radius;
  if (!previous && touching) return { time: 0, continuing: false };
  if (duration === 0) return previous && touching ? { time: 0, continuing: true } : null;
  const changes = [0, duration, ...axes.flatMap((axis) => [f.low[axis], f.high[axis]]
    .flatMap((boundary) => roots(0.5 * acceleration[axis], velocity[axis], center[axis] - boundary)))];
  const boundaries = [...new Set(changes.filter((t) => finite(t) && t >= 0 && t <= duration))].sort((a, b) => a - b);
  let departed = !previous || !touching;
  for (let index = 0; index + 1 < boundaries.length; index++) {
    const start = boundaries[index], end = boundaries[index + 1], middle = start + (end - start) / 2;
    const mid = sample(center, velocity, acceleration, middle).point, at = sample(center, velocity, acceleration, start);
    const moving = (axis: keyof Vec3) => mid[axis] > f.low[axis] && mid[axis] < f.high[axis];
    const component = (axis: keyof Vec3) => moving(axis) ? at.point[axis] : mid[axis] <= f.low[axis] ? f.low[axis] : f.high[axis];
    const feature: AcceleratedSphereContactState = { tick: ball.tick, radius: ball.radius / 2,
      center: { x: component('x'), y: component('y'), z: component('z') },
      velocity: { x: moving('x') ? at.velocity.x : 0, y: moving('y') ? at.velocity.y : 0, z: moving('z') ? at.velocity.z : 0 },
      acceleration: { x: moving('x') ? acceleration.x : 0, y: moving('y') ? acceleration.y : 0, z: moving('z') ? acceleration.z : 0 } };
    const movingBall = { tick: ball.tick, radius: ball.radius / 2, center: at.point, velocity: at.velocity, acceleration };
    if (!departed && axes.every((axis) => movingBall.velocity[axis] === feature.velocity[axis]
      && acceleration[axis] === feature.acceleration[axis]) && distance(at.point, feature.center) <= ball.radius) {
      return { time: start, continuing: true };
    }
    const blocked = departed ? null : blockedSeconds(movingBall, feature, end - start);
    if (blocked !== null) return { time: start + blocked, continuing: true };
    const outside = axes.filter((axis) => !moving(axis));
    // A face has one signed separation coordinate. Solve it directly so a
    // closed physical endpoint is not lost to a normalized squared polynomial.
    const faceAxis = outside.length === 1 ? outside[0] : null;
    let time: number | null;
    if (faceAxis) {
      const d = at.point[faceAxis] - feature.center[faceAxis], v = at.velocity[faceAxis], a = acceleration[faceAxis];
      const faceRoots = [ball.radius, -ball.radius].flatMap((r) => roots(0.5 * a, v, d - r))
        .filter((t) => finite(t) && t >= 0 && t <= end - start).sort((a, b) => a - b);
      time = departed && Math.abs(d) <= ball.radius ? 0 : faceRoots.find((t) => {
        const separation = d + v * t + 0.5 * a * t * t, speed = v + a * t;
        return departed || t > 0 && (separation * speed < 0 || speed === 0 && separation * a > 0);
      }) ?? null;
    } else time = contactSeconds(movingBall, feature, end - start, departed ? 'include' : 'after_departure');
    if (time !== null) return { time: start + time, continuing: false };
    const endpoint = sample(center, velocity, acceleration, end).point;
    if (distance(endpoint, f.closest(endpoint)) > ball.radius) departed = true;
  }
  return null;
};
/** A causal collision candidate only; its Native action owner must adopt it before rules consume it. */
const deriveBallWorldBaseBoundary = (raw: BallWorldBaseBoundaryInput, piecewise = false): BallWorldBaseBoundary | null => {
  const { input, duration } = scope(raw), initial = input.moment.ball;
  const sphere = { tick: input.moment.originTick, center: initial.position, velocity: initial.velocity,
    acceleration: input.acceleration, radius: input.ballRadius };
  const contacts: BallWorldBaseBoundaryContact[] = [];
  for (const baseId of baseIds) {
    const prism = input.bases[baseId], event = baseTime(sphere, prism, duration, input.previousBaseContacts.includes(baseId), piecewise);
    if (!event) continue;
    const state = sample(initial.position, initial.velocity, input.acceleration, event.time);
    const elapsedSeconds = event.time === duration ? input.throughElapsedSeconds : input.moment.elapsedSeconds + event.time;
    const moment = { ...input.moment, elapsedSeconds, ball: { ...initial,
      tick: quantizeEventTick(input.moment.originTick, elapsedSeconds, input.ticksPerSecond), position: state.point, velocity: state.velocity } };
    const f = localFrame(prism), point = f.toWorld(f.closest(f.toLocal(state.point))), length = distance(state.point, point);
    if (!vector(point) || !finite(length)) throw new Error('ball/base contact arithmetic overflow');
    const normal = length === 0 ? null : { x: (state.point.x - point.x) / length, y: (state.point.y - point.y) / length,
      z: (state.point.z - point.z) / length };
    contacts.push({ kind: 'base', baseId, moment, point, normal, ...(event.continuing ? { continuing: true as const } : {}) });
  }
  if (!contacts.length) return null;
  const earliest = contacts.reduce((a, b) => a.elapsedSeconds <= b.moment.elapsedSeconds ? a : b.moment, contacts[0].moment);
  return freeze({ moment: earliest, contacts: contacts.filter((contact) => contact.moment.elapsedSeconds === earliest.elapsedSeconds)
    .sort((a, b) => a.baseId < b.baseId ? -1 : a.baseId > b.baseId ? 1 : 0) });
};

/** Original archived field boundary convention. */
export const findBallWorldBaseBoundary = (raw: BallWorldBaseBoundaryInput): BallWorldBaseBoundary | null => deriveBallWorldBaseBoundary(raw);
/** Piecewise-only horizon-independent edge/corner polynomial roots. */
export const findPiecewiseBallWorldBaseBoundary = (raw: BallWorldBaseBoundaryInput): BallWorldBaseBoundary | null => deriveBallWorldBaseBoundary(raw, true);
