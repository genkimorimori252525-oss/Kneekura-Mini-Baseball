import type { RosterStateInput } from './index';

/** Deliberately synthetic policy: never claims to be an NPB or other real league rule. */
export function rosterFixture(): RosterStateInput {
  return {
    careerId: 'career-1',
    profiles: [{
      profileId: 'test-roster', version: '1', season: 2026,
      competitionEditionId: 'league-2026', activeLimit: 1,
      allowedAssignmentKinds: ['FIRST_TEAM'], rehabParticipationAllowed: false,
    }, {
      profileId: 'test-reserve', version: '1', season: 2026,
      competitionEditionId: 'reserve-2026', activeLimit: null,
      allowedAssignmentKinds: ['RESERVE', 'DEVELOPMENT'], rehabParticipationAllowed: true,
    }],
    units: [
      { unitId: 'a-first', clubId: 'a', kind: 'FIRST_TEAM' },
      { unitId: 'a-reserve', clubId: 'a', kind: 'RESERVE' },
      { unitId: 'a-farm-1', clubId: 'a', kind: 'DEVELOPMENT', developmentLevel: 1 },
      { unitId: 'a-farm-2', clubId: 'a', kind: 'DEVELOPMENT', developmentLevel: 2 },
      { unitId: 'b-first', clubId: 'b', kind: 'FIRST_TEAM' },
      { unitId: 'b-farm', clubId: 'b', kind: 'DEVELOPMENT', developmentLevel: 1 },
    ],
    players: [{
      playerId: 'p1', clubRights: { rightsHolderClubId: 'a', contractId: 'contract-1' },
      assignment: { unitId: 'a-first', clubId: 'a' },
      registrations: [{ competitionEditionId: 'league-2026', clubId: 'a', status: 'ACTIVE', eligibility: 'ELIGIBLE', evidenceId: 'registration-1' }],
      availability: { status: 'AVAILABLE', evidenceId: 'health-1' },
    }, {
      playerId: 'p2', clubRights: { rightsHolderClubId: 'a', contractId: 'contract-2' },
      assignment: { unitId: 'a-farm-1', clubId: 'a' },
      registrations: [{ competitionEditionId: 'reserve-2026', clubId: 'a', status: 'ACTIVE', eligibility: 'ELIGIBLE', evidenceId: 'registration-2' }],
      availability: { status: 'AVAILABLE', evidenceId: 'health-2' },
    }],
  };
}