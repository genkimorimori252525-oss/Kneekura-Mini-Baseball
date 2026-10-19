import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { sameBaseballMaterialOrientationV1 } from './BaseballSeamForceV1';
import type { Vec3 } from '../../model/geometry';
import { quantizeEventTick } from '../ExactEventTime';
import type { BallWorldMoment, BallWorldMotionActor, BallWorldFieldBoundaryContact, BallWorldCollider } from './BallWorldContinuation';
import type { BattedWorldSurface } from './BattedBallWorldContacts';
import type { BattedBallBasePrism } from './BattedBallBaseContact';
import type { BattedWorldBaseId } from './BattedWorldBaseGeometry';
import { createSourceFreeBallKernel, type SourceFreeBallDescriptorV2, type SourceFreeBallEvaluation } from './SourceFreeBallKernel';
import { sourceRk4PositionBounds } from './SourceFreeBallSpeedBound';
import { assertBattedResponseProfiles, type BallWorldResponseInput } from './BattedBallContactResponse';
import { respondToBallContact, type BallContactMaterial } from './BallContactResponse';
import { resolveCatchRetention } from '../fielding/CatchRetention';

export type SourceFreeBallWorldQueryInputV2 = Readonly<{
  descriptor: SourceFreeBallDescriptorV2;
  moment: BallWorldMoment;
  side: 'incoming' | 'outgoing';
  throughElapsedSeconds: number;
  actors: readonly BallWorldMotionActor[];
  surfaces: readonly BattedWorldSurface[];
  bases?: Readonly<Record<BattedWorldBaseId, BattedBallBasePrism>>;
  previousContacts?: readonly BallWorldCollider[];
  previousBaseContacts?: readonly BattedWorldBaseId[];
}>;
export type SourceFreeBallWorldQueryResultV2 = Readonly<{
  authority: 'SOURCE_NONLINEAR_FREE_BALL_QUERY_RESEARCH';
  kind: 'moving' | 'resting' | 'boundary';
  moment: BallWorldMoment;
  phase: SourceFreeBallEvaluation['phase'];
  contacts: readonly BallWorldFieldBoundaryContact[];
  numericalResolution: Readonly<{ contactBracketSeconds: number }>;
  pendingReason?: 'persistent_contact';
  /** Observed numerical witnesses only; these grant no response/escape authority. */
  contactSearchWitnesses: readonly Readonly<{ colliderKey: string; firstPossibleElapsedSeconds: number;
    witnessElapsedSeconds: number; signedGapMeters: number; positionRoundingBoundMeters: number }>[];
}> | Readonly<{
  authority: 'SOURCE_NONLINEAR_FREE_BALL_QUERY_RESEARCH'; kind: 'unresolved';
  reason: 'numerical_contact_refinement_required'; interval: Readonly<{ from: number; through: number }>;
}>;
const axes = ['x', 'y', 'z'] as const, baseIds = ['home', 'first', 'second', 'third'] as const;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const fields = (v: unknown, required: readonly string[], optional: readonly string[] = []) => !!v && typeof v === 'object' && !Array.isArray(v)
  && required.every(k => Object.hasOwn(v, k)) && Object.keys(v).every(k => required.includes(k) || optional.includes(k));
const vector = (v: Vec3) => fields(v, axes) && axes.every(axis => finite(v[axis]));
const id = (v: unknown): v is string => typeof v === 'string' && !!v.length && v === v.trim();
const tick = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const norm = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const distance = (a: Vec3, b: Vec3) => norm(sub(a, b));
const normal = (a: Vec3, b: Vec3): Vec3 | null => {
  const d = distance(a, b); return d === 0 ? null : { x: (a.x - b.x) / d, y: (a.y - b.y) / d, z: (a.z - b.z) / d };
};
const freeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
const json = (v: unknown): string => JSON.stringify(v, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : value);
type Collider = Readonly<{ key: string; separation: (time: number) => number; speedBound: (a: number, b: number) => number; accelerationBoundMps2: number;
  contact: (at: BallWorldMoment) => Exclude<BallWorldFieldBoundaryContact, { kind: 'ground' | 'rolling_stop' }> }>;
type Search = Readonly<{ kind: 'hit'; time: number; from: number; persistent?: true }> | Readonly<{ kind: 'clear' }>
  | Readonly<{ kind: 'unresolved'; from: number; through: number }>;
export type SourceImpactEscapeDiagnosticV3 = Readonly<{ colliderKey: string; incomingMoment: BallWorldMoment;
  outgoingMoment: BallWorldMoment; firstPossibleElapsedSeconds: number; witnessElapsedSeconds: number;
  initialSignedGapMeters: number; sourcePositionRoundingBoundMeters: number; gapBoundMeters: number;
  incomingNormalSpeedMps: number; outgoingNormalSpeedMps: number }>;
export type SourceImpactEscapeAdvanceV3 = Readonly<{ colliderKey: string; fromElapsedSeconds: number; escapeBracketThroughElapsedSeconds: number;
  provenClearThroughElapsedSeconds: number; linearDeviationMps2: number; positionRoundingBoundMeters: number;
  signedGapAtEscapeMeters: number; signedGapAtClearWindowEndMeters: number; supportingPlaneLowerGapAtEscapeMeters: number }>;
type PrivateImpulseEscape = Readonly<{ basisKey: string; scopeKey: string; colliderKey: string; diagnostic: SourceImpactEscapeDiagnosticV3;
  recordAdvance: (advance: SourceImpactEscapeAdvanceV3) => void }>;
const scopeKey = (q: SourceFreeBallWorldQueryInputV2) => json([q.actors, q.surfaces, q.bases ?? null]);
const basisKey = (d: SourceFreeBallDescriptorV2) => json([d.initial, d.profile,
  ...(d.materialOrientationAtStart === undefined ? [] : [d.materialOrientationAtStart])]);
const assertImpulseMaterialOrientation = (prior: SourceFreeBallDescriptorV2, next: SourceFreeBallDescriptorV2, seconds: number) => {
  if (prior.materialOrientationAtStart === undefined && next.materialOrientationAtStart === undefined) return;
  const incoming = createSourceFreeBallKernel(prior).evaluateAt(seconds, 'incoming').materialOrientation;
  if (incoming === undefined || next.materialOrientationAtStart === undefined || !sameBaseballMaterialOrientationV1(incoming, next.materialOrientationAtStart))
    throw new Error('v3 new basis material orientation differs from the original impulse');
};

/** First contact of an unimpeded free Source curve. It has no custody/response
 * capability: a caller must stop here, execute the original physical response,
 * and retain/rebase the Source curve as that response requires. */
const querySourceFreeBallWorld = (raw: SourceFreeBallWorldQueryInputV2, proof?: PrivateImpulseEscape): SourceFreeBallWorldQueryResultV2 => {
  const input = cloneInert(raw), { descriptor, moment } = input;
  if (!fields(input, ['descriptor', 'moment', 'side', 'throughElapsedSeconds', 'actors', 'surfaces'], ['bases', 'previousContacts', 'previousBaseContacts'])
    || !moment || !finite(input.throughElapsedSeconds) || input.throughElapsedSeconds < moment.elapsedSeconds
    || !['incoming', 'outgoing'].includes(input.side) || !Array.isArray(input.actors) || !Array.isArray(input.surfaces)) {
    throw new Error('invalid nonlinear Source World query');
  }
  const kernel = createSourceFreeBallKernel(descriptor), p = descriptor.profile.air.ticksPerSecond, radius = descriptor.profile.ground.radiusM;
  if (json(kernel.evaluateAt(moment.elapsedSeconds, input.side).moment) !== json(moment)
    || input.throughElapsedSeconds > descriptor.throughElapsedSeconds) throw new Error('nonlinear World query differs from its original Source moment');
  const ballAt = (time: number) => kernel.evaluateAt(time, 'incoming').moment.ball.position;
  const colliders: Collider[] = [], identities = new Set<string>();
  for (const actor of input.actors) {
    const s = actor?.primitive, key = json(['actor', actor?.playerId, s?.role]);
    if (!fields(actor, ['playerId', 'primitive'], ['startElapsedSeconds']) || !id(actor.playerId) || !s
      || !fields(s, ['role', 'radius', 'startTick', 'endTick', 'ticksPerSecond', 'startCenter', 'startVelocity', 'acceleration'])
      || !['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'].includes(s.role)
      || !finite(s.radius) || s.radius <= 0 || !tick(s.startTick) || !tick(s.endTick) || s.ticksPerSecond !== p
      || s.endTick < quantizeEventTick(moment.originTick, input.throughElapsedSeconds, p)
      || input.throughElapsedSeconds > (s.endTick - moment.originTick) / p
      || ![s.startCenter, s.startVelocity, s.acceleration].every(vector) || identities.has(key)
      || actor.startElapsedSeconds !== undefined && (!finite(actor.startElapsedSeconds) || actor.startElapsedSeconds < 0)) {
      throw new Error('invalid nonlinear World actor coverage');
    }
    const at = (time: number) => {
      const dt = (moment.originTick - s.startTick) / p + time - (actor.startElapsedSeconds ?? 0);
      if (dt < 0) throw new Error('nonlinear World actor begins after source time');
      const center = { x: s.startCenter.x + s.startVelocity.x * dt + s.acceleration.x * dt * dt / 2,
        y: s.startCenter.y + s.startVelocity.y * dt + s.acceleration.y * dt * dt / 2,
        z: s.startCenter.z + s.startVelocity.z * dt + s.acceleration.z * dt * dt / 2 };
      const velocity = { x: s.startVelocity.x + s.acceleration.x * dt, y: s.startVelocity.y + s.acceleration.y * dt,
        z: s.startVelocity.z + s.acceleration.z * dt };
      if (![center, velocity].every(vector)) throw new Error('nonlinear actor arithmetic overflow');
      return { center, velocity };
    };
    at(moment.elapsedSeconds); at(input.throughElapsedSeconds); identities.add(key);
    colliders.push({ key, separation: time => distance(ballAt(time), at(time).center) - radius - s.radius,
      speedBound: (a, b) => Math.max(norm(at(a).velocity), norm(at(b).velocity)), accelerationBoundMps2: norm(s.acceleration),
      contact: m => { const state = at(m.elapsedSeconds); return { kind: 'actor', playerId: actor.playerId, role: s.role,
        moment: m, ...state, normal: normal(m.ball.position, state.center) }; } });
  }
  for (const surface of input.surfaces) {
    const s = surface, key = json(['surface', s?.surfaceId]);
    if (!fields(s, ['surfaceId', 'start', 'end', 'minimumHeight', 'maximumHeight']) || !id(s.surfaceId)
      || !fields(s.start, ['x', 'z']) || !fields(s.end, ['x', 'z'])
      || ![s.start.x, s.start.z, s.end.x, s.end.z, s.minimumHeight, s.maximumHeight].every(finite)
      || s.minimumHeight < 0 || s.maximumHeight <= s.minimumHeight || identities.has(key)) throw new Error('invalid nonlinear surface');
    const dx = s.end.x - s.start.x, dz = s.end.z - s.start.z, length = Math.hypot(dx, dz);
    if (!finite(length) || length <= 0) throw new Error('invalid nonlinear surface extent');
    const closest = (point: Vec3): Vec3 => {
      const u = Math.max(0, Math.min(length, ((point.x - s.start.x) * dx + (point.z - s.start.z) * dz) / length));
      return { x: s.start.x + dx / length * u, y: Math.max(s.minimumHeight, Math.min(s.maximumHeight, point.y)), z: s.start.z + dz / length * u };
    };
    identities.add(key);
    colliders.push({ key, separation: time => distance(ballAt(time), closest(ballAt(time))) - radius, speedBound: () => 0, accelerationBoundMps2: 0,
      contact: m => { const point = closest(m.ball.position); return { kind: 'surface', surfaceId: s.surfaceId, moment: m,
        point, normal: normal(m.ball.position, point) }; } });
  }
  if (input.bases !== undefined) {
    if (!fields(input.bases, baseIds)) throw new Error('invalid nonlinear base coverage');
    for (const baseId of baseIds) {
      const b = input.bases[baseId], r = b?.region;
      if (!fields(b, ['region', 'bottomY', 'topY']) || !fields(r, ['center', 'halfSize', 'rotationRadians'])
        || !fields(r.center, ['x', 'z']) || !fields(r.halfSize, ['x', 'z'])
        || ![r.center.x, r.center.z, r.halfSize.x, r.halfSize.z, r.rotationRadians, b.bottomY, b.topY].every(finite)
        || r.halfSize.x <= 0 || r.halfSize.z <= 0 || b.bottomY < 0 || b.topY <= b.bottomY) throw new Error('invalid nonlinear base prism');
      const extent = Math.hypot(r.halfSize.x, r.halfSize.z);
      if (![extent, r.center.x - extent, r.center.x + extent, r.center.z - extent, r.center.z + extent,
        b.topY - b.bottomY].every(finite)) throw new Error('nonlinear base arithmetic overflow');
      const c = Math.cos(r.rotationRadians), s = Math.sin(r.rotationRadians);
      const closest = (point: Vec3): Vec3 => {
        const dx = point.x - r.center.x, dz = point.z - r.center.z;
        const x = Math.max(-r.halfSize.x, Math.min(r.halfSize.x, dx * c + dz * s));
        const z = Math.max(-r.halfSize.z, Math.min(r.halfSize.z, -dx * s + dz * c));
        return { x: r.center.x + x * c - z * s, y: Math.max(b.bottomY, Math.min(b.topY, point.y)), z: r.center.z + x * s + z * c };
      };
      colliders.push({ key: json(['base', baseId]), separation: time => distance(ballAt(time), closest(ballAt(time))) - radius,
        speedBound: () => 0, accelerationBoundMps2: 0, contact: m => { const point = closest(m.ball.position); return { kind: 'base', baseId, moment: m,
          point, normal: normal(m.ball.position, point) }; } });
    }
  }
  const previous = new Set<string>(), known = new Set(colliders.map(c => c.key));
  if (input.previousContacts !== undefined && !Array.isArray(input.previousContacts)
    || input.previousBaseContacts !== undefined && !Array.isArray(input.previousBaseContacts)) throw new Error('invalid nonlinear previous contact scope');
  for (const c of input.previousContacts ?? []) {
    const key = c?.kind === 'actor' && fields(c, ['kind', 'playerId', 'role']) ? json(['actor', c.playerId, c.role])
      : c?.kind === 'surface' && fields(c, ['kind', 'surfaceId']) ? json(['surface', c.surfaceId]) : '';
    if (!known.has(key) || previous.has(key)) throw new Error('invalid nonlinear previous collider');
    previous.add(key);
  }
  for (const base of input.previousBaseContacts ?? []) {
    const key = json(['base', base]);
    if (!known.has(key) || previous.has(key)) throw new Error('invalid nonlinear previous base');
    previous.add(key);
  }
  const firstBoundary = kernel.boundaries.find(b => b.kind !== 'rolling_started' && (b.elapsedSeconds > moment.elapsedSeconds
    || input.side === 'incoming' && b.elapsedSeconds === moment.elapsedSeconds) && b.elapsedSeconds <= input.throughElapsedSeconds);
  const horizon = firstBoundary?.elapsedSeconds ?? input.throughElapsedSeconds;
  let evaluations = 0;
  const searches: Readonly<{ collider: Collider; result: Search }>[] = colliders.map(collider => {
    const separation = (time: number) => {
      if (++evaluations > 500_000) throw new Error('nonlinear World contact search exceeds bounded work');
      const value = collider.separation(time);
      if (!finite(value)) throw new Error('nonlinear World separation arithmetic overflow');
      return value;
    };
    const search = (a: number, b: number, sa: number, sb: number, speed: number, rounding: number): Search => {
      if (sa <= 0) return { kind: 'hit', time: a, from: a };
      if (Math.min(sa, sb) > speed * (b - a) + rounding) return { kind: 'clear' };
      if (b - a <= 1e-15 || (a + b) / 2 === a || (a + b) / 2 === b) {
        return sb <= 0 ? { kind: 'hit', time: b, from: a } : { kind: 'unresolved', from: a, through: b };
      }
      const middle = (a + b) / 2, sm = separation(middle);
      const left = search(a, middle, sa, sm, speed, rounding);
      if (left.kind === 'hit') return left;
      if (left.kind === 'unresolved' && middle - left.from > 1e-12) return left;
      const right = search(middle, b, sm, sb, speed, rounding);
      if (left.kind === 'clear') return right;
      // An actual overlap witness is required. Only a numerically bounded
      // bracket may be resolved; an unwitnessed graze remains unsupported.
      if (right.kind === 'hit' && right.time - left.from <= 1e-12) return { ...right, from: left.from };
      return right.kind === 'unresolved' ? { kind: 'unresolved', from: left.from, through: right.through } : left;
    };
    const start = separation(moment.elapsedSeconds);
    let searchFrom = moment.elapsedSeconds;
    if (start <= 0) {
      const blocked = (): Readonly<{ collider: Collider; result: Search }> => ({ collider,
        result: { kind: 'hit', time: moment.elapsedSeconds, from: moment.elapsedSeconds, persistent: true } });
      if (!previous.has(collider.key)) return { collider, result: { kind: 'hit' as const, time: searchFrom, from: searchFrom } };
      // A real response may own a new basis. Neither a microscopic penetration
      // nor an arbitrary observation grants permission to skip a collider.
      const certified = proof && proof.colliderKey === collider.key && previous.size === 1
        && proof.basisKey === basisKey(descriptor) && proof.scopeKey === scopeKey(input)
        && json(moment) === json(proof.diagnostic.outgoingMoment);
      if (certified && start !== proof.diagnostic.initialSignedGapMeters) return blocked();
      if (start < 0 && !certified || input.side !== 'outgoing' || moment.elapsedSeconds !== descriptor.initial.elapsedSeconds) return blocked();
      const c = collider.contact(moment);
      if (!('normal' in c) || !c.normal) return blocked();
      const relative = sub(moment.ball.velocity, c.kind === 'actor' ? c.velocity : { x: 0, y: 0, z: 0 });
      const outward = axes.reduce((sum, axis) => sum + c.normal![axis] * relative[axis], 0);
      if (!finite(outward) || outward <= 0) return blocked();
      if (horizon === searchFrom) return { collider, result: { kind: 'clear' as const } };
      const cell = kernel.cells.find(cell => cell.fromElapsedSeconds === searchFrom);
      if (!cell) return blocked();
      const phase = kernel.evaluateAt(searchFrom, input.side).phase;
      const deviation = (phase === 'airborne' ? sourceRk4PositionBounds(moment.ball, cell.throughElapsedSeconds - searchFrom, descriptor.profile.air).linearDeviationMps2
        : Math.max(descriptor.profile.ground.material.slidingFriction * descriptor.profile.ground.gravityMps2,
          descriptor.profile.ground.material.rollingDecelerationMps2) / 2) + collider.accelerationBoundMps2 / 2;
      const window = Math.min(horizon - searchFrom, cell.throughElapsedSeconds - searchFrom, deviation === 0 ? Infinity : outward / (2 * deviation));
      const escape = 2 * (Math.max(0, -start) + cell.positionRoundingBoundMeters) / outward;
      if (!finite(window) || window <= 0 || !finite(escape) || escape > 1e-12 || escape >= window) {
        return { collider, result: { kind: 'unresolved' as const, from: searchFrom, through: searchFrom + Math.max(0, window) } };
      }
      const lowerGap = start + outward * escape - deviation * escape * escape - cell.positionRoundingBoundMeters;
      if (certified && (!finite(lowerGap) || lowerGap <= 0)) return blocked();
      // A convex closest-point normal is a supporting plane of the shape's
      // sphere-radius Minkowski offset. Its projection is at least
      // outward*h - deviation*h²; the published rounding bound is subtracted.
      // Require real separation witnesses; no position or clock is nudged.
      const gapAtEscape = separation(searchFrom + escape), gapAtEnd = separation(searchFrom + window);
      if (gapAtEscape <= 0 || gapAtEnd <= 0) return blocked();
      if (certified) proof.recordAdvance(freeze({ colliderKey: collider.key, fromElapsedSeconds: searchFrom,
        escapeBracketThroughElapsedSeconds: searchFrom + escape, provenClearThroughElapsedSeconds: searchFrom + window,
        linearDeviationMps2: deviation, positionRoundingBoundMeters: cell.positionRoundingBoundMeters,
        signedGapAtEscapeMeters: gapAtEscape, signedGapAtClearWindowEndMeters: gapAtEnd, supportingPlaneLowerGapAtEscapeMeters: lowerGap }));
      searchFrom += window;
    }
    for (const cell of kernel.cells) {
      const a = Math.max(searchFrom, cell.fromElapsedSeconds), b = Math.min(horizon, cell.throughElapsedSeconds);
      if (b <= a) continue;
      const speed = cell.maximumPositionSpeedMps + collider.speedBound(a, b);
      if (!finite(speed)) throw new Error('nonlinear relative speed bound overflows');
      const result = search(a, b, separation(a), separation(b), speed, cell.positionRoundingBoundMeters);
      if (result.kind !== 'clear') return { collider, result };
    }
    return { collider, result: { kind: 'clear' as const } };
  });
  const hits = searches.filter(s => s.result.kind === 'hit');
  const earliest = Math.min(horizon, ...hits.map(s => (s.result as Extract<Search, { kind: 'hit' }>).time));
  const uncertain = searches.find(s => s.result.kind === 'unresolved' && s.result.from <= earliest)?.result;
  if (uncertain?.kind === 'unresolved') return freeze({ authority: 'SOURCE_NONLINEAR_FREE_BALL_QUERY_RESEARCH', kind: 'unresolved',
    reason: 'numerical_contact_refinement_required', interval: { from: uncertain.from, through: uncertain.through } });
  const at = kernel.evaluateAt(earliest, firstBoundary?.elapsedSeconds === earliest ? 'incoming'
    : earliest === moment.elapsedSeconds ? input.side : 'incoming'), contacts: BallWorldFieldBoundaryContact[] = [];
  if (firstBoundary?.elapsedSeconds === earliest) contacts.push({ kind: firstBoundary.kind === 'ground' ? 'ground' : 'rolling_stop', moment: at.moment });
  const persistent = new Set(searches.filter(s => s.result.kind === 'hit' && s.result.persistent).map(s => s.collider.key));
  for (const collider of colliders) if (collider.separation(earliest) <= 0) {
    if (earliest === moment.elapsedSeconds && previous.has(collider.key)
      && searches.find(s => s.collider === collider)?.result.kind === 'clear') continue;
    const contact = collider.contact(at.moment);
    contacts.push(persistent.has(collider.key) ? { ...contact, continuing: true } : contact);
  }
  contacts.sort((a, b) => json(a) < json(b) ? -1 : json(a) > json(b) ? 1 : 0);
  const contactSearchWitnesses = hits.filter(s => s.result.kind === 'hit' && s.result.time === earliest).map(s => {
    const hit = s.result as Extract<Search, { kind: 'hit' }>;
    const cell = kernel.cells.find(c => c.fromElapsedSeconds <= hit.time && c.throughElapsedSeconds >= hit.time);
    return { colliderKey: s.collider.key, firstPossibleElapsedSeconds: hit.from, witnessElapsedSeconds: hit.time,
      signedGapMeters: s.collider.separation(hit.time), positionRoundingBoundMeters: cell?.positionRoundingBoundMeters ?? 0 };
  });
  return freeze({ authority: 'SOURCE_NONLINEAR_FREE_BALL_QUERY_RESEARCH', kind: contacts.length ? 'boundary' : at.phase === 'resting' ? 'resting' : 'moving',
    moment: at.moment, phase: at.phase, contacts, numericalResolution: { contactBracketSeconds: 1e-12 }, contactSearchWitnesses,
    ...(contacts.some(c => 'continuing' in c && c.continuing) ? { pendingReason: 'persistent_contact' as const } : {}) });
};

export const querySourceFreeBallWorldV2 = (raw: SourceFreeBallWorldQueryInputV2): SourceFreeBallWorldQueryResultV2 => querySourceFreeBallWorld(raw);

/** An ephemeral numerical session. Its private record identity prevents callers
 * supplying a witness/certificate; Source authenticity still belongs to Native's
 * independent original-row replay. No proof or Source chain is serialized here. */
export const createSourceImpactEscapeSessionV3 = () => {
  const observations = new WeakMap<object, Readonly<{ input: SourceFreeBallWorldQueryInputV2; result: SourceFreeBallWorldQueryResultV2 }>>();
  const proofs = new Map<string, PrivateImpulseEscape>(), diagnostics: SourceImpactEscapeDiagnosticV3[] = [], advances: SourceImpactEscapeAdvanceV3[] = [];
  const query = (raw: SourceFreeBallWorldQueryInputV2): SourceFreeBallWorldQueryResultV2 => {
    const input = cloneInert(raw), proof = proofs.get(basisKey(input.descriptor));
    const result = querySourceFreeBallWorld(input, proof);
    observations.set(result, { input: freeze(input), result });
    return result;
  };
  const adoptImpulse = (observed: SourceFreeBallWorldQueryResultV2, raw: BallWorldResponseInput, rawBasis: SourceFreeBallDescriptorV2): SourceImpactEscapeDiagnosticV3 => {
    const record = observations.get(observed);
    if (!record || record.result !== observed || observed.kind !== 'boundary' || observed.pendingReason || observed.contacts.length !== 1) {
      throw new Error('v3 impulse requires its own sole original query witness');
    }
    const response = cloneInert(raw), descriptor = cloneInert(rawBasis), c = observed.contacts[0], prior = record.input;
    assertBattedResponseProfiles(response);
    if (c.kind !== 'actor' && c.kind !== 'surface' || !c.normal
      || json(response.world.actors) !== json(prior.actors) || json(response.world.surfaces) !== json(prior.surfaces)
      || response.world.parameters.ticksPerSecond !== prior.descriptor.profile.air.ticksPerSecond
      || response.world.parameters.integrationStepTicks !== prior.descriptor.profile.air.integrationStepTicks
      || response.world.parameters.gravityY !== prior.descriptor.profile.air.gravityY
      || response.world.parameters.ballRadius !== prior.descriptor.profile.ground.radiusM
      || json(descriptor.profile) !== json(prior.descriptor.profile)) throw new Error('v3 original response geometry/profile scope differs');
    const colliderKey = c.kind === 'actor' ? json(['actor', c.playerId, c.role]) : json(['surface', c.surfaceId]);
    const witness = observed.contactSearchWitnesses.find(w => w.colliderKey === colliderKey);
    if (!witness || witness.witnessElapsedSeconds !== observed.moment.elapsedSeconds
      || witness.witnessElapsedSeconds <= prior.moment.elapsedSeconds
      || witness.witnessElapsedSeconds - witness.firstPossibleElapsedSeconds > 1e-12) throw new Error('v3 impulse contact bracket is unsupported');
    const surfaceVelocity = c.kind === 'actor' ? c.velocity : { x: 0, y: 0, z: 0 };
    const normalSpeed = (v: Vec3) => axes.reduce((sum, axis) => sum + c.normal![axis] * (v[axis] - surfaceVelocity[axis]), 0);
    const incomingNormalSpeedMps = normalSpeed(c.moment.ball.velocity);
    if (!finite(incomingNormalSpeedMps) || incomingNormalSpeedMps >= 0) throw new Error('v3 impulse lacks inward contact velocity');
    let outgoingBall;
    if (c.kind === 'actor') {
      const profile = response.actors.find(a => a.playerId === c.playerId && a.profile.role === c.role)!.profile;
      if (profile.role === 'glove') {
        const pocket = { x: c.center.x + profile.pocketCenterOffset.x, y: c.center.y + profile.pocketCenterOffset.y, z: c.center.z + profile.pocketCenterOffset.z };
        const retention = resolveCatchRetention({ contactTick: c.moment.ball.tick, ball: c.moment.ball,
          glove: { tick: c.moment.ball.tick, position: c.center, velocity: c.velocity }, contactNormal: c.normal,
          bodyStability: profile.bodyStability, pocketOffsetMeters: distance(c.moment.ball.position, pocket) }, profile.parameters);
        if (retention.outcome.kind !== 'live-ball') throw new Error('v3 free basis cannot adopt a secured custody candidate');
        outgoingBall = retention.outcome.ball;
      } else outgoingBall = respondToBallContact({ ball: c.moment.ball, normal: c.normal, surfaceVelocity, material: profile.material });
    } else outgoingBall = respondToBallContact({ ball: c.moment.ball, normal: c.normal, surfaceVelocity,
      material: response.surfaces.find(s => s.surfaceId === c.surfaceId)!.material });
    const outgoingMoment = { ...c.moment, ball: outgoingBall };
    if (json(descriptor.initial) !== json(outgoingMoment)) throw new Error('v3 new basis differs from original impulse/clock tuple');
    assertImpulseMaterialOrientation(prior.descriptor, descriptor, c.moment.elapsedSeconds);
    createSourceFreeBallKernel(descriptor);
    const outgoingNormalSpeedMps = normalSpeed(outgoingBall.velocity);
    if (!finite(outgoingNormalSpeedMps) || outgoingNormalSpeedMps <= 0) throw new Error('v3 original impulse has no outward departure');
    const kernel = createSourceFreeBallKernel(prior.descriptor), cell = kernel.cells.find(cell => cell.fromElapsedSeconds <= witness.witnessElapsedSeconds
      && cell.throughElapsedSeconds >= witness.witnessElapsedSeconds);
    if (!cell) throw new Error('v3 witness lacks original Source cell bounds');
    let otherSpeed = 0;
    if (c.kind === 'actor') {
      const actor = prior.actors.find(a => a.playerId === c.playerId && a.primitive.role === c.role)!, s = actor.primitive;
      const velocity = (time: number) => {
        const dt = (c.moment.originTick - s.startTick) / s.ticksPerSecond + time - (actor.startElapsedSeconds ?? 0);
        return norm({ x: s.startVelocity.x + s.acceleration.x * dt, y: s.startVelocity.y + s.acceleration.y * dt, z: s.startVelocity.z + s.acceleration.z * dt });
      };
      otherSpeed = Math.max(velocity(witness.firstPossibleElapsedSeconds), velocity(witness.witnessElapsedSeconds));
    }
    const gapBoundMeters = cell.positionRoundingBoundMeters + (cell.maximumPositionSpeedMps + otherSpeed)
      * (witness.witnessElapsedSeconds - witness.firstPossibleElapsedSeconds);
    if (!finite(gapBoundMeters) || witness.signedGapMeters < -gapBoundMeters) throw new Error('v3 witness penetration exceeds its original bracket bound');
    const diagnostic = freeze({ colliderKey, incomingMoment: c.moment, outgoingMoment,
      firstPossibleElapsedSeconds: witness.firstPossibleElapsedSeconds, witnessElapsedSeconds: witness.witnessElapsedSeconds,
      initialSignedGapMeters: witness.signedGapMeters, sourcePositionRoundingBoundMeters: cell.positionRoundingBoundMeters,
      gapBoundMeters, incomingNormalSpeedMps, outgoingNormalSpeedMps });
    proofs.set(basisKey(descriptor), { basisKey: basisKey(descriptor), scopeKey: scopeKey(prior), colliderKey, diagnostic,
      recordAdvance: advance => advances.push(advance) });
    diagnostics.push(diagnostic);
    return diagnostic;
  };
  /** Additive base-only response certificate. Native still rederives every
   * material from its original accepted field calibration, never this value. */
  const adoptBaseImpulse = (observed: SourceFreeBallWorldQueryResultV2, raw: BallWorldResponseInput,
    rawMaterials: Readonly<Record<BattedWorldBaseId, BallContactMaterial>>, rawBasis: SourceFreeBallDescriptorV2): SourceImpactEscapeDiagnosticV3 => {
    const record = observations.get(observed);
    if (!record || record.result !== observed || observed.kind !== 'boundary' || observed.pendingReason || observed.contacts.length !== 1
      || observed.contacts[0].kind !== 'base' || !observed.contacts[0].normal) throw new Error('v3 base impulse requires its own sole original base query witness');
    const response = cloneInert(raw), materials = cloneInert(rawMaterials), descriptor = cloneInert(rawBasis), c = observed.contacts[0], prior = record.input;
    assertBattedResponseProfiles(response);
    if (!prior.bases || !fields(materials, baseIds) || baseIds.some(id => !fields(materials[id], ['restitution', 'tangentialDamping', 'spinDamping'])
      || Object.values(materials[id]).some(n => !finite(n) || n < 0 || n > 1))
      || json(response.world.actors) !== json(prior.actors) || json(response.world.surfaces) !== json(prior.surfaces)
      || response.world.parameters.ticksPerSecond !== prior.descriptor.profile.air.ticksPerSecond
      || response.world.parameters.integrationStepTicks !== prior.descriptor.profile.air.integrationStepTicks
      || response.world.parameters.gravityY !== prior.descriptor.profile.air.gravityY
      || response.world.parameters.ballRadius !== prior.descriptor.profile.ground.radiusM
      || json(descriptor.profile) !== json(prior.descriptor.profile)) throw new Error('v3 original base response geometry/material/profile differs');
    const colliderKey = json(['base', c.baseId]), witness = observed.contactSearchWitnesses.find(w => w.colliderKey === colliderKey);
    if (!witness || witness.witnessElapsedSeconds !== c.moment.elapsedSeconds || witness.witnessElapsedSeconds <= prior.moment.elapsedSeconds
      || witness.witnessElapsedSeconds - witness.firstPossibleElapsedSeconds > 1e-12) throw new Error('v3 base impulse contact bracket is unsupported');
    const normalSpeed = (v: Vec3) => axes.reduce((sum, axis) => sum + c.normal![axis] * v[axis], 0);
    const incomingNormalSpeedMps = normalSpeed(c.moment.ball.velocity);
    if (!finite(incomingNormalSpeedMps) || incomingNormalSpeedMps >= 0) throw new Error('v3 base impulse lacks inward contact velocity');
    const ball = respondToBallContact({ ball: c.moment.ball, normal: c.normal!, surfaceVelocity: { x: 0, y: 0, z: 0 }, material: materials[c.baseId] });
    const outgoingMoment = { ...c.moment, ball };
    if (json(descriptor.initial) !== json(outgoingMoment)) throw new Error('v3 new base basis differs from original impulse/clock tuple');
    assertImpulseMaterialOrientation(prior.descriptor, descriptor, c.moment.elapsedSeconds);
    createSourceFreeBallKernel(descriptor);
    const outgoingNormalSpeedMps = normalSpeed(ball.velocity);
    if (!finite(outgoingNormalSpeedMps) || outgoingNormalSpeedMps <= 0) throw new Error('v3 original base impulse has no outward departure');
    const kernel = createSourceFreeBallKernel(prior.descriptor), cell = kernel.cells.find(cell => cell.fromElapsedSeconds <= witness.witnessElapsedSeconds
      && cell.throughElapsedSeconds >= witness.witnessElapsedSeconds);
    if (!cell) throw new Error('v3 base witness lacks original Source cell bounds');
    const gapBoundMeters = cell.positionRoundingBoundMeters + cell.maximumPositionSpeedMps * (witness.witnessElapsedSeconds - witness.firstPossibleElapsedSeconds);
    if (!finite(gapBoundMeters) || witness.signedGapMeters < -gapBoundMeters) throw new Error('v3 base witness penetration exceeds its original bracket bound');
    const diagnostic = freeze({ colliderKey, incomingMoment: c.moment, outgoingMoment, firstPossibleElapsedSeconds: witness.firstPossibleElapsedSeconds,
      witnessElapsedSeconds: witness.witnessElapsedSeconds, initialSignedGapMeters: witness.signedGapMeters,
      sourcePositionRoundingBoundMeters: cell.positionRoundingBoundMeters, gapBoundMeters, incomingNormalSpeedMps, outgoingNormalSpeedMps });
    proofs.set(basisKey(descriptor), { basisKey: basisKey(descriptor), scopeKey: scopeKey(prior), colliderKey, diagnostic,
      recordAdvance: advance => advances.push(advance) });
    diagnostics.push(diagnostic);
    return diagnostic;
  };
  return Object.freeze({ query, adoptImpulse, adoptBaseImpulse, diagnostics: () => freeze([...diagnostics]), advances: () => freeze([...advances]) });
};
