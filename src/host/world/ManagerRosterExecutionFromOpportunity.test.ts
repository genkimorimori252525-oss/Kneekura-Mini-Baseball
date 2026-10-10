import { afterEach, expect, it } from 'vitest';
import { managerRosterAdmissionFixture, corruptManagerRosterAdmissionBefore } from './ManagerRosterBeliefAdmission.test-support';
import { issueManagerRosterOpportunityFromBelief } from './ManagerRosterOpportunityFromBelief';
import { openSqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import { openSqliteWorldControlStore } from './SqliteWorldControlStore';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
const request = { careerId: 'career-a', clubId: 'club-a', decisionId: 'decision-2',
  traceId: 'trace-2', executionId: 'execution-2' };
const fixture = () => {
  const result = managerRosterAdmissionFixture(cleanup);
  const issued = issueManagerRosterOpportunityFromBelief(result.roster, result.f.history,
    { ...result.input, candidateActionIds: ['keep-p1'] }, 1);
  return { ...result, issued };
};

it('selects the admitted original candidate and executes through actual roster and World owners', () => {
  const { f, roster, issued } = fixture();
  const executed = roster.executeIssued(request);
  expect(executed.result.projection.managerSelfChosenEvidence).toMatchObject({ actionId: 'keep-p1', origin: 'MANAGER_DELEGATED',
    managerId: 'manager-a', traceId: 'trace-2' });
  expect(executed.result.roster.players[0].availability).toEqual({ status: 'UNAVAILABLE', evidenceId: 'still-resting-1' });
  expect(executed.result.execution).toMatchObject({ executionId: 'execution-2', decisionId: 'decision-2', worldRevision: 2 });
  expect(roster.readHead('career-a', 'club-a')!.roster.revision).toBe(2);
  expect(roster.readOpportunity('career-a', 'club-a', 'decision-2')).toEqual(issued);
  expect(f.db.prepare('SELECT world_revision FROM world_control_heads').get()).toEqual({ world_revision: 2 });
});

it('retains autonomous Manager attribution when the actual control owner releases the Club', () => {
  const { f, roster, input } = managerRosterAdmissionFixture(cleanup);
  const control = openSqliteWorldControlStore(f.databasePath); cleanup.push(() => control.close());
  const current = control.changeControl({ careerId: 'career-a', expectedWorldRevision: 1,
    change: { expectedRevision: 0, controlledClubId: null, manualDomainIds: [] } });
  issueManagerRosterOpportunityFromBelief(roster, f.history,
    { ...input, control: current.control, worldRevision: current.worldRevision }, 1);
  const result = roster.executeIssued(request);
  expect(result.result.projection.managerSelfChosenEvidence).toMatchObject({ origin: 'MANAGER_AUTONOMOUS',
    actionId: 'rest-p1', traceId: 'trace-2', worldRevision: 3 });
  expect(result.result.roster.players[0].availability.status).toBe('AVAILABLE');
});

it('reopens an exact execution after later Manager and control history without reconstructing current choices', () => {
  const { f, roster } = fixture();
  const executed = roster.executeIssued(request);
  f.history.apply({ careerId: 'career-a', managerId: 'manager-a', expectedRevision: 1, executionId: 'execution-2' });
  const control = openSqliteWorldControlStore(f.databasePath); cleanup.push(() => control.close());
  control.changeControl({ careerId: 'career-a', expectedWorldRevision: 2,
    change: { expectedRevision: 0, controlledClubId: 'club-a', manualDomainIds: ['ROSTER'] } });
  const reopened = openSqliteManagerRosterDecisionStore(f.databasePath); cleanup.push(() => reopened.close());
  const before = f.snapshot();
  expect(reopened.executeIssued(request)).toEqual(executed);
  expect(f.snapshot()).toBe(before);
  expect(() => reopened.executeIssued({ ...request, traceId: 'different-trace' })).toThrow('different roster evidence');
  expect(() => reopened.executeIssued({ ...request, decisionId: 'decision-1' })).toThrow();
  expect(f.snapshot()).toBe(before);
});

it('rolls back an interrupted execution and retries the same issued action', () => {
  const { f, roster } = fixture();
  const before = f.snapshot();
  f.db.exec("CREATE TRIGGER interrupt_generated_roster BEFORE INSERT ON world_roster_executions BEGIN SELECT RAISE(ABORT,'generated execution interrupted'); END");
  expect(() => roster.executeIssued(request)).toThrow('generated execution interrupted');
  expect(f.snapshot()).toBe(before);
  f.db.exec('DROP TRIGGER interrupt_generated_roster');
  expect(roster.executeIssued(request).rosterRevision).toBe(2);
});

it('rejects manual takeover before first execution instead of advancing a stale opportunity', () => {
  const { f, roster } = fixture();
  const control = openSqliteWorldControlStore(f.databasePath); cleanup.push(() => control.close());
  control.changeControl({ careerId: 'career-a', expectedWorldRevision: 1,
    change: { expectedRevision: 0, controlledClubId: 'club-a', manualDomainIds: ['ROSTER'] } });
  const before = f.snapshot();
  expect(() => roster.executeIssued(request)).toThrow('stale durable world revision');
  expect(roster.readExecution('execution-2')).toBeNull();
  expect(f.snapshot()).toBe(before);
});

it('rejects changed original belief evidence and caller-supplied execution fields', () => {
  const { f, roster } = fixture();
  expect(() => roster.executeIssued({ ...request, afterWorldRevision: 99 } as typeof request)).toThrow('invalid issued roster execution');
  corruptManagerRosterAdmissionBefore(f.db);
  const before = f.snapshot();
  expect(() => roster.executeIssued(request)).toThrow();
  expect(roster.readExecution('execution-2')).toBeNull();
  expect(f.snapshot()).toBe(before);
});

import { dispatchDomesticCalendarDay } from './DomesticCalendarDayDispatch';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteDomesticScheduleStore } from './SqliteDomesticScheduleStore';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import type { DomesticCalendarDayInput } from './DomesticCalendarDayDispatch';
it('connects explicitly requested Manager execution to accepted-day issuance and exact reopen', () => {
  const { f, roster, input } = managerRosterAdmissionFixture(cleanup);
  const world = openSqliteWorldSettlementStore(f.databasePath), archive = openSqliteDomesticScheduleStore(f.databasePath);
  const match = new SqliteOfficialStateStore(f.databasePath);
  cleanup.push(() => world.close(), () => archive.close(), () => match.close());
  const stores = { world, archive, match, roster, belief: f.history };
  const day = { careerId: 'career-a', day: 12, openings: [], market: [],
    roster: [{ opportunity: { ...input, candidateActionIds: ['keep-p1'] }, managerBeliefRevision: 1,
      managerExecution: { traceId: request.traceId, executionId: request.executionId } }] };
  const first = dispatchDomesticCalendarDay(stores, day);
  expect(first.roster[0]).toMatchObject({ status: 'APPLIED', result: { execution: { executionId: request.executionId, rosterRevision: 2 } } });
  expect(first.roster[0].result!.execution!.result.projection.managerSelfChosenEvidence).toMatchObject({ actionId: 'keep-p1', traceId: 'trace-2' });
  const reopened = openSqliteManagerRosterDecisionStore(f.databasePath); cleanup.push(() => reopened.close());
  expect(dispatchDomesticCalendarDay({ ...stores, roster: reopened }, day).roster).toEqual(first.roster);
});
it('retains an issued opportunity after execution interruption and resumes it through the same day command', () => {
  const { f, roster, input } = managerRosterAdmissionFixture(cleanup);
  const world = openSqliteWorldSettlementStore(f.databasePath), archive = openSqliteDomesticScheduleStore(f.databasePath);
  const match = new SqliteOfficialStateStore(f.databasePath);
  cleanup.push(() => world.close(), () => archive.close(), () => match.close());
  const stores = { world, archive, match, roster, belief: f.history };
  const day = { careerId: 'career-a', day: 12, openings: [], market: [],
    roster: [{ opportunity: input, managerBeliefRevision: 1,
      managerExecution: { traceId: request.traceId, executionId: request.executionId } }] };
  f.db.exec("CREATE TRIGGER interrupt_day_roster BEFORE INSERT ON world_roster_executions BEGIN SELECT RAISE(ABORT,'day execution interrupted'); END");
  const interrupted = dispatchDomesticCalendarDay(stores, day);
  expect(interrupted.roster[0]).toMatchObject({ status: 'REJECTED', reason: 'day execution interrupted', result: { opportunity: { managerBeliefRevision: 1 } } });
  expect(roster.readExecution('execution-2')).toBeNull();
  f.db.exec('DROP TRIGGER interrupt_day_roster');
  const resumed = dispatchDomesticCalendarDay(stores, day).roster[0];
  expect(resumed.status).toBe('APPLIED');
  expect(resumed.result!.execution!.result.projection.managerSelfChosenEvidence!.actionId).toBe('rest-p1');
  expect(roster.readHead('career-a', 'club-a')!.roster.players[0].availability.status).toBe('AVAILABLE');
});

it.each(['duplicate mode', 'foreign scope'] as const)('rejects %s before accepted-day issuance', kind => {
  const { f, roster, input } = managerRosterAdmissionFixture(cleanup);
  const world = openSqliteWorldSettlementStore(f.databasePath), archive = openSqliteDomesticScheduleStore(f.databasePath);
  const match = new SqliteOfficialStateStore(f.databasePath);
  cleanup.push(() => world.close(), () => archive.close(), () => match.close());
  const stores = { world, archive, match, roster, belief: f.history };
  const day = { careerId: 'career-a', day: 12, openings: [], market: [], roster: [{ opportunity: input, managerBeliefRevision: 1,
    managerExecution: { traceId: request.traceId, executionId: request.executionId, ...(kind === 'foreign scope' ? { clubId: 'other' } : {}) },
    ...(kind === 'duplicate mode' ? { execution: {} } : {}) }] } as unknown as DomesticCalendarDayInput;
  const before = f.snapshot();
  expect(() => dispatchDomesticCalendarDay(stores, day)).toThrow('invalid accepted domestic calendar day input');
  expect(roster.readOpportunity('career-a', 'club-a', 'decision-2')).toBeNull();
  expect(f.snapshot()).toBe(before);
});
