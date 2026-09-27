import { expect, it } from 'vitest';
import type { ManagerAgentState } from './ManagerDecision';
import { applyManagerExecutionObservation,
  createManagerBeliefHistory } from './ManagerBeliefHistory';

const agent = (): ManagerAgentState => ({
  skills: { tacticalJudgment: 50, analysis: 50, adaptation: 50,
    playerEvaluation: 50, operations: 50, leadership: 50 },
  philosophy: { preferredStyleTags: [] },
  temperament: { riskAppetite: 50, decisionPace: 50,
    policyPersistence: 50, noveltyAppetite: 50,
    consultationStyle: 50 },
  beliefs: { candidates: [{ actionId: 'rest-p1', styleTags: [],
    competitiveOutcome: { mean: 4, uncertainty: 2, evidence: 1 },
    resourceHealth: { mean: 3, uncertainty: 1, evidence: 1 },
    executionFeasibility: { mean: 0.2, uncertainty: 0.4,
      evidence: 1 },
    opponentInformationResponse: { mean: 2,
      uncertainty: 1, evidence: 1 } }] },
  strategyMemory: { activePolicyActionIds: [] },
});
const policy = { policyId: 'execution-learning', version: 'v1',
  availableAtDay: 10, successfulExecutionMean: 1,
  evidenceWeight: 1, uncertaintyFloor: 0.1,
  recentHistoryLimit: 8 };
const observation = { executionId: 'execution-1',
  sourceEventId: 'roster-event-1', careerId: 'career-a',
  clubId: 'club-a', managerId: 'manager-a',
  appointmentId: 'appointment-a', decisionId: 'decision-1',
  actionId: 'rest-p1', observedAtDay: 11 };

it('learns only execution feasibility from a successful observed action', () => {
  const before = createManagerBeliefHistory('career-a',
    'manager-a', agent(), policy);
  const after = applyManagerExecutionObservation(before,
    0, observation);
  expect(after.revision).toBe(1);
  expect(after.agent.beliefs.candidates[0]?.executionFeasibility)
    .toEqual({ mean: 0.6, uncertainty: 0.2, evidence: 2 });
  expect(after.agent.beliefs.candidates[0]?.competitiveOutcome)
    .toEqual(before.agent.beliefs.candidates[0]?.competitiveOutcome);
  expect(after.agent.skills).toEqual(before.agent.skills);
  expect(after.agent.strategyMemory).toEqual(before.agent.strategyMemory);
  expect(after.recent[0]).toMatchObject({
    executionId: 'execution-1', actionId: 'rest-p1',
    sourceEventId: 'roster-event-1' });
});

it('rejects stale, duplicate, future and unrepresented evidence', () => {
  const before = createManagerBeliefHistory('career-a',
    'manager-a', agent(), policy);
  expect(() => applyManagerExecutionObservation(before,
    1, observation)).toThrow('revision');
  expect(() => applyManagerExecutionObservation(before,
    0, { ...observation, observedAtDay: 9 })).toThrow('policy');
  expect(() => applyManagerExecutionObservation(before,
    0, { ...observation, actionId: 'unknown' })).toThrow('belief');
  const after = applyManagerExecutionObservation(before,
    0, observation);
  expect(() => applyManagerExecutionObservation(after,
    1, observation)).toThrow('duplicate');
});

it('does not carry hidden or future fields from a source agent', () => {
  const seeded = createManagerBeliefHistory('career-a',
    'manager-a', { ...agent(), hiddenTrueAbility: 100,
      beliefs: { candidates: [{
        ...agent().beliefs.candidates[0],
        futureResult: 'win',
      }] },
    } as never, { ...policy, futureResult: 'win' } as never);
  expect(JSON.stringify(seeded)).not.toContain('hiddenTrueAbility');
  expect(JSON.stringify(seeded)).not.toContain('futureResult');
});
