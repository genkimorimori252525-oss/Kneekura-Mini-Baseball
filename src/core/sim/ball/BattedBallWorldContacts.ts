import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec2, Vec3 } from '../../model/geometry';
import type { BattedBallInitialState } from '../contact/BatBallContact';
import { findAcceleratedSphereContactTick, findAcceleratedSphereContactTime, type AcceleratedSphereContactState } from '../collision/AcceleratedSphereContact';
import { sampleDefenderPhysicalPrimitiveSegment, type DefenderPhysicalPrimitiveSegment,
  type DefenderPhysicalPrimitiveSample } from '../fielding/DefenderPhysicalPrimitive';
import { createBattedBallFlightEvidence, type BattedBallFlightEvidence } from './BattedBallFlightEvidence';
import type { BallFlightParameters } from './BallFlight';

export type BattedWorldSurface = Readonly<{
  surfaceId: string; start: Vec2; end: Vec2; minimumHeight: number; maximumHeight: number;
}>;
export type BattedWorldActorPrimitive = Readonly<{ playerId: string; primitive: DefenderPhysicalPrimitiveSegment }>;
export type BattedWorldContact = Readonly<{ kind: 'ground' }>
  | Readonly<{ kind: 'actor'; playerId: string; role: DefenderPhysicalPrimitiveSegment['role']; actor: DefenderPhysicalPrimitiveSample }>
  | Readonly<{ kind: 'surface'; surfaceId: string; point: Vec3 }>;
export type BattedWorldContactResult = Readonly<{
  kind: 'contact'; tick: number; ball: BattedBallInitialState; contacts: readonly BattedWorldContact[];
}> | Readonly<{ kind: 'airborne'; throughTick: number; ball: BattedBallInitialState }>;
export type BattedWorldContactInput = Readonly<{
  flight: BattedBallFlightEvidence; parameters: BallFlightParameters; throughTick: number;
  actors: readonly BattedWorldActorPrimitive[]; surfaces: readonly BattedWorldSurface[];
}>;
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
const tick = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const vector = (v: Vec3) => v && [v.x, v.y, v.z].every(finite);
const freeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
const json = (v: unknown) => JSON.stringify(v, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : value);
const ballAt = (initial: BattedBallInitialState, at: number, p: BallFlightParameters,
  dt = (at - initial.tick) / p.ticksPerSecond): BattedBallInitialState => {
  const state = { tick: at, position: { x: initial.position.x + initial.velocity.x * dt,
    y: initial.position.y + initial.velocity.y * dt + 0.5 * p.gravityY * dt * dt,
    z: initial.position.z + initial.velocity.z * dt },
    velocity: { x: initial.velocity.x, y: initial.velocity.y + p.gravityY * dt, z: initial.velocity.z }, spin: initial.spin };
  if (!vector(state.position) || !vector(state.velocity)) throw new Error('batted World flight arithmetic overflow');
  return state;
};
const surfaceFrame = (s: BattedWorldSurface) => {
  if (!s || !id(s.surfaceId) || !s.start || !s.end || ![s.start.x, s.start.z, s.end.x, s.end.z, s.minimumHeight, s.maximumHeight].every(finite)
    || s.minimumHeight < 0 || s.maximumHeight <= s.minimumHeight) throw new Error('invalid batted World surface');
  const dx = s.end.x - s.start.x, dz = s.end.z - s.start.z, length = Math.hypot(dx, dz);
  if (!finite(length) || length <= 0) throw new Error('invalid batted World surface extent');
  return { length, ux: dx / length, uz: dz / length };
};
const surfaceContactTick = (initial: BattedBallInitialState, endTick: number, p: BallFlightParameters, s: BattedWorldSurface): number | null => {
  const { length, ux, uz } = surfaceFrame(s), duration = endTick - initial.tick;
  const along = (point: Vec3) => (point.x - s.start.x) * ux + (point.z - s.start.z) * uz;
  const u0 = along(initial.position), uv = initial.velocity.x * ux + initial.velocity.z * uz;
  const within = (value: number, lower: number, upper: number) => value >= lower - 1e-9 && value <= upper + 1e-9;
  const candidates: number[] = [];
  // Each rectangle feature is a closest-point trajectory. The sphere kernel depends only on the sum of radii;
  // splitting the actual ball radius between ball/point preserves that sum without a fictitious surface thickness.
  const feature = (u: number | null, y: number | null) => {
    const movingU = u === null, movingY = y === null;
    const positionU = u ?? u0, positionY = y ?? initial.position.y;
    const wallPoint: AcceleratedSphereContactState = { tick: initial.tick,
      center: { x: s.start.x + ux * positionU, y: positionY, z: s.start.z + uz * positionU },
      velocity: { x: movingU ? ux * uv : 0, y: movingY ? initial.velocity.y : 0, z: movingU ? uz * uv : 0 },
      acceleration: { x: 0, y: movingY ? p.gravityY : 0, z: 0 }, radius: p.ballRadius / 2 };
    const contact = findAcceleratedSphereContactTime({ tick: initial.tick, center: initial.position, velocity: initial.velocity,
      acceleration: { x: 0, y: p.gravityY, z: 0 }, radius: p.ballRadius / 2 }, wallPoint, duration, { ticksPerSecond: p.ticksPerSecond });
    if (contact === null) return;
    const ball = ballAt(initial, contact.tick, p, contact.elapsedSeconds);
    if ((!movingU || within(along(ball.position), 0, length)) && (!movingY || within(ball.position.y, s.minimumHeight, s.maximumHeight))) candidates.push(contact.tick);
  };
  feature(null, null);
  for (const u of [0, length]) feature(u, null);
  for (const y of [s.minimumHeight, s.maximumHeight]) feature(null, y);
  for (const u of [0, length]) for (const y of [s.minimumHeight, s.maximumHeight]) feature(u, y);
  return candidates.length === 0 ? null : Math.min(...candidates);
};
const surfacePoint = (s: BattedWorldSurface, point: Vec3): Vec3 => {
  const { length, ux, uz } = surfaceFrame(s);
  const u = Math.max(0, Math.min(length, (point.x - s.start.x) * ux + (point.z - s.start.z) * uz));
  return { x: s.start.x + ux * u, y: Math.max(s.minimumHeight, Math.min(s.maximumHeight, point.y)), z: s.start.z + uz * u };
};

/** Supported physical contacts only. Their simultaneity is preserved; no baseball interpretation is chosen here. */
export const deriveFirstBattedWorldContact = (raw: BattedWorldContactInput): BattedWorldContactResult => {
  const input = cloneInert(raw), { flight, parameters: p } = input;
  if (!flight || !p || !tick(input.throughTick) || !tick(flight.contact?.tick) || input.throughTick < flight.contact.tick
    || !Array.isArray(input.actors) || !Array.isArray(input.surfaces)) throw new Error('invalid batted World contact interval');
  const actual = createBattedBallFlightEvidence({ contact: flight.contact, parameters: p, searchDurationTicks: input.throughTick - flight.contact.tick });
  if (json(actual.initialBall) !== json(flight.initialBall) || actual.ballRadiusMeters !== flight.ballRadiusMeters
    || flight.firstGroundContact && flight.firstGroundContact.tick <= input.throughTick
      && json(actual.firstGroundContact) !== json(flight.firstGroundContact)) throw new Error('batted World original flight evidence differs');
  const actorKeys = new Set<string>(), surfaceIds = new Set<string>();
  for (const actor of input.actors) {
    const s = actor?.primitive, key = JSON.stringify([actor?.playerId, s?.role]);
    if (!id(actor?.playerId) || !s || actorKeys.has(key) || !['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'].includes(s.role)
      || !tick(s.startTick) || !tick(s.endTick) || s.startTick > actual.initialBall.tick || s.endTick < input.throughTick
      || s.ticksPerSecond !== p.ticksPerSecond || !finite(s.radius) || s.radius <= 0
      || !vector(s.startCenter) || !vector(s.startVelocity) || !vector(s.acceleration)) throw new Error('invalid batted World actor primitive');
    actorKeys.add(key);
    const end = sampleDefenderPhysicalPrimitiveSegment(s, input.throughTick);
    if (!vector(end.center) || !vector(end.velocity)) throw new Error('batted World actor arithmetic overflow');
  }
  for (const surface of input.surfaces) {
    surfaceFrame(surface);
    if (surfaceIds.has(surface.surfaceId)) throw new Error('duplicate batted World surface'); surfaceIds.add(surface.surfaceId);
  }
  const candidates: { tick: number; contact: BattedWorldContact }[] = [];
  const ground = actual.firstGroundContact;
  if (ground) candidates.push({ tick: ground.tick, contact: { kind: 'ground' } });
  const through = ground?.tick ?? input.throughTick, initial = actual.initialBall;
  for (const actor of input.actors) {
    const start = sampleDefenderPhysicalPrimitiveSegment(actor.primitive, initial.tick);
    const at = findAcceleratedSphereContactTick({ tick: initial.tick, center: initial.position, velocity: initial.velocity,
      acceleration: { x: 0, y: p.gravityY, z: 0 }, radius: p.ballRadius },
      { tick: initial.tick, center: start.center, velocity: start.velocity, acceleration: start.acceleration, radius: start.radius },
      through - initial.tick, { ticksPerSecond: p.ticksPerSecond });
    if (at !== null) candidates.push({ tick: at, contact: { kind: 'actor', playerId: actor.playerId, role: actor.primitive.role,
      actor: sampleDefenderPhysicalPrimitiveSegment(actor.primitive, at) } });
  }
  for (const surface of input.surfaces) {
    const at = surfaceContactTick(initial, through, p, surface);
    if (at !== null) candidates.push({ tick: at, contact: { kind: 'surface', surfaceId: surface.surfaceId, point: surfacePoint(surface, ballAt(initial, at, p).position) } });
  }
  if (candidates.length === 0) return freeze({ kind: 'airborne', throughTick: input.throughTick, ball: ballAt(initial, input.throughTick, p) });
  const at = Math.min(...candidates.map((c) => c.tick));
  const contacts = candidates.filter((c) => c.tick === at).map((c) => c.contact).sort((a, b) => {
    const key = (c: BattedWorldContact) => JSON.stringify(c.kind === 'actor' ? [c.kind, c.playerId, c.role] : c.kind === 'surface' ? [c.kind, c.surfaceId] : [c.kind]);
    return key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0;
  });
  return freeze({ kind: 'contact', tick: at, ball: ground?.tick === at ? ground.state : ballAt(initial, at, p), contacts });
};
