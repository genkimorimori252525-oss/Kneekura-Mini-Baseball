import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { ClubWorldRegion } from './ClubWorldBerths';
import { HOST_METRICS, assertWorldHostVenueEvent, type HostInfrastructureMetrics,
  type WorldHostVenueEvent } from './CompetitionHostInfrastructure';
import { selectCompetitionHost, type HostCandidate, type HostSelection } from './HostSelection';

export type RegionalNationalHostPolicy = Readonly<{
  version: string; hostNationCount: 1 | 2; groupHostVenueCount: number; knockoutHubCount: number;
  minimums: Readonly<Record<'GROUP' | 'KNOCKOUT' | 'FINAL_FOUR', HostInfrastructureMetrics>>;
  suitabilityWeights: HostInfrastructureMetrics;
  rotation: Readonly<{ lookbackDays: number; cityPenalty: number; nationPenalty: number; regionPenalty: number }>;
}>;
export type CompletedRegionalNationalHosting = Readonly<{
  editionId: string; region: ClubWorldRegion; completedAtDay: number; sourceSnapshotId: string;
  hosts: readonly Readonly<{ venueId: string; nationId: string; cityId: string; regionId: string }>[];
}>;
export type RegionalNationalHostCandidates = Readonly<{
  region: ClubWorldRegion; asOfDay: number; policy: RegionalNationalHostPolicy;
  groupCandidates: readonly HostCandidate[]; knockoutCandidates: readonly HostCandidate[];
  finalFourCandidates: readonly HostCandidate[];
}>;
export type RegionalNationalHosting = Readonly<{
  region: ClubWorldRegion; policyVersion: string; hostNationIds: readonly string[];
  groupHosts: readonly HostSelection[]; knockoutHubs: readonly HostSelection[]; finalFourHost: HostSelection;
}>;
const REGIONS = ['ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'] as const;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const metrics = (value: HostInfrastructureMetrics): boolean => !!value
  && Object.keys(value).sort().join('|') === [...HOST_METRICS].sort().join('|')
  && HOST_METRICS.every((key) => typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key] >= 0);
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
export const snapshotRegionalNationalHostPolicy = (raw: RegionalNationalHostPolicy): RegionalNationalHostPolicy => {
  const policy = cloneInert(raw);
  if (!policy || Object.keys(policy).sort().join('|') !== 'groupHostVenueCount|hostNationCount|knockoutHubCount|minimums|rotation|suitabilityWeights|version'
    || !id(policy.version) || ![1, 2].includes(policy.hostNationCount)
    || !day(policy.groupHostVenueCount) || policy.groupHostVenueCount < policy.hostNationCount || policy.groupHostVenueCount > 4
    || !day(policy.knockoutHubCount) || policy.knockoutHubCount < 1 || policy.knockoutHubCount > 4
    || !policy.minimums || Object.keys(policy.minimums).sort().join('|') !== 'FINAL_FOUR|GROUP|KNOCKOUT'
    || Object.values(policy.minimums).some((value) => !metrics(value)
      || !day(value.stadiumCapacity) || !day(value.accommodationCapacity))
    || !metrics(policy.suitabilityWeights) || !HOST_METRICS.some((key) => policy.suitabilityWeights[key] > 0)
    || !policy.rotation || Object.keys(policy.rotation).sort().join('|') !== 'cityPenalty|lookbackDays|nationPenalty|regionPenalty'
    || !day(policy.rotation.lookbackDays) || [policy.rotation.cityPenalty, policy.rotation.nationPenalty, policy.rotation.regionPenalty]
      .some((value) => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
    throw new Error('invalid versioned regional hosting policy');
  }
  return freeze(policy);
};

/** Event-era infrastructure and cutoff Nation membership are independent accepted facts. */
export const deriveRegionalNationalHostCandidates = (raw: Readonly<{
  region: ClubWorldRegion; asOfDay: number; policy: RegionalNationalHostPolicy;
  venues: readonly WorldHostVenueEvent[]; history: readonly CompletedRegionalNationalHosting[];
  nationRegions: readonly Readonly<{ nationId: string; region: ClubWorldRegion }>[];
}>): RegionalNationalHostCandidates => {
  const input = cloneInert(raw), policy = snapshotRegionalNationalHostPolicy(input.policy);
  if (!REGIONS.includes(input.region) || !day(input.asOfDay) || !Array.isArray(input.venues)
    || !Array.isArray(input.history) || !Array.isArray(input.nationRegions)) throw new Error('invalid regional host cutoff inputs');
  const nationRegions = new Map<string, ClubWorldRegion>();
  for (const proof of input.nationRegions) {
    if (!proof || !id(proof.nationId) || !REGIONS.includes(proof.region) || nationRegions.has(proof.nationId)) {
      throw new Error('invalid regional host Nation membership proof');
    }
    nationRegions.set(proof.nationId, proof.region);
  }
  const venueIds = new Set<string>();
  for (const venue of input.venues) {
    assertWorldHostVenueEvent(venue);
    if (venue.effectiveFromDay > input.asOfDay || venueIds.has(venue.venueId) || !nationRegions.has(venue.nationId)) {
      throw new Error('regional host infrastructure exceeds cutoff or lacks distinct accepted Nation proof');
    }
    venueIds.add(venue.venueId);
  }
  const editions = new Set<string>();
  for (const entry of input.history) {
    if (!entry || !id(entry.editionId) || !id(entry.sourceSnapshotId) || !REGIONS.includes(entry.region)
      || !day(entry.completedAtDay) || entry.completedAtDay > input.asOfDay || editions.has(entry.editionId)
      || !Array.isArray(entry.hosts) || entry.hosts.length === 0 || new Set(entry.hosts.map((host: CompletedRegionalNationalHosting['hosts'][number]) => host.venueId)).size !== entry.hosts.length
      || entry.hosts.some((host: CompletedRegionalNationalHosting['hosts'][number]) => !host || ![host.venueId, host.nationId, host.cityId, host.regionId].every(id)
        || host.regionId !== entry.region)) throw new Error('invalid completed regional hosting history');
    editions.add(entry.editionId);
  }
  const history = input.history.filter((entry) => entry.region === input.region
    && entry.completedAtDay >= Math.max(0, input.asOfDay - policy.rotation.lookbackDays));
  const candidates = (stage: keyof RegionalNationalHostPolicy['minimums']): readonly HostCandidate[] => input.venues.map((venue) => {
    const region = nationRegions.get(venue.nationId)!;
    const suitabilityScore = HOST_METRICS.reduce((sum, key) => sum + venue.metrics[key] * policy.suitabilityWeights[key], 0);
    const rotationScore = -history.reduce((sum, entry) => sum
      + (entry.hosts.some((host: CompletedRegionalNationalHosting['hosts'][number]) => host.cityId === venue.cityId) ? policy.rotation.cityPenalty : 0)
      + (entry.hosts.some((host: CompletedRegionalNationalHosting['hosts'][number]) => host.nationId === venue.nationId) ? policy.rotation.nationPenalty : 0)
      + (entry.region === region ? policy.rotation.regionPenalty : 0), 0);
    if (![suitabilityScore, rotationScore, suitabilityScore + rotationScore].every(Number.isFinite)) throw new Error('regional hosting score overflow');
    return { venueId: venue.venueId, nationId: venue.nationId, cityId: venue.cityId, regionId: region,
      eligible: region === input.region && venue.licensed && venue.safe
        && HOST_METRICS.every((key) => venue.metrics[key] >= policy.minimums[stage][key]), suitabilityScore, rotationScore };
  });
  return freeze({ region: input.region, asOfDay: input.asOfDay, policy,
    groupCandidates: candidates('GROUP'), knockoutCandidates: candidates('KNOCKOUT'), finalFourCandidates: candidates('FINAL_FOUR') });
};
const compare = (a: HostCandidate, b: HostCandidate): number =>
  (b.suitabilityScore + b.rotationScore) - (a.suitabilityScore + a.rotationScore)
  || b.suitabilityScore - a.suitabilityScore || (a.venueId < b.venueId ? -1 : a.venueId > b.venueId ? 1 : 0);

/** Search host Nation combinations before committing to group venues or medal facilities. */
export const selectRegionalNationalHosts = (raw: RegionalNationalHostCandidates): RegionalNationalHosting => {
  const input = cloneInert(raw), policy = snapshotRegionalNationalHostPolicy(input.policy);
  if (!REGIONS.includes(input.region) || !day(input.asOfDay)) throw new Error('invalid regional hosting input');
  const stages = [input.groupCandidates, input.knockoutCandidates, input.finalFourCandidates];
  const venuesById = new Map<string, string>();
  for (const candidates of stages) {
    if (!Array.isArray(candidates) || candidates.length === 0) throw new Error('no eligible regional host combination');
    for (const candidate of candidates) {
      const location = JSON.stringify([candidate.nationId, candidate.cityId, candidate.regionId]);
      const prior = venuesById.get(candidate.venueId);
      if (prior && prior !== location) throw new Error('regional host venue has conflicting locations');
      venuesById.set(candidate.venueId, location);
    }
    // Validate every candidate before filtering, including rejected facilities.
    selectCompetitionHost({ competitionKind: 'OTHER', policyVersion: policy.version, candidates });
  }
  const available = (candidates: readonly HostCandidate[], nations: readonly string[]): HostCandidate[] =>
    candidates.filter((candidate) => candidate.eligible && candidate.regionId === input.region && nations.includes(candidate.nationId)).sort(compare);
  const nations = [...new Set(input.groupCandidates.filter((item) => item.eligible && item.regionId === input.region).map((item) => item.nationId))].sort();
  const combinations = policy.hostNationCount === 1 ? nations.map((nation) => [nation])
    : nations.flatMap((nation, index) => nations.slice(index + 1).map((other) => [nation, other]));
  let chosen: { nations: string[]; group: HostCandidate[]; knockout: HostCandidate[]; final: HostCandidate } | undefined;
  for (const hostNations of combinations) {
    const groupOptions = available(input.groupCandidates, hostNations);
    const group = groupOptions.slice(0, policy.groupHostVenueCount);
    const knockout = available(input.knockoutCandidates, hostNations).slice(0, policy.knockoutHubCount);
    const final = available(input.finalFourCandidates, hostNations)[0];
    if (group.length !== policy.groupHostVenueCount || knockout.length !== policy.knockoutHubCount || !final) continue;
    for (const nation of hostNations) {
      if (!group.some((candidate) => candidate.nationId === nation)) {
        const replacement = groupOptions.find((candidate) => candidate.nationId === nation);
        if (replacement) group[group.length - 1] = replacement;
      }
    }
    group.sort(compare);
    if (hostNations.some((nation) => !group.some((candidate) => candidate.nationId === nation))) continue;
    let difference = 0;
    if (chosen) for (let index = 0; index < group.length && difference === 0; index++) difference = compare(group[index], chosen.group[index]);
    if (!chosen || difference < 0) chosen = { nations: hostNations, group, knockout, final };
  }
  if (!chosen) throw new Error('no eligible regional host combination');
  const selection = (candidate: HostCandidate, candidates: readonly HostCandidate[]): HostSelection => {
    const selected = selectCompetitionHost({ competitionKind: 'OTHER', policyVersion: policy.version,
      candidates: candidates.map((item) => ({ ...item, eligible: item.venueId === candidate.venueId && item.eligible })) });
    return { ...selected, evaluations: selectCompetitionHost({ competitionKind: 'OTHER', policyVersion: policy.version, candidates }).evaluations };
  };
  return freeze({ region: input.region, policyVersion: policy.version, hostNationIds: chosen.nations,
    groupHosts: chosen.group.map((candidate) => selection(candidate, input.groupCandidates)),
    knockoutHubs: chosen.knockout.map((candidate) => selection(candidate, input.knockoutCandidates)),
    finalFourHost: selection(chosen.final, input.finalFourCandidates) });
};
