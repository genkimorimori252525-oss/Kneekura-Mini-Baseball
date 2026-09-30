import { selectCompetitionHost, type HostCandidate, type HostSelection } from './HostSelection';

export type NationalCompetitionHostingInput = Readonly<{
  kind: 'WBC' | 'PREMIER_12';
  policyVersion: string;
  groupCandidates: readonly (readonly HostCandidate[])[];
  knockoutCandidates: readonly (readonly HostCandidate[])[];
  finalFourCandidates: readonly HostCandidate[];
}>;
export type NationalCompetitionHosting = Readonly<{
  policyVersion: string;
  hostNationIds: readonly string[];
  groupHosts: readonly HostSelection[];
  knockoutHubs: readonly HostSelection[];
  finalFourHost: HostSelection;
}>;

export const selectNationalCompetitionHosts = (
  input: NationalCompetitionHostingInput,
): NationalCompetitionHosting => {
  if (!input || !['WBC', 'PREMIER_12'].includes(input.kind)
    || typeof input.policyVersion !== 'string' || !input.policyVersion
    || !Array.isArray(input.groupCandidates) || !Array.isArray(input.knockoutCandidates)
    || !Array.isArray(input.finalFourCandidates)
    || input.groupCandidates.length !== (input.kind === 'WBC' ? 6 : 2)
    || (input.kind === 'WBC' ? input.knockoutCandidates.length < 2
      || input.knockoutCandidates.length > 4 : input.knockoutCandidates.length !== 0)
    || [...input.groupCandidates, ...input.knockoutCandidates].some((candidates) =>
      !Array.isArray(candidates))) throw new Error('invalid national hosting candidates');
  const venuesById = new Map<string, string>();
  for (const candidate of [...input.groupCandidates.flat(), ...input.knockoutCandidates.flat(),
    ...input.finalFourCandidates]) {
    if (!candidate || [candidate.venueId, candidate.cityId, candidate.nationId, candidate.regionId]
      .some((value) => typeof value !== 'string' || !value)
      || typeof candidate.eligible !== 'boolean'
      || !Number.isFinite(candidate.suitabilityScore) || !Number.isFinite(candidate.rotationScore)
      || !Number.isFinite(candidate.suitabilityScore + candidate.rotationScore)) {
      throw new Error('invalid national host candidate');
    }
    if (input.kind === 'WBC' && candidate.nationId === 'US' && candidate.regionId !== 'AMERICAS') {
      throw new Error('US host region must be AMERICAS');
    }
    const location = JSON.stringify([candidate.nationId, candidate.cityId, candidate.regionId]);
    const prior = venuesById.get(candidate.venueId);
    if (prior && prior !== location) throw new Error('national host venue has conflicting locations');
    venuesById.set(candidate.venueId, location);
  }
  const eligible = (candidate: HostCandidate): boolean => candidate.eligible
    && (input.kind !== 'WBC' || candidate.nationId === 'US');
  // Matching feasibility preserves later slots without changing per-slot calibrated score priority.
  const canFill = (slots: readonly (readonly HostCandidate[])[], excludedCities: ReadonlySet<string>): boolean => {
    const assigned = new Map<string, number>();
    const place = (slot: number, visited: Set<string>): boolean => {
      for (const candidate of slots[slot]) {
        if (!eligible(candidate) || excludedCities.has(candidate.cityId) || visited.has(candidate.cityId)) continue;
        visited.add(candidate.cityId);
        const prior = assigned.get(candidate.cityId);
        if (prior === undefined || place(prior, visited)) {
          assigned.set(candidate.cityId, slot);
          return true;
        }
      }
      return false;
    };
    return slots.every((_, index) => place(index, new Set()));
  };
  const select = (candidates: readonly HostCandidate[], allowed: (candidate: HostCandidate) => boolean):
    HostSelection => selectCompetitionHost({
    competitionKind: input.kind === 'WBC' ? 'WBC_FINALS' : 'OTHER',
    policyVersion: input.policyVersion,
    candidates: candidates.map((candidate) => {
      if (typeof candidate?.eligible !== 'boolean') throw new Error('invalid host candidate eligibility');
      return { ...candidate, eligible: candidate.eligible && allowed(candidate) };
    }),
  });
  const distinct = (slots: readonly (readonly HostCandidate[])[], premierGroups = false): readonly HostSelection[] => {
    const cities = new Set<string>();
    const venues = new Set<string>();
    const nations = new Set<string>();
    return Object.freeze(slots.map((candidates, index) => {
      const host = select(candidates, (candidate) => {
        if (cities.has(candidate.cityId) || venues.has(candidate.venueId)) return false;
        const excluded = new Set([...cities, candidate.cityId]);
        if (!canFill(slots.slice(index + 1), excluded)) return false;
        if (!premierGroups) return true;
        const finalPossible = (otherNation?: string): boolean => input.finalFourCandidates.some((final) =>
          eligible(final) && (nations.has(final.nationId) || final.nationId === candidate.nationId
            || final.nationId === otherNation));
        return index === 1 ? finalPossible() : slots[1].some((next) =>
          eligible(next) && !excluded.has(next.cityId) && finalPossible(next.nationId));
      });
      cities.add(host.selectedCityId);
      venues.add(host.selectedVenueId);
      nations.add(host.selectedNationId);
      return host;
    }));
  };
  const groupHosts = distinct(input.groupCandidates, input.kind === 'PREMIER_12');
  const hostNationIds = Object.freeze([...new Set(groupHosts.map((host) => host.selectedNationId))]);
  const knockoutHubs = distinct(input.knockoutCandidates);
  const finalFourHost = select(input.finalFourCandidates, (candidate) =>
    hostNationIds.includes(candidate.nationId));
  return Object.freeze({ policyVersion: input.policyVersion, hostNationIds,
    groupHosts, knockoutHubs, finalFourHost });
};
