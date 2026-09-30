import { expect, it } from 'vitest';
import { assembleWbcQualifierEdition, drawWbcQualifierEntrantPods } from './WbcQualifierEditionAssembly';
import type { WbcQualifierSelection } from './WbcGlobalQualifierSelection';
import type { HostCandidate } from './HostSelection';

const regions = ['ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'] as const;
const selection = (counts = [4, 4, 4, 4]): WbcQualifierSelection => ({
  qualifierEditionId: 'qualifier-2040', directSnapshotId: 'direct-2040',
  rankingSnapshotId: 'ranking-390', eligibilitySnapshotId: 'eligibility-390',
  policyVersion: 'selection-v1', qualificationSnapshotId: 'sixteen-2040',
  entrants: regions.flatMap((region, index) => Array.from({ length: counts[index] }, (_, i) => ({
    nationId: `${region}-${i}`, region, route: 'REGIONAL_PRIORITY' as const, sourceId: `placement-${region}` }))),
});
const venue = (i: number): HostCandidate => ({ venueId: `venue-${i}`, nationId: i === 0 ? 'JP' : `host-${i}`,
  cityId: `city-${i}`, regionId: regions[i], eligible: true, suitabilityScore: 10 - i, rotationScore: 0 });
const input = (counts?: number[]) => ({ selection: selection(counts), drawSeed: 'explicit-seed',
  profile: { competitionId: 'global-qualifier', formatVersion: 'four-pods-v1',
    ruleProfileVersion: 'national-rules-v1', gamePolicyVersion: 'national-games-v1',
    drawPolicyVersion: 'mixed-regions-v1', hostingPolicyVersion: 'worldwide-hosts-v1', distinctPodCities: true },
  calendarWindow: { startsOnDay: 391, endsOnDay: 399 },
  hosts: { snapshotId: 'world-hosts-390', asOfDay: 390, policyVersion: 'worldwide-hosts-v1',
    podCandidates: [0, 1, 2, 3].map(() => [0, 1, 2, 3].map(venue)) },
});

it('assembles four mixed-region pods with worldwide hosts and deterministic source identities', () => {
  const request = input();
  const result = assembleWbcQualifierEdition(request);
  expect(result.edition.pods).toHaveLength(4);
  expect(result.edition.pods.every((pod) => new Set(pod.entrants.map((item) => item.region)).size === 4)).toBe(true);
  expect(new Set(result.edition.pods.flatMap((pod) => pod.entrants.map((item) => item.nationId))).size).toBe(16);
  expect(new Set(result.edition.pods.map((pod) => pod.hostCityId)).size).toBe(4);
  expect(result.edition.pods[0].hostNationId).toBe('JP');
  expect(result.regionMixTarget).toBe(4);
  const draw = drawWbcQualifierEntrantPods({ selection: request.selection, drawSeed: request.drawSeed,
    drawPolicyVersion: request.profile.drawPolicyVersion });
  expect(draw.pods).toEqual(result.edition.pods.map((pod) => pod.entrants));
  expect(draw.drawSnapshotId).toBe(result.edition.drawSnapshotId);
  expect(result.relaxedRegionMixTargets).toEqual([]);
  expect(assembleWbcQualifierEdition(request)).toEqual(result);
  expect(assembleWbcQualifierEdition({ ...request, selection: { ...request.selection,
    entrants: [...request.selection.entrants].reverse() } }).edition).toEqual(result.edition);
  expect(Object.isFrozen(result.edition.pods[0].entrants[0])).toBe(true);
  expect(assembleWbcQualifierEdition({ ...request, drawSeed: 'other-seed' }).edition.drawSnapshotId)
    .not.toBe(result.edition.drawSnapshotId);
  expect(() => assembleWbcQualifierEdition({ ...request, hosts: { ...request.hosts, asOfDay: 392 } }))
    .toThrow('cutoff');
});

it('relaxes regional mixing only as far as necessary and rejects impossible distributions', () => {
  const three = assembleWbcQualifierEdition(input([6, 4, 4, 2]));
  expect(three.regionMixTarget).toBe(3);
  expect(three.relaxedRegionMixTargets).toEqual([4]);
  expect(three.edition.pods.every((pod) => new Set(pod.entrants.map((item) => item.region)).size >= 3)).toBe(true);
  const two = assembleWbcQualifierEdition(input([12, 2, 1, 1]));
  expect(two.regionMixTarget).toBe(2);
  expect(two.relaxedRegionMixTargets).toEqual([4, 3]);
  expect(two.edition.pods.every((pod) => new Set(pod.entrants.map((item) => item.region)).size >= 2)).toBe(true);
  expect(() => assembleWbcQualifierEdition(input([13, 1, 1, 1]))).toThrow('mixed-region');
});

it('preserves later host feasibility and rejects contradictory venue location evidence', () => {
  const request = input();
  const result = assembleWbcQualifierEdition({ ...request, hosts: { ...request.hosts,
    podCandidates: [[venue(0), venue(1)], [venue(0)], [venue(2)], [venue(3)]] } });
  expect(result.edition.pods.map((pod) => pod.hostVenueId)).toEqual(['venue-1', 'venue-0', 'venue-2', 'venue-3']);
  expect(() => assembleWbcQualifierEdition({ ...request, hosts: { ...request.hosts,
    podCandidates: [[venue(0)], [venue(0)], [venue(2)], [venue(3)]] } })).toThrow('eligible host');
  expect(assembleWbcQualifierEdition({ ...request, profile: { ...request.profile, distinctPodCities: false },
    hosts: { ...request.hosts, podCandidates: [[venue(0)], [venue(0)], [venue(0)], [venue(0)]] } })
    .edition.pods.map((pod) => pod.hostVenueId)).toEqual(Array(4).fill('venue-0'));
  expect(() => assembleWbcQualifierEdition({ ...request, hosts: { ...request.hosts,
    podCandidates: [[venue(0)], [{ ...venue(0), nationId: 'other' }], [venue(2)], [venue(3)]] } }))
    .toThrow('conflicting');
});
