import { expect, it } from 'vitest';
import { deriveWbcQualifierHostCandidates } from './WbcQualifierHostCandidates';
import type { WorldHostVenueEvent } from './CompetitionHostInfrastructure';

const facility = { stadiumCapacity: 10000, stadiumQuality: 5, transportQuality: 5,
  accommodationCapacity: 2000, broadcastReadiness: 5, operationsQuality: 5 };
const venues: WorldHostVenueEvent[] = [0, 1].map((i) => ({ careerId: 'career-1', venueId: `venue-${i}`,
  nationId: i === 0 ? 'JP' : 'ZA', cityId: `city-${i}`, region: i === 0 ? 'ASIA_PACIFIC' : 'AFRICA',
  effectiveFromDay: 10, sourceEventId: `world-venue-${i}`, sourceClubId: null, licensed: true, safe: true, metrics: facility }));
const policy = { version: 'qualifier-hosts-v1', minimums: facility,
  suitabilityWeights: { stadiumCapacity: 0, stadiumQuality: 1, transportQuality: 0,
    accommodationCapacity: 0, broadcastReadiness: 0, operationsQuality: 0 },
  accessWeights: { geographySuitability: 1, travelCost: 1, neutralAccessibility: 1, developingOpportunity: 1 },
  minimumNeutralAccessibility: 1, maximumTravelCost: 100,
  rotation: { lookbackDays: 100, cityPenalty: 1, nationPenalty: 2, regionPenalty: 3 } };
const history = [{ editionId: 'qualifier-2036', completedAtDay: 380, sourceSnapshotId: 'official-prior-hosts',
  hosts: [{ venueId: 'venue-0', cityId: 'city-0', nationId: 'JP', regionId: 'ASIA_PACIFIC' }] }];
const access = { snapshotId: 'world-access-390', asOfDay: 390, qualifierEditionId: 'qualifier-2040',
  drawSnapshotId: 'mixed-pods-2040', assessments: [0, 1, 2, 3].flatMap((podIndex) => venues.map((venue, index) => ({
    podIndex, venueId: venue.venueId, sourceEventId: `access-${podIndex}-${index}`,
    effectiveFromDay: 390, geographySuitability: 3, travelCost: index === 0 ? 10 : 1,
    neutralAccessibility: 5, developingOpportunity: index === 0 ? 1 : 6 }))) };

it('derives worldwide pod-specific candidates from accepted facilities and all five hosting criteria', () => {
  const result = deriveWbcQualifierHostCandidates({ policy, asOfDay: 390,
    qualifierEditionId: 'qualifier-2040', drawSnapshotId: 'mixed-pods-2040', venues, access, history });
  expect(result.podCandidates).toHaveLength(4);
  expect(result.podCandidates[0].map((candidate) => candidate.suitabilityScore)).toEqual([4, 18]);
  expect(result.podCandidates[0].map((candidate) => candidate.rotationScore)).toEqual([-6, 0]);
  expect(result.podCandidates[0].map((candidate) => candidate.nationId)).toEqual(['JP', 'ZA']);
  expect(result.podCandidates[0].every((candidate) => candidate.eligible)).toBe(true);
  expect(Object.isFrozen(result.podCandidates[0][0])).toBe(true);
  const unsafe = deriveWbcQualifierHostCandidates({ policy, asOfDay: 390,
    qualifierEditionId: 'qualifier-2040', drawSnapshotId: 'mixed-pods-2040',
    venues: venues.map((venue) => ({ ...venue, safe: false })), access, history });
  expect(unsafe.podCandidates.flat().every((candidate) => !candidate.eligible)).toBe(true);
  const inaccessible = deriveWbcQualifierHostCandidates({ policy, asOfDay: 390,
    qualifierEditionId: 'qualifier-2040', drawSnapshotId: 'mixed-pods-2040', venues, history,
    access: { ...access, assessments: access.assessments.map((item) => ({ ...item, neutralAccessibility: 0 })) } });
  expect(inaccessible.podCandidates.flat().every((candidate) => !candidate.eligible)).toBe(true);
});

it('rejects incompatible, future, incomplete or duplicated access evidence and invalid calibration', () => {
  const request = { policy, asOfDay: 390, qualifierEditionId: 'qualifier-2040',
    drawSnapshotId: 'mixed-pods-2040', venues, access, history };
  expect(() => deriveWbcQualifierHostCandidates({ ...request, history: history.map((item) => ({ ...item,
    completedAtDay: 391 })) })).toThrow('history');
  expect(() => deriveWbcQualifierHostCandidates({ ...request, access: { ...access, drawSnapshotId: 'other-pods' } }))
    .toThrow('access');
  expect(() => deriveWbcQualifierHostCandidates({ ...request, access: { ...access, asOfDay: 391 } })).toThrow('cutoff');
  expect(() => deriveWbcQualifierHostCandidates({ ...request, access: { ...access,
    assessments: access.assessments.slice(1) } })).toThrow('complete');
  expect(() => deriveWbcQualifierHostCandidates({ ...request, access: { ...access,
    assessments: [...access.assessments, access.assessments[0]] } })).toThrow('duplicate');
  expect(() => deriveWbcQualifierHostCandidates({ ...request, policy: { ...policy,
    accessWeights: { ...policy.accessWeights, travelCost: -1 } } })).toThrow('policy');
  const zeroFacilityWeights = Object.fromEntries(Object.keys(policy.suitabilityWeights).map((key) => [key, 0])) as typeof policy.suitabilityWeights;
  const inactivePolicy = { ...policy,
    suitabilityWeights: { ...zeroFacilityWeights, unusedWeight: 1 },
    accessWeights: { geographySuitability: 0, travelCost: 0, neutralAccessibility: 0, developingOpportunity: 0 } };
  expect(() => deriveWbcQualifierHostCandidates({ ...request, policy: inactivePolicy }))
    .toThrow('policy');
});
