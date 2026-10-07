// All discovery, protocol, normalization, effort, recovery and exposure values are
// explicit synthetic accepted inputs, copied from the existing genuine fixtures.
// The original null-episode fixture is unchanged; no promotion is performed.
import { expect } from 'vitest';
import type { DevelopmentLearningEventInput } from '../../core/world/development/DevelopmentLearningEpisode';
import type { PlayerWorkloadActivity } from '../../core/world/development/PlayerWorkloadRecovery';
import type { ActualPracticePairPlan, AcceptedActualPracticeMeasurement } from './ActualPitchTimingLearningFromPractice';
import { practiceHash, type PitchPracticeAttempt, type PitchPracticeAssessment, type PitchPracticeOpportunity } from './PitchPracticeAttempt';
import { acceptedPracticeDiscoveryFixture, assertPracticeOriginPrerequisite, practiceOriginFixture } from './PracticeOriginDevelopment.test-support';
import { openSqliteDevelopmentInitiationStore, type SqliteDevelopmentInitiationStore } from './SqliteDevelopmentInitiationStore';
import { openSqlitePitchPracticeAttemptStore, type SqlitePitchPracticeAttemptStore } from './SqlitePitchPracticeAttemptStore';
import { openSqlitePlayerPitchTimingStore, type AcceptedPitchTimingLearning, type SqlitePlayerPitchTimingStore } from './SqlitePlayerPitchTimingStore';
import { openSqlitePlayerWorkloadRecoveryStore, type SqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';

export function practiceOriginActualTimingFixture(cleanup: (() => void)[]) {
  const base = practiceOriginFixture(cleanup), origin = assertPracticeOriginPrerequisite(base);
  const packet = acceptedPracticeDiscoveryFixture(origin.completed);
  const appraisals = new Map([[packet.appraisal.sourceId, packet.appraisal]]), policies = new Map([[packet.policies.sourceId, packet.policies]]);
  const events = new Map<string, DevelopmentLearningEventInput>(), activities = new Map<string, PlayerWorkloadActivity>();
  const opportunities = new Map<string, PitchPracticeOpportunity>(), assessments = new Map<string, PitchPracticeAssessment>();
  const plans = new Map<string, ActualPracticePairPlan>(), reports = new Map<string, AcceptedActualPracticeMeasurement>();
  const inputs = new Map<string, AcceptedPitchTimingLearning>(), handles: { close(): void }[] = [];
  const keep = <T extends { close(): void }>(value: T): T => { handles.push(value); return value; };
  const close = () => { while (handles.length) handles.pop()!.close(); };
  cleanup.push(close);
  let practice: SqlitePitchPracticeAttemptStore, timing: SqlitePlayerPitchTimingStore;
  let workload: SqlitePlayerWorkloadRecoveryStore, episodes: SqliteDevelopmentInitiationStore;
  const connect = () => {
    timing = keep(openSqlitePlayerPitchTimingStore(base.path, base.sources.personLinks, {
      readAcceptedBaseline: () => null, readAcceptedLearning: id => practice.readAcceptedLearning(id),
    }, (db, input, phase) => practice.assertTimingEvidence(db, input, phase)));
    workload = keep(openSqlitePlayerWorkloadRecoveryStore(base.path, base.sources.personLinks, {
      readAcceptedBaseline: () => null, readAcceptedActivity: id => activities.get(id) ?? practice.readAcceptedActivity(id),
    }, (db, activity, phase) => { if (activity.kind === 'PRACTICE') practice.assertWorkloadEvidence(db, activity, phase); }));
    episodes = keep(openSqliteDevelopmentInitiationStore(base.path, { roster: base.roster, person: base.sources.person,
      appraisal: { readAcceptedAppraisal: () => null }, policies: { readAcceptedPolicies: id => policies.get(id) ?? null },
      practice: { attempts: base.owner, workload, readAcceptedAppraisal: id => appraisals.get(id) ?? null } },
    { readAcceptedLearningEvent: id => events.get(id) ?? practice.readAcceptedLearningEvent(id) },
    (db, event, phase) => { if (event.kind === 'PRACTICE_RECORDED') practice.assertLearningEvidence(db, event, phase); }));
    practice = keep(openSqlitePitchPracticeAttemptStore(base.path, { ...base.sources, timing, workload, episodes }, {
      readAcceptedOpportunity: id => opportunities.get(id) ?? null, readAcceptedAssessment: id => assessments.get(id) ?? null,
      readAcceptedPairPlan: id => plans.get(id) ?? null, readAcceptedStandardizedMeasurement: id => reports.get(id) ?? null,
      readAcceptedTimingLearning: id => inputs.get(id) ?? null,
    }));
  };
  connect();
  const initial = episodes!.applyPractice(packet.request);
  expect(initial.episode.stage).toBe('ENGAGED');
  const append = (kind: 'HYPOTHESIS_FORMED' | 'FEEDBACK_RECORDED' | 'CONSOLIDATION_RECORDED', atDay: number) => {
    const sourceEventId = `accepted-origin-${kind}`;
    events.set(sourceEventId, { eventId: sourceEventId, sourceEventId, kind, atDay, domain: 'TECHNICAL' });
    return episodes.advance(packet.request.episodeId, sourceEventId, episodes.read(packet.request.episodeId)!.episode.revision);
  };
  append('HYPOTHESIS_FORMED', 13);
  const consume = (o: PitchPracticeOpportunity) => {
    opportunities.set(o.sourceId, o);
    let attempt = practice.begin(o.sourceId); const t = attempt.plannedDelivery.timeline;
    for (const atUs of [t.motionStartUs, t.gatherEndUs, t.strideStartUs, t.releaseUs, t.followThroughEndUs]) {
      attempt = practice.advance(attempt.attemptId, attempt.revision, atUs);
    }
    expect(attempt.events).toHaveLength(5); expect(attempt.status).toBe('DELIVERY_COMPLETE');
    const sourceId = `accepted-origin-effort:${attempt.attemptId}`;
    assessments.set(sourceId, { sourceId, sourceVersion: 'fixture-v1', attemptId: attempt.attemptId,
      completionHash: attempt.completionReference!.hash, effortUnits: 1, healthAvailability: 0.9,
      provenance: { assessmentSourceId: sourceId, assessmentVersion: 'fixture-v1', calibrationSourceId: 'fixture-effort-health', calibrationVersion: 'v1' } });
    attempt = practice.acceptAssessment(sourceId);
    const settlement = practice.settle(attempt.attemptId);
    if (settlement.kind !== 'complete') throw new Error('genuine new-origin timing prerequisite did not settle');
    return { attempt, settlement };
  };
  const opportunity = (sourceId: string, atDay: number, readyAtUs: number, episode: PitchPracticeOpportunity['episode']): PitchPracticeOpportunity => ({
    ...base.opportunity, sourceId, opportunityId: sourceId, ordinal: 0, previousAttemptId: null, atDay, readyAtUs, episode,
    workloadRevision: workload.readHead('career-a', 'p1')!.revision, timingRevision: timing.readHead('career-a', 'p1')!.revision,
    releaseRevision: base.sources.release.readHead('career-a', 'p1')!.revision,
  });
  const pairs: { original: PitchPracticeAttempt; normal: PitchPracticeAttempt; quick: PitchPracticeAttempt;
    plan: ActualPracticePairPlan; report: AcceptedActualPracticeMeasurement }[] = [];
  for (let index = 0; index < 3; index++) {
    const episode = episodes!.read(packet.request.episodeId)!.episode;
    const original = consume(opportunity(`origin-timing-repetition-${index}`, 13 + index,
      index === 0 ? origin.completed.plannedDelivery.timeline.followThroughEndUs + 1 : 0,
      { episodeId: episode.episodeId, revision: episode.revision, domain: 'TECHNICAL' })).attempt;
    const normalOpportunity = opportunity(`origin-normal-${index}`, original.opportunity.atDay,
      original.plannedDelivery.timeline.followThroughEndUs + 1, null);
    const quickOpportunity: PitchPracticeOpportunity = { ...normalOpportunity, sourceId: `origin-quick-${index}`, opportunityId: `origin-quick-${index}`,
      readyAtUs: 10_800_000_000, workloadRevision: normalOpportunity.workloadRevision + 2,
      timingIntent: { deliveryMode: 'QUICK', cadenceIntent: 'STANDARD' } };
    const plan: ActualPracticePairPlan = { sourceId: `origin-pair-${index}`, sourceVersion: 'fixture-plan-v1',
      original: { attemptId: original.attemptId, completionHash: original.completionReference!.hash,
        activityId: `practice-workload:${original.attemptId}`, episodeId: episode.episodeId,
        episodeRevision: episodes!.read(episode.episodeId)!.episode.revision }, normalOpportunity, quickOpportunity,
      protocol: { sourceId: 'fixture-comparable-protocol', sourceVersion: 'v1', conditionRule: 'COMPARABLE_CONDITIONS',
        normalizationSourceId: 'fixture-explicit-measurement-provider', normalizationVersion: 'v1' },
      reference: { personLinkSourceId: original.opportunity.personLinkSourceId, timingRevision: normalOpportunity.timingRevision,
        releaseRevision: normalOpportunity.releaseRevision, timingProfile: original.frame.timing.profile, release: original.frame.release,
        fatiguePolicy: original.frame.policy, moundReference: original.opportunity.moundReference, physics: original.opportunity.physics,
        beforeFatigue: workload!.readHead('career-a', 'p1')!.fatigue, healthAvailability: 0.9 } };
    plans.set(plan.sourceId, plan); const accepted = practice!.acceptPairPlan(plan.sourceId);
    const normal = consume(normalOpportunity).attempt;
    const recovery: PlayerWorkloadActivity = { sourceEventId: `origin-probe-recovery-${index}`, sourceVersion: 'fixture-recovery-v1',
      evidenceId: 'accepted-fixture-recovery', careerId: 'career-a', playerId: 'p1', atDay: original.opportunity.atDay,
      kind: 'RECOVERY', durationHours: 2, quality: 1, medicalAvailability: 1 };
    activities.set(recovery.sourceEventId, recovery); workload!.apply(recovery.sourceEventId, workload!.readHead('career-a', 'p1')!.revision);
    const quick = consume(quickOpportunity).attempt;
    const measured = (a: PitchPracticeAttempt) => ({ completion: a.completionReference!, frameHash: practiceHash(a.frame),
      observation: a.observation!, workloadActivityId: `practice-workload:${a.attemptId}` });
    const report: AcceptedActualPracticeMeasurement = { sourceId: `origin-report-${index}`, sourceVersion: 'fixture-report-v1',
      planSourceId: plan.sourceId, planHash: accepted.hash, atDay: original.opportunity.atDay,
      protocolSourceId: plan.protocol.sourceId, protocolVersion: plan.protocol.sourceVersion,
      normalizationSourceId: plan.protocol.normalizationSourceId, normalizationVersion: plan.protocol.normalizationVersion,
      normal: measured(normal), quick: measured(quick), standardized: { normalMotionToReleaseUs: 600_000, quickMotionToReleaseUs: 250_000 },
      provenance: { measurementSourceId: `independent-origin-report-${index}`, measurementVersion: 'fixture-v1',
        calibrationSourceId: 'fixture-measurement-calibration', calibrationVersion: 'fixture-v1' } };
    reports.set(report.sourceId, report); practice!.acceptMeasurement(report.sourceId);
    pairs.push({ original, normal, quick, plan, report });
  }
  append('FEEDBACK_RECORDED', 18); const episode = append('CONSOLIDATION_RECORDED', 18);
  expect(episode.stage).toBe('CONSOLIDATED');
  expect(episode.practiceSourceEventIds).toEqual(pairs.map(p => p.plan.original.activityId));
  expect(episode.practiceSourceEventIds).not.toContain(origin.result.activity.sourceEventId);
  const input: AcceptedPitchTimingLearning = { sourceId: 'accepted-origin-timing-learning', episode,
    measurements: pairs.map(pair => ({ practiceSourceEventId: pair.plan.original.activityId, ...pair.report.standardized })),
    practice: { policy: { policyId: 'fixture-exposure', version: 'v1', availableAtDay: 10, selfDirectedShare: 0.5,
      minimumEffectiveExposure: 1, minimumDistinctPracticeDays: 3 },
    prior: { careerId: 'career-a', playerId: 'p1', atDay: 13, domain: 'TECHNICAL', receptivity: 1,
      profileVersion: 'v1', policyId: 'fixture-receptivity', policyVersion: 'v1' },
    repetitions: pairs.map(pair => { const receipt = workload!.readActivity(pair.plan.original.activityId)!;
      if (receipt.activity.kind !== 'PRACTICE') throw new Error('genuine later practice workload is missing');
      return { sourceEventId: receipt.activity.sourceEventId, atDay: receipt.activity.atDay, trainingStimulus: 1,
        coachingFit: 1, challengeFit: 1, motivation: 1, opportunity: 1, novelty: 1, fatigue: receipt.before.fatigue,
        healthAvailability: receipt.activity.healthAvailability }; }) } };
  inputs.set(input.sourceId, input);
  expect(practice!.prepareLearning(input.sourceId, pairs.map(p => p.report.sourceId), 0).kind).toBe('ready');
  expect(base.count('world_roster_executions')).toBe(0); expect(base.count('world_pitch_timing_updates')).toBe(0);
  const clearAuthorities = () => { for (const map of [appraisals, policies, events, activities, opportunities, assessments, plans, reports, inputs]) map.clear(); };
  const reopen = () => { close(); base.reopen(); connect(); };
  return { base, origin, packet, input, pairs, consume, opportunity, clearAuthorities, reopen,
    get practice() { return practice; }, get timing() { return timing; }, get workload() { return workload; }, get episodes() { return episodes; } };
}
