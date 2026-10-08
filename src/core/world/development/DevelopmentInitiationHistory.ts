import type { DevelopmentLearningEpisode } from './DevelopmentLearningEpisode';
import type { DevelopmentInitiationAssessment } from
  './DevelopmentEpisodeInitiation';

export type RecordedDevelopmentInitiation = Readonly<{
  assessment: DevelopmentInitiationAssessment;
  episode: DevelopmentLearningEpisode;
}>;
export type DevelopmentInitiationHistory = Readonly<{
  priorSameMotifAttempts: number;
  openHypotheses: number;
  lastInitiatedDay: number | null;
}>;

/** Computes one episode's hazard history from accepted earlier outcomes. */
export const deriveDevelopmentInitiationHistory = (
  candidate: DevelopmentLearningEpisode,
  asOfDay: number,
  prior: readonly RecordedDevelopmentInitiation[],
): DevelopmentInitiationHistory => {
  if (!candidate || candidate.stage !== 'CATALYST'
    || !Number.isSafeInteger(asOfDay)
    || asOfDay < candidate.startedAtDay
    || !Array.isArray(prior)) {
    throw new Error('invalid development initiation history scope');
  }
  const seen = new Set<string>();
  let priorSameMotifAttempts = 0;
  let openHypotheses = 0;
  let lastInitiatedDay: number | null = null;
  for (const record of prior) {
    if (!record || !record.episode || !record.assessment) {
      throw new Error('invalid development initiation history');
    }
    const { assessment, episode } = record;
    if (seen.has(episode?.episodeId)
      || episode?.episodeId === candidate.episodeId) {
      throw new Error('duplicate development initiation history');
    }
    seen.add(episode.episodeId);
    if (episode.careerId !== candidate.careerId
      || episode.playerId !== candidate.playerId
      || assessment?.episodeId !== episode.episodeId
      || assessment.careerId !== episode.careerId
      || assessment.playerId !== episode.playerId
      || assessment.catalystSourceEventId
        !== episode.catalyst.sourceEventId
      || assessment.appraisalSourceEventId
        !== episode.events[1]?.sourceEventId
      || assessment.atDay !== episode.events[1]?.atDay
      || episode.events[1]?.kind !== (assessment.initiated
        ? 'APPRAISAL_ENGAGED' : 'APPRAISAL_DISMISSED')
      || assessment.atDay > asOfDay
      || episode.effectiveDay > asOfDay
      || episode.startedAtDay > assessment.atDay
      || (assessment.initiated
        ? episode.stage === 'CATALYST' || episode.stage === 'ABANDONED'
        : episode.stage !== 'ABANDONED')) {
      throw new Error('invalid development initiation history');
    }
    if (episode.catalyst.family === 'PROMOTION_DEMOTION' && candidate.catalyst.family === 'PROMOTION_DEMOTION'
      ? episode.catalyst.direction === candidate.catalyst.direction
      : episode.catalyst.family === 'TECHNICAL_DISCOVERY' && candidate.catalyst.family === 'TECHNICAL_DISCOVERY'
        && episode.catalyst.motifId === candidate.catalyst.motifId) {
      priorSameMotifAttempts += 1;
    }
    if (assessment.initiated) {
      if (lastInitiatedDay === null
        || assessment.atDay > lastInitiatedDay) {
        lastInitiatedDay = assessment.atDay;
      }
      if (episode.stage === 'ENGAGED' || episode.stage === 'HYPOTHESIS'
        || episode.stage === 'PRACTICING') {
        openHypotheses += 1;
      }
    }
  }
  return Object.freeze({ priorSameMotifAttempts,
    openHypotheses, lastInitiatedDay });
};
