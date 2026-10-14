import { afterEach, expect, it } from 'vitest';
import { practiceOriginBehaviorFixture } from './PracticeOriginDevelopmentBehavior.test-support';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });

for (const mutation of ['deleted', 'tampered'] as const) {
  it.each(['direct-read', 'begin-retry', 'reopened-read', 'reopened-begin'] as const)
    (`rejects %s of a later practice with its ${mutation} accepted origin while preserving the original physical attempt`, mode => {
      const f = practiceOriginBehaviorFixture(cleanup), initiation = f.episodes.applyPractice(f.packet.request);
      expect(initiation.episode.stage).toBe('ENGAGED');
      const hypothesis = { eventId: 'fixture-direct-read-hypothesis', sourceEventId: 'fixture-direct-read-hypothesis',
        kind: 'HYPOTHESIS_FORMED' as const, atDay: 13, domain: 'TECHNICAL' as const };
      f.learningEvents.set(hypothesis.sourceEventId, hypothesis);
      expect(f.episodes.advance(initiation.episode.episodeId, hypothesis.sourceEventId, initiation.episode.revision).stage).toBe('HYPOTHESIS');
      const later = f.completeLater(), result = f.practice.settle(later.attemptId);
      expect(result.kind).toBe('complete');
      if (result.kind !== 'complete') throw new Error('genuine later-practice prerequisite did not settle');
      expect(result.episode!.stage).toBe('PRACTICING');
      expect(result.episode!.practiceSourceEventIds).toEqual([result.activity.sourceEventId]);
      expect(f.practice.read(later.attemptId)).toEqual(later);
      expect(f.practice.begin(later.opportunity.sourceId)).toEqual(later);
      const original = f.base.owner.read(f.origin.completed.attemptId), receipt = f.origin.receipt;
      const physicalRows = f.base.snapshot('pitch_practice_attempts'), workloads = f.base.snapshot('world_player_workload_activities');
      expect(f.base.count('world_development_practice_origins')).toBe(1);
      if (mutation === 'deleted') f.base.db.prepare('DELETE FROM world_development_practice_origins WHERE episode_id=?').run(initiation.episode.episodeId);
      else f.base.db.prepare("UPDATE world_development_practice_origins SET origin_json=json_set(origin_json,'$.appraisal.discovery.motifId','tampered-motif') WHERE episode_id=?")
        .run(initiation.episode.episodeId);
      if (mode.startsWith('reopened')) {
        f.appraisals.clear(); f.policies.clear(); f.learningEvents.clear(); f.opportunities.clear(); f.assessments.clear();
        f.reopen();
      }
      // The psychological-origin proof is corrupt, while its earlier physical
      // cause remains valid and must not depend on the later discovery record.
      expect(() => f.episodes.read(initiation.episode.episodeId)).toThrow(/origin|source|corrupt|binding/i);
      expect(f.base.owner.read(f.origin.completed.attemptId)).toEqual(original);
      expect(f.base.sources.workload.readActivity(f.origin.result.activity.sourceEventId)).toEqual(receipt);
      expect(f.base.snapshot('pitch_practice_attempts')).toBe(physicalRows);
      expect(f.base.snapshot('world_player_workload_activities')).toBe(workloads);
      expect(() => {
        if (mode.endsWith('begin') || mode === 'begin-retry') f.practice.begin(later.opportunity.sourceId);
        else f.practice.read(later.attemptId);
      }).toThrow(/origin|source|corrupt|binding|evidence/i);
      expect(f.base.snapshot('pitch_practice_attempts')).toBe(physicalRows);
      expect(f.base.snapshot('world_player_workload_activities')).toBe(workloads);
    });
}
