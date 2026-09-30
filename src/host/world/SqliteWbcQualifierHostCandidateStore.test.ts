import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { drawWbcQualifierEntrantPods } from '../../core/world/competition/WbcQualifierEditionAssembly';
import { openSqliteNationCompetitionRegionStore } from './SqliteNationCompetitionRegionStore';
import { openSqliteWorldHostInfrastructureStore } from './SqliteWorldHostInfrastructureStore';
import { openSqliteWbcQualifierHostAccessStore } from './SqliteWbcQualifierHostAccessStore';
import { openSqliteWbcQualifierHostCandidateStore } from './SqliteWbcQualifierHostCandidateStore';
import type { WbcQualifierSelection } from '../../core/world/competition/WbcGlobalQualifierSelection';
import type { WbcQualifierSelectionRequest } from './SqliteWbcQualifierSelectionStore';

const regions = ['ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'] as const;
const metrics = { stadiumCapacity: 10000, stadiumQuality: 5, transportQuality: 5,
  accommodationCapacity: 2000, broadcastReadiness: 5, operationsQuality: 5 };
const policy = { version: 'hosts-v1', minimums: metrics,
  suitabilityWeights: { stadiumCapacity: 0, stadiumQuality: 1, transportQuality: 0,
    accommodationCapacity: 0, broadcastReadiness: 0, operationsQuality: 0 },
  accessWeights: { geographySuitability: 1, travelCost: 1, neutralAccessibility: 1, developingOpportunity: 1 },
  minimumNeutralAccessibility: 1, maximumTravelCost: 100,
  rotation: { lookbackDays: 1000, cityPenalty: 1, nationPenalty: 2, regionPenalty: 3 } };

it('projects real World venue and draw-bound access stores and rejects changed saved sources', () => {
  const directory = mkdtempSync(join(tmpdir(), 'qualifier-host-candidates-'));
  const path = join(directory, 'world.sqlite');
  const nations = openSqliteNationCompetitionRegionStore(path);
  const infrastructure = openSqliteWorldHostInfrastructureStore(path, { nations });
  const access = openSqliteWbcQualifierHostAccessStore(path);
  const selected: WbcQualifierSelection = { qualifierEditionId: 'qualifier-2040', directSnapshotId: 'direct-2040',
    rankingSnapshotId: 'ranking-400', eligibilitySnapshotId: 'eligible-400', policyVersion: 'selection-v1',
    qualificationSnapshotId: 'selected-sixteen', entrants: regions.flatMap((region) => Array.from({ length: 4 }, (_, i) => ({
      nationId: `${region}-${i}`, region, route: 'REGIONAL_PRIORITY' as const, sourceId: `placement-${region}` }))) };
  const selectionRequest: WbcQualifierSelectionRequest = { careerId: 'career-1', wbcEditionId: 'wbc-2040',
    qualifierEditionId: selected.qualifierEditionId, rankingAsOfDay: 400,
    eligibility: { snapshotId: selected.eligibilitySnapshotId, asOfDay: 400, eligibleNationIds: selected.entrants.map((item) => item.nationId) },
    policy: { version: 'selection-v1', rankingPolicyVersion: 'ranking-v1', regionalPriorityPerRegion: 1 }, registry: { policies: [] } };
  let predecessorReads = 0;
  const source = { selection: { readSelection: () => selected, readRequest: () => selectionRequest }, infrastructure, access,
    qualifiers: { readEvidence: () => { predecessorReads++; return null; } },
    editions: { readSnapshot: () => { predecessorReads++; return null; } } };
  let store = openSqliteWbcQualifierHostCandidateStore(path, source);
  const request = { careerId: 'career-1', qualifierEditionId: selected.qualifierEditionId,
    selectedAtDay: 400, drawSeed: 'draw-seed', drawPolicyVersion: 'draw-v1', policy };
  const draw = drawWbcQualifierEntrantPods({ selection: selected, drawSeed: request.drawSeed, drawPolicyVersion: request.drawPolicyVersion });
  try {
    for (const [i, nationId] of ['JP', 'ZA'].entries()) {
      const region = i === 0 ? 'ASIA_PACIFIC' : 'AFRICA';
      nations.record({ careerId: 'career-1', nationId, region, effectiveFromDay: 0, sourceEventId: `nation-${nationId}` });
      infrastructure.record({ careerId: 'career-1', nationId, region, venueId: `venue-${i}`, cityId: `city-${i}`,
        effectiveFromDay: 10, sourceEventId: `facility-${i}`, sourceClubId: null, licensed: true, safe: true, metrics });
      for (const podIndex of [0, 1, 2, 3]) access.record({ careerId: 'career-1', qualifierEditionId: selected.qualifierEditionId,
        drawSnapshotId: draw.drawSnapshotId, podIndex, venueId: `venue-${i}`, sourceEventId: `access-${podIndex}-${i}`,
        effectiveFromDay: 390, geographySuitability: 3, travelCost: i === 0 ? 10 : 1,
        neutralAccessibility: 5, developingOpportunity: i === 0 ? 1 : 6 });
    }
    const saved = store.initialize(request);
    expect(saved.drawSnapshotId).toBe(draw.drawSnapshotId);
    expect(saved.podCandidates[0].map((item) => item.suitabilityScore)).toEqual([4, 18]);
    expect(saved.source.access.assessments).toHaveLength(8);
    expect(store.initialize(request)).toEqual(saved);
    expect(() => store.initialize({ ...request, drawSeed: 'other-seed' })).toThrow('frozen differently');
    expect(() => store.recordCompletedEdition('career-1', selected.qualifierEditionId)).toThrow('official');
    access.record({ ...saved.source.access.assessments[0], careerId: 'career-1', qualifierEditionId: selected.qualifierEditionId,
      drawSnapshotId: draw.drawSnapshotId, sourceEventId: 'future-access', effectiveFromDay: 410, travelCost: 2 });
    store.close(); store = openSqliteWbcQualifierHostCandidateStore(path, source);
    expect(store.readCandidates('career-1', selected.qualifierEditionId, 400)).toEqual(saved);
    expect(store.readCandidates('career-1', selected.qualifierEditionId, 399)).toBeNull();
    expect(Object.isFrozen(saved.source.venues[0].metrics)).toBe(true);
    const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
    const db = new DatabaseSync(path);
    try {
      predecessorReads = 0;
      db.prepare('INSERT INTO world_wbc_qualifier_hosting_history VALUES (?, ?, ?, ?, ?)')
        .run('career-1', 'future-qualifier', 490, 500, '{}');
      expect(store.readCandidates('career-1', selected.qualifierEditionId, 400)).toEqual(saved);
      expect(predecessorReads).toBe(0);
      db.prepare('INSERT INTO world_wbc_qualifier_hosting_history VALUES (?, ?, ?, ?, ?)')
        .run('career-1', 'equal-cutoff-qualifier', 400, 400, '{}');
      expect(() => store.readCandidates('career-1', selected.qualifierEditionId, 400)).toThrow('corrupt');
      expect(predecessorReads).toBe(0);
      db.prepare("UPDATE world_wbc_qualifier_hosting_history SET completed_day=500 WHERE edition_id='equal-cutoff-qualifier'").run();
      db.prepare("UPDATE world_wbc_qualifier_host_candidates SET snapshot_json='{}'").run();
    }
    finally { db.close(); }
    expect(() => store.readCandidates('career-1', selected.qualifierEditionId, 400)).toThrow('corrupt');
  } finally { store.close(); access.close(); infrastructure.close(); nations.close(); rmSync(directory, { recursive: true, force: true }); }
});
