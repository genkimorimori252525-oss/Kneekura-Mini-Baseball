import { expect, it } from 'vitest';
import * as hosting from './RegionalNationalHosting';
import type { WorldHostVenueEvent } from './CompetitionHostInfrastructure';

const metrics = { stadiumCapacity: 100, stadiumQuality: 10, transportQuality: 10,
  accommodationCapacity: 100, broadcastReadiness: 10, operationsQuality: 10 };
const venue = (venueId: string, nationId: string, score: number,
  changes: Partial<WorldHostVenueEvent> = {}): WorldHostVenueEvent => ({ careerId: 'career-a',
  venueId, nationId, cityId: `city-${venueId}`, region: 'EUROPE', effectiveFromDay: 10,
  sourceEventId: `opened-${venueId}`, sourceClubId: null, licensed: true, safe: true,
  metrics: { ...metrics, stadiumQuality: score }, ...changes });
const policy = { version: 'regional-host-fixture-v1', hostNationCount: 1 as const,
  groupHostVenueCount: 2, knockoutHubCount: 1,
  minimums: { GROUP: metrics, KNOCKOUT: { ...metrics, broadcastReadiness: 20 },
    FINAL_FOUR: { ...metrics, broadcastReadiness: 30 } },
  suitabilityWeights: { ...metrics, stadiumCapacity: 0, stadiumQuality: 1, transportQuality: 0,
    accommodationCapacity: 0, broadcastReadiness: 0, operationsQuality: 0 },
  rotation: { lookbackDays: 100, cityPenalty: 20, nationPenalty: 5, regionPenalty: 1 } };

it('uses regional logistics and final-stage feasibility before selecting a public host without a Full League', () => {
  expect(hosting).toHaveProperty('deriveRegionalNationalHostCandidates');
  const venues = [venue('A-best', 'A', 100), venue('A-second', 'A', 90),
    venue('B-main', 'B', 50, { metrics: { ...metrics, stadiumQuality: 50, broadcastReadiness: 30 } }),
    venue('B-other', 'B', 40), venue('foreign', 'F', 1000),
    venue('unsafe', 'B', 1000, { safe: false }),
    venue('poor-logistics', 'B', 1000, { metrics: { ...metrics, stadiumQuality: 1000, transportQuality: 0 } })];
  const input = { region: 'EUROPE' as const, asOfDay: 100, policy, venues, history: [],
    nationRegions: [{ nationId: 'A', region: 'EUROPE' as const }, { nationId: 'B', region: 'EUROPE' as const },
      { nationId: 'F', region: 'AMERICAS' as const }] };
  const candidates = hosting.deriveRegionalNationalHostCandidates(input);
  expect(candidates.groupCandidates.filter((item) => item.eligible).map((item) => item.venueId))
    .toEqual(['A-best', 'A-second', 'B-main', 'B-other']);
  const selected = hosting.selectRegionalNationalHosts(candidates);
  expect(selected.hostNationIds).toEqual(['B']);
  expect(selected.groupHosts.map((item) => item.selectedVenueId)).toEqual(['B-main', 'B-other']);
  expect(selected.knockoutHubs[0].selectedVenueId).toBe('B-main');
  expect(selected.finalFourHost.selectedVenueId).toBe('B-main');
  expect(selected.groupHosts[0].evaluations.find((item) => item.venueId === 'A-best')?.rejectionReason).toBeNull();
  expect(hosting.selectRegionalNationalHosts(hosting.deriveRegionalNationalHostCandidates({ ...input, venues: [...venues].reverse() }))
    .groupHosts.map((item) => item.selectedVenueId)).toEqual(['B-main', 'B-other']);
  expect(() => hosting.deriveRegionalNationalHostCandidates({ ...input, venues: [venue('future', 'B', 10, { effectiveFromDay: 101 })] }))
    .toThrow('cutoff');
  expect(() => hosting.selectRegionalNationalHosts({ ...candidates, finalFourCandidates: [] })).toThrow('eligible regional host');
  for (const changed of [{ cityId: 'foreign-city' }, { nationId: 'A' }, { regionId: 'AMERICAS' }]) {
    expect(() => hosting.selectRegionalNationalHosts({ ...candidates,
      knockoutCandidates: candidates.knockoutCandidates.map((item) => item.venueId === 'B-main' ? { ...item, ...changed } : item) }))
      .toThrow('conflicting locations');
  }
});

it('requires both cohost nations and applies only prior regional rotation without fabricating a berth', () => {
  expect(hosting).toHaveProperty('deriveRegionalNationalHostCandidates');
  const venues = [venue('A-one', 'A', 50, { metrics: { ...metrics, stadiumQuality: 50, broadcastReadiness: 30 } }),
    venue('A-two', 'A', 40), venue('B-one', 'B', 30, { metrics: { ...metrics, stadiumQuality: 30, broadcastReadiness: 30 } }),
    venue('B-two', 'B', 20), venue('C-one', 'C', 25, { metrics: { ...metrics, stadiumQuality: 25, broadcastReadiness: 30 } }),
    venue('C-two', 'C', 15)];
  const input = { region: 'EUROPE' as const, asOfDay: 100, policy, venues, history: [],
    nationRegions: ['A', 'B', 'C'].map((nationId) => ({ nationId, region: 'EUROPE' as const })) };
  const cohosts = hosting.selectRegionalNationalHosts(hosting.deriveRegionalNationalHostCandidates({ ...input,
    policy: { ...policy, hostNationCount: 2 } }));
  expect(cohosts.hostNationIds).toEqual(['A', 'B']);
  expect(cohosts.groupHosts.map((item) => item.selectedVenueId)).toEqual(['A-one', 'B-one']);
  const history = [{ editionId: 'old-eu', region: 'EUROPE' as const, completedAtDay: 80,
    sourceSnapshotId: 'old-host-proof', hosts: venues.slice(0, 2).map((item) => ({ venueId: item.venueId,
      nationId: item.nationId, cityId: item.cityId, regionId: 'EUROPE' })) }];
  const rotated = hosting.selectRegionalNationalHosts(hosting.deriveRegionalNationalHostCandidates({ ...input, history,
    policy: { ...policy, rotation: { ...policy.rotation, nationPenalty: 100 } } }));
  expect(rotated.hostNationIds).toEqual(['B']);
  expect(() => hosting.deriveRegionalNationalHostCandidates({ ...input, history: [{ ...history[0], completedAtDay: 101 }] }))
    .toThrow('hosting history');
  expect(() => hosting.deriveRegionalNationalHostCandidates({ ...input, policy: { ...policy, hostNationCount: 2, groupHostVenueCount: 1 } }))
    .toThrow('policy');
});
