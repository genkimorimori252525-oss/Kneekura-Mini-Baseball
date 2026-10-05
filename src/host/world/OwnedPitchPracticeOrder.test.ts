import { afterEach, expect, it } from 'vitest';
import { selectControlledDecision } from '../../core/world/control/ControlledDecision';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { practiceOrderFixture } from './OwnedPitchPracticeOrder.test-support';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
const fixture = (options?: Parameters<typeof practiceOrderFixture>[1]) => practiceOrderFixture(cleanup, options);

it('keeps missing prescription pending with zero intake rows and accepts later corrected input', async () => {
  const f = await fixture(), request = f.request(), before = f.snapshot();
  f.prescriptions.delete(f.prescription.sourceId);
  expect(f.owner.prepareOrderDecision(request)).toEqual({ kind: 'pending', reason: 'practice_prescription_missing' });
  expect(f.snapshot()).toBe(before); expect(f.owner.readOrderDecision(request.sourceId)).toBeNull();
  f.prescriptions.set(f.prescription.sourceId, f.prescription);
  expect(f.owner.prepareOrderDecision(request).kind).toBe('ready');
  expect(f.rows('pitch_practice_order_decisions')).toHaveLength(1);
  expect(f.rows('pitch_practice_orders')).toHaveLength(0);
});

it('issues one actual Human World order without producing body motion, workload or learning', async () => {
  const f = await fixture(), before = f.control.readHead('career-a')!, episode = f.base.sources.episodes.read('episode');
  const issued = f.prepare();
  expect(issued.opportunity.domainId).toBe('PITCH_PRACTICE');
  expect(issued.control).toEqual(before.control);
  expect(f.control.readHead('career-a')).toEqual(before);
  const selected = selectControlledDecision(issued.control, issued.opportunity, f.submission(issued));
  if (!selected.ok) throw new Error('genuine Human fixture submission rejected');
  const order = f.issue(issued);
  expect(order.decision).toEqual(selected.value); expect(order.decision.origin).toBe('HUMAN_OVERRIDE');
  expect(order.projection.managerSelfChosenEvidence).toBeNull();
  expect(order.opportunity.sourceId).toBe(order.sourceId);
  expect(order.opportunity).toMatchObject({ careerId: 'career-a', playerId: 'p1', workloadRevision: 0, timingRevision: 0, releaseRevision: 0 });
  expect(order.execution.eventIds).toEqual([order.sourceId]);
  expect(order.execution.worldRevision).toBe(before.worldRevision + 1);
  expect(f.control.readHead('career-a')!.worldRevision).toBe(before.worldRevision + 1);
  expect(f.rows('pitch_practice_orders')).toHaveLength(1);
  expect(f.rows('world_decision_revision_events')).toHaveLength(2);
  expect(f.rows('pitch_practice_attempts')).toHaveLength(0);
  expect(f.rows('world_player_workload_activities')).toHaveLength(0);
  expect(f.base.sources.episodes.read('episode')).toEqual(episode);
  expect(f.issue(issued)).toEqual(order); expect(f.owner.readOrder(order.sourceId)).toEqual(order);
});

it('retains the existing explicit Human override when the practice domain is delegated', async () => {
  const f = await fixture({ delegated: true }), issued = f.prepare();
  expect(issued.control.manualDomainIds).toEqual([]);
  const order = f.issue(issued);
  expect(order.decision.manualDomain).toBe(false); expect(order.decision.origin).toBe('HUMAN_OVERRIDE');
  expect(order.projection.managerSelfChosenEvidence).toBeNull();
});

it('rejects Manager submissions without fabricating their missing durable selection trace', async () => {
  const f = await fixture({ delegated: true }), issued = f.prepare(), before = f.snapshot();
  const submission = { ...f.submission(issued), actor: { kind: 'MANAGER' as const, managerId: 'manager-a',
    appointmentId: 'appointment-a', traceId: 'caller-invented-trace' } };
  // Generic control would allow this actor; the unsupported producer path must not.
  expect(selectControlledDecision(issued.control, issued.opportunity, submission).ok).toBe(true);
  expect(() => f.owner.issueOrder({ decisionSourceId: issued.sourceId, executionId: 'unproved-manager-order', submission }))
    .toThrow(/manager|Human|unsupported|trace/i);
  expect(f.snapshot()).toBe(before);
});

it('requires prior host registration of its own domain without changing control permissions', async () => {
  const f = await fixture({ registered: false }), before = f.snapshot();
  expect(() => f.owner.prepareOrderDecision(f.request())).toThrow(/domain|registered|capability/i);
  expect(f.snapshot()).toBe(before);
  expect(f.control.readHead('career-a')!.control.domainIds).toEqual(['ROSTER']);
});

it.each(['controller', 'action', 'control_revision', 'world_revision'] as const)('rejects invalid Human selection %s without order or World writes', async fault => {
  const f = await fixture(), issued = f.prepare(), before = f.snapshot(), valid = f.submission(issued);
  const submission = { ...valid,
    ...(fault === 'controller' ? { actor: { kind: 'HUMAN' as const, controllerId: 'foreign-human' } } : {}),
    ...(fault === 'action' ? { actionId: 'unissued-action' } : {}),
    ...(fault === 'control_revision' ? { expectedControlRevision: valid.expectedControlRevision + 1 } : {}),
    ...(fault === 'world_revision' ? { expectedWorldRevision: valid.expectedWorldRevision + 1 } : {}),
  };
  expect(() => f.owner.issueOrder({ decisionSourceId: issued.sourceId, executionId: 'invalid-selection', submission }))
    .toThrow(/control|Human|action|revision|stale|authority|decision/i);
  expect(f.snapshot()).toBe(before);
});

it.each(['worldRevision', 'controlRevision', 'clubRevision', 'rosterRevision', 'workloadRevision', 'timingRevision', 'releaseRevision'] as const)(
  'rejects stale prospective %s before freezing any intake row', async field => {
    const f = await fixture(), request = f.request(), before = f.snapshot(); request.expected[field] += 1;
    expect(() => f.owner.prepareOrderDecision(request)).toThrow(/stale|revision|source/i);
    expect(f.snapshot()).toBe(before); expect(f.owner.readOrderDecision(request.sourceId)).toBeNull();
    expect(f.owner.prepareOrderDecision(f.request()).kind).toBe('ready');
  });

it.each(['club', 'player', 'assignment', 'availability', 'outside_window', 'window_too_short'] as const)(
  'rejects an invalid prescribed %s without a pending row or physical effect', async fault => {
    const f = await fixture(), changed = structuredClone(f.prescription), before = f.snapshot();
    if (fault === 'club') changed.clubId = 'club-b';
    if (fault === 'player') changed.playerId = 'foreign-player';
    if (fault === 'assignment') changed.participation.assignmentUnitId = 'reserve';
    if (fault === 'availability') changed.participation.availabilityEvidenceId = 'unaccepted-health';
    if (fault === 'outside_window') changed.readyAtUs = changed.window.endsAtUs + 1;
    if (fault === 'window_too_short') changed.window.endsAtUs = 1;
    f.prescriptions.set(changed.sourceId, changed);
    expect(() => f.owner.prepareOrderDecision(f.request())).toThrow(/club|player|scope|assignment|availability|evidence|window|time|prescription/i);
    expect(f.snapshot()).toBe(before);
    f.prescriptions.set(f.prescription.sourceId, f.prescription);
    expect(f.owner.prepareOrderDecision(f.request()).kind).toBe('ready');
  });

it('freezes the complete prescription and decision identity across changed accepted input', async () => {
  const f = await fixture(), request = f.request(), issued = f.prepare(request), before = f.snapshot();
  f.prescriptions.set(f.prescription.sourceId, { ...f.prescription, practiceSeed: f.prescription.practiceSeed + 1 });
  expect(() => f.owner.prepareOrderDecision(request)).toThrow(/frozen|different|changed|prescription/i);
  expect(f.snapshot()).toBe(before); expect(f.owner.readOrderDecision(issued.sourceId)).toEqual(issued);
  f.prescriptions.set(f.prescription.sourceId, f.prescription);
  expect(() => f.owner.prepareOrderDecision({ ...request, sourceId: 'decision-source-alias' })).toThrow(/alias|identity|already|decision/i);
  expect(f.snapshot()).toBe(before);
});

it('does not issue another order from an already consumed decision under an execution alias', async () => {
  const f = await fixture(), issued = f.prepare(), order = f.issue(issued), before = f.snapshot();
  expect(() => f.issue(issued, 'second-execution-for-same-decision')).toThrow(/already|alias|decision|execution/i);
  expect(f.snapshot()).toBe(before); expect(f.owner.readOrder(order.sourceId)).toEqual(order);
});

it('consumes the owned order directly before one actual workload and eligible episode event', async () => {
  const f = await fixture(), order = f.issue(); f.base.opportunities.clear();
  const begun = f.base.owner.begin(order.sourceId);
  expect(begun.opportunity).toEqual(order.opportunity); expect(begun.events).toEqual([]);
  expect(f.rows('world_player_workload_activities')).toHaveLength(0);
  expect(f.base.owner.settle(begun.attemptId).kind).toBe('pending');
  const completed = f.base.owner.advance(begun.attemptId, begun.revision, begun.plannedDelivery.timeline.followThroughEndUs);
  expect(completed.events).toHaveLength(5);
  expect(f.base.owner.settle(completed.attemptId).kind).toBe('pending');
  f.base.assess(completed); const settled = f.base.owner.settle(completed.attemptId);
  expect(settled.kind).toBe('complete'); expect(f.rows('world_player_workload_activities')).toHaveLength(1);
  expect(f.base.sources.episodes.read('episode')!.episode.practiceSourceEventIds).toHaveLength(1);
  expect(f.base.owner.settle(completed.attemptId)).toEqual(settled);
  expect(f.control.readHead('career-a')!.worldRevision).toBe(order.execution.worldRevision);
});

it('fails stale first issuance after a real control event without rewriting its frozen decision', async () => {
  const f = await fixture(), issued = f.prepare(), current = f.control.readHead('career-a')!;
  f.control.changeControl({ careerId: 'career-a', expectedWorldRevision: current.worldRevision,
    change: { expectedRevision: current.control.revision, controlledClubId: 'club-a', manualDomainIds: [] } });
  const before = f.snapshot();
  expect(() => f.issue(issued)).toThrow(/stale|control|revision|authority/i);
  expect(f.snapshot()).toBe(before); expect(f.owner.readOrderDecision(issued.sourceId)).toEqual(issued);
});

it('keeps an issued order frozen when later workload invalidates its first actual begin', async () => {
  const f = await fixture(), order = f.issue(); f.base.recordRecovery(); f.base.opportunities.clear();
  const before = f.snapshot();
  expect(() => f.base.owner.begin(order.sourceId)).toThrow(/stale|revision/i);
  expect(f.snapshot()).toBe(before); expect(f.owner.readOrder(order.sourceId)).toEqual(order);
});

it('reopens historical order and body evidence after later World control changes without live inputs', async () => {
  const f = await fixture(), issued = f.prepare(), order = f.issue(issued); f.base.opportunities.clear();
  const attempt = f.base.complete(order.sourceId); f.base.assess(attempt); f.base.owner.settle(attempt.attemptId);
  const completed = f.base.owner.read(attempt.attemptId), current = f.control.readHead('career-a')!;
  f.control.changeControl({ careerId: 'career-a', expectedWorldRevision: current.worldRevision,
    change: { expectedRevision: current.control.revision, controlledClubId: 'club-a', manualDomainIds: [] } });
  f.clearAuthorities(); f.reopen();
  expect(f.owner.readOrder(order.sourceId)).toEqual(order); expect(f.owner.readOrderDecision(issued.sourceId)).toEqual(issued);
  expect(f.issue(issued)).toEqual(order); expect(f.base.owner.read(attempt.attemptId)).toEqual(completed);
  expect(f.base.sources.episodes.read('episode')!.episode.practiceSourceEventIds).toHaveLength(1);
});

it('issues and consumes a legitimate later order while authenticating the earlier order once historically', async () => {
  const f = await fixture(), first = f.issue(); f.base.opportunities.clear();
  const attempt = f.base.complete(first.sourceId); f.base.assess(attempt); f.base.owner.settle(attempt.attemptId);
  const next = f.makePrescription(1, { atDay: 14 }), second = f.issue(f.prepare(f.request(next, 1)), 'practice-order-execution-1');
  const later = f.base.complete(second.sourceId); f.base.assess(later); f.base.owner.settle(later.attemptId);
  expect(second.opportunity.workloadRevision).toBe(1); expect(f.rows('world_player_workload_activities')).toHaveLength(2);
  f.clearAuthorities(); f.reopen();
  expect(f.owner.readOrder(first.sourceId)).toEqual(first); expect(f.owner.readOrder(second.sourceId)).toEqual(second);
  expect(f.base.owner.read(attempt.attemptId)!.events).toHaveLength(5);
  expect(f.base.sources.episodes.read('episode')!.episode.practiceSourceEventIds).toHaveLength(2);
});

it('rejects original order corruption on direct reads and later physical progress', async () => {
  const f = await fixture(), order = f.issue(); f.base.opportunities.clear();
  const begun = f.base.owner.begin(order.sourceId);
  f.base.db.prepare("UPDATE pitch_practice_orders SET order_json=json_set(order_json,'$.opportunity.practiceSeed',999) WHERE source_id=?").run(order.sourceId);
  const before = f.snapshot();
  expect(() => f.owner.readOrder(order.sourceId)).toThrow(/order|source|corrupt|evidence/i);
  expect(() => f.base.owner.read(begun.attemptId)).toThrow(/order|source|corrupt|evidence/i);
  expect(() => f.base.owner.advance(begun.attemptId, begun.revision, begun.plannedDelivery.timeline.followThroughEndUs))
    .toThrow(/order|source|corrupt|evidence/i);
  expect(f.snapshot()).toBe(before);
});

it('rolls back actual order insertion when its original decision is mutated on the writer connection', async () => {
  const f = await fixture(), issued = f.prepare(), before = f.snapshot();
  f.base.db.exec(`CREATE TRIGGER corrupt_order_decision BEFORE INSERT ON pitch_practice_orders BEGIN
    UPDATE pitch_practice_order_decisions SET decision_json=json_set(decision_json,'$.prescription.practiceSeed',999)
    WHERE source_id='${issued.sourceId}'; END;`);
  let sawOrder = false, sawMutation = false;
  const witness = witnessSqliteWrite('INSERT INTO pitch_practice_orders (source_id,decision_source_id,execution_id,order_json,order_hash) VALUES(?,?,?,?,?)', db => {
    sawOrder = db !== f.base.db && Number(db.prepare('SELECT count(*) AS n FROM pitch_practice_orders').get()!.n) === 1;
    const row = db.prepare('SELECT decision_json FROM pitch_practice_order_decisions WHERE source_id=?').get(issued.sourceId);
    sawMutation = typeof row?.decision_json === 'string' && JSON.parse(row.decision_json).prescription.practiceSeed === 999;
    return sawOrder && sawMutation;
  });
  try {
    expect(() => f.issue(issued)).toThrow(/decision|source|prescription|corrupt|evidence/i);
    expect(witness.wasReached()).toBe(true); expect(sawOrder).toBe(true); expect(sawMutation).toBe(true);
  } finally { witness.close(); }
  expect(f.snapshot()).toBe(before); expect(f.owner.readOrderDecision(issued.sourceId)).toEqual(issued);
  f.base.db.exec('DROP TRIGGER corrupt_order_decision'); expect(f.issue(issued).decisionSourceId).toBe(issued.sourceId);
});

it('does not allocate the same canonical practice opportunity through a second World decision', async () => {
  const f = await fixture(), first = f.issue(), changed = f.makePrescription(1, { opportunityId: f.prescription.opportunityId });
  const before = f.snapshot();
  expect(() => f.owner.prepareOrderDecision(f.request(changed, 1))).toThrow(/opportunity|reserved|already|identity|alias/i);
  expect(f.snapshot()).toBe(before); expect(f.owner.readOrder(first.sourceId)).toEqual(first);
});
