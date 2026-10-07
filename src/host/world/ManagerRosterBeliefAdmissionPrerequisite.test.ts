import { afterEach, expect, it } from 'vitest';
import { selectManagerControlledDecision } from '../../core/world/manager/ManagerControlledDecision';
import { assertManagerBeliefBoundary, readManagerBeliefBoundary } from './ManagerBeliefBoundary';
import { issueManagerRosterOpportunityFromBelief } from './ManagerRosterOpportunityFromBelief';
import { managerRosterAdmissionFixture, managerRosterAdmissionSnapshot } from './ManagerRosterBeliefAdmission.test-support';
import { openSqliteManagerRosterDecisionStore, type RosterExecutionRequest } from './SqliteManagerRosterDecisionStore';
import { canonicalRosterEvidenceJson } from './RosterEvidenceJson';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });

it('admits authentic two-choice Manager history through durable selection application retry and reopen', () => {
  const { f, roster, close, original, accepted, input } = managerRosterAdmissionFixture(cleanup);
  const clubBefore = f.db.prepare('SELECT * FROM world_club_heads ORDER BY rowid').all();
  const seasonBefore = f.db.prepare('SELECT * FROM world_season_heads ORDER BY rowid').all();
  const next = issueManagerRosterOpportunityFromBelief(roster, f.history, input);
  expect(next.opportunity.legalActionIds).toEqual(['rest-p1', 'keep-p1']);
  expect(next.bindings).toEqual(input.candidates);
  expect(Object.isFrozen(next.bindings)).toBe(true);
  expect(next.selectionAgent.state.beliefs.candidates[0]?.executionFeasibility.mean).toBe(0.6);
  const learned = selectManagerControlledDecision(next.control, next.opportunity, next.selectionAgent, 'trace-2');
  const old = selectManagerControlledDecision(next.control, next.opportunity, original.selectionAgent, 'trace-2');
  expect(learned.ok && learned.value.decision.actionId).toBe('rest-p1');
  expect(old.ok && old.value.decision.actionId).toBe('keep-p1');
  if (!learned.ok) throw new Error('accepted two-choice Manager selection is unavailable');
  const binding = next.bindings.find(value => value.actionId === learned.value.decision.actionId)!;
  const request: RosterExecutionRequest = {
    careerId: 'career-a', clubId: 'club-a', expectedClubRevision: 0, expectedRosterRevision: 1,
    expectedMoodRevision: null, control: next.control, opportunity: next.opportunity,
    selection: learned.value, selectionAgent: next.selectionAgent, binding,
    clubAsOfDay: 12, currentWorldRevision: 1, afterWorldRevision: 2, executionId: 'execution-2',
  };
  const applied = roster.apply(request);
  expect(applied).toMatchObject({ executionId: 'execution-2', rosterRevision: 2, moodRevision: null,
    result: { roster: { revision: 2, effectiveDay: 12 },
      execution: { executionId: 'execution-2', decisionId: 'decision-2', actionId: 'rest-p1', worldRevision: 2 },
      rosterEvent: { type: 'ROSTER_CHANGED', commandId: 'rest-p1', causeEventId: 'execution-2',
        beforeRevision: 1, afterRevision: 2, effectiveDay: 12 } } });
  expect(applied.result.roster.players[0].availability).toEqual({ status: 'AVAILABLE', evidenceId: 'recovered-1' });
  expect(applied.result.rosterEvent.changes[0].before.availability).toEqual({ status: 'UNAVAILABLE', evidenceId: 'usage-observed-1' });
  expect(applied.result.execution.eventIds).toEqual([applied.result.rosterEvent.eventId]);
  expect(applied.result.projection.managerSelfChosenEvidence?.actionId).toBe('rest-p1');
  expect(f.db.prepare('SELECT * FROM world_decision_revision_events WHERE career_id=? AND world_revision=2').all('career-a'))
    .toEqual([{ career_id: 'career-a', world_revision: 2, source_kind: 'MANAGER_ROSTER',
      source_event_id: applied.result.rosterEvent.eventId,
      event_json: canonicalRosterEvidenceJson({ executionId: 'execution-2', rosterEvent: applied.result.rosterEvent }) }]);
  expect(f.db.prepare('SELECT count(*) AS n FROM world_decision_revision_events').get()!.n).toBe(2);
  expect(f.db.prepare('SELECT world_revision FROM world_control_heads WHERE career_id=?').get('career-a')!.world_revision).toBe(2);
  expect(f.db.prepare('SELECT * FROM world_club_heads ORDER BY rowid').all()).toEqual(clubBefore);
  expect(f.db.prepare('SELECT * FROM world_season_heads ORDER BY rowid').all()).toEqual(seasonBefore);
  expect(roster.readExecution('execution-2')).toEqual(applied);
  expect(roster.readOpportunity('career-a', 'club-a', 'decision-2')).toEqual(next);
  const afterApplication = managerRosterAdmissionSnapshot(f.db);
  expect(roster.apply(request)).toEqual(applied);
  expect(managerRosterAdmissionSnapshot(f.db)).toBe(afterApplication);
  // Advancing the real history must not recapture a completed execution at retry.
  const second = f.history.apply({ careerId: 'career-a', managerId: 'manager-a', expectedRevision: 1, executionId: 'execution-2' });
  expect(second.revision).toBe(2);
  assertManagerBeliefBoundary(f.db, accepted, 'historical');
  const current = readManagerBeliefBoundary(f.db, 'career-a', 'manager-a', 2)!;
  assertManagerBeliefBoundary(f.db, current, 'current');
  const afterObservation = managerRosterAdmissionSnapshot(f.db);
  expect(roster.apply(request)).toEqual(applied);
  expect(managerRosterAdmissionSnapshot(f.db)).toBe(afterObservation);
  close(); f.reopen();
  const reopened = openSqliteManagerRosterDecisionStore(f.databasePath);
  try {
    expect(reopened.readOpportunity('career-a', 'club-a', 'decision-2')).toEqual(next);
    expect(reopened.readExecution('execution-2')).toEqual(applied);
    expect(reopened.apply(request)).toEqual(applied);
    expect(reopened.readHead('career-a', 'club-a')!.roster).toEqual(applied.result.roster);
    expect(readManagerBeliefBoundary(f.db, 'career-a', 'manager-a', 1)).toEqual(accepted);
    expect(readManagerBeliefBoundary(f.db, 'career-a', 'manager-a', 2)).toEqual(current);
    expect(managerRosterAdmissionSnapshot(f.db)).toBe(afterObservation);
  } finally { reopened.close(); }
});
