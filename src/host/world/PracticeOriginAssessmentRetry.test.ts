import { afterEach, expect, it } from 'vitest';
import { practiceOriginBehaviorFixture } from './PracticeOriginDevelopmentBehavior.test-support';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });

for (const mutation of ['deleted', 'tampered'] as const) {
  it.each(['live', 'reopened'] as const)(`rejects %s saved-assessment retry after its accepted origin is ${mutation}`, mode => {
    const f = practiceOriginBehaviorFixture(cleanup), initiation = f.episodes.applyPractice(f.packet.request);
    const hypothesis = { eventId: 'fixture-assessment-origin-hypothesis', sourceEventId: 'fixture-assessment-origin-hypothesis',
      kind: 'HYPOTHESIS_FORMED' as const, atDay: 13, domain: 'TECHNICAL' as const };
    f.learningEvents.set(hypothesis.sourceEventId, hypothesis);
    expect(f.episodes.advance(initiation.episode.episodeId, hypothesis.sourceEventId, initiation.episode.revision).stage).toBe('HYPOTHESIS');
    const later = f.completeLater();
    expect(f.practice.settle(later.attemptId).kind).toBe('complete');
    expect(f.practice.acceptAssessment(later.assessment!.sourceId)).toEqual(later);
    const original = f.base.owner.read(f.origin.completed.attemptId), physical = f.base.snapshot('pitch_practice_attempts');
    const workload = f.base.snapshot('world_player_workload_activities');
    if (mutation === 'deleted') f.base.db.prepare('DELETE FROM world_development_practice_origins WHERE episode_id=?').run(initiation.episode.episodeId);
    else f.base.db.prepare("UPDATE world_development_practice_origins SET origin_json=json_set(origin_json,'$.appraisal.discovery.motifId','tampered-motif') WHERE episode_id=?")
      .run(initiation.episode.episodeId);
    if (mode === 'reopened') {
      f.appraisals.clear(); f.policies.clear(); f.learningEvents.clear(); f.opportunities.clear(); f.assessments.clear(); f.reopen();
    }
    expect(() => f.episodes.read(initiation.episode.episodeId)).toThrow(/origin|source|corrupt|binding/i);
    expect(() => f.practice.read(later.attemptId)).toThrow(/origin|source|corrupt|binding/i);
    expect(f.base.owner.read(f.origin.completed.attemptId)).toEqual(original);
    expect(f.base.sources.workload.readActivity(f.origin.result.activity.sourceEventId)).toEqual(f.origin.receipt);
    expect(() => f.practice.acceptAssessment(later.assessment!.sourceId)).toThrow(/origin|source|corrupt|binding|evidence/i);
    expect(f.base.snapshot('pitch_practice_attempts')).toBe(physical);
    expect(f.base.snapshot('world_player_workload_activities')).toBe(workload);
  });
}
