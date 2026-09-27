import type { DevelopmentLearningEpisode } from './DevelopmentLearningEpisode';
import type { DevelopmentPracticeBundle } from './DevelopmentPracticeExposure';

export const practiceBundleForEpisode = (
  episode: DevelopmentLearningEpisode,
): DevelopmentPracticeBundle => ({
  policy: { policyId: 'practice-exposure-v1', version: 'v1',
    availableAtDay: episode.startedAtDay, selfDirectedShare: 0.5,
    minimumEffectiveExposure: 0.5,
    minimumDistinctPracticeDays: 2 },
  prior: { careerId: episode.careerId, playerId: episode.playerId,
    atDay: episode.effectiveDay, domain: episode.domain!,
    receptivity: 0.8, profileVersion: 'trajectory-v1',
    policyId: 'receptivity-v1', policyVersion: 'v1' },
  repetitions: episode.events.filter((event) =>
    event.kind === 'PRACTICE_RECORDED').map((event) => ({
      sourceEventId: event.sourceEventId, atDay: event.atDay,
      trainingStimulus: 1, coachingFit: 1, challengeFit: 1,
      healthAvailability: 1, fatigue: 0, motivation: 1,
      opportunity: 1, novelty: 1,
    })),
});
