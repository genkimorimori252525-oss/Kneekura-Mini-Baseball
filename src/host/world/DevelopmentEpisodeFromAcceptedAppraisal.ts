import { resolveDevelopmentEpisodeInitiation,
  type DevelopmentInitiationAppraisal,
  type DevelopmentInitiationPolicy } from
  '../../core/world/development/DevelopmentEpisodeInitiation';
import { deriveDevelopmentInitiationHistory,
  type RecordedDevelopmentInitiation } from
  '../../core/world/development/DevelopmentInitiationHistory';
import type { DevelopmentLearningPolicy } from
  '../../core/world/development/DevelopmentLearningEpisode';
import { evaluateDevelopmentReceptivity,
  type DevelopmentReceptivityPolicy } from
  '../../core/world/development/DevelopmentReceptivity';
import type { DevelopmentDomain,
  DevelopmentTrajectoryProfile } from
  '../../core/world/development/DevelopmentTrajectory';
import type { DevelopmentCatalystProfile } from
  '../../core/world/development/DevelopmentCatalyst';
import { startDevelopmentEpisodeFromRosterExecution,
  type DevelopmentEpisodeRosterSources } from
  './DevelopmentEpisodeFromRosterExecution';

export type AcceptedDevelopmentAppraisal = Readonly<{
  sourceId: string;
  episodeId: string;
  careerId: string;
  playerId: string;
  domain: DevelopmentDomain;
  ageYears: number;
  competingLearningLoad: number;
  appraisal: DevelopmentInitiationAppraisal;
}>;
export type AcceptedDevelopmentPolicies = Readonly<{
  sourceId: string;
  careerId: string;
  learning: DevelopmentLearningPolicy;
  receptivity: DevelopmentReceptivityPolicy;
  initiation: DevelopmentInitiationPolicy;
}>;
export type DevelopmentAppraisalSources = Omit<
  DevelopmentEpisodeRosterSources, 'person'> & Readonly<{
  person: Readonly<{
    read(sourceId: string): Readonly<{
      careerId: string; playerId: string; personId: string;
      priors: Readonly<{ createdAtDay: number;
        catalyst: Pick<DevelopmentCatalystProfile,
          'careerId' | 'playerId' | 'createdAtDay'
          | 'profileVersion' | 'sensitivityByFamily'>;
        trajectory: DevelopmentTrajectoryProfile }>;
    }> | null;
    readDevelopmentSeed(careerId: string): number | null;
  }>;
  appraisal: Readonly<{
    readAcceptedAppraisal(sourceId: string):
      AcceptedDevelopmentAppraisal | null;
  }>;
  policies: Readonly<{
    readAcceptedPolicies(sourceId: string):
      AcceptedDevelopmentPolicies | null;
  }>;
  history: Readonly<{
    readAcceptedPrior(careerId: string, playerId: string,
      atDay: number): readonly RecordedDevelopmentInitiation[];
  }>;
}>;

/** Resolves one appraisal using accepted World, Person, Career and policy sources. */
export const resolveDevelopmentEpisodeFromAcceptedAppraisal = (
  sources: DevelopmentAppraisalSources,
  input: Readonly<{ episodeId: string; executionId: string;
    playerId: string; personSourceId: string;
    appraisalSourceId: string; policySourceId: string }>,
): ReturnType<typeof resolveDevelopmentEpisodeInitiation> => {
  if (!input || !input.appraisalSourceId || !input.policySourceId) {
    throw new Error('invalid development appraisal source identity');
  }
  const appraisal = sources.appraisal.readAcceptedAppraisal(
    input.appraisalSourceId);
  const policies = sources.policies.readAcceptedPolicies(
    input.policySourceId);
  const person = sources.person.read(input.personSourceId);
  if (!appraisal || !policies || !person
    || appraisal.sourceId !== input.appraisalSourceId
    || policies.sourceId !== input.policySourceId
    || appraisal.episodeId !== input.episodeId
    || appraisal.playerId !== input.playerId
    || person.playerId !== input.playerId
    || policies.careerId !== appraisal.careerId
    || person.careerId !== appraisal.careerId
    || person.priors.trajectory.careerId !== appraisal.careerId
    || person.priors.trajectory.playerId !== input.playerId) {
    throw new Error('development appraisal lacks accepted source scope');
  }
  const episode = startDevelopmentEpisodeFromRosterExecution(
    sources, { episodeId: input.episodeId,
      executionId: input.executionId, playerId: input.playerId,
      personSourceId: input.personSourceId,
      policy: policies.learning });
  if (episode.careerId !== appraisal.careerId) {
    throw new Error('development appraisal does not match catalyst');
  }
  const careerDevelopmentSeed = sources.person.readDevelopmentSeed(
    episode.careerId);
  if (careerDevelopmentSeed === null) {
    throw new Error('development Career seed is missing');
  }
  const prior = evaluateDevelopmentReceptivity(
    person.priors.trajectory, appraisal.domain,
    appraisal.ageYears, appraisal.appraisal.atDay,
    policies.receptivity);
  const history = deriveDevelopmentInitiationHistory(episode,
    appraisal.appraisal.atDay,
    sources.history.readAcceptedPrior(episode.careerId,
      episode.playerId, appraisal.appraisal.atDay));
  return resolveDevelopmentEpisodeInitiation({ episode,
    catalystProfile: person.priors.catalyst,
    prior, appraisal: appraisal.appraisal,
    policy: policies.initiation, careerDevelopmentSeed,
    ...history,
    competingLearningLoad: appraisal.competingLearningLoad });
};
