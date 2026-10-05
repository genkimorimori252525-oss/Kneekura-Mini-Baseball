import { afterEach, expect, it, vi } from 'vitest';
import { practiceAttemptId, practiceHash, practiceJson } from './PitchPracticeAttempt';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { actualLearningFixture } from './ActualPitchTimingLearningFromPractice.test-support';
import type { PracticeOpportunity } from './PitchPracticeAttempt.test-support';
import type { PracticeOrderDecisionInput, PracticeOrderOwner, PracticePrescription, IssuedPracticeOrderDecision } from './OwnedPitchPracticeOrder.test-support';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
const orderSource = (executionId: string) => `practice-order:${practiceHash(['career-a', executionId])}`;

async function fixture() {
  const prescriptions = new Map<string, PracticePrescription>();
  const f = await actualLearningFixture(cleanup, { controlDomainIds: ['ROSTER', 'PITCH_PRACTICE'],
    manualControlDomainIds: ['PITCH_PRACTICE'], practiceOrderSources: true,
    extraPracticeAuthority: { readAcceptedPracticePrescription: id => prescriptions.get(id) ?? null } });
  const module = await vi.importActual<{ createOwnedPitchPracticeOrder(input: unknown): PracticeOrderOwner }>('./OwnedPitchPracticeOrder');
  let orders = module.createOwnedPitchPracticeOrder({ practice: f.base.owner });
  const prescribe = (opportunity: PracticeOpportunity, label: string): PracticePrescription => {
    const { workloadRevision: _workload, timingRevision: _timing, releaseRevision: _release, ...command } = opportunity;
    const value: PracticePrescription = { ...command, sourceId: `prescription:${label}`, sourceVersion: 'fixture-order-v1', clubId: 'club-a',
      participation: { assignmentUnitId: 'first', availabilityStatus: 'AVAILABLE', availabilityEvidenceId: 'accepted-health' },
      window: { startsAtUs: opportunity.readyAtUs, endsAtUs: opportunity.readyAtUs + 30_000_000 } };
    prescriptions.set(value.sourceId, value); return value;
  };
  const request = (prescription: PracticePrescription, label: string, prospectiveExecutionId?: string) => {
    const sources = f.base.sources.orders!, control = sources.control.readHead('career-a')!;
    const input: PracticeOrderDecisionInput & { prospectiveExecutionId?: string } = {
      sourceId: `decision-source:${label}`, prescriptionSourceId: prescription.sourceId, careerId: 'career-a', clubId: 'club-a',
      decisionId: `decision:${label}`, contextId: `context:${label}`, actionId: `action:${label}`,
      expected: { worldRevision: control.worldRevision, controlRevision: control.control.revision,
        clubRevision: sources.world.readClub('career-a', 'club-a')!.revision,
        rosterRevision: sources.roster.readHead('career-a', 'club-a')!.roster.revision,
        workloadRevision: f.base.sources.workload.readHead('career-a', 'p1')!.revision,
        timingRevision: f.base.sources.timing.readHead('career-a', 'p1')!.revision,
        releaseRevision: f.base.sources.release.readHead('career-a', 'p1')!.revision },
      ...(prospectiveExecutionId === undefined ? {} : { prospectiveExecutionId }) };
    return input;
  };
  const prepare = (input: ReturnType<typeof request>) => {
    const result = orders.prepareOrderDecision(input);
    if (result.kind !== 'ready') throw new Error('prescribed reservation order stayed pending');
    return result.decision;
  };
  const issue = (decision: IssuedPracticeOrderDecision, executionId: string) => orders.issueOrder({ decisionSourceId: decision.sourceId, executionId,
    submission: { decisionId: decision.opportunity.decisionId, contextId: decision.opportunity.contextId,
      expectedControlRevision: decision.control.revision, expectedWorldRevision: decision.opportunity.worldRevision,
      actionId: decision.opportunity.legalActionIds[0], actor: { kind: 'HUMAN', controllerId: 'human' } } });
  const snapshot = () => JSON.stringify(Object.fromEntries(['pitch_practice_order_decisions', 'pitch_practice_orders',
    'pitch_practice_pair_plans', 'pitch_practice_probe_reservations', 'world_control_heads', 'world_decision_revision_events',
    'pitch_practice_attempts', 'world_player_workload_activities', 'world_development_learning_events'].map(table =>
    [table, f.base.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()])));
  return { f, prescriptions, prescribe, request, prepare, issue, snapshot, get orders() { return orders; },
    reopen() { prescriptions.clear(); f.clearAuthorities(); f.reopen(); orders = module.createOwnedPitchPracticeOrder({ practice: f.base.owner }); } };
}

it.each(['canonical', 'source'] as const)('preserves a first pair reservation against a conflicting order %s claim', async fault => {
  const c = await fixture(), { f } = c, plan = f.planFor(f.first), executionId = 'conflicting-world-order';
  if (fault === 'source') {
    plan.normalOpportunity.sourceId = orderSource(executionId);
    f.base.opportunities.set(plan.normalOpportunity.sourceId, plan.normalOpportunity);
  }
  const accepted = f.adapter.acceptPairPlan(plan.sourceId);
  const prescription = c.prescribe({ ...plan.normalOpportunity,
    ...(fault === 'source' ? { opportunityId: 'different-order-opportunity' } : {}) }, 'conflict');
  const input = c.request(prescription, 'conflict');
  if (fault === 'canonical') {
    const before = c.snapshot();
    expect(() => c.orders.prepareOrderDecision(input)).toThrow(/reserved|identity|source|probe|opportunity/i);
    expect(c.snapshot()).toBe(before);
  } else {
    const prepared = c.prepare(input), before = c.snapshot();
    expect(() => c.issue(prepared, executionId)).toThrow(/reserved|identity|source|probe|opportunity/i);
    expect(c.snapshot()).toBe(before);
  }
  expect(f.adapter.readPairPlan(plan.sourceId)).toEqual(accepted);
  expect(f.base.owner.begin(plan.normalOpportunity.sourceId).opportunity).toEqual(plan.normalOpportunity);
});

it.each(['canonical', 'source'] as const)('preserves a first owned order against a conflicting pair %s claim and permits an exact pair', async fault => {
  const c = await fixture(), { f } = c, plan = f.planFor(f.first);
  const prescribed = c.prescribe(plan.normalOpportunity, 'first-owned'), owned = c.issue(c.prepare(c.request(prescribed, 'first-owned')), 'first-owned-execution');
  if (fault === 'source') plan.normalOpportunity = { ...plan.normalOpportunity, sourceId: owned.sourceId, opportunityId: 'different-probe-opportunity' };
  const before = c.snapshot();
  expect(() => f.adapter.acceptPairPlan(plan.sourceId)).toThrow(/reserved|identity|source|order|probe|opportunity/i);
  expect(c.snapshot()).toBe(before); expect(c.orders.readOrder(owned.sourceId)).toEqual(owned);
  // The failed intake creates no row. The exact already-issued command is a
  // lawful probe and keeps the legacy plan's existing evidence representation.
  const exact = { ...plan, normalOpportunity: owned.opportunity };
  f.plans.set(exact.sourceId, exact);
  expect(f.adapter.acceptPairPlan(exact.sourceId).source).toEqual(exact);
  expect(f.base.owner.begin(owned.sourceId).opportunity).toEqual(owned.opportunity);
});

it('composes a prospective pair with real NORMAL and later QUICK orders while separating frame and consumed authority evidence', async () => {
  const c = await fixture(), { f } = c, raw = f.planFor(f.first);
  const normalExecution = 'matching-normal-execution', quickExecution = 'matching-quick-execution';
  const plan = { ...raw, protocol: { ...raw.protocol, frameEvidenceVersion: 'BODY_FRAME_V1' as const },
    normalOpportunity: { ...raw.normalOpportunity, sourceId: orderSource(normalExecution), sourceVersion: 'owned-pitch-practice-order-v1' },
    quickOpportunity: { ...raw.quickOpportunity, sourceId: orderSource(quickExecution), sourceVersion: 'owned-pitch-practice-order-v1' } };
  f.plans.set(plan.sourceId, plan);
  f.base.opportunities.set(plan.normalOpportunity.sourceId, plan.normalOpportunity);
  f.base.opportunities.set(plan.quickOpportunity.sourceId, plan.quickOpportunity);
  const accepted = f.adapter.acceptPairPlan(plan.sourceId);
  const normalPrescription = c.prescribe(plan.normalOpportunity, 'matching-normal');
  const preparedNormal = c.prepare(c.request(normalPrescription, 'matching-normal', normalExecution));
  const beforeWrongExecution = c.snapshot();
  expect(() => c.issue(preparedNormal, 'changed-prospective-identity')).toThrow(/prospective|execution|identity|source/i);
  expect(c.snapshot()).toBe(beforeWrongExecution);
  const normalOrder = c.issue(preparedNormal, normalExecution);
  expect(normalOrder.opportunity).toEqual(plan.normalOpportunity);
  expect(f.adapter.readPairPlan(plan.sourceId)).toEqual(accepted);

  const originalTiming = f.base.db.prepare('SELECT source_json FROM world_pitch_timing_baselines WHERE source_id=?').get(f.base.timingInput.sourceId) as { source_json: string };
  f.base.db.prepare("UPDATE world_pitch_timing_baselines SET source_json=json_set(source_json,'$.profile.normalMotionToReleaseUs',999) WHERE source_id=?")
    .run(f.base.timingInput.sourceId);
  expect(() => f.adapter.readPairPlan(plan.sourceId)).toThrow(/source|frame|timing|corrupt|evidence/i);
  f.base.db.prepare('UPDATE world_pitch_timing_baselines SET source_json=? WHERE source_id=?').run(originalTiming.source_json, f.base.timingInput.sourceId);
  expect(f.adapter.readPairPlan(plan.sourceId)).toEqual(accepted);

  const normal = f.consumeProbe(normalOrder.opportunity).attempt;
  expect(normal.events).toHaveLength(5);
  const recovered = f.acceptedRecovery(plan.normalOpportunity.atDay, 2);
  expect(recovered.revision).toBe(plan.quickOpportunity.workloadRevision);
  expect(recovered.fatigue).toBe(normal.frame.workload.fatigue);
  const quickPrescription = c.prescribe(plan.quickOpportunity, 'matching-quick');
  const quickOrder = c.issue(c.prepare(c.request(quickPrescription, 'matching-quick', quickExecution)), quickExecution);
  expect(quickOrder.opportunity).toEqual(plan.quickOpportunity);
  const quick = f.consumeProbe(quickOrder.opportunity).attempt;
  expect(quick.events).toHaveLength(5);
  expect(quick.frame.workload.revision).toBe(normal.frame.workload.revision + 2);
  expect(quick.frame.workload.fatigue).toBe(normal.frame.workload.fatigue);
  expect(quick.plannedDelivery.timeline.readyAtUs - normal.plannedDelivery.timeline.followThroughEndUs).toBeGreaterThanOrEqual(7_200_000_000);
  expect(f.base.count('world_player_workload_activities')).toBe(4);
  expect(f.episode().practiceSourceEventIds).toEqual([plan.original.activityId]);
  expect(f.adapter.readPairPlan(plan.sourceId)).toEqual(accepted);

  const row = f.base.db.prepare('SELECT order_json FROM pitch_practice_orders WHERE source_id=?').get(normalOrder.sourceId) as { order_json: string };
  f.base.db.prepare("UPDATE pitch_practice_orders SET order_json=json_set(order_json,'$.opportunity.practiceSeed',999) WHERE source_id=?").run(normalOrder.sourceId);
  expect(f.adapter.readPairPlan(plan.sourceId)).toEqual(accepted);
  expect(() => f.base.owner.read(normal.attemptId)).toThrow(/order|source|corrupt|evidence/i);
  f.base.db.prepare('UPDATE pitch_practice_orders SET order_json=? WHERE source_id=?').run(row.order_json, normalOrder.sourceId);
  c.reopen();
  expect(f.adapter.readPairPlan(plan.sourceId)).toEqual(accepted);
  expect(c.orders.readOrder(normalOrder.sourceId)).toEqual(normalOrder);
  expect(c.orders.readOrder(quickOrder.sourceId)).toEqual(quickOrder);
  expect(f.base.owner.read(normal.attemptId)).toEqual(normal);
  expect(f.base.owner.read(quick.attemptId)).toEqual(quick);
});

it.each(['prepared', 'attempt', 'order', 'probe'] as const)('reserves the prospective derived Source at preparation against an existing %s', async priorKind => {
  const c = await fixture(), { f } = c, plan = f.planFor(f.first), executionId = 'prospective-source-reservation';
  const sourceId = orderSource(executionId);
  if (priorKind === 'prepared') {
    const first = c.prescribe(plan.normalOpportunity, 'first-prospective');
    c.prepare(c.request(first, 'first-prospective', executionId));
  } else if (priorKind === 'attempt') {
    const ordinary = { ...plan.normalOpportunity, sourceId, opportunityId: 'ordinary-before-prospective-claim' };
    f.base.opportunities.set(sourceId, ordinary);
    // Requires the separately reviewed legacy-prefix repair; never synthesize an old receipt.
    f.consumeProbe(ordinary);
  } else if (priorKind === 'order') {
    const first = c.prescribe(plan.normalOpportunity, 'first-issued');
    c.issue(c.prepare(c.request(first, 'first-issued')), executionId);
  } else {
    plan.normalOpportunity.sourceId = sourceId;
    f.base.opportunities.set(sourceId, plan.normalOpportunity);
    f.adapter.acceptPairPlan(plan.sourceId);
  }
  const candidate = c.prescribe({ ...plan.normalOpportunity, opportunityId: 'different-prospective-command',
    ...(priorKind === 'attempt' ? { atDay: 14, readyAtUs: 0 } : {}) }, 'conflicting-prospective');
  const input = c.request(candidate, 'conflicting-prospective', executionId), before = c.snapshot();
  expect(() => c.orders.prepareOrderDecision(input)).toThrow(/already|reserved|collision|claimed/i);
  expect(c.snapshot()).toBe(before);
  expect(c.orders.readOrderDecision(input.sourceId)).toBeNull();
});

it('rejects a coherent later probe reservation takeover on the actual World issuance write', async () => {
  const c = await fixture(), { f } = c, raw = f.planFor(f.first);
  const prescribed = c.prescribe({ ...raw.normalOpportunity, opportunityId: 'order-before-later-pair' }, 'before-later-pair');
  const decision = c.prepare(c.request(prescribed, 'before-later-pair'));
  const plan = { ...raw, protocol: { ...raw.protocol, frameEvidenceVersion: 'BODY_FRAME_V1' as const } };
  f.plans.set(plan.sourceId, plan);
  const accepted = f.adapter.acceptPairPlan(plan.sourceId), before = c.snapshot();
  let sawOrderAndWorld = false, sawCoherentConflictingPlan = false;
  const witness = witnessSqliteWrite("INSERT INTO world_decision_revision_events (career_id,world_revision,source_kind,source_event_id,event_json) VALUES(?,?,'PITCH_PRACTICE_ORDER',?,?)", db => {
    const orderRow = db.prepare('SELECT order_json FROM pitch_practice_orders WHERE decision_source_id=?').get(decision.sourceId) as { order_json: string };
    const order = JSON.parse(orderRow.order_json) as { sourceId: string; opportunity: PracticeOpportunity; execution: { worldRevision: number } };
    sawOrderAndWorld = db !== f.base.db && Boolean(db.prepare('SELECT 1 FROM world_decision_revision_events WHERE career_id=? AND world_revision=?')
      .get('career-a', order.execution.worldRevision));
    const row = db.prepare('SELECT * FROM pitch_practice_pair_plans WHERE source_id=?').get(plan.sourceId) as {
      reference_frame_json: string; reference_evidence_json: string; after_sequence: number };
    const conflicting = { ...plan, normalOpportunity: { ...order.opportunity, practiceSeed: order.opportunity.practiceSeed + 1 } };
    const hash = practiceHash({ source: conflicting, referenceFrame: JSON.parse(row.reference_frame_json),
      referenceEvidence: JSON.parse(row.reference_evidence_json), afterSequence: row.after_sequence });
    db.prepare('UPDATE pitch_practice_pair_plans SET source_json=?,source_hash=? WHERE source_id=?')
      .run(practiceJson(conflicting), hash, plan.sourceId);
    db.prepare("UPDATE pitch_practice_probe_reservations SET attempt_id=?,source_id=?,opportunity_json=? WHERE plan_source_id=? AND mode='NORMAL'")
      .run(practiceAttemptId(conflicting.normalOpportunity), order.sourceId, practiceJson(conflicting.normalOpportunity), plan.sourceId);
    const reread = f.adapter.readPairPlan(plan.sourceId);
    sawCoherentConflictingPlan = reread?.hash === hash && reread.source.normalOpportunity.sourceId === order.sourceId
      && reread.source.normalOpportunity.practiceSeed !== order.opportunity.practiceSeed;
    return sawOrderAndWorld && sawCoherentConflictingPlan;
  });
  try {
    expect(() => c.issue(decision, 'later-pair-takeover')).toThrow(/reserved|probe|source|opportunity|changed/i);
    expect(witness.wasReached()).toBe(true); expect(sawOrderAndWorld).toBe(true); expect(sawCoherentConflictingPlan).toBe(true);
  } finally { witness.close(); }
  expect(c.snapshot()).toBe(before);
  expect(f.adapter.readPairPlan(plan.sourceId)).toEqual(accepted);
  expect(c.orders.readOrder(orderSource('later-pair-takeover'))).toBeNull();
});
