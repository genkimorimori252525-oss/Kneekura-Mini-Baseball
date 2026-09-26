import type { ControlResult, ControlledDecision, DecisionOpportunity, HumanControlState } from '../control/ControlTypes';
import { selectControlledDecision } from '../control/ControlledDecision';
import { createHumanControlState, resolveDecisionAuthority } from '../control/HumanControl';
import { failure, id, parseOpportunity, validationFailure } from '../control/ControlValidation';
import { chooseManagerAction } from './ManagerDecision';
import type { ManagerActionChoice, ManagerAgentState } from './ManagerDecision';

export type ManagerDecisionAgent = Readonly<{
  managerId: string;
  appointmentId: string;
  state: ManagerAgentState;
}>;

export type ManagerControlledDecisionTrace = ManagerActionChoice & Readonly<{ traceId: string }>;

export type ManagerControlledSelection = Readonly<{
  decision: ControlledDecision;
  trace: ManagerControlledDecisionTrace;
}>;

export function selectManagerControlledDecision(
  control: HumanControlState,
  opportunity: DecisionOpportunity,
  agent: ManagerDecisionAgent,
  traceId: string,
): ControlResult<ManagerControlledSelection> {
  try {
    const current = createHumanControlState(control);
    const legalOpportunity = parseOpportunity(opportunity);
    if (id(agent?.managerId, 'agent.managerId') !== legalOpportunity.managerId
      || id(agent.appointmentId, 'agent.appointmentId')
        !== legalOpportunity.appointmentId) {
      return failure('STALE_MANAGER_APPOINTMENT');
    }
    const authority = resolveDecisionAuthority(current, legalOpportunity);
    if (!authority.ok) return authority;
    if (authority.value.kind === 'HUMAN_REQUIRED') {
      return failure('HUMAN_INPUT_REQUIRED');
    }
    const reference = id(traceId, 'traceId');
    let choice: ManagerActionChoice;
    try {
      choice = chooseManagerAction(legalOpportunity, agent.state);
    } catch {
      return failure('INVALID_INPUT', 'managerBeliefs');
    }
    const selected = selectControlledDecision(current, legalOpportunity, {
      decisionId: legalOpportunity.decisionId,
      contextId: legalOpportunity.contextId,
      expectedControlRevision: current.revision,
      expectedWorldRevision: legalOpportunity.worldRevision,
      actionId: choice.actionId,
      actor: { kind: 'MANAGER', managerId: agent.managerId,
        appointmentId: agent.appointmentId, traceId: reference },
    });
    if (!selected.ok) return selected;
    const trace = Object.freeze({ ...choice, traceId: reference });
    return Object.freeze({ ok: true,
      value: Object.freeze({ decision: selected.value, trace }) });
  } catch (error) {
    return validationFailure(error);
  }
}
