import type { ClubWorldRegion } from '../../core/world/competition/ClubWorldBerths';
import type { RegionalNationalEdition } from '../../core/world/competition/RegionalNationalGroups';
import type { RegionalNationalKnockoutEdition } from '../../core/world/competition/RegionalNationalKnockout';

export const regionalNationalInput = (region: ClubWorldRegion, groupCount: number,
  calendarWindow: RegionalNationalEdition['calendarWindow']) => {
  const edition: RegionalNationalEdition = { competitionId: `regional-${region}`,
    editionId: `${region}-2031`, region, canonicalRole: 'REGIONAL_NATIONAL_CHAMPIONSHIP',
    formatVersion: `groups-${groupCount}-v1`, ruleProfileVersion: 'national-rules-v1',
    gamePolicyVersion: 'national-games-v1', hostingPolicyVersion: 'regional-hosts-v1',
    qualificationSnapshotId: `eligible-${region}`, drawSnapshotId: `draw-${region}`, calendarWindow,
    tiebreakPolicy: { version: 'groups-v1', tieCreditNumerator: 0, tieCreditDenominator: 1,
      runDifferentialCapPerGame: 5 }, bestThirdPolicy: { version: 'third-v1',
      criteria: ['WINS', 'CAPPED_RUN_DIFFERENTIAL', 'RUNS_AGAINST'], drawSeed: 'third-seed' },
    hostNationIds: [`host-${region}`], groups: Array.from({ length: groupCount }, (_, groupIndex) => ({
      groupIndex, nationIds: [0, 1, 2, 3].map((index) => `${region}-${groupIndex * 4 + index}`),
      hostNationId: `host-${region}`, hostCityId: `${region}-city-${groupIndex}`,
      hostVenueId: `${region}-venue-${groupIndex}` })),
  };
  const count = groupCount === 2 ? 4 : 8;
  const knockoutEdition: RegionalNationalKnockoutEdition = {
    competitionId: edition.competitionId, editionId: edition.editionId, region,
    formatVersion: edition.formatVersion, ruleProfileVersion: edition.ruleProfileVersion,
    gamePolicyVersion: edition.gamePolicyVersion, qualificationSnapshotId: edition.qualificationSnapshotId,
    groupDrawSnapshotId: edition.drawSnapshotId, knockoutPolicyVersion: 'regional-knockout-v1',
    openingPairs: Array.from({ length: count / 2 }, (_, index) => [index * 2, index * 2 + 1] as const),
    openingVenueIds: Array.from({ length: count / 2 }, (_, index) => `${region}-knockout-${index}`),
    semifinalVenueIds: [`${region}-semi-0`, `${region}-semi-1`], finalVenueId: `${region}-final`,
    placementPolicy: { version: 'placement-v1',
      criteria: ['GROUP_WINS', 'GROUP_RUN_DIFFERENTIAL', 'GROUP_RUNS_AGAINST'], drawSeed: 'placement-seed' },
  };
  return { edition, knockoutEdition };
};
