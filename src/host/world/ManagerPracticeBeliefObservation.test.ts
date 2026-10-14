import { selectManagerControlledDecision } from '../../core/world/manager/ManagerControlledDecision';
import { afterEach, expect, it } from 'vitest';
import { managerPracticeFixture, practiceActionId } from './ManagerPracticeOrderFromBelief.test-support';
import { openSqliteManagerBeliefHistoryStore } from './SqliteManagerBeliefHistoryStore';
import { openSqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import { issueManagerRosterOpportunityFromBelief } from './ManagerRosterOpportunityFromBelief';
import { practiceOrderExecutionEvidenceFromOwner } from './OwnedPitchPracticeOrder';
import { readManagerBeliefBoundary } from './ManagerBeliefBoundary';
const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
const keep = <T extends { close(): void }>(value: T): T => { cleanup.push(() => value.close()); return value; };
const request = (executionId: string, expectedRevision = 0) => ({ careerId: 'career-a', managerId: 'manager-a', executionId, expectedRevision });

it('learns only execution feasibility, preserves legacy bytes and feeds the next practice and roster decisions', async () => {
  const f = await managerPracticeFixture(cleanup);
  f.observePromotion();
  const originalRows = JSON.stringify(f.f.rows('world_manager_belief_observations'));
  const firstDecision = f.prepare(), order = f.issue(firstDecision);
  const history = keep(openSqliteManagerBeliefHistoryStore(f.f.base.path, f.f.owner));
  const before = history.readHead('career-a', 'manager-a')!;
  const observed = history.applyPracticeOrder(request(order.execution.executionId, 1));
  expect(observed.event.sourceEventId).toBe(order.sourceId);
  expect(observed.state.revision).toBe(2);
  for (const old of before.agent.beliefs.candidates) {
    const next = observed.state.agent.beliefs.candidates.find(b => b.actionId === old.actionId)!;
    expect(next.competitiveOutcome).toEqual(old.competitiveOutcome); expect(next.resourceHealth).toEqual(old.resourceHealth);
    expect(next.opponentInformationResponse).toEqual(old.opponentInformationResponse);
    if (old.actionId === practiceActionId) expect(next.executionFeasibility.evidence).toBe(old.executionFeasibility.evidence + before.policy.evidenceWeight);
    else expect(next).toEqual(old);
  }
  expect(observed.state.agent.skills).toEqual(before.agent.skills);
  expect(JSON.stringify(f.f.rows('world_manager_belief_observations').slice(0, 1))).toBe(originalRows);
  expect(f.f.rows('pitch_practice_attempts')).toHaveLength(0); expect(f.f.rows('world_player_workload_activities')).toHaveLength(0);
  expect(history.applyPracticeOrder(request(order.execution.executionId, 1))).toEqual(observed);
  expect(() => history.applyPracticeOrder(request(order.execution.executionId, 2))).toThrow('different learning request');
  const laterPrescription = { ...f.prescription, sourceId: 'later-prescription', opportunityId: 'later-session' };
  f.f.prescriptions.set(laterPrescription.sourceId, laterPrescription);
  const nextInput = { ...f.f.request(laterPrescription, 1), actionId: practiceActionId,
    managerSelection: { ...firstDecision.request.managerSelection, expectedBeliefRevision: 2, traceId: 'later-trace' } };
  const prepared = f.owner.prepareManagerOrderDecision(nextInput);
  if (prepared.kind !== 'ready') throw new Error('next Manager practice remained pending');
  expect(prepared.decision.managerSelection.boundary.state).toEqual(observed.state);
  const nextOrder = f.owner.issueManagerOrder({ decisionSourceId: prepared.decision.sourceId, executionId: 'later-execution' });
  const later = history.applyPracticeOrder(request(nextOrder.execution.executionId, 2));
  expect(later.revision).toBe(3);
  expect(history.readAtRevision('career-a', 'manager-a', 2)).toEqual(observed.state);
  expect(f.f.owner.readOrder(order.sourceId)).toEqual(order);
  const roster = keep(openSqliteManagerRosterDecisionStore(f.f.base.path, f.f.owner));
  const control = f.f.control.readHead('career-a')!, head = roster.readHead('career-a', 'club-a')!;
  const issued = issueManagerRosterOpportunityFromBelief(roster, history, { careerId: 'career-a', clubId: 'club-a',
    managerId: 'manager-a', appointmentId: 'appointment-a', expectedClubRevision: 0, expectedRosterRevision: head.roster.revision,
    clubAsOfDay: later.event.observedAtDay, control: control.control, worldRevision: control.worldRevision,
    decisionId: 'next-roster-decision', contextId: 'next-roster-context', candidates: [{ actionId: 'promote',
      command: { commandId: 'promote', expectedRevision: head.roster.revision, effectiveDay: later.event.observedAtDay,
        changes: [{ playerId: 'p1', assignment: { clubId: 'club-a', unitId: 'reserve' } }] } }] });
  expect(issued.selectionAgent.state).toEqual(later.state.agent);
  const reader = practiceOrderExecutionEvidenceFromOwner(f.f.owner);
  expect(readManagerBeliefBoundary(f.f.base.db, 'career-a', 'manager-a', 3, reader)!.state).toEqual(later.state);
});

it('reopens tagged observations with a real owner and rejects look-alikes or missing proof owners', async () => {
  const f = await managerPracticeFixture(cleanup), order = f.issue();
  let history = openSqliteManagerBeliefHistoryStore(f.f.base.path, f.f.owner);
  const first = history.applyPracticeOrder(request(order.execution.executionId)); history.close();
  f.f.clearAuthorities(); f.reopen();
  history = keep(openSqliteManagerBeliefHistoryStore(f.f.base.path, f.f.owner));
  expect(history.readObservation(order.execution.executionId)).toEqual(first);
  expect(history.applyPracticeOrder(request(order.execution.executionId))).toEqual(first);
  expect(history.readHead('career-a', 'manager-a')).toEqual(first.state);
  expect(() => f.history.readHead('career-a', 'manager-a')).toThrow('boundary');
  expect(() => openSqliteManagerBeliefHistoryStore(f.f.base.path, { readOrder: () => order })).toThrow('genuine');
  expect(history.readAtRevision('career-a', 'manager-a', 0)!.revision).toBe(0);
});

it('does not admit an unexecuted selection, Human override, another Manager or stale revision', async () => {
  const f = await managerPracticeFixture(cleanup), history = keep(openSqliteManagerBeliefHistoryStore(f.f.base.path, f.f.owner));
  const decision = f.prepare();
  expect(() => history.applyPracticeOrder(request('not-issued'))).toThrow('missing');
  const order = f.issue(decision);
  expect(() => history.applyPracticeOrder({ ...request(order.execution.executionId), managerId: 'other' })).toThrow();
  expect(() => history.applyPracticeOrder(request(order.execution.executionId, 1))).toThrow();
  expect(f.f.rows('world_manager_belief_observations')).toHaveLength(0);
  const human = await managerPracticeFixture(cleanup, { manual: true });
  const humanOrder = human.f.issue();
  const humanHistory = keep(openSqliteManagerBeliefHistoryStore(human.f.base.path, human.f.owner));
  expect(() => humanHistory.applyPracticeOrder(request(humanOrder.execution.executionId))).toThrow('Manager');
  expect(human.f.rows('world_manager_belief_observations')).toHaveLength(0);
});

it('authenticates the writer connection after INSERT and rolls back both observation and trigger mutation', async () => {
  const f = await managerPracticeFixture(cleanup), order = f.issue();
  const history = keep(openSqliteManagerBeliefHistoryStore(f.f.base.path, f.f.owner));
  const before = f.snapshot();
  f.f.base.db.exec("CREATE TRIGGER corrupt_practice_observation AFTER INSERT ON world_manager_belief_observations BEGIN UPDATE pitch_practice_orders SET order_hash='broken'; END");
  expect(() => history.applyPracticeOrder(request(order.execution.executionId))).toThrow();
  expect(f.snapshot()).toBe(before);
  f.f.base.db.exec('DROP TRIGGER corrupt_practice_observation');
  expect(history.applyPracticeOrder(request(order.execution.executionId)).revision).toBe(1);
  f.f.base.db.exec("UPDATE pitch_practice_orders SET order_hash='broken'");
  expect(() => history.readHead('career-a', 'manager-a')).toThrow();
  expect(() => history.readObservation(order.execution.executionId)).toThrow();
  expect(() => history.applyPracticeOrder(request(order.execution.executionId))).toThrow();
});

it('rejects self-referential or relabelled Manager proof before following the dependency', async () => {
  const f = await managerPracticeFixture(cleanup), order = f.issue();
  const history = keep(openSqliteManagerBeliefHistoryStore(f.f.base.path, f.f.owner));
  history.applyPracticeOrder(request(order.execution.executionId));
  const row = f.f.base.db.prepare('SELECT decision_json FROM pitch_practice_order_decisions WHERE source_id=?').get(order.decisionSourceId)!;
  const decision = JSON.parse(String(row.decision_json)); decision.managerSelection.boundary.revision = 1;
  f.f.base.db.prepare('UPDATE pitch_practice_order_decisions SET decision_json=? WHERE source_id=?').run(JSON.stringify(decision), order.decisionSourceId);
  expect(() => history.readHead('career-a', 'manager-a')).toThrow('boundary');
  f.f.base.db.prepare('UPDATE pitch_practice_order_decisions SET decision_json=? WHERE source_id=?').run(row.decision_json!, order.decisionSourceId);
  f.f.base.db.exec("UPDATE world_manager_belief_observations SET source_json=json_remove(source_json,'$.kind')");
  expect(() => history.readObservation(order.execution.executionId)).toThrow();
  expect(() => history.readHead('career-a', 'manager-a')).toThrow();
  f.f.base.db.exec("UPDATE world_manager_belief_observations SET request_json=json_remove(request_json,'$.kind')");
  expect(() => history.readHead('career-a', 'manager-a')).toThrow();
  f.f.base.db.exec("UPDATE world_manager_belief_observations SET source_json='{}'");
  expect(() => history.readHead('career-a', 'manager-a')).toThrow();
});

it('retains practice ownership in a later legacy roster observation, including rollback, reopen, read and exact retry', async () => {
  const f = await managerPracticeFixture(cleanup), order = f.issue();
  const history = keep(openSqliteManagerBeliefHistoryStore(f.f.base.path, f.f.owner));
  const observed = history.applyPracticeOrder(request(order.execution.executionId));
  const roster = keep(openSqliteManagerRosterDecisionStore(f.f.base.path, f.f.owner));
  const control = f.f.control.readHead('career-a')!, head = roster.readHead('career-a', 'club-a')!;
  const issued = issueManagerRosterOpportunityFromBelief(roster, history, { careerId: 'career-a', clubId: 'club-a',
    managerId: 'manager-a', appointmentId: 'appointment-a', expectedClubRevision: 0, expectedRosterRevision: head.roster.revision,
    clubAsOfDay: observed.event.observedAtDay, control: control.control, worldRevision: control.worldRevision,
    decisionId: 'later-roster-decision', contextId: 'later-roster-context', candidates: [{ actionId: 'promote',
      command: { commandId: 'promote', expectedRevision: head.roster.revision, effectiveDay: observed.event.observedAtDay,
        changes: [{ playerId: 'p1', assignment: { clubId: 'club-a', unitId: 'reserve' } }] } }] });
  const selected = selectManagerControlledDecision(issued.control, issued.opportunity, issued.selectionAgent, 'later-roster-trace');
  if (!selected.ok) throw new Error('later roster selection failed');
  roster.apply({ careerId: 'career-a', clubId: 'club-a', expectedClubRevision: issued.clubRevision,
    expectedRosterRevision: issued.rosterRevision, expectedMoodRevision: head.mood?.revision ?? null, control: issued.control,
    opportunity: issued.opportunity, selection: selected.value, selectionAgent: issued.selectionAgent, binding: issued.bindings[0],
    clubAsOfDay: observed.event.observedAtDay, currentWorldRevision: issued.opportunity.worldRevision,
    afterWorldRevision: issued.opportunity.worldRevision + 1, executionId: 'later-roster-execution' });
  const input = request('later-roster-execution', 1);
  const snapshot = () => JSON.stringify(['world_manager_person_heads', 'world_manager_belief_observations', 'pitch_practice_orders']
    .map(table => f.f.rows(table)));
  const before = snapshot();
  f.f.base.db.exec(`CREATE TRIGGER corrupt_prior_practice AFTER INSERT ON world_manager_belief_observations
    WHEN NEW.execution_id='later-roster-execution' BEGIN UPDATE pitch_practice_orders SET order_hash='broken'; END`);
  expect(() => history.apply(input)).toThrow(); expect(snapshot()).toBe(before);
  f.f.base.db.exec('DROP TRIGGER corrupt_prior_practice');
  const later = history.apply(input);
  expect(later.revision).toBe(2);
  const savedBytes = JSON.stringify(f.f.rows('world_manager_belief_observations'));
  const reopened = keep(openSqliteManagerBeliefHistoryStore(f.f.base.path, f.f.owner));
  expect(reopened.readObservation(input.executionId)).toEqual(later); expect(reopened.apply(input)).toEqual(later);
  const unconnected = keep(openSqliteManagerBeliefHistoryStore(f.f.base.path));
  expect(() => unconnected.readObservation(input.executionId)).toThrow();
  const original = f.f.base.db.prepare('SELECT order_hash FROM pitch_practice_orders WHERE source_id=?').get(order.sourceId)!;
  f.f.base.db.prepare("UPDATE pitch_practice_orders SET order_hash='broken' WHERE source_id=?").run(order.sourceId);
  expect(() => reopened.readHead('career-a', 'manager-a')).toThrow();
  expect(() => reopened.readObservation(input.executionId)).toThrow(); expect(() => reopened.apply(input)).toThrow();
  expect(JSON.stringify(f.f.rows('world_manager_belief_observations'))).toBe(savedBytes);
  f.f.base.db.prepare('UPDATE pitch_practice_orders SET order_hash=? WHERE source_id=?').run(original.order_hash, order.sourceId);
  expect(reopened.readObservation(input.executionId)).toEqual(later); expect(reopened.apply(input)).toEqual(later);
  expect(JSON.stringify(f.f.rows('world_manager_belief_observations'))).toBe(savedBytes);
});
