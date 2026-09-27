import { expect, it } from 'vitest';
import { selectControlledDecision } from '../control/ControlledDecision';
import { createHumanControlState } from '../control/HumanControl';
import type { ControlledDecision } from '../control/ControlTypes';
import { state as club } from '../club/ClubFixtures.test-support';
import { applyRosterChange } from '../roster/RosterCommands';
import { createRosterState } from '../roster/RosterState';
import type { RosterStateInput } from '../roster/RosterTypes';
import { createEmotionState } from '../psychology/EmotionState';
import { appraisalInput, change, value } from '../psychology/appraisal/AppraisalFixtures.test-support';
import { createPlayerRelationshipNetwork } from './PlayerRelationships';
import { createTeamMoodState } from './TeamMood';
import { applyExecutedRosterDecisionMood } from './ExecutedRosterDecisionMood';

const roster = createRosterState({ careerId: 'career-a', effectiveDay: 10,
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
const relationships = createPlayerRelationshipNetwork('career-a', {
  policyId: 'relation', version: 'v1', availableAtDay: 0,
  baseline: { affinity: 50, trust: 50, coordination: 50 },
  deltas: Object.fromEntries(['SHARED_SUCCESS', 'MUTUAL_SUPPORT',
    'JOINT_REPETITION', 'JOINT_EXECUTION', 'JOINT_FAILURE',
    'CONFLICT', 'TRUST_BREACH', 'ROLE_COMPETITION'].map((kind) =>
    [kind, { affinity: 0, trust: 0, coordination: 0 }])) as never,
});
const mood = () => createTeamMoodState(roster, 'club-a', {
  policyId: 'mood', version: 'v1', season: 1, availableAtDay: 0,
  baseline: { confidence: 50, cohesion: 50, energy: 50,
    tension: 50, roleHarmony: 50 },
  directStrength: 1, diffusionStrength: 0,
  dailyReversion: { confidence: 0, cohesion: 0, energy: 0,
    tension: 0, roleHarmony: 0 },
}, ['p1', 'p2'].map((playerId) => ({ playerId,
  axes: { confidence: 1, cohesion: 1, energy: 1,
    tension: 1, roleHarmony: 1 } })));
const rosterCommand = { commandId: 'bench-p1',
  causeEventId: 'execution-1', expectedRevision: 0,
  effectiveDay: 11, changes: [{ playerId: 'p1',
    availability: { status: 'UNAVAILABLE' as const,
      evidenceId: 'usage-observed-1' } }] };
const rosterEvent = () => {
  const applied = applyRosterChange(roster, rosterCommand);
  if (!applied.ok) throw new Error('invalid fixture roster event');
  return applied.event;
};
const decision = (human: boolean): ControlledDecision => {
  const control = createHumanControlState({ revision: 0,
    controllerId: 'human', controlledClubId: 'club-a',
    domainIds: ['ROSTER'], manualDomainIds: human ? ['ROSTER'] : [] });
  const selected = selectControlledDecision(control, {
    decisionId: 'decision-1', contextId: 'context-1',
    worldRevision: 0, clubId: 'club-a', domainId: 'ROSTER',
    managerId: 'manager-a', appointmentId: 'appointment-a',
    legalActionIds: ['bench-p1'],
  }, { decisionId: 'decision-1', contextId: 'context-1',
    expectedControlRevision: 0, expectedWorldRevision: 0,
    actionId: 'bench-p1', actor: human
      ? { kind: 'HUMAN', controllerId: 'human' }
      : { kind: 'MANAGER', managerId: 'manager-a',
        appointmentId: 'appointment-a', traceId: 'choice-1' } });
  if (!selected.ok) throw new Error('invalid fixture decision');
  return selected.value;
};
const execution = () => ({ executionId: 'execution-1',
  decisionId: 'decision-1', contextId: 'context-1',
  actionId: 'bench-p1', worldRevision: 1,
  eventIds: [rosterEvent().eventId] });
const input = () => change(appraisalInput(), (draft) => {
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
  draft.event.eventId = rosterEvent().eventId;
  draft.evidenceEventIds = [rosterEvent().eventId];
  draft.bundleId = 'roster-observation-1';
  draft.event.expectedOutcome = 1;
  draft.event.perceivedOutcome = 0;
});
const emotion = () => value(createEmotionState({
  scope: input().importance.scope, policy: input().policy }));
const policy = { policyId: 'mood-response', version: 'v1',
  season: 1, availableAtDay: 10,
  responses: { FEAR: { axis: 'tension', deltaAtFullPressure: 20 },
    IMPATIENCE: { axis: 'roleHarmony', deltaAtFullPressure: -20 },
    ANGER: { axis: 'tension', deltaAtFullPressure: 20 },
    MOTIVATION: { axis: 'confidence', deltaAtFullPressure: 20 },
    SUPERIORITY: { axis: 'confidence', deltaAtFullPressure: 10 } } } as const;
const run = (human = true) => applyExecutedRosterDecisionMood({
  clubAtAction: club(), clubAsOfDay: 11, roster, rosterCommand,
  rosterEvent: rosterEvent(), decision: decision(human),
  execution: execution(), mood: mood(), relationships,
  emotionState: emotion(), appraisalInput: input(), policy,
});

it('applies a selected and executed human roster action only through the player appraisal gate', () => {
  const result = run(true);
  expect(result.projection.worldEvidence.origin).toBe('HUMAN_OVERRIDE');
  expect(result.projection.managerSelfChosenEvidence).toBeNull();
  expect(result.appraisal.event.request.evidenceEventIds)
    .toEqual([rosterEvent().eventId]);
  expect(result.mood).not.toBeNull();
  expect(result.mood?.event).toMatchObject({
    type: 'TEAM_MOOD_SIGNAL_APPLIED',
    sourceEventId: rosterEvent().eventId,
    directPlayerId: 'p1',
    appraisalId: result.appraisal.computation.appraisal.appraisalId,
  });
  expect(result.mood?.state).not.toHaveProperty('battingBonus');
});

it('preserves the selected manager origin without changing the action or adding a direct mood buff', () => {
  const result = run(false);
  expect(result.projection.worldEvidence.origin).toBe('MANAGER_DELEGATED');
  expect(result.projection.managerSelfChosenEvidence?.traceId)
    .toBe('choice-1');
  expect(result.mood?.event.sourceEventId).toBe(rosterEvent().eventId);
});

it('rejects selection without matching execution, roster evidence or current appointment', () => {
  const base = { clubAtAction: club(), clubAsOfDay: 11,
    roster, rosterCommand,
    rosterEvent: rosterEvent(), decision: decision(true),
    execution: execution(), mood: mood(), relationships,
    emotionState: emotion(), appraisalInput: input(), policy };
  expect(() => applyExecutedRosterDecisionMood({ ...base,
    execution: { ...execution(), eventIds: [] } })).toThrow('execution');
  expect(() => applyExecutedRosterDecisionMood({ ...base,
    rosterEvent: { ...rosterEvent(), eventId: 'forged' } }))
    .toThrow('roster');
  expect(() => applyExecutedRosterDecisionMood({ ...base,
    decision: { ...decision(true), appointmentId: 'old' } }))
    .toThrow();
  expect(() => applyExecutedRosterDecisionMood({ ...base,
    policy: { ...policy, availableAtDay: 12 } }))
    .toThrow('policy');
  expect(() => applyExecutedRosterDecisionMood({ ...base,
    clubAsOfDay: 10 })).toThrow('Club or manager');
});

it('does not emit mood when the receiver appraisal gate stays inactive', () => {
  const neutral = change(input(), (draft) => {
    draft.event.expectedOutcome = 0.5;
    draft.event.perceivedOutcome = 0.5;
    for (const row of draft.model.rows) {
      row.bias = 0;
      for (const key in row.situationWeights) row.situationWeights[key] = 0;
      for (const key in row.responseWeights) row.responseWeights[key] = 0;
    }
  });
  const result = applyExecutedRosterDecisionMood({ clubAtAction: club(),
    clubAsOfDay: 11,
    roster, rosterCommand, rosterEvent: rosterEvent(),
    decision: decision(true), execution: execution(), mood: mood(),
    relationships, emotionState: emotion(), appraisalInput: neutral,
    policy });
  expect(result.appraisal.influence.activeEmotion).toBeNull();
  expect(result.mood).toBeNull();
});
