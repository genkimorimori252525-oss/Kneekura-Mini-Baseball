import { expect, it } from 'vitest';
import { createRosterState } from '../../core/world/roster/RosterState';
import type { RosterStateInput } from
  '../../core/world/roster/RosterTypes';
import { applyPlayerRelationshipEvidence,
  createPlayerRelationshipNetwork } from
  '../../core/world/team/PlayerRelationships';
import { projectDefenseCoordinationFromWorld } from
  './DefenseCoordinationFromWorld';

const relationshipPolicy = { policyId: 'joint-task',
  version: 'v1', availableAtDay: 0,
  baseline: { affinity: 50, trust: 50, coordination: 50 },
  deltas: {
    SHARED_SUCCESS: { affinity: 0, trust: 0, coordination: 0 },
    MUTUAL_SUPPORT: { affinity: 0, trust: 0, coordination: 0 },
    JOINT_REPETITION: { affinity: 0, trust: 0, coordination: 20 },
    JOINT_EXECUTION: { affinity: 0, trust: 0, coordination: 0 },
    JOINT_FAILURE: { affinity: 0, trust: 0, coordination: -30 },
    CONFLICT: { affinity: 0, trust: 0, coordination: 0 },
    TRUST_BREACH: { affinity: 0, trust: 0, coordination: 0 },
    ROLE_COMPETITION: { affinity: 0, trust: 0, coordination: 0 },
  },
};
const traitPolicy = { policyId: 'defense-pair-v1',
  version: 'v1', season: 2026, availableAtDay: 0,
  minimumJointEventsPerDirection: 1,
  maximumEvidenceAgeDays: 2,
  blueThreshold: 65, goldThreshold: 85,
  redThreshold: 35 };
const roster = createRosterState({ careerId: 'career-a',
  effectiveDay: 1,
  profiles: [{ profileId: 'league', version: 'v1',
    season: 2026, competitionEditionId: 'league-2026',
    activeLimit: null, allowedAssignmentKinds: ['FIRST_TEAM'],
    rehabParticipationAllowed: false }],
  units: [{ unitId: 'first', clubId: 'club-a',
    kind: 'FIRST_TEAM' }],
  players: ['p1', 'p2'].map(playerId => ({ playerId,
    clubRights: { rightsHolderClubId: 'club-a',
      contractId: `contract-${playerId}` },
    assignment: { unitId: 'first', clubId: 'club-a' },
    registrations: [], availability: {
      status: 'AVAILABLE' as const,
      evidenceId: `health-${playerId}` },
  })),
} as RosterStateInput);
const initial = createPlayerRelationshipNetwork('career-a',
  relationshipPolicy);
const forward = applyPlayerRelationshipEvidence(initial, 0, {
  eventId: 'forward', sourceEventId: 'official-forward',
  atDay: 1, fromPlayerId: 'p1', toPlayerId: 'p2',
  kind: 'JOINT_REPETITION', task: 'MIDDLE_INFIELD',
}).state;
const network = applyPlayerRelationshipEvidence(forward, 1, {
  eventId: 'reverse', sourceEventId: 'official-reverse',
  atDay: 1, fromPlayerId: 'p2', toPlayerId: 'p1',
  kind: 'JOINT_REPETITION', task: 'MIDDLE_INFIELD',
}).state;
const sources = {
  roster: { readHead: (careerId: string, clubId: string) =>
    careerId === 'career-a' && clubId === 'club-a'
      ? { careerId, clubId, roster, mood: null } : null },
  relationships: { readAtDay: (careerId: string,
    atDay: number) => careerId === 'career-a' && atDay === 1
      ? network : null },
  policy: { readAcceptedPolicy: (sourceId: string) =>
    sourceId === 'trait-policy-1' ? { sourceId,
      careerId: 'career-a', clubId: 'club-a',
      policy: traitPolicy } : null },
};
const input = { careerId: 'career-a', clubId: 'club-a',
  firstPlayerId: 'p1', secondPlayerId: 'p2',
  task: 'MIDDLE_INFIELD' as const,
  policySourceId: 'trait-policy-1' };

it('projects task-specific Blue coordination from the current roster and pair history', () => {
  const descriptor = projectDefenseCoordinationFromWorld(
    sources, input);
  expect(descriptor).toMatchObject({ tier: 'BLUE',
    mode: 'CAUSAL_STATE_DESCRIPTOR', score: 70,
    sourceEventIds: ['official-forward', 'official-reverse'] });
  expect(descriptor).not.toHaveProperty('fieldingModifier');
  expect(projectDefenseCoordinationFromWorld(sources,
    { ...input, task: 'RELAY' })).toBeNull();
  expect(() => projectDefenseCoordinationFromWorld(sources,
    { ...input, policySourceId: 'missing' }))
    .toThrow('accepted World sources');
});
