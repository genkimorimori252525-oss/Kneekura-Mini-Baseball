import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { deriveBallWorldFieldTerritory, type BallWorldFieldTerritoryInput } from '../../rules/BallWorldFieldTerritory';
import type { PlayEndFact } from '../../rules/PhysicalRuleFacts';
import { classifyBallAgainstFairTerritory } from '../ball/FairTerritoryGeometry';
import { recordBattedBallFirstGroundContact, recordBattedBallFirstFielderTouch, recordFairBattedBall,
  recordLiveBallPlayEnd, type CanonicalPlateAppearanceTimeline } from './CanonicalPlateAppearanceTimeline';

export type ActualFairFieldTimelineInput = Readonly<{
  originalTimeline: CanonicalPlateAppearanceTimeline;
  field: BallWorldFieldTerritoryInput;
  playEnd: PlayEndFact;
}>;
export type ActualFairFieldTimelineProjection = Readonly<{ kind: 'projected'; timeline: CanonicalPlateAppearanceTimeline }>
  | Readonly<{ kind: 'unsupported'; reason: 'fair_territory_unavailable' | 'ground_unavailable'
    | 'ground_after_fair_projection_unsupported' | 'first_fielder_projection_ambiguous' | 'prior_fielder_touch_projection_unsupported' }>;
const fields = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const tick = (v: number) => Number.isSafeInteger(v) && v >= 0;
const freeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };

/** Compact projection of already executed facts. This does not establish PlayEnd,
 * Source authority, producer completeness, or official results: the Native caller
 * must supply its independently proved end and preserve the complete sidecar.
 * No forecasting, event retiming, or legacy timeline mutation occurs here. */
export const projectActualFairFieldTimeline = (raw: ActualFairFieldTimelineInput): ActualFairFieldTimelineProjection => {
  const input = cloneInert(raw);
  if (!fields(input, ['originalTimeline', 'field', 'playEnd'])) throw new Error('invalid actual fair-field timeline projection');
  const { originalTimeline: original, field, playEnd } = input, evidence = field.evidence;
  const territory = deriveBallWorldFieldTerritory(field);
  if (!fields(original, ['playId', 'startedAtTick', 'lastEventTick', 'nextSequence', 'status', 'events'])
    || !tick(original.playId) || !tick(original.startedAtTick)
    || original.status.kind !== 'batted_ball_pending' || original.status.contactTick !== evidence.originTick
    || original.lastEventTick !== evidence.originTick || original.events.at(-1)?.kind !== 'BatBallContact'
    || original.events.at(-1)?.tick !== evidence.originTick || original.nextSequence !== original.events.length
    || original.events.some((event, index) => event.sequence !== index || !Number.isSafeInteger(event.tick)
      || event.tick < (original.events[index - 1]?.tick ?? original.startedAtTick) || event.tick > evidence.originTick
      || event.kind === 'LiveBallPlayEnded')) {
    throw new Error('actual fair-field original timeline scope differs');
  }
  if (!fields(playEnd, ['kind', 'tick', 'reason']) || playEnd.kind !== 'play_end' || playEnd.reason !== 'live_action_complete') {
    throw new Error('actual fair-field play end differs');
  }
  if (playEnd.tick !== evidence.horizon.ball.tick) throw new Error('actual fair-field play end must match the proved physical horizon');
  if (territory.kind !== 'resolved' || territory.territory !== 'fair') return freeze({ kind: 'unsupported', reason: 'fair_territory_unavailable' });
  const ground = evidence.contacts.find(frame => frame.contacts.some(contact => contact.kind === 'ground'));
  if (!ground) return freeze({ kind: 'unsupported', reason: 'ground_unavailable' });
  if (ground.moment.elapsedSeconds > territory.moment.elapsedSeconds) {
    return freeze({ kind: 'unsupported', reason: 'ground_after_fair_projection_unsupported' });
  }
  const touched = evidence.contacts.find(frame => frame.contacts.some(contact => contact.kind === 'actor' && evidence.defenderIds.includes(contact.playerId)));
  if (touched && touched.contacts.length !== 1) return freeze({ kind: 'unsupported', reason: 'first_fielder_projection_ambiguous' });
  const fielder = touched?.contacts.length === 1 && touched.contacts[0].kind === 'actor' ? touched.contacts[0] : null;
  // The unchanged legacy recorder deduplicates this event across the entire PA.
  // Preserve a prior foul's actual touch rather than deleting or rewriting it.
  if (fielder && original.events.some(event => event.kind === 'BattedBallFirstFielderTouch')) {
    return freeze({ kind: 'unsupported', reason: 'prior_fielder_touch_projection_unsupported' });
  }
  let timeline = original;
  const actions: { at: number; order: number; apply(): void }[] = [{ at: ground.moment.elapsedSeconds, order: 0, apply() {
    const ball = ground.moment.ball;
    timeline = recordBattedBallFirstGroundContact(timeline, { tick: ball.tick, position: { x: ball.position.x, z: ball.position.z },
      classification: classifyBallAgainstFairTerritory(evidence.field, ball.position, evidence.ballRadiusMeters) });
  } }, { at: territory.moment.elapsedSeconds, order: 2, apply() { timeline = recordFairBattedBall(timeline, territory.moment.ball.tick); } }];
  if (touched && fielder) actions.push({ at: touched.moment.elapsedSeconds, order: 1, apply() {
    const ball = touched.moment.ball;
    timeline = recordBattedBallFirstFielderTouch(timeline, { fielderId: fielder.playerId, tick: ball.tick, ballCenter: ball.position,
      ballRadiusMeters: evidence.ballRadiusMeters,
      classification: classifyBallAgainstFairTerritory(evidence.field, ball.position, evidence.ballRadiusMeters) });
  } });
  actions.sort((a, b) => a.at - b.at || a.order - b.order).forEach(action => action.apply());
  return freeze({ kind: 'projected', timeline: recordLiveBallPlayEnd(timeline, playEnd) });
};
