import { expect, it } from 'vitest';
import { createRosterState } from '../roster/RosterState';
import { rosterFixture } from '../roster/RosterTestFixtures';
import { applyPlayerRelationshipEvidence,
  createPlayerRelationshipNetwork } from './PlayerRelationships';
import { applyTeamMoodSignal, createTeamMoodState } from './TeamMood';

const axes = { confidence: 50, cohesion: 50, energy: 50,
  tension: 50, roleHarmony: 50 };
const policy = { policyId: 'synthetic-team-mood', version: 'v1',
  season: 2026, availableAtDay: 0,
  baseline: axes, directStrength: 1, diffusionStrength: 0.5,
  dailyReversion: { confidence: 0.1, cohesion: 0.01,
    energy: 0.1, tension: 0.1, roleHarmony: 0.02 } };
const roster = () => {
  const fixture = rosterFixture();
  return createRosterState({ ...fixture, players: [
    ...fixture.players, { playerId: 'p3',
      clubRights: { rightsHolderClubId: 'a', contractId: 'contract-3' },
      assignment: { unitId: 'a-farm-2', clubId: 'a' },
      registrations: [], availability: {
        status: 'AVAILABLE', evidenceId: 'health-3' },
    },
  ] });
};
const susceptibility = ['p1', 'p2', 'p3'].map((playerId) => ({
  playerId, axes: { confidence: 1, cohesion: 1, energy: 1,
    tension: 1, roleHarmony: 1 },
}));
const networkPolicy = { policyId: 'relationships', version: 'v1',
  availableAtDay: 0, baseline: { affinity: 50,
    trust: 50, coordination: 50 },
  deltas: {
    SHARED_SUCCESS: { affinity: 0, trust: 0, coordination: 0 },
    MUTUAL_SUPPORT: { affinity: 20, trust: 20, coordination: 0 },
    JOINT_REPETITION: { affinity: 0, trust: 0, coordination: 0 },
    JOINT_EXECUTION: { affinity: 0, trust: 0, coordination: 0 },
    CONFLICT: { affinity: 0, trust: 0, coordination: 0 },
    TRUST_BREACH: { affinity: 0, trust: 0, coordination: 0 },
    ROLE_COMPETITION: { affinity: 0, trust: 0, coordination: 0 },
  } };
const network = () => {
  const empty = createPlayerRelationshipNetwork('career-1', networkPolicy);
  return applyPlayerRelationshipEvidence(empty, 0, {
    eventId: 'support-1', sourceEventId: 'clubhouse-1',
    atDay: 5, fromPlayerId: 'p2', toPlayerId: 'p1',
    kind: 'MUTUAL_SUPPORT',
  }).state;
};
const signal = (eventId: string, atDay: number, delta: number) => ({
  eventId, sourceEventId: `source-${eventId}`,
  appraisalId: `appraisal-${eventId}`,
  careerId: 'career-1', clubId: 'a', season: 2026,
  directPlayerId: 'p1', atDay, axis: 'energy' as const, delta,
});

it('diffuses an appraised signal only through a receiving relationship', () => {
  const currentRoster = roster();
  const initial = createTeamMoodState(currentRoster, 'a',
    policy, susceptibility);
  const applied = applyTeamMoodSignal(initial, currentRoster,
    network(), signal('positive-1', 10, 20));
  expect(applied.state.players.find((item) =>
    item.playerId === 'p1')?.mood.energy).toBe(70);
  expect(applied.state.players.find((item) =>
    item.playerId === 'p2')?.mood.energy).toBe(57);
  expect(applied.state.players.find((item) =>
    item.playerId === 'p3')?.mood.energy).toBe(50);
  expect(applied.state.mood.energy).toBe(59);
  expect(applied.event).toMatchObject({ sourceEventId: 'source-positive-1',
    affectedPlayerIds: ['p1', 'p2'] });
  expect(applied.state).not.toHaveProperty('battingModifier');
});

it('keeps an isolated player local and lets old energy recede without a battery', () => {
  const currentRoster = roster();
  const initial = createTeamMoodState(currentRoster, 'a',
    policy, susceptibility);
  const disconnected = createPlayerRelationshipNetwork('career-1',
    networkPolicy);
  const isolated = applyTeamMoodSignal(initial, currentRoster,
    disconnected, signal('positive-1', 10, 20));
  expect(isolated.state.players.find((item) =>
    item.playerId === 'p2')?.mood.energy).toBe(50);
  expect(isolated.state.mood.energy).toBeLessThan(59);
  const later = applyTeamMoodSignal(isolated.state, currentRoster,
    disconnected, signal('neutral-2', 20, 0));
  expect(later.state.players.find((item) =>
    item.playerId === 'p1')?.mood.energy).toBeLessThan(70);
  expect(later.state.mood.energy).toBeGreaterThan(50);
});

it('rejects duplicate, future-network and wrong-season social evidence', () => {
  const currentRoster = roster();
  const initial = createTeamMoodState(currentRoster, 'a',
    policy, susceptibility);
  const connected = network();
  const first = applyTeamMoodSignal(initial, currentRoster,
    connected, signal('positive-1', 10, 20));
  expect(() => applyTeamMoodSignal(first.state, currentRoster,
    connected, signal('positive-1', 10, 20))).toThrow('duplicate');
  expect(() => applyTeamMoodSignal(initial, currentRoster,
    connected, { ...signal('positive-2', 10, 20), season: 2027 }))
    .toThrow('scope');
  const future = applyPlayerRelationshipEvidence(connected, 1, {
    eventId: 'support-2', sourceEventId: 'clubhouse-2',
    atDay: 11, fromPlayerId: 'p2', toPlayerId: 'p1',
    kind: 'MUTUAL_SUPPORT',
  }).state;
  expect(() => applyTeamMoodSignal(initial, currentRoster,
    future, signal('positive-3', 10, 20))).toThrow('future');
});
