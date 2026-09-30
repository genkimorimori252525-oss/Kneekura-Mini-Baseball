import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { fnv1a32 } from '../../rng/DeterministicRng';
import { selectCompetitionHost, type HostCandidate, type HostSelection } from './HostSelection';
import { planSelectedWbcGlobalQualifier, type WbcGlobalQualifierEdition } from './WbcGlobalQualifierPods';
import type { WbcQualifierSelection } from './WbcGlobalQualifierSelection';

const REGIONS = ['ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'] as const;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
export type WbcQualifierEditionProfile = Readonly<{
  competitionId: string; formatVersion: string; ruleProfileVersion: string; gamePolicyVersion: string;
  drawPolicyVersion: string; hostingPolicyVersion: string;
  /** Explicit venue policy; separate cities are possible, not an unversioned requirement. */
  distinctPodCities: boolean;
}>;
export type WbcQualifierHostCandidateSnapshot = Readonly<{
  snapshotId: string; asOfDay: number; policyVersion: string;
  podCandidates: readonly (readonly HostCandidate[])[];
}>;
export type WbcQualifierEditionAssemblyInput = Readonly<{
  selection: WbcQualifierSelection; drawSeed: string; profile: WbcQualifierEditionProfile;
  calendarWindow: WbcGlobalQualifierEdition['calendarWindow']; hosts: WbcQualifierHostCandidateSnapshot;
}>;
export type WbcQualifierEditionAssembly = Readonly<{
  edition: WbcGlobalQualifierEdition; hosting: readonly HostSelection[];
  regionMixTarget: number; relaxedRegionMixTargets: readonly number[];
}>;

/** Exact region-count search: prefer four, then three, never fewer than two regions per pod. */
const mixedPods = (selection: WbcQualifierSelection, drawSeed: string) => {
  const buckets = REGIONS.map((region) => selection.entrants.filter((item) => item.region === region)
    .sort((a, b) => fnv1a32(JSON.stringify([drawSeed, a.nationId])) - fnv1a32(JSON.stringify([drawSeed, b.nationId]))
      || (a.nationId < b.nationId ? -1 : 1)));
  const counts = buckets.map((bucket) => bucket.length);
  const relaxed: number[] = [];
  for (const target of [4, 3, 2]) {
    // A region can occur at most once per pod for distinct-region accounting.
    if (counts.reduce((sum, count) => sum + Math.min(4, count), 0) < target * 4) {
      relaxed.push(target); continue;
    }
    const remaining = [...counts], pods: number[][] = [[], [], [], []];
    const failed = new Set<string>();
    const visit = (podIndex: number): boolean => {
      if (podIndex === 4) return remaining.every((count) => count === 0);
      const key = JSON.stringify([podIndex, remaining]);
      if (failed.has(key)) return false;
      const fill = (regionIndex: number, slots: number, mix: number): boolean => {
        if (regionIndex === 4) {
          if (slots !== 0 || mix < target) return false;
          return visit(podIndex + 1);
        }
        // Choose one from each region first; extras are permitted after deterministic relaxation.
        const maximum = Math.min(slots, remaining[regionIndex]);
        const choices = Array.from({ length: maximum + 1 }, (_, count) => count)
          .sort((a, b) => Math.abs(a - 1) - Math.abs(b - 1) || a - b);
        for (const count of choices) {
          if (mix + (count > 0 ? 1 : 0) + 3 - regionIndex < target) continue;
          remaining[regionIndex] -= count;
          pods[podIndex].push(...Array<number>(count).fill(regionIndex));
          if (fill(regionIndex + 1, slots - count, mix + (count > 0 ? 1 : 0))) return true;
          pods[podIndex].splice(pods[podIndex].length - count, count);
          remaining[regionIndex] += count;
        }
        return false;
      };
      if (fill(0, 4, 0)) return true;
      failed.add(key); return false;
    };
    if (visit(0)) {
      const cursors = [0, 0, 0, 0];
      return { target, relaxed, pods: pods.map((pod) => pod.map((regionIndex) => {
        const entrant = buckets[regionIndex][cursors[regionIndex]++];
        return { nationId: entrant.nationId, region: entrant.region };
      }).sort((a, b) => fnv1a32(JSON.stringify([drawSeed, 'pair', a.nationId]))
        - fnv1a32(JSON.stringify([drawSeed, 'pair', b.nationId])) || (a.nationId < b.nationId ? -1 : 1))) };
    }
    relaxed.push(target);
  }
  throw new Error('WBC qualifier selected entrants cannot fill four mixed-region pods');
};

export const assembleWbcQualifierEdition = (raw: WbcQualifierEditionAssemblyInput): WbcQualifierEditionAssembly => {
  const input = cloneInert(raw), { selection, profile, hosts, calendarWindow } = input;
  if (!selection || !id(selection.qualifierEditionId) || !id(selection.qualificationSnapshotId)
    || !id(input.drawSeed) || !profile || ![profile.competitionId, profile.formatVersion,
      profile.ruleProfileVersion, profile.gamePolicyVersion, profile.drawPolicyVersion, profile.hostingPolicyVersion].every(id)
    || typeof profile.distinctPodCities !== 'boolean'
    || !Array.isArray(selection.entrants) || selection.entrants.length !== 16
    || selection.entrants.some((item) => !id(item?.nationId) || !REGIONS.includes(item.region))
    || new Set(selection.entrants.map((item) => item.nationId)).size !== 16
    || new Set(selection.entrants.map((item) => item.region)).size !== 4) {
    throw new Error('invalid WBC qualifier assembly selection or profile');
  }
  if (!day(calendarWindow?.startsOnDay) || !day(calendarWindow.endsOnDay)
    || calendarWindow.endsOnDay < calendarWindow.startsOnDay || !hosts || !id(hosts.snapshotId)
    || !day(hosts.asOfDay) || hosts.asOfDay >= calendarWindow.startsOnDay
    || hosts.policyVersion !== profile.hostingPolicyVersion
    || !Array.isArray(hosts.podCandidates) || hosts.podCandidates.length !== 4
    || hosts.podCandidates.some((candidates) => !Array.isArray(candidates))) {
    throw new Error('WBC qualifier hosting requires matching policy and pre-play cutoff');
  }
  const locations = new Map<string, string>();
  for (const candidates of hosts.podCandidates) {
    // Validate each complete slot before feasibility filtering hides invalid evidence.
    selectCompetitionHost({ competitionKind: 'WBC_GLOBAL_QUALIFIER', policyVersion: hosts.policyVersion, candidates });
    for (const candidate of candidates) {
      const location = JSON.stringify([candidate.nationId, candidate.cityId, candidate.regionId]);
      if (locations.has(candidate.venueId) && locations.get(candidate.venueId) !== location) {
        throw new Error('qualifier host venue has conflicting locations');
      }
      locations.set(candidate.venueId, location);
    }
  }
  const canFill = (index: number, excluded: ReadonlySet<string>): boolean => {
    const assigned = new Map<string, number>();
    const place = (slot: number, visited: Set<string>): boolean => {
      for (const candidate of hosts.podCandidates[slot]) {
        if (!candidate.eligible || excluded.has(candidate.cityId) || visited.has(candidate.cityId)) continue;
        visited.add(candidate.cityId);
        const prior = assigned.get(candidate.cityId);
        if (prior === undefined || place(prior, visited)) { assigned.set(candidate.cityId, slot); return true; }
      }
      return false;
    };
    return hosts.podCandidates.slice(index).every((_, offset) => place(index + offset, new Set()));
  };
  const cities = new Set<string>();
  const hosting = hosts.podCandidates.map((candidates, index) => {
    const host = selectCompetitionHost({ competitionKind: 'WBC_GLOBAL_QUALIFIER', policyVersion: hosts.policyVersion,
      candidates: candidates.map((candidate: HostCandidate) => ({ ...candidate, eligible: candidate.eligible
        && (!profile.distinctPodCities || !cities.has(candidate.cityId)
          && canFill(index + 1, new Set([...cities, candidate.cityId]))) })) });
    cities.add(host.selectedCityId); return host;
  });
  const mixed = mixedPods(selection, input.drawSeed);
  const drawSnapshotId = JSON.stringify(['wbc-qualifier-draw', selection.qualifierEditionId,
    selection.qualificationSnapshotId, profile.drawPolicyVersion, input.drawSeed,
    mixed.target, mixed.pods.map((pod) => pod.map((item) => [item.nationId, item.region]))]);
  const edition: WbcGlobalQualifierEdition = {
    competitionId: profile.competitionId, editionId: selection.qualifierEditionId,
    canonicalRole: 'WBC_GLOBAL_QUALIFIER', formatVersion: profile.formatVersion,
    ruleProfileVersion: profile.ruleProfileVersion, gamePolicyVersion: profile.gamePolicyVersion,
    hostingPolicyVersion: profile.hostingPolicyVersion, qualificationSnapshotId: selection.qualificationSnapshotId,
    drawSnapshotId, calendarWindow, pods: mixed.pods.map((entrants, podIndex) => ({ podIndex, entrants,
      hostNationId: hosting[podIndex].selectedNationId, hostCityId: hosting[podIndex].selectedCityId,
      hostVenueId: hosting[podIndex].selectedVenueId })),
  };
  planSelectedWbcGlobalQualifier(edition, selection);
  return freeze({ edition, hosting, regionMixTarget: mixed.target, relaxedRegionMixTargets: mixed.relaxed });
};
