import type { ControlResult, DecisionEvidenceProjection, DecisionWorldEvidence, ManagerSelfChosenEvidence } from './ControlTypes';
import { restoreControlledDecision } from './ControlledDecision';
import { parseExecution, failure, success, validationFailure } from './ControlValidation';

/**
 * Join actual canonical event references to the captured decision. No outcomes, mood changes,
 * competence scores or strategy updates are generated here. The host must authenticate event
 * provenance and transactionally deduplicate executionId; this pure projection keeps no cache.
 */
export function attributeExecutedDecision(decisionValue: unknown, executionValue: unknown): ControlResult<DecisionEvidenceProjection> {
  try {
    const decision = restoreControlledDecision(decisionValue); const execution = parseExecution(executionValue);
    if (execution.decisionId !== decision.decisionId || execution.contextId !== decision.contextId || execution.actionId !== decision.actionId) {
      return failure('EXECUTION_MISMATCH');
    }
    if (execution.worldRevision < decision.worldRevision) return failure('EXECUTION_PREDATES_DECISION');
    const worldEvidence: DecisionWorldEvidence = Object.freeze({ ...execution, clubId: decision.clubId, domainId: decision.domainId,
      origin: decision.origin, managerId: decision.managerId, appointmentId: decision.appointmentId });
    let managerSelfChosenEvidence: ManagerSelfChosenEvidence | null = null;
    if (decision.actor.kind === 'MANAGER' && decision.origin !== 'HUMAN_OVERRIDE') {
      managerSelfChosenEvidence = Object.freeze({ ...worldEvidence, origin: decision.origin, traceId: decision.actor.traceId });
    }
    return success(Object.freeze({ worldEvidence, managerSelfChosenEvidence }));
  } catch (error) { return validationFailure(error); }
}
