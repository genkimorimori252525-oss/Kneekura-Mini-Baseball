import {
  MAX_QUICK_SPEED_FACTOR,
  MIN_QUICK_SPEED_FACTOR,
  validatePitchTimingProfile,
  type PitchTimingProfile,
} from '../../sim/pitch/PitchTimingModel';
import type { DevelopmentLearningEpisode } from './DevelopmentLearningEpisode';
import { assessDevelopmentPracticeExposure,
  type DevelopmentPracticeAssessment,
  type DevelopmentPracticeBundle } from './DevelopmentPracticeExposure';

export type PitchTimingPracticeMeasurement = Readonly<{
  practiceSourceEventId: string;
  normalMotionToReleaseUs: number;
  quickMotionToReleaseUs: number;
}>;

export type PitchTimingSourceChange = Readonly<{
  episodeId: string;
  effectiveDay: number;
  profileVersion: string;
  consolidationSourceEventId: string;
  practiceSourceEventIds: readonly string[];
  beforeNormalMotionToReleaseUs: number;
  afterNormalMotionToReleaseUs: number;
  beforeQuickSpeedFactor: number;
  afterQuickSpeedFactor: number;
  practiceAssessment: DevelopmentPracticeAssessment;
  changeKind: 'SOURCE_CHANGED' | 'NO_SOURCE_CHANGE';
}>;

/** Authoritative current Match input for this player's pitch timing. */
export type PlayerPitchTimingSource = Readonly<{
  careerId: string;
  playerId: string;
  createdAtDay: number;
  effectiveDay: number;
  revision: number;
  profile: PitchTimingProfile;
  records: readonly PitchTimingSourceChange[];
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const duration = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) > 0;
const fields = (value: unknown, names: readonly string[]): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === names.length
    && names.every((name) => Object.hasOwn(value, name));
const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

export const createPlayerPitchTimingSource = (input: Readonly<{
  careerId: string;
  playerId: string;
  createdAtDay: number;
  profile: PitchTimingProfile;
}>): PlayerPitchTimingSource => {
  if (!fields(input, ['careerId', 'playerId', 'createdAtDay', 'profile'])
    || !id(input.careerId) || !id(input.playerId)
    || !day(input.createdAtDay)) {
    throw new Error('invalid player pitch timing source scope');
  }
  return Object.freeze({ careerId: input.careerId,
    playerId: input.playerId, createdAtDay: input.createdAtDay,
    effectiveDay: input.createdAtDay, revision: 0,
    profile: validatePitchTimingProfile(input.profile),
    records: Object.freeze([]),
  });
};

/** Selects the current Career source for a future or same-day Match. */
export const selectPlayerPitchTimingProfile = (
  source: PlayerPitchTimingSource,
  playerId: string,
  atDay: number,
): PitchTimingProfile => {
  if (!id(playerId) || playerId !== source.playerId) {
    throw new Error('pitch timing source player mismatch');
  }
  if (!day(atDay) || atDay < source.effectiveDay) {
    throw new Error('pitch timing source unavailable at requested day');
  }
  return source.profile;
};

/** Uses paired standardized practice durations; a label or catalyst cannot change Match timing. */
export const applyConsolidatedPitchTimingEvidence = (
  source: PlayerPitchTimingSource,
  expectedRevision: number,
  episode: DevelopmentLearningEpisode,
  measurements: readonly PitchTimingPracticeMeasurement[],
  practice: DevelopmentPracticeBundle,
): PlayerPitchTimingSource => {
  if (expectedRevision !== source.revision) {
    throw new Error('stale player pitch timing source revision');
  }
  if (!Array.isArray(source.records)
    || source.records.length !== source.revision
    || source.records.some((record, index) => source.records.findIndex(
      (other) => other.episodeId === record.episodeId) !== index)) {
    throw new Error('invalid player pitch timing source history');
  }
  if (source.careerId !== episode.careerId
    || source.playerId !== episode.playerId
    || source.createdAtDay > episode.startedAtDay
    || source.effectiveDay > episode.effectiveDay) {
    throw new Error('pitch timing development scope mismatch');
  }
  if (source.records.some((record) => record.episodeId === episode.episodeId)) {
    throw new Error('development episode already applied');
  }
  const consolidation = episode.events.at(-1);
  if (episode.stage !== 'CONSOLIDATED'
    || episode.domain !== 'TECHNICAL'
    || consolidation?.kind !== 'CONSOLIDATION_RECORDED'
    || consolidation.domain !== 'TECHNICAL'
    || consolidation.atDay !== episode.effectiveDay
    || episode.practiceSourceEventIds.length
      < episode.policy.minimumPracticeEvents
    || episode.feedbackSourceEventIds.length
      < episode.policy.minimumFeedbackEvents) {
    throw new Error('pitch timing source requires a consolidated technical episode');
  }
  const practiceIds = episode.practiceSourceEventIds;
  if (!Array.isArray(measurements)
    || measurements.length !== practiceIds.length
    || new Set(practiceIds).size !== practiceIds.length
    || new Set(measurements.map((item) => item?.practiceSourceEventId)).size
      !== measurements.length
    || measurements.some((item) => !fields(item, [
      'practiceSourceEventId', 'normalMotionToReleaseUs',
      'quickMotionToReleaseUs',
    ]) || !practiceIds.includes(item.practiceSourceEventId))) {
    throw new Error('pitch timing measurements must cover each practice event');
  }
  if (measurements.some((item) =>
    !duration(item.normalMotionToReleaseUs)
    || !duration(item.quickMotionToReleaseUs))) {
    throw new Error('invalid pitch timing practice duration');
  }
  const practiceAssessment = assessDevelopmentPracticeExposure(
    episode, practice);
  if (!practiceAssessment.eligible) {
    throw new Error('insufficient development practice exposure');
  }
  const normal = median(measurements.map((item) =>
    item.normalMotionToReleaseUs));
  const quick = median(measurements.map((item) =>
    item.quickMotionToReleaseUs));
  const factor = normal / quick;
  if (!Number.isFinite(factor)
    || factor < MIN_QUICK_SPEED_FACTOR
    || factor > MAX_QUICK_SPEED_FACTOR) {
    throw new Error('measured quick speed factor outside approved range');
  }
  const profile = validatePitchTimingProfile({ ...source.profile,
    normalMotionToReleaseUs: normal, quickSpeedFactor: factor });
  const record: PitchTimingSourceChange = Object.freeze({
    episodeId: episode.episodeId,
    effectiveDay: episode.effectiveDay,
    profileVersion: episode.profileVersion,
    consolidationSourceEventId: consolidation.sourceEventId,
    practiceSourceEventIds: Object.freeze([...practiceIds]),
    beforeNormalMotionToReleaseUs: source.profile.normalMotionToReleaseUs,
    afterNormalMotionToReleaseUs: normal,
    beforeQuickSpeedFactor: source.profile.quickSpeedFactor,
    afterQuickSpeedFactor: factor,
    practiceAssessment,
    changeKind: factor === source.profile.quickSpeedFactor
      && normal === source.profile.normalMotionToReleaseUs
      ? 'NO_SOURCE_CHANGE' : 'SOURCE_CHANGED',
  });
  return Object.freeze({ ...source, effectiveDay: episode.effectiveDay,
    revision: source.revision + 1, profile,
    records: Object.freeze([...source.records, record]),
  });
};
