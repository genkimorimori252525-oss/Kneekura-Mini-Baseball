import { expect, it } from 'vitest';
import { applyRosterChange } from '../roster/RosterCommands';
import { createRosterState } from '../roster/RosterState';
import { rosterFixture } from '../roster/RosterTestFixtures';
import { appendDevelopmentLearningEvent,
  startDevelopmentLearningEpisode } from './DevelopmentLearningEpisode';

const episode = () => {
  const before = createRosterState(rosterFixture());
  const changed = applyRosterChange(before, { commandId: 'promote-1',
    causeEventId: 'manager-selection-1', expectedRevision: 0,
    effectiveDay: 10, changes: [{ playerId: 'p2',
      assignment: { clubId: 'a', unitId: 'a-first' } }],
  });
  if (!changed.ok) throw new Error(JSON.stringify(changed.rejection));
  return startDevelopmentLearningEpisode('episode-1', before,
    changed.state, changed.event, 'p2', {
    careerId: before.careerId, playerId: 'p2', createdAtDay: 1,
    profileVersion: 'catalyst-v1',
  }, { policyId: 'learning-1', version: 'v1',
    availableAtDay: 10, minimumPracticeEvents: 2,
    minimumFeedbackEvents: 1, minimumElapsedDays: 5 });
};
const event = (kind: 'APPRAISAL_ENGAGED' | 'HYPOTHESIS_FORMED'
  | 'PRACTICE_RECORDED' | 'FEEDBACK_RECORDED'
  | 'CONSOLIDATION_RECORDED', id: string, atDay: number) => ({
  eventId: id, sourceEventId: `source-${id}`, atDay, kind,
  ...(kind === 'HYPOTHESIS_FORMED' || kind === 'PRACTICE_RECORDED'
    || kind === 'FEEDBACK_RECORDED' || kind === 'CONSOLIDATION_RECORDED'
    ? { domain: 'TECHNICAL' as const } : {}),
});

it('requires appraisal, hypothesis, repetitions and feedback before consolidation', () => {
  let current = episode();
  expect(current.stage).toBe('CATALYST');
  expect(current).not.toHaveProperty('ability');
  current = appendDevelopmentLearningEvent(current, 0,
    event('APPRAISAL_ENGAGED', 'response-1', 10));
  current = appendDevelopmentLearningEvent(current, 1,
    event('HYPOTHESIS_FORMED', 'hypothesis-1', 11));
  current = appendDevelopmentLearningEvent(current, 2,
    event('PRACTICE_RECORDED', 'practice-1', 12));
  expect(() => appendDevelopmentLearningEvent(current, 3,
    event('CONSOLIDATION_RECORDED', 'consolidate-early', 13)))
    .toThrow('evidence');
  current = appendDevelopmentLearningEvent(current, 3,
    event('PRACTICE_RECORDED', 'practice-2', 13));
  current = appendDevelopmentLearningEvent(current, 4,
    event('FEEDBACK_RECORDED', 'feedback-1', 14));
  const completed = appendDevelopmentLearningEvent(current, 5,
    event('CONSOLIDATION_RECORDED', 'consolidated-1', 15));
  expect(completed).toMatchObject({ stage: 'CONSOLIDATED', revision: 6,
    domain: 'TECHNICAL', practiceSourceEventIds: [
      'source-practice-1', 'source-practice-2',
    ], feedbackSourceEventIds: ['source-feedback-1'] });
  expect(Object.isFrozen(completed.events)).toBe(true);
  expect(() => appendDevelopmentLearningEvent(completed, 6,
    event('PRACTICE_RECORDED', 'practice-late', 16))).toThrow('stage');
});

it('rejects one-result unlocks, duplicate evidence and stale revisions', () => {
  const initial = episode();
  expect(() => appendDevelopmentLearningEvent(initial, 0,
    event('HYPOTHESIS_FORMED', 'hypothesis-1', 10))).toThrow('stage');
  const engaged = appendDevelopmentLearningEvent(initial, 0,
    event('APPRAISAL_ENGAGED', 'response-1', 10));
  expect(() => appendDevelopmentLearningEvent(engaged, 0,
    event('HYPOTHESIS_FORMED', 'hypothesis-1', 11))).toThrow('stale');
  const hypothesis = appendDevelopmentLearningEvent(engaged, 1,
    event('HYPOTHESIS_FORMED', 'hypothesis-1', 11));
  expect(() => appendDevelopmentLearningEvent(hypothesis, 2,
    { ...event('PRACTICE_RECORDED', 'practice-1', 12),
      sourceEventId: 'source-hypothesis-1' })).toThrow('duplicate');
  expect(hypothesis.revision).toBe(2);
});

it('records a dismissed catalyst without opening a learning path', () => {
  const initial = episode();
  const dismissed = appendDevelopmentLearningEvent(initial, 0, {
    eventId: 'dismiss-1', sourceEventId: 'source-dismiss-1',
    atDay: 10, kind: 'APPRAISAL_DISMISSED',
  });
  expect(dismissed.stage).toBe('ABANDONED');
  expect(() => appendDevelopmentLearningEvent(dismissed, 1,
    event('HYPOTHESIS_FORMED', 'hypothesis-1', 11))).toThrow('stage');
});
