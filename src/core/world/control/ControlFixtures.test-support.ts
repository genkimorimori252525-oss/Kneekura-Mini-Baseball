import type { ControlSeed, DecisionOpportunity, DecisionSubmission, ExecutedDecision } from './ControlTypes';

export function seed(): ControlSeed {
  return { revision: 0, controllerId: 'human-1', controlledClubId: 'club-A',
    domainIds: ['LINEUP', 'BULLPEN', 'PROMOTION_DEMOTION', 'IN_GAME_COMMAND'], manualDomainIds: ['LINEUP'] };
}
export function opportunity(): DecisionOpportunity {
  return { decisionId: 'decision-1', contextId: 'context-1', worldRevision: 10,
    clubId: 'club-A', domainId: 'LINEUP', managerId: 'manager-A', appointmentId: 'tenure-A-1',
    legalActionIds: ['bunt', 'swing', 'rest'] };
}
export function humanSubmission(): DecisionSubmission {
  return { decisionId: 'decision-1', contextId: 'context-1', expectedControlRevision: 0, expectedWorldRevision: 10, actionId: 'bunt',
    actor: { kind: 'HUMAN', controllerId: 'human-1' } };
}
export function managerSubmission(): DecisionSubmission {
  return { decisionId: 'decision-1', contextId: 'context-1', expectedControlRevision: 0, expectedWorldRevision: 10, actionId: 'swing',
    actor: { kind: 'MANAGER', managerId: 'manager-A', appointmentId: 'tenure-A-1', traceId: 'trace-A-1' } };
}
export function execution(): ExecutedDecision {
  return { executionId: 'execution-1', decisionId: 'decision-1', contextId: 'context-1',
    actionId: 'bunt', worldRevision: 11, eventIds: ['world-event-1'] };
}
