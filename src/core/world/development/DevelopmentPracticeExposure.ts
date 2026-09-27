import type { DevelopmentLearningEpisode } from './DevelopmentLearningEpisode';
import type { DevelopmentReceptivityPrior } from './DevelopmentReceptivity';

export type DevelopmentPracticeEpisode = Pick<DevelopmentLearningEpisode,
  'episodeId' | 'careerId' | 'playerId' | 'startedAtDay'
  | 'effectiveDay' | 'stage' | 'domain'
  | 'practiceSourceEventIds' | 'events'>;
export type DevelopmentPracticePrior = Pick<DevelopmentReceptivityPrior,
  'careerId' | 'playerId' | 'atDay' | 'domain'
  | 'receptivity' | 'profileVersion' | 'policyId'
  | 'policyVersion'>;
export type DevelopmentPracticePolicy = Readonly<{
  policyId: string;
  version: string;
  availableAtDay: number;
  selfDirectedShare: number;
  minimumEffectiveExposure: number;
  minimumDistinctPracticeDays: number;
}>;
export type DevelopmentPracticeRepetition = Readonly<{
  sourceEventId: string;
  atDay: number;
  trainingStimulus: number;
  coachingFit: number;
  challengeFit: number;
  healthAvailability: number;
  fatigue: number;
  motivation: number;
  opportunity: number;
  novelty: number;
}>;
export type DevelopmentPracticeBundle = Readonly<{
  policy: DevelopmentPracticePolicy;
  prior: DevelopmentPracticePrior;
  repetitions: readonly DevelopmentPracticeRepetition[];
}>;
export type DevelopmentPracticeAssessment = Readonly<{
  episodeId: string;
  careerId: string;
  playerId: string;
  domain: DevelopmentLearningEpisode['domain'];
  atDay: number;
  policyId: string;
  policyVersion: string;
  priorPolicyId: string;
  priorPolicyVersion: string;
  priorProfileVersion: string;
  effectiveExposure: number;
  distinctPracticeDays: number;
  practiceSourceEventIds: readonly string[];
  eligible: boolean;
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const unit = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
    && value >= 0 && value <= 1;
const fields = (value: unknown, names: readonly string[]): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === names.length
    && names.every((name) => Object.hasOwn(value, name));
const requiredFields = (value: unknown, names: readonly string[]): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    && names.every((name) => Object.hasOwn(value, name));
const factorNames = ['trainingStimulus', 'coachingFit',
  'challengeFit', 'healthAvailability', 'fatigue',
  'motivation', 'opportunity', 'novelty'] as const;

/** Evidence gate only: no age, pathway or label writes a source ability. */
export const assessDevelopmentPracticeExposure = (
  episode: DevelopmentPracticeEpisode,
  bundle: DevelopmentPracticeBundle,
): DevelopmentPracticeAssessment => {
  if (!fields(bundle, ['policy', 'prior', 'repetitions'])
    || !id(episode?.episodeId) || !id(episode.careerId)
    || !id(episode.playerId)
    || !day(episode.startedAtDay)
    || !day(episode.effectiveDay)
    || episode.effectiveDay < episode.startedAtDay
    || episode.stage !== 'CONSOLIDATED'
    || episode.domain === null) {
    throw new Error('invalid consolidated practice episode');
  }
  const { policy, prior, repetitions } = bundle;
  if (!fields(policy, ['policyId', 'version', 'availableAtDay',
    'selfDirectedShare', 'minimumEffectiveExposure',
    'minimumDistinctPracticeDays'])
    || !id(policy.policyId) || !id(policy.version)
    || !unit(policy.selfDirectedShare)
    || !Number.isFinite(policy.minimumEffectiveExposure)
    || policy.minimumEffectiveExposure <= 0
    || !Number.isSafeInteger(policy.minimumDistinctPracticeDays)
    || policy.minimumDistinctPracticeDays <= 0) {
    throw new Error('invalid development practice policy');
  }
  if (!day(policy.availableAtDay)
    || policy.availableAtDay > episode.startedAtDay) {
    throw new Error('future development practice policy');
  }
  if (!requiredFields(prior, ['careerId', 'playerId', 'atDay',
    'domain', 'receptivity', 'profileVersion', 'policyId',
    'policyVersion'])
    || prior.careerId !== episode.careerId
    || prior.playerId !== episode.playerId
    || prior.domain !== episode.domain
    || !day(prior.atDay)
    || prior.atDay < episode.startedAtDay
    || prior.atDay > episode.effectiveDay
    || !unit(prior.receptivity)
    || prior.receptivity === 0
    || !id(prior.policyId) || !id(prior.policyVersion)
    || !id(prior.profileVersion)) {
    throw new Error('development practice prior scope mismatch');
  }
  if (!Array.isArray(episode.events)
    || !Array.isArray(episode.practiceSourceEventIds)
    || !Array.isArray(repetitions)) {
    throw new Error('invalid development practice events');
  }
  const practiceEvents = episode.events.filter((event) =>
    event.kind === 'PRACTICE_RECORDED');
  const practiceIds = episode.practiceSourceEventIds;
  if (practiceIds.length === 0
    || practiceIds.length !== practiceEvents.length
    || practiceIds.length !== repetitions.length
    || new Set(practiceIds).size !== practiceIds.length
    || new Set(repetitions.map((item) => item?.sourceEventId)).size
      !== repetitions.length
    || practiceEvents.some((event, index) =>
      event.sourceEventId !== practiceIds[index]
      || event.domain !== episode.domain)) {
    throw new Error('invalid development practice events');
  }
  const byId = new Map(practiceEvents.map((event) =>
    [event.sourceEventId, event]));
  for (const repetition of repetitions) {
    if (!fields(repetition, ['sourceEventId', 'atDay',
      ...factorNames])
      || !id(repetition.sourceEventId)
      || !byId.has(repetition.sourceEventId)
      || !day(repetition.atDay)
      || byId.get(repetition.sourceEventId)?.atDay
        !== repetition.atDay) {
      throw new Error('invalid development practice evidence');
    }
    if (factorNames.some((name) => !unit(repetition[name]))) {
      throw new Error('invalid development practice factor');
    }
  }
  const effectiveExposure = repetitions.reduce((sum, item) =>
    sum + prior.receptivity * item.trainingStimulus
      * item.challengeFit * item.healthAvailability
      * (1 - item.fatigue) * item.motivation
      * item.opportunity * item.novelty
      * (policy.selfDirectedShare
        + (1 - policy.selfDirectedShare) * item.coachingFit), 0);
  if (!Number.isFinite(effectiveExposure)) {
    throw new Error('development practice exposure overflow');
  }
  const distinctPracticeDays = new Set(repetitions.map((item) =>
    item.atDay)).size;
  return Object.freeze({ episodeId: episode.episodeId,
    careerId: episode.careerId, playerId: episode.playerId,
    domain: episode.domain, atDay: episode.effectiveDay,
    policyId: policy.policyId, policyVersion: policy.version,
    priorPolicyId: prior.policyId,
    priorPolicyVersion: prior.policyVersion,
    priorProfileVersion: prior.profileVersion,
    effectiveExposure, distinctPracticeDays,
    practiceSourceEventIds: Object.freeze([...practiceIds]),
    eligible: effectiveExposure >= policy.minimumEffectiveExposure
      && distinctPracticeDays >= policy.minimumDistinctPracticeDays,
  });
};
