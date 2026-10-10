import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { resolveCatchRetention, type CatchRetentionResolution } from '../fielding/CatchRetention';
import { respondToGroundContact } from './BallFlight';
import { respondToBallContact } from './BallContactResponse';
import { deriveBallWorldContinuation, type BallWorldCollider, type BallWorldContinuation, type BallWorldMoment } from './BallWorldContinuation';
import { deriveBattedBallContactResponse, type BattedBallContactResponse, type BattedBallContactResponseInput, type BallWorldResponseInput } from './BattedBallContactResponse';

export type BattedWorldBallCursor = Readonly<{ moment: BallWorldMoment; previousContacts: readonly BallWorldCollider[] }>;
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

export const respondToBallWorldBoundary = (input: BallWorldResponseInput, prior: BattedWorldBallCursor, world: BallWorldContinuation): BattedWorldContinuationStepResponse => {
  if (world.kind !== 'boundary') return { kind: world.kind, cursor: { ...prior, moment: world.moment } };
  if (world.pendingReason) return { kind: 'unresolved', cursor: null, reason: world.pendingReason };
  if (world.contacts.length !== 1) return { kind: 'unresolved', cursor: null, reason: 'simultaneous' };
  const c = world.contacts[0], moment = c.moment;
  if (c.kind === 'rolling_stop') return { kind: 'rolling_stop', cursor: { ...prior, moment } };
  if (c.kind === 'ground') return { kind: 'ground', cursor: { ...prior,
    moment: { ...moment, ball: respondToGroundContact(moment.ball, input.world.parameters) } } };
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
        : { kind: 'rebound', retention, cursor: { previousContacts, moment: { ...moment, ball: retention.outcome.ball } } };
    }
    return { kind: 'rebound', cursor: { previousContacts, moment: { ...moment, ball: respondToBallContact({ ball: moment.ball,
      normal: c.normal, surfaceVelocity: c.velocity, material: profile.material }) } } };
  }
  const material = input.surfaces.find((s) => s.surfaceId === c.surfaceId)!.material;
  return { kind: 'rebound', cursor: { previousContacts, moment: { ...moment, ball: respondToBallContact({ ball: moment.ball,
    normal: c.normal, surfaceVelocity: { x: 0, y: 0, z: 0 }, material }) } } };
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
    cursor = { moment: { originTick, elapsedSeconds: original.geometry.elapsedSeconds, ball: original.ball },
      previousContacts: [c.kind === 'actor' ? { kind: 'actor', playerId: c.playerId, role: c.role } : { kind: 'surface', surfaceId: c.surfaceId }] };
  } else cursor = { moment: { originTick, elapsedSeconds: (original.ball.tick - originTick) / p.ticksPerSecond,
    ball: original.kind === 'ground' ? respondToGroundContact(original.ball, p) : original.ball }, previousContacts: [] };
  const initialCursor = cursor, steps: BattedWorldContinuationStep[] = [];
  for (const throughTick of input.throughTicks) {
    if (!cursor) throw new Error('batted World acquisition or unresolved contact is pending');
    const world = deriveBallWorldContinuation({ moment: cursor.moment, previousContacts: cursor.previousContacts, parameters: p,
      throughTick, actors: input.response.world.actors, surfaces: input.response.world.surfaces });
    if (world.kind !== 'boundary' && world.moment.elapsedSeconds <= cursor.moment.elapsedSeconds) throw new Error('batted World continuation makes no actual progress');
    const response = respondToBattedWorldBoundary(input.response, cursor, world);
    steps.push({ throughTick, world, response }); cursor = response.cursor;
  }
  return freeze({ original, initialCursor, steps, cursor });
};
