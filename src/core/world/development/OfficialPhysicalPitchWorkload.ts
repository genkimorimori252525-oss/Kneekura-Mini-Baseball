import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { CanonicalPlateAppearanceTimeline } from '../../sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { resolvePitchCountRule, type PitchCountState } from '../../rules/PitchCountRule';

export const OFFICIAL_PHYSICAL_PITCH_WORKLOAD_VERSION = 'official-physical-pitch-workload-v1' as const;
export type PhysicalPitchEffortPolicy = Readonly<{
  policyId: string; version: string; availableAtDay: number; effortUnitsPerPhysicalPitch: number;
}>;
export type PhysicalPitchWorkload = Readonly<{
  physicalPitchSequences: readonly number[]; effortUnits: number;
}>;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const tick = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const fields = (value: object, names: readonly string[]): boolean =>
  Object.keys(value).sort().join('|') === names.slice().sort().join('|');
const vector = (value: unknown): value is { x: number; y: number; z: number } => {
  if (!value || typeof value !== 'object' || !fields(value, ['x', 'y', 'z'])) return false;
  return Object.values(value).every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate));
};
const json = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) =>
  item !== null && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);

const assertActiveCount = (timeline: CanonicalPlateAppearanceTimeline): void => {
  const first = timeline.events.find((event) => event.kind === 'PitchAdjudicated' || event.kind === 'BatBallContact');
  let count: PitchCountState = first && 'countBefore' in first.payload ? first.payload.countBefore
    : timeline.status.kind === 'active' ? timeline.status.count : { balls: -1, strikes: -1 };
  if (!count || !fields(count, ['balls', 'strikes'])) throw new Error('invalid active physical pitch count');
  resolvePitchCountRule(count, { kind: 'ball_in_play' });
  let pendingContact: number | null = null;
  for (const event of timeline.events) {
    if (event.kind === 'PitchAdjudicated') {
      if (pendingContact !== null || !event.payload || !fields(event.payload, ['countBefore', 'adjudication', 'result'])
        || !fields(event.payload.adjudication, ['kind']) || json(event.payload.countBefore) !== json(count)) {
        throw new Error('physical pitch count chain differs');
      }
      const expected = resolvePitchCountRule(count, event.payload.adjudication);
      if (expected.kind !== 'continue' || json(expected) !== json(event.payload.result)) throw new Error('physical pitch count result differs');
      count = expected.count;
    } else if (event.kind === 'BatBallContact') {
      if (pendingContact !== null || json(event.payload.countBefore) !== json(count)) throw new Error('physical contact count differs');
      pendingContact = event.tick;
    } else if (event.kind === 'FoulBattedBallResolved') {
      const resolution = event.payload.resolution;
      if (pendingContact === null || event.payload.contactTick !== pendingContact || resolution?.kind !== 'uncaught_foul'
        || !fields(event.payload, ['contactTick', 'resolution']) || !fields(resolution, ['kind', 'ballDead', 'countResult'])
        || resolution.ballDead !== true || resolution.countResult?.kind !== 'continue'
        || !['foul', 'foul_bunt'].includes(resolution.countResult.cause)) {
        throw new Error('active physical foul count lacks contact');
      }
      const expected = resolvePitchCountRule(count, { kind: resolution.countResult.cause as 'foul' | 'foul_bunt' });
      if (expected.kind !== 'continue' || json(expected) !== json(resolution.countResult)) throw new Error('physical foul count result differs');
      count = expected.count; pendingContact = null;
    } else if (event.kind === 'BattedBallDeclaredFair' || event.kind === 'LiveBallPlayEnded') {
      throw new Error('active physical pitch prefix contains live ball completion');
    } else if (event.kind !== 'TakenPitchPlateCrossed' && event.kind !== 'SwingCompletedWithoutContact' && pendingContact === null) {
      throw new Error('active physical pitch prefix lacks pending contact');
    }
  }
  if (pendingContact !== null || timeline.status.kind !== 'active' || !fields(timeline.status, ['kind', 'count'])
    || json(timeline.status.count) !== json(count)) throw new Error('active physical pitch status count differs');
};

/** Counts physical execution, never participation, outcomes or unexplained count changes. */
const assessPhysicalPitchWorkload = (rawTimeline: CanonicalPlateAppearanceTimeline,
  rawPolicy: PhysicalPitchEffortPolicy, gameDay: number, active: boolean): PhysicalPitchWorkload => {
  const timeline = cloneInert(rawTimeline), policy = cloneInert(rawPolicy);
  if (!policy || !fields(policy, ['policyId', 'version', 'availableAtDay', 'effortUnitsPerPhysicalPitch'])
    || !id(policy.policyId) || !id(policy.version) || !tick(policy.availableAtDay) || !tick(gameDay)
    || policy.availableAtDay > gameDay || !Number.isFinite(policy.effortUnitsPerPhysicalPitch) || policy.effortUnitsPerPhysicalPitch < 0) {
    throw new Error('invalid or future physical pitch effort policy');
  }
  if (!timeline || !fields(timeline, ['playId', 'startedAtTick', 'lastEventTick', 'nextSequence', 'status', 'events'])
    || !tick(timeline.playId) || !tick(timeline.startedAtTick) || !tick(timeline.lastEventTick)
    || !Array.isArray(timeline.events) || timeline.nextSequence !== timeline.events.length
    || (active ? timeline.status?.kind !== 'active' : !['strikeout', 'walk', 'live_ball_complete'].includes(timeline.status?.kind))) {
    throw new Error(`physical pitch workload requires ${active ? 'an active' : 'a completed'} canonical play`);
  }
  const sequences: number[] = [];
  let previousTick = timeline.startedAtTick, previousPhysicalTick = -1;
  for (const [index, event] of timeline.events.entries()) {
    if (!event || !fields(event, ['tick', 'sequence', 'kind', 'payload']) || event.sequence !== index
      || !tick(event.tick) || event.tick < previousTick) throw new Error('invalid physical pitch event chronology');
    previousTick = event.tick;
    if (event.kind === 'PitchAdjudicated') {
      const previous = timeline.events[index - 1];
      if (!previous || !['TakenPitchPlateCrossed', 'SwingCompletedWithoutContact'].includes(previous.kind)
        || previous.tick !== event.tick) throw new Error('counted pitch lacks physical execution');
    }
    if (event.kind !== 'TakenPitchPlateCrossed' && event.kind !== 'SwingCompletedWithoutContact' && event.kind !== 'BatBallContact') continue;
    if (event.tick <= previousPhysicalTick) throw new Error('physical pitches cannot be duplicated or simultaneous');
    previousPhysicalTick = event.tick;
    if (event.kind === 'BatBallContact') {
      const contact = event.payload?.contact;
      if (!contact || !fields(event.payload, ['countBefore', 'contact'])
        || !fields(contact, ['tick', 'ballCenter', 'point', 'batPoint', 'normal', 'segmentT', 'exitVelocity', 'exitSpin'])
        || contact.tick !== event.tick || !vector(contact.ballCenter) || !vector(contact.point) || !vector(contact.batPoint)
        || !vector(contact.normal) || Math.hypot(contact.normal.x, contact.normal.y, contact.normal.z) === 0
        || !vector(contact.exitVelocity) || !vector(contact.exitSpin)
        || !Number.isFinite(contact.segmentT) || contact.segmentT < 0 || contact.segmentT > 1) {
        throw new Error('invalid physical contact evidence');
      }
    } else {
      const next = timeline.events[index + 1];
      if (!event.payload || !fields(event.payload, ['result']) || !event.payload.result) throw new Error('invalid physical pitch payload');
      if (event.kind === 'TakenPitchPlateCrossed') {
        const result = event.payload.result, crossing = result.crossing, geometry = result.geometry;
        if (!fields(result, ['kind', 'crossing', 'geometry']) || !['ball', 'called_strike'].includes(result.kind)
          || !crossing || crossing.tick !== event.tick || !Number.isFinite(crossing.elapsedSeconds) || crossing.elapsedSeconds < 0
          || !vector(crossing.position) || !vector(crossing.velocity) || !vector(crossing.spin)
          || !geometry || !fields(geometry, ['overlapsHorizontalZone', 'overlapsVerticalZone'])
          || typeof geometry.overlapsHorizontalZone !== 'boolean' || typeof geometry.overlapsVerticalZone !== 'boolean'
          || (geometry.overlapsHorizontalZone && geometry.overlapsVerticalZone) !== (result.kind === 'called_strike')) {
          throw new Error('invalid physical taken-pitch evidence');
        }
      } else if (!fields(event.payload.result, ['kind', 'adjudicationTick'])
        || event.payload.result.kind !== 'swinging_miss' || event.payload.result.adjudicationTick !== event.tick) {
        throw new Error('invalid physical swinging-pitch evidence');
      }
      const adjudication = event.kind === 'TakenPitchPlateCrossed' ? event.payload.result.kind : 'swinging_strike';
      if (!next || next.kind !== 'PitchAdjudicated' || next.tick !== event.tick || next.payload.adjudication.kind !== adjudication) {
        throw new Error('physical pitch lacks its corresponding count event');
      }
    }
    sequences.push(event.sequence);
  }
  if (!active && sequences.length === 0 || previousTick !== timeline.lastEventTick) throw new Error('play lacks physical pitch evidence');
  if (active) assertActiveCount(timeline);
  const effortUnits = sequences.length * policy.effortUnitsPerPhysicalPitch;
  if (!Number.isFinite(effortUnits)) throw new Error('physical pitch workload arithmetic overflow');
  return Object.freeze({ physicalPitchSequences: Object.freeze(sequences), effortUnits });
};

export const assessOfficialPhysicalPitchWorkload = (timeline: CanonicalPlateAppearanceTimeline,
  policy: PhysicalPitchEffortPolicy, gameDay: number): PhysicalPitchWorkload => assessPhysicalPitchWorkload(timeline, policy, gameDay, false);

/** Temporary execution reads an actual active prefix; only official closure charges durable effort. */
export const assessActivePhysicalPitchWorkload = (timeline: CanonicalPlateAppearanceTimeline,
  policy: PhysicalPitchEffortPolicy, gameDay: number): PhysicalPitchWorkload => assessPhysicalPitchWorkload(timeline, policy, gameDay, true);
