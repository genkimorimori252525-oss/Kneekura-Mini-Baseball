import { afterEach, expect, it } from 'vitest';
import { dispatchSelectedManagerRosterDecision, type SelectedManagerRosterDispatchInput } from '../../core/world/manager/ExecutedRosterDecisionDispatcher';
import { managerBoundaryFixture } from './ManagerBeliefBoundary.test-support';
import { readManagerBeliefBoundary, assertManagerBeliefBoundary } from './SqliteManagerBeliefHistoryStore';
import type { DurableRosterExecution } from './SqliteManagerRosterDecisionStore';
import { openSqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import { issueManagerRosterOpportunityFromBelief } from './ManagerRosterOpportunityFromBelief';
import { selectManagerControlledDecision } from '../../core/world/manager/ManagerControlledDecision';
import { canonicalRosterEvidenceJson } from './RosterEvidenceJson';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });

it('rejects a fresh Manager prefix whose resolved Club revision differs despite an identical roster result', () => {
  const f = managerBoundaryFixture(cleanup), observed = f.first();
  const accepted = readManagerBeliefBoundary(f.db, 'career-a', 'manager-a', 1)!;
  expect(accepted.state).toEqual(observed.state);
  const original = f.db.prepare('SELECT input_json,result_json,request_json FROM world_roster_executions WHERE execution_id=?')
    .get('execution-1') as { input_json: string; result_json: string; request_json: string };
  const originalInput = JSON.parse(original.input_json) as SelectedManagerRosterDispatchInput;
  const request = JSON.parse(original.request_json) as { expectedClubRevision: number };
  expect(originalInput.clubAtAction.revision).toBe(request.expectedClubRevision);
  const changed = { ...originalInput, clubAtAction: { ...originalInput.clubAtAction, revision: 999 } };
  expect(changed.clubAtAction.revision).not.toBe(request.expectedClubRevision);
  expect(dispatchSelectedManagerRosterDecision(changed)).toEqual((JSON.parse(original.result_json) as DurableRosterExecution).result);
  f.db.prepare("UPDATE world_roster_executions SET input_json=json_set(input_json,'$.clubAtAction.revision',999) WHERE execution_id=?").run('execution-1');
  const before = f.snapshot();
  // A pre-captured digest already detects changed bytes. The fresh reader must
  // independently authenticate the original owner/revision relationship too.
  expect(() => readManagerBeliefBoundary(f.db, 'career-a', 'manager-a', 1)).toThrow(/Club|club|revision|source|corrupt|boundary/i);
  expect(() => assertManagerBeliefBoundary(f.db, accepted, 'historical')).toThrow(/source|corrupt|boundary|evidence/i);
  expect(f.snapshot()).toBe(before);
  f.db.prepare('UPDATE world_roster_executions SET input_json=? WHERE execution_id=?').run(original.input_json, 'execution-1');
  expect(readManagerBeliefBoundary(f.db, 'career-a', 'manager-a', 1)).toEqual(accepted);
});

it('rejects a fresh Manager prefix whose requested Mood revision contradicts the original null owner', () => {
  const f = managerBoundaryFixture(cleanup); f.first();
  const accepted = readManagerBeliefBoundary(f.db, 'career-a', 'manager-a', 1)!;
  const original = f.db.prepare('SELECT input_json,result_json,request_json FROM world_roster_executions WHERE execution_id=?')
    .get('execution-1') as { input_json: string; result_json: string; request_json: string };
  const input = JSON.parse(original.input_json) as SelectedManagerRosterDispatchInput;
  expect(JSON.parse(original.request_json).expectedMoodRevision).toBeNull();
  expect(input.moodContext).toBeUndefined();
  expect(f.db.prepare('SELECT mood_revision FROM world_roster_mood_heads WHERE career_id=? AND club_id=?')
    .get('career-a', 'club-a')!.mood_revision).toBeNull();
  // A genuine next opportunity confirms the actual first writer rejects this
  // requested revision against the null Mood owner, with no execution or CAS.
  const roster = openSqliteManagerRosterDecisionStore(f.databasePath);
  try {
    const first = roster.readOpportunity('career-a', 'club-a', 'decision-1')!;
    const issued = issueManagerRosterOpportunityFromBelief(roster, f.history, { careerId: 'career-a', clubId: 'club-a',
      expectedClubRevision: 0, expectedRosterRevision: 1, clubAsOfDay: 12, control: first.control,
      decisionId: 'mood-check', contextId: 'mood-check-context', worldRevision: 1,
      managerId: 'manager-a', appointmentId: 'appointment-a', candidates: [{ actionId: 'rest-p1', command: {
        commandId: 'rest-p1', expectedRevision: 1, effectiveDay: 12,
        changes: [{ playerId: 'p1', availability: { status: 'AVAILABLE', evidenceId: 'recovered-1' } }],
      } }] });
    const choice = selectManagerControlledDecision(issued.control, issued.opportunity, issued.selectionAgent, 'mood-check-trace');
    if (!choice.ok) throw new Error('real Manager Mood fixture selection is unavailable');
    const beforeWriter = f.snapshot();
    expect(() => roster.apply({ careerId: 'career-a', clubId: 'club-a', expectedClubRevision: 0, expectedRosterRevision: 1,
      expectedMoodRevision: 1, control: issued.control, opportunity: issued.opportunity, selection: choice.value,
      selectionAgent: issued.selectionAgent, binding: issued.bindings[0], clubAsOfDay: 12,
      currentWorldRevision: 1, afterWorldRevision: 2, executionId: 'rejected-mood-check' })).toThrow('stale world mood revision');
    expect(f.snapshot()).toBe(beforeWriter);
  } finally { roster.close(); }
  f.db.prepare("UPDATE world_roster_executions SET request_json=json_set(request_json,'$.expectedMoodRevision',1) WHERE execution_id=?")
    .run('execution-1');
  const changed = f.db.prepare('SELECT input_json,request_json FROM world_roster_executions WHERE execution_id=?')
    .get('execution-1') as { input_json: string; request_json: string };
  expect(changed.input_json).toBe(original.input_json);
  expect(changed.request_json).toBe(canonicalRosterEvidenceJson(JSON.parse(changed.request_json)));
  expect(dispatchSelectedManagerRosterDecision(input)).toEqual((JSON.parse(original.result_json) as DurableRosterExecution).result);
  const before = f.snapshot();
  expect(() => readManagerBeliefBoundary(f.db, 'career-a', 'manager-a', 1)).toThrow(/Mood|mood|revision|source|corrupt|boundary/i);
  expect(() => assertManagerBeliefBoundary(f.db, accepted, 'current')).toThrow(/source|corrupt|boundary|evidence/i);
  expect(f.snapshot()).toBe(before);
  f.db.prepare('UPDATE world_roster_executions SET request_json=? WHERE execution_id=?').run(original.request_json, 'execution-1');
  expect(readManagerBeliefBoundary(f.db, 'career-a', 'manager-a', 1)).toEqual(accepted);
});
