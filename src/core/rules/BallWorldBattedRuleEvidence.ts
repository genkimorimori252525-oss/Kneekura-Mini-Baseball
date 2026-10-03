import { cloneInert } from '../adjudication/OfficialWindowPolicy';
import type { BattedWorldAcquisition } from '../sim/ball/BattedWorldAcquisition';
import type { BallWorldMoment } from '../sim/ball/BallWorldContinuation';
import type { DefenderPhysicalPrimitiveRole } from '../sim/fielding/DefenderPhysicalPrimitive';
import { classifyBallAgainstFairTerritory, createFairTerritoryWedge, type FairTerritoryWedge } from '../sim/ball/FairTerritoryGeometry';
import type { FairFoulBaseGateGeometry } from '../sim/ball/FairFoulBaseGateGeometry';
import { quantizeEventTick } from '../sim/ExactEventTime';
import { createFlyBallFirstFielderTouchFact } from './PhysicalRuleFacts';
import { resolveFlyCatch, type FlyCatchRuleResult } from './FlyCatchRule';
import { resolveFirstFielderTouchTerritory } from './FairFoulFielderTouchRule';
import { resolveUntouchedGroundContactBeyondBases } from './FairFoulGroundRule';

export type BallWorldBattedRuleContact = Readonly<{ kind: 'ground' | 'rolling_stop' }>
  | Readonly<{ kind: 'actor'; playerId: string; role: DefenderPhysicalPrimitiveRole }>
  | Readonly<{ kind: 'surface'; surfaceId: string }>;
export type BallWorldBattedRuleContactFrame = Readonly<{ moment: BallWorldMoment; contacts: readonly BallWorldBattedRuleContact[] }>;
export type BallWorldBattedRuleEvidenceInput = Readonly<{
  batterRunnerId: string; defenderIds: readonly string[]; field: FairTerritoryWedge; bases: FairFoulBaseGateGeometry;
  ballRadiusMeters: number; originTick: number; ticksPerSecond: number; horizon: BallWorldMoment;
  contacts: readonly BallWorldBattedRuleContactFrame[]; acquisitions: readonly BattedWorldAcquisition[];
}>;
type FielderTouch = Readonly<{ fielderId: string; tick: number; ballCenter: BallWorldMoment['ball']['position'] }>;
type PendingContactReason = 'simultaneous_contact' | 'surface_policy_pending' | 'non_defender_contact';
type PendingContact = Readonly<{ elapsedSeconds: number; tick: number; reason: PendingContactReason }>;
export type BallWorldBattedRuleEvidence = Readonly<{ kind: 'grounded'; territory: 'fair' | 'foul';
  decisiveTick: number; firstGroundContactTick: number; firstFielderTouch: FielderTouch | null; pendingContacts: readonly PendingContact[] }>
  | Readonly<{ kind: 'fly_catch'; correctRuleResult: Extract<FlyCatchRuleResult, { kind: 'caught' }>; firstFielderTouch: FielderTouch }>
  | Readonly<{ kind: 'unresolved'; reason: 'fair_foul_pending' | 'catch_pending' | 'simultaneous_contact' | 'surface_policy_pending' | 'non_defender_contact' }>;
const fields = (value: object, names: readonly string[]) => Object.keys(value).sort().join('|') === [...names].sort().join('|');
const id = (value: string) => typeof value === 'string' && value.length > 0 && value === value.trim();
const vector = (value: BallWorldMoment['ball']['position']) => value && [value.x, value.y, value.z].every(Number.isFinite);

/** Interpret already executed physical evidence; the Native owner must prove the complete prefix. */
export const deriveBallWorldBattedRuleEvidence = (raw: BallWorldBattedRuleEvidenceInput): BallWorldBattedRuleEvidence => {
  const input = cloneInert(raw);
  if (!input || !fields(input, ['batterRunnerId', 'defenderIds', 'field', 'bases', 'ballRadiusMeters', 'originTick', 'ticksPerSecond', 'horizon', 'contacts', 'acquisitions'])
    || !id(input.batterRunnerId) || !Array.isArray(input.defenderIds) || !input.defenderIds.length
    || input.defenderIds.some((value) => !id(value) || value === input.batterRunnerId) || new Set(input.defenderIds).size !== input.defenderIds.length
    || !Number.isFinite(input.ballRadiusMeters) || input.ballRadiusMeters <= 0
    || !Array.isArray(input.contacts) || !Array.isArray(input.acquisitions)) throw new Error('invalid actual batted rule evidence scope');
  const field = createFairTerritoryWedge(input.field);
  if (!input.bases || !['homePlate', 'firstBase', 'secondBase', 'thirdBase'].every((key) => {
    const point = input.bases[key as keyof FairFoulBaseGateGeometry];
    return point && [point.x, point.z].every(Number.isFinite);
  }) || input.bases.homePlate.x !== field.homePlate.x || input.bases.homePlate.z !== field.homePlate.z) throw new Error('actual batted rule base geometry differs');
  const validateMoment = (moment: BallWorldMoment, bounded = true) => {
    if (!moment || moment.originTick !== input.originTick || !Number.isFinite(moment.elapsedSeconds) || moment.elapsedSeconds < 0
      || !moment.ball || !vector(moment.ball.position) || !vector(moment.ball.velocity) || !vector(moment.ball.spin)
      || moment.ball.tick !== quantizeEventTick(input.originTick, moment.elapsedSeconds, input.ticksPerSecond)
      || bounded && moment.elapsedSeconds > input.horizon.elapsedSeconds) throw new Error('actual batted rule moment or coverage differs');
  };
  validateMoment(input.horizon, false);
  let previous = -1;
  for (const frame of input.contacts) {
    if (!frame || !fields(frame, ['moment', 'contacts']) || !Array.isArray(frame.contacts) || !frame.contacts.length) throw new Error('invalid actual batted contacts');
    validateMoment(frame.moment);
    if (frame.moment.elapsedSeconds <= previous) throw new Error('actual batted contacts must be distinct chronological moments');
    previous = frame.moment.elapsedSeconds;
    for (const contact of frame.contacts) {
      if (!contact || !['ground', 'rolling_stop', 'actor', 'surface'].includes(contact.kind)
        || contact.kind === 'actor' && (!fields(contact, ['kind', 'playerId', 'role']) || !id(contact.playerId)
          || !['body', 'glove', 'tag_hand', 'left_foot', 'right_foot'].includes(contact.role))
        || contact.kind === 'surface' && (!fields(contact, ['kind', 'surfaceId']) || !id(contact.surfaceId))
        || (contact.kind === 'ground' || contact.kind === 'rolling_stop') && !fields(contact, ['kind'])) throw new Error('invalid actual batted contact identity');
    }
  }
  for (const acquisition of input.acquisitions) {
    if (!acquisition || !input.defenderIds.includes(acquisition.acquirerPlayerId)
      || !['secured', 'interrupted'].includes(acquisition.kind)) throw new Error('actual batted acquisition scope differs');
    validateMoment(acquisition.contactMoment);
    const frame = input.contacts.find((value) => value.moment.elapsedSeconds === acquisition.contactMoment.elapsedSeconds);
    if (!frame || JSON.stringify(frame.moment) !== JSON.stringify(acquisition.contactMoment)
      || !frame.contacts.some((contact: BallWorldBattedRuleContact) => contact.kind === 'actor' && contact.playerId === acquisition.acquirerPlayerId && contact.role === 'glove')) {
      throw new Error('actual batted acquisition candidate contact is missing');
    }
    const end = acquisition.kind === 'secured' ? acquisition.moment : acquisition.world.moment;
    validateMoment(end);
    if (end.elapsedSeconds < acquisition.contactMoment.elapsedSeconds || acquisition.kind === 'secured'
      && (acquisition.secureTick !== end.ball.tick || acquisition.transport.remainingEnergyJ !== 0
        || acquisition.retention?.outcome?.kind !== 'secured')) throw new Error('actual batted secured capture differs');
  }
  const ground = input.contacts.find((frame) => frame.contacts.some((contact: BallWorldBattedRuleContact) => contact.kind === 'ground'));
  const touched = input.contacts.find((frame) => frame.contacts.some((contact: BallWorldBattedRuleContact) => contact.kind === 'actor' && input.defenderIds.includes(contact.playerId)));
  const actor = touched?.contacts.find((contact: BallWorldBattedRuleContact) => contact.kind === 'actor' && input.defenderIds.includes(contact.playerId)) as BallWorldBattedRuleContact | undefined;
  const firstFielderTouch = touched?.contacts.length === 1 && actor?.kind === 'actor'
    ? { fielderId: actor.playerId, tick: touched.moment.ball.tick, ballCenter: touched.moment.ball.position } : null;
  const secured = [...input.acquisitions].filter((value): value is Extract<BattedWorldAcquisition, { kind: 'secured' }> => value.kind === 'secured')
    .sort((a, b) => a.moment.elapsedSeconds - b.moment.elapsedSeconds)[0];
  const catchHorizon = secured && (!ground || ground.moment.elapsedSeconds > secured.moment.elapsedSeconds) ? secured.moment.elapsedSeconds : input.horizon.elapsedSeconds;
  const pendingContacts: PendingContact[] = [];
  for (const frame of input.contacts) {
    const contact = frame.contacts[0];
    const reason = frame.contacts.length !== 1 ? 'simultaneous_contact'
      : contact.kind === 'surface' ? 'surface_policy_pending'
        : contact.kind === 'actor' && !input.defenderIds.includes(contact.playerId) ? 'non_defender_contact' : null;
    if (reason) pendingContacts.push({ elapsedSeconds: frame.moment.elapsedSeconds, tick: frame.moment.ball.tick, reason });
  }
  const blockedThrough = (elapsedSeconds: number) => pendingContacts.find((value) => value.elapsedSeconds <= elapsedSeconds);
  if (firstFielderTouch && secured && (!ground || ground.moment.elapsedSeconds > secured.moment.elapsedSeconds)) {
    const blocked = blockedThrough(catchHorizon);
    if (blocked) return { kind: 'unresolved', reason: blocked.reason };
    const correctRuleResult = resolveFlyCatch({ batterRunnerId: input.batterRunnerId,
      firstTouch: createFlyBallFirstFielderTouchFact(firstFielderTouch.fielderId, firstFielderTouch.tick),
      secureCatchTick: secured.secureTick, firstGroundContactTick: null });
    if (correctRuleResult.kind !== 'caught') throw new Error('actual airborne secured catch interpretation differs');
    return { kind: 'fly_catch', correctRuleResult, firstFielderTouch };
  }
  if (!ground) return { kind: 'unresolved', reason: pendingContacts[0]?.reason ?? (firstFielderTouch ? 'catch_pending' : 'fair_foul_pending') };
  if (!touched || ground.moment.elapsedSeconds < touched.moment.elapsedSeconds) {
    const rule = resolveUntouchedGroundContactBeyondBases({ field, bases: input.bases, noPriorFielderTouch: true,
      firstGroundContact: { tick: ground.moment.ball.tick, position: { x: ground.moment.ball.position.x, z: ground.moment.ball.position.z },
        classification: classifyBallAgainstFairTerritory(field, ground.moment.ball.position, input.ballRadiusMeters) } });
    if (rule.kind === 'resolved') {
      const blocked = blockedThrough(ground.moment.elapsedSeconds);
      if (blocked) return { kind: 'unresolved', reason: blocked.reason };
      return { kind: 'grounded', territory: rule.territory, decisiveTick: rule.decisiveTick,
        firstGroundContactTick: ground.moment.ball.tick, firstFielderTouch, pendingContacts };
    }
  }
  if (firstFielderTouch && touched && touched.moment.elapsedSeconds <= input.horizon.elapsedSeconds) {
    const blocked = blockedThrough(touched.moment.elapsedSeconds);
    if (blocked) return { kind: 'unresolved', reason: blocked.reason };
    const territory = resolveFirstFielderTouchTerritory({ field, evidence: { ...firstFielderTouch,
      ballRadiusMeters: input.ballRadiusMeters, classification: classifyBallAgainstFairTerritory(field, firstFielderTouch.ballCenter, input.ballRadiusMeters) } });
    return { kind: 'grounded', territory: territory.territory, decisiveTick: territory.decisiveTick,
      firstGroundContactTick: ground.moment.ball.tick, firstFielderTouch, pendingContacts };
  }
  return { kind: 'unresolved', reason: pendingContacts[0]?.reason ?? 'fair_foul_pending' };
};
