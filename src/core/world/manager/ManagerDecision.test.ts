import { strict as assert } from 'node:assert';
import { describe, it } from 'vitest';
import type { DecisionOpportunity } from '../control/ControlTypes';
import { chooseManagerAction, type ManagerAgentState } from './ManagerDecision';

const opportunity: DecisionOpportunity = {
  decisionId: 'decision-1', contextId: 'context-1', worldRevision: 4,
  clubId: 'club-1', domainId: 'BULLPEN', managerId: 'manager-1',
  appointmentId: 'appointment-1', legalActionIds: ['continue', 'relieve'],
};

function managerState(): ManagerAgentState {
  return {
    skills: { tacticalJudgment: 50, analysis: 50, adaptation: 50,
      playerEvaluation: 50, operations: 50, leadership: 50 },
    philosophy: { preferredStyleTags: ['starter-leash'] },
    temperament: { riskAppetite: 50, decisionPace: 50,
      policyPersistence: 50, noveltyAppetite: 50, consultationStyle: 50 },
    beliefs: { candidates: [
      { actionId: 'continue', styleTags: ['starter-leash'],
        competitiveOutcome: { mean: 2, uncertainty: 1, evidence: 3 },
        resourceHealth: { mean: 1, uncertainty: 1, evidence: 3 },
        executionFeasibility: { mean: 5, uncertainty: 0, evidence: 3 },
        opponentInformationResponse: { mean: 5, uncertainty: 0, evidence: 3 } },
      { actionId: 'relieve', styleTags: ['early-relief'],
        competitiveOutcome: { mean: 6, uncertainty: 1, evidence: 3 },
        resourceHealth: { mean: 5, uncertainty: 1, evidence: 3 },
        executionFeasibility: { mean: 5, uncertainty: 0, evidence: 3 },
        opponentInformationResponse: { mean: 5, uncertainty: 0, evidence: 3 } },
    ] },
    strategyMemory: { activePolicyActionIds: ['continue'] },
  };
}

describe('headless manager decision', () => {
  it('keeps a clearly better believed action despite an opposing policy and philosophy', () => {
    const result = chooseManagerAction(opportunity, managerState());
    assert.equal(result.actionId, 'relieve');
    assert.deepEqual(result.viableActionIds, ['relieve']);
    assert.equal(result.reason, 'BELIEF_DOMINANCE');
  });

  it('never selects a believed action outside the shared legal set', () => {
    const state = managerState();
    const result = chooseManagerAction(opportunity, {
      ...state,
      beliefs: { candidates: [...state.beliefs.candidates,
        { actionId: 'unavailable', styleTags: ['unknown'],
          competitiveOutcome: { mean: 100, uncertainty: 0, evidence: 10 },
          resourceHealth: { mean: 100, uncertainty: 0, evidence: 10 },
          executionFeasibility: { mean: 100, uncertainty: 0, evidence: 10 },
          opponentInformationResponse: { mean: 100, uncertainty: 0, evidence: 10 } }] },
      philosophy: { preferredStyleTags: ['unknown'] },
      strategyMemory: { activePolicyActionIds: ['unavailable'] },
    });
    assert.equal(result.actionId, 'relieve');
    assert.deepEqual(result.viableActionIds, ['relieve']);
  });

  it('uses active policy then philosophy only among incomparable candidates', () => {
    const state = managerState();
    const beliefs = { candidates: [state.beliefs.candidates[0],
      { ...state.beliefs.candidates[1], resourceHealth: { mean: 0, uncertainty: 1, evidence: 3 } }] };
    const policy = chooseManagerAction(opportunity, { ...state, beliefs,
      philosophy: { preferredStyleTags: ['early-relief'] } });
    assert.equal(policy.actionId, 'continue');
    assert.deepEqual(policy.viableActionIds, ['continue', 'relieve']);
    assert.equal(policy.reason, 'ACTIVE_POLICY');
    const philosophy = chooseManagerAction(opportunity, { ...state, beliefs,
      strategyMemory: { activePolicyActionIds: [] },
      philosophy: { preferredStyleTags: ['early-relief'] } });
    assert.equal(philosophy.actionId, 'relieve');
    assert.equal(philosophy.reason, 'PHILOSOPHY');
  });

  it('keeps uncertain near-overlapping beliefs viable rather than claiming dominance', () => {
    const state = managerState();
    const result = chooseManagerAction(opportunity, { ...state, beliefs: { candidates: [
      state.beliefs.candidates[0],
      { ...state.beliefs.candidates[1],
        competitiveOutcome: { mean: 3, uncertainty: 1, evidence: 3 },
        resourceHealth: { mean: 2, uncertainty: 1, evidence: 3 } },
    ] } });
    assert.deepEqual(result.viableActionIds, ['continue', 'relieve']);
    assert.equal(result.actionId, 'continue');
  });

  it('requires an estimate for each legal candidate instead of consulting hidden truth', () => {
    const state = managerState();
    assert.throws(() => chooseManagerAction(opportunity, {
      ...state, beliefs: { candidates: [state.beliefs.candidates[0]] },
    }), /missing belief.*relieve/);
  });

  it('preserves actions with better execution or exceptional objective evidence', () => {
    const state = managerState();
    const beliefs = { candidates: [
      { ...state.beliefs.candidates[0]!,
        executionFeasibility: { mean: 9, uncertainty: 0, evidence: 3 },
        opponentInformationResponse: { mean: 5, uncertainty: 0, evidence: 3 },
        exceptionalObjectiveRelevance: {
          mean: 8, uncertainty: 0, evidence: 3 },
      },
      { ...state.beliefs.candidates[1]!,
        executionFeasibility: { mean: 1, uncertainty: 0, evidence: 3 },
        opponentInformationResponse: { mean: 5, uncertainty: 0, evidence: 3 },
      },
    ] };
    const choice = chooseManagerAction(opportunity, {
      ...state, beliefs,
    });
    assert.deepEqual(choice.viableActionIds, ['continue', 'relieve']);
    assert.equal(choice.actionId, 'continue');
  });

  it('does not prune a role-specific consequence that the other action has not assessed', () => {
    const state = managerState();
    const relief = { ...state.beliefs.candidates[1]!,
      humanRoleConsequence: {
        mean: -4, uncertainty: 1, evidence: 2 },
    };
    const result = chooseManagerAction(opportunity, { ...state,
      beliefs: { candidates: [state.beliefs.candidates[0]!, relief] } });
    assert.deepEqual(result.viableActionIds, ['continue', 'relieve']);
    assert.throws(() => chooseManagerAction(opportunity, { ...state,
      beliefs: { candidates: [state.beliefs.candidates[0]!,
        { ...relief, humanRoleConsequence: {
          mean: NaN, uncertainty: 1, evidence: 2 } }] } }),
    /estimate/);
  });

  it('does not change the manager state or depend on hidden outcome fields', () => {
    const state = managerState();
    const initial = JSON.stringify(state);
    const first = chooseManagerAction(opportunity, state);
    const second = chooseManagerAction({ ...opportunity, actualFutureWinner: 'continue' } as DecisionOpportunity, state);
    assert.deepEqual(second, first);
    assert.equal(JSON.stringify(state), initial);
    assert.ok(Object.isFrozen(first));
    assert.ok(Object.isFrozen(first.viableActionIds));
  });
});
