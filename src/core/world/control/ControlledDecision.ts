import type { ControlledDecision, DecisionOrigin, HumanControlState, ControlResult } from './ControlTypes';
import { createHumanControlState } from './HumanControl';
import { object, id, nullableId, revision, boolean, parseActor, parseOpportunity, parseSubmission,
  invalid, failure, success, validationFailure } from './ControlValidation';

type OriginBasis = Pick<ControlledDecision, 'controlledBy' | 'manualDomain' | 'actor' | 'managerId' | 'appointmentId'>;
/** Recompute from captured facts; never trust a caller's origin label. */
function originFrom(basis: OriginBasis): DecisionOrigin {
  if (basis.controlledBy === null && basis.manualDomain) return invalid('manualDomain');
  if (basis.actor.kind === 'HUMAN') {
    if (basis.controlledBy !== basis.actor.controllerId) return invalid('actor.controllerId');
    return 'HUMAN_OVERRIDE';
  }
  if (basis.actor.managerId !== basis.managerId || basis.actor.appointmentId !== basis.appointmentId) return invalid('actor.appointmentId');
  if (basis.manualDomain) return invalid('manualDomain');
  return basis.controlledBy === null ? 'MANAGER_AUTONOMOUS' : 'MANAGER_DELEGATED';
}

/** Restore trusted persisted data with structural/attribution checks, not a cryptographic attestation. */
export function restoreControlledDecision(value: unknown): ControlledDecision {
  const input = object(value, 'decision');
  if (input.schemaVersion !== 1) return invalid('schemaVersion');
  const basis: OriginBasis = { controlledBy: nullableId(input.controlledBy, 'controlledBy'),
    manualDomain: boolean(input.manualDomain, 'manualDomain'), actor: parseActor(input.actor),
    managerId: id(input.managerId, 'managerId'), appointmentId: id(input.appointmentId, 'appointmentId') };
  const origin = originFrom(basis);
  if (input.origin !== origin) return invalid('origin');
  return Object.freeze({ schemaVersion: 1, decisionId: id(input.decisionId, 'decisionId'),
    contextId: id(input.contextId, 'contextId'), worldRevision: revision(input.worldRevision, 'worldRevision'),
    clubId: id(input.clubId, 'clubId'), domainId: id(input.domainId, 'domainId'),
    controlRevision: revision(input.controlRevision, 'controlRevision'), ...basis, origin,
    actionId: id(input.actionId, 'actionId') });
}

/** Accept the exact selected legal action; do not apply manager ability, choose a fallback, or run physics. */
export function selectControlledDecision(state: HumanControlState, opportunityValue: unknown, submissionValue: unknown): ControlResult<ControlledDecision> {
  try {
    const current = createHumanControlState(state); const opportunity = parseOpportunity(opportunityValue);
    const submission = parseSubmission(submissionValue);
    if (submission.decisionId !== opportunity.decisionId || submission.contextId !== opportunity.contextId) return failure('DECISION_CONTEXT_MISMATCH');
    if (submission.expectedControlRevision !== current.revision) return failure('STALE_CONTROL_REVISION');
    if (submission.expectedWorldRevision !== opportunity.worldRevision) return failure('STALE_WORLD_REVISION');
    if (!current.domainIds.includes(opportunity.domainId)) return failure('UNKNOWN_DOMAIN', 'domainId');
    const controlledBy = current.controlledClubId === opportunity.clubId ? current.controllerId : null;
    const manualDomain = controlledBy !== null && current.manualDomainIds.includes(opportunity.domainId);
    const actor = submission.actor;
    if (actor.kind === 'HUMAN') {
      if (controlledBy !== actor.controllerId) return failure('HUMAN_NOT_AUTHORIZED');
    } else {
      if (actor.managerId !== opportunity.managerId || actor.appointmentId !== opportunity.appointmentId) return failure('STALE_MANAGER_APPOINTMENT');
      if (manualDomain) return failure('HUMAN_INPUT_REQUIRED');
    }
    // One and the same gate for manager choices and explicit human overrides.
    if (!opportunity.legalActionIds.includes(submission.actionId)) return failure('ILLEGAL_ACTION', 'actionId');
    const basis: OriginBasis = { controlledBy, manualDomain, actor, managerId: opportunity.managerId, appointmentId: opportunity.appointmentId };
    return success(restoreControlledDecision({ schemaVersion: 1, decisionId: opportunity.decisionId,
      contextId: opportunity.contextId, worldRevision: opportunity.worldRevision, clubId: opportunity.clubId,
      domainId: opportunity.domainId, controlRevision: current.revision, ...basis, origin: originFrom(basis), actionId: submission.actionId }));
  } catch (error) { return validationFailure(error); }
}
