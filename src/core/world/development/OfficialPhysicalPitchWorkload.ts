import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { CanonicalPlateAppearanceTimeline } from '../../sim/plateAppearance/CanonicalPlateAppearanceTimeline';

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

/** Counts physical execution, never participation, outcomes or unexplained count changes. */
export const assessOfficialPhysicalPitchWorkload = (rawTimeline: CanonicalPlateAppearanceTimeline,
  rawPolicy: PhysicalPitchEffortPolicy, gameDay: number): PhysicalPitchWorkload => {
  const timeline = cloneInert(rawTimeline), policy = cloneInert(rawPolicy);
  if (!policy || !fields(policy, ['policyId', 'version', 'availableAtDay', 'effortUnitsPerPhysicalPitch'])
    || !id(policy.policyId) || !id(policy.version) || !tick(policy.availableAtDay) || !tick(gameDay)
    || policy.availableAtDay > gameDay || !Number.isFinite(policy.effortUnitsPerPhysicalPitch) || policy.effortUnitsPerPhysicalPitch < 0) {
    throw new Error('invalid or future physical pitch effort policy');
  }
  if (!timeline || !fields(timeline, ['playId', 'startedAtTick', 'lastEventTick', 'nextSequence', 'status', 'events'])
    || !tick(timeline.playId) || !tick(timeline.startedAtTick) || !tick(timeline.lastEventTick)
    || !Array.isArray(timeline.events) || timeline.nextSequence !== timeline.events.length
    || !['strikeout', 'walk', 'live_ball_complete'].includes(timeline.status?.kind)) {
    throw new Error('physical pitch workload requires a completed canonical play');
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
  if (sequences.length === 0 || previousTick !== timeline.lastEventTick) throw new Error('completed play lacks physical pitch evidence');
  const effortUnits = sequences.length * policy.effortUnitsPerPhysicalPitch;
  if (!Number.isFinite(effortUnits)) throw new Error('physical pitch workload arithmetic overflow');
  return Object.freeze({ physicalPitchSequences: Object.freeze(sequences), effortUnits });
};
