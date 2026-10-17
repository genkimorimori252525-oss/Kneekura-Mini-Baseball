import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { resolveCatchRetention, type CatchRetentionResolution } from '../fielding/CatchRetention';
import { respondToGroundContact } from './BallFlight';
import { respondToBallContact } from './BallContactResponse';
import { deriveBallWorldContinuation, type BallWorldCollider, type BallWorldContinuation, type BallWorldMoment } from './BallWorldContinuation';
import { deriveBattedBallContactResponse, type BattedBallContactResponse, type BattedBallContactResponseInput, type BallWorldResponseInput } from './BattedBallContactResponse';
import { createSourceFreeBallKernel, type SourceFreeBallDescriptorV2 } from './SourceFreeBallKernel';

export type BattedWorldBallCursor = Readonly<{ moment: BallWorldMoment; previousContacts: readonly BallWorldCollider[]; sourceCurve?: SourceFreeBallDescriptorV2;
  /** Explicit only for the new field family; archived v2 continuations keep their original shape. */
  sourceSide?: 'incoming' | 'outgoing' }>;
export type BattedWorldContinuationStepResponse = Readonly<{
  kind: 'moving' | 'resting' | 'ground' | 'rolling_stop' | 'rebound'; cursor: BattedWorldBallCursor; retention?: CatchRetentionResolution;
}> | Readonly<{ kind: 'capture_candidate'; cursor: null; moment: BallWorldMoment; retention: CatchRetentionResolution }>
  | Readonly<{ kind: 'unresolved'; cursor: null; reason: 'simultaneous' | 'degenerate_normal' | 'persistent_contact' }>;
export type BattedWorldContinuationStep = Readonly<{ throughTick: number; world: BallWorldContinuation; response: BattedWorldContinuationStepResponse }>;
export type BattedWorldContinuation = Readonly<{ original: BattedBallContactResponse; initialCursor: BattedWorldBallCursor | null;
  steps: readonly BattedWorldContinuationStep[]; cursor: BattedWorldBallCursor | null }>;
const freeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
const key = (c: BallWorldCollider) => JSON.stringify(c.kind === 'actor' ? [c.kind, c.playerId, c.role] : [c.kind, c.surfaceId]);
const addCollider = (previous: readonly BallWorldCollider[], contact: BallWorldCollider): readonly BallWorldCollider[] =>
  previous.some((c) => key(c) === key(contact)) ? previous : [...previous, contact];
const json = (v: unknown): string => JSON.stringify(v, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : value);
const withImpulseBasis = (prior: BattedWorldBallCursor, moment: BallWorldMoment, previousContacts: readonly BallWorldCollider[]): BattedWorldBallCursor => ({
  moment, previousContacts, ...(prior.sourceCurve ? { sourceCurve: { ...prior.sourceCurve, initial: moment } } : {}),
  ...(prior.sourceSide ? { sourceSide: 'outgoing' as const } : {}) });

export const respondToBallWorldBoundary = (input: BallWorldResponseInput, prior: BattedWorldBallCursor, world: BallWorldContinuation): BattedWorldContinuationStepResponse => {
  if (world.kind !== 'boundary') return { kind: world.kind, cursor: { ...prior, moment: world.moment,
    ...(prior.sourceSide ? { sourceSide: 'outgoing' as const } : {}) } };
  if (world.pendingReason) return { kind: 'unresolved', cursor: null, reason: world.pendingReason };
  if (world.contacts.length !== 1) return { kind: 'unresolved', cursor: null, reason: 'simultaneous' };
  const c = world.contacts[0], moment = c.moment;
  if (c.kind === 'rolling_stop') return { kind: 'rolling_stop', cursor: { ...prior, moment } };
  if (c.kind === 'ground') {
    if (prior.sourceCurve) {
      const kernel = createSourceFreeBallKernel(prior.sourceCurve);
      if (json(kernel.evaluateAt(moment.elapsedSeconds, 'incoming').moment) !== json(moment)) throw new Error('nonlinear ground response incoming Source differs');
      return { kind: 'ground', cursor: { ...prior, moment: kernel.evaluateAt(moment.elapsedSeconds, 'outgoing').moment,
        ...(prior.sourceSide ? { sourceSide: 'outgoing' as const } : {}) } };
    }
    return { kind: 'ground', cursor: { ...prior, moment: { ...moment, ball: respondToGroundContact(moment.ball, input.world.parameters) } } };
  }
  if (!c.normal) return { kind: 'unresolved', cursor: null, reason: 'degenerate_normal' };
  const collider: BallWorldCollider = c.kind === 'actor' ? { kind: c.kind, playerId: c.playerId, role: c.role } : { kind: c.kind, surfaceId: c.surfaceId };
  const previousContacts = addCollider(prior.previousContacts, collider);
  if (c.kind === 'actor') {
    const profile = input.actors.find((a) => a.playerId === c.playerId && a.profile.role === c.role)!.profile;
    if (profile.role === 'glove') {
      const pocket = { x: c.center.x + profile.pocketCenterOffset.x, y: c.center.y + profile.pocketCenterOffset.y,
        z: c.center.z + profile.pocketCenterOffset.z };
      const retention = resolveCatchRetention({ contactTick: moment.ball.tick, ball: moment.ball,
        glove: { tick: moment.ball.tick, position: c.center, velocity: c.velocity }, contactNormal: c.normal, bodyStability: profile.bodyStability,
        pocketOffsetMeters: Math.hypot(moment.ball.position.x - pocket.x, moment.ball.position.y - pocket.y, moment.ball.position.z - pocket.z) }, profile.parameters);
      return retention.outcome.kind === 'secured' ? { kind: 'capture_candidate', cursor: null, moment, retention }
        : { kind: 'rebound', retention, cursor: withImpulseBasis(prior, { ...moment, ball: retention.outcome.ball }, previousContacts) };
    }
    return { kind: 'rebound', cursor: withImpulseBasis(prior, { ...moment, ball: respondToBallContact({ ball: moment.ball,
      normal: c.normal, surfaceVelocity: c.velocity, material: profile.material }) }, previousContacts) };
  }
  const material = input.surfaces.find((s) => s.surfaceId === c.surfaceId)!.material;
  return { kind: 'rebound', cursor: withImpulseBasis(prior, { ...moment, ball: respondToBallContact({ ball: moment.ball,
    normal: c.normal, surfaceVelocity: { x: 0, y: 0, z: 0 }, material }) }, previousContacts) };
};

export const respondToBattedWorldBoundary = respondToBallWorldBoundary;

/** Full original response and actual previous steps own the prefix; no caller ball, catch or result is accepted. */
export const deriveBattedWorldContinuation = (raw: Readonly<{ response: BattedBallContactResponseInput; throughTicks: readonly number[] }>): BattedWorldContinuation => {
  const input = cloneInert(raw);
  if (!input || !Array.isArray(input.throughTicks)) throw new Error('invalid batted World continuation requests');
  const original = deriveBattedBallContactResponse(input.response), p = input.response.world.parameters;
  const originTick = input.response.world.flight.initialBall.tick;
  let cursor: BattedWorldBallCursor | null;
  if (original.kind === 'unresolved' || original.kind === 'capture_candidate') cursor = null;
  else if (original.kind === 'rebound') {
    const c = original.geometry.contact;
    const moment = { originTick, elapsedSeconds: original.geometry.elapsedSeconds, ball: original.ball };
    cursor = { moment, previousContacts: [c.kind === 'actor' ? { kind: 'actor', playerId: c.playerId, role: c.role } : { kind: 'surface', surfaceId: c.surfaceId }],
      ...(input.response.world.sourceCurve ? { sourceCurve: { ...input.response.world.sourceCurve, initial: moment } } : {}) };
  } else if (input.response.world.sourceCurve) {
    const sourceCurve = input.response.world.sourceCurve, incoming = original.world.sourceMoment;
    if (!incoming || json(incoming.ball) !== json(original.ball)) throw new Error('nonlinear original response Source moment differs');
    const kernel = createSourceFreeBallKernel(sourceCurve);
    if (json(kernel.evaluateAt(incoming.elapsedSeconds, 'incoming').moment) !== json(incoming)) throw new Error('nonlinear original response root differs');
    cursor = { moment: original.kind === 'ground' ? kernel.evaluateAt(incoming.elapsedSeconds, 'outgoing').moment : incoming,
      previousContacts: [], sourceCurve };
  } else cursor = { moment: { originTick, elapsedSeconds: (original.ball.tick - originTick) / p.ticksPerSecond,
    ball: original.kind === 'ground' ? respondToGroundContact(original.ball, p) : original.ball }, previousContacts: [] };
  const initialCursor = cursor, steps: BattedWorldContinuationStep[] = [];
  for (const throughTick of input.throughTicks) {
    if (!cursor) throw new Error('batted World acquisition or unresolved contact is pending');
    if (cursor.sourceCurve) cursor = { ...cursor, sourceCurve: { ...cursor.sourceCurve,
      throughElapsedSeconds: Math.max(cursor.sourceCurve.throughElapsedSeconds, (throughTick - originTick) / p.ticksPerSecond) } };
    const world = deriveBallWorldContinuation({ moment: cursor.moment, previousContacts: cursor.previousContacts, parameters: p,
      throughTick, actors: input.response.world.actors, surfaces: input.response.world.surfaces,
      ...(cursor.sourceCurve ? { sourceCurve: cursor.sourceCurve } : {}) });
    if (world.kind !== 'boundary' && world.moment.elapsedSeconds <= cursor.moment.elapsedSeconds) throw new Error('batted World continuation makes no actual progress');
    const response = respondToBattedWorldBoundary(input.response, cursor, world);
    steps.push({ throughTick, world, response }); cursor = response.cursor;
  }
  return freeze({ original, initialCursor, steps, cursor });
};
