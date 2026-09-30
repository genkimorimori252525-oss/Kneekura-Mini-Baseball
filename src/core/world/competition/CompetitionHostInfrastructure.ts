import type { ClubWorldRegion } from './ClubWorldBerths';
import type { NationalCompetitionHostingInput } from './NationalCompetitionHosting';
import { cloneInert } from '../../adjudication/OfficialWindowPolicy';

export const HOST_METRICS = ['stadiumCapacity', 'stadiumQuality', 'transportQuality',
  'accommodationCapacity', 'broadcastReadiness', 'operationsQuality'] as const;
export type HostInfrastructureMetrics = Readonly<Record<typeof HOST_METRICS[number], number>>;
export type WorldHostVenueEvent = Readonly<{
  careerId: string; venueId: string; nationId: string; cityId: string; region: ClubWorldRegion;
  effectiveFromDay: number; sourceEventId: string; sourceClubId: string | null;
  licensed: boolean; safe: boolean; metrics: HostInfrastructureMetrics;
}>;
export type CompletedNationalHosting = Readonly<{
  editionId: string; kind: 'WBC' | 'PREMIER_12'; completedAtDay: number; sourceSnapshotId: string;
  hosts: readonly Readonly<{ venueId: string; nationId: string; cityId: string; regionId: string }>[];
}>;
export type NationalHostCandidatePolicy = Readonly<{
  version: string; kind: 'WBC' | 'PREMIER_12'; knockoutHubCount: number;
  minimums: Readonly<Record<'GROUP' | 'KNOCKOUT' | 'FINAL_FOUR', HostInfrastructureMetrics>>;
  suitabilityWeights: HostInfrastructureMetrics;
  rotation: Readonly<{ lookbackDays: number; cityPenalty: number; nationPenalty: number; regionPenalty: number }>;
}>;

const REGIONS = ['ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'] as const;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0
  && value === value.trim();
const day = (value: unknown): value is number => typeof value === 'number'
  && Number.isSafeInteger(value) && value >= 0;
const metricsValid = (value: HostInfrastructureMetrics): boolean => !!value && HOST_METRICS.every((key) =>
  typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key] >= 0);
const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

export const assertWorldHostVenueEvent = (event: WorldHostVenueEvent): void => {
  if (!event || ![event.careerId, event.venueId, event.nationId, event.cityId, event.sourceEventId].every(id)
    || !REGIONS.includes(event.region) || !day(event.effectiveFromDay)
    || (event.sourceClubId !== null && !id(event.sourceClubId))
    || typeof event.licensed !== 'boolean' || typeof event.safe !== 'boolean'
    || !metricsValid(event.metrics) || !day(event.metrics.stadiumCapacity)
    || !day(event.metrics.accommodationCapacity)
    || (event.nationId === 'US' && event.region !== 'AMERICAS')) {
    throw new Error('invalid accepted World host venue event');
  }
};
export const snapshotNationalHostCandidatePolicy = (
  rawPolicy: NationalHostCandidatePolicy,
): NationalHostCandidatePolicy => {
  const policy = cloneInert(rawPolicy);
  if (!policy || !id(policy.version) || !['WBC', 'PREMIER_12'].includes(policy.kind)
    || !day(policy.knockoutHubCount) || (policy.kind === 'WBC'
      ? policy.knockoutHubCount < 2 || policy.knockoutHubCount > 4 : policy.knockoutHubCount !== 0)
    || !policy.minimums || !['GROUP', 'KNOCKOUT', 'FINAL_FOUR'].every((stage) =>
      metricsValid(policy.minimums[stage as keyof typeof policy.minimums]))
    || !metricsValid(policy.suitabilityWeights)
    || !HOST_METRICS.some((metric) => policy.suitabilityWeights[metric] > 0)
    || !policy.rotation || !day(policy.rotation.lookbackDays)
    || [policy.rotation.cityPenalty, policy.rotation.nationPenalty, policy.rotation.regionPenalty]
      .some((value) => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
    throw new Error('invalid versioned host candidate policy');
  }
  return freeze(policy);
};
export const deriveNationalHostCandidates = (input: Readonly<{
  policy: NationalHostCandidatePolicy; asOfDay: number;
  venues: readonly WorldHostVenueEvent[]; history: readonly CompletedNationalHosting[];
}>): NationalCompetitionHostingInput => {
  const policy = snapshotNationalHostCandidatePolicy(input.policy);
  if (!day(input.asOfDay) || !Array.isArray(input.venues) || !Array.isArray(input.history)) {
    throw new Error('invalid host candidate cutoff inputs');
  }
  const venueIds = new Set<string>();
  input.venues.forEach((venue) => {
    assertWorldHostVenueEvent(venue);
    if (venue.effectiveFromDay > input.asOfDay || venueIds.has(venue.venueId)) {
      throw new Error('host infrastructure exceeds cutoff or repeats a venue');
    }
    venueIds.add(venue.venueId);
  });
  const editions = new Set<string>();
  input.history.forEach((edition: CompletedNationalHosting) => {
    if (!edition || !id(edition.editionId) || !id(edition.sourceSnapshotId)
      || !['WBC', 'PREMIER_12'].includes(edition.kind) || !day(edition.completedAtDay)
      || edition.completedAtDay > input.asOfDay || editions.has(edition.editionId)
      || !Array.isArray(edition.hosts) || edition.hosts.length === 0
      || edition.hosts.some((host) => !host || ![host.venueId, host.nationId, host.cityId, host.regionId].every(id))) {
      throw new Error('invalid completed hosting history or cutoff');
    }
    editions.add(edition.editionId);
  });
  const history: readonly CompletedNationalHosting[] = input.history.filter((edition: CompletedNationalHosting) => edition.kind === policy.kind
    && edition.completedAtDay >= Math.max(0, input.asOfDay - policy.rotation.lookbackDays));
  const candidates = (stage: keyof NationalHostCandidatePolicy['minimums']) => Object.freeze(input.venues.map((venue) => {
    const suitabilityScore = HOST_METRICS.reduce((sum, metric) =>
      sum + venue.metrics[metric] * policy.suitabilityWeights[metric], 0);
    const rotationScore = -history.reduce((penalty, edition) => penalty
      + (edition.hosts.some((host) => host.cityId === venue.cityId) ? policy.rotation.cityPenalty : 0)
      + (edition.hosts.some((host) => host.nationId === venue.nationId) ? policy.rotation.nationPenalty : 0)
      + (edition.hosts.some((host) => host.regionId === venue.region) ? policy.rotation.regionPenalty : 0), 0);
    if (!Number.isFinite(suitabilityScore) || !Number.isFinite(rotationScore)
      || !Number.isFinite(suitabilityScore + rotationScore)) throw new Error('host candidate score overflow');
    return Object.freeze({ venueId: venue.venueId, nationId: venue.nationId,
      cityId: venue.cityId, regionId: venue.region,
      eligible: venue.licensed && venue.safe && HOST_METRICS.every((metric) =>
        venue.metrics[metric] >= policy.minimums[stage][metric]), suitabilityScore, rotationScore });
  }));
  const group = candidates('GROUP');
  const knockout = candidates('KNOCKOUT');
  return Object.freeze({ kind: policy.kind, policyVersion: policy.version,
    groupCandidates: Object.freeze(Array.from({ length: policy.kind === 'WBC' ? 6 : 2 }, () => group)),
    knockoutCandidates: Object.freeze(Array.from({ length: policy.knockoutHubCount }, () => knockout)),
    finalFourCandidates: candidates('FINAL_FOUR') });
};
