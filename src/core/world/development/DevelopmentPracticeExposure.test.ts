import { expect, it } from 'vitest';
import type { DevelopmentLearningEpisode } from './DevelopmentLearningEpisode';
import { assessDevelopmentPracticeExposure,
  type DevelopmentPracticeBundle } from './DevelopmentPracticeExposure';

const episode: Pick<DevelopmentLearningEpisode,
  'episodeId' | 'careerId' | 'playerId' | 'startedAtDay'
  | 'effectiveDay' | 'stage' | 'domain'
  | 'practiceSourceEventIds' | 'events'> = {
  episodeId: 'learning-1', careerId: 'career-1',
  playerId: 'player-1', startedAtDay: 10,
  effectiveDay: 15, stage: 'CONSOLIDATED',
  domain: 'TECHNICAL',
  practiceSourceEventIds: ['practice-1', 'practice-2'],
  events: [
    { eventId: 'event-1', sourceEventId: 'practice-1',
      atDay: 12, kind: 'PRACTICE_RECORDED', domain: 'TECHNICAL' },
    { eventId: 'event-2', sourceEventId: 'practice-2',
      atDay: 13, kind: 'PRACTICE_RECORDED', domain: 'TECHNICAL' },
  ],
};

const bundle = (): DevelopmentPracticeBundle => ({
  policy: { policyId: 'exposure-1', version: 'v1',
    availableAtDay: 10, selfDirectedShare: 0.5,
    minimumEffectiveExposure: 0.5,
    minimumDistinctPracticeDays: 2 },
  prior: { careerId: 'career-1', playerId: 'player-1',
    atDay: 15, domain: 'TECHNICAL', receptivity: 0.8,
    profileVersion: 'trajectory-v1',
    policyId: 'receptivity-1', policyVersion: 'v1' },
  repetitions: ['practice-1', 'practice-2'].map((sourceEventId,
    index) => ({ sourceEventId, atDay: 12 + index,
    trainingStimulus: 1, coachingFit: 1, challengeFit: 1,
    healthAvailability: 1, fatigue: 0, motivation: 1,
    opportunity: 1, novelty: 1 })),
});

it('requires causal practice exposure in addition to a consolidated episode', () => {
  const result = assessDevelopmentPracticeExposure(episode, bundle());
  expect(result).toMatchObject({ eligible: true,
    effectiveExposure: 1.6, distinctPracticeDays: 2,
    practiceSourceEventIds: ['practice-1', 'practice-2'],
    policyId: 'exposure-1', priorPolicyId: 'receptivity-1' });
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.practiceSourceEventIds)).toBe(true);
  const fullPrior = { ...bundle().prior, ageYears: 26 };
  expect(assessDevelopmentPracticeExposure(episode, { ...bundle(),
    prior: fullPrior }).eligible).toBe(true);
});

it('separates health, opportunity and coaching from age and labels', () => {
  const healthy = bundle();
  const noOpportunity = { ...healthy,
    repetitions: healthy.repetitions.map((item) => ({ ...item,
      opportunity: 0 })) };
  expect(assessDevelopmentPracticeExposure(episode,
    noOpportunity).eligible).toBe(false);
  const injured = { ...healthy,
    repetitions: healthy.repetitions.map((item) => ({ ...item,
      healthAvailability: 0 })) };
  expect(assessDevelopmentPracticeExposure(episode,
    injured).effectiveExposure).toBe(0);
  const selfDirected = { ...healthy,
    repetitions: healthy.repetitions.map((item) => ({ ...item,
      coachingFit: 0 })) };
  expect(assessDevelopmentPracticeExposure(episode,
    selfDirected).effectiveExposure).toBe(0.8);
  const lowReceptivity = { ...healthy,
    prior: { ...healthy.prior, receptivity: 0.1 } };
  expect(assessDevelopmentPracticeExposure(episode,
    lowReceptivity).eligible).toBe(false);
});

it('requires matched practice events, dated evidence and pinned policies', () => {
  const valid = bundle();
  expect(() => assessDevelopmentPracticeExposure(episode,
    { ...valid, repetitions: valid.repetitions.slice(0, 1) }))
    .toThrow('practice');
  expect(() => assessDevelopmentPracticeExposure(episode,
    { ...valid, repetitions: valid.repetitions.map((item) => ({
      ...item, atDay: 14 })) })).toThrow('practice');
  expect(() => assessDevelopmentPracticeExposure(episode,
    { ...valid, prior: { ...valid.prior, playerId: 'other' } }))
    .toThrow('scope');
  expect(() => assessDevelopmentPracticeExposure(episode,
    { ...valid, policy: { ...valid.policy,
      availableAtDay: 11 } })).toThrow('future');
  expect(() => assessDevelopmentPracticeExposure(episode,
    { ...valid, repetitions: valid.repetitions.map((item) => ({
      ...item, novelty: Number.NaN })) })).toThrow('factor');
});
