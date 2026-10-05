import { afterEach, expect, it } from 'vitest';
import { applyPitchFatigueToExecution } from '../../core/sim/pitch/PitchFatigueExecution';
import { resolveCanonicalPitchDelivery } from '../../core/sim/pitch/CanonicalPitchDelivery';
import { SeedRoot } from '../../core/rng/SeedRoot';
import { appendDevelopmentLearningEvent, startDevelopmentLearningEpisode } from '../../core/world/development/DevelopmentLearningEpisode';
import { practiceBundleForEpisode } from '../../core/world/development/DevelopmentPracticeExposure.test-support';
import { practiceFixture, type PracticeOpportunity } from './PitchPracticeAttempt.test-support';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
const fixture = () => practiceFixture(cleanup);

it('opens a real practice producer without a Match and keeps planned motion unconsumed', async () => {
  const f = await fixture(), begun = f.owner.begin(f.opportunity.sourceId);
  expect(begun.status).toBe('IN_PROGRESS');
  expect(begun.events).toEqual([]);
  expect(begun.observation).toBeNull();
  expect(begun.completionReference).toBeNull();
  expect(f.owner.begin(f.opportunity.sourceId)).toEqual(begun);
  expect(f.count('pitch_practice_attempts')).toBe(1);
  expect(begun.frame.workload.revision).toBe(0);
  expect(begun.frame.personLink).toMatchObject({ sourceId: 'intake-p1', playerId: 'p1', personId: 'person-p1' });
  expect(begun.frame.person).toMatchObject({ playerId: 'p1', personId: 'person-p1' });
  expect(f.owner.settle(begun.attemptId)).toMatchObject({ kind: 'pending' });
  expect(f.count('world_player_workload_activities')).toBe(0);
  expect(f.sources.episodes.read('episode')!.episode.practiceSourceEventIds).toEqual([]);
  expect(f.db.prepare("SELECT name FROM sqlite_master WHERE name IN ('matches','official_fixtures','physical_pitch_progress_actions')").all()).toEqual([]);
});

it('executes the existing body/timing/fatigue model and observes release only after consuming it', async () => {
  const f = await fixture(), begun = f.owner.begin(f.opportunity.sourceId);
  const { sourceId: _id, sourceVersion: _version, ...policy } = begun.frame.policy;
  const execution = applyPitchFatigueToExecution(begun.frame.timing.profile, f.opportunity.physics,
    begun.frame.workload.fatigue, policy, f.opportunity.atDay);
  const expected = resolveCanonicalPitchDelivery({ root: new SeedRoot(f.opportunity.practiceSeed),
    outingId: `practice:${f.opportunity.opportunityId}`, playId: f.opportunity.ordinal, pitchIndex: f.opportunity.ordinal,
    readyAtUs: f.opportunity.readyAtUs, timingIntent: f.opportunity.timingIntent, timingProfile: execution.timingProfile,
    body: { ...begun.frame.release.body, moundReference: f.opportunity.moundReference },
    releaseProfile: begun.frame.release.profile, physics: execution.physics });
  expect(begun.plannedDelivery).toEqual(expected);
  const beforeRelease = f.owner.advance(begun.attemptId, begun.revision, expected.timeline.releaseUs - 1);
  expect(f.owner.advance(begun.attemptId, begun.revision, expected.timeline.releaseUs - 1)).toEqual(beforeRelease);
  expect(beforeRelease.events.map(event => event.kind)).toEqual(['motion_started', 'gather_ended', 'stride_started']);
  expect(beforeRelease.observation).toBeNull();
  expect(beforeRelease.completionReference).toBeNull();
  const released = f.owner.advance(begun.attemptId, beforeRelease.revision, expected.timeline.releaseUs);
  expect(released.status).toBe('IN_PROGRESS');
  expect(released.events.at(-1)).toEqual({ kind: 'released', atUs: expected.timeline.releaseUs });
  expect(released.observation).toEqual({ kind: 'RAW_TIMING', deliveryMode: 'NORMAL',
    motionStartUs: expected.timeline.motionStartUs, releaseUs: expected.timeline.releaseUs,
    motionToReleaseUs: expected.timeline.releaseUs - expected.timeline.motionStartUs });
  expect(f.owner.settle(begun.attemptId)).toMatchObject({ kind: 'pending' });
  expect(f.count('world_player_workload_activities')).toBe(0);
  const complete = f.owner.advance(begun.attemptId, released.revision, expected.timeline.followThroughEndUs);
  expect(f.owner.advance(begun.attemptId, released.revision, expected.timeline.followThroughEndUs)).toEqual(complete);
  expect(complete.status).toBe('DELIVERY_COMPLETE');
  expect(complete.events.at(-1)).toEqual({ kind: 'follow_through_completed', atUs: expected.timeline.followThroughEndUs });
  expect(complete.completionReference).toMatchObject({ attemptId: begun.attemptId, revision: complete.revision });
  expect(complete.completionReference!.hash).toMatch(/^[a-f0-9]{64}$/);
  expect(complete).not.toHaveProperty('measurements');
});

it('requires a completion-bound assessment before charging exactly one practice and one eligible episode event', async () => {
  const f = await fixture(), timingBefore = f.sources.timing.readHead('career-a', 'p1'), releaseBefore = f.sources.release.readHead('career-a', 'p1');
  const complete = f.complete();
  expect(f.owner.settle(complete.attemptId)).toMatchObject({ kind: 'pending' });
  expect(f.count('world_player_workload_activities')).toBe(0);
  const assessed = f.assess(complete);
  expect(f.assess(complete)).toEqual(assessed);
  const result = f.owner.settle(complete.attemptId);
  expect(result.kind).toBe('complete');
  if (result.kind !== 'complete') throw new Error('practice settlement did not complete');
  expect(result.activity).toMatchObject({ kind: 'PRACTICE', careerId: 'career-a', playerId: 'p1', atDay: 13, effortUnits: 1, healthAvailability: 0.9 });
  const saved = f.sources.workload.readActivity(result.activity.sourceEventId)!;
  expect(saved.before.fatigue).toBe(0.2);
  expect(saved.after.fatigue).toBeCloseTo(0.3);
  expect(result.episode).toMatchObject({ stage: 'PRACTICING', practiceSourceEventIds: [result.activity.sourceEventId] });
  expect(result.episode!.feedbackSourceEventIds).toEqual([]);
  expect(result.episode!.events.at(-1)).toMatchObject({ sourceEventId: result.activity.sourceEventId, kind: 'PRACTICE_RECORDED', domain: 'TECHNICAL' });
  expect(f.owner.settle(complete.attemptId)).toEqual(result);
  expect(f.count('world_player_workload_activities')).toBe(1);
  expect(f.sources.timing.readHead('career-a', 'p1')).toEqual(timingBefore);
  expect(f.sources.release.readHead('career-a', 'p1')).toEqual(releaseBefore);
});

it.each(['missing', 'foreign_player', 'foreign_person', 'workload_revision', 'timing_revision', 'release_revision', 'ordinal_gap', 'future_source'] as const)(
  'rejects prospective opportunity mismatch before creating an attempt: %s', async fault => {
    const f = await fixture(), invalid = structuredClone(f.opportunity);
    if (fault === 'foreign_player') invalid.playerId = 'other';
    if (fault === 'foreign_person') invalid.personLinkSourceId = 'other';
    if (fault === 'workload_revision') invalid.workloadRevision = 1;
    if (fault === 'timing_revision') invalid.timingRevision = 1;
    if (fault === 'release_revision') invalid.releaseRevision = 1;
    if (fault === 'ordinal_gap') invalid.ordinal = 2;
    if (fault === 'future_source') invalid.atDay = 9;
    if (fault === 'missing') f.opportunities.clear(); else f.opportunities.set(invalid.sourceId, invalid);
    expect(() => f.owner.begin(invalid.sourceId)).toThrow(/practice|scope|Player|Person|revision|ordinal|future|policy|opportunity/);
    expect(f.count('pitch_practice_attempts')).toBe(0);
    expect(f.count('world_player_workload_activities')).toBe(0);
    expect(f.sources.episodes.read('episode')!.episode.practiceSourceEventIds).toEqual([]);
  });

it('rejects source aliases and altered opportunity input without amplifying repetitions', async () => {
  const f = await fixture(), begun = f.owner.begin(f.opportunity.sourceId);
  f.opportunities.set('alias', { ...f.opportunity, sourceId: 'alias' });
  expect(() => f.owner.begin('alias')).toThrow(/alias|identity|frozen|already|ordinal/);
  f.opportunities.set(f.opportunity.sourceId, { ...f.opportunity, practiceSeed: f.opportunity.practiceSeed + 1 });
  expect(() => f.owner.begin(f.opportunity.sourceId)).toThrow(/frozen|different|changed/);
  expect(f.owner.read(begun.attemptId)!.events).toEqual([]);
  expect(f.count('pitch_practice_attempts')).toBe(1);
});

it('does not admit another ordinal until its predecessor has consumed delivery and settled workload', async () => {
  const f = await fixture(), begun = f.owner.begin(f.opportunity.sourceId), next = f.nextOpportunity(begun);
  expect(() => f.owner.begin(next.sourceId)).toThrow(/prior|previous|pending|settle|complete/);
  const complete = f.owner.advance(begun.attemptId, begun.revision, begun.plannedDelivery.timeline.followThroughEndUs);
  expect(() => f.owner.begin(next.sourceId)).toThrow(/prior|previous|pending|settle|workload/);
  f.assess(complete); f.owner.settle(complete.attemptId);
  expect(() => f.owner.begin(next.sourceId)).toThrow(/stale|revision/);
  f.nextOpportunity(complete);
  const later = f.owner.begin(next.sourceId);
  expect(later.frame.workload.revision).toBe(1);
  expect(later.frame.workload.fatigue).toBeCloseTo(0.3);
  expect(later.plannedDelivery.timeline.motionToReleaseUs).toBeGreaterThan(begun.plannedDelivery.timeline.motionToReleaseUs);
});

it.each(['moving_same_day', 'moving_later_day', 'unsettled_same_day', 'unsettled_later_day'] as const)(
  'rejects a competing Player body owner under a different opportunity: %s', async condition => {
    const f = await fixture();
    const first = condition.startsWith('unsettled') ? f.complete() : f.owner.begin(f.opportunity.sourceId);
    const other: PracticeOpportunity = { ...f.opportunity, sourceId: 'other-opportunity-source', opportunityId: 'other-drill',
      ordinal: 0, previousAttemptId: null, workloadRevision: first.frame.workload.revision,
      atDay: condition.endsWith('later_day') ? f.opportunity.atDay + 1 : f.opportunity.atDay,
      readyAtUs: condition.endsWith('later_day') ? 0 : first.plannedDelivery.timeline.followThroughEndUs };
    f.opportunities.set(other.sourceId, other);
    expect(() => f.owner.begin(other.sourceId)).toThrow(/unfinished|active|pending|ownership|busy|settle|workload/);
    expect(f.count('pitch_practice_attempts')).toBe(1);
    expect(f.owner.read(first.attemptId)).toEqual(first);
    expect(f.owner.begin(f.opportunity.sourceId).attemptId).toBe(first.attemptId);
    expect(f.count('world_player_workload_activities')).toBe(0);
    expect(f.sources.episodes.read('episode')!.episode.practiceSourceEventIds).toEqual([]);
  });

it('shares the Player day clock across opportunity IDs and permits the exact completed boundary', async () => {
  const f = await fixture(), first = f.complete(); f.assess(first);
  const settled = f.owner.settle(first.attemptId);
  if (settled.kind !== 'complete') throw new Error('practice fixture settlement did not complete');
  const other: PracticeOpportunity = { ...f.opportunity, sourceId: 'next-drill-source', opportunityId: 'next-drill',
    ordinal: 0, previousAttemptId: null, readyAtUs: first.plannedDelivery.timeline.followThroughEndUs - 1,
    workloadRevision: f.sources.workload.readHead('career-a', 'p1')!.revision,
    episode: { episodeId: 'episode', domain: 'TECHNICAL', revision: f.sources.episodes.read('episode')!.episode.revision } };
  f.opportunities.set(other.sourceId, other);
  expect(() => f.owner.begin(other.sourceId)).toThrow(/clock|overlap|chronolog|time|prior/);
  expect(f.count('pitch_practice_attempts')).toBe(1);
  other.readyAtUs = first.plannedDelivery.timeline.followThroughEndUs;
  f.opportunities.set(other.sourceId, other);
  const second = f.owner.begin(other.sourceId);
  expect(second.opportunity.opportunityId).toBe('next-drill');
  expect(second.opportunity.ordinal).toBe(0);
  expect(second.throughUs).toBe(first.plannedDelivery.timeline.followThroughEndUs);
  expect(second.priorClock).toEqual({ attemptId: first.attemptId, atDay: f.opportunity.atDay,
    followThroughEndUs: first.plannedDelivery.timeline.followThroughEndUs,
    completionHash: first.completionReference!.hash, workloadActivityId: settled.activity.sourceEventId,
    workloadRevision: settled.workload.revision });
  expect(second.frame.workload.revision).toBe(1);
  expect(second.frame.workload.fatigue).toBeCloseTo(0.3);
  expect(second.events).toEqual([]);
  expect(f.count('pitch_practice_attempts')).toBe(2);
});

it('allows a later accepted day to use a new local clock without converting time or granting recovery', async () => {
  const f = await fixture(), first = f.complete(); f.assess(first); f.owner.settle(first.attemptId);
  const workload = f.sources.workload.readHead('career-a', 'p1')!;
  const later: PracticeOpportunity = { ...f.opportunity, sourceId: 'tomorrow-source', opportunityId: 'tomorrow-drill', ordinal: 0,
    previousAttemptId: null, atDay: f.opportunity.atDay + 1, readyAtUs: 0, workloadRevision: workload.revision,
    episode: null };
  f.opportunities.set(later.sourceId, later);
  const begun = f.owner.begin(later.sourceId);
  expect(begun.throughUs).toBe(0);
  expect(begun.plannedDelivery.timeline.readyAtUs).toBe(0);
  expect(begun.priorClock).toMatchObject({ attemptId: first.attemptId, atDay: f.opportunity.atDay,
    followThroughEndUs: first.plannedDelivery.timeline.followThroughEndUs, completionHash: first.completionReference!.hash });
  expect(begun.frame.workload).toEqual(workload);
  expect(f.sources.workload.readHead('career-a', 'p1')).toEqual(workload);
  expect(f.count('world_player_workload_activities')).toBe(1);
  expect(begun.events).toEqual([]);
});

it('reauthenticates the prior completed Player clock when reading a later opportunity', async () => {
  const f = await fixture(), first = f.complete(); f.assess(first); f.owner.settle(first.attemptId);
  const other: PracticeOpportunity = { ...f.opportunity, sourceId: 'later-clock-source', opportunityId: 'later-clock-drill', ordinal: 0,
    previousAttemptId: null, readyAtUs: first.plannedDelivery.timeline.followThroughEndUs,
    workloadRevision: f.sources.workload.readHead('career-a', 'p1')!.revision, episode: null };
  f.opportunities.set(other.sourceId, other);
  const second = f.owner.begin(other.sourceId), history = f.snapshot('world_player_workload_activities');
  expect(second.priorClock!.attemptId).toBe(first.attemptId);
  f.db.prepare("UPDATE pitch_practice_attempts SET frame_json=json_set(frame_json,'$.workload.fatigue',0.01) WHERE attempt_id=?").run(first.attemptId);
  expect(() => f.owner.read(second.attemptId)).toThrow(/practice|clock|prior|frame|source|workload|corrupt|evidence/i);
  expect(f.snapshot('world_player_workload_activities')).toBe(history);
});

it.each(['wrong_attempt', 'wrong_hash', 'negative_effort', 'invalid_health', 'missing_provenance'] as const)(
  'rejects malformed assessment without accepting a workload source: %s', async fault => {
    const f = await fixture(), complete = f.complete();
    const overrides = fault === 'wrong_attempt' ? { attemptId: 'foreign' } : fault === 'wrong_hash' ? { completionHash: '0'.repeat(64) }
      : fault === 'negative_effort' ? { effortUnits: -1 } : fault === 'invalid_health' ? { healthAvailability: 2 }
        : { provenance: { assessmentSourceId: '', assessmentVersion: 'v1', calibrationSourceId: '', calibrationVersion: 'v1' } };
    expect(() => f.assess(complete, overrides)).toThrow(/assessment|attempt|completion|hash|effort|health|provenance|source/i);
    expect(f.owner.read(complete.attemptId)!.assessment).toBeNull();
    expect(f.owner.settle(complete.attemptId)).toMatchObject({ kind: 'pending' });
    expect(f.count('world_player_workload_activities')).toBe(0);
  });

it('freezes accepted effort and health instead of accepting a changed assessment under the same identity', async () => {
  const f = await fixture(), complete = f.complete(), accepted = f.assess(complete);
  const original = accepted.assessment!;
  expect(() => f.assess(complete, { effortUnits: original.effortUnits + 1 })).toThrow(/frozen|different|changed|assessment/);
  expect(f.owner.read(complete.attemptId)!.assessment).toEqual(original);
  expect(f.count('world_player_workload_activities')).toBe(0);
  f.assessments.set(original.sourceId, original);
  expect(f.owner.settle(complete.attemptId).kind).toBe('complete');
  expect(f.count('world_player_workload_activities')).toBe(1);
});

it('keeps partial execution and exact original inputs across reopen without live opportunity input', async () => {
  const f = await fixture(), begun = f.owner.begin(f.opportunity.sourceId);
  const partial = f.owner.advance(begun.attemptId, begun.revision, begun.plannedDelivery.timeline.releaseUs - 1);
  f.opportunities.clear(); f.reopen();
  expect(f.owner.read(begun.attemptId)).toEqual(partial);
  expect(f.owner.settle(begun.attemptId)).toMatchObject({ kind: 'pending' });
  const complete = f.owner.advance(begun.attemptId, partial.revision, begun.plannedDelivery.timeline.followThroughEndUs);
  expect(complete.events).toHaveLength(5);
  expect(complete.frame).toEqual(begun.frame);
});

it('retries completed adoption after real later recovery without recapturing fatigue or duplicating effects', async () => {
  const f = await fixture(), complete = f.complete(); f.assess(complete);
  const result = f.owner.settle(complete.attemptId), frozen = f.owner.read(complete.attemptId);
  f.recordRecovery(); const current = f.sources.workload.readHead('career-a', 'p1');
  f.opportunities.clear(); f.assessments.clear(); f.reopen();
  expect(f.owner.read(complete.attemptId)).toEqual(frozen);
  expect(f.owner.settle(complete.attemptId)).toEqual(result);
  expect(f.sources.workload.readHead('career-a', 'p1')).toEqual(current);
  expect(f.count('world_player_workload_activities')).toBe(2);
  expect(f.sources.episodes.read('episode')!.episode.practiceSourceEventIds).toHaveLength(1);
});

it('reads and reopens a normal second attempt without cycling through its own episode guard', async () => {
  const f = await fixture(), first = f.complete(); f.assess(first);
  const firstResult = f.owner.settle(first.attemptId);
  if (firstResult.kind !== 'complete') throw new Error('first practice did not settle');
  const next = f.nextOpportunity(first), second = f.complete(next.sourceId); f.assess(second);
  const secondResult = f.owner.settle(second.attemptId);
  if (secondResult.kind !== 'complete') throw new Error('second practice did not settle');
  const episode = f.sources.episodes.read('episode')!.episode;
  expect(episode.practiceSourceEventIds).toEqual([firstResult.activity.sourceEventId, secondResult.activity.sourceEventId]);
  const firstSaved = f.owner.read(first.attemptId), secondSaved = f.owner.read(second.attemptId);
  f.reopen();
  expect(f.sources.episodes.read('episode')!.episode).toEqual(episode);
  expect(f.owner.read(first.attemptId)).toEqual(firstSaved);
  expect(f.owner.read(second.attemptId)).toEqual(secondSaved);
  expect(f.sources.episodes.advance('episode', firstResult.activity.sourceEventId, f.opportunity.episode!.revision)).toEqual(firstResult.episode);
  expect(f.owner.settle(first.attemptId)).toEqual(firstResult);
  expect(f.owner.settle(second.attemptId)).toEqual(secondResult);
  expect(f.count('world_player_workload_activities')).toBe(2);
});

it('preserves a first-write workload conflict instead of rebasing or replaying execution', async () => {
  const f = await fixture(), complete = f.complete(); f.assess(complete); f.recordRecovery();
  const before = f.snapshot('world_player_workload_activities'), execution = f.owner.read(complete.attemptId);
  expect(() => f.owner.settle(complete.attemptId)).toThrow(/stale|revision/);
  expect(f.snapshot('world_player_workload_activities')).toBe(before);
  expect(f.owner.read(complete.attemptId)).toEqual(execution);
  expect(f.sources.episodes.read('episode')!.episode.practiceSourceEventIds).toEqual([]);
});

it.each(['timing', 'release'] as const)('authenticates the original exact %s revision after a later accepted same-day source change', async source => {
  const f = await fixture(), first = f.complete(); f.assess(first); f.owner.settle(first.attemptId);
  const original = f.owner.read(first.attemptId)!;
  if (source === 'release') {
    const changed = { sourceId: 'later-form', sourceVersion: 'fixture-v1', careerId: 'career-a', playerId: 'p1',
      causeEventId: 'independently-accepted-form-change', causeKind: 'FORM_REBUILD' as const, effectiveDay: 13,
      body: f.releaseInput.body, profile: { ...f.releaseInput.profile, releaseExtensionRatio: 0.25 } };
    f.releaseChanges.set(changed.sourceId, changed); f.sources.release.apply(changed.sourceId, 0);
  } else {
    // An independent accepted learning fixture advances the existing timing owner.
    // The practice producer under test does not produce this evidence or gain.
    const change = f.roster.readDevelopmentRosterChange('promotion-execution')!;
    let episode = startDevelopmentLearningEpisode('independent-timing', change.before, change.after, change.event, 'p1',
      { careerId: 'career-a', playerId: 'p1', createdAtDay: 10, profileVersion: 'v1' },
      { policyId: 'fixture-independent-learning', version: 'v1', availableAtDay: 10,
        minimumPracticeEvents: 1, minimumFeedbackEvents: 1, minimumElapsedDays: 2 });
    for (const event of [
      { eventId: 'other-engaged', sourceEventId: 'other-engaged', atDay: 11, kind: 'APPRAISAL_ENGAGED' as const },
      { eventId: 'other-hypothesis', sourceEventId: 'other-hypothesis', atDay: 11, kind: 'HYPOTHESIS_FORMED' as const, domain: 'TECHNICAL' as const },
      { eventId: 'other-practice', sourceEventId: 'other-practice', atDay: 12, kind: 'PRACTICE_RECORDED' as const, domain: 'TECHNICAL' as const },
      { eventId: 'other-feedback', sourceEventId: 'other-feedback', atDay: 12, kind: 'FEEDBACK_RECORDED' as const, domain: 'TECHNICAL' as const },
      { eventId: 'other-consolidated', sourceEventId: 'other-consolidated', atDay: 13, kind: 'CONSOLIDATION_RECORDED' as const, domain: 'TECHNICAL' as const },
    ]) episode = appendDevelopmentLearningEvent(episode, episode.revision, event);
    const practice = practiceBundleForEpisode(episode);
    f.timingLearning.set('later-timing', { sourceId: 'later-timing', episode,
      measurements: [{ practiceSourceEventId: 'other-practice', normalMotionToReleaseUs: 700_000, quickMotionToReleaseUs: 350_000 }],
      practice: { ...practice, policy: { ...practice.policy, minimumDistinctPracticeDays: 1, minimumEffectiveExposure: 0.1 } } });
    f.sources.timing.apply('later-timing', 0);
  }
  expect(f.owner.read(first.attemptId)).toEqual(original);
  const next = f.nextOpportunity(first), later = f.owner.begin(next.sourceId);
  if (source === 'release') {
    expect(later.frame.release.sourceId).toBe('later-form');
    expect(later.plannedDelivery.release.position).not.toEqual(first.plannedDelivery.release.position);
  } else {
    expect(later.frame.timing.revision).toBe(1);
    expect(later.frame.timing.profile.normalMotionToReleaseUs).toBe(700_000);
  }
  f.reopen();
  expect(f.owner.read(first.attemptId)).toEqual(original);
  expect(f.owner.read(later.attemptId)!.frame).toEqual(later.frame);
  const workloadHistory = f.snapshot('world_player_workload_activities');
  const episodeHistory = f.snapshot('world_development_learning_events');
  if (source === 'timing') f.db.exec("UPDATE world_pitch_timing_baselines SET initial_json=json_set(initial_json,'$.profile.normalMotionToReleaseUs',123)");
  else f.db.exec("UPDATE world_player_release_baselines SET source_json=json_set(source_json,'$.profile.releaseExtensionRatio',0.23)");
  expect(() => f.owner.read(first.attemptId)).toThrow(/corrupt|differ|diverg|source|baseline|history|frame/);
  expect(() => f.owner.settle(first.attemptId)).toThrow(/corrupt|differ|diverg|source|baseline|history|frame/);
  expect(f.snapshot('world_player_workload_activities')).toBe(workloadHistory);
  expect(f.snapshot('world_development_learning_events')).toBe(episodeHistory);
});

it('rejects archived frame corruption after reopen rather than trusting a cached completion', async () => {
  const f = await fixture(), complete = f.complete(); f.assess(complete);
  const settled = f.owner.settle(complete.attemptId);
  if (settled.kind !== 'complete') throw new Error('practice fixture settlement did not complete');
  const episodeHistory = f.snapshot('world_development_learning_events');
  f.db.exec("UPDATE pitch_practice_attempts SET frame_json=json_set(frame_json,'$.workload.fatigue',0.01)");
  expect(() => f.sources.episodes.read('episode')).toThrow(/practice|frame|source|workload|corrupt|evidence/i);
  expect(() => f.sources.episodes.advance('episode', settled.activity.sourceEventId, f.opportunity.episode!.revision))
    .toThrow(/practice|frame|source|workload|corrupt|evidence/i);
  expect(f.snapshot('world_development_learning_events')).toBe(episodeHistory);
  expect(() => { f.reopen(); f.owner.read(complete.attemptId); }).toThrow(/practice|frame|source|workload|corrupt|evidence/i);
  expect(f.count('world_player_workload_activities')).toBe(1);
});

it.each(['timing', 'release', 'workload', 'person_link'] as const)('reauthenticates the original %s owner rather than trusting only copied attempt data', async source => {
  const f = await fixture(), complete = f.complete(); f.assess(complete); f.owner.settle(complete.attemptId);
  if (source === 'timing') f.db.exec("UPDATE world_pitch_timing_baselines SET initial_json=json_set(initial_json,'$.profile.normalMotionToReleaseUs',123)");
  if (source === 'release') f.db.exec("UPDATE world_player_release_baselines SET source_json=json_set(source_json,'$.profile.releaseExtensionRatio',0.25)");
  if (source === 'workload') f.db.exec("UPDATE world_player_workload_baselines SET initial_json=json_set(initial_json,'$.fatigue',0.01)");
  if (source === 'person_link') f.db.exec("UPDATE world_player_person_links SET source_json=json_set(source_json,'$.personId','foreign')");
  expect(() => f.owner.read(complete.attemptId)).toThrow(/corrupt|differ|diverg|source|baseline|Person|history|frame/);
  expect(() => f.owner.settle(complete.attemptId)).toThrow(/corrupt|differ|diverg|source|baseline|Person|history|frame/);
  expect(f.count('world_player_workload_activities')).toBe(1);
});

it('retains settled workload when episode admission becomes stale and never manufactures feedback or consolidation', async () => {
  const f = await fixture(), first = f.complete(); f.assess(first); f.owner.settle(first.attemptId);
  const next = f.nextOpportunity(first), second = f.complete(next.sourceId); f.assess(second);
  f.learningEvents.set('actual-feedback', { eventId: 'actual-feedback', sourceEventId: 'actual-feedback', kind: 'FEEDBACK_RECORDED', atDay: 13, domain: 'TECHNICAL' });
  const prior = f.sources.episodes.read('episode')!.episode;
  f.sources.episodes.advance('episode', 'actual-feedback', prior.revision);
  const current = f.sources.episodes.read('episode')!.episode;
  const result = f.owner.settle(second.attemptId);
  expect(result).toMatchObject({ kind: 'pending' });
  expect(f.count('world_player_workload_activities')).toBe(2);
  expect(f.sources.episodes.read('episode')!.episode).toEqual(current);
  expect(f.owner.settle(second.attemptId)).toEqual(result);
  expect(f.count('world_player_workload_activities')).toBe(2);
  const further: PracticeOpportunity = { ...f.opportunity, sourceId: 'further-source', opportunityId: 'further-drill', ordinal: 0,
    previousAttemptId: null, readyAtUs: second.plannedDelivery.timeline.followThroughEndUs,
    workloadRevision: f.sources.workload.readHead('career-a', 'p1')!.revision, episode: null };
  f.opportunities.set(further.sourceId, further);
  expect(f.owner.begin(further.sourceId).frame.workload.revision).toBe(2);
});

it('rolls back a failed physical-prefix write and resumes the same actual phases', async () => {
  const f = await fixture(), begun = f.owner.begin(f.opportunity.sourceId);
  f.db.exec("CREATE TRIGGER fail_practice_progress BEFORE UPDATE ON pitch_practice_attempts BEGIN SELECT RAISE(ABORT,'fixture practice progress interrupted'); END;");
  expect(() => f.owner.advance(begun.attemptId, begun.revision, begun.plannedDelivery.timeline.followThroughEndUs)).toThrow('practice progress interrupted');
  expect(f.owner.read(begun.attemptId)).toEqual(begun);
  f.db.exec('DROP TRIGGER fail_practice_progress');
  expect(f.owner.advance(begun.attemptId, begun.revision, begun.plannedDelivery.timeline.followThroughEndUs).events).toHaveLength(5);
});

it.each(['workload', 'learning'] as const)('detects writer-local attempt mutation and rolls back the %s effect', async stage => {
  const f = await fixture(), complete = f.complete(); f.assess(complete);
  const before = f.owner.read(complete.attemptId), episodeBefore = f.sources.episodes.read('episode');
  const table = stage === 'workload' ? 'world_player_workload_activities' : 'world_development_learning_events';
  f.db.exec(`CREATE TRIGGER corrupt_practice_source BEFORE INSERT ON ${table} BEGIN
    UPDATE pitch_practice_attempts SET frame_json=json_set(frame_json,'$.workload.fatigue',0.01);
  END;`);
  expect(() => f.owner.settle(complete.attemptId)).toThrow(/practice|frame|source|workload|corrupt|evidence/i);
  expect(f.owner.read(complete.attemptId)).toEqual(before);
  expect(f.sources.episodes.read('episode')).toEqual(episodeBefore);
  expect(f.count('world_player_workload_activities')).toBe(stage === 'workload' ? 0 : 1);
  f.db.exec('DROP TRIGGER corrupt_practice_source');
  expect(f.owner.settle(complete.attemptId).kind).toBe('complete');
  expect(f.count('world_player_workload_activities')).toBe(1);
});

it('does not turn two real NORMAL/QUICK attempts into standardized measurements or capability updates', async () => {
  const f = await fixture(), baseline = f.sources.timing.readHead('career-a', 'p1');
  const first = f.complete(); f.assess(first); f.owner.settle(first.attemptId);
  const next = f.nextOpportunity(first, { timingIntent: { deliveryMode: 'QUICK', cadenceIntent: 'STANDARD' } }), second = f.complete(next.sourceId);
  f.assess(second); f.owner.settle(second.attemptId);
  expect(first.observation!.deliveryMode).toBe('NORMAL');
  expect(second.observation!.deliveryMode).toBe('QUICK');
  expect(first).not.toHaveProperty('measurements'); expect(second).not.toHaveProperty('measurements');
  expect(f.sources.timing.readHead('career-a', 'p1')).toEqual(baseline);
  expect(f.sources.episodes.read('episode')!.episode.stage).toBe('PRACTICING');
  expect(f.sources.episodes.read('episode')!.episode.feedbackSourceEventIds).toEqual([]);
});

it('can own an explicitly requested delivery without inventing a learning target', async () => {
  const f = await fixture();
  const opportunity: PracticeOpportunity = { ...f.opportunity, episode: null };
  f.opportunities.set(opportunity.sourceId, opportunity);
  const before = f.sources.episodes.read('episode'), complete = f.complete(); f.assess(complete);
  const result = f.owner.settle(complete.attemptId);
  expect(result).toMatchObject({ kind: 'complete', episode: null });
  expect(f.sources.episodes.read('episode')).toEqual(before);
  expect(f.count('world_player_workload_activities')).toBe(1);
});

it.each([
  ['workload', 'timing'], ['workload', 'release'], ['learning', 'timing'], ['learning', 'release'],
] as const)('rejects consumer-local original %s-write %s-source corruption before committing', async (stage, source) => {
  const f = await fixture(), complete = f.complete(); f.assess(complete);
  const before = f.owner.read(complete.attemptId), episodeBefore = f.sources.episodes.read('episode');
  const sourceTable = source === 'timing' ? 'world_pitch_timing_baselines' : 'world_player_release_baselines';
  const sourceBefore = f.snapshot(sourceTable);
  const consumerTable = stage === 'workload' ? 'world_player_workload_activities' : 'world_development_learning_events';
  const mutation = source === 'timing'
    ? "UPDATE world_pitch_timing_baselines SET initial_json=json_set(initial_json,'$.profile.normalMotionToReleaseUs',123)"
    : "UPDATE world_player_release_baselines SET source_json=json_set(source_json,'$.profile.releaseExtensionRatio',0.25)";
  f.db.exec(`CREATE TRIGGER corrupt_original_practice_source BEFORE INSERT ON ${consumerTable} BEGIN ${mutation}; END;`);
  expect(() => f.owner.settle(complete.attemptId)).toThrow(source === 'release'
    ? /practice|frame|source|corrupt|evidence|^Player release history head diverged$/i
    : /practice|frame|source|corrupt|evidence/i);
  expect(f.snapshot(sourceTable)).toBe(sourceBefore);
  expect(f.owner.read(complete.attemptId)).toEqual(before);
  expect(f.sources.episodes.read('episode')).toEqual(episodeBefore);
  expect(f.count('world_player_workload_activities')).toBe(stage === 'workload' ? 0 : 1);
  f.db.exec('DROP TRIGGER corrupt_original_practice_source');
  expect(f.owner.settle(complete.attemptId).kind).toBe('complete');
  expect(f.count('world_player_workload_activities')).toBe(1);
});

it('rejects a copied learning receipt under another durable source and destination', async () => {
  const f = await fixture(), complete = f.complete(); f.assess(complete);
  const settled = f.owner.settle(complete.attemptId);
  if (settled.kind !== 'complete') throw new Error('practice fixture settlement did not complete');
  f.db.prepare(`INSERT INTO world_development_learning_events
    (source_id, episode_id, before_revision, after_revision, event_json, state_json)
    SELECT 'forged-practice-alias', 'foreign-episode', before_revision, after_revision, event_json, state_json
    FROM world_development_learning_events WHERE source_id=?`).run(settled.activity.sourceEventId);
  const workloadBefore = f.snapshot('world_player_workload_activities');
  expect(() => f.sources.episodes.read('episode')).toThrow(/practice|alias|identity|source|receipt|evidence/i);
  expect(() => f.owner.settle(complete.attemptId)).toThrow(/practice|alias|identity|source|receipt|evidence/i);
  expect(f.snapshot('world_player_workload_activities')).toBe(workloadBefore);
});

it('authenticates each earlier physical attempt once per learning-guard call without a persistent cache', async () => {
  const f = await fixture();
  let attempt = f.complete();
  for (let index = 0; index < 6; index++) {
    f.assess(attempt);
    expect(f.owner.settle(attempt.attemptId).kind).toBe('complete');
    if (index < 5) attempt = f.complete(f.nextOpportunity(attempt).sourceId);
  }
  const event = f.sources.episodes.read('episode')!.episode.events.at(-1)!;
  const before = f.readTimingCount();
  f.owner.assertLearningEvidence(f.db, event, 'read');
  expect(f.readTimingCount() - before).toBe(6);
  const again = f.readTimingCount();
  f.owner.assertLearningEvidence(f.db, event, 'read');
  expect(f.readTimingCount() - again).toBe(6);
});
