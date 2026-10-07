import { afterEach, expect, it } from 'vitest';
import { practiceOriginBehaviorFixture } from './PracticeOriginDevelopmentBehavior.test-support';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });

it('records only a genuinely later practice after a separately accepted hypothesis and preserves its origin across reopen', () => {
  const f = practiceOriginBehaviorFixture(cleanup), initial = f.episodes.applyPractice(f.packet.request);
  const origin = f.base.owner.read(f.origin.completed.attemptId), receipt = f.origin.receipt;
  const hypothesis = { eventId: 'fixture-accepted-hypothesis', sourceEventId: 'fixture-accepted-hypothesis',
    kind: 'HYPOTHESIS_FORMED' as const, atDay: 13, domain: 'TECHNICAL' as const };
  f.learningEvents.set(hypothesis.sourceEventId, hypothesis);
  const target = f.episodes.advance(initial.episode.episodeId, hypothesis.sourceEventId, initial.episode.revision);
  expect(target.stage).toBe('HYPOTHESIS');
  const later = f.completeLater();
  expect(later.priorClock).toMatchObject({ attemptId: f.origin.completed.attemptId, completionHash: f.origin.completed.completionReference!.hash });
  expect(later.opportunity.episode).toEqual({ episodeId: initial.episode.episodeId, revision: target.revision, domain: 'TECHNICAL' });
  const settled = f.practice.settle(later.attemptId);
  expect(settled.kind).toBe('complete');
  if (settled.kind !== 'complete') throw new Error('later genuine practice did not settle');
  expect(settled.episode!.stage).toBe('PRACTICING');
  expect(settled.episode!.practiceSourceEventIds).toEqual([settled.activity.sourceEventId]);
  expect(settled.episode!.events.map(e => e.kind)).toEqual(['CATALYST', 'APPRAISAL_ENGAGED', 'HYPOTHESIS_FORMED', 'PRACTICE_RECORDED']);
  expect(settled.episode!.feedbackSourceEventIds).toEqual([]);
  expect(f.base.count('world_player_workload_activities')).toBe(2);
  expect(f.base.count('world_roster_executions')).toBe(0);
  expect(f.base.owner.read(f.origin.completed.attemptId)).toEqual(origin);
  expect(f.base.sources.workload.readActivity(f.origin.result.activity.sourceEventId)).toEqual(receipt);
  expect(f.base.sources.timing.readHead('career-a', 'p1')).toEqual(f.origin.completed.frame.timing);
  const savedEpisode = f.episodes.read(initial.episode.episodeId), savedLater = f.practice.read(later.attemptId);
  const bytes = f.developmentSnapshot(), workload = f.base.snapshot('world_player_workload_activities');
  f.appraisals.clear(); f.policies.clear(); f.learningEvents.clear(); f.opportunities.clear(); f.assessments.clear(); f.reopen();
  expect(f.episodes.read(initial.episode.episodeId)).toEqual(savedEpisode);
  expect(f.episodes.applyPractice(f.packet.request)).toEqual(savedEpisode);
  expect(f.practice.read(later.attemptId)).toEqual(savedLater);
  expect(f.practice.settle(later.attemptId)).toEqual(settled);
  expect(f.base.owner.read(f.origin.completed.attemptId)).toEqual(origin);
  expect(f.base.sources.workload.readActivity(f.origin.result.activity.sourceEventId)).toEqual(receipt);
  expect(f.developmentSnapshot()).toBe(bytes);
  expect(f.base.snapshot('world_player_workload_activities')).toBe(workload);
  f.base.db.exec("UPDATE pitch_practice_attempts SET frame_json=json_set(frame_json,'$.workload.fatigue',0.01) WHERE ordinal=0");
  expect(() => f.episodes.read(initial.episode.episodeId)).toThrow(/practice|frame|source|evidence|corrupt|differ/i);
  expect(() => f.practice.settle(later.attemptId)).toThrow(/practice|frame|source|evidence|corrupt|differ/i);
});
