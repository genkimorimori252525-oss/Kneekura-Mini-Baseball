import { describe, expect, it } from 'vitest';
import { allocateContinentalBerths } from './ContinentalQualification';

const base = {
  competitionEditionId: 'apbcl-2027', leagueId: 'league-001',
  qualificationSeasonId: 'japan-2026', berthCount: 2,
  alreadyQualifiedClubIds: ['club-a'],
  orderedCandidates: [
    { clubId: 'club-a', sourceType: 'DOMESTIC_CHAMPION' as const },
    { clubId: 'club-a', sourceType: 'REGULAR_SEASON_CHAMPION' as const },
    { clubId: 'club-b', sourceType: 'RUNNER_UP' as const },
    { clubId: 'club-c', sourceType: 'LEAGUE_COEFFICIENT_BERTH' as const },
    { clubId: 'club-d', sourceType: 'LEAGUE_COEFFICIENT_BERTH' as const },
  ],
  eligibilityByClubId: {
    'club-a': { eligible: true }, 'club-b': { eligible: false, reason: 'registration' },
    'club-c': { eligible: true }, 'club-d': { eligible: true },
  },
};

describe('continental qualification cascade', () => {
  it('skips defending champion duplicates and ineligible candidates with provenance', () => {
    const result = allocateContinentalBerths(base);
    expect(result.entrantClubIds).toEqual(['club-c', 'club-d']);
    expect(result.provenance).toHaveLength(2);
    expect(result.provenance[0]).toMatchObject({
      competitionEditionId: 'apbcl-2027', qualificationSeasonId: 'japan-2026',
      originalCandidateClubId: 'club-a', finalRecipientClubId: 'club-c',
      sourceType: 'DOMESTIC_CHAMPION',
    });
    expect(result.provenance[0].attempts.map((attempt) => attempt.result))
      .toEqual(['ALREADY_QUALIFIED', 'ALREADY_QUALIFIED', 'INELIGIBLE', 'SELECTED']);
    expect(result.provenance[0].attempts[2].eligibilityReason).toBe('registration');
    expect(result.provenance[1].attempts.map((attempt) => attempt.result))
      .toEqual(['ALREADY_QUALIFIED', 'INELIGIBLE', 'ALREADY_QUALIFIED', 'SELECTED']);
  });

  it('fails closed when eligible candidates cannot fill the approved berth count', () => {
    expect(() => allocateContinentalBerths({ ...base, berthCount: 3 }))
      .toThrow('eligible candidates');
  });
});
