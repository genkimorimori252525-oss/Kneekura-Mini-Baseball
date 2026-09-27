import { describe, expect, it } from 'vitest';
import type { PitchTimingProfile } from '../../sim/pitch/PitchTimingModel';
import { applyRosterChange } from '../roster/RosterCommands';
import { createRosterState } from '../roster/RosterState';
import { rosterFixture } from '../roster/RosterTestFixtures';
import { appendDevelopmentLearningEvent,
  startDevelopmentLearningEpisode } from './DevelopmentLearningEpisode';
import { practiceBundleForEpisode } from './DevelopmentPracticeExposure.test-support';
import { applyConsolidatedPitchTimingEvidence,
  createPlayerPitchTimingSource } from './PlayerPitchTimingSource';
import { derivePitchTimingBreakthroughs,
  type PitchTimingBreakthroughInput } from './PitchTimingBreakthrough';

const profile: PitchTimingProfile = {
  baseStartIntervalUs: 10_000_000, normalMotionToReleaseUs: 600_000,
  followThroughUs: 200_000, quickSpeedFactor: 1.5,
  cadenceExecutionControl: 0.8, cadenceTimingKnowledge: 0.8,
  quickRepeatability: 0.7, naturalVariationUs: 50_000,
  normalPhaseWeights: { gather: 2, transition: 3, stride: 5 },
  quickPhaseWeights: { gather: 1, transition: 2, stride: 3 },
};
const scenario = (quickDurationUs = 300_000) => {
  const before = createRosterState(rosterFixture());
  const promotion = applyRosterChange(before, { commandId: 'promote-1',
    causeEventId: 'selection-1', expectedRevision: 0, effectiveDay: 10,
    changes: [{ playerId: 'p2', assignment: { clubId: 'a', unitId: 'a-first' } }],
  });
  if (!promotion.ok) throw new Error(JSON.stringify(promotion.rejection));
  let episode = startDevelopmentLearningEpisode('learning-1', before,
    promotion.state, promotion.event, 'p2', {
      careerId: before.careerId, playerId: 'p2', createdAtDay: 1,
      profileVersion: 'catalyst-v1',
    }, { policyId: 'learning', version: 'v1', availableAtDay: 10,
      minimumPracticeEvents: 2, minimumFeedbackEvents: 1,
      minimumElapsedDays: 5 });
  const events = [
    ['APPRAISAL_ENGAGED', 10], ['HYPOTHESIS_FORMED', 11],
    ['PRACTICE_RECORDED', 12], ['PRACTICE_RECORDED', 13],
    ['FEEDBACK_RECORDED', 14], ['CONSOLIDATION_RECORDED', 15],
  ] as const;
  for (const [index, [kind, atDay]] of events.entries()) {
    episode = appendDevelopmentLearningEvent(episode, episode.revision, {
      eventId: `learning-event-${index}`,
      sourceEventId: `source-${index}`, atDay, kind,
      ...(index >= 1 ? { domain: 'TECHNICAL' as const } : {}),
    });
  }
  const initial = createPlayerPitchTimingSource({
    careerId: before.careerId, playerId: 'p2', createdAtDay: 1, profile,
  });
  const source = applyConsolidatedPitchTimingEvidence(initial, 0,
    episode, [2, 3].map(index => ({
      practiceSourceEventId: `source-${index}`,
      normalMotionToReleaseUs: 600_000,
      quickMotionToReleaseUs: quickDurationUs,
    })), practiceBundleForEpisode(episode));
  return { episode, source };
};
const request = (quickDurationUs = 300_000): PitchTimingBreakthroughInput => {
  const { episode, source } = scenario(quickDurationUs);
  return { source, episodes: [episode], asOfDay: 130,
    policy: { policyId: 'major-quick-timing', version: 'v1',
      effectiveDay: 1, minimumSourceGain: 0.3,
      minimumDeviationAboveExpected: 0.3,
      minimumPersistenceDays: 90, minimumCheckpoints: 2 },
    checkpoints: [
      { checkpointId: 'check-1', episodeId: episode.episodeId,
        atDay: 20, sourceRevision: 1, actualQuickSpeedFactor: source.profile.quickSpeedFactor,
        expectedQuickSpeedFactor: 1.6, trajectorySourceId: 'expected-1',
        trajectoryVersion: 'trajectory-v1' },
      { checkpointId: 'check-2', episodeId: episode.episodeId,
        atDay: 120, sourceRevision: 1, actualQuickSpeedFactor: source.profile.quickSpeedFactor,
        expectedQuickSpeedFactor: 1.65, trajectorySourceId: 'expected-2',
        trajectoryVersion: 'trajectory-v1' },
    ] };
};

describe('derivePitchTimingBreakthroughs', () => {
  it('derives a Career event only from persistent measured technical growth', () => {
    const input = request();
    const result = derivePitchTimingBreakthroughs(input);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      eventId: 'learning-1:major-pitch-timing-breakthrough:major-quick-timing:v1',
      episodeId: 'learning-1', kind: 'MAJOR_BREAKTHROUGH',
      occurredAtDay: 120, domain: 'TECHNICAL',
      policyId: 'major-quick-timing', policyVersion: 'v1',
      profileVersion: 'catalyst-v1',
      sourceEventIds: [input.episodes[0]!.catalyst.sourceEventId,
        'source-1', 'source-2', 'source-3',
        'source-4', 'source-5', 'check-1', 'expected-1',
        'check-2', 'expected-2'],
    });
    expect(result[0]).not.toHaveProperty('ability');
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('does not derive from one good month or unchanged source state', () => {
    const one = request();
    expect(derivePitchTimingBreakthroughs({ ...one,
      checkpoints: [one.checkpoints[0]!] })).toEqual([]);
    const hotMonth = { ...one, checkpoints: [one.checkpoints[0]!,
      { ...one.checkpoints[1]!, atDay: 40 }] };
    expect(derivePitchTimingBreakthroughs(hotMonth)).toEqual([]);
    const unchanged = request(400_000);
    expect(derivePitchTimingBreakthroughs(unchanged)).toEqual([]);
  });

  it('does not derive when actual growth follows expected trajectory', () => {
    const base = request();
    const checkpoints = base.checkpoints.map(c => ({ ...c,
      expectedQuickSpeedFactor: 1.8 }));
    expect(derivePitchTimingBreakthroughs({ ...base, checkpoints }))
      .toEqual([]);
  });

  it('rejects fabricated source snapshots and broken causal links', () => {
    const base = request();
    expect(() => derivePitchTimingBreakthroughs({ ...base,
      checkpoints: [{ ...base.checkpoints[0]!, actualQuickSpeedFactor: 2.2 },
        base.checkpoints[1]!] })).toThrow();
    expect(() => derivePitchTimingBreakthroughs({ ...base,
      episodes: [{ ...base.episodes[0]!, playerId: 'other' }] })).toThrow();
    expect(() => derivePitchTimingBreakthroughs({ ...base,
      source: { ...base.source, records: [{ ...base.source.records[0]!,
        consolidationSourceEventId: 'invented' }] } })).toThrow();
  });
});
