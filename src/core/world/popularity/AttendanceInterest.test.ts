import { describe, expect, it } from 'vitest';
import { state as clubState } from '../club/ClubFixtures.test-support';
import { createRosterState } from '../roster/RosterState';
import type { FanFavoriteInput } from './FanFavorite';
import { projectAttendanceInterest, type AttendanceInterestInput,
  type AttendanceInterestPolicy } from './AttendanceInterest';

const club = clubState();
const roster = createRosterState({ careerId: 'career-a', revision: 1,
  effectiveDay: 10,
  profiles: [{ profileId: 'roster-v1', version: 'v1', season: 1,
    competitionEditionId: 'league-season-1', activeLimit: null,
    allowedAssignmentKinds: ['FIRST_TEAM'], rehabParticipationAllowed: false }],
  units: [{ unitId: 'unit-a', clubId: 'club-a', kind: 'FIRST_TEAM' }],
  players: [{ playerId: 'player-a',
    clubRights: { rightsHolderClubId: 'club-a', contractId: 'contract-a' },
    assignment: { unitId: 'unit-a', clubId: 'club-a' },
    registrations: [{ competitionEditionId: 'league-season-1', clubId: 'club-a',
      status: 'ACTIVE', eligibility: 'ELIGIBLE', evidenceId: 'registered-a' }],
    availability: { status: 'AVAILABLE', evidenceId: 'available-a' } }] });
const audience = (favoriteThreshold = 0.5,
  awarenessAvailableAtDay = 10): FanFavoriteInput => ({
  careerId: 'career-a', personId: 'person-a', asOfDay: 11,
  initialClubId: 'club-a', transfers: [],
  observations: [
    { evidenceId: 'awareness-a', sourceCareerEventId: 'audience-event-a',
      atDay: 10, availableAtDay: awarenessAvailableAtDay,
      evidencePolicyVersion: 'audience-v1',
      audience: { kind: 'CLUB_FANS', scopeId: 'club-a' },
      metric: 'AWARENESS', value: 0.8 },
    { evidenceId: 'favorability-a', sourceCareerEventId: 'audience-event-b',
      atDay: 10, availableAtDay: 10,
      evidencePolicyVersion: 'audience-v1',
      audience: { kind: 'CLUB_FANS', scopeId: 'club-a' },
      metric: 'FAVORABILITY', value: 0.9 },
  ],
  policy: { policyId: 'favorite', version: 'v1', effectiveDay: 0,
    minimumAwareness: favoriteThreshold, minimumFavorability: favoriteThreshold },
});
const policy: AttendanceInterestPolicy = {
  policyId: 'attendance-interest', version: 'v1', availableAtDay: 0,
  baseline: 0.1,
  driverWeights: { CLUB_POPULARITY: 0.15, TEAM_PERFORMANCE: 0.1,
    STADIUM: 0.1, OPPONENT: 0.1, DAY_EVENT: 0.1,
    TICKET_ENVIRONMENT: 0.1 },
  playerDrawWeight: 0.05,
  awarenessWeight: 0.5, favorabilityWeight: 0.5,
};
const drivers: AttendanceInterestInput['drivers'] = [
  'CLUB_POPULARITY', 'TEAM_PERFORMANCE', 'STADIUM', 'OPPONENT',
  'DAY_EVENT', 'TICKET_ENVIRONMENT',
].map((kind) => ({ kind: kind as AttendanceInterestInput['drivers'][number]['kind'],
  careerId: 'career-a', gameId: 'game-1',
  subjectId: kind === 'STADIUM' ? club.institutional.stadium.stadiumId
    : kind === 'OPPONENT' ? 'club-b'
      : kind === 'DAY_EVENT' || kind === 'TICKET_ENVIRONMENT'
        ? 'game-1' : 'club-a',
  evidenceId: `driver-${kind}`, sourceCareerEventId: `event-${kind}`,
  availableAtDay: 10, value: 0.5 }));
const input = (): AttendanceInterestInput => ({ careerId: 'career-a',
  asOfDay: 11, fixture: { gameId: 'game-1', seriesId: 'series-1',
    day: 12, homeClubId: 'club-a', awayClubId: 'club-b' },
  fixtureSourceId: 'fixture-1', seasonId: 'league-season-1',
  venueBinding: { gameId: 'game-1', venueId: club.institutional.stadium.stadiumId,
    fixtureEventId: 'fixture-1', fixtureRevision: 0 },
  homeClub: club, roster,
  lineup: [{ gameId: 'game-1', playerId: 'player-a', personId: 'person-a',
    clubId: 'club-a', sourceEventId: 'lineup-a', availableAtDay: 11 }],
  audienceSources: [audience()], drivers });

describe('Career attendance interest', () => {
  it('combines bounded player draw with six evidenced demand factors', () => {
    const result = projectAttendanceInterest(input(), policy);
    expect(result.boundary).toBe('CAREER_ATTENDANCE_INTEREST_ONLY');
    expect(result.interestIndex).toBeCloseTo(0.4675);
    expect(result.playerDraw).toBeCloseTo(0.85);
    expect(result.provenance).toMatchObject({ gameId: 'game-1',
      stadiumId: club.institutional.stadium.stadiumId,
      lineupSourceEventIds: ['lineup-a'],
      audienceEvidenceIds: ['awareness-a', 'favorability-a'] });
    expect(result).not.toHaveProperty('count');
    expect(result).not.toHaveProperty('attendance');
  });

  it('ignores the descriptor threshold and requires confirmed participation and available audience evidence', () => {
    const base = projectAttendanceInterest(input(), policy);
    const relabeled = input();
    const changed = projectAttendanceInterest({ ...relabeled,
      audienceSources: [audience(0.95)] }, policy);
    expect(changed.interestIndex).toBe(base.interestIndex);
    const noLineup = projectAttendanceInterest({ ...input(), lineup: [] }, policy);
    expect(noLineup.playerDraw).toBe(0);
    const unpublished = projectAttendanceInterest({ ...input(),
      audienceSources: [audience(0.5, 12)] }, policy);
    expect(unpublished.playerDraw).toBe(0);
  });

  it('rejects an unavailable lineup, ineligible player, future driver, or mismatched fixture venue', () => {
    const base = input();
    expect(() => projectAttendanceInterest({ ...base,
      lineup: [{ ...base.lineup[0]!, availableAtDay: 12 }] }, policy)).toThrow();
    const injured = createRosterState({ ...roster,
      players: roster.players.map((player) => ({ ...player,
        availability: { status: 'INJURED', evidenceId: 'injury-a' } })) });
    expect(() => projectAttendanceInterest({ ...base, roster: injured }, policy))
      .toThrow();
    expect(() => projectAttendanceInterest({ ...base,
      drivers: [{ ...base.drivers[0]!, availableAtDay: 12 },
        ...base.drivers.slice(1)] }, policy)).toThrow();
    expect(() => projectAttendanceInterest({ ...base,
      fixture: { ...base.fixture, homeClubId: 'club-b' } }, policy)).toThrow();
    expect(() => projectAttendanceInterest({ ...base,
      venueBinding: { ...base.venueBinding, venueId: 'wrong-stadium' } },
    policy)).toThrow();
  });
});
