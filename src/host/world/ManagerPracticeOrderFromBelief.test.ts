import { afterEach, expect, it } from 'vitest';
import { selectManagerControlledDecision } from '../../core/world/manager/ManagerControlledDecision';
import { selectControlledDecision } from '../../core/world/control/ControlledDecision';
import { readManagerBeliefBoundary } from './ManagerBeliefBoundary';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { managerPracticeFixture, practiceActionId, type ManagerPracticeRequest } from './ManagerPracticeOrderFromBelief.test-support';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
const fixture = (options?: Parameters<typeof managerPracticeFixture>[1]) => managerPracticeFixture(cleanup, options);

it('prepares the real existing selector result from an accepted practice action and historical Person without World or body effects', async () => {
  const f = await fixture(), request = f.request(), control = f.f.control.readHead('career-a'), manager = f.managerSnapshot();
  const decision = f.prepare(request), boundary = readManagerBeliefBoundary(f.f.base.db, 'career-a', 'manager-a', 0)!;
  const selected = selectManagerControlledDecision(decision.control, decision.opportunity,
    { managerId: 'manager-a', appointmentId: 'appointment-a', state: boundary.state.agent }, request.managerSelection.traceId);
  if (!selected.ok) throw new Error('accepted practice belief did not produce a genuine Core selection');
  expect(decision.opportunity.legalActionIds).toEqual([practiceActionId]);
  expect(decision.managerSelection).toEqual({ version: 'manager-practice-selection-v1', boundary, selection: selected.value });
  expect(decision.prescription).toEqual(f.prescription);
  expect(f.f.control.readHead('career-a')).toEqual(control); expect(f.managerSnapshot()).toBe(manager);
  expect(f.f.rows('pitch_practice_order_decisions')).toHaveLength(1); expect(f.f.rows('pitch_practice_orders')).toHaveLength(0);
  expect(f.f.rows('pitch_practice_attempts')).toHaveLength(0); expect(f.f.rows('world_player_workload_activities')).toHaveLength(0);
  expect(f.prepare(request)).toEqual(decision); expect(f.owner.readManagerOrderDecision(decision.sourceId)).toEqual(decision);
});

it('issues and retries one actual delegated World order with its generated trace and no fabricated repetition', async () => {
  const f = await fixture(), decision = f.prepare(), before = f.f.control.readHead('career-a')!, manager = f.managerSnapshot();
  const episode = f.f.base.sources.episodes.read('episode'), order = f.issue(decision);
  expect(order.decision).toEqual(decision.managerSelection.selection.decision);
  expect(order.decision.origin).toBe('MANAGER_DELEGATED');
  expect(order.projection.managerSelfChosenEvidence).toMatchObject({ traceId: 'practice-trace-0',
    actionId: practiceActionId, domainId: 'PITCH_PRACTICE', eventIds: [order.sourceId] });
  expect(order.execution.worldRevision).toBe(before.worldRevision + 1);
  expect(f.f.control.readHead('career-a')!.worldRevision).toBe(before.worldRevision + 1);
  expect(f.f.rows('pitch_practice_orders')).toHaveLength(1); expect(f.f.rows('pitch_practice_attempts')).toHaveLength(0);
  expect(f.f.rows('world_player_workload_activities')).toHaveLength(0);
  expect(f.f.base.sources.episodes.read('episode')).toEqual(episode); expect(f.managerSnapshot()).toBe(manager);
  const saved = f.snapshot(); expect(f.issue(decision)).toEqual(order); expect(f.snapshot()).toBe(saved);
});

it('consumes the Manager order through real delivery phases and independently accepted PRACTICE exactly once', async () => {
  const f = await fixture(), order = f.issue(), manager = f.managerSnapshot(); f.f.base.opportunities.clear();
  const begun = f.f.base.owner.begin(order.sourceId);
  expect(begun.events).toEqual([]); expect(f.f.base.owner.settle(begun.attemptId).kind).toBe('pending');
  const complete = f.f.base.owner.advance(begun.attemptId, begun.revision, begun.plannedDelivery.timeline.followThroughEndUs);
  expect(complete.events).toHaveLength(5); expect(f.f.base.owner.settle(complete.attemptId).kind).toBe('pending');
  expect(f.f.rows('world_player_workload_activities')).toHaveLength(0);
  f.f.base.assess(complete); const settled = f.f.base.owner.settle(complete.attemptId);
  expect(settled.kind).toBe('complete'); expect(f.f.base.owner.settle(complete.attemptId)).toEqual(settled);
  expect(f.f.rows('world_player_workload_activities')).toHaveLength(1);
  expect(f.f.base.sources.episodes.read('episode')!.episode.practiceSourceEventIds).toHaveLength(1);
  expect(f.managerSnapshot()).toBe(manager); expect(f.f.owner.readOrder(order.sourceId)).toEqual(order);
});

it('supports the appointed autonomous Manager while preserving the existing Human controlled-Club restriction', async () => {
  const f = await fixture({ autonomous: true }), before = f.snapshot();
  expect(f.f.control.readHead('career-a')!.control.controlledClubId).toBeNull();
  // Use the original legacy prescription so this refusal demonstrates authority, not the new metadata parser.
  f.f.prescriptions.set(f.prescription.sourceId, f.f.prescription);
  expect(() => f.f.owner.prepareOrderDecision(f.f.request())).toThrow(/Human.*control|authority|authorized/i);
  expect(f.snapshot()).toBe(before); f.f.prescriptions.set(f.prescription.sourceId, f.prescription);
  expect(f.issue().decision.origin).toBe('MANAGER_AUTONOMOUS');
});

it('returns Human-required for a manual domain before attempting missing Manager belief selection', async () => {
  const f = await fixture({ manual: true, initializeManager: false }), before = f.snapshot();
  expect(f.owner.prepareManagerOrderDecision(f.request())).toEqual({ kind: 'pending', reason: 'human_input_required' });
  expect(f.snapshot()).toBe(before);
  f.f.prescriptions.set(f.prescription.sourceId, f.f.prescription);
  expect(f.f.issue().decision.origin).toBe('HUMAN_OVERRIDE');
});

it('leaves missing Manager Person pending without bootstrap and accepts later explicit existing-owner enrollment', async () => {
  const f = await fixture({ initializeManager: false }), request = f.request(), before = f.snapshot();
  expect(f.owner.prepareManagerOrderDecision(request)).toEqual({ kind: 'pending', reason: 'manager_person_missing' });
  expect(f.snapshot()).toBe(before); expect(f.history.readHead('career-a', 'manager-a')).toBeNull();
  f.initialize(); expect(f.prepare(request).managerSelection.boundary.revision).toBe(0);
});

it('keeps missing accepted prescription pending with no reservation and accepts corrected intake', async () => {
  const f = await fixture(), request = f.request(), before = f.snapshot(); f.f.prescriptions.clear();
  expect(f.owner.prepareManagerOrderDecision(request)).toEqual({ kind: 'pending', reason: 'practice_prescription_missing' });
  expect(f.snapshot()).toBe(before); f.f.prescriptions.set(f.prescription.sourceId, f.prescription);
  expect(f.prepare(request).prescription).toEqual(f.prescription);
});

it('requires an explicit accepted practice-action binding and accepts later corrected input without a poisoned reservation', async () => {
  const f = await fixture(), request = f.request(), before = f.snapshot();
  f.f.prescriptions.set(f.prescription.sourceId, f.f.prescription);
  expect(f.owner.prepareManagerOrderDecision(request)).toEqual({ kind: 'pending', reason: 'manager_practice_action_missing' });
  expect(f.snapshot()).toBe(before); f.f.prescriptions.set(f.prescription.sourceId, f.prescription);
  expect(f.prepare(request).opportunity.legalActionIds).toEqual([practiceActionId]);
});

it('rejects a ROSTER action alias before intake despite its genuine existing belief and accepts the exact practice identity', async () => {
  const f = await fixture(), before = f.snapshot(), head = f.history.readHead('career-a', 'manager-a')!;
  expect(head.agent.beliefs.candidates.some(value => value.actionId === 'promote')).toBe(true);
  expect(() => f.owner.prepareManagerOrderDecision({ ...f.request(), actionId: 'promote' })).toThrow(/action|binding|prescription/i);
  expect(f.snapshot()).toBe(before); expect(f.f.rows('pitch_practice_order_decisions')).toHaveLength(0);
  expect(f.prepare().opportunity.legalActionIds).toEqual([practiceActionId]);
});

it('rejects an accepted practice action absent from the original Manager Person instead of constructing an estimate', async () => {
  const f = await fixture({ includePracticeBelief: false }), before = f.snapshot();
  expect(() => f.prepare()).toThrow(/belief|action|selection/i); expect(f.snapshot()).toBe(before);
});

it.each(['manager', 'appointment', 'revision'] as const)('rejects a wrong quoted Manager %s before intake', async fault => {
  const f = await fixture(), request = f.request(), before = f.snapshot();
  const managerSelection = { ...request.managerSelection,
    ...(fault === 'manager' ? { managerId: 'other-manager' } : {}),
    ...(fault === 'appointment' ? { appointmentId: 'other-appointment' } : {}),
    ...(fault === 'revision' ? { expectedBeliefRevision: 1 } : {}) };
  expect(() => f.owner.prepareManagerOrderDecision({ ...request, managerSelection })).toThrow(/manager|appointment|revision|scope/i);
  expect(f.snapshot()).toBe(before); expect(f.prepare().managerSelection.boundary.revision).toBe(0);
});

it.each(['selectionAgent', 'selection'] as const)('rejects caller-supplied %s as unaccepted extra decision input', async field => {
  const f = await fixture(), before = f.snapshot(), forged = { ...f.request(), [field]: { actionId: practiceActionId, traceId: 'borrowed-roster-trace' } };
  expect(() => f.owner.prepareManagerOrderDecision(forged as ManagerPracticeRequest)).toThrow(/input|field|request|source|manager/i);
  expect(f.snapshot()).toBe(before);
});

it('rejects unregistered practice capability without modifying domain permissions', async () => {
  const f = await fixture({ registered: false }), before = f.snapshot();
  expect(() => f.prepare()).toThrow(/domain|registered|capability/i); expect(f.snapshot()).toBe(before);
  expect(f.f.control.readHead('career-a')!.control.domainIds).toEqual(['ROSTER']);
});

it('rejects stale first Manager issuance after a real belief-only observation without rewriting the proposal', async () => {
  const f = await fixture(), decision = f.prepare(), world = f.f.control.readHead('career-a');
  f.observePromotion(); expect(f.f.control.readHead('career-a')).toEqual(world);
  const before = f.snapshot(); expect(() => f.issue(decision)).toThrow(/stale|belief|revision/i);
  expect(f.snapshot()).toBe(before); expect(f.owner.readManagerOrderDecision(decision.sourceId)).toEqual(decision);
});

it.each([false, true])('consumes the original Manager proposal Source through explicit Human override after belief-only advance=%s', async advance => {
  const f = await fixture(), decision = f.prepare(), world = f.f.control.readHead('career-a');
  if (advance) f.observePromotion();
  expect(f.f.control.readHead('career-a')).toEqual(world);
  const manager = f.managerSnapshot(), submission = f.f.submission(decision);
  const expected = selectControlledDecision(decision.control, decision.opportunity, submission);
  if (!expected.ok) throw new Error('real delegated Human override is unavailable');
  const order = f.f.owner.issueOrder({ decisionSourceId: decision.sourceId, executionId: 'actual-human-override', submission });
  expect(order.decision).toEqual(expected.value); expect(order.decision.origin).toBe('HUMAN_OVERRIDE');
  expect(order.decisionSourceId).toBe(decision.sourceId); expect(order.projection.managerSelfChosenEvidence).toBeNull();
  expect(f.f.rows('pitch_practice_order_decisions')).toHaveLength(1); expect(f.f.rows('pitch_practice_orders')).toHaveLength(1);
  expect(f.owner.readManagerOrderDecision(decision.sourceId)).toEqual(decision); expect(f.managerSnapshot()).toBe(manager);
  const before = f.snapshot(); expect(() => f.issue(decision)).toThrow(/already|execution|consumed|decision/i);
  expect(f.snapshot()).toBe(before);
});

it('does not borrow a Human-only prepared decision as an actual Manager selection proof', async () => {
  const f = await fixture(); f.f.prescriptions.set(f.prescription.sourceId, f.f.prescription);
  const human = f.f.prepare(), before = f.snapshot();
  expect(() => f.owner.issueManagerOrder({ decisionSourceId: human.sourceId, executionId: 'borrowed-human-decision' }))
    .toThrow(/manager|selection|Human|proof/i);
  expect(f.snapshot()).toBe(before); expect(f.f.issue(human).projection.managerSelfChosenEvidence).toBeNull();
});

it('freezes the complete accepted action binding and request even when a changed trace would select the same action', async () => {
  const f = await fixture(), request = f.request(), decision = f.prepare(request), before = f.snapshot();
  const alternative = selectManagerControlledDecision(decision.control, decision.opportunity,
    { managerId: 'manager-a', appointmentId: 'appointment-a', state: decision.managerSelection.boundary.state.agent }, 'another-trace');
  if (!alternative.ok) throw new Error('outcome-neutral alternative trace fixture failed');
  expect(alternative.value.decision.actionId).toBe(decision.managerSelection.selection.decision.actionId);
  expect(() => f.prepare({ ...request, managerSelection: { ...request.managerSelection, traceId: 'another-trace' } }))
    .toThrow(/frozen|different|changed|identity|request/i);
  const changedPrescription = { ...f.prescription, managerAction: { ...f.prescription.managerAction, actionId: 'promote' } };
  f.f.prescriptions.set(f.prescription.sourceId, changedPrescription);
  expect(() => f.prepare(request)).toThrow(/frozen|different|changed|prescription|action/i);
  expect(f.snapshot()).toBe(before); expect(f.owner.readManagerOrderDecision(decision.sourceId)).toEqual(decision);
});

it('reopens the exact historical Manager order after later observation and control changes without accepted live inputs', async () => {
  const f = await fixture(), decision = f.prepare(), order = f.issue(decision); f.observePromotion();
  const current = f.f.control.readHead('career-a')!;
  f.f.control.changeControl({ careerId: 'career-a', expectedWorldRevision: current.worldRevision,
    change: { expectedRevision: current.control.revision, controlledClubId: null, manualDomainIds: [] } });
  f.f.clearAuthorities(); f.reopen(); const before = f.snapshot();
  expect(f.owner.readManagerOrderDecision(decision.sourceId)).toEqual(decision);
  expect(f.f.owner.readOrder(order.sourceId)).toEqual(order); expect(f.issue(decision)).toEqual(order);
  expect(f.snapshot()).toBe(before);
});

it.each(['prepare', 'issue'] as const)('rolls back a witnessed original Manager source mutation during the actual %s INSERT', async phase => {
  const f = await fixture(), decision = phase === 'issue' ? f.prepare() : null, before = f.snapshot();
  const table = phase === 'prepare' ? 'pitch_practice_order_decisions' : 'pitch_practice_orders';
  const sql = phase === 'prepare' ? 'INSERT INTO pitch_practice_order_decisions VALUES(?,?,?,?,?,?,?,?,?,?,?)'
    : 'INSERT INTO pitch_practice_orders (source_id,decision_source_id,execution_id,order_json,order_hash) VALUES(?,?,?,?,?)';
  f.f.base.db.exec(`CREATE TRIGGER mutate_manager_source AFTER INSERT ON ${table} BEGIN
    UPDATE world_roster_opportunities SET issued_json=json_set(issued_json,
      '$.selectionAgent.state.beliefs.candidates[1].competitiveOutcome.mean',0.5) WHERE decision_id='promote-decision'; END`);
  const witness = witnessSqliteWrite(sql, db => Boolean(db.prepare(`SELECT 1 FROM ${table}`).get())
    && db.prepare("SELECT json_extract(issued_json,'$.selectionAgent.state.beliefs.candidates[1].competitiveOutcome.mean') AS value FROM world_roster_opportunities WHERE decision_id='promote-decision'").get()?.value === 0.5);
  try {
    expect(() => phase === 'prepare' ? f.prepare() : f.issue(decision!)).toThrow(/manager|source|seed|boundary|corrupt/i);
    expect(witness.wasReached()).toBe(true);
  } finally { witness.close(); f.f.base.db.exec('DROP TRIGGER mutate_manager_source'); }
  expect(f.snapshot()).toBe(before);
});

it('rejects corruption of original Manager seed evidence on historical proposal, order and consumed-attempt reads', async () => {
  const f = await fixture(), decision = f.prepare(), order = f.issue(decision), begun = f.f.base.owner.begin(order.sourceId);
  const original = f.f.base.db.prepare("SELECT issued_json FROM world_roster_opportunities WHERE decision_id='promote-decision'").get()!.issued_json;
  f.f.base.db.prepare("UPDATE world_roster_opportunities SET issued_json=json_set(issued_json,'$.selectionAgent.state.beliefs.candidates[1].competitiveOutcome.mean',0.5) WHERE decision_id='promote-decision'").run();
  expect(() => f.owner.readManagerOrderDecision(decision.sourceId)).toThrow(/manager|source|seed|boundary|corrupt/i);
  expect(() => f.f.owner.readOrder(order.sourceId)).toThrow(/manager|source|seed|boundary|corrupt|evidence/i);
  expect(() => f.f.base.owner.read(begun.attemptId)).toThrow(/manager|source|seed|boundary|corrupt|evidence/i);
  f.f.base.db.prepare("UPDATE world_roster_opportunities SET issued_json=? WHERE decision_id='promote-decision'").run(original);
  expect(f.f.base.owner.read(begun.attemptId)).toEqual(begun);
});
