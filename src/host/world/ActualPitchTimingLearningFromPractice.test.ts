import { afterEach, expect, it } from 'vitest';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { assessDevelopmentPracticeExposure } from '../../core/world/development/DevelopmentPracticeExposure';
import { actualLearningFixture, type PairPlan } from './ActualPitchTimingLearningFromPractice.test-support';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
const fixture = () => actualLearningFixture(cleanup);
const practiceCount = (f: Awaited<ReturnType<typeof fixture>>) => Number(f.base.db.prepare(
  "SELECT count(*) AS n FROM world_player_workload_activities WHERE json_extract(source_json,'$.kind')='PRACTICE'").get()!.n);

it('prospectively owns two future probe commands without executing either or requiring QUICK future workload now', async () => {
  const f = await fixture(), plan = f.planFor(f.first);
  const before = f.base.snapshot('world_player_workload_activities'), episode = f.episode();
  const receipt = f.adapter.acceptPairPlan(plan.sourceId);
  expect(receipt.source).toEqual(plan); expect(receipt.hash).toMatch(/^[a-f0-9]{64}$/);
  expect(f.adapter.acceptPairPlan(plan.sourceId)).toEqual(receipt);
  expect(plan.quickOpportunity.workloadRevision).toBe(plan.normalOpportunity.workloadRevision + 2);
  expect(f.base.owner.read(`pitch-practice:missing`)).toBeNull();
  expect(f.base.count('pitch_practice_attempts')).toBe(1);
  expect(f.base.snapshot('world_player_workload_activities')).toBe(before);
  expect(f.episode()).toEqual(episode);
});

it('retains the original event and both actually consumed probes without duplicating a measurement or workload', async () => {
  const f = await fixture(), timing = f.base.sources.timing.readHead('career-a', 'p1'), episode = f.episode();
  const pair = f.completePair(f.planFor(f.first));
  expect(pair.normal.events).toHaveLength(5); expect(pair.quick.events).toHaveLength(5);
  expect(pair.normal.frame.workload.revision).not.toBe(pair.quick.frame.workload.revision);
  expect(pair.normal.frame.workload.fatigue).toBe(pair.quick.frame.workload.fatigue);
  const recovery = f.base.sources.workload.readActivity(`probe-recovery:${pair.normal.frame.workload.revision + 1}`)!;
  expect(recovery.activity).toMatchObject({ kind: 'RECOVERY', durationHours: 2 });
  expect(recovery.after).toEqual(pair.quick.frame.workload);
  // The actual follow-through leaves an explicit two-hour recovery interval
  // before the prospective QUICK ready time, within the same local day.
  expect(pair.quick.opportunity.atDay).toBe(pair.normal.opportunity.atDay);
  expect(pair.quick.plannedDelivery.timeline.readyAtUs - pair.normal.plannedDelivery.timeline.followThroughEndUs)
    .toBeGreaterThanOrEqual(7_200_000_000);
  expect(pair.normal.opportunity.episode).toBeNull(); expect(pair.quick.opportunity.episode).toBeNull();
  expect(practiceCount(f)).toBe(3); expect(f.base.count('world_player_workload_activities')).toBe(4);
  expect(f.episode()).toEqual(episode);
  const report = f.adapter.acceptMeasurement(pair.report.sourceId);
  expect(report.practiceSourceEventId).toBe(pair.plan.original.activityId);
  expect(report.source).toEqual(pair.report);
  expect(report.source.normal.observation).toEqual(pair.normal.observation);
  expect(report.source.quick.observation).toEqual(pair.quick.observation);
  expect(f.adapter.acceptMeasurement(pair.report.sourceId)).toEqual(report);
  expect(f.base.sources.timing.readHead('career-a', 'p1')).toEqual(timing);
  expect(f.episode().practiceSourceEventIds).toEqual([pair.plan.original.activityId]);
});

it('rejects a plan accepted after a probe already started without relabeling the actual attempt', async () => {
  const f = await fixture(), plan = f.planFor(f.first);
  const begun = f.base.owner.begin(plan.normalOpportunity.sourceId);
  expect(() => f.adapter.acceptPairPlan(plan.sourceId)).toThrow(/started|prospective|probe|plan/i);
  expect(f.adapter.readPairPlan(plan.sourceId)).toBeNull();
  expect(f.base.owner.read(begun.attemptId)).toEqual(begun);
  expect(practiceCount(f)).toBe(1);
});

it.each(['mode', 'target', 'physics'] as const)('rejects a changed frozen prospective probe %s before body execution', async fault => {
  const f = await fixture(), plan = f.planFor(f.first); f.adapter.acceptPairPlan(plan.sourceId);
  const changed = structuredClone(plan.normalOpportunity);
  if (fault === 'mode') changed.timingIntent = { ...changed.timingIntent, deliveryMode: 'QUICK' };
  if (fault === 'target') changed.episode = f.base.opportunity.episode;
  if (fault === 'physics') changed.physics = { ...changed.physics, velocity: { ...changed.physics.velocity, z: changed.physics.velocity.z - 1 } };
  f.base.opportunities.set(changed.sourceId, changed);
  expect(() => f.base.owner.begin(changed.sourceId)).toThrow(/frozen|plan|probe|command|different/i);
  expect(f.base.count('pitch_practice_attempts')).toBe(1);
  expect(practiceCount(f)).toBe(1);
});

it('rejects a reserved probe Source whose canonical opportunity identity changes before execution', async () => {
  const f = await fixture(), plan = f.planFor(f.first); f.adapter.acceptPairPlan(plan.sourceId);
  const changed = { ...plan.normalOpportunity, opportunityId: 'escaped-reserved-probe' };
  f.base.opportunities.set(changed.sourceId, changed);
  const attempts = f.base.snapshot('pitch_practice_attempts'), workload = f.base.snapshot('world_player_workload_activities');
  expect(() => f.base.owner.begin(changed.sourceId)).toThrow(/frozen|reserved|identity|probe|command/i);
  expect(f.base.snapshot('pitch_practice_attempts')).toBe(attempts);
  expect(f.base.snapshot('world_player_workload_activities')).toBe(workload);
  expect(f.adapter.readPairPlan(plan.sourceId)!.source).toEqual(plan);
  f.base.opportunities.set(plan.normalOpportunity.sourceId, plan.normalOpportunity);
  expect(f.base.owner.begin(plan.normalOpportunity.sourceId).opportunity).toEqual(plan.normalOpportunity);
});

it('rejects QUICK before its paired NORMAL even when unrelated accepted workload reaches its revision', async () => {
  const f = await fixture(), plan = f.planFor(f.first); f.adapter.acceptPairPlan(plan.sourceId);
  f.acceptedRecovery(plan.normalOpportunity.atDay, 1);
  f.acceptedRecovery(plan.normalOpportunity.atDay, 1);
  expect(f.base.sources.workload.readHead('career-a', 'p1')!.revision).toBe(plan.quickOpportunity.workloadRevision);
  const attempts = f.base.snapshot('pitch_practice_attempts'), workload = f.base.snapshot('world_player_workload_activities');
  expect(() => f.base.owner.begin(plan.quickOpportunity.sourceId)).toThrow(/paired|normal|predecessor|probe|settled/i);
  expect(f.base.snapshot('pitch_practice_attempts')).toBe(attempts);
  expect(f.base.snapshot('world_player_workload_activities')).toBe(workload);
  expect(f.adapter.readPairPlan(plan.sourceId)!.source).toEqual(plan);
});

it('rejects a same-day QUICK when its intervening accepted recovery cannot fit the local interval', async () => {
  const f = await fixture(), plan = f.planFor(f.first);
  plan.quickOpportunity.readyAtUs = 60_000_000;
  f.adapter.acceptPairPlan(plan.sourceId);
  const normal = f.consumeProbe(plan.normalOpportunity).attempt;
  const recovery = f.acceptedRecovery(plan.normalOpportunity.atDay, 2);
  expect(recovery.revision).toBe(plan.quickOpportunity.workloadRevision);
  expect(recovery.fatigue).toBe(normal.frame.workload.fatigue);
  const availableUs = plan.quickOpportunity.readyAtUs - normal.plannedDelivery.timeline.followThroughEndUs;
  expect(availableUs).toBeGreaterThan(0); expect(availableUs).toBeLessThan(7_200_000_000);
  const attempts = f.base.snapshot('pitch_practice_attempts'), workload = f.base.snapshot('world_player_workload_activities');
  expect(() => f.base.owner.begin(plan.quickOpportunity.sourceId)).toThrow(/recovery|interval|clock|duration/i);
  expect(f.base.snapshot('pitch_practice_attempts')).toBe(attempts);
  expect(f.base.snapshot('world_player_workload_activities')).toBe(workload);
  expect(f.base.owner.read(normal.attemptId)).toEqual(normal);
});

it('reserves canonical probe identities across source aliases and different original practice events', async () => {
  const f = await fixture(), firstPlan = f.planFor(f.first); f.adapter.acceptPairPlan(firstPlan.sourceId);
  const opportunity = f.base.nextOpportunity(f.first, { sourceId: 'second-original', opportunityId: 'second-original', ordinal: 0,
    previousAttemptId: null, atDay: 14, readyAtUs: 0 });
  const second = f.base.complete(opportunity.sourceId); f.base.assess(second); f.base.owner.settle(second.attemptId);
  const candidate = f.planFor(second);
  const alias: PairPlan = { ...candidate, normalOpportunity: { ...candidate.normalOpportunity,
    sourceId: 'probe-source-alias', opportunityId: firstPlan.normalOpportunity.opportunityId, ordinal: firstPlan.normalOpportunity.ordinal } };
  f.plans.set(alias.sourceId, alias); f.base.opportunities.set(alias.normalOpportunity.sourceId, alias.normalOpportunity);
  expect(() => f.adapter.acceptPairPlan(alias.sourceId)).toThrow(/reserved|reuse|identity|probe/i);
  expect(f.adapter.readPairPlan(alias.sourceId)).toBeNull();
  expect(f.adapter.readPairPlan(firstPlan.sourceId)!.source).toEqual(firstPlan);
});

it('reserves a probe Source across different canonical identities and original practice events', async () => {
  const f = await fixture(), firstPlan = f.planFor(f.first); f.adapter.acceptPairPlan(firstPlan.sourceId);
  const opportunity = f.base.nextOpportunity(f.first, { sourceId: 'source-reservation-original', opportunityId: 'source-reservation-original',
    ordinal: 0, previousAttemptId: null, atDay: 14, readyAtUs: 0 });
  const second = f.base.complete(opportunity.sourceId); f.base.assess(second); f.base.owner.settle(second.attemptId);
  const candidate = f.planFor(second);
  candidate.normalOpportunity.sourceId = firstPlan.normalOpportunity.sourceId;
  f.plans.set(candidate.sourceId, candidate);
  const plans = f.base.snapshot('pitch_practice_pair_plans'), reservations = f.base.snapshot('pitch_practice_probe_reservations');
  expect(() => f.adapter.acceptPairPlan(candidate.sourceId)).toThrow(/reserved|reuse|identity|source|probe/i);
  expect(f.adapter.readPairPlan(candidate.sourceId)).toBeNull();
  expect(f.base.snapshot('pitch_practice_pair_plans')).toBe(plans);
  expect(f.base.snapshot('pitch_practice_probe_reservations')).toBe(reservations);
  expect(f.adapter.readPairPlan(firstPlan.sourceId)!.source).toEqual(firstPlan);
});

it('does not let a later day substitute for comparable BEFORE-fatigue', async () => {
  const f = await fixture(), plan = f.planFor(f.first);
  plan.quickOpportunity.atDay += 1;
  const pair = f.completePair(plan, { recoveryHours: 1 });
  expect(pair.quick.opportunity.atDay).toBe(pair.normal.opportunity.atDay + 1);
  expect(pair.quick.frame.workload.fatigue).not.toBe(pair.normal.frame.workload.fatigue);
  const timing = f.base.sources.timing.readHead('career-a', 'p1');
  expect(() => f.adapter.acceptMeasurement(pair.report.sourceId)).toThrow(/fatigue|condition|comparable|reference/i);
  expect(f.adapter.readMeasurement(pair.report.sourceId)).toBeNull();
  expect(f.base.sources.timing.readHead('career-a', 'p1')).toEqual(timing);
  expect(practiceCount(f)).toBe(3);
});

it.each(['completion', 'frame', 'raw', 'protocol', 'normalizer', 'missing_calibration'] as const)(
  'rejects changed standardized report %s binding without accepting numeric learning', async fault => {
    const f = await fixture(), pair = f.completePair(f.planFor(f.first)), changed = structuredClone(pair.report);
    if (fault === 'completion') changed.quick.completion.hash = '0'.repeat(64);
    if (fault === 'frame') changed.normal.frameHash = '0'.repeat(64);
    if (fault === 'raw') changed.quick.observation.motionToReleaseUs += 1;
    if (fault === 'protocol') changed.protocolVersion = 'changed';
    if (fault === 'normalizer') changed.normalizationSourceId = 'foreign-provider';
    if (fault === 'missing_calibration') changed.provenance.calibrationSourceId = '';
    f.reports.set(changed.sourceId, changed);
    const before = f.base.sources.timing.readHead('career-a', 'p1');
    expect(() => f.adapter.acceptMeasurement(changed.sourceId)).toThrow(/source|frame|raw|protocol|normaliz|calibration|completion|measurement|provenance/i);
    expect(f.adapter.readMeasurement(changed.sourceId)).toBeNull();
    expect(f.base.sources.timing.readHead('career-a', 'p1')).toEqual(before);
    f.reports.set(pair.report.sourceId, pair.report);
    expect(f.adapter.acceptMeasurement(pair.report.sourceId).source).toEqual(pair.report);
  });

it('keeps missing feedback, consolidation and final accepted input pending instead of freezing a fabricated final DTO', async () => {
  const f = await fixture(), pair = f.completePair(f.planFor(f.first)); f.adapter.acceptMeasurement(pair.report.sourceId);
  const before = f.base.sources.timing.readHead('career-a', 'p1'), episode = f.episode();
  const result = f.adapter.prepareLearning('future-final-source', [pair.report.sourceId], 0);
  expect(result.kind).toBe('pending');
  expect(f.adapter.readAcceptedLearning('future-final-source')).toBeNull();
  expect(f.adapter.settleLearning('future-final-source').kind).toBe('pending');
  expect(f.episode()).toEqual(episode); expect(episode.feedbackSourceEventIds).toEqual([]);
  expect(f.base.sources.timing.readHead('career-a', 'p1')).toEqual(before);
});

it.each(['pending', 'ready'] as const)('reserves each report for one final learning Source while its first request is %s', async state => {
  const f = await fixture(), evidence = f.completeLearningEvidence(), ids = evidence.pairs.map(pair => pair.report.sourceId);
  if (state === 'pending') f.learningInputs.delete(evidence.input.sourceId);
  expect(f.adapter.prepareLearning(evidence.input.sourceId, ids, 0).kind).toBe(state);
  const alias = { ...evidence.input, sourceId: `reused-${state}-learning` }; f.learningInputs.set(alias.sourceId, alias);
  const requests = f.base.snapshot('pitch_practice_learning_requests'), timing = f.base.snapshot('world_pitch_timing_updates');
  expect(() => f.adapter.prepareLearning(alias.sourceId, ids, 0)).toThrow(/claimed|reserved|reuse|report|source/i);
  expect(f.adapter.readAcceptedLearning(alias.sourceId)).toBeNull();
  expect(f.base.snapshot('pitch_practice_learning_requests')).toBe(requests);
  expect(f.base.snapshot('world_pitch_timing_updates')).toBe(timing);
  f.learningInputs.set(evidence.input.sourceId, evidence.input);
  expect(f.adapter.prepareLearning(evidence.input.sourceId, ids, 0).kind).toBe('ready');
  expect(f.adapter.settleLearning(evidence.input.sourceId).kind).toBe('complete');
});

it('uses distinct reports and historical exposure with later accepted feedback/consolidation, preserving NO_SOURCE_CHANGE', async () => {
  const f = await fixture(), ids = ['report:pair-plan-0', 'report:pair-plan-1', 'report:pair-plan-2'];
  expect(f.adapter.prepareLearning('accepted-actual-learning', ids, 0).kind).toBe('pending');
  expect(f.adapter.readAcceptedLearning('accepted-actual-learning')).toBeNull();
  const evidence = f.completeLearningEvidence(), before = f.base.sources.timing.readHead('career-a', 'p1')!;
  expect(evidence.pairs.map(p => p.report.sourceId)).toEqual(ids);
  expect(evidence.pairs[0].plan.original.episodeRevision).toBeLessThan(evidence.input.episode.revision);
  expect(() => f.adapter.prepareLearning(evidence.input.sourceId, ids, before.revision + 1)).toThrow(/stale|revision|frozen.*request|request.*different/i);
  expect(f.adapter.readAcceptedLearning(evidence.input.sourceId)).toBeNull();
  const ready = f.adapter.prepareLearning(evidence.input.sourceId, ids, before.revision);
  expect(ready).toMatchObject({ kind: 'ready', expectedTimingRevision: 0 });
  expect(f.adapter.readAcceptedLearning(evidence.input.sourceId)).toEqual(evidence.input);
  const result = f.adapter.settleLearning(evidence.input.sourceId);
  expect(result.kind).toBe('complete');
  if (result.kind !== 'complete') throw new Error('actual learning did not settle');
  expect(result.source.profile).toEqual(before.profile);
  expect(result.source.records.at(-1)!.changeKind).toBe('NO_SOURCE_CHANGE');
  expect(practiceCount(f)).toBe(9); expect(f.base.count('world_player_workload_activities')).toBe(12);
  expect(f.episode().practiceSourceEventIds).toHaveLength(3);
  expect(f.adapter.settleLearning(evidence.input.sourceId)).toEqual(result);
  f.clearAuthorities(); f.reopen();
  expect(f.adapter.settleLearning(evidence.input.sourceId)).toEqual(result);
  expect(f.base.sources.timing.readHead('career-a', 'p1')).toEqual(result.source);
  expect(practiceCount(f)).toBe(9);
});

it('rejects duplicated reports and accepted numeric values that differ from the bound report without poisoning corrected intake', async () => {
  const f = await fixture(), evidence = f.completeLearningEvidence(), ids = evidence.pairs.map(p => p.report.sourceId);
  expect(() => f.adapter.prepareLearning(evidence.input.sourceId, [ids[0], ids[0], ids[2]], 0)).toThrow(/duplicate|reuse|coverage|pair/i);
  const changed = { ...evidence.input, measurements: evidence.input.measurements.map((item, index) =>
    index === 0 ? { ...item, quickMotionToReleaseUs: 250_000 } : item) };
  f.learningInputs.set(changed.sourceId, changed);
  expect(() => f.adapter.prepareLearning(changed.sourceId, ids, 0)).toThrow(/measurement|report|different|standard/i);
  expect(f.adapter.readAcceptedLearning(changed.sourceId)).toBeNull();
  f.learningInputs.set(evidence.input.sourceId, evidence.input);
  expect(f.adapter.prepareLearning(evidence.input.sourceId, ids, 0).kind).toBe('ready');
  f.learningInputs.set(changed.sourceId, changed);
  expect(() => f.adapter.prepareLearning(changed.sourceId, ids, 0)).toThrow(/frozen|changed|different|measurement/i);
  expect(f.adapter.readAcceptedLearning(changed.sourceId)).toEqual(evidence.input);
  const neutral = { ...evidence.input, practice: { ...evidence.input.practice,
    policy: { ...evidence.input.practice.policy, selfDirectedShare: 0.75 } } };
  expect(assessDevelopmentPracticeExposure(neutral.episode, neutral.practice).effectiveExposure)
    .toBe(assessDevelopmentPracticeExposure(evidence.input.episode, evidence.input.practice).effectiveExposure);
  f.learningInputs.set(neutral.sourceId, neutral);
  expect(() => f.adapter.prepareLearning(neutral.sourceId, ids, 0)).toThrow(/frozen|changed|different|policy|source/i);
  expect(f.adapter.readAcceptedLearning(neutral.sourceId)).toEqual(evidence.input);
  f.learningInputs.set(evidence.input.sourceId, evidence.input);
  expect(f.adapter.settleLearning(evidence.input.sourceId).kind).toBe('complete');
});

it('rejects supplied missing or insufficient exposure without poisoning corrected accepted intake', async () => {
  const f = await fixture(), evidence = f.completeLearningEvidence(), ids = evidence.pairs.map(pair => pair.report.sourceId);
  const missing = structuredClone(evidence.input);
  Reflect.deleteProperty(missing.practice.repetitions[0], 'coachingFit');
  const insufficient = { ...evidence.input, practice: { ...evidence.input.practice,
    repetitions: evidence.input.practice.repetitions.map(repetition => ({ ...repetition, trainingStimulus: 0 })) } };
  const requests = f.base.snapshot('pitch_practice_learning_requests'), updates = f.base.snapshot('world_pitch_timing_updates');
  const head = f.base.sources.timing.readHead('career-a', 'p1'), workload = f.base.snapshot('world_player_workload_activities');
  for (const invalid of [missing, insufficient]) {
    f.learningInputs.set(evidence.input.sourceId, invalid);
    expect(() => f.adapter.prepareLearning(evidence.input.sourceId, ids, 0)).toThrow(/practice|exposure|factor|evidence/i);
    expect(f.adapter.readAcceptedLearning(evidence.input.sourceId)).toBeNull();
    expect(f.base.snapshot('pitch_practice_learning_requests')).toBe(requests);
    expect(f.base.snapshot('world_pitch_timing_updates')).toBe(updates);
    expect(f.base.sources.timing.readHead('career-a', 'p1')).toEqual(head);
    expect(f.base.snapshot('world_player_workload_activities')).toBe(workload);
  }
  f.learningInputs.set(evidence.input.sourceId, evidence.input);
  expect(f.adapter.prepareLearning(evidence.input.sourceId, ids, 0).kind).toBe('ready');
  expect(f.adapter.readAcceptedLearning(evidence.input.sourceId)).toEqual(evidence.input);
  expect(f.adapter.settleLearning(evidence.input.sourceId).kind).toBe('complete');
});

it('keeps original physical proofs and direct timing reads acyclic after a supplied measured source change and reopen', async () => {
  const f = await fixture(), evidence = f.completeLearningEvidence({ standardizedQuickUs: 250_000 });
  const original = f.base.owner.read(f.first.attemptId), raw = evidence.pairs.map(p => [p.normal.observation, p.quick.observation]);
  const ids = evidence.pairs.map(p => p.report.sourceId);
  f.adapter.prepareLearning(evidence.input.sourceId, ids, 0);
  const result = f.adapter.settleLearning(evidence.input.sourceId);
  if (result.kind !== 'complete') throw new Error('accepted changed learning did not settle');
  expect(result.source.records.at(-1)!.changeKind).toBe('SOURCE_CHANGED');
  expect(result.source.profile.quickSpeedFactor).toBe(2.4);
  expect(f.base.owner.read(f.first.attemptId)).toEqual(original);
  expect(f.base.sources.timing.readHead('career-a', 'p1')).toEqual(result.source);
  const last = evidence.pairs.at(-1)!.quick;
  const opportunity = f.base.nextOpportunity(last, { sourceId: 'after-learning-physical', opportunityId: 'after-learning-physical', ordinal: 0,
    previousAttemptId: null, atDay: 17, readyAtUs: 0, episode: null });
  const next = f.base.owner.begin(opportunity.sourceId);
  expect(next.frame.timing.revision).toBe(1); expect(next.frame.timing.profile.quickSpeedFactor).toBe(2.4);
  expect(f.adapter.settleLearning(evidence.input.sourceId)).toEqual(result);
  f.clearAuthorities(); f.reopen();
  expect(f.base.sources.timing.readHead('career-a', 'p1')).toEqual(result.source);
  expect(f.base.owner.read(f.first.attemptId)).toEqual(original);
  expect(f.base.owner.read(next.attemptId)).toEqual(next);
  expect(evidence.pairs.map(p => [f.base.owner.read(p.normal.attemptId)!.observation, f.base.owner.read(p.quick.attemptId)!.observation])).toEqual(raw);
  expect(f.base.sources.timing.apply(evidence.input.sourceId, 0)).toEqual(result.source);
});

it.each(['write', 'retry'] as const)('rejects original probe corruption on timing %s through the consumer guard', async phase => {
  const f = await fixture(), evidence = f.completeLearningEvidence(), ids = evidence.pairs.map(p => p.report.sourceId);
  f.adapter.prepareLearning(evidence.input.sourceId, ids, 0);
  if (phase === 'retry') f.adapter.settleLearning(evidence.input.sourceId);
  const beforeUpdates = f.base.snapshot('world_pitch_timing_updates'), beforeHead = f.base.snapshot('world_pitch_timing_heads');
  const target = evidence.pairs[0].normal.attemptId;
  if (phase === 'write') {
    f.base.db.exec(`CREATE TRIGGER corrupt_probe_before_learning BEFORE INSERT ON world_pitch_timing_updates BEGIN
      UPDATE pitch_practice_attempts SET frame_json=json_set(frame_json,'$.workload.fatigue',0.01) WHERE attempt_id='${target}'; END;`);
  } else {
    f.base.db.prepare("UPDATE pitch_practice_attempts SET frame_json=json_set(frame_json,'$.workload.fatigue',0.01) WHERE attempt_id=?").run(target);
  }
  let sawInsertedTimingRow = false, sawMutatedProbe = false, sawConsumerConnection = false;
  const witness = phase === 'write' ? witnessSqliteWrite(`INSERT INTO world_pitch_timing_updates
          (source_id, career_id, player_id, before_revision,
           after_revision, source_json, state_json)
          VALUES (?, ?, ?, ?, ?, ?, ?)`, connection => {
    sawConsumerConnection = connection !== f.base.db;
    const inserted = connection.prepare('SELECT before_revision, after_revision FROM world_pitch_timing_updates WHERE source_id=?')
      .get(evidence.input.sourceId);
    sawInsertedTimingRow = inserted?.before_revision === 0 && inserted.after_revision === 1;
    const changed = connection.prepare('SELECT frame_json FROM pitch_practice_attempts WHERE attempt_id=?').get(target);
    sawMutatedProbe = typeof changed?.frame_json === 'string'
      && (JSON.parse(changed.frame_json) as { workload: { fatigue: number } }).workload.fatigue === 0.01;
    return sawConsumerConnection && sawInsertedTimingRow && sawMutatedProbe;
  }) : null;
  try {
    expect(() => f.base.sources.timing.apply(evidence.input.sourceId, 0)).toThrow(/practice|source|frame|proof|corrupt|evidence/i);
    if (witness) {
      expect(witness.wasReached()).toBe(true);
      expect(sawConsumerConnection).toBe(true);
      expect(sawInsertedTimingRow).toBe(true);
      expect(sawMutatedProbe).toBe(true);
    }
  } finally { witness?.close(); }
  expect(f.base.snapshot('world_pitch_timing_updates')).toBe(beforeUpdates);
  expect(f.base.snapshot('world_pitch_timing_heads')).toBe(beforeHead);
  if (phase === 'write') {
    expect(f.base.owner.read(target)).toEqual(evidence.pairs[0].normal);
    f.base.db.exec('DROP TRIGGER corrupt_probe_before_learning');
    expect(f.adapter.settleLearning(evidence.input.sourceId).kind).toBe('complete');
  } else {
    expect(() => f.base.sources.timing.readHead('career-a', 'p1')).toThrow(/practice|source|frame|proof|corrupt|evidence/i);
  }
});

it('freezes accepted plan/report versions and rejects another Source for the same physical pair', async () => {
  const f = await fixture(), plan = f.planFor(f.first), acceptedPlan = f.adapter.acceptPairPlan(plan.sourceId);
  f.plans.set(plan.sourceId, { ...plan, protocol: { ...plan.protocol, normalizationVersion: 'changed' } });
  expect(() => f.adapter.acceptPairPlan(plan.sourceId)).toThrow(/frozen|different|changed|protocol/i);
  expect(f.adapter.readPairPlan(plan.sourceId)).toEqual(acceptedPlan);
  f.plans.set(plan.sourceId, plan);
  const pair = f.completePair(plan), acceptedReport = f.adapter.acceptMeasurement(pair.report.sourceId);
  f.reports.set(pair.report.sourceId, { ...pair.report, standardized: { ...pair.report.standardized, quickMotionToReleaseUs: 250_000 } });
  expect(() => f.adapter.acceptMeasurement(pair.report.sourceId)).toThrow(/frozen|different|changed|measurement/i);
  expect(f.adapter.readMeasurement(pair.report.sourceId)).toEqual(acceptedReport);
  const alias = { ...pair.report, sourceId: 'copied-pair-report' }; f.reports.set(alias.sourceId, alias);
  expect(() => f.adapter.acceptMeasurement(alias.sourceId)).toThrow(/alias|already|frozen|reuse|pair|measurement/i);
  expect(f.adapter.readMeasurement(alias.sourceId)).toBeNull();
  expect(practiceCount(f)).toBe(3);
});
