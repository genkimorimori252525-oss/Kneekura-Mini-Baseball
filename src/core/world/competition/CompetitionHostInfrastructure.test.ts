import { expect, it } from 'vitest';
import { deriveNationalHostCandidates, snapshotNationalHostCandidatePolicy,
  type WorldHostVenueEvent } from './CompetitionHostInfrastructure';

const metrics = { stadiumCapacity: 10000, stadiumQuality: 50, transportQuality: 40,
  accommodationCapacity: 300, broadcastReadiness: 50, operationsQuality: 50 };
const minimums = { ...metrics, stadiumQuality: 40 };
const policy = { version: 'host-calibration-test-v1', kind: 'PREMIER_12' as const, knockoutHubCount: 0,
  minimums: { GROUP: minimums, KNOCKOUT: minimums, FINAL_FOUR: minimums },
  suitabilityWeights: { stadiumCapacity: 0, stadiumQuality: 1, transportQuality: 1,
    accommodationCapacity: 0, broadcastReadiness: 1, operationsQuality: 1 },
  rotation: { lookbackDays: 50, cityPenalty: 10, nationPenalty: 2, regionPenalty: 1 } };
const venue: WorldHostVenueEvent = { careerId: 'career-1', venueId: 'venue-a', nationId: 'FR',
  cityId: 'city-a', region: 'EUROPE', effectiveFromDay: 0, sourceEventId: 'infra-a', sourceClubId: null,
  licensed: true, safe: true, metrics };

it('projects facility eligibility and competition-specific recent hosting without ability inputs', () => {
  const host = { venueId: venue.venueId, nationId: venue.nationId, cityId: venue.cityId, regionId: venue.region };
  const input = { policy, asOfDay: 100, venues: [venue, { ...venue, venueId: 'unsafe', safe: false },
    { ...venue, venueId: 'small', metrics: { ...metrics, stadiumCapacity: 9999 } }],
    history: [{ editionId: 'old-premier', kind: 'PREMIER_12' as const, completedAtDay: 80,
      sourceSnapshotId: 'old-hosting', hosts: [host, host] },
    { editionId: 'too-old', kind: 'PREMIER_12' as const, completedAtDay: 49,
      sourceSnapshotId: 'old-hosting-2', hosts: [host] },
    { editionId: 'different-competition', kind: 'WBC' as const, completedAtDay: 80,
      sourceSnapshotId: 'old-hosting-3', hosts: [host] }] };
  const result = deriveNationalHostCandidates(input);
  expect(result.groupCandidates[0].map((candidate) => candidate.eligible)).toEqual([true, false, false]);
  expect(result.groupCandidates[0][0]).toMatchObject({ suitabilityScore: 190, rotationScore: -13 });
  expect(result.groupCandidates).toHaveLength(2);
  expect(result.knockoutCandidates).toHaveLength(0);
  expect(venue.metrics.stadiumQuality).toBe(50);
});

it('rejects invalid calibration and future infrastructure/history at a historical cutoff', () => {
  expect(() => snapshotNationalHostCandidatePolicy({ ...policy,
    rotation: { ...policy.rotation, cityPenalty: -1 } })).toThrow('host candidate policy');
  expect(() => deriveNationalHostCandidates({ policy, asOfDay: 100,
    venues: [{ ...venue, effectiveFromDay: 101 }], history: [] })).toThrow('cutoff');
  expect(() => deriveNationalHostCandidates({ policy, asOfDay: 100, venues: [venue], history: [{
    editionId: 'future', kind: 'PREMIER_12', completedAtDay: 101, sourceSnapshotId: 'future-source', hosts: [],
  }] })).toThrow('cutoff');
});
