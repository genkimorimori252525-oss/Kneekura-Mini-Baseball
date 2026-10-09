import { cloneInert } from '../adjudication/OfficialWindowPolicy';
import type { RuleProfileId } from '../model/RuleProfileRef';
import type { BallWorldBoundaryContact, BallWorldCollider, BallWorldMoment } from '../sim/ball/BallWorldContinuation';
import type { BattedWorldBallCursor } from '../sim/ball/BattedWorldContinuation';
import { battedWorldBaseSurfaceId } from '../sim/ball/BattedWorldFieldMotion';
import type { BallWorldFieldTerritory, BallWorldFieldTerritoryInput } from './BallWorldFieldTerritory';
import { getRuleProfile, NPB_2026_RULE_PROFILE } from './RuleProfile';

export type GroundedPlayableWallPolicy = Readonly<{
  version: 'grounded_fair_playable_wall_v1'; ruleProfileId: RuleProfileId; rulesRevision: string;
  surfaceIds: readonly string[];
}>;
export type GroundedPlayableWallInput = Readonly<{
  policy: GroundedPlayableWallPolicy;
  physicalContacts: readonly Readonly<{
    contact: Extract<BallWorldBoundaryContact, { kind: 'surface' }>;
    /** Original physical response cursor, only for an authenticated free rebound. */
    reboundCursor: BattedWorldBallCursor | null;
  }>[];
}>;
export type GroundedPlayableWallEvidence = Readonly<{
  policy: GroundedPlayableWallPolicy;
  contacts: readonly Readonly<{ contactIndex: number; surfaceId: string; moment: BallWorldMoment }>[];
}>;
const fields = (value: unknown, keys: readonly string[]) => !!value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.trim() === value;
const vector = (value: unknown): value is { x: number; y: number; z: number } => fields(value, ['x', 'y', 'z'])
  && Object.values(value as object).every(v => typeof v === 'number' && Number.isFinite(v));
const sameEvent = (a: BallWorldMoment, b: BallWorldMoment) => a.originTick === b.originTick
  && a.elapsedSeconds === b.elapsedSeconds && a.ball.tick === b.ball.tick
  && (['x', 'y', 'z'] as const).every(axis => a.ball.position[axis] === b.ball.position[axis]);

export const groundedPlayableWallPolicyInput = (raw: GroundedPlayableWallPolicy): GroundedPlayableWallPolicy => {
  const p = cloneInert(raw);
  if (!fields(p, ['version', 'ruleProfileId', 'rulesRevision', 'surfaceIds'])
    || p.version !== 'grounded_fair_playable_wall_v1' || !id(p.ruleProfileId) || !id(p.rulesRevision)
    || !Array.isArray(p.surfaceIds) || !p.surfaceIds.length || p.surfaceIds.some(s => !id(s))
    || new Set(p.surfaceIds).size !== p.surfaceIds.length
    || p.surfaceIds.some(s => (['home', 'first', 'second', 'third'] as const).some(b => s === battedWorldBaseSurfaceId(b)))) {
    throw new Error('invalid grounded playable-wall policy');
  }
  const profile = getRuleProfile(p.ruleProfileId);
  if (profile.id !== NPB_2026_RULE_PROFILE.id || profile.rulesRevision !== p.rulesRevision) {
    throw new Error('unsupported grounded playable-wall RuleProfile revision');
  }
  return p;
};

/** A known playable wall does not terminate an already grounded fair ball.
 * This grants no catch, exit, award, physical response or operative decision.
 * Native must authenticate each raw contact and the explicitly accepted policy. */
export const deriveGroundedPlayableWallEvidence = (raw: GroundedPlayableWallInput,
  field: BallWorldFieldTerritoryInput, territory: BallWorldFieldTerritory, firstGround: BallWorldMoment | null): GroundedPlayableWallEvidence => {
  const input = cloneInert(raw);
  if (!fields(input, ['policy', 'physicalContacts']) || !Array.isArray(input.physicalContacts)) {
    throw new Error('invalid grounded playable-wall physical evidence');
  }
  const policy = groundedPlayableWallPolicyInput(input.policy), frames = field.evidence.contacts;
  for (const original of input.physicalContacts) {
    const contact = original?.contact, cursor = original?.reboundCursor;
    if (!fields(original, ['contact', 'reboundCursor'])
      || !fields(contact, ['kind', 'surfaceId', 'moment', 'point', 'normal', ...(contact?.continuing === undefined ? [] : ['continuing'])])
      || contact.kind !== 'surface' || !id(contact.surfaceId) || !vector(contact.point)
      || contact.normal !== null && (!vector(contact.normal) || Math.hypot(contact.normal.x, contact.normal.y, contact.normal.z) === 0)
      || contact.continuing !== undefined && contact.continuing !== true
      || !contact.moment || !fields(contact.moment, ['originTick', 'elapsedSeconds', 'ball'])
      || !fields(contact.moment.ball, ['tick', 'position', 'velocity', 'spin'])
      || !vector(contact.moment.ball.position) || !vector(contact.moment.ball.velocity) || !vector(contact.moment.ball.spin)
      || !frames.some(frame => sameEvent(frame.moment, contact.moment)
        && frame.contacts.some(c => c.kind === 'surface' && c.surfaceId === contact.surfaceId))) {
      throw new Error('grounded playable-wall original contact differs');
    }
    if (cursor !== null && (!fields(cursor, ['moment', 'previousContacts'])
      || !fields(cursor.moment, ['originTick', 'elapsedSeconds', 'ball'])
      || !fields(cursor.moment.ball, ['tick', 'position', 'velocity', 'spin'])
      || !vector(cursor.moment.ball.position) || !vector(cursor.moment.ball.velocity) || !vector(cursor.moment.ball.spin)
      || !sameEvent(cursor.moment, contact.moment) || !Array.isArray(cursor.previousContacts)
      || cursor.previousContacts.some((c: BallWorldCollider) => c.kind === 'surface' ? !fields(c, ['kind', 'surfaceId']) || !id(c.surfaceId)
        : c.kind !== 'actor' || !fields(c, ['kind', 'playerId', 'role']) || !id(c.playerId)
          || !['body', 'glove', 'tag_hand', 'left_foot', 'right_foot'].includes(c.role))
      || !cursor.previousContacts.some((c: BallWorldCollider) => c.kind === 'surface' && c.surfaceId === contact.surfaceId))) {
      throw new Error('grounded playable-wall original rebound differs');
    }
  }
  const contacts: GroundedPlayableWallEvidence['contacts'][number][] = [];
  if (territory.kind !== 'resolved' || territory.territory !== 'fair' || !firstGround) return { policy, contacts };
  frames.forEach((frame, contactIndex) => {
    const contact = frame.contacts[0];
    if (frame.contacts.length !== 1 || contact.kind !== 'surface' || !policy.surfaceIds.includes(contact.surfaceId)
      || frame.moment.elapsedSeconds <= firstGround.elapsedSeconds || frame.moment.elapsedSeconds <= territory.moment.elapsedSeconds) return;
    const originals = input.physicalContacts.filter(c => c.contact.surfaceId === contact.surfaceId && sameEvent(c.contact.moment, frame.moment));
    // A persistent/simultaneous contact needs its own physical owner; legal
    // treatment cannot silently turn an unexecuted collision response into motion.
    if (!originals.length || originals.some(c => c.contact.normal === null || c.contact.continuing || c.reboundCursor === null)) return;
    contacts.push({ contactIndex, surfaceId: contact.surfaceId, moment: frame.moment });
  });
  return { policy, contacts };
};
