import { expect, it } from 'vitest';
import type { PitchTimingProfile } from '../../sim/pitch/PitchTimingModel';
import { applyRosterChange } from '../roster/RosterCommands';
import { createRosterState } from '../roster/RosterState';
import { rosterFixture } from '../roster/RosterTestFixtures';
import { appendDevelopmentLearningEvent,
  startDevelopmentLearningEpisode } from './DevelopmentLearningEpisode';
import { practiceBundleForEpisode } from './DevelopmentPracticeExposure.test-support';
import { derivePitchTimingDevelopmentHistory } from './PlayerDevelopmentHistory';
import { applyConsolidatedPitchTimingEvidence,
  createPlayerPitchTimingSource } from './PlayerPitchTimingSource';

const profile: PitchTimingProfile = {
  baseStartIntervalUs: 10_000_000,
  normalMotionToReleaseUs: 600_000,
  followThroughUs: 200_000,
  quickSpeedFactor: 1.5,
  cadenceExecutionControl: 0.8,
  cadenceTimingKnowledge: 0.8,
  quickRepeatability: 0.7,
  naturalVariationUs: 50_000,
  normalPhaseWeights: { gather: 2, transition: 3, stride: 5 },
  quickPhaseWeights: { gather: 1, transition: 2, stride: 3 },
};

const scenario = (quickMotionToReleaseUs: number) => {
  const before = createRosterState(rosterFixture());
  const promotion = applyRosterChange(before, { commandId: 'promote-1',
    causeEventId: 'selection-1', expectedRevision: 0,
    effectiveDay: 10, changes: [{ playerId: 'p2',
      assignment: { clubId: 'a', unitId: 'a-first' } }],
  });
  if (!promotion.ok) throw new Error(JSON.stringify(promotion.rejection));
  let episode = startDevelopmentLearningEpisode('learning-1', before,
    promotion.state, promotion.event, 'p2', {
      careerId: before.careerId, playerId: 'p2', createdAtDay: 1,
      profileVersion: 'catalyst-v1',
    }, { policyId: 'learning-policy', version: 'v1',
      availableAtDay: 10, minimumPracticeEvents: 2,
      minimumFeedbackEvents: 1, minimumElapsedDays: 5 });
  const events = [
    ['APPRAISAL_ENGAGED', 10], ['HYPOTHESIS_FORMED', 11],
    ['PRACTICE_RECORDED', 12], ['PRACTICE_RECORDED', 13],
    ['FEEDBACK_RECORDED', 14], ['CONSOLIDATION_RECORDED', 15],
  ] as const;
  for (const [index, [kind, atDay]] of events.entries()) {
    episode = appendDevelopmentLearningEvent(episode,
      episode.revision, { eventId: `learning-event-${index}`,
        sourceEventId: `source-${index}`, atDay, kind,
        ...(index >= 1 ? { domain: 'TECHNICAL' as const } : {}) });
  }
  const source = createPlayerPitchTimingSource({ careerId: before.careerId,
    playerId: 'p2', createdAtDay: 1, profile });
  const changed = applyConsolidatedPitchTimingEvidence(source,
    0, episode, [2, 3].map((index) => ({
      practiceSourceEventId: `source-${index}`,
      normalMotionToReleaseUs: 600_000,
      quickMotionToReleaseUs,
    })), practiceBundleForEpisode(episode));
  return { episode, changed };
};

it('retains catalyst, learning and measured source change provenance in order', () => {
  const { episode, changed } = scenario(300_000);
  const history = derivePitchTimingDevelopmentHistory(changed, [episode]);
  expect(history.map((entry) => entry.kind)).toEqual([
    'CATALYST', 'HYPOTHESIS_FORMED', 'CONSOLIDATION_PROGRESS',
    'SOURCE_STATE_CHANGED',
  ]);
  expect(history[0].sourceEventIds).toEqual([episode.catalyst.sourceEventId]);
  expect(history[2].sourceEventIds).toEqual([
    'source-2', 'source-3', 'source-4', 'source-5',
  ]);
  expect(history[3]).toMatchObject({
    episodeId: 'learning-1', occurredAtDay: 15,
    sourceEventIds: ['source-2', 'source-3', 'source-4', 'source-5'],
    profileVersion: 'catalyst-v1',
  });
  expect(history[3]).not.toHaveProperty('ability');
  expect(Object.isFrozen(history)).toBe(true);
  expect(Object.isFrozen(history[3].sourceEventIds)).toBe(true);
});

it('records consolidation without claiming ability change when measurement is unchanged', () => {
  const { episode, changed } = scenario(400_000);
  expect(changed.records[0].changeKind).toBe('NO_SOURCE_CHANGE');
  expect(derivePitchTimingDevelopmentHistory(changed,
    [episode]).map((entry) => entry.kind)).toEqual([
    'CATALYST', 'HYPOTHESIS_FORMED', 'CONSOLIDATION_PROGRESS',
  ]);
});

it('rejects missing, duplicated or mismatched source histories', () => {
  const { episode, changed } = scenario(300_000);
  expect(() => derivePitchTimingDevelopmentHistory(changed,
    [])).toThrow('episode');
  expect(() => derivePitchTimingDevelopmentHistory(changed,
    [episode, episode])).toThrow('episode');
  expect(() => derivePitchTimingDevelopmentHistory(changed,
    [{ ...episode, playerId: 'other' }])).toThrow('scope');
  expect(() => derivePitchTimingDevelopmentHistory({ ...changed,
    records: [{ ...changed.records[0], afterQuickSpeedFactor: 1.7 }] },
    [episode])).toThrow('source');
});
