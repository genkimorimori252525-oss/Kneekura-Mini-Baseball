import type { ManagerAgentState, ManagerEstimate } from
  './ManagerDecision';

export type ManagerExecutionLearningPolicy = Readonly<{
  policyId: string;
  version: string;
  availableAtDay: number;
  /** Interpretation of an observed, successful execution in estimate units. */
  successfulExecutionMean: number;
  evidenceWeight: number;
  uncertaintyFloor: number;
  recentHistoryLimit: number;
}>;
export type ManagerExecutionObservation = Readonly<{
  executionId: string;
  sourceEventId: string;
  careerId: string;
  clubId: string;
  managerId: string;
  appointmentId: string;
  decisionId: string;
  actionId: string;
  observedAtDay: number;
}>;
export type ManagerBeliefHistoryEvent = ManagerExecutionObservation
  & Readonly<{ policyId: string; policyVersion: string;
    before: ManagerEstimate; after: ManagerEstimate }>;
export type ManagerBeliefHistory = Readonly<{
  careerId: string;
  managerId: string;
  revision: number;
  policy: ManagerExecutionLearningPolicy;
  agent: ManagerAgentState;
  recent: readonly ManagerBeliefHistoryEvent[];
}>;
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const estimate = (value: ManagerEstimate): boolean =>
  value && Number.isFinite(value.mean)
    && Number.isFinite(value.uncertainty)
    && value.uncertainty >= 0
    && Number.isFinite(value.evidence) && value.evidence >= 0;
const skillAxes = ['tacticalJudgment', 'analysis', 'adaptation',
  'playerEvaluation', 'operations', 'leadership'] as const;
const temperamentAxes = ['riskAppetite', 'decisionPace',
  'policyPersistence', 'noveltyAppetite',
  'consultationStyle'] as const;
const copyEstimate = (value: ManagerEstimate): ManagerEstimate =>
  ({ mean: value.mean, uncertainty: value.uncertainty,
    evidence: value.evidence });
const freezeDeep = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
};

/** A manager Person keeps observations, not a copy of world truth. */
export const createManagerBeliefHistory = (
  careerId: string, managerId: string, agent: ManagerAgentState,
  policy: ManagerExecutionLearningPolicy,
): ManagerBeliefHistory => {
  if (!id(careerId) || !id(managerId)
    || !policy || !id(policy.policyId) || !id(policy.version)
    || !day(policy.availableAtDay)
    || !Number.isFinite(policy.successfulExecutionMean)
    || !Number.isFinite(policy.evidenceWeight)
    || policy.evidenceWeight <= 0 || policy.evidenceWeight > 1
    || !Number.isFinite(policy.uncertaintyFloor)
    || policy.uncertaintyFloor < 0
    || !Number.isSafeInteger(policy.recentHistoryLimit)
    || policy.recentHistoryLimit < 1
    || policy.recentHistoryLimit > 128
    || !agent || !Array.isArray(agent.beliefs?.candidates)
    || skillAxes.some((axis) =>
      !Number.isFinite(agent.skills?.[axis]))
    || temperamentAxes.some((axis) =>
      !Number.isFinite(agent.temperament?.[axis]))
    || !Array.isArray(agent.philosophy?.preferredStyleTags)
    || agent.philosophy.preferredStyleTags.some((tag) => !id(tag))
    || !Array.isArray(agent.strategyMemory?.activePolicyActionIds)
    || agent.strategyMemory.activePolicyActionIds.some((actionId) =>
      !id(actionId))
    || new Set(agent.beliefs.candidates.map((belief) =>
      belief.actionId)).size !== agent.beliefs.candidates.length
    || agent.beliefs.candidates.some((belief) =>
      !id(belief.actionId)
        || !Array.isArray(belief.styleTags)
        || belief.styleTags.some((tag: string) => !id(tag))
        || !estimate(belief.competitiveOutcome)
        || !estimate(belief.resourceHealth)
        || !estimate(belief.executionFeasibility)
        || !estimate(belief.opponentInformationResponse)
        || (belief.humanRoleConsequence !== undefined
          && !estimate(belief.humanRoleConsequence))
        || (belief.exceptionalObjectiveRelevance !== undefined
          && !estimate(belief.exceptionalObjectiveRelevance)))) {
    throw new Error('invalid manager belief history seed or policy');
  }
  const normalizedPolicy: ManagerExecutionLearningPolicy = {
    policyId: policy.policyId, version: policy.version,
    availableAtDay: policy.availableAtDay,
    successfulExecutionMean: policy.successfulExecutionMean,
    evidenceWeight: policy.evidenceWeight,
    uncertaintyFloor: policy.uncertaintyFloor,
    recentHistoryLimit: policy.recentHistoryLimit,
  };
  const normalizedAgent: ManagerAgentState = {
    skills: Object.fromEntries(skillAxes.map((axis) =>
      [axis, agent.skills[axis]])) as unknown as
        ManagerAgentState['skills'],
    philosophy: { preferredStyleTags: [
      ...agent.philosophy.preferredStyleTags] },
    temperament: Object.fromEntries(temperamentAxes.map((axis) =>
      [axis, agent.temperament[axis]])) as unknown as
        ManagerAgentState['temperament'],
    beliefs: { candidates: agent.beliefs.candidates.map((belief) => ({
      actionId: belief.actionId, styleTags: [...belief.styleTags],
      competitiveOutcome: copyEstimate(belief.competitiveOutcome),
      resourceHealth: copyEstimate(belief.resourceHealth),
      executionFeasibility: copyEstimate(belief.executionFeasibility),
      opponentInformationResponse: copyEstimate(
        belief.opponentInformationResponse),
      ...(belief.humanRoleConsequence === undefined ? {}
        : { humanRoleConsequence: copyEstimate(
          belief.humanRoleConsequence) }),
      ...(belief.exceptionalObjectiveRelevance === undefined ? {}
        : { exceptionalObjectiveRelevance: copyEstimate(
          belief.exceptionalObjectiveRelevance) }),
    })) },
    strategyMemory: { activePolicyActionIds: [
      ...agent.strategyMemory.activePolicyActionIds] },
  };
  return freezeDeep({ careerId, managerId, revision: 0,
    policy: normalizedPolicy, agent: normalizedAgent, recent: [] });
};

/** The host must first verify the source execution and its observed event. */
export const applyManagerExecutionObservation = (
  state: ManagerBeliefHistory, expectedRevision: number,
  observation: ManagerExecutionObservation,
): ManagerBeliefHistory => {
  if (!Number.isSafeInteger(expectedRevision)
    || expectedRevision !== state.revision) {
    throw new Error('manager history revision mismatch');
  }
  if (!observation || !id(observation.executionId)
    || !id(observation.sourceEventId)
    || !id(observation.careerId) || !id(observation.clubId)
    || !id(observation.managerId)
    || !id(observation.appointmentId)
    || !id(observation.decisionId) || !id(observation.actionId)
    || !day(observation.observedAtDay)
    || observation.careerId !== state.careerId
    || observation.managerId !== state.managerId) {
    throw new Error('manager observation scope mismatch');
  }
  if (observation.observedAtDay < state.policy.availableAtDay) {
    throw new Error('manager learning policy is not available');
  }
  if (state.recent.some((event) =>
    event.executionId === observation.executionId)) {
    throw new Error('duplicate manager execution observation');
  }
  if (state.recent.length > 0 && observation.observedAtDay
    < state.recent[state.recent.length - 1]!.observedAtDay) {
    throw new Error('manager observation is backdated');
  }
  const candidate = state.agent.beliefs.candidates.find((belief) =>
    belief.actionId === observation.actionId);
  if (!candidate) throw new Error('manager action belief is absent');
  if (state.revision === Number.MAX_SAFE_INTEGER) {
    throw new Error('manager history revision overflow');
  }
  const before = candidate.executionFeasibility;
  const weight = state.policy.evidenceWeight;
  const evidence = before.evidence + weight;
  const after: ManagerEstimate = Object.freeze({
    mean: (before.mean * before.evidence
      + state.policy.successfulExecutionMean * weight) / evidence,
    uncertainty: Math.max(state.policy.uncertaintyFloor,
      before.uncertainty * before.evidence / evidence),
    evidence,
  });
  if (!estimate(after)) throw new Error('manager estimate overflow');
  const event: ManagerBeliefHistoryEvent = freezeDeep({
    executionId: observation.executionId,
    sourceEventId: observation.sourceEventId,
    careerId: observation.careerId, clubId: observation.clubId,
    managerId: observation.managerId,
    appointmentId: observation.appointmentId,
    decisionId: observation.decisionId,
    actionId: observation.actionId,
    observedAtDay: observation.observedAtDay,
    policyId: state.policy.policyId,
    policyVersion: state.policy.version,
    before: { ...before }, after,
  });
  const candidates = state.agent.beliefs.candidates.map((belief) =>
    belief.actionId === observation.actionId
      ? { ...belief, executionFeasibility: after } : belief);
  return freezeDeep({ ...state, revision: state.revision + 1,
    agent: { ...state.agent, beliefs: { candidates } },
    recent: [...state.recent, event].slice(
      -state.policy.recentHistoryLimit) });
};
