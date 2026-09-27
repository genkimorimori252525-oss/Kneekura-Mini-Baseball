import { expect, it } from 'vitest';
import type { DefenderWorldState,
  DefensivePosition } from '../../model/CanonicalWorldSnapshot';
import type { DefensiveDecisionInput,
  DefensiveIntentCandidate } from '../../sim/fielding/DefensiveDecision';
import { generateDefensiveIntentCandidates } from '../../sim/fielding/DefensiveDecision';
import type { TeamCoveragePlanInput } from '../../sim/fielding/TeamCoveragePlan';
import { createRosterState } from '../roster/RosterState';
import type { RosterStateInput } from '../roster/RosterTypes';
import { applyPlayerRelationshipEvidence,
  createPlayerRelationshipNetwork } from './PlayerRelationships';
import { planMiddleInfieldCoordinatedCoverage } from './DefenseCoordinationExecution';
import { applyMiddleInfieldCoordinatedCoverageToMatchWorld } from './DefenseCoordinationMatchBoundary';

const policy = { policyId: 'joint-decision-v1', version: 'v1',
  availableAtDay: 0, neutralCoordination: 50,
  minimumJointEventsPerDirection: 1,
  maximumEvidenceAgeDays: 10,
  positiveCueGain: 0.5, negativeCueLoss: 0.5 } as const;
const relationshipPolicy = () => ({ policyId: 'relationship-v1',
  version: 'v1', availableAtDay: 0,
  baseline: { affinity: 50, trust: 50, coordination: 50 },
  deltas: {
    SHARED_SUCCESS: { affinity: 0, trust: 0, coordination: 0 },
    MUTUAL_SUPPORT: { affinity: 20, trust: 0, coordination: 0 },
    JOINT_REPETITION: { affinity: 0, trust: 0, coordination: 40 },
    JOINT_EXECUTION: { affinity: 0, trust: 0, coordination: 0 },
    JOINT_FAILURE: { affinity: 0, trust: 0, coordination: -40 },
    CONFLICT: { affinity: 0, trust: 0, coordination: 0 },
    TRUST_BREACH: { affinity: 0, trust: 0, coordination: 0 },
    ROLE_COMPETITION: { affinity: 0, trust: 0, coordination: 0 },
  },
});
const network = (kind: 'JOINT_REPETITION'
  | 'JOINT_FAILURE' | 'MUTUAL_SUPPORT' | null) => {
  let state = createPlayerRelationshipNetwork('career',
    relationshipPolicy());
  if (kind === null) return state;
  for (const [index, [fromPlayerId, toPlayerId]] of [
    ['second', 'short'], ['short', 'second'],
  ].entries()) {
    state = applyPlayerRelationshipEvidence(state, index, {
      eventId: `relation-${index}`, sourceEventId: `joint-play-${index}`,
      atDay: 1, fromPlayerId, toPlayerId, kind,
      ...((kind === 'MUTUAL_SUPPORT') ? {}
        : { task: 'MIDDLE_INFIELD' as const }),
    }).state;
  }
  return state;
};
const positions = ['P', 'C', '1B', '2B', '3B', 'SS',
  'LF', 'CF', 'RF'] as const satisfies readonly DefensivePosition[];
const playerId = (position: DefensivePosition): string =>
  position === '2B' ? 'second'
    : position === 'SS' ? 'short' : position.toLowerCase();
const roster = createRosterState({ careerId: 'career',
  profiles: [{ profileId: 'season', version: 'v1', season: 2026,
    competitionEditionId: 'league', activeLimit: null,
    allowedAssignmentKinds: ['FIRST_TEAM'],
    rehabParticipationAllowed: false }],
  units: [{ unitId: 'first', clubId: 'club',
    kind: 'FIRST_TEAM' }],
  players: positions.map((position) => ({
    playerId: playerId(position),
    clubRights: { rightsHolderClubId: 'club',
      contractId: `contract-${position}` },
    assignment: { unitId: 'first', clubId: 'club' },
    registrations: [], availability: { status: 'AVAILABLE' as const,
      evidenceId: `health-${position}` },
  })), effectiveDay: 1,
} as RosterStateInput);
const decision = (visible = true): DefensiveDecisionInput => ({
  perceivedWorld: { observerId: 'second',
    observationTime: 1_200_000,
    attention: { target: { kind: 'player', playerId: 'short' },
      focusedSinceTick: 1_050_000 },
    ball: null,
    players: visible ? [{ playerId: 'short', memory: {
      estimate: { position: { x: 2, z: 3 },
        velocity: { x: 0, z: 0 } },
      sourceObservedAt: 1_100_000, predictedAt: 1_200_000,
      confidence: 0.9 } }] : [],
    communications: [], knownContext: { outs: 1,
      occupiedBases: [1] } },
  self: { playerId: 'second', registeredPosition: '2B',
    position: { x: 0, z: 0 } },
  prePlayPlan: { ballPursuitPriority: 0,
    baseCoverPriorities: [{ base: 2, priority: 0.9 }],
    relayPriority: 0, backupPriority: 0,
    deepCoveragePriority: 0, holdPriority: 0.5 },
  perceivedCues: [
    { kind: 'teammate_ball_commitment', playerId: 'short',
      observedAt: 1_120_000, confidence: 0.6 },
    { kind: 'base_needs_cover', base: 2,
      observedAt: 1_130_000, confidence: 0.8 },
  ], minimumCueConfidence: 0.5, communicationTrust: 1,
});
const hold: DefensiveIntentCandidate = { intent: { kind: 'hold' },
  localPriority: 0.1, evidenceAvailableAt: 1_200_000,
  evidenceKinds: ['pre_play_plan'] };
const coverage = (input: DefensiveDecisionInput): TeamCoveragePlanInput => ({
  defenders: positions.map((position) => ({
    playerId: playerId(position), registeredPosition: position,
    candidates: position === '2B'
      ? generateDefensiveIntentCandidates(input) : [hold],
  })), requireBallHandler: false,
});
const plan = (kind: 'JOINT_REPETITION'
  | 'JOINT_FAILURE' | 'MUTUAL_SUPPORT' | null,
  input = decision()) => planMiddleInfieldCoordinatedCoverage({
    network: network(kind), roster, clubId: 'club', atDay: 1,
    policy, receiver: input, teammatePlayerId: 'short',
    coverage: coverage(input),
  });

it('uses observed shared reps to interpret a teammate cue before joint coverage planning', () => {
  const ordinary = plan(null);
  const rehearsed = plan('JOINT_REPETITION');
  const ordinaryCover = ordinary.plan.assignments.find((entry) =>
    entry.playerId === 'second');
  const rehearsedCover = rehearsed.plan.assignments.find((entry) =>
    entry.playerId === 'second');
  expect(ordinary.cue).toBeNull();
  expect(rehearsed.cue).toMatchObject({ task: 'MIDDLE_INFIELD',
    pairScore: 90, observedConfidence: 0.6,
    adjustedConfidence: 0.76,
    sourceEventIds: ['joint-play-0', 'joint-play-1'] });
  expect(ordinaryCover?.intent).toEqual({ kind: 'base_cover', base: 2 });
  expect(rehearsedCover?.intent).toEqual(ordinaryCover?.intent);
  expect(rehearsedCover?.selectedPriority)
    .toBeGreaterThan(ordinaryCover!.selectedPriority);
  expect(rehearsedCover?.evidenceAvailableAt)
    .toBe(ordinaryCover?.evidenceAvailableAt);
});

it('lets actual joint failure create role uncertainty without changing raw fielding skill', () => {
  const failed = plan('JOINT_FAILURE');
  expect(failed.cue).toMatchObject({ pairScore: 10,
    observedConfidence: 0.6, adjustedConfidence: 0.36 });
  expect(failed.plan.assignments.find((entry) =>
    entry.playerId === 'second')?.intent).toEqual({ kind: 'hold' });
  expect(failed).not.toHaveProperty('fieldingBonus');
});

it('does not invent a cue from friendship or an unobserved teammate', () => {
  expect(plan('MUTUAL_SUPPORT').cue).toBeNull();
  const hidden = plan('JOINT_REPETITION', decision(false));
  expect(hidden.cue).toBeNull();
  expect(hidden.plan.assignments.find((entry) =>
    entry.playerId === 'second')?.intent).toEqual({ kind: 'hold' });
});

it('requires recent two-way task evidence even if old coordination remains stored', () => {
  const input = decision();
  const dormant = planMiddleInfieldCoordinatedCoverage({
    network: network('JOINT_REPETITION'), roster,
    clubId: 'club', atDay: 20, policy,
    receiver: input, teammatePlayerId: 'short',
    coverage: coverage(input),
  });
  expect(dormant.cue).toBeNull();
});

it('rejects a mismatched fielding position and unpinned calibration', () => {
  const input = decision();
  const common = { network: network('JOINT_REPETITION'), roster,
    clubId: 'club', atDay: 1, policy,
    receiver: input, teammatePlayerId: 'short',
    coverage: coverage(input) };
  expect(() => planMiddleInfieldCoordinatedCoverage({ ...common,
    teammatePlayerId: 'cf' })).toThrow('middle infield');
  expect(() => planMiddleInfieldCoordinatedCoverage({ ...common,
    policy: { ...policy, neutralCoordination: 0 } }))
    .toThrow('coordination policy');
});

const worldDefenders = (): readonly DefenderWorldState[] =>
  positions.map((position) => ({ playerId: playerId(position),
    registeredPosition: position, position: { x: 0, z: 0 },
    velocity: { x: 0, z: 0 }, assignment: { kind: 'hold' } }));
const matchInput = () => {
  const receiver = decision();
  return { network: network('JOINT_REPETITION'), roster,
    clubId: 'club', atDay: 1, policy, receiver,
    teammatePlayerId: 'short', coverage: coverage(receiver),
    worldDefenders: worldDefenders(),
    verifiedJointSourceEventIds: ['joint-play-0', 'joint-play-1'] };
};

it('binds the observed pair and verified joint events to the canonical match defenders', () => {
  const result = applyMiddleInfieldCoordinatedCoverageToMatchWorld(matchInput());
  expect(result.cue?.sourceEventIds).toEqual(['joint-play-0', 'joint-play-1']);
  expect(result.defenders.find((entry) => entry.playerId === 'second')?.assignment)
    .toEqual({ kind: 'base_cover', base: 2 });
  expect(result.defenders.map((entry) => entry.playerId))
    .toEqual(worldDefenders().map((entry) => entry.playerId));
});

it('rejects missing match provenance or a coverage pair absent from the match lineup', () => {
  const source = matchInput();
  expect(() => applyMiddleInfieldCoordinatedCoverageToMatchWorld({ ...source,
    verifiedJointSourceEventIds: ['joint-play-0'] }))
    .toThrow('verified joint event');
  expect(() => applyMiddleInfieldCoordinatedCoverageToMatchWorld({ ...source,
    worldDefenders: source.worldDefenders.map((entry) =>
      entry.playerId === 'short' ? { ...entry, playerId: 'other' } : entry) }))
    .toThrow('match defensive lineup');
});
