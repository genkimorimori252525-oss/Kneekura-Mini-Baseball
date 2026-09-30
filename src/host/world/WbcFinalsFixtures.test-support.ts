import type { WbcBerthAllocation } from '../../core/world/competition/WbcBerths';
import type { WbcFinalsGroupEdition } from '../../core/world/competition/WbcFinalsGroups';
import type { WbcKnockoutEdition } from '../../core/world/competition/WbcFinalsKnockout';

/** Accepted qualification is a fixture here; Match and tournament persistence are exercised separately. */
export const wbcFinalsInput = (calendarWindow: WbcFinalsGroupEdition['calendarWindow'],
  cutoffSnapshotId: string): Readonly<{ berths: WbcBerthAllocation;
    edition: WbcFinalsGroupEdition; knockoutEdition: WbcKnockoutEdition }> => {
  const nationIds = Array.from({ length: 24 }, (_, index) => `nation-${index}`);
  const berths: WbcBerthAllocation = {
    editionId: 'wbc-2032', cycleId: 'cycle-2032', policyVersion: 'wbc-v1',
    cutoffSnapshotId, qualificationSnapshotId: 'qualified-2032',
    previousWorldEditionIds: ['wbc-2024', 'wbc-2028'],
    directBerthsByRegion: { ASIA_PACIFIC: 5, AMERICAS: 5, EUROPE: 4, AFRICA: 2 },
    coefficientSources: [], regionalPlacementSources: [], entrantNationIds: nationIds, slots: [],
  };
  const edition: WbcFinalsGroupEdition = {
    competitionId: 'wbc', editionId: berths.editionId,
    canonicalRole: 'NATIONAL_WORLD_CHAMPIONSHIP', formatVersion: 'wbc-24-v1',
    ruleProfileVersion: 'wbc-rules-v1', gamePolicyVersion: 'wbc-game-v1',
    hostingPolicyVersion: 'us-six-pools-v1', drawPolicyVersion: 'wbc-draw-v1',
    drawSnapshotId: 'draw-2032', qualificationSnapshotId: berths.qualificationSnapshotId,
    hostNationId: 'US', calendarWindow,
    groupTiebreakPolicy: { version: 'wbc-groups-v1', tieCreditNumerator: 0,
      tieCreditDenominator: 1, runDifferentialCapPerGame: 5 },
    thirdPlacePolicy: { version: 'wbc-third-v1',
      criteria: ['WINS', 'CAPPED_RUN_DIFFERENTIAL', 'RUNS_AGAINST'], drawSeed: 'third-2032' },
    groups: Array.from({ length: 6 }, (_, groupIndex) => ({ groupIndex,
      hostCityId: `us-city-${groupIndex}`, hostVenueId: `us-venue-${groupIndex}`,
      nationIds: nationIds.slice(groupIndex * 4, groupIndex * 4 + 4) })),
  };
  const knockoutEdition: WbcKnockoutEdition = {
    competitionId: edition.competitionId, editionId: edition.editionId,
    canonicalRole: 'NATIONAL_WORLD_CHAMPIONSHIP', qualificationSnapshotId: edition.qualificationSnapshotId,
    groupDrawSnapshotId: edition.drawSnapshotId, ruleProfileVersion: edition.ruleProfileVersion,
    gamePolicyVersion: edition.gamePolicyVersion, knockoutPolicyVersion: 'wbc-knockout-v1',
    hostNationId: 'US', roundOf16Pairs: Array.from({ length: 8 }, (_, index) =>
      [index * 2, index * 2 + 1] as const),
    knockoutHubs: [{ cityId: 'us-hub-a', venueId: 'hub-a' }, { cityId: 'us-hub-b', venueId: 'hub-b' }],
    roundOf16HubIndices: [0, 1, 0, 1, 0, 1, 0, 1], quarterfinalHubIndices: [0, 1, 0, 1],
    finalFourHost: { cityId: 'us-final-city', venueId: 'us-final-venue' },
  };
  return { berths, edition, knockoutEdition };
};
