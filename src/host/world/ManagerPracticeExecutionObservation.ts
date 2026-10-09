import type { ManagerExecutionObservation } from '../../core/world/manager/ManagerBeliefHistory';
import type { OwnedPracticeOrder } from './OwnedPitchPracticeOrder';
export const MANAGER_PRACTICE_OBSERVATION_KIND = 'PITCH_PRACTICE_ORDER_V1' as const;
export type ManagerPracticeObservationSource = Readonly<{ kind: typeof MANAGER_PRACTICE_OBSERVATION_KIND; order: OwnedPracticeOrder }>;

/** Successful issuance is an execution-feasibility observation only. It makes no
 * claim about completed practice, learning, Match performance or causal reward. */
export const managerPracticeExecutionObservation = (source: ManagerPracticeObservationSource): ManagerExecutionObservation => {
  const order = source.order, evidence = order.projection.managerSelfChosenEvidence;
  if (source.kind !== MANAGER_PRACTICE_OBSERVATION_KIND || !evidence || order.decision.actor.kind !== 'MANAGER'
    || order.decision.domainId !== 'PITCH_PRACTICE' || evidence.executionId !== order.execution.executionId
    || evidence.decisionId !== order.decision.decisionId || evidence.actionId !== order.decision.actionId
    || evidence.eventIds.length !== 1 || evidence.eventIds[0] !== order.sourceId
    || order.execution.eventIds.length !== 1 || order.execution.eventIds[0] !== order.sourceId
    || order.decision.actor.managerId !== evidence.managerId || order.decision.actor.appointmentId !== evidence.appointmentId) {
    throw new Error('practice execution lacks original Manager self-chosen evidence');
  }
  return { executionId: order.execution.executionId, sourceEventId: order.sourceId,
    careerId: order.opportunity.careerId, clubId: order.decision.clubId,
    managerId: evidence.managerId, appointmentId: evidence.appointmentId, decisionId: evidence.decisionId,
    actionId: evidence.actionId, observedAtDay: order.opportunity.atDay };
};
