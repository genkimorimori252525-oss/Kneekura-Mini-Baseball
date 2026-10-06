import { afterEach, expect, it } from 'vitest';
import { practiceFixture } from './PitchPracticeAttempt.test-support';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });

it('captures authentic legacy initiation and later-practice archive bytes before practice-origin production changes', async () => {
  const f = await practiceFixture(cleanup), complete = f.complete();
  f.assess(complete);
  const settled = f.owner.settle(complete.attemptId);
  expect(settled.kind).toBe('complete');
  if (settled.kind !== 'complete') throw new Error('legacy practice baseline did not settle');
  expect(f.count('world_roster_executions')).toBe(1);
  expect(f.count('world_development_initiations')).toBe(1);
  expect(settled.episode!.practiceSourceEventIds).toEqual([settled.activity.sourceEventId]);
  const initiation = f.db.prepare('SELECT request_json, assessment_json, initial_json, current_json FROM world_development_initiations WHERE episode_id=?')
    .get('episode') as { request_json: string; assessment_json: string; initial_json: string; current_json: string };
  const practice = f.db.prepare('SELECT opportunity_json, episode_before_json, learning_evidence_json, immutable_hash FROM pitch_practice_attempts WHERE attempt_id=?')
    .get(complete.attemptId) as { opportunity_json: string; episode_before_json: string; learning_evidence_json: string; immutable_hash: string };
  expect(JSON.parse(initiation.request_json)).toEqual({ episodeId: 'episode', executionId: 'promotion-execution', playerId: 'p1',
    personSourceId: 'intake-p1', appraisalSourceId: 'appraisal', policySourceId: 'learning-policies' });
  expect(JSON.parse(initiation.initial_json).catalyst.family).toBe('PROMOTION_DEMOTION');
  expect(JSON.parse(initiation.initial_json).catalyst).not.toHaveProperty('motifId');
  expect(Object.keys(JSON.parse(practice.learning_evidence_json)).sort()).toEqual(['execution', 'genesis', 'initiation', 'link', 'opportunity', 'person', 'worldEvent']);
  const archived = JSON.stringify({ schema: 'practice-origin-legacy-baseline-v1', initiation, practice });
  f.reopen();
  expect(f.owner.settle(complete.attemptId)).toEqual(settled);
  const reopened = f.db.prepare('SELECT request_json, assessment_json, initial_json, current_json FROM world_development_initiations WHERE episode_id=?').get('episode');
  expect(reopened).toEqual(initiation);
  // The bounded pre-production gate captures this exact line as an immutable
  // artifact. Later GREEN must compare these retained bytes, not recapture them.
  console.info(`PRACTICE_ORIGIN_LEGACY_BASELINE ${archived}`);
});
