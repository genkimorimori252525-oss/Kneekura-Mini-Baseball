import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { HOST_METRICS, assertWorldHostVenueEvent, type HostInfrastructureMetrics,
  type WorldHostVenueEvent } from './CompetitionHostInfrastructure';
import type { WbcQualifierHostCandidateSnapshot } from './WbcQualifierEditionAssembly';

export const QUALIFIER_ACCESS_METRICS = ['geographySuitability', 'travelCost', 'neutralAccessibility', 'developingOpportunity'] as const;
export type QualifierHostAccessMetrics = Readonly<Record<typeof QUALIFIER_ACCESS_METRICS[number], number>>;
export type QualifierHostAccessAssessment = QualifierHostAccessMetrics & Readonly<{
  podIndex: number; venueId: string; sourceEventId: string; effectiveFromDay: number;
}>;
export type WbcQualifierHostAccessSnapshot = Readonly<{
  snapshotId: string; qualifierEditionId: string; drawSnapshotId: string; asOfDay: number;
  assessments: readonly QualifierHostAccessAssessment[];
}>;
export type WbcQualifierHostCandidatePolicy = Readonly<{
  version: string; minimums: HostInfrastructureMetrics; suitabilityWeights: HostInfrastructureMetrics;
  accessWeights: QualifierHostAccessMetrics; minimumNeutralAccessibility: number; maximumTravelCost: number;
  rotation: Readonly<{ lookbackDays: number; cityPenalty: number; nationPenalty: number; regionPenalty: number }>;
}>;
export type CompletedQualifierHosting = Readonly<{
  editionId: string; completedAtDay: number; sourceSnapshotId: string;
  hosts: readonly Readonly<{ venueId: string; cityId: string; nationId: string; regionId: string }>[];
}>;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const day = (value: unknown): value is number => nonnegative(value) && Number.isSafeInteger(value);
const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
export const snapshotWbcQualifierHostCandidatePolicy = (raw: WbcQualifierHostCandidatePolicy): WbcQualifierHostCandidatePolicy => {
  const policy = cloneInert(raw);
  if (!policy || !id(policy.version) || !policy.minimums || !policy.suitabilityWeights || !policy.accessWeights
    || !HOST_METRICS.every((metric) => nonnegative(policy.minimums[metric]) && nonnegative(policy.suitabilityWeights[metric]))
    || !QUALIFIER_ACCESS_METRICS.every((metric) => nonnegative(policy.accessWeights[metric]))
    || !nonnegative(policy.minimumNeutralAccessibility) || !nonnegative(policy.maximumTravelCost)
    || !policy.rotation || !day(policy.rotation.lookbackDays)
    || ![policy.rotation.cityPenalty, policy.rotation.nationPenalty, policy.rotation.regionPenalty].every(nonnegative)
    || !(HOST_METRICS.some((metric) => policy.suitabilityWeights[metric] > 0)
      || QUALIFIER_ACCESS_METRICS.some((metric) => policy.accessWeights[metric] > 0))) {
    throw new Error('invalid versioned qualifier host candidate policy');
  }
  return freeze(policy);
};

/** Organizer evaluation only: calibrated access facts do not modify Match abilities. */
export const deriveWbcQualifierHostCandidates = (raw: Readonly<{
  policy: WbcQualifierHostCandidatePolicy; asOfDay: number; qualifierEditionId: string; drawSnapshotId: string;
  venues: readonly WorldHostVenueEvent[]; access: WbcQualifierHostAccessSnapshot;
  history: readonly CompletedQualifierHosting[];
}>): Omit<WbcQualifierHostCandidateSnapshot, 'snapshotId'> => {
  const input = cloneInert(raw), policy = snapshotWbcQualifierHostCandidatePolicy(input.policy);
  const { access } = input;
  if (!day(input.asOfDay) || !id(input.qualifierEditionId) || !id(input.drawSnapshotId)
    || !access || !id(access.snapshotId) || !day(access.asOfDay) || access.asOfDay !== input.asOfDay) {
    throw new Error('qualifier host access requires matching cutoff');
  }
  if (access.qualifierEditionId !== input.qualifierEditionId || access.drawSnapshotId !== input.drawSnapshotId
    || !Array.isArray(access.assessments) || !Array.isArray(input.venues)) {
    throw new Error('qualifier host access differs from accepted draw');
  }
  const historicalIds = new Set<string>();
  if (!Array.isArray(input.history)) throw new Error('qualifier hosting history must be supplied');
  for (const edition of input.history) {
    if (!edition || !id(edition.editionId) || edition.editionId === input.qualifierEditionId
      || historicalIds.has(edition.editionId) || !id(edition.sourceSnapshotId) || !day(edition.completedAtDay)
      || edition.completedAtDay > input.asOfDay || !Array.isArray(edition.hosts) || edition.hosts.length === 0
      || edition.hosts.some((host: CompletedQualifierHosting['hosts'][number]) =>
        !host || ![host.venueId, host.cityId, host.nationId, host.regionId].every(id))) {
      throw new Error('invalid completed qualifier hosting history');
    }
    historicalIds.add(edition.editionId);
  }
  const history: readonly CompletedQualifierHosting[] = input.history.filter((edition: CompletedQualifierHosting) =>
    edition.completedAtDay >= Math.max(0, input.asOfDay - policy.rotation.lookbackDays));
  const venues = new Map<string, WorldHostVenueEvent>();
  for (const venue of input.venues) {
    assertWorldHostVenueEvent(venue);
    if (venue.effectiveFromDay > input.asOfDay || venues.has(venue.venueId)) throw new Error('invalid qualifier host facility cutoff');
    venues.set(venue.venueId, venue);
  }
  const assessments = new Map<string, QualifierHostAccessAssessment>(), eventIds = new Set<string>();
  for (const assessment of access.assessments) {
    if (!assessment || !day(assessment.podIndex) || assessment.podIndex > 3 || !id(assessment.sourceEventId)
      || !day(assessment.effectiveFromDay) || assessment.effectiveFromDay > input.asOfDay
      || !venues.has(assessment.venueId) || !QUALIFIER_ACCESS_METRICS.every((metric) => nonnegative(assessment[metric]))) {
      throw new Error('invalid qualifier host access assessment');
    }
    const key = JSON.stringify([assessment.podIndex, assessment.venueId]);
    if (assessments.has(key) || eventIds.has(assessment.sourceEventId)) throw new Error('duplicate qualifier host access assessment');
    assessments.set(key, assessment); eventIds.add(assessment.sourceEventId);
  }
  if (assessments.size !== venues.size * 4) throw new Error('qualifier host access evidence must be complete for all pod venues');
  const podCandidates = [0, 1, 2, 3].map((podIndex) => [...venues.values()].map((venue) => {
    const assessment = assessments.get(JSON.stringify([podIndex, venue.venueId]))!;
    const suitabilityScore = HOST_METRICS.reduce((sum, metric) => sum + venue.metrics[metric] * policy.suitabilityWeights[metric], 0)
      + QUALIFIER_ACCESS_METRICS.reduce((sum, metric) => sum + assessment[metric] * policy.accessWeights[metric]
        * (metric === 'travelCost' ? -1 : 1), 0);
    const rotationPenalty = history.reduce((penalty, edition) => penalty
      + (edition.hosts.some((host) => host.cityId === venue.cityId) ? policy.rotation.cityPenalty : 0)
      + (edition.hosts.some((host) => host.nationId === venue.nationId) ? policy.rotation.nationPenalty : 0)
      + (edition.hosts.some((host) => host.regionId === venue.region) ? policy.rotation.regionPenalty : 0), 0);
    const rotationScore = rotationPenalty === 0 ? 0 : -rotationPenalty;
    if (!Number.isFinite(suitabilityScore) || !Number.isFinite(rotationScore)
      || !Number.isFinite(suitabilityScore + rotationScore)) throw new Error('qualifier host candidate score overflow');
    return { venueId: venue.venueId, cityId: venue.cityId, nationId: venue.nationId, regionId: venue.region,
      eligible: venue.licensed && venue.safe && HOST_METRICS.every((metric) => venue.metrics[metric] >= policy.minimums[metric])
        && assessment.neutralAccessibility >= policy.minimumNeutralAccessibility && assessment.travelCost <= policy.maximumTravelCost,
      suitabilityScore, rotationScore };
  }));
  return freeze({ policyVersion: policy.version, asOfDay: input.asOfDay, podCandidates });
};
