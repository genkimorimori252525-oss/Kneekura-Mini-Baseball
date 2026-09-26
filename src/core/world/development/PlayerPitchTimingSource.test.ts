import { expect, it } from 'vitest';
import { resolvePitchMotionTimeline } from '../../sim/pitch/PitchMotionTimeline';
import type { PitchTimingProfile } from '../../sim/pitch/PitchTimingModel';
import { applyRosterChange } from '../roster/RosterCommands';
import { createRosterState } from '../roster/RosterState';
import { rosterFixture } from '../roster/RosterTestFixtures';
import { appendDevelopmentLearningEvent,
  startDevelopmentLearningEpisode,
  type DevelopmentLearningEventKind } from './DevelopmentLearningEpisode';
import { applyConsolidatedPitchTimingEvidence,
  createPlayerPitchTimingSource,
  selectPlayerPitchTimingProfile } from './PlayerPitchTimingSource';

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

const episode = (complete: boolean) => {
  const before = createRosterState(rosterFixture());
  const change = applyRosterChange(before, { commandId: 'promote-1',
    causeEventId: 'selection-1', expectedRevision: 0,
    effectiveDay: 10, changes: [{ playerId: 'p2',
      assignment: { clubId: 'a', unitId: 'a-first' } }],
  });
  if (!change.ok) throw new Error(JSON.stringify(change.rejection));
  let current = startDevelopmentLearningEpisode('learning-1', before,
    change.state, change.event, 'p2', {
      careerId: before.careerId, playerId: 'p2', createdAtDay: 1,
      profileVersion: 'catalyst-v1',
    }, { policyId: 'learning-policy', version: 'v1',
      availableAtDay: 10, minimumPracticeEvents: 3,
      minimumFeedbackEvents: 1, minimumElapsedDays: 5 });
  const events = [
    { kind: 'APPRAISAL_ENGAGED', atDay: 10 },
    { kind: 'HYPOTHESIS_FORMED', atDay: 11 },
    { kind: 'PRACTICE_RECORDED', atDay: 12 },
    { kind: 'PRACTICE_RECORDED', atDay: 13 },
    { kind: 'PRACTICE_RECORDED', atDay: 14 },
    { kind: 'FEEDBACK_RECORDED', atDay: 14 },
    ...(complete ? [{ kind: 'CONSOLIDATION_RECORDED', atDay: 15 }] : []),
  ] as const;
  for (const [index, input] of events.entries()) {
    current = appendDevelopmentLearningEvent(current, current.revision, {
      eventId: `learning-event-${index}`,
      sourceEventId: `source-${index}`, atDay: input.atDay,
      kind: input.kind as DevelopmentLearningEventKind,
      ...(['HYPOTHESIS_FORMED', 'PRACTICE_RECORDED',
        'FEEDBACK_RECORDED', 'CONSOLIDATION_RECORDED'].includes(input.kind)
        ? { domain: 'TECHNICAL' as const } : {}),
    });
  }
  return current;
};

const evidence = (quickDurationUs = 300_000) => [2, 3, 4].map((index) => ({
  practiceSourceEventId: `source-${index}`,
  normalMotionToReleaseUs: 600_000,
  quickMotionToReleaseUs: quickDurationUs,
}));

const motion = (timingProfile: PitchTimingProfile) => resolvePitchMotionTimeline({
  readyAtUs: 0, profile: timingProfile,
  timingIntent: { deliveryMode: 'QUICK', cadenceIntent: 'STANDARD' },
  variation: { outingBiasUs: 0, pitchJitterUs: 0,
    naturalDeviationUs: 0 }, deliberateExtraHoldUs: 0,
}).motionToReleaseUs;

it('changes the Match timing source only after consolidation and measured repetitions', () => {
  const initial = createPlayerPitchTimingSource({
    careerId: episode(false).careerId, playerId: 'p2',
    createdAtDay: 1, profile,
  });
  expect(motion(initial.profile)).toBe(400_000);
  expect(() => applyConsolidatedPitchTimingEvidence(initial,
    0, episode(false), evidence())).toThrow('consolidated');
  expect(motion(initial.profile)).toBe(400_000);

  const changed = applyConsolidatedPitchTimingEvidence(initial,
    0, episode(true), evidence());
  expect(changed.profile.quickSpeedFactor).toBe(2);
  expect(motion(selectPlayerPitchTimingProfile(changed,
    'p2', 15))).toBe(300_000);
  expect(changed.profile.normalMotionToReleaseUs).toBe(600_000);
  expect(changed.profile.quickRepeatability).toBe(0.7);
  expect(changed.records[0]).toMatchObject({ episodeId: 'learning-1',
    beforeQuickSpeedFactor: 1.5, afterQuickSpeedFactor: 2,
    practiceSourceEventIds: ['source-2', 'source-3', 'source-4'],
    consolidationSourceEventId: 'source-6' });
  expect(Object.isFrozen(changed.profile)).toBe(true);
  expect(Object.isFrozen(changed.records)).toBe(true);
  expect(motion(initial.profile)).toBe(400_000);
  expect(() => selectPlayerPitchTimingProfile(changed,
    'other-player', 15)).toThrow('player');
  expect(() => selectPlayerPitchTimingProfile(changed,
    'p2', 14)).toThrow('day');
});

it('allows measured decline and same-value consolidation without an invented gain', () => {
  const initial = createPlayerPitchTimingSource({
    careerId: episode(true).careerId, playerId: 'p2',
    createdAtDay: 1, profile,
  });
  const declined = applyConsolidatedPitchTimingEvidence(initial,
    0, episode(true), evidence(500_000));
  expect(declined.profile.quickSpeedFactor).toBe(1.2);
  expect(motion(declined.profile)).toBe(500_000);
  const unchanged = applyConsolidatedPitchTimingEvidence(initial,
    0, episode(true), evidence(400_000));
  expect(unchanged.profile.quickSpeedFactor).toBe(1.5);
  expect(unchanged.records[0].changeKind).toBe('NO_SOURCE_CHANGE');
});

it('keeps the measured normal and quick delivery on the same source scale', () => {
  const learned = episode(true);
  const initial = createPlayerPitchTimingSource({
    careerId: learned.careerId, playerId: 'p2',
    createdAtDay: 1, profile,
  });
  const changed = applyConsolidatedPitchTimingEvidence(initial,
    0, learned, evidence(325_000).map((item) => ({ ...item,
      normalMotionToReleaseUs: 650_000 })));
  expect(changed.profile.normalMotionToReleaseUs).toBe(650_000);
  expect(changed.profile.quickSpeedFactor).toBe(2);
  expect(motion(changed.profile)).toBe(325_000);
  expect(changed.records[0]).toMatchObject({
    beforeNormalMotionToReleaseUs: 600_000,
    afterNormalMotionToReleaseUs: 650_000,
  });
});

it('rejects stale, duplicate, unrelated and uncalibrated evidence', () => {
  const initial = createPlayerPitchTimingSource({
    careerId: episode(true).careerId, playerId: 'p2',
    createdAtDay: 1, profile,
  });
  const learned = episode(true);
  const changed = applyConsolidatedPitchTimingEvidence(initial,
    0, learned, evidence());
  expect(() => applyConsolidatedPitchTimingEvidence(changed,
    0, learned, evidence())).toThrow('stale');
  expect(() => applyConsolidatedPitchTimingEvidence(changed,
    1, learned, evidence())).toThrow('already applied');
  expect(() => applyConsolidatedPitchTimingEvidence(initial,
    0, learned, evidence().slice(0, 2))).toThrow('practice');
  expect(() => applyConsolidatedPitchTimingEvidence(initial,
    0, learned, [{ ...evidence()[0],
      practiceSourceEventId: 'unrelated' }, ...evidence().slice(1)]))
    .toThrow('practice');
  expect(() => applyConsolidatedPitchTimingEvidence(initial,
    0, learned, evidence(100_000))).toThrow('range');
  expect(() => applyConsolidatedPitchTimingEvidence(initial,
    0, learned, evidence(Number.NaN))).toThrow('duration');
  expect(() => applyConsolidatedPitchTimingEvidence({ ...initial,
    playerId: 'someone-else' }, 0, learned, evidence())).toThrow('scope');
});
