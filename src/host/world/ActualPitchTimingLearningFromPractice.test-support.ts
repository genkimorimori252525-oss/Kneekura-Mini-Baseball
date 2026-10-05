// Real delivery, workload and episode owners. All protocol, recovery, feedback,
// exposure and standardized report values below are explicit synthetic inputs;
// this fixture is not an empirical normalization/adaptation model.
import { vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import type { DevelopmentLearningEpisode } from '../../core/world/development/DevelopmentLearningEpisode';
import type { PlayerPitchTimingSource } from '../../core/world/development/PlayerPitchTimingSource';
import type { AcceptedPitchTimingLearning } from './SqlitePlayerPitchTimingStore';
import { practiceHash } from './PitchPracticeAttempt';
import { practiceFixture, type PracticeAttempt, type PracticeOpportunity, type PracticeFixtureHooks } from './PitchPracticeAttempt.test-support';

type EvidenceDb = Pick<DatabaseSync, 'prepare'>;
export type PairPlan = {
  sourceId: string; sourceVersion: string;
  original: { attemptId: string; completionHash: string; activityId: string; episodeId: string; episodeRevision: number };
  normalOpportunity: PracticeOpportunity; quickOpportunity: PracticeOpportunity;
  protocol: { sourceId: string; sourceVersion: string; conditionRule: 'COMPARABLE_CONDITIONS';
    normalizationSourceId: string; normalizationVersion: string };
  reference: { personLinkSourceId: string; timingRevision: number; releaseRevision: number;
    timingProfile: unknown; release: unknown; fatiguePolicy: unknown;
    moundReference: PracticeOpportunity['moundReference']; physics: PracticeOpportunity['physics']; beforeFatigue: number; healthAvailability: number };
};
export type PairPlanReceipt = { source: PairPlan; hash: string };
export type StandardizedPairResult = {
  sourceId: string; sourceVersion: string; planSourceId: string; planHash: string; atDay: number;
  protocolSourceId: string; protocolVersion: string;
  normalizationSourceId: string; normalizationVersion: string;
  normal: { completion: NonNullable<PracticeAttempt['completionReference']>; frameHash: string; observation: NonNullable<PracticeAttempt['observation']>; workloadActivityId: string };
  quick: { completion: NonNullable<PracticeAttempt['completionReference']>; frameHash: string; observation: NonNullable<PracticeAttempt['observation']>; workloadActivityId: string };
  standardized: { normalMotionToReleaseUs: number; quickMotionToReleaseUs: number };
  provenance: { measurementSourceId: string; measurementVersion: string; calibrationSourceId: string; calibrationVersion: string };
};
export type StandardizedPairReceipt = { source: StandardizedPairResult; hash: string; practiceSourceEventId: string };
export type LearningPreparation = { kind: 'pending'; reason: string } | {
  kind: 'ready'; sourceId: string; expectedTimingRevision: number; pairResultSourceIds: readonly string[]; learning: AcceptedPitchTimingLearning;
};
export type LearningAdapter = {
  acceptPairPlan(sourceId: string): PairPlanReceipt;
  readPairPlan(sourceId: string): PairPlanReceipt | null;
  acceptMeasurement(sourceId: string): StandardizedPairReceipt;
  readMeasurement(sourceId: string): StandardizedPairReceipt | null;
  prepareLearning(sourceId: string, pairResultSourceIds: readonly string[], expectedTimingRevision: number): LearningPreparation;
  settleLearning(sourceId: string): { kind: 'pending'; reason: string } | { kind: 'complete'; source: PlayerPitchTimingSource };
  readAcceptedLearning(sourceId: string): AcceptedPitchTimingLearning | null;
  assertTimingEvidence(db: EvidenceDb, learning: AcceptedPitchTimingLearning, phase: string): void;
};
type AdapterModule = { createActualPitchTimingLearningAdapter(sources: unknown): LearningAdapter };

export async function actualLearningFixture(cleanup: (() => void)[], hooks: Pick<PracticeFixtureHooks,
  'controlDomainIds' | 'manualControlDomainIds' | 'practiceOrderSources' | 'extraPracticeAuthority'> = {}) {
  const plans = new Map<string, PairPlan>(), reports = new Map<string, StandardizedPairResult>();
  const learningInputs = new Map<string, AcceptedPitchTimingLearning>();
  let adapter: LearningAdapter | undefined;
  const base = await practiceFixture(cleanup, { ...hooks, quickSpeedFactor: 2,
    extraPracticeAuthority: {
      ...hooks.extraPracticeAuthority,
      readAcceptedPairPlan: id => plans.get(id) ?? null,
      readAcceptedStandardizedMeasurement: id => reports.get(id) ?? null,
      readAcceptedTimingLearning: id => learningInputs.get(id) ?? null,
    },
    readAcceptedTimingLearning: id => adapter?.readAcceptedLearning(id) ?? null,
    assertTimingEvidence: (db, input, phase) => adapter?.assertTimingEvidence(db, input, phase),
  });
  const first = base.complete(); base.assess(first);
  const firstSettlement = base.owner.settle(first.attemptId);
  if (firstSettlement.kind !== 'complete') throw new Error('actual learning fixture practice did not settle');
  // Import after genuine source setup and one consumed, workload-settled attempt.
  // Cleanup is already registered by practiceFixture if the module is absent.
  const module = await vi.importActual<AdapterModule>('./ActualPitchTimingLearningFromPractice');
  const connect = () => module.createActualPitchTimingLearningAdapter({ practice: base.owner, ...base.sources });
  adapter = connect();
  let index = 0;
  const planFor = (original: PracticeAttempt): PairPlan => {
    const originalActivity = base.owner.readAcceptedActivity(`practice-workload:${original.attemptId}`)!;
    const current = base.sources.workload.readHead('career-a', 'p1')!;
    const normalOpportunity: PracticeOpportunity = { ...base.opportunity, sourceId: `normal-opportunity-${index}`, opportunityId: `normal-probe-${index}`,
      ordinal: 0, previousAttemptId: null, atDay: original.opportunity.atDay,
      readyAtUs: original.plannedDelivery.timeline.followThroughEndUs + 1, workloadRevision: current.revision,
      timingRevision: base.sources.timing.readHead('career-a', 'p1')!.revision,
      releaseRevision: base.sources.release.readHead('career-a', 'p1')!.revision, episode: null,
      timingIntent: { deliveryMode: 'NORMAL', cadenceIntent: 'STANDARD' } };
    const quickOpportunity: PracticeOpportunity = { ...normalOpportunity, sourceId: `quick-opportunity-${index}`, opportunityId: `quick-probe-${index}`,
      // Explicit fixture local time leaves room for the separately accepted
      // two-hour recovery; this is not a production scheduler/conversion.
      readyAtUs: 10_800_000_000, workloadRevision: current.revision + 2,
      timingIntent: { deliveryMode: 'QUICK', cadenceIntent: 'STANDARD' } };
    const sourceId = `pair-plan-${index++}`;
    const plan: PairPlan = { sourceId, sourceVersion: 'fixture-plan-v1',
      original: { attemptId: original.attemptId, completionHash: original.completionReference!.hash,
        activityId: originalActivity.sourceEventId, episodeId: 'episode', episodeRevision: base.sources.episodes.read('episode')!.episode.revision },
      normalOpportunity, quickOpportunity,
      protocol: { sourceId: 'fixture-comparable-protocol', sourceVersion: 'v1', conditionRule: 'COMPARABLE_CONDITIONS',
        normalizationSourceId: 'fixture-explicit-measurement-provider', normalizationVersion: 'v1' },
      reference: { personLinkSourceId: original.opportunity.personLinkSourceId,
        timingRevision: normalOpportunity.timingRevision, releaseRevision: normalOpportunity.releaseRevision,
        timingProfile: original.frame.timing.profile, release: original.frame.release, fatiguePolicy: original.frame.policy,
        moundReference: original.opportunity.moundReference, physics: original.opportunity.physics,
        beforeFatigue: current.fatigue, healthAvailability: 0.9 } };
    plans.set(sourceId, plan);
    base.opportunities.set(normalOpportunity.sourceId, normalOpportunity);
    base.opportunities.set(quickOpportunity.sourceId, quickOpportunity);
    return plan;
  };
  const acceptedRecovery = (atDay: number, durationHours = 2) => {
    const current = base.sources.workload.readHead('career-a', 'p1')!;
    const activity = { sourceEventId: `probe-recovery:${current.revision}`, sourceVersion: 'fixture-recovery-v1', evidenceId: 'accepted-fixture-recovery',
      careerId: 'career-a', playerId: 'p1', atDay, kind: 'RECOVERY' as const, durationHours, quality: 1, medicalAvailability: 1 };
    base.activities.set(activity.sourceEventId, activity);
    return base.sources.workload.apply(activity.sourceEventId, current.revision);
  };
  const consumeProbe = (opportunity: PracticeOpportunity) => {
    const attempt = base.complete(opportunity.sourceId); base.assess(attempt);
    const settled = base.owner.settle(attempt.attemptId);
    if (settled.kind !== 'complete' || settled.episode !== null) throw new Error('measurement probe did not retain its workload-only target');
    return { attempt: base.owner.read(attempt.attemptId)!, activityId: settled.activity.sourceEventId };
  };
  const completePair = (plan: PairPlan, options: { recoveryHours?: number; standardizedQuickUs?: number } = {}) => {
    const receipt = adapter!.acceptPairPlan(plan.sourceId);
    const normal = consumeProbe(plan.normalOpportunity);
    acceptedRecovery(plan.normalOpportunity.atDay, options.recoveryHours ?? 2);
    const quick = consumeProbe(plan.quickOpportunity);
    const input = (value: typeof normal): StandardizedPairResult['normal'] => ({ completion: value.attempt.completionReference!,
      frameHash: practiceHash(value.attempt.frame), observation: value.attempt.observation!, workloadActivityId: value.activityId });
    const report: StandardizedPairResult = { sourceId: `report:${plan.sourceId}`, sourceVersion: 'fixture-report-v1',
      planSourceId: plan.sourceId, planHash: receipt.hash, atDay: plan.quickOpportunity.atDay,
      protocolSourceId: plan.protocol.sourceId, protocolVersion: plan.protocol.sourceVersion,
      normalizationSourceId: plan.protocol.normalizationSourceId, normalizationVersion: plan.protocol.normalizationVersion,
      normal: input(normal), quick: input(quick),
      standardized: { normalMotionToReleaseUs: 600_000, quickMotionToReleaseUs: options.standardizedQuickUs ?? 300_000 },
      provenance: { measurementSourceId: `independent-report:${plan.sourceId}`, measurementVersion: 'fixture-v1',
        calibrationSourceId: 'fixture-measurement-calibration', calibrationVersion: 'fixture-v1' } };
    reports.set(report.sourceId, report);
    return { plan, normal: normal.attempt, quick: quick.attempt, report, planReceipt: receipt };
  };
  const formLearningInput = (pairs: readonly ReturnType<typeof completePair>[], sourceId = 'accepted-actual-learning'): AcceptedPitchTimingLearning => {
    const episode = base.sources.episodes.read('episode')!.episode;
    const input: AcceptedPitchTimingLearning = { sourceId, episode,
      measurements: pairs.map(pair => ({ practiceSourceEventId: pair.plan.original.activityId, ...pair.report.standardized })),
      practice: { policy: { policyId: 'fixture-exposure', version: 'v1', availableAtDay: 10,
        selfDirectedShare: 0.5, minimumEffectiveExposure: 1, minimumDistinctPracticeDays: 3 },
      prior: { careerId: 'career-a', playerId: 'p1', atDay: 13, domain: 'TECHNICAL', receptivity: 1,
        profileVersion: 'v1', policyId: 'fixture-receptivity', policyVersion: 'v1' },
      repetitions: pairs.map(pair => { const receipt = base.sources.workload.readActivity(pair.plan.original.activityId)!;
        if (receipt.activity.kind !== 'PRACTICE') throw new Error('original practice workload missing');
        return { sourceEventId: receipt.activity.sourceEventId, atDay: receipt.activity.atDay, trainingStimulus: 1,
          coachingFit: 1, challengeFit: 1, motivation: 1, opportunity: 1, novelty: 1,
          fatigue: receipt.before.fatigue, healthAvailability: receipt.activity.healthAvailability }; }) } };
    learningInputs.set(sourceId, input); return input;
  };
  const completeLearningEvidence = (options: { standardizedQuickUs?: number } = {}) => {
    let original = first;
    const pairs: ReturnType<typeof completePair>[] = [];
    for (let group = 0; group < 3; group++) {
      if (group > 0) {
        const current = base.sources.workload.readHead('career-a', 'p1')!;
        const sourceId = `learning-opportunity-${group}`;
        const opportunity: PracticeOpportunity = { ...base.opportunity, sourceId, opportunityId: sourceId, ordinal: 0, previousAttemptId: null,
          atDay: 13 + group, readyAtUs: 0, workloadRevision: current.revision,
          episode: { episodeId: 'episode', domain: 'TECHNICAL', revision: base.sources.episodes.read('episode')!.episode.revision } };
        base.opportunities.set(sourceId, opportunity); original = base.complete(sourceId); base.assess(original);
        if (base.owner.settle(original.attemptId).kind !== 'complete') throw new Error('later original practice did not settle');
      }
      const pair = completePair(planFor(original), options); adapter!.acceptMeasurement(pair.report.sourceId); pairs.push(pair);
    }
    for (const kind of ['FEEDBACK_RECORDED', 'CONSOLIDATION_RECORDED'] as const) {
      const sourceEventId = `independently-accepted-${kind}`;
      base.learningEvents.set(sourceEventId, { eventId: sourceEventId, sourceEventId, kind, atDay: 16, domain: 'TECHNICAL' });
      base.sources.episodes.advance('episode', sourceEventId, base.sources.episodes.read('episode')!.episode.revision);
    }
    return { pairs, input: formLearningInput(pairs) };
  };
  const reopen = () => { adapter = undefined; base.reopen(); adapter = connect(); };
  return { base, plans, reports, learningInputs, first, planFor, completePair, consumeProbe, acceptedRecovery, formLearningInput,
    completeLearningEvidence, reopen, get adapter() { return adapter!; },
    clearAuthorities: () => { plans.clear(); reports.clear(); learningInputs.clear(); base.opportunities.clear(); base.assessments.clear(); },
    episode: (): DevelopmentLearningEpisode => base.sources.episodes.read('episode')!.episode };
}
