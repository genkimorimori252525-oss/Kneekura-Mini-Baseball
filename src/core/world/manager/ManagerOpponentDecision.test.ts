import { describe, expect, it } from 'vitest';
import { createHumanControlState } from '../control/HumanControl';
import type { DecisionOpportunity } from '../control/ControlTypes';
import { appendPlayerKnowledgeReport, appendScoutingEvidence,
  createClubScoutingKnowledge } from '../scouting/ScoutingKnowledge';
import type { ManagerAgentState } from './ManagerDecision';
import { selectManagerControlledDecisionWithOpponentEvidence }
  from './ManagerOpponentDecision';
import type { OpponentTacticalAttentionInput }
  from './OpponentTacticalAttention';

const opportunity: DecisionOpportunity = {
  decisionId: 'decision-1', contextId: 'context-1', worldRevision: 4,
  clubId: 'club-a', domainId: 'PITCHING', managerId: 'manager-1',
  appointmentId: 'appointment-1',
  legalActionIds: ['attack', 'avoid', 'change-pitcher'],
};
const control = (manual = false) => createHumanControlState({
  revision: 0, controllerId: 'human', controlledClubId: 'club-a',
  domainIds: ['PITCHING'], manualDomainIds: manual ? ['PITCHING'] : [],
});
const estimate = (mean: number) => ({ mean, uncertainty: 0,
  evidence: 2 });
const belief = (actionId: string, outcome: number) => ({
  actionId, styleTags: [], competitiveOutcome: estimate(outcome),
  resourceHealth: estimate(5), executionFeasibility: estimate(5),
  opponentInformationResponse: estimate(5),
});
const agent = (avoidOutcome = 8) => ({
  managerId: 'manager-1', appointmentId: 'appointment-1',
  state: {
    skills: { tacticalJudgment: 50, analysis: 50, adaptation: 50,
      playerEvaluation: 50, operations: 50, leadership: 50 },
    philosophy: { preferredStyleTags: [] },
    temperament: { riskAppetite: 50, decisionPace: 50,
      policyPersistence: 50, noveltyAppetite: 50, consultationStyle: 50 },
    beliefs: { candidates: [belief('attack', 6),
      belief('avoid', avoidOutcome), belief('change-pitcher', 4)] },
    strategyMemory: { activePolicyActionIds: [] },
  } satisfies ManagerAgentState,
});
const attention = (lower = 8): OpponentTacticalAttentionInput => {
  let knowledge = createClubScoutingKnowledge('career', 'club-a');
  for (const [index, day] of [10, 12].entries()) {
    knowledge = appendScoutingEvidence(knowledge, knowledge.revision, {
      evidenceId: `e${index + 1}`, careerId: 'career',
      clubId: 'club-a', playerId: 'opponent',
      observedAtDay: day, availableAtDay: day + 1,
      sourceEventId: `match-${index + 1}`,
    });
  }
  knowledge = appendPlayerKnowledgeReport(knowledge, knowledge.revision, {
    reportId: 'report', careerId: 'career', clubId: 'club-a',
    playerId: 'opponent', observedAtDay: 12, availableAtDay: 14,
    evidenceSourceIds: ['e1', 'e2'], evaluatorPersonIds: ['scout'],
    estimate: [{ domainId: 'batting-threat', lower, upper: 10 }],
    confidence: 'HIGH',
  });
  return { careerId: 'career', clubId: 'club-a',
    managerId: 'manager-1', opponentPlayerId: 'opponent',
    asOfDay: 20, knowledge,
    context: { leverage: 0.8, roleCentrality: 0.9,
      legalActionIds: opportunity.legalActionIds,
      cautiousActionIds: ['avoid', 'change-pitcher'] },
    policy: { policyId: 'prep', version: 'v1', domainId: 'batting-threat',
      maxReportAgeDays: 30, minimumEvidenceCount: 2,
      minimumThreatLowerBound: 7, minimumLeverage: 0.6,
      minimumRoleCentrality: 0.7, minimumConfidence: 'MEDIUM' },
  };
};
const select = (request = attention(), avoidOutcome = 8,
  manual = false) => selectManagerControlledDecisionWithOpponentEvidence(
  control(manual), opportunity, agent(avoidOutcome), 'trace-1',
  request, ['attack']);

describe('manager decision from opponent evidence', () => {
  it('admits a cautious legal candidate and lets Manager Belief choose it', () => {
    const result = select();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.attention.provenance.reportId).toBe('report');
    expect(result.value.admittedActionIds).toEqual([
      'attack', 'avoid', 'change-pitcher']);
    expect(result.value.decision.actionId).toBe('avoid');
    expect(result.value.trace.reason).toBe('BELIEF_DOMINANCE');
  });

  it('does not automatically avoid an observed threat when Manager Belief favors attack', () => {
    const result = select(attention(), 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.attention.considerCautiousActions).toBe(true);
    expect(result.value.decision.actionId).toBe('attack');
  });

  it('does not admit cautious actions from weak evidence', () => {
    const result = select(attention(4));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.admittedActionIds).toEqual(['attack']);
    expect(result.value.decision.actionId).toBe('attack');
  });

  it('keeps host legality and manual control authoritative', () => {
    const illegal = { ...attention(), context: {
      ...attention().context, cautiousActionIds: ['avoid', 'not-legal'],
    } };
    const chosen = select(illegal);
    expect(chosen.ok).toBe(true);
    if (chosen.ok) expect(chosen.value.admittedActionIds)
      .toEqual(['attack', 'avoid']);
    const manual = select({ ...attention(), knowledge: {
      ...attention().knowledge, clubId: 'invalid',
    } }, 8, true);
    expect(manual).toMatchObject({ ok: false,
      reason: { code: 'HUMAN_INPUT_REQUIRED' } });
  });

  it('rejects stale context and missing admitted beliefs', () => {
    const stale = select({ ...attention(), managerId: 'former-manager' });
    expect(stale).toMatchObject({ ok: false,
      reason: { code: 'INVALID_INPUT' } });
    const malformed = { ...attention(), context: {
      ...attention().context, legalActionIds: undefined,
    } } as unknown as OpponentTacticalAttentionInput;
    expect(select(malformed)).toMatchObject({ ok: false,
      reason: { code: 'INVALID_INPUT' } });
    const incomplete = selectManagerControlledDecisionWithOpponentEvidence(
      control(), opportunity, { ...agent(), state: { ...agent().state,
        beliefs: { candidates: [belief('attack', 6)] } } },
      'trace-1', attention(), ['attack']);
    expect(incomplete).toMatchObject({ ok: false,
      reason: { code: 'INVALID_INPUT' } });
  });
});
