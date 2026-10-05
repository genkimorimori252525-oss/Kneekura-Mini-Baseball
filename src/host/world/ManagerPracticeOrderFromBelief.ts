import type { ManagerControlledSelection } from '../../core/world/manager/ManagerControlledDecision';
import type { ManagerBeliefBoundary } from './ManagerBeliefBoundary';
import type { IssuedPracticeOrderDecision, OwnedPracticeOrder, PracticeOrderDecisionInput } from './OwnedPitchPracticeOrder';

export type ManagerPracticeSelectionRequest = Readonly<{
  version: 'manager-practice-selection-v1'; managerId: string; appointmentId: string;
  expectedBeliefRevision: number; traceId: string;
}>;
export type ManagerPracticeOrderDecisionInput = PracticeOrderDecisionInput & Readonly<{
  managerSelection: ManagerPracticeSelectionRequest;
}>;
export type PracticeManagerSelectionEvidence = Readonly<{
  version: 'manager-practice-selection-v1'; boundary: ManagerBeliefBoundary; selection: ManagerControlledSelection;
}>;
export type IssuedManagerPracticeOrderDecision = IssuedPracticeOrderDecision & Readonly<{
  request: ManagerPracticeOrderDecisionInput; managerSelection: PracticeManagerSelectionEvidence;
}>;
export type ManagerPracticeOrderMethods = Readonly<{
  prepareManagerOrderDecision(input: ManagerPracticeOrderDecisionInput): Readonly<{ kind: 'pending'; reason: string }>
    | Readonly<{ kind: 'ready'; decision: IssuedManagerPracticeOrderDecision }>;
  readManagerOrderDecision(sourceId: string): IssuedManagerPracticeOrderDecision | null;
  issueManagerOrder(input: Readonly<{ decisionSourceId: string; executionId: string }>): OwnedPracticeOrder;
}>;

/** Actual selection and issuance remain in the existing practice transaction. */
export const createManagerPracticeOrderFromBelief = (input: Readonly<{ practice: ManagerPracticeOrderMethods }>): ManagerPracticeOrderMethods => {
  const owner = input?.practice;
  if (!owner || typeof owner.prepareManagerOrderDecision !== 'function' || typeof owner.readManagerOrderDecision !== 'function'
    || typeof owner.issueManagerOrder !== 'function') throw new Error('Manager practice order producer is missing');
  return Object.freeze({ prepareManagerOrderDecision: owner.prepareManagerOrderDecision,
    readManagerOrderDecision: owner.readManagerOrderDecision, issueManagerOrder: owner.issueManagerOrder });
};
