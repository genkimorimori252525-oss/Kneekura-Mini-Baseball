import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { EMPTY_WBC_BERTH_POLICY_REGISTRY, registerWbcBerthPolicy } from '../../core/world/competition/WbcBerths';
import type { WbcRegionalPlacement } from '../../core/world/competition/WbcBerths';
import { EMPTY_WBC_REGIONAL_COEFFICIENT_POLICY_REGISTRY, registerWbcRegionalCoefficientPolicy } from
  '../../core/world/competition/WbcRegionalCoefficients';
import type { OfficialWbcWorldEdition } from '../../core/world/competition/WbcRegionalCoefficients';
import { openSqliteWbcWorldQualificationStore } from './SqliteWbcWorldQualificationStore';
import { openSqliteWorldCompetitionCycleStore } from './SqliteWorldCompetitionCycleStore';
import { openSqliteNationalCompetitionSelectionStore } from './SqliteNationalCompetitionSelectionStore';
import { openSqliteNationCompetitionRegionStore } from './SqliteNationCompetitionRegionStore';
import { worldCycleInput } from './WorldCompetitionCycleFixtures.test-support';

const regions = ['ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'] as const;
const coefficientPolicy = { version: 'explicit-coefficients-v1', olderEditionMultiplier: 1,
  newerEditionMultiplier: 2, bestNationsPerRegion: 3,
  winPoints: { GROUP: 1, ROUND_OF_16: 2, QUARTERFINAL: 3, SEMIFINAL: 4, FINAL: 5 } };
const berthPolicy = { version: 'wbc-direct-v1', performanceMethod: 'DIVISOR_WITH_TWO_EXTRA_CAP' as const };

it('derives and pins World predecessor and current regional sources before initializing twenty direct berths', () => {
  const directory = mkdtempSync(join(tmpdir(), 'world-wbc-qualification-'));
  const path = join(directory, 'world.sqlite');
  const cycle = openSqliteWorldCompetitionCycleStore(path);
  const selections = openSqliteNationalCompetitionSelectionStore(path, { cycle });
  const nations = openSqliteNationCompetitionRegionStore(path);
  const historical = new Map<string, OfficialWbcWorldEdition>();
  const placements = new Map<string, WbcRegionalPlacement>();
  let futureReads = 0, wrongRegionSource = false, changedPastSource = false, changedWorldPolicy = false;
  let interruptDirectInitialization = false, nationAuthorityReads = 0;
  const sources = { selections: { readSelection: selections.readSelection,
    readWbcPredecessors: (careerId: string, ordinal: number) => selections.readWbcPredecessors(careerId, ordinal)
      .map((past) => changedWorldPolicy ? { ...past, calendarPolicyVersion: 'other-accepted-world-policy' } : past) },
    nations: { authority: (careerId: string) => {
      if (interruptDirectInitialization && ++nationAuthorityReads === 2) {
        throw new Error('interrupted after coefficient initialization');
      }
      return nations.authority(careerId);
    } },
    history: { readEdition: (_careerId: string, editionId: string) => {
      if (editionId === 'wbc-2040' || editionId === 'wbc-2044') {
        futureReads++; throw new Error('later WBC depends on current qualification');
      }
      const saved = historical.get(editionId);
      return saved ? { ...saved, snapshotId: changedPastSource ? `fork-${saved.snapshotId}` : saved.snapshotId } : null;
    } },
    regional: { regionalAuthority: () => ({ regionalChampionship: (region: typeof regions[number], beforeDay: number) => {
      const placement = placements.get(region);
      return placement && placement.completedAtDay <= beforeDay ? { ...placement,
        editionId: wrongRegionSource ? 'regional-old-europe' : placement.editionId } : null;
    } }) },
  };
  let store = openSqliteWbcWorldQualificationStore(path, sources);
  const request = { careerId: 'career-1', editionId: 'wbc-2040', qualifierEditionId: 'qualifier-2040',
    coefficientPolicy, coefficientRegistry: registerWbcRegionalCoefficientPolicy(
      EMPTY_WBC_REGIONAL_COEFFICIENT_POLICY_REGISTRY, coefficientPolicy),
    berthPolicy, berthRegistry: registerWbcBerthPolicy(EMPTY_WBC_BERTH_POLICY_REGISTRY, berthPolicy) };
  try {
    for (let ordinal = 0; ordinal < 4; ordinal++) {
      cycle.initialize('career-1', worldCycleInput(ordinal));
      const editionId = `wbc-${2032 + ordinal * 4}`;
      const selected = selections.initialize({ careerId: 'career-1', editionId, cycleOrdinal: ordinal,
        kind: 'WBC', careerDayOne: '2031-01-01', cutoffDay: ordinal * 1461 + 400 });
      if (ordinal < 2) {
        const entrants = regions.flatMap((region) => Array.from({ length: 6 }, (_, index) =>
          ({ nationId: `${region}-${index}`, region })));
        // Historical descriptors are accepted fixtures here, not Match-produced evidence.
        historical.set(editionId, { editionId, snapshotId: `official-${editionId}`,
          completedAtDay: selected.calendarWindow.endsOnDay, entrants,
          games: (['GROUP', 'ROUND_OF_16', 'QUARTERFINAL', 'SEMIFINAL', 'FINAL'] as const).flatMap((stage, index) =>
            Array.from({ length: [36, 8, 4, 2, 1][index] }, (_, gameIndex) => ({
              applicationId: `${editionId}-${stage}-${gameIndex}`, stage,
              homeNationId: entrants[gameIndex % 24].nationId,
              awayNationId: entrants[(gameIndex + 1) % 24].nationId,
              winnerNationId: entrants[gameIndex % 24].nationId }))) });
      }
    }
    expect(selections.readWbcPredecessors('career-1', 2).map((item) => item.editionId))
      .toEqual(['wbc-2032', 'wbc-2036']);
    expect(() => store.initialize({ ...request, editionId: 'wbc-2032' })).toThrow('two previous');
    expect(store.readDirect('career-1', 'wbc-2032')).toBeNull();
    for (const region of regions) {
      const selected = selections.initialize({ careerId: 'career-1', editionId: `regional-${region}-2039`,
        cycleOrdinal: 2, kind: 'REGIONAL_NATIONAL', region, careerDayOne: '2031-01-01', cutoffDay: 3000 });
      const orderedNationIds = Array.from({ length: region === 'AFRICA' ? 12 : 16 }, (_, i) => `${region}-${i}`);
      orderedNationIds.forEach((nationId) => nations.record({ careerId: 'career-1', nationId, region,
        effectiveFromDay: 0, sourceEventId: `region-${nationId}` }));
      placements.set(region, { region, editionId: selected.editionId, snapshotId: `placement-${region}`,
        completedAtDay: selected.calendarWindow.endsOnDay, orderedNationIds });
    }
    wrongRegionSource = true;
    expect(() => store.initialize(request)).toThrow('regional');
    wrongRegionSource = false;
    interruptDirectInitialization = true;
    expect(() => store.initialize(request)).toThrow('interrupted after coefficient');
    expect(store.readSnapshot('career-1', request.editionId)).toBeNull();
    const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
    const partial = new DatabaseSync(path);
    try {
      expect(partial.prepare('SELECT COUNT(*) AS count FROM world_wbc_regional_coefficients').get()?.count).toBe(1);
      expect(partial.prepare('SELECT COUNT(*) AS count FROM world_wbc_direct_berths').get()?.count).toBe(0);
    } finally { partial.close(); }
    interruptDirectInitialization = false;
    store.close(); store = openSqliteWbcWorldQualificationStore(path, sources);
    const snapshot = store.initialize(request);
    expect(snapshot.direct.entrantNationIds).toHaveLength(20);
    expect(snapshot.input.previousWorldEditionIds).toEqual(['wbc-2032', 'wbc-2036']);
    expect(snapshot.regionalSelections.map((item) => item.region)).toEqual(regions);
    expect(snapshot.input.cutoffSnapshotId).toBe(snapshot.selection.qualificationCutoff.snapshotId);
    expect(Object.isFrozen(snapshot.previousWorldEditions[0].games)).toBe(true);
    expect(store.initialize(request)).toEqual(snapshot);
    expect(store.readDirect('career-1', request.editionId)).toEqual(snapshot.direct);
    changedPastSource = true;
    expect(() => store.readSnapshot('career-1', request.editionId)).toThrow('corrupt');
    changedPastSource = false;
    changedWorldPolicy = true;
    expect(() => store.readDirect('career-1', request.editionId)).toThrow('corrupt');
    changedWorldPolicy = false;
    store.close(); store = openSqliteWbcWorldQualificationStore(path, sources);
    expect(store.readSnapshot('career-1', request.editionId)).toEqual(snapshot);
    const db = new DatabaseSync(path);
    try {
      // Future source corruption must not become a dependency of this earlier qualification.
      db.prepare("UPDATE world_national_selections SET request_json='{}' WHERE edition_id='wbc-2044'").run();
    } finally { db.close(); }
    expect(store.readDirect('career-1', request.editionId)).toEqual(snapshot.direct);
    expect(futureReads).toBe(0);
    const tamper = new DatabaseSync(path);
    try { tamper.prepare("UPDATE world_wbc_world_qualifications SET snapshot_json='{}'").run(); }
    finally { tamper.close(); }
    expect(() => store.readDirect('career-1', request.editionId)).toThrow('corrupt');
  } finally {
    store.close(); selections.close(); nations.close(); cycle.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
