import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { expect, it } from 'vitest';
import type { ClubWorldRegion } from
  '../../core/world/competition/ClubWorldBerths';
import { EMPTY_WBC_BERTH_POLICY_REGISTRY,
  registerWbcBerthPolicy, type WbcBerthInput } from
  '../../core/world/competition/WbcBerths';
import { openSqliteWbcDirectBerthStore } from
  './SqliteWbcDirectBerthStore';
import { openSqliteWbcBerthStore } from './SqliteWbcBerthStore';
import { openSqliteWbcFinalsGroupStore } from
  './SqliteWbcFinalsGroupStore';
import type { WbcFinalsGroupEdition } from
  '../../core/world/competition/WbcFinalsGroups';
import { openSqliteWbcQualifierSelectionStore } from
  './SqliteWbcQualifierSelectionStore';
import { EMPTY_WBC_QUALIFIER_SELECTION_POLICY_REGISTRY,
  registerWbcQualifierSelectionPolicy } from
  '../../core/world/competition/WbcGlobalQualifierSelection';

const { DatabaseSync }: typeof import('node:sqlite') =
  createRequire(import.meta.url)('node:sqlite');
const regions: readonly ClubWorldRegion[] = [
  'ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
const policy = { version: 'wbc-berths-v1',
  performanceMethod: 'DIVISOR_WITH_TWO_EXTRA_CAP' as const };
const input: WbcBerthInput = {
  editionId: 'wbc-2032', cycleId: 'cycle-2031',
  previousWorldEditionIds: ['wbc-2024', 'wbc-2028'],
  previousRegionalEditionIds: {
    ASIA_PACIFIC: 'regional-ap-2031',
    AMERICAS: 'regional-am-2031',
    EUROPE: 'regional-eu-2031', AFRICA: 'regional-af-2031',
  },
  qualifierEditionId: 'qualifier-2032',
  cutoffSnapshotId: 'cutoff-2032',
  coefficientPolicyVersion: 'wbc-regional-results-v1',
  policy,
  policyRegistry: registerWbcBerthPolicy(
    EMPTY_WBC_BERTH_POLICY_REGISTRY, policy),
};

it('freezes twenty WBC direct slots from regional titles and coefficients', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-wbc-direct-'));
  const path = join(directory, 'world.sqlite');
  let changed = false;
  const sources = {
    editionCutoff: () => ({ snapshotId: 'cutoff-2032', day: 100 }),
    coefficients: { authority: () => ({
      regionalCoefficient: (region: ClubWorldRegion) => ({ region,
        snapshotId: `coefficient-${region}`,
        policyVersion: 'wbc-regional-results-v1',
        previousWorldEditionIds: ['wbc-2024', 'wbc-2028'],
        completedAtDay: changed ? 101 : 60,
        score: { ASIA_PACIFIC: 100, AMERICAS: 80,
          EUROPE: 40, AFRICA: 20 }[region],
        evidenceResultIds: [`wbc-${region}-2024`,
          `wbc-${region}-2028`] }),
    }) },
    regional: { regionalAuthority: () => ({
      regionalChampionship: (region: ClubWorldRegion) => ({ region,
        editionId: input.previousRegionalEditionIds[region],
        snapshotId: `placement-${region}`,
        completedAtDay: 70,
        orderedNationIds: Array.from({ length: 12 }, (_, index) =>
          `${region}-${index}`),
      }),
    }) },
    nations: { authority: () => ({
      nationCompetitionRegion: (nationId: string) =>
        regions.find((region) => nationId.startsWith(`${region}-`))
        ?? null,
    }) },
  };
  try {
    const store = openSqliteWbcDirectBerthStore(path, sources);
    const direct = store.initialize({ careerId: 'career-1', input });
    expect(direct.entrantNationIds).toHaveLength(20);
    expect(direct.placements).toHaveLength(4);
    expect(store.initialize({ careerId: 'career-1', input }))
      .toEqual(direct);
    const selectionPolicy = { version: 'qualifier-selection-v1',
      regionalPriorityPerRegion: 1,
      rankingPolicyVersion: 'national-ranking-v1' };
    let rankingChanged = false;
    const selectionSources = { direct: store,
      ranking: { readRanking: () => ({ snapshotId:
        rankingChanged ? 'ranking-changed' : 'ranking-90',
        policyVersion: 'national-ranking-v1',
        asOfDay: rankingChanged ? 91 : 90,
        orderedNationIds: regions.flatMap((region) =>
          Array.from({ length: 12 }, (_, index) =>
            `${region}-${index}`)),
        evidenceResultIds: ['official-national-1'] }) },
      nations: sources.nations };
    const selectionStore = openSqliteWbcQualifierSelectionStore(path,
      selectionSources);
    const selectionRequest = { careerId: 'career-1',
      wbcEditionId: input.editionId,
      qualifierEditionId: input.qualifierEditionId,
      rankingAsOfDay: 90,
      eligibility: { snapshotId: 'eligible-90', asOfDay: 90,
        eligibleNationIds: regions.flatMap((region) =>
          Array.from({ length: 12 }, (_, index) =>
            `${region}-${index}`)) },
      policy: selectionPolicy,
      registry: registerWbcQualifierSelectionPolicy(
        EMPTY_WBC_QUALIFIER_SELECTION_POLICY_REGISTRY,
        selectionPolicy) };
    const selection = selectionStore.initialize(selectionRequest);
    expect(selection.entrants).toHaveLength(16);
    expect(selection.entrants.every((entrant) =>
      !direct.entrantNationIds.includes(entrant.nationId)))
      .toBe(true);
    let winnersAvailable = false;
    const berthSources = { ...sources, direct: store,
      qualifiers: { qualifierAuthority: () => ({
        qualifierPodWinner: (podIndex: number) => {
          const entrant = selection.entrants[podIndex];
          return winnersAvailable && entrant ? {
            podIndex, qualifierEditionId: input.qualifierEditionId,
            nationId: entrant.nationId, region: entrant.region,
            officialFinalApplicationId: `qualifier-final-${podIndex}`,
            finalizedDay: 95 } : null;
        },
      }) } };
    const berths = openSqliteWbcBerthStore(path, berthSources);
    expect(() => berths.initialize({ careerId: 'career-1', input }))
      .toThrow('Global Qualifier');
    winnersAvailable = true;
    const allocation = berths.initialize({ careerId: 'career-1', input });
    expect(allocation.entrantNationIds).toHaveLength(24);
    expect(allocation.entrantNationIds.slice(0, 20))
      .toEqual(direct.entrantNationIds);
    expect(allocation.slots.slice(20).map((slot) => slot.nationId))
      .toEqual(selection.entrants.slice(0, 4).map((entrant) =>
        entrant.nationId));
    expect(berths.initialize({ careerId: 'career-1', input }))
      .toEqual(allocation);
    const groupEdition: WbcFinalsGroupEdition = {
      competitionId: 'wbc', editionId: input.editionId,
      canonicalRole: 'NATIONAL_WORLD_CHAMPIONSHIP',
      formatVersion: 'wbc-24-v1', ruleProfileVersion: 'wbc-rules-v1',
      gamePolicyVersion: 'wbc-game-v1',
      hostingPolicyVersion: 'us-six-pools-v1',
      drawPolicyVersion: 'wbc-draw-v1', drawSnapshotId: 'draw-2032',
      qualificationSnapshotId: allocation.qualificationSnapshotId,
      hostNationId: 'US',
      calendarWindow: { startsOnDay: 110, endsOnDay: 140 },
      groupTiebreakPolicy: { version: 'wbc-groups-v1',
        tieCreditNumerator: 0, tieCreditDenominator: 1,
        runDifferentialCapPerGame: 5 },
      thirdPlacePolicy: { version: 'wbc-third-v1',
        criteria: ['WINS', 'CAPPED_RUN_DIFFERENTIAL', 'RUNS_AGAINST'],
        drawSeed: 'third-place-2032' },
      groups: Array.from({ length: 6 }, (_, groupIndex) => ({ groupIndex,
        hostCityId: `us-city-${groupIndex}`,
        hostVenueId: `us-venue-${groupIndex}`,
        nationIds: allocation.entrantNationIds.slice(groupIndex * 4,
          groupIndex * 4 + 4) })),
    };
    const groups = openSqliteWbcFinalsGroupStore(path, { berths,
      matches: { getMatch: () => null, getOfficialFixture: () => null } });
    expect(groups.initialize({ careerId: 'career-1', edition: groupEdition })
      .groups.flatMap((group) => group.nationIds))
      .toEqual(allocation.entrantNationIds);
    groups.close();
    berths.close();
    const reopenedBerths = openSqliteWbcBerthStore(path, berthSources);
    expect(reopenedBerths.readAllocation('career-1', input.editionId))
      .toEqual(allocation);
    winnersAvailable = false;
    expect(() => reopenedBerths.readAllocation('career-1', input.editionId))
      .toThrow('corrupt WBC berth allocation');
    winnersAvailable = true;
    reopenedBerths.close();
    const berthDatabase = new DatabaseSync(path);
    berthDatabase.prepare(`UPDATE world_wbc_berths
      SET allocation_json='{}' WHERE career_id='career-1'`).run();
    berthDatabase.close();
    const tamperedBerths = openSqliteWbcBerthStore(path, berthSources);
    expect(() => tamperedBerths.readAllocation('career-1', input.editionId))
      .toThrow('corrupt WBC berth allocation');
    tamperedBerths.close();
    expect(() => selectionStore.initialize({ ...selectionRequest,
      eligibility: { ...selectionRequest.eligibility,
        snapshotId: 'changed' } })).toThrow('frozen differently');
    selectionStore.close();
    const reopenedSelection = openSqliteWbcQualifierSelectionStore(path,
      selectionSources);
    expect(reopenedSelection.readSelection('career-1',
      input.qualifierEditionId)).toEqual(selection);
    expect(reopenedSelection.readRequest('career-1', input.qualifierEditionId)).toEqual(selectionRequest);
    expect(Object.isFrozen(reopenedSelection.readRequest('career-1', input.qualifierEditionId)!.eligibility)).toBe(true);
    rankingChanged = true;
    expect(() => reopenedSelection.readSelection('career-1',
      input.qualifierEditionId))
      .toThrow('corrupt WBC qualifier selection');
    expect(() => reopenedSelection.readRequest('career-1', input.qualifierEditionId)).toThrow('corrupt');
    rankingChanged = false;
    reopenedSelection.close();
    store.close();
    const selectionDatabase = new DatabaseSync(path);
    selectionDatabase.prepare(`UPDATE world_wbc_qualifier_selections
      SET selection_json='{}' WHERE career_id='career-1'`).run();
    selectionDatabase.close();
    const tamperedSelection = openSqliteWbcQualifierSelectionStore(path,
      { ...selectionSources, direct: {
        readDirect: () => direct } });
    expect(() => tamperedSelection.readSelection('career-1',
      input.qualifierEditionId))
      .toThrow('corrupt WBC qualifier selection');
    tamperedSelection.close();
    const reopened = openSqliteWbcDirectBerthStore(path, sources);
    expect(reopened.readDirect('career-1', input.editionId))
      .toEqual(direct);
    changed = true;
    expect(() => reopened.readDirect('career-1', input.editionId))
      .toThrow('corrupt WBC direct berths');
    changed = false;
    reopened.close();
    const database = new DatabaseSync(path);
    database.prepare(`UPDATE world_wbc_direct_berths
      SET direct_json='{}' WHERE career_id='career-1'`).run();
    database.close();
    const tampered = openSqliteWbcDirectBerthStore(path, sources);
    expect(() => tampered.readDirect('career-1', input.editionId))
      .toThrow('corrupt WBC direct berths');
    tampered.close();
  } finally {
    const root = realpathSync(tmpdir());
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-wbc-direct-')) {
      throw new Error('test cleanup target escaped its temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});
