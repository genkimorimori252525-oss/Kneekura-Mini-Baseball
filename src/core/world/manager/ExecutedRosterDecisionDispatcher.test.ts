import { expect, it } from 'vitest';
import { state as club } from '../club/ClubFixtures.test-support';
import { createHumanControlState } from '../control/HumanControl';
import type { DecisionOpportunity } from '../control/ControlTypes';
import { applyRosterChange } from '../roster/RosterCommands';
import { createRosterState } from '../roster/RosterState';
import type { RosterStateInput } from '../roster/RosterTypes';
import { createEmotionState } from '../psychology/EmotionState';
import { appraisalInput, change, value } from '../psychology/appraisal/AppraisalFixtures.test-support';
import { createPlayerRelationshipNetwork } from '../team/PlayerRelationships';
import { createTeamMoodState } from '../team/TeamMood';
import { selectManagerControlledDecision } from './ManagerControlledDecision';
import { dispatchSelectedManagerRosterDecision } from './ExecutedRosterDecisionDispatcher';

const opportunity: DecisionOpportunity = {
  decisionId: 'decision-1', contextId: 'roster-context-1',
  worldRevision: 0, clubId: 'club-a', domainId: 'ROSTER',
  managerId: 'manager-a', appointmentId: 'appointment-a',
  legalActionIds: ['rest-p1', 'keep-p1'],
};
const control = () => createHumanControlState({ revision: 0,
  controllerId: 'human', controlledClubId: 'club-a',
  domainIds: ['ROSTER'], manualDomainIds: [] });
const agent = () => ({ managerId: 'manager-a',
  appointmentId: 'appointment-a', state: {
    skills: { tacticalJudgment: 50, analysis: 50,
      adaptation: 50, playerEvaluation: 50,
      operations: 50, leadership: 50 },
    philosophy: { preferredStyleTags: ['rest'] },
    temperament: { riskAppetite: 50, decisionPace: 50,
      policyPersistence: 50, noveltyAppetite: 50,
      consultationStyle: 50 },
    beliefs: { candidates: [
      { actionId: 'rest-p1', styleTags: ['rest'],
        competitiveOutcome: { mean: 3, uncertainty: 0, evidence: 1 },
        resourceHealth: { mean: 3, uncertainty: 0, evidence: 1 },
        executionFeasibility: { mean: 3, uncertainty: 0, evidence: 1 },
        opponentInformationResponse: { mean: 3, uncertainty: 0,
          evidence: 1 } },
      { actionId: 'keep-p1', styleTags: ['keep'],
        competitiveOutcome: { mean: 1, uncertainty: 0, evidence: 1 },
        resourceHealth: { mean: 1, uncertainty: 0, evidence: 1 },
        executionFeasibility: { mean: 1, uncertainty: 0, evidence: 1 },
        opponentInformationResponse: { mean: 1, uncertainty: 0,
          evidence: 1 } },
    ] }, strategyMemory: { activePolicyActionIds: [] },
  } });
const selected = () => {
  const result = selectManagerControlledDecision(control(), opportunity,
    agent(), 'trace-1');
  if (!result.ok) throw new Error('fixture selection failed');
  return result.value;
};
const roster = () => createRosterState({ careerId: 'career-a',
  effectiveDay: 10,
  profiles: [{ profileId: 'league', version: 'v1', season: 1,
    competitionEditionId: 'league-1', activeLimit: null,
    allowedAssignmentKinds: ['FIRST_TEAM'],
    rehabParticipationAllowed: false }],
  units: [{ unitId: 'first', clubId: 'club-a', kind: 'FIRST_TEAM' }],
  players: ['p1', 'p2'].map((playerId) => ({ playerId,
    clubRights: { rightsHolderClubId: 'club-a',
      contractId: `contract-${playerId}` },
    assignment: { unitId: 'first', clubId: 'club-a' },
    registrations: [], availability: { status: 'AVAILABLE' as const,
      evidenceId: `health-${playerId}` },
  })),
} as RosterStateInput);
const binding = { actionId: 'rest-p1', command: {
  commandId: 'rest-p1', expectedRevision: 0, effectiveDay: 11,
  changes: [{ playerId: 'p1', availability: {
    status: 'UNAVAILABLE' as const,
    evidenceId: 'usage-observed-1' } }],
} };
const input = () => ({ control: control(), opportunity,
  selection: selected(), selectionAgent: agent(),
  clubAtAction: club(), clubAsOfDay: 11,
  roster: roster(), binding, currentWorldRevision: 0,
  afterWorldRevision: 1, executionId: 'execution-1' });

it('executes the selected legal manager action and derives canonical roster evidence', () => {
  const source = input();
  const result = dispatchSelectedManagerRosterDecision(source);
  expect(result.roster.players.find((player) => player.playerId === 'p1')
    ?.availability.status).toBe('UNAVAILABLE');
  expect(result.rosterEvent.causeEventId).toBe('execution-1');
  expect(result.execution).toMatchObject({ executionId: 'execution-1',
    actionId: 'rest-p1', eventIds: [result.rosterEvent.eventId],
    worldRevision: 1 });
  expect(result.projection.worldEvidence.origin)
    .toBe('MANAGER_DELEGATED');
  expect(result.projection.managerSelfChosenEvidence?.traceId)
    .toBe('trace-1');
  expect(result.mood).toBeNull();
  expect(source.roster.players[0]?.availability.status).toBe('AVAILABLE');
});

it('rejects a different action binding, stale authority, manager or action day', () => {
  const base = input();
  expect(() => dispatchSelectedManagerRosterDecision({ ...base,
    binding: { ...binding, actionId: 'keep-p1' } }))
    .toThrow('selected action');
  expect(() => dispatchSelectedManagerRosterDecision({ ...base,
    selection: { ...selected(), trace: { ...selected().trace,
      reason: 'LEGAL_ORDER' } } }))
    .toThrow('manager selection');
  expect(() => dispatchSelectedManagerRosterDecision({ ...base,
    control: createHumanControlState({ ...control(),
      manualDomainIds: ['ROSTER'] }) })).toThrow('authority');
  expect(() => dispatchSelectedManagerRosterDecision({ ...base,
    selection: { ...selected(), decision: {
      ...selected().decision, appointmentId: 'old' } } }))
    .toThrow();
  expect(() => dispatchSelectedManagerRosterDecision({ ...base,
    clubAsOfDay: 10 })).toThrow('Club');
  expect(() => dispatchSelectedManagerRosterDecision({ ...base,
    currentWorldRevision: 1 })).toThrow('world revision');
});

it('emits no executed decision when the roster change is invalid', () => {
  const base = input();
  expect(() => dispatchSelectedManagerRosterDecision({ ...base,
    binding: { ...binding, command: { ...binding.command,
      changes: [{ playerId: 'unknown', availability: {
        status: 'UNAVAILABLE' as const,
        evidenceId: 'usage-observed-1' } }] } } }))
    .toThrow('roster');
  expect(base.roster.revision).toBe(0);
});

it('feeds Mood only after the roster event is executed and personally appraised', () => {
  const base = input();
  const applied = applyRosterChange(base.roster, {
    ...binding.command, causeEventId: 'execution-1' });
  if (!applied.ok) throw new Error('invalid fixture roster event');
  const appraisal = change(appraisalInput(), (draft) => {
    const scope = { careerId: 'career-a', matchId: 'match',
      playerId: 'p1' };
    draft.importance.scope = scope;
    draft.importance.clubId = 'club-a';
    draft.importance.competition.careerId = 'career-a';
    draft.importance.competition.clubId = 'club-a';
    draft.importance.personal.scope = scope;
    draft.importance.personal.clubId = 'club-a';
    draft.importance.rivalry.careerId = 'career-a';
    draft.importance.rivalry.fromClubId = 'club-a';
    draft.player.scope = scope;
    draft.event.scope = scope;
    draft.event.eventId = applied.event.eventId;
    draft.evidenceEventIds = [applied.event.eventId];
    draft.bundleId = 'observed-rest-1';
    draft.event.expectedOutcome = 1;
    draft.event.perceivedOutcome = 0;
  });
  const mood = createTeamMoodState(base.roster, 'club-a', {
    policyId: 'mood', version: 'v1', season: 1,
    availableAtDay: 0,
    baseline: { confidence: 50, cohesion: 50, energy: 50,
      tension: 50, roleHarmony: 50 },
    directStrength: 1, diffusionStrength: 0,
    dailyReversion: { confidence: 0, cohesion: 0, energy: 0,
      tension: 0, roleHarmony: 0 },
  }, ['p1', 'p2'].map((playerId) => ({ playerId,
    axes: { confidence: 1, cohesion: 1, energy: 1,
      tension: 1, roleHarmony: 1 } })));
  const relationships = createPlayerRelationshipNetwork('career-a', {
    policyId: 'relation', version: 'v1', availableAtDay: 0,
    baseline: { affinity: 50, trust: 50, coordination: 50 },
    deltas: Object.fromEntries(['SHARED_SUCCESS', 'MUTUAL_SUPPORT',
      'JOINT_REPETITION', 'JOINT_EXECUTION', 'JOINT_FAILURE',
      'CONFLICT', 'TRUST_BREACH', 'ROLE_COMPETITION'].map((kind) =>
      [kind, { affinity: 0, trust: 0, coordination: 0 }])) as never,
  });
  const result = dispatchSelectedManagerRosterDecision({ ...base,
    moodContext: { mood, relationships,
      emotionState: value(createEmotionState({
        scope: appraisal.importance.scope, policy: appraisal.policy })),
      appraisalInput: appraisal,
      policy: { policyId: 'response', version: 'v1',
        season: 1, availableAtDay: 10,
        responses: { FEAR: { axis: 'tension',
          deltaAtFullPressure: 20 },
        IMPATIENCE: { axis: 'roleHarmony',
          deltaAtFullPressure: -20 },
        ANGER: { axis: 'tension', deltaAtFullPressure: 20 },
        MOTIVATION: { axis: 'confidence',
          deltaAtFullPressure: 20 },
        SUPERIORITY: { axis: 'confidence',
          deltaAtFullPressure: 10 } } },
    },
  });
  expect(result.mood?.mood?.event.sourceEventId)
    .toBe(result.rosterEvent.eventId);
  expect(result.mood?.projection.worldEvidence.eventIds)
    .toEqual([result.rosterEvent.eventId]);
});
