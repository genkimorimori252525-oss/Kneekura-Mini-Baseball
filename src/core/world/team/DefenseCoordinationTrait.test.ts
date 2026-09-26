import { expect, it } from 'vitest';
import { createRosterState } from '../roster/RosterState';
import type { RosterStateInput } from '../roster/RosterTypes';
import { applyPlayerRelationshipEvidence,
  createPlayerRelationshipNetwork } from './PlayerRelationships';
import type { PlayerRelationshipNetwork } from './PlayerRelationships';
import { deriveDefenseCoordinationTrait } from './DefenseCoordinationTrait';
import { compareDefenseCoordinationTrait } from './DefenseCoordinationTraitLifecycle';

const relationshipPolicy = { policyId: 'joint-task', version: 'v1',
  availableAtDay: 0,
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
const traitPolicy = { policyId: 'defense-pair-v1', version: 'v1',
  season: 2026, availableAtDay: 0,
  minimumJointEventsPerDirection: 1,
  maximumEvidenceAgeDays: 2,
  blueThreshold: 65, goldThreshold: 85, redThreshold: 35 };
const roster = (effectiveDay: number, clubId = 'club-a') =>
  createRosterState({ careerId: 'career-a', effectiveDay,
    profiles: [{ profileId: 'league', version: 'v1', season: 2026,
      competitionEditionId: 'league-2026', activeLimit: null,
      allowedAssignmentKinds: ['FIRST_TEAM'],
      rehabParticipationAllowed: false }],
    units: [{ unitId: 'first', clubId, kind: 'FIRST_TEAM' }],
    players: ['p1', 'p2'].map((playerId) => ({ playerId,
      clubRights: { rightsHolderClubId: clubId,
        contractId: `contract-${playerId}` },
      assignment: { unitId: 'first', clubId },
      registrations: [], availability: { status: 'AVAILABLE' as const,
        evidenceId: `health-${playerId}` },
    })),
  } as RosterStateInput);
const pairEvent = (network: PlayerRelationshipNetwork,
  kind: 'JOINT_REPETITION' | 'JOINT_FAILURE',
  atDay: number, direction: 'forward' | 'reverse') => {
  const id = `${kind}-${atDay}-${direction}`;
  return applyPlayerRelationshipEvidence(network, network.revision, {
    eventId: id, sourceEventId: `source-${id}`, atDay,
    fromPlayerId: direction === 'forward' ? 'p1' : 'p2',
    toPlayerId: direction === 'forward' ? 'p2' : 'p1',
    kind, task: 'MIDDLE_INFIELD',
  }).state;
};
const both = (network: PlayerRelationshipNetwork,
  kind: 'JOINT_REPETITION' | 'JOINT_FAILURE', atDay: number) =>
  pairEvent(pairEvent(network, kind, atDay, 'forward'),
    kind, atDay, 'reverse');
const project = (network: PlayerRelationshipNetwork, atDay: number) =>
  deriveDefenseCoordinationTrait(network, roster(atDay),
    'club-a', 'p1', 'p2', 'MIDDLE_INFIELD', atDay, traitPolicy);

it('projects blue and gold from repeated two-way task-specific evidence', () => {
  const initial = createPlayerRelationshipNetwork('career-a',
    relationshipPolicy);
  const first = both(initial, 'JOINT_REPETITION', 1);
  expect(project(first, 1)).toMatchObject({
    family: 'DEFENSE_COORDINATION', mode: 'CAUSAL_STATE_DESCRIPTOR',
    tier: 'BLUE', task: 'MIDDLE_INFIELD', score: 70,
    memberPlayerIds: ['p1', 'p2'],
  });
  const second = both(first, 'JOINT_REPETITION', 2);
  const gold = project(second, 2);
  expect(gold).toMatchObject({ tier: 'GOLD', score: 90 });
  expect(gold?.sourceEventIds).toHaveLength(4);
  expect(gold).not.toHaveProperty('fieldingModifier');
  expect(deriveDefenseCoordinationTrait(second, roster(2),
    'club-a', 'p1', 'p2', 'RELAY', 2, traitPolicy)).toBeNull();
});

it('projects red only after joint failures and expires without recent evidence', () => {
  let network = createPlayerRelationshipNetwork('career-a',
    relationshipPolicy);
  network = both(network, 'JOINT_REPETITION', 1);
  network = both(network, 'JOINT_REPETITION', 2);
  network = both(network, 'JOINT_FAILURE', 3);
  network = both(network, 'JOINT_FAILURE', 4);
  expect(project(network, 4)).toMatchObject({ tier: 'RED', score: 30 });
  expect(project(network, 10)).toBeNull();
});

it('requires both active club members and both directions of evidence', () => {
  const initial = createPlayerRelationshipNetwork('career-a',
    relationshipPolicy);
  const oneWay = pairEvent(initial, 'JOINT_REPETITION', 1,
    'forward');
  expect(project(oneWay, 1)).toBeNull();
  const twoWay = pairEvent(oneWay, 'JOINT_REPETITION', 1,
    'reverse');
  expect(deriveDefenseCoordinationTrait(twoWay, roster(1,
    'other-club'), 'club-a', 'p1', 'p2', 'MIDDLE_INFIELD',
  1, traitPolicy)).toBeNull();
  expect(() => deriveDefenseCoordinationTrait(twoWay, roster(1),
    'club-a', 'p1', 'p2', 'MIDDLE_INFIELD', 1,
    { ...traitPolicy, blueThreshold: 50 })).toThrow('threshold');
});

it('records pair-trait acquisition, tier change and evidence expiry without a skill effect', () => {
  const initial = createPlayerRelationshipNetwork('career-a',
    relationshipPolicy);
  const blue = both(initial, 'JOINT_REPETITION', 1);
  const acquired = compareDefenseCoordinationTrait(initial,
    roster(0), 0, blue, roster(1), 1,
    'club-a', 'p1', 'p2', 'MIDDLE_INFIELD', traitPolicy);
  expect(acquired).toMatchObject({ transition: 'ACQUIRED',
    before: null, after: { tier: 'BLUE' } });
  const gold = both(blue, 'JOINT_REPETITION', 2);
  const changed = compareDefenseCoordinationTrait(blue,
    roster(1), 1, gold, roster(2), 2,
    'club-a', 'p1', 'p2', 'MIDDLE_INFIELD', traitPolicy);
  expect(changed).toMatchObject({ transition: 'TIER_CHANGED',
    before: { tier: 'BLUE' }, after: { tier: 'GOLD' } });
  const expired = compareDefenseCoordinationTrait(gold,
    roster(2), 2, gold, roster(10), 10,
    'club-a', 'p1', 'p2', 'MIDDLE_INFIELD', traitPolicy);
  expect(expired).toMatchObject({ transition: 'EXPIRED',
    before: { tier: 'GOLD' }, after: null });
  expect(expired).not.toHaveProperty('fieldingModifier');
  expect(() => compareDefenseCoordinationTrait(gold,
    roster(2), 2, blue, roster(1), 1,
    'club-a', 'p1', 'p2', 'MIDDLE_INFIELD', traitPolicy))
    .toThrow('history');
  expect(() => compareDefenseCoordinationTrait(blue,
    roster(1), 1, { ...gold, links: [
      { ...gold.links[0]!, coordinationByTask: {
        MIDDLE_INFIELD: 0 } }, ...gold.links.slice(1),
    ] }, roster(2), 2,
    'club-a', 'p1', 'p2', 'MIDDLE_INFIELD', traitPolicy))
    .toThrow('history');
});
