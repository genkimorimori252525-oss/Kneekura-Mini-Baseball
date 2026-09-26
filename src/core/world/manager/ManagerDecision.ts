import type { DecisionOpportunity } from '../control/ControlTypes';

export type ManagerSkillProfile = Readonly<{
  tacticalJudgment: number;
  analysis: number;
  adaptation: number;
  playerEvaluation: number;
  operations: number;
  leadership: number;
}>;

export type ManagerPhilosophy = Readonly<{
  preferredStyleTags: readonly string[];
}>;

export type ManagerTemperament = Readonly<{
  riskAppetite: number;
  decisionPace: number;
  policyPersistence: number;
  noveltyAppetite: number;
  consultationStyle: number;
}>;

export type ManagerEstimate = Readonly<{
  /** Higher means better for the club; this is an observed estimate, never world truth. */
  mean: number;
  /** Non-negative half-width in the same units as mean. */
  uncertainty: number;
  evidence: number;
}>;

export type ManagerActionBelief = Readonly<{
  actionId: string;
  styleTags: readonly string[];
  competitiveOutcome: ManagerEstimate;
  resourceHealth: ManagerEstimate;
  executionFeasibility: ManagerEstimate;
  opponentInformationResponse: ManagerEstimate;
  humanRoleConsequence?: ManagerEstimate;
  exceptionalObjectiveRelevance?: ManagerEstimate;
}>;

export type ManagerBeliefState = Readonly<{
  candidates: readonly ManagerActionBelief[];
}>;

export type ManagerStrategyMemory = Readonly<{
  activePolicyActionIds: readonly string[];
}>;

export type ManagerAgentState = Readonly<{
  skills: ManagerSkillProfile;
  philosophy: ManagerPhilosophy;
  temperament: ManagerTemperament;
  beliefs: ManagerBeliefState;
  strategyMemory: ManagerStrategyMemory;
}>;

export type ManagerActionChoice = Readonly<{
  decisionId: string;
  contextId: string;
  actionId: string;
  viableActionIds: readonly string[];
  reason: 'BELIEF_DOMINANCE' | 'ACTIVE_POLICY' | 'PHILOSOPHY' | 'LEGAL_ORDER';
}>;

function validateEstimate(estimate: ManagerEstimate): void {
  if (!Number.isFinite(estimate.mean)
    || !Number.isFinite(estimate.uncertainty) || estimate.uncertainty < 0
    || !Number.isFinite(estimate.evidence) || estimate.evidence < 0) {
    throw new Error('manager estimate must be finite with non-negative uncertainty and evidence');
  }
}

function dominates(first: ManagerActionBelief, second: ManagerActionBelief): boolean {
  const required = ['competitiveOutcome', 'resourceHealth',
    'executionFeasibility', 'opponentInformationResponse'] as const;
  const optional = ['humanRoleConsequence',
    'exceptionalObjectiveRelevance'] as const;
  // An action-specific consequence needs evidence on both sides before pruning.
  if (optional.some((channel) =>
    Boolean(first[channel]) !== Boolean(second[channel]))) return false;
  const channels = [...required,
    ...optional.filter((channel) => first[channel] && second[channel])];
  const gaps = channels.map((channel) => {
    const a = first[channel]!;
    const b = second[channel]!;
    return a.mean - a.uncertainty - b.mean - b.uncertainty;
  });
  return gaps.every((gap) => gap >= 0)
    && gaps.some((gap) => gap > 0);
}

/** Uses only observed beliefs and host-owned legal actions; it never forecasts with Match Core. */
export function chooseManagerAction(
  opportunity: DecisionOpportunity,
  state: ManagerAgentState,
): ManagerActionChoice {
  const legalActionIds = opportunity.legalActionIds;
  if (legalActionIds.length === 0 || new Set(legalActionIds).size !== legalActionIds.length) {
    throw new Error('legal actions must be non-empty and distinct');
  }
  const beliefs = new Map<string, ManagerActionBelief>();
  for (const belief of state.beliefs.candidates) {
    if (!legalActionIds.includes(belief.actionId)) continue;
    if (beliefs.has(belief.actionId)) throw new Error(`duplicate belief for ${belief.actionId}`);
    validateEstimate(belief.competitiveOutcome);
    validateEstimate(belief.resourceHealth);
    validateEstimate(belief.executionFeasibility);
    validateEstimate(belief.opponentInformationResponse);
    if (belief.humanRoleConsequence) {
      validateEstimate(belief.humanRoleConsequence);
    }
    if (belief.exceptionalObjectiveRelevance) {
      validateEstimate(belief.exceptionalObjectiveRelevance);
    }
    beliefs.set(belief.actionId, belief);
  }
  for (const actionId of legalActionIds) {
    if (!beliefs.has(actionId)) throw new Error(`missing belief for ${actionId}`);
  }
  const viableActionIds = legalActionIds.filter((actionId) => {
    const candidate = beliefs.get(actionId)!;
    return !legalActionIds.some((otherId) => {
      const other = beliefs.get(otherId)!;
      return dominates(other, candidate);
    });
  });
  const activePolicy = state.strategyMemory.activePolicyActionIds.find((actionId) => viableActionIds.includes(actionId));
  const philosophy = state.philosophy.preferredStyleTags
    .map((styleTag) => viableActionIds.find((actionId) => beliefs.get(actionId)!.styleTags.includes(styleTag)))
    .find((actionId) => actionId !== undefined);
  const actionId = activePolicy ?? philosophy ?? viableActionIds[0];
  const reason = viableActionIds.length === 1 && legalActionIds.length > 1
    ? 'BELIEF_DOMINANCE'
    : activePolicy !== undefined ? 'ACTIVE_POLICY'
      : philosophy !== undefined ? 'PHILOSOPHY' : 'LEGAL_ORDER';
  return Object.freeze({ decisionId: opportunity.decisionId, contextId: opportunity.contextId,
    actionId, viableActionIds: Object.freeze(viableActionIds), reason });
}
