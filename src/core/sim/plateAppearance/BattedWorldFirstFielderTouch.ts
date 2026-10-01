import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import { deriveFirstBattedWorldContact, type BattedWorldContactInput } from '../ball/BattedBallWorldContacts';
import { classifyBallAgainstFairTerritory, createFairTerritoryWedge, type FairTerritoryWedge } from '../ball/FairTerritoryGeometry';
import type { BattedBallFirstFielderTouchTerritory } from '../fielding/BattedBallFirstFielderTouchTerritory';
import { recordBattedBallFirstFielderTouch, type CanonicalPlateAppearanceTimeline } from './CanonicalPlateAppearanceTimeline';
import { resolveAndRecordFirstFielderTouchTerritory } from './FielderTouchFairFoulTimelineAdapter';

export type BattedWorldFirstFielderTouchInput = Readonly<{
  timeline: CanonicalPlateAppearanceTimeline; world: BattedWorldContactInput;
  defenderIds: readonly string[]; field: FairTerritoryWedge;
}>;
export type BattedWorldFirstFielderTouchResult = Readonly<{
  kind: 'recorded'; evidence: BattedBallFirstFielderTouchTerritory; territory: 'fair' | 'foul_pending_catch';
  timeline: CanonicalPlateAppearanceTimeline;
}> | Readonly<{
  kind: 'unresolved'; reason: 'airborne' | 'ground' | 'surface' | 'non_defender' | 'simultaneous';
  timeline: CanonicalPlateAppearanceTimeline;
}>;
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
const tick = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const vector = (v: Vec3) => v && [v.x, v.y, v.z].every(Number.isFinite);
const json = (v: unknown) => JSON.stringify(v, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : value);

/** Interpret a proven first physical World contact, without inventing glove retention or possession. */
export const deriveAndRecordBattedWorldFirstFielderTouch = (raw: BattedWorldFirstFielderTouchInput): BattedWorldFirstFielderTouchResult => {
  const input = cloneInert(raw), { timeline } = input;
  if (timeline?.status.kind !== 'batted_ball_pending') throw new Error('World first-fielder touch requires a pending batted ball');
  if (timeline.events.some((e) => e.kind === 'BattedBallFirstFielderTouch')) throw new Error('first-fielder touch has already been recorded');
  if (!Array.isArray(input.defenderIds) || !input.defenderIds.length || input.defenderIds.some((v) => !id(v))
    || new Set(input.defenderIds).size !== input.defenderIds.length) throw new Error('invalid World first-fielder scope');
  const original = [...timeline.events].reverse().find((e) => e.kind === 'BatBallContact');
  if (!original || original.kind !== 'BatBallContact' || original.tick !== timeline.status.contactTick
    || !input.world?.flight?.contact || json(original.payload.contact) !== json(input.world.flight.contact)) {
    throw new Error('World first-fielder original BatBallContact differs');
  }
  const result = deriveFirstBattedWorldContact(input.world), ballRadiusMeters = input.world.parameters.ballRadius;
  const field = createFairTerritoryWedge(input.field), at = result.kind === 'contact' ? result.tick : result.throughTick;
  if (!tick(at) || at < timeline.status.contactTick || at < timeline.lastEventTick || !result.ball || result.ball.tick !== at
    || !vector(result.ball.position) || !vector(result.ball.velocity) || !vector(result.ball.spin)) throw new Error('invalid World first-fielder physical clock or ball');
  const unresolved = (reason: Extract<BattedWorldFirstFielderTouchResult, { kind: 'unresolved' }>['reason']): BattedWorldFirstFielderTouchResult =>
    ({ kind: 'unresolved', reason, timeline });
  if (result.kind === 'airborne') return unresolved('airborne');
  if (!Array.isArray(result.contacts) || !result.contacts.length) throw new Error('World first contact evidence is empty');
  for (const c of result.contacts) {
    if (!c || !['ground', 'surface', 'actor'].includes(c.kind)) throw new Error('invalid World first contact kind');
    if (c.kind === 'actor' && (!id(c.playerId) || !['body', 'glove', 'tag_hand', 'left_foot', 'right_foot'].includes(c.role)
      || !c.actor || c.actor.tick !== at || c.actor.role !== c.role || !Number.isFinite(c.actor.radius) || c.actor.radius <= 0
      || !vector(c.actor.center) || !vector(c.actor.velocity) || !vector(c.actor.acceleration))) throw new Error('invalid World first contact actor');
    if (c.kind === 'surface' && (!id(c.surfaceId) || !vector(c.point))) throw new Error('invalid World first contact surface');
  }
  if (result.contacts.length !== 1) return unresolved('simultaneous');
  const contact = result.contacts[0];
  if (contact.kind !== 'actor') return unresolved(contact.kind);
  if (!input.defenderIds.includes(contact.playerId)) return unresolved('non_defender');
  const evidence: BattedBallFirstFielderTouchTerritory = { fielderId: contact.playerId, tick: at,
    ballCenter: result.ball.position, ballRadiusMeters,
    classification: classifyBallAgainstFairTerritory(field, result.ball.position, ballRadiusMeters) };
  const resolved = resolveAndRecordFirstFielderTouchTerritory({ timeline: recordBattedBallFirstFielderTouch(timeline, evidence), field });
  return { kind: 'recorded', evidence, territory: resolved.kind, timeline: resolved.timeline };
};
