import { expect, it } from 'vitest';
import { createRosterState } from '../roster/RosterState';
import type { RosterStateInput } from '../roster/RosterTypes';
import { createPlayerRelationshipNetwork } from './PlayerRelationships';
import { applyTeamMoodSignal, createTeamMoodState } from './TeamMood';
import type { TeamMoodAxis, TeamMoodState } from './TeamMood';
import { assessTeamMoodGate } from './TeamMoodGate';

const baseline = { confidence: 50, cohesion: 50, energy: 50,
  tension: 50, roleHarmony: 50 };
const policy = { policyId: 'mood', version: 'v1',
  season: 2026, availableAtDay: 0,
  baseline, directStrength: 1, diffusionStrength: 0,
  dailyReversion: { confidence: 0, cohesion: 0, energy: 0,
    tension: 0, roleHarmony: 0 } };
const gatePolicy = { policyId: 'rare-mood-gate', version: 'v1',
  season: 2026, availableAtDay: 0,
  minimumAlignedFraction: 0.75,
  positiveCohesion: 65, positiveConfidence: 65,
  positiveEnergy: 65, severeTension: 65,
  roleHarmonyCollapse: 35 };
const roster = createRosterState({ careerId: 'career-a',
  profiles: [{ profileId: 'test', version: 'v1', season: 2026,
    competitionEditionId: 'league-2026', activeLimit: null,
    allowedAssignmentKinds: ['FIRST_TEAM'],
    rehabParticipationAllowed: false }],
  units: [{ unitId: 'a-first', clubId: 'a',
    kind: 'FIRST_TEAM' }],
  players: ['p1', 'p2'].map((playerId) => ({ playerId,
    clubRights: { rightsHolderClubId: 'a',
      contractId: `contract-${playerId}` },
    assignment: { unitId: 'a-first', clubId: 'a' },
    registrations: [], availability: { status: 'AVAILABLE' as const,
      evidenceId: `health-${playerId}` },
  })),
} as RosterStateInput);
const relationships = createPlayerRelationshipNetwork('career-a', {
  policyId: 'relationships', version: 'v1', availableAtDay: 0,
  baseline: { affinity: 50, trust: 50, coordination: 50 },
  deltas: {
    SHARED_SUCCESS: { affinity: 0, trust: 0, coordination: 0 },
    MUTUAL_SUPPORT: { affinity: 0, trust: 0, coordination: 0 },
    JOINT_REPETITION: { affinity: 0, trust: 0, coordination: 0 },
    JOINT_EXECUTION: { affinity: 0, trust: 0, coordination: 0 },
    CONFLICT: { affinity: 0, trust: 0, coordination: 0 },
    TRUST_BREACH: { affinity: 0, trust: 0, coordination: 0 },
    ROLE_COMPETITION: { affinity: 0, trust: 0, coordination: 0 },
  },
});
const initial = () => createTeamMoodState(roster, 'a', policy,
  ['p1', 'p2'].map((playerId) => ({ playerId,
    axes: { confidence: 1, cohesion: 1, energy: 1,
      tension: 1, roleHarmony: 1 } })));
const signal = (state: TeamMoodState, playerId: string,
  axis: TeamMoodAxis, delta: number) => {
  const suffix = `${playerId}-${axis}`;
  return applyTeamMoodSignal(state, roster, relationships, {
    eventId: `mood-${suffix}`, sourceEventId: `source-${suffix}`,
    appraisalId: `appraisal-${suffix}`, careerId: 'career-a',
    clubId: 'a', season: 2026, directPlayerId: playerId,
    atDay: 1, axis, delta,
  }).state;
};

it('keeps ordinary changes and a single isolated high player outside the collective gate', () => {
  const ordinary = initial();
  expect(assessTeamMoodGate(ordinary, gatePolicy))
    .toMatchObject({ mode: 'NORMAL', appraisalEligible: false,
      reasons: [] });
  const isolated = signal(signal(ordinary, 'p1', 'confidence', 50),
    'p1', 'energy', 50);
  expect(isolated.mood.confidence).toBe(75);
  expect(isolated.mood.energy).toBe(75);
  expect(assessTeamMoodGate(isolated, gatePolicy))
    .toMatchObject({ mode: 'NORMAL', appraisalEligible: false });
});

it('marks only broad exceptional conditions as appraisal candidates', () => {
  let mood = initial();
  for (const playerId of ['p1', 'p2']) {
    mood = signal(mood, playerId, 'confidence', 20);
    mood = signal(mood, playerId, 'energy', 20);
  }
  expect(assessTeamMoodGate(mood, gatePolicy)).toMatchObject({
    mode: 'POSITIVE_EXTREME', appraisalEligible: true,
    reasons: ['CONFIDENCE_AND_ENERGY'],
  });
  expect(assessTeamMoodGate(mood, gatePolicy))
    .not.toHaveProperty('battingModifier');
});

it('keeps severe tension distinct and rejects unpinned or wrong-season thresholds', () => {
  const tense = signal(signal(initial(), 'p1', 'tension', 30),
    'p2', 'tension', 30);
  expect(assessTeamMoodGate(tense, gatePolicy)).toMatchObject({
    mode: 'DYSFUNCTION_EXTREME', appraisalEligible: true,
    reasons: ['SEVERE_TENSION'],
  });
  expect(() => assessTeamMoodGate(tense,
    { ...gatePolicy, season: 2027 })).toThrow('scope');
  expect(() => assessTeamMoodGate(tense,
    { ...gatePolicy, positiveEnergy: 50 })).toThrow('threshold');
});
