import { cloneInert } from '../adjudication/OfficialWindowPolicy';
import type { BallWorldBaseBoundaryContact } from '../sim/ball/BallWorldBaseBoundary';
import type { BallWorldMoment } from '../sim/ball/BallWorldContinuation';
import { battedWorldBaseSurfaceId } from '../sim/ball/BattedWorldFieldMotion';
import { classifyBallAgainstFairTerritory } from '../sim/ball/FairTerritoryGeometry';
import { deriveBallWorldBattedRuleEvidence, type BallWorldBattedRuleEvidenceInput } from './BallWorldBattedRuleEvidence';
import { deriveBallWorldBattedRuleChronology } from './BallWorldBattedRuleChronology';
import { resolveFirstFielderTouchTerritory } from './FairFoulFielderTouchRule';
import { findBallWorldGroundGatePassage } from './BallWorldGroundGatePassage';
import { resolveUntouchedSettledBattedBallTerritory } from './FairFoulSettledBallRule';
import { resolveUntouchedBaseGatePassageTerritory } from './FairFoulBaseGatePassageRule';

export type BallWorldFieldTerritoryInput = Readonly<{ evidence: BallWorldBattedRuleEvidenceInput;
  baseContacts: readonly BallWorldBaseBoundaryContact[];
  groundSegments?: readonly Readonly<{ moment: BallWorldMoment; throughElapsedSeconds: number; rollingDecelerationMps2: number; gravityY?: number }>[] }>;
export type BallWorldFieldTerritory = Readonly<{ kind: 'resolved'; territory: 'fair' | 'foul';
  basis: 'base_contact' | 'fielder_touch' | 'ground' | 'base_gate' | 'settling'; moment: BallWorldMoment; baseId?: 'first' | 'third' }>
  | Readonly<{ kind: 'unresolved'; reason: 'fair_foul_pending' | 'catch_pending' | 'simultaneous_contact'
    | 'surface_policy_pending' | 'non_defender_contact' | 'physical_contact_pending' | 'base_policy_pending' }>;
const ids = ['home', 'first', 'second', 'third'] as const;
const fields = (v: unknown, names: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).sort().join('|') === [...names].sort().join('|');
const vector = (v: BallWorldMoment['ball']['position']) => fields(v, ['x', 'y', 'z']) && Object.values(v).every(Number.isFinite);
const sameMoment = (a: BallWorldMoment, b: BallWorldMoment) => !!a && !!a.ball && a.originTick === b.originTick
  && a.elapsedSeconds === b.elapsedSeconds && a.ball.tick === b.ball.tick
  && (['position', 'velocity', 'spin'] as const).every((key) => vector(a.ball[key])
    && (['x', 'y', 'z'] as const).every((axis) => a.ball[key][axis] === b.ball[key][axis]));
const baseId = (surfaceId: string) => ids.find((id) => battedWorldBaseSurfaceId(id) === surfaceId);
const freeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };

/** Territory only. Native must own the complete physical prefix and its original base geometry; this never closes a play or grants possession. */
export const deriveBallWorldFieldTerritory = (raw: BallWorldFieldTerritoryInput): BallWorldFieldTerritory => {
  const input = cloneInert(raw);
  if (!fields(input, ['evidence', 'baseContacts', ...(input.groundSegments === undefined ? [] : ['groundSegments'])])
    || !Array.isArray(input.baseContacts) || input.groundSegments !== undefined && !Array.isArray(input.groundSegments)) throw new Error('invalid actual field territory scope');
  // Validate every original frame before treating a known base differently from an unowned wall.
  deriveBallWorldBattedRuleEvidence(input.evidence);
  const { evidence } = input, seen = new Set<string>();
  for (const contact of input.baseContacts) {
    if (!fields(contact, ['kind', 'baseId', 'moment', 'point', 'normal', ...(contact.continuing === undefined ? [] : ['continuing'])])
      || contact.kind !== 'base' || !ids.includes(contact.baseId) || !vector(contact.point)
      || contact.normal !== null && !vector(contact.normal) || contact.continuing !== undefined && contact.continuing !== true) {
      throw new Error('invalid actual field base contact');
    }
    const frame = evidence.contacts.find((frame) => sameMoment(contact.moment, frame.moment));
    const key = JSON.stringify([contact.baseId, contact.moment.elapsedSeconds]);
    if (!frame || seen.has(key) || !frame.contacts.some((c) => c.kind === 'surface' && c.surfaceId === battedWorldBaseSurfaceId(contact.baseId))) {
      throw new Error('actual base contact lacks its own physical frame');
    }
    seen.add(key);
  }
  for (const frame of evidence.contacts) {
    for (const contact of frame.contacts) {
      const base = contact.kind === 'surface' ? baseId(contact.surfaceId) : undefined;
      if (base && !input.baseContacts.some((c) => c.baseId === base && sameMoment(c.moment, frame.moment))) {
        throw new Error('actual field base contact provenance is incomplete');
      }
    }
  }
  const pending = evidence.contacts.flatMap((frame) => {
    const contact = frame.contacts[0], base = contact.kind === 'surface' ? baseId(contact.surfaceId) : undefined;
    const ownBase = base ? input.baseContacts.find((c) => c.baseId === base && sameMoment(c.moment, frame.moment))! : null;
    const reason = frame.contacts.length !== 1 ? 'simultaneous_contact' as const
      : ownBase?.normal === null || ownBase?.continuing ? 'physical_contact_pending' as const
        : base === 'second' ? 'base_policy_pending' as const
          : contact.kind === 'surface' && !base ? 'surface_policy_pending' as const
            : contact.kind === 'actor' && !evidence.defenderIds.includes(contact.playerId) ? 'non_defender_contact' as const : null;
    return reason ? [{ moment: frame.moment, reason }] : [];
  });
  const candidates: Extract<BallWorldFieldTerritory, { kind: 'resolved' }>[] = input.baseContacts
    .filter((c) => c.baseId === 'first' || c.baseId === 'third').map((c) => ({ kind: 'resolved', territory: 'fair',
      basis: 'base_contact', baseId: c.baseId as 'first' | 'third', moment: c.moment }));
  const fielderFrame = evidence.contacts.find((frame) => frame.contacts.some((c) => c.kind === 'actor' && evidence.defenderIds.includes(c.playerId)));
  const fielder = fielderFrame?.contacts.find((c) => c.kind === 'actor' && evidence.defenderIds.includes(c.playerId));
  if (fielder?.kind === 'actor' && fielderFrame) {
    const moment = fielderFrame.moment, territory = resolveFirstFielderTouchTerritory({ field: evidence.field,
      evidence: { fielderId: fielder.playerId, tick: moment.ball.tick, ballCenter: moment.ball.position,
        ballRadiusMeters: evidence.ballRadiusMeters, classification: classifyBallAgainstFairTerritory(evidence.field, moment.ball.position, evidence.ballRadiusMeters) } });
    candidates.push({ kind: 'resolved', territory: territory.territory, basis: 'fielder_touch', moment });
  }
  const filtered = { ...evidence, contacts: evidence.contacts.map((frame) => ({ ...frame,
    contacts: frame.contacts.filter((c) => c.kind !== 'surface' || !baseId(c.surfaceId)) })).filter((frame) => frame.contacts.length) };
  const chronology = deriveBallWorldBattedRuleChronology(filtered);
  if (chronology.ballEvidence.kind === 'grounded' && chronology.ballDecisionMoment) {
    candidates.push({ kind: 'resolved', territory: chronology.ballEvidence.territory, basis: 'ground', moment: chronology.ballDecisionMoment });
  }
  let through = -1;
  for (const segment of input.groundSegments ?? []) {
    if (!fields(segment, ['moment', 'throughElapsedSeconds', 'rollingDecelerationMps2', ...(segment.gravityY === undefined ? [] : ['gravityY'])]) || segment.moment?.originTick !== evidence.originTick
      || segment.moment.elapsedSeconds < through || segment.throughElapsedSeconds > evidence.horizon.elapsedSeconds
      || !evidence.contacts.some((frame) => frame.moment.elapsedSeconds <= segment.moment.elapsedSeconds && frame.contacts.some((c) => c.kind === 'ground'))
      || evidence.contacts.some((frame) => frame.moment.elapsedSeconds > segment.moment.elapsedSeconds && frame.moment.elapsedSeconds < segment.throughElapsedSeconds)) {
      throw new Error('actual field ground interval lacks bounded physical coverage');
    }
    const passage = findBallWorldGroundGatePassage({ ...segment, ticksPerSecond: evidence.ticksPerSecond,
      ballRadiusMeters: evidence.ballRadiusMeters, bases: evidence.bases });
    through = segment.throughElapsedSeconds;
    if (!passage) continue;
    const classified = classifyBallAgainstFairTerritory(evidence.field, passage.moment.ball.position, evidence.ballRadiusMeters);
    const rule = resolveUntouchedBaseGatePassageTerritory({ field: evidence.field, ballRadiusMeters: evidence.ballRadiusMeters,
      passage: { tick: passage.moment.ball.tick, state: passage.moment.ball, beyond: passage.beyond, territory: classified },
      noPriorFielderTouch: true, noPriorFirstOrThirdBaseTouch: true });
    candidates.push({ kind: 'resolved', territory: rule.territory, basis: 'base_gate', moment: passage.moment });
  }
  for (const frame of evidence.contacts.filter((frame) => frame.contacts.some((c) => c.kind === 'rolling_stop'))) {
    const { moment } = frame, ball = moment.ball;
    if (ball.position.y !== evidence.ballRadiusMeters || Object.values(ball.velocity).some((v) => v !== 0)
      || !evidence.contacts.some((old) => old.moment.elapsedSeconds <= moment.elapsedSeconds && old.contacts.some((c) => c.kind === 'ground'))) {
      throw new Error('actual field rolling stop lacks grounded stationary evidence');
    }
    if (candidates.some((c) => c.moment.elapsedSeconds <= moment.elapsedSeconds)) continue;
    const rule = resolveUntouchedSettledBattedBallTerritory({ field: evidence.field, bases: evidence.bases, ballRadiusMeters: evidence.ballRadiusMeters,
      settling: { tick: ball.tick, state: ball, territory: classifyBallAgainstFairTerritory(evidence.field, ball.position, evidence.ballRadiusMeters) },
      noPriorFielderTouch: true, noPriorFirstOrThirdBaseTouch: true, noPriorBaseGatePassage: true });
    candidates.push({ kind: 'resolved', territory: rule.territory, basis: 'settling', moment });
  }
  candidates.sort((a, b) => a.moment.elapsedSeconds - b.moment.elapsedSeconds);
  const decisive = candidates[0], blocked = pending.find((p) => !decisive || p.moment.elapsedSeconds <= decisive.moment.elapsedSeconds);
  if (blocked) return freeze({ kind: 'unresolved', reason: blocked.reason });
  if (decisive) return freeze(decisive);
  return freeze({ kind: 'unresolved', reason: chronology.ballEvidence.kind === 'unresolved' ? chronology.ballEvidence.reason : 'fair_foul_pending' });
};
