import { MAX_QUICK_SPEED_FACTOR,
  MIN_QUICK_SPEED_FACTOR } from '../../sim/pitch/PitchTimingModel';
import type { DevelopmentLearningEpisode } from './DevelopmentLearningEpisode';
import { derivePitchTimingDevelopmentHistory } from './PlayerDevelopmentHistory';
import type { PlayerPitchTimingSource } from './PlayerPitchTimingSource';

/** Calibration belongs to Career policy, not a per-training awakening roll. */
export type PitchTimingBreakthroughPolicy = Readonly<{
  policyId: string;
  version: string;
  effectiveDay: number;
  minimumSourceGain: number;
  minimumDeviationAboveExpected: number;
  minimumPersistenceDays: number;
  minimumCheckpoints: number;
}>;
/** An owner-certified checkpoint of the existing source and expected trajectory. */
export type PitchTimingBreakthroughCheckpoint = Readonly<{
  checkpointId: string;
  episodeId: string;
  atDay: number;
  sourceRevision: number;
  actualQuickSpeedFactor: number;
  expectedQuickSpeedFactor: number;
  trajectorySourceId: string;
  trajectoryVersion: string;
}>;
export type PitchTimingBreakthroughInput = Readonly<{
  source: PlayerPitchTimingSource;
  episodes: readonly DevelopmentLearningEpisode[];
  asOfDay: number;
  policy: PitchTimingBreakthroughPolicy;
  checkpoints: readonly PitchTimingBreakthroughCheckpoint[];
}>;
/** Historical description only; never a writable ability, Trait or Match modifier. */
export type PitchTimingBreakthroughEvent = Readonly<{
  eventId: string;
  careerId: string;
  playerId: string;
  episodeId: string;
  occurredAtDay: number;
  kind: 'MAJOR_BREAKTHROUGH';
  domain: 'TECHNICAL';
  sourceEventIds: readonly string[];
  profileVersion: string;
  policyId: string;
  policyVersion: string;
  trajectoryVersion: string;
  sourceRevision: number;
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;
const factor = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
    && value >= MIN_QUICK_SPEED_FACTOR && value <= MAX_QUICK_SPEED_FACTOR;

/** Validates the existing causal chain, then recognizes persistent deviation. */
export function derivePitchTimingBreakthroughs(
  input: PitchTimingBreakthroughInput,
): readonly PitchTimingBreakthroughEvent[] {
  if (!input || !day(input.asOfDay) || !input.source
    || !Array.isArray(input.episodes) || !Array.isArray(input.checkpoints)) {
    throw new Error('invalid breakthrough input');
  }
  const p = input.policy;
  if (!p || !id(p.policyId) || !id(p.version)
    || !day(p.effectiveDay) || p.effectiveDay > input.asOfDay
    || !positive(p.minimumSourceGain)
    || !positive(p.minimumDeviationAboveExpected)
    || !Number.isSafeInteger(p.minimumPersistenceDays)
    || p.minimumPersistenceDays <= 0
    || !Number.isSafeInteger(p.minimumCheckpoints)
    || p.minimumCheckpoints < 2) {
    throw new Error('invalid breakthrough policy');
  }
  const source = input.source;
  if (!id(source.careerId) || !id(source.playerId)
    || !day(source.createdAtDay) || !day(source.effectiveDay)
    || source.effectiveDay > input.asOfDay) {
    throw new Error('invalid breakthrough source scope');
  }
  // Existing history projection validates episode causality, source continuity,
  // consolidation bindings and the final authoritative source profile.
  const history = derivePitchTimingDevelopmentHistory(source, input.episodes);
  const recordByEpisode = new Map(source.records.map(record =>
    [record.episodeId, record]));
  const seen = new Set<string>();
  for (const checkpoint of input.checkpoints) {
    if (!id(checkpoint?.checkpointId) || seen.has(checkpoint.checkpointId)
      || !id(checkpoint.episodeId)
      || !id(checkpoint.trajectorySourceId)
      || !id(checkpoint.trajectoryVersion)
      || !day(checkpoint.atDay) || checkpoint.atDay > input.asOfDay
      || !Number.isSafeInteger(checkpoint.sourceRevision)
      || checkpoint.sourceRevision < 0
      || !factor(checkpoint.actualQuickSpeedFactor)
      || !factor(checkpoint.expectedQuickSpeedFactor)) {
      throw new Error('invalid breakthrough checkpoint');
    }
    seen.add(checkpoint.checkpointId);
    const record = recordByEpisode.get(checkpoint.episodeId);
    if (!record || checkpoint.atDay < record.effectiveDay) {
      throw new Error('breakthrough checkpoint has no source change');
    }
    const priorRecords = source.records.filter(r =>
      r.effectiveDay <= checkpoint.atDay);
    const last = priorRecords.at(-1);
    if (checkpoint.sourceRevision !== priorRecords.length
      || checkpoint.actualQuickSpeedFactor
        !== last?.afterQuickSpeedFactor) {
      throw new Error('breakthrough checkpoint mismatches source state');
    }
  }
  const events: PitchTimingBreakthroughEvent[] = [];
  for (const record of source.records) {
    if (record.changeKind !== 'SOURCE_CHANGED'
      || record.afterQuickSpeedFactor - record.beforeQuickSpeedFactor
        < p.minimumSourceGain || record.effectiveDay < p.effectiveDay) continue;
    const episode = input.episodes.find(e => e.episodeId === record.episodeId)!;
    const checkpoints = input.checkpoints.filter(c =>
      c.episodeId === record.episodeId).sort((a, b) =>
      a.atDay - b.atDay || a.checkpointId.localeCompare(b.checkpointId));
    if (checkpoints.length < p.minimumCheckpoints
      || checkpoints[checkpoints.length - 1]!.atDay
        - checkpoints[0]!.atDay < p.minimumPersistenceDays
      || checkpoints.some(c => c.actualQuickSpeedFactor
        - c.expectedQuickSpeedFactor < p.minimumDeviationAboveExpected)) continue;
    const trajectoryVersion = checkpoints[0]!.trajectoryVersion;
    if (checkpoints.some(c => c.trajectoryVersion !== trajectoryVersion)) {
      throw new Error('mixed breakthrough trajectory versions');
    }
    const linked = history.filter(event => event.episodeId === record.episodeId);
    const sourceEventIds = [...new Set([
      ...linked.flatMap(event => event.sourceEventIds),
      ...checkpoints.flatMap(c => [c.checkpointId, c.trajectorySourceId]),
    ])];
    events.push(Object.freeze({
      eventId: `${record.episodeId}:major-pitch-timing-breakthrough:${p.policyId}:${p.version}`,
      careerId: source.careerId, playerId: source.playerId,
      episodeId: record.episodeId,
      occurredAtDay: checkpoints[checkpoints.length - 1]!.atDay,
      kind: 'MAJOR_BREAKTHROUGH' as const,
      domain: 'TECHNICAL' as const,
      sourceEventIds: Object.freeze(sourceEventIds),
      profileVersion: episode.profileVersion,
      policyId: p.policyId, policyVersion: p.version,
      trajectoryVersion,
      sourceRevision: checkpoints[checkpoints.length - 1]!.sourceRevision,
    }));
  }
  return Object.freeze(events.sort((a, b) => a.occurredAtDay - b.occurredAtDay
    || a.eventId.localeCompare(b.eventId)));
}
