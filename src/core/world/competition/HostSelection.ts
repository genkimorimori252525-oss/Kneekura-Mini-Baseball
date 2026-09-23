export type HostCandidate = Readonly<{
  venueId: string;
  nationId: string;
  cityId: string;
  regionId: string;
  eligible: boolean;
  /** Versioned policy supplies calibrated scores; Core does not invent weights. */
  suitabilityScore: number;
  rotationScore: number;
}>;

export type HostEvaluation = Readonly<{
  venueId: string;
  rejectionReason: 'INELIGIBLE' | 'WBC_US_ONLY' | null;
  suitabilityScore: number;
  rotationScore: number;
  combinedScore: number | null;
}>;

export type HostSelection = Readonly<{
  policyVersion: string;
  selectedVenueId: string;
  selectedNationId: string;
  selectedCityId: string;
  selectedRegionId: string;
  evaluations: readonly HostEvaluation[];
}>;

export const selectCompetitionHost = (input: Readonly<{
  competitionKind: 'WBC_FINALS' | 'WBC_GLOBAL_QUALIFIER' | 'OTHER';
  policyVersion: string;
  candidates: readonly HostCandidate[];
}>): HostSelection => {
  if (!input.policyVersion || !['WBC_FINALS', 'WBC_GLOBAL_QUALIFIER', 'OTHER'].includes(input.competitionKind)) {
    throw new Error('host selection requires a versioned competition policy');
  }
  const seen = new Set<string>();
  const evaluations: HostEvaluation[] = input.candidates.map((candidate) => {
    if (
      !candidate.venueId || !candidate.nationId || !candidate.cityId || !candidate.regionId
      || seen.has(candidate.venueId)
      || typeof candidate.eligible !== 'boolean'
      || !Number.isFinite(candidate.suitabilityScore)
      || !Number.isFinite(candidate.rotationScore)
      || !Number.isFinite(candidate.suitabilityScore + candidate.rotationScore)
    ) throw new Error('invalid or duplicate host candidate');
    seen.add(candidate.venueId);
    const rejectionReason = !candidate.eligible ? 'INELIGIBLE' as const
      : input.competitionKind === 'WBC_FINALS' && candidate.nationId !== 'US'
        ? 'WBC_US_ONLY' as const : null;
    return Object.freeze({
      venueId: candidate.venueId,
      rejectionReason,
      suitabilityScore: candidate.suitabilityScore,
      rotationScore: candidate.rotationScore,
      combinedScore: rejectionReason === null
        ? candidate.suitabilityScore + candidate.rotationScore : null,
    });
  });
  const eligible = input.candidates.filter((_, index) => evaluations[index].rejectionReason === null)
    .sort((a, b) => (
      (b.suitabilityScore + b.rotationScore) - (a.suitabilityScore + a.rotationScore)
      || b.suitabilityScore - a.suitabilityScore
      || (a.venueId < b.venueId ? -1 : a.venueId > b.venueId ? 1 : 0)
    ));
  const selected = eligible[0];
  if (!selected) throw new Error('no eligible host for competition edition');
  return Object.freeze({
    policyVersion: input.policyVersion,
    selectedVenueId: selected.venueId,
    selectedNationId: selected.nationId,
    selectedCityId: selected.cityId,
    selectedRegionId: selected.regionId,
    evaluations: Object.freeze(evaluations),
  });
};
