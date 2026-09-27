import type { ControlResult, DecisionOpportunity,
  HumanControlState } from '../control/ControlTypes';
import { createHumanControlState,
  resolveDecisionAuthority } from '../control/HumanControl';
import { failure, id, parseOpportunity,
  validationFailure } from '../control/ControlValidation';
import { selectManagerControlledDecision,
  type ManagerControlledSelection,
  type ManagerDecisionAgent } from './ManagerControlledDecision';
import { projectOpponentTacticalAttention,
  type OpponentTacticalAttention,
  type OpponentTacticalAttentionInput } from './OpponentTacticalAttention';

export type ManagerOpponentControlledSelection =
  ManagerControlledSelection & Readonly<{
    admittedActionIds: readonly string[];
    attention: OpponentTacticalAttention;
  }>;

/** Admits evidence-backed candidates, then lets Manager Belief choose under host legality. */
export function selectManagerControlledDecisionWithOpponentEvidence(
  control: HumanControlState,
  opportunity: DecisionOpportunity,
  agent: ManagerDecisionAgent,
  traceId: string,
  attentionInput: OpponentTacticalAttentionInput,
  baselineCandidateActionIds: readonly string[],
): ControlResult<ManagerOpponentControlledSelection> {
  let legal: DecisionOpportunity;
  try {
    const current = createHumanControlState(control);
    legal = parseOpportunity(opportunity);
    if (id(agent?.managerId, 'agent.managerId') !== legal.managerId
      || id(agent.appointmentId, 'agent.appointmentId')
        !== legal.appointmentId) {
      return failure('STALE_MANAGER_APPOINTMENT');
    }
    const authority = resolveDecisionAuthority(current, legal);
    if (!authority.ok) return authority;
    if (authority.value.kind === 'HUMAN_REQUIRED') {
      return failure('HUMAN_INPUT_REQUIRED');
    }
  } catch (error) {
    return validationFailure(error);
  }
  if (!Array.isArray(baselineCandidateActionIds)
    || baselineCandidateActionIds.length === 0
    || new Set(baselineCandidateActionIds).size
      !== baselineCandidateActionIds.length
    || baselineCandidateActionIds.some(actionId =>
      typeof actionId !== 'string'
      || !legal.legalActionIds.includes(actionId))) {
    return failure('INVALID_INPUT', 'baselineCandidateActionIds');
  }
  if (attentionInput?.clubId !== legal.clubId
    || attentionInput.managerId !== legal.managerId
    || !Array.isArray(attentionInput.context?.legalActionIds)
    || attentionInput.context.legalActionIds.length
      !== legal.legalActionIds.length
    || legal.legalActionIds.some((actionId, index) =>
      attentionInput.context.legalActionIds[index] !== actionId)) {
    return failure('INVALID_INPUT', 'opponentAttention');
  }
  let attention: OpponentTacticalAttention;
  try {
    attention = projectOpponentTacticalAttention(attentionInput);
  } catch {
    return failure('INVALID_INPUT', 'opponentAttention');
  }
  const admitted = legal.legalActionIds.filter(actionId =>
    baselineCandidateActionIds.includes(actionId)
      || attention.candidateActionIds.includes(actionId));
  const selected = selectManagerControlledDecision(control, legal,
    agent, traceId, admitted);
  if (!selected.ok) return selected;
  return Object.freeze({ ok: true as const,
    value: Object.freeze({ ...selected.value,
      admittedActionIds: Object.freeze(admitted), attention }),
  });
}
