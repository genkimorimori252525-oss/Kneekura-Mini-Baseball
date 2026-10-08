import { afterEach, expect, it } from 'vitest';
import { acceptedPracticeDiscoveryFixture, assertPracticeOriginPrerequisite, practiceOriginFixture } from './PracticeOriginDevelopment.test-support';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });

// Admit only after the separately selected prerequisite has passed. This initial
// RED proves a missing public entry, not discovery detection or consumer behavior.
it('exposes practice-origin initiation after authentic physical and workload prerequisites', () => {
  const f = practiceOriginFixture(cleanup);
  const { completed, result } = assertPracticeOriginPrerequisite(f);
  const accepted = acceptedPracticeDiscoveryFixture(completed);
  expect(accepted.appraisal.discovery.completionReference).toEqual(completed.completionReference);
  expect(accepted.appraisal.discovery.sourceEventId).not.toBe(accepted.appraisal.appraisal.sourceEventId);
  expect(accepted.appraisal.discovery.sourceEventId).not.toBe(result.activity.sourceEventId);
  expect(accepted.request).not.toHaveProperty('executionId');
  expect(f.sources.episodes.read(accepted.request.episodeId)).toBeNull();
  expect(f.count('world_development_initiations')).toBe(0);
  expect(Reflect.get(f.sources.episodes, 'applyPractice'),
    'missing public applyPractice entry after genuine null-episode completion, assessment, workload settlement and reopen').toBeTypeOf('function');
});
