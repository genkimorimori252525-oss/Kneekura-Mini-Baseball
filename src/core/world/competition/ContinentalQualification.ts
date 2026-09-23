export type QualificationSourceType =
  | 'DOMESTIC_CHAMPION' | 'REGULAR_SEASON_CHAMPION' | 'RUNNER_UP'
  | 'LEAGUE_COEFFICIENT_BERTH' | 'DEFENDING_CHAMPION_CASCADE'
  | 'OTHER_PROFILE_DEFINED';
export type EligibilityResult = Readonly<{ eligible: boolean; reason?: string }>;
export type QualificationCandidate = Readonly<{ clubId: string; sourceType: QualificationSourceType }>;
export type QualificationAttempt = Readonly<{
  clubId: string;
  result: 'ALREADY_QUALIFIED' | 'INELIGIBLE' | 'SELECTED';
  eligibilityReason?: string;
}>;
export type ContinentalQualificationProvenance = Readonly<{
  competitionEditionId: string;
  leagueId: string;
  qualificationSeasonId: string;
  berthIndex: number;
  sourceType: QualificationSourceType;
  originalCandidateClubId: string;
  finalRecipientClubId: string;
  attempts: readonly QualificationAttempt[];
}>;
export type ContinentalQualificationInput = Readonly<{
  competitionEditionId: string;
  leagueId: string;
  qualificationSeasonId: string;
  berthCount: number;
  alreadyQualifiedClubIds: readonly string[];
  orderedCandidates: readonly QualificationCandidate[];
  eligibilityByClubId: Readonly<Record<string, EligibilityResult>>;
}>;
export type ContinentalQualificationAllocation = Readonly<{
  entrantClubIds: readonly string[];
  provenance: readonly ContinentalQualificationProvenance[];
}>;

/** Candidate ordering is owned by the versioned domestic profile; berth count by coefficient policy. */
export const allocateContinentalBerths = (
  input: ContinentalQualificationInput,
): ContinentalQualificationAllocation => {
  for (const value of [input.competitionEditionId, input.leagueId, input.qualificationSeasonId]) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error('qualification identifiers are required');
    }
  }
  if (!Number.isSafeInteger(input.berthCount) || input.berthCount < 0
    || input.berthCount > input.orderedCandidates.length) {
    throw new Error('invalid continental berth count');
  }
  const alreadyQualified = new Set(input.alreadyQualifiedClubIds);
  if (alreadyQualified.size !== input.alreadyQualifiedClubIds.length) {
    throw new Error('duplicate already-qualified club ID');
  }
  for (const candidate of input.orderedCandidates) {
    const eligibility = input.eligibilityByClubId[candidate.clubId];
    if (
      typeof candidate.clubId !== 'string' || candidate.clubId.length === 0
      || !eligibility || typeof eligibility.eligible !== 'boolean'
    ) throw new Error('every qualification candidate requires a known eligibility result');
  }

  const entrantClubIds: string[] = [];
  const provenance: ContinentalQualificationProvenance[] = [];
  for (let berthIndex = 0; berthIndex < input.berthCount; berthIndex += 1) {
    const original = input.orderedCandidates[berthIndex];
    const attempts: QualificationAttempt[] = [];
    let finalRecipientClubId: string | null = null;
    for (let index = berthIndex; index < input.orderedCandidates.length; index += 1) {
      const clubId = input.orderedCandidates[index].clubId;
      const eligibility = input.eligibilityByClubId[clubId];
      if (alreadyQualified.has(clubId)) {
        attempts.push(Object.freeze({ clubId, result: 'ALREADY_QUALIFIED' }));
      } else if (!eligibility.eligible) {
        attempts.push(Object.freeze({
          clubId, result: 'INELIGIBLE', eligibilityReason: eligibility.reason,
        }));
      } else {
        attempts.push(Object.freeze({ clubId, result: 'SELECTED' }));
        finalRecipientClubId = clubId;
        break;
      }
    }
    if (finalRecipientClubId === null) {
      throw new Error('not enough eligible candidates to fill continental berths');
    }
    entrantClubIds.push(finalRecipientClubId);
    alreadyQualified.add(finalRecipientClubId);
    provenance.push(Object.freeze({
      competitionEditionId: input.competitionEditionId,
      leagueId: input.leagueId,
      qualificationSeasonId: input.qualificationSeasonId,
      berthIndex,
      sourceType: original.sourceType,
      originalCandidateClubId: original.clubId,
      finalRecipientClubId,
      attempts: Object.freeze(attempts),
    }));
  }
  return Object.freeze({
    entrantClubIds: Object.freeze(entrantClubIds),
    provenance: Object.freeze(provenance),
  });
};
