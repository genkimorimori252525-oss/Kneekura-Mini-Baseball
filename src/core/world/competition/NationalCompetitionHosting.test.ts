import { expect, it } from 'vitest';
import { selectNationalCompetitionHosts } from './NationalCompetitionHosting';
import type { HostCandidate } from './HostSelection';

const candidate = (venueId: string, nationId = 'US', score = 1): HostCandidate => ({
  venueId, cityId: `city-${venueId}`, nationId,
  regionId: nationId === 'US' ? 'AMERICAS' : 'EUROPE', eligible: true,
  suitabilityScore: score, rotationScore: 0,
});

it('selects six distinct US pool cities, two hubs and one final city without host berths', () => {
  const candidates = [candidate('foreign', 'FR', 100),
    ...Array.from({ length: 6 }, (_, index) => candidate(`us-${index}`, 'US', 10 - index))];
  const input = { kind: 'WBC' as const, policyVersion: 'hosts-v1',
    groupCandidates: Array.from({ length: 6 }, () => candidates),
    knockoutCandidates: [candidates, candidates], finalFourCandidates: candidates };
  const hosts = selectNationalCompetitionHosts(input);
  expect(hosts.groupHosts.map((host) => host.selectedVenueId))
    .toEqual(['us-0', 'us-1', 'us-2', 'us-3', 'us-4', 'us-5']);
  expect(hosts.hostNationIds).toEqual(['US']);
  expect(hosts.knockoutHubs.map((host) => host.selectedVenueId)).toEqual(['us-0', 'us-1']);
  expect(hosts.finalFourHost.selectedVenueId).toBe('us-0');
  expect(hosts.groupHosts[0].evaluations[0].rejectionReason).toBe('WBC_US_ONLY');
  expect(() => selectNationalCompetitionHosts({ ...input,
    groupCandidates: Array.from({ length: 6 }, () => [candidate('only')]) }))
    .toThrow('eligible host');
});

it('keeps Premier Twelve medal hosts inside its one or two group host nations', () => {
  const hosts = selectNationalCompetitionHosts({ kind: 'PREMIER_12', policyVersion: 'hosts-v1',
    groupCandidates: [[candidate('a', 'FR')], [candidate('b', 'DE')]], knockoutCandidates: [],
    finalFourCandidates: [candidate('third-nation', 'IT', 100), candidate('medals', 'FR', 1)] });
  expect(hosts.hostNationIds).toEqual(['FR', 'DE']);
  expect(hosts.finalFourHost.selectedNationId).toBe('FR');
  expect(() => selectNationalCompetitionHosts({ kind: 'PREMIER_12', policyVersion: 'hosts-v1',
    groupCandidates: [[candidate('a', 'FR')]], knockoutCandidates: [],
    finalFourCandidates: [candidate('medals', 'FR')] })).toThrow('national hosting');
});

it('preserves a feasible later pool city when an earlier slot has alternatives', () => {
  const flexible = [candidate('a', 'FR', 10), candidate('b', 'FR', 5)];
  const hosts = selectNationalCompetitionHosts({ kind: 'PREMIER_12', policyVersion: 'hosts-v1',
    groupCandidates: [flexible, [candidate('a', 'FR')]], knockoutCandidates: [],
    finalFourCandidates: [candidate('medals', 'FR')] });
  expect(hosts.groupHosts.map((host) => host.selectedVenueId)).toEqual(['b', 'a']);
  const medalNation = selectNationalCompetitionHosts({ kind: 'PREMIER_12', policyVersion: 'hosts-v1',
    groupCandidates: [[candidate('fr', 'FR', 10), candidate('de', 'DE', 5)], [candidate('it', 'IT')]],
    knockoutCandidates: [], finalFourCandidates: [candidate('medals', 'DE')] });
  expect(medalNation.hostNationIds).toEqual(['DE', 'IT']);
});

it('rejects US candidates assigned outside AMERICAS in every WBC stage', () => {
  const candidates = Array.from({ length: 6 }, (_, index) => candidate(`us-${index}`));
  const input = { kind: 'WBC' as const, policyVersion: 'hosts-v1',
    groupCandidates: Array.from({ length: 6 }, () => candidates),
    knockoutCandidates: [candidates, candidates], finalFourCandidates: candidates };
  const invalid = [{ ...candidate('mis-region', 'US', 100), regionId: 'EUROPE' }];
  for (const changed of [
    { ...input, groupCandidates: [invalid, ...input.groupCandidates.slice(1)] },
    { ...input, knockoutCandidates: [invalid, candidates] },
    { ...input, finalFourCandidates: invalid },
  ]) expect(() => selectNationalCompetitionHosts(changed)).toThrow('US host region must be AMERICAS');
});
