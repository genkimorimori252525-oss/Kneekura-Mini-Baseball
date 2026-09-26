import { strict as assert } from 'node:assert';
import { describe, it } from 'vitest';
import { createHumanControlState, attributeExecutedDecision } from '../control';
import type { DecisionOpportunity } from '../control/ControlTypes';
import type { ManagerAgentState } from './ManagerDecision';
import { selectManagerControlledDecision } from './ManagerControlledDecision';

const opportunity: DecisionOpportunity = {
  decisionId: 'decision-1', contextId: 'context-1', worldRevision: 10,
  clubId: 'club-A', domainId: 'BULLPEN', managerId: 'manager-A',
  appointmentId: 'tenure-A-1', legalActionIds: ['continue', 'relieve'],
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
        resourceHealth: { mean: 1, uncertainty: 1, evidence: 3 } },
      { actionId: 'relieve', styleTags: ['early-relief'],
        competitiveOutcome: { mean: 6, uncertainty: 1, evidence: 3 },
        resourceHealth: { mean: 5, uncertainty: 1, evidence: 3 } },
    ] },
    strategyMemory: { activePolicyActionIds: ['continue'] },
  };
}

function control(manualDomainIds: readonly string[] = []) {
  return createHumanControlState({ revision: 0, controllerId: 'human-1',
    controlledClubId: 'club-A', domainIds: ['BULLPEN'], manualDomainIds });
}

function agent(state = managerState()) {
  return { managerId: 'manager-A', appointmentId: 'tenure-A-1', state };
}

describe('manager controlled decision adapter', () => {
  it('submits the believed action to the shared gate and returns its decision-time reason trace', () => {
    const selected = selectManagerControlledDecision(control(), opportunity, agent(), 'trace-1');
    assert.ok(selected.ok);
    assert.equal(selected.value.decision.actionId, 'relieve');
    assert.equal(selected.value.decision.origin, 'MANAGER_DELEGATED');
    assert.deepEqual(selected.value.trace, {
      traceId: 'trace-1', decisionId: 'decision-1', contextId: 'context-1',
      actionId: 'relieve', viableActionIds: ['relieve'], reason: 'BELIEF_DOMINANCE',
    });
    assert.equal(selected.value.decision.actor.kind, 'MANAGER');
    if (selected.value.decision.actor.kind === 'MANAGER') {
      assert.equal(selected.value.decision.actor.traceId, selected.value.trace.traceId);
    }
    assert.ok(Object.isFrozen(selected.value.trace));
    const evidence = attributeExecutedDecision(selected.value.decision, {
      executionId: 'execution-1', decisionId: 'decision-1', contextId: 'context-1',
      worldRevision: 11, actionId: 'relieve', eventIds: ['event-1'],
    });
    assert.ok(evidence.ok);
    assert.equal(evidence.value.managerSelfChosenEvidence?.traceId, 'trace-1');
  });

  it('refuses CPU selection on a manual domain before reading an incomplete belief', () => {
    const state = managerState();
    const result = selectManagerControlledDecision(control(['BULLPEN']), opportunity,
      agent({ ...state, beliefs: { candidates: [] } }), 'trace-1');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason.code, 'HUMAN_INPUT_REQUIRED');
  });

  it('rejects a manager state from another appointment', () => {
    const result = selectManagerControlledDecision(control(), opportunity,
      { ...agent(), appointmentId: 'tenure-A-0' }, 'trace-1');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason.code, 'STALE_MANAGER_APPOINTMENT');
  });

  it('does not pass a hidden future result through the CPU decision boundary', () => {
    const state = managerState();
    const withHiddenResult = { ...opportunity, actualFutureWinner: 'continue' } as DecisionOpportunity;
    const selected = selectManagerControlledDecision(control(), withHiddenResult, agent(state), 'trace-1');
    assert.ok(selected.ok);
    assert.equal(selected.value.decision.actionId, 'relieve');
    assert.equal('actualFutureWinner' in selected.value.trace, false);
    assert.equal('actualFutureWinner' in selected.value.decision, false);
  });

  it('fails closed when a legal action lacks a belief', () => {
    const state = managerState();
    const result = selectManagerControlledDecision(control(), opportunity,
      agent({ ...state, beliefs: { candidates: [state.beliefs.candidates[0]] } }), 'trace-1');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason.code, 'INVALID_INPUT');
  });

  it('rejects a missing trace reference through the shared control validation', () => {
    const result = selectManagerControlledDecision(control(), opportunity, agent(), '');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason.code, 'INVALID_INPUT');
  });
});
