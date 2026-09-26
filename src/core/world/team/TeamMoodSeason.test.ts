import { expect, it } from 'vitest';
import { applyClubCommand } from '../club/ClubLifecycle';
import { closure, command, nextPlan, state } from '../club/ClubFixtures.test-support';
import { createRosterState } from '../roster/RosterState';
import type { RosterStateInput } from '../roster/RosterTypes';
import { createPlayerRelationshipNetwork } from './PlayerRelationships';
import { applyTeamMoodSignal, createTeamMoodState } from './TeamMood';
import { openTeamMoodSeason } from './TeamMoodSeason';

const axes = { confidence: 50, cohesion: 50, energy: 50,
  tension: 50, roleHarmony: 50 };
const moodPolicy = (season: number) => ({
  policyId: 'team-mood', version: 'v1', season, availableAtDay: 0,
  baseline: axes, directStrength: 1, diffusionStrength: 0,
  dailyReversion: { confidence: 0, cohesion: 0, energy: 0,
    tension: 0, roleHarmony: 0 },
});
const susceptibility = (playerId: string) => ({ playerId,
  axes: { confidence: 1, cohesion: 1, energy: 1,
    tension: 1, roleHarmony: 1 } });
const player = (playerId: string) => ({ playerId,
  clubRights: { rightsHolderClubId: 'club-a', contractId: `contract-${playerId}` },
  assignment: { unitId: 'club-a-first', clubId: 'club-a' },
  registrations: [], availability: {
    status: 'AVAILABLE' as const, evidenceId: `health-${playerId}` },
});
const roster = (season: number, playerIds: readonly string[], effectiveDay: number) =>
  createRosterState({ careerId: 'career-a', effectiveDay,
    profiles: [{ profileId: 'league', version: 'v1', season,
      competitionEditionId: `league-${season}`, activeLimit: null,
      allowedAssignmentKinds: ['FIRST_TEAM'], rehabParticipationAllowed: false }],
    units: [{ unitId: 'club-a-first', clubId: 'club-a',
      kind: 'FIRST_TEAM' }],
    players: playerIds.map(player),
  } as RosterStateInput);
const openedClub = () => {
  const initial = state();
  const closed = applyClubCommand(initial,
    command([closure()], initial, 'close-season'));
  if (!closed.ok) throw new Error('failed to close test season');
  const plan = nextPlan(closed.state);
  const opened = applyClubCommand(closed.state, {
    ...command([{ kind: 'OPEN_SEASON', plan }], closed.state,
      'open-season'), effectiveDay: plan.startsOnDay,
  });
  if (!opened.ok) throw new Error('failed to open test season');
  return { closed: closed.state, opened };
};
const previousMood = () => {
  const previousRoster = roster(1, ['p1', 'p2'], 10);
  const baseline = createTeamMoodState(previousRoster, 'club-a',
    moodPolicy(1), ['p1', 'p2'].map(susceptibility));
  const relationships = createPlayerRelationshipNetwork('career-a', {
    policyId: 'relationships', version: 'v1', availableAtDay: 0,
    baseline: { affinity: 50, trust: 50, coordination: 50 },
    deltas: {
      SHARED_SUCCESS: { affinity: 0, trust: 0, coordination: 0 },
      MUTUAL_SUPPORT: { affinity: 0, trust: 0, coordination: 0 },
      JOINT_REPETITION: { affinity: 0, trust: 0, coordination: 0 },
      JOINT_EXECUTION: { affinity: 0, trust: 0, coordination: 0 },
      JOINT_FAILURE: { affinity: 0, trust: 0, coordination: 0 },
      CONFLICT: { affinity: 0, trust: 0, coordination: 0 },
      TRUST_BREACH: { affinity: 0, trust: 0, coordination: 0 },
      ROLE_COMPETITION: { affinity: 0, trust: 0, coordination: 0 },
    },
  });
  const energy = applyTeamMoodSignal(baseline, previousRoster,
    relationships, { eventId: 'energy-event', sourceEventId: 'energy-source',
      appraisalId: 'energy-appraisal', careerId: 'career-a',
      clubId: 'club-a', season: 1, directPlayerId: 'p1',
      atDay: 10, axis: 'energy', delta: 20 });
  return applyTeamMoodSignal(energy.state, previousRoster,
    relationships, { eventId: 'cohesion-event',
      sourceEventId: 'cohesion-source', appraisalId: 'cohesion-appraisal',
      careerId: 'career-a', clubId: 'club-a', season: 1,
      directPlayerId: 'p1', atDay: 10, axis: 'cohesion', delta: 20 }).state;
};
const carry = { policyId: 'synthetic-carry', version: 'v1',
  season: 2, availableAtDay: 0,
  retention: { confidence: 0.4, cohesion: 0.8, energy: 0.1,
    tension: 0.2, roleHarmony: 0.3 } };

it('carries each axis for retained players and gives newcomers baseline mood', () => {
  const { closed, opened } = openedClub();
  const result = openTeamMoodSeason(previousMood(), closed,
    opened.event, roster(2, ['p1', 'p3'], opened.state.effectiveDay),
    moodPolicy(2), ['p1', 'p3'].map(susceptibility), carry);
  expect(result.state.season).toBe(2);
  expect(result.state.players.map((entry) => entry.playerId))
    .toEqual(['p1', 'p3']);
  expect(result.state.players[0]?.mood.energy).toBe(52);
  expect(result.state.players[0]?.mood.cohesion).toBe(66);
  expect(result.state.players[1]?.mood).toEqual(axes);
  expect(result.state.mood.energy).toBe(51);
  expect(result.state.mood.cohesion).toBe(58);
  expect(result.event).toMatchObject({
    sourceClubEventId: 'open-season', previousSeason: 1,
    nextSeason: 2, retainedPlayerIds: ['p1'],
    departedPlayerIds: ['p2'], newPlayerIds: ['p3'],
  });
  expect(result.state).not.toHaveProperty('battingModifier');
});

it('rejects forged season openings, wrong season and future roster snapshots', () => {
  const { closed, opened } = openedClub();
  const validRoster = roster(2, ['p1', 'p3'],
    opened.state.effectiveDay);
  expect(() => openTeamMoodSeason(previousMood(), closed,
    { ...opened.event, afterRevision: 999 }, validRoster,
    moodPolicy(2), ['p1', 'p3'].map(susceptibility), carry))
    .toThrow('season opening');
  expect(() => openTeamMoodSeason(previousMood(), closed,
    opened.event, validRoster, moodPolicy(3),
    ['p1', 'p3'].map(susceptibility), carry)).toThrow('season');
  expect(() => openTeamMoodSeason(previousMood(), closed,
    opened.event, roster(2, ['p1', 'p3'],
      opened.state.effectiveDay + 1), moodPolicy(2),
    ['p1', 'p3'].map(susceptibility), carry)).toThrow('future');
});
