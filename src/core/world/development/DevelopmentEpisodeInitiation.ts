import { CATALYST_FAMILIES,
  type DevelopmentCatalystProfile } from './DevelopmentCatalyst';
import { appendDevelopmentLearningEvent,
  type DevelopmentLearningEpisode } from './DevelopmentLearningEpisode';
import { createDevelopmentRandom } from './DevelopmentRandom';
import type { DevelopmentReceptivityPrior } from './DevelopmentReceptivity';
import { DEVELOPMENT_DOMAINS } from './DevelopmentTrajectory';

export type DevelopmentInitiationPolicy = Readonly<{
  policyId: string;
  version: string;
  availableAtDay: number;
  baseChance: number;
  maximumChance: number;
  sameMotifSaturation: number;
  cooldownDays: number;
  maximumOpenHypotheses: number;
}>;
export type DevelopmentInitiationAppraisal = Readonly<{
  sourceEventId: string;
  atDay: number;
  salience: number;
  learningDisposition: number;
  novelty: number;
  consolidationCapacity: number;
}>;
export type DevelopmentInitiationRequest = Readonly<{
  episode: DevelopmentLearningEpisode;
  catalystProfile: Pick<DevelopmentCatalystProfile,
    'careerId' | 'playerId' | 'createdAtDay'
    | 'profileVersion' | 'sensitivityByFamily'>;
  prior: Pick<DevelopmentReceptivityPrior,
    'careerId' | 'playerId' | 'atDay' | 'domain'
    | 'receptivity' | 'profileVersion' | 'policyId'
    | 'policyVersion'>;
  appraisal: DevelopmentInitiationAppraisal;
  policy: DevelopmentInitiationPolicy;
  careerDevelopmentSeed: number;
  priorSameMotifAttempts: number;
  openHypotheses: number;
  competingLearningLoad: number;
  lastInitiatedDay: number | null;
}>;
export type DevelopmentInitiationAssessment = Readonly<{
  episodeId: string;
  careerId: string;
  playerId: string;
  atDay: number;
  catalystSourceEventId: string;
  appraisalSourceEventId: string;
  policyId: string;
  policyVersion: string;
  catalystProfileVersion: string;
  priorProfileVersion: string;
  priorPolicyId: string;
  priorPolicyVersion: string;
  rngVersion: 'development-xorshift32-v1';
  seed: number;
  drawCount: 1;
  draw: number;
  probability: number;
  reason: 'ELIGIBLE' | 'COOLDOWN' | 'OPEN_HYPOTHESIS_CAP';
  initiated: boolean;
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const count = (value: unknown): value is number =>
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

/** Stable episode salt makes draws independent of event processing order. */
const episodeSalt = (parts: readonly string[]): number => {
  let hash = 0x811c9dc5;
  for (const codePoint of JSON.stringify(parts)) {
    hash ^= codePoint.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

/** One career RNG draw per catalyst episode, never per practice repetition. */
export const assessDevelopmentEpisodeInitiation = (
  input: DevelopmentInitiationRequest,
): DevelopmentInitiationAssessment => {
  if (!fields(input, ['episode', 'catalystProfile', 'prior',
    'appraisal', 'policy', 'careerDevelopmentSeed',
    'priorSameMotifAttempts', 'openHypotheses',
    'competingLearningLoad',
    'lastInitiatedDay'])) {
    throw new Error('invalid development initiation request');
  }
  const { episode, catalystProfile, prior, appraisal,
    policy } = input;
  if (!id(episode?.episodeId) || !id(episode.careerId)
    || !id(episode.playerId) || !day(episode.startedAtDay)
    || episode.stage !== 'CATALYST'
    || episode.revision !== 0
    || episode.domain !== null
    || !Array.isArray(episode.events)
    || episode.events.length !== 1
    || episode.events[0].kind !== 'CATALYST'
    || episode.events[0].sourceEventId
      !== episode.catalyst.sourceEventId
    || episode.effectiveDay !== episode.startedAtDay) {
    throw new Error('development initiation requires one catalyst episode');
  }
  if (!requiredFields(catalystProfile, ['careerId',
    'playerId', 'createdAtDay', 'profileVersion',
    'sensitivityByFamily'])
    || catalystProfile.careerId !== episode.careerId
    || catalystProfile.playerId !== episode.playerId
    || catalystProfile.profileVersion !== episode.profileVersion
    || !day(catalystProfile.createdAtDay)
    || catalystProfile.createdAtDay > episode.startedAtDay
    || !fields(catalystProfile.sensitivityByFamily,
      CATALYST_FAMILIES)
    || CATALYST_FAMILIES.some((family) =>
      !unit(catalystProfile.sensitivityByFamily[family]))
    || !requiredFields(prior, ['careerId', 'playerId',
      'atDay', 'domain', 'receptivity', 'profileVersion',
      'policyId', 'policyVersion'])
    || prior.careerId !== episode.careerId
    || prior.playerId !== episode.playerId
    || !id(prior.profileVersion) || !id(prior.policyId)
    || !id(prior.policyVersion)
    || !day(prior.atDay)
    || prior.atDay < episode.startedAtDay
    || !DEVELOPMENT_DOMAINS.includes(prior.domain)
    || !unit(prior.receptivity)
    || prior.receptivity === 0) {
    throw new Error('development initiation profile scope mismatch');
  }
  if (!fields(appraisal, ['sourceEventId', 'atDay',
    'salience', 'learningDisposition', 'novelty',
    'consolidationCapacity'])
    || !id(appraisal.sourceEventId)
    || appraisal.sourceEventId === episode.catalyst.sourceEventId
    || !day(appraisal.atDay)
    || appraisal.atDay < episode.startedAtDay
    || prior.atDay > appraisal.atDay
    || !unit(appraisal.salience)
    || !unit(appraisal.learningDisposition)
    || !unit(appraisal.novelty)
    || !unit(appraisal.consolidationCapacity)) {
    throw new Error('invalid development initiation appraisal');
  }
  if (!fields(policy, ['policyId', 'version',
    'availableAtDay', 'baseChance', 'maximumChance',
    'sameMotifSaturation', 'cooldownDays',
    'maximumOpenHypotheses'])
    || !id(policy.policyId) || !id(policy.version)
    || !unit(policy.baseChance)
    || !unit(policy.maximumChance)
    || policy.baseChance > policy.maximumChance
    || !unit(policy.sameMotifSaturation)
    || !count(policy.cooldownDays)
    || !count(policy.maximumOpenHypotheses)
    || policy.maximumOpenHypotheses === 0) {
    throw new Error('invalid development initiation policy');
  }
  if (!day(policy.availableAtDay)
    || policy.availableAtDay > episode.startedAtDay) {
    throw new Error('future development initiation policy');
  }
  if (!count(input.priorSameMotifAttempts)
    || !count(input.openHypotheses)
    || !unit(input.competingLearningLoad)
    || (input.lastInitiatedDay !== null
      && (!day(input.lastInitiatedDay)
        || input.lastInitiatedDay > appraisal.atDay))) {
    throw new Error('invalid development initiation history');
  }
  const salt = episodeSalt([episode.careerId,
    episode.playerId, episode.episodeId,
    policy.policyId, policy.version]);
  const draw = createDevelopmentRandom(
    input.careerDevelopmentSeed, salt)();
  const cooldown = input.lastInitiatedDay !== null
    && appraisal.atDay - input.lastInitiatedDay
      < policy.cooldownDays;
  const cap = input.openHypotheses
    >= policy.maximumOpenHypotheses;
  const reason = cooldown ? 'COOLDOWN' as const
    : cap ? 'OPEN_HYPOTHESIS_CAP' as const
      : 'ELIGIBLE' as const;
  const sensitivity = catalystProfile.sensitivityByFamily[
    episode.catalyst.family];
  const saturation = 1 / (1 + policy.sameMotifSaturation
    * input.priorSameMotifAttempts);
  const rawChance = policy.baseChance * sensitivity
    * prior.receptivity * appraisal.salience
    * appraisal.learningDisposition * appraisal.novelty
    * appraisal.consolidationCapacity * saturation
    * (1 - input.competingLearningLoad);
  const probability = reason === 'ELIGIBLE'
    ? Math.min(policy.maximumChance, rawChance) : 0;
  return Object.freeze({ episodeId: episode.episodeId,
    careerId: episode.careerId, playerId: episode.playerId,
    atDay: appraisal.atDay,
    catalystSourceEventId: episode.catalyst.sourceEventId,
    appraisalSourceEventId: appraisal.sourceEventId,
    policyId: policy.policyId, policyVersion: policy.version,
    catalystProfileVersion: catalystProfile.profileVersion,
    priorProfileVersion: prior.profileVersion,
    priorPolicyId: prior.policyId,
    priorPolicyVersion: prior.policyVersion,
    rngVersion: 'development-xorshift32-v1',
    seed: input.careerDevelopmentSeed, drawCount: 1,
    draw, probability, reason,
    initiated: draw < probability,
  });
};

/** Resolves a single personal appraisal into an immutable episode transition. */
export const resolveDevelopmentEpisodeInitiation = (
  input: DevelopmentInitiationRequest,
): Readonly<{ assessment: DevelopmentInitiationAssessment;
  episode: DevelopmentLearningEpisode }> => {
  const assessment = assessDevelopmentEpisodeInitiation(input);
  const episode = appendDevelopmentLearningEvent(input.episode,
    input.episode.revision, {
      eventId: `${input.episode.episodeId}:appraisal`,
      sourceEventId: input.appraisal.sourceEventId,
      atDay: input.appraisal.atDay,
      kind: assessment.initiated
        ? 'APPRAISAL_ENGAGED' : 'APPRAISAL_DISMISSED',
    });
  return Object.freeze({ assessment, episode });
};
