import type { HumanControlState, ControlChangeResult, DecisionAuthority, ControlResult, HumanControlChanged } from './ControlTypes';
import { object, id, nullableId, revision, ids, invalid, rejection, failure, success, validationFailure, parseOpportunity } from './ControlValidation';

/** Construct or restore detached policy. It owns no Manager Agent, appointment or world history. */
export function createHumanControlState(value: unknown): HumanControlState {
  const input = object(value, 'control');
  if (input.schemaVersion !== undefined && input.schemaVersion !== 1) return invalid('schemaVersion');
  const controlledClubId = nullableId(input.controlledClubId, 'controlledClubId');
  const domainIds = ids(input.domainIds, 'domainIds', true);
  const manualDomainIds = ids(input.manualDomainIds, 'manualDomainIds', true);
  if (manualDomainIds.some(domain => !domainIds.includes(domain))) return invalid('manualDomainIds');
  if (controlledClubId === null && manualDomainIds.length !== 0) return invalid('manualDomainIds');
  return Object.freeze({ schemaVersion: 1, revision: revision(input.revision, 'revision'),
    controllerId: id(input.controllerId, 'controllerId'), controlledClubId, domainIds, manualDomainIds });
}

/** Replace the active overlay atomically. No-op requests preserve the current revision. */
export function changeHumanControl(state: HumanControlState, value: unknown): ControlChangeResult {
  const noEvents = Object.freeze([]) as readonly [];
  try {
    const current = createHumanControlState(state); const input = object(value, 'change');
    const expected = revision(input.expectedRevision, 'expectedRevision');
    if (expected !== current.revision) return Object.freeze({ ok: false, state, events: noEvents, reason: rejection('STALE_CONTROL_REVISION') });
    const replacement = createHumanControlState({ ...current,
      controlledClubId: nullableId(input.controlledClubId, 'controlledClubId'), manualDomainIds: ids(input.manualDomainIds, 'manualDomainIds') });
    if (replacement.controlledClubId === current.controlledClubId &&
        replacement.manualDomainIds.length === current.manualDomainIds.length &&
        replacement.manualDomainIds.every((domain, index) => domain === current.manualDomainIds[index])) {
      return Object.freeze({ ok: true, state, events: noEvents });
    }
    if (current.revision === Number.MAX_SAFE_INTEGER) {
      return Object.freeze({ ok: false, state, events: noEvents, reason: rejection('REVISION_EXHAUSTED') });
    }
    const next = createHumanControlState({ ...replacement, revision: current.revision + 1 });
    const event: HumanControlChanged = Object.freeze({ kind: 'HUMAN_CONTROL_CHANGED', controllerId: current.controllerId,
      fromRevision: current.revision, toRevision: next.revision, previousClubId: current.controlledClubId,
      controlledClubId: next.controlledClubId, previousManualDomainIds: current.manualDomainIds, manualDomainIds: next.manualDomainIds });
    return Object.freeze({ ok: true, state: next, events: Object.freeze([event]) });
  } catch (error) {
    const rejected = validationFailure(error);
    return Object.freeze({ ...rejected, state, events: noEvents });
  }
}

/** Routing only: this never runs a manager, selects an action, or executes baseball. */
export function resolveDecisionAuthority(state: HumanControlState, value: unknown): ControlResult<DecisionAuthority> {
  try {
    const current = createHumanControlState(state); const opportunity = parseOpportunity(value);
    if (!current.domainIds.includes(opportunity.domainId)) return failure('UNKNOWN_DOMAIN', 'domainId');
    const controlled = current.controlledClubId === opportunity.clubId;
    if (controlled && current.manualDomainIds.includes(opportunity.domainId)) {
      return success(Object.freeze({ kind: 'HUMAN_REQUIRED', controllerId: current.controllerId }));
    }
    return success(Object.freeze({ kind: 'MANAGER', origin: controlled ? 'MANAGER_DELEGATED' : 'MANAGER_AUTONOMOUS',
      managerId: opportunity.managerId, appointmentId: opportunity.appointmentId }));
  } catch (error) { return validationFailure(error); }
}
