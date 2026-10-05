import { vi } from 'vitest';
import type { ManagerControlledSelection } from '../../core/world/manager/ManagerControlledDecision';
import type { ManagerBeliefBoundary } from './ManagerBeliefBoundary';
import { readManagerBeliefBoundary } from './ManagerBeliefBoundary';
import { openSqliteManagerBeliefHistoryStore } from './SqliteManagerBeliefHistoryStore';
import { managerBoundaryPolicy } from './ManagerBeliefBoundary.test-support';
import { practiceOrderFixture, type IssuedPracticeOrderDecision, type OwnedPracticeOrder,
  type PracticeOrderDecisionInput, type PracticePrescription } from './OwnedPitchPracticeOrder.test-support';

export const practiceActionId = 'practice-action-0';
export type ManagerActionBinding = Readonly<{
  version: 'manager-practice-action-v1'; domainId: 'PITCH_PRACTICE'; actionId: string;
}>;
export type ManagerPracticeRequest = PracticeOrderDecisionInput & Readonly<{
  managerSelection: Readonly<{ version: 'manager-practice-selection-v1'; managerId: string;
    appointmentId: string; expectedBeliefRevision: number; traceId: string }>;
}>;
export type ManagerPracticeDecision = IssuedPracticeOrderDecision & Readonly<{
  request: ManagerPracticeRequest;
  managerSelection: Readonly<{ version: 'manager-practice-selection-v1';
    boundary: ManagerBeliefBoundary; selection: ManagerControlledSelection }>;
}>;
export type ManagerPracticeMethods = Readonly<{
  prepareManagerOrderDecision(input: ManagerPracticeRequest): Readonly<{ kind: 'pending'; reason: string }>
    | Readonly<{ kind: 'ready'; decision: ManagerPracticeDecision }>;
  readManagerOrderDecision(sourceId: string): ManagerPracticeDecision | null;
  issueManagerOrder(input: Readonly<{ decisionSourceId: string; executionId: string }>): OwnedPracticeOrder;
}>;
type Module = { createManagerPracticeOrderFromBelief(input: unknown): ManagerPracticeMethods };

/** Explicit synthetic observed beliefs are seeded before the real promotion.
 * Production must read an existing Person; the facade cannot bootstrap one. */
export async function managerPracticeFixture(cleanup: (() => void)[], options: {
  manual?: boolean; autonomous?: boolean; initializeManager?: boolean; includePracticeBelief?: boolean; registered?: boolean;
} = {}) {
  const estimate = { mean: 1, uncertainty: 0, evidence: 1 };
  const f = await practiceOrderFixture(cleanup, { delegated: !options.manual, registered: options.registered,
    managerBeliefCandidates: options.includePracticeBelief === false ? [] : [{ actionId: practiceActionId,
      styleTags: [], competitiveOutcome: estimate, resourceHealth: estimate,
      executionFeasibility: estimate, opponentInformationResponse: estimate }] });
  const prescription: PracticePrescription & { managerAction: ManagerActionBinding } = { ...f.prescription,
    managerAction: { version: 'manager-practice-action-v1', domainId: 'PITCH_PRACTICE', actionId: practiceActionId } };
  f.prescriptions.set(prescription.sourceId, prescription);
  let history = openSqliteManagerBeliefHistoryStore(f.base.path), historyOpen = true;
  cleanup.push(() => { if (historyOpen) { history.close(); historyOpen = false; } });
  const initialize = () => history.initializeFromOpportunity({ careerId: 'career-a', clubId: 'club-a',
    decisionId: 'promote-decision', policy: managerBoundaryPolicy });
  if (options.initializeManager !== false) initialize();
  if (options.autonomous) {
    const current = f.control.readHead('career-a')!;
    f.control.changeControl({ careerId: 'career-a', expectedWorldRevision: current.worldRevision,
      change: { expectedRevision: current.control.revision, controlledClubId: null, manualDomainIds: [] } });
  }
  const promotion = f.base.roster.readExecution('promotion-execution');
  if (!promotion?.result.projection.managerSelfChosenEvidence || f.base.count('pitch_practice_attempts') !== 0
    || f.base.count('world_player_workload_activities') !== 0
    || options.initializeManager !== false && !readManagerBeliefBoundary(f.base.db, 'career-a', 'manager-a', 0)) {
    throw new Error('Manager practice fixture is missing its genuine historical seed or pre-body boundary');
  }
  // Every file-backed handle has cleanup before the intended absent-module RED.
  const module = await vi.importActual<Module>('./ManagerPracticeOrderFromBelief');
  const connect = () => module.createManagerPracticeOrderFromBelief({ practice: f.base.owner });
  let owner = connect();
  const request = (): ManagerPracticeRequest => ({ ...f.request(prescription), managerSelection: {
    version: 'manager-practice-selection-v1', managerId: 'manager-a', appointmentId: 'appointment-a',
    expectedBeliefRevision: history.readHead('career-a', 'manager-a')?.revision ?? 0, traceId: 'practice-trace-0' } });
  const prepare = (input = request()) => {
    const result = owner.prepareManagerOrderDecision(input);
    if (result.kind !== 'ready') throw new Error(`Manager practice fixture remained pending: ${result.reason}`);
    return result.decision;
  };
  const issue = (decision = prepare(), executionId = 'manager-practice-execution-0') =>
    owner.issueManagerOrder({ decisionSourceId: decision.sourceId, executionId });
  const observePromotion = () => history.apply({ careerId: 'career-a', managerId: 'manager-a',
    expectedRevision: 0, executionId: 'promotion-execution' });
  const managerSnapshot = () => JSON.stringify(Object.fromEntries(['world_manager_person_heads', 'world_manager_belief_observations',
    'world_roster_opportunities', 'world_roster_executions'].map(table => [table, f.rows(table)])));
  const snapshot = () => JSON.stringify({ owner: f.snapshot(), manager: managerSnapshot() });
  const reopen = () => {
    history.close(); historyOpen = false; f.reopen();
    history = openSqliteManagerBeliefHistoryStore(f.base.path); historyOpen = true; owner = connect();
  };
  return { f, prescription, request, prepare, issue, initialize, observePromotion, managerSnapshot, snapshot, reopen,
    get owner() { return owner; }, get history() { return history; } };
}
