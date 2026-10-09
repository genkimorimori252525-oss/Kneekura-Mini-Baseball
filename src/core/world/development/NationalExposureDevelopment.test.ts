import { expect, it } from 'vitest';
import { startNationalExposureDevelopmentLearningEpisode, appendDevelopmentLearningEvent } from './DevelopmentLearningEpisode';
import { resolveDevelopmentEpisodeInitiation } from './DevelopmentEpisodeInitiation';
import { deriveDevelopmentInitiationHistory } from './DevelopmentInitiationHistory';
import { CATALYST_FAMILIES } from './DevelopmentCatalyst';
const candidate = (episodeId = 'episode', motifId = 'observed-pitch-timing') => startNationalExposureDevelopmentLearningEpisode(episodeId,
  { careerId: 'career', playerId: 'player', occurredAtDay: 10, sourceEventId: `receipt-${episodeId}`, competitionEditionId: 'international', motifId },
  { careerId: 'career', playerId: 'player', createdAtDay: 0, profileVersion: 'v1' },
  { policyId: 'fixture-learning', version: 'v1', availableAtDay: 0, minimumPracticeEvents: 2, minimumFeedbackEvents: 1, minimumElapsedDays: 5 });
const assess = (initiated: boolean) => resolveDevelopmentEpisodeInitiation({ episode: candidate(),
  catalystProfile: { careerId: 'career', playerId: 'player', createdAtDay: 0, profileVersion: 'v1',
    sensitivityByFamily: Object.fromEntries(CATALYST_FAMILIES.map(f => [f, 1])) as Record<typeof CATALYST_FAMILIES[number], number> },
  prior: { careerId: 'career', playerId: 'player', atDay: 10, domain: 'TECHNICAL', receptivity: 1, profileVersion: 'v1', policyId: 'fixture', policyVersion: 'v1' },
  appraisal: { sourceEventId: 'response', atDay: 10, salience: 1, learningDisposition: 1, novelty: 1, consolidationCapacity: 1 },
  policy: { policyId: 'fixture', version: 'v1', availableAtDay: 0, baseChance: initiated ? 1 : 0, maximumChance: 1,
    sameMotifSaturation: 0.5, cooldownDays: 30, maximumOpenHypotheses: 2 }, careerDevelopmentSeed: 12345,
  priorSameMotifAttempts: 0, openHypotheses: 0, competingLearningLoad: 0, lastInitiatedDay: null });
it('keeps actual international exposure at catalyst until personal appraisal', () => {
  const episode = candidate();
  expect(episode.stage).toBe('CATALYST'); expect(episode.catalyst.family).toBe('ELITE_EXPOSURE');
  expect(episode).not.toHaveProperty('ability');
  expect(() => appendDevelopmentLearningEvent(episode, 0,
    { eventId: 'practice', sourceEventId: 'practice', atDay: 11, kind: 'PRACTICE_RECORDED', domain: 'TECHNICAL' })).toThrow('stage');
});
it.each([true, false])('uses the existing single episode draw and counts motif history, engagement=%s', initiated => {
  const result = assess(initiated);
  expect(result.assessment.drawCount).toBe(1); expect(result.episode.stage).toBe(initiated ? 'ENGAGED' : 'ABANDONED');
  expect(deriveDevelopmentInitiationHistory(candidate('later'), 10, [result])).toEqual({ priorSameMotifAttempts: 1,
    openHypotheses: initiated ? 1 : 0, lastInitiatedDay: initiated ? 10 : null });
  expect(deriveDevelopmentInitiationHistory(candidate('later', 'other'), 10, [result]).priorSameMotifAttempts).toBe(0);
});
