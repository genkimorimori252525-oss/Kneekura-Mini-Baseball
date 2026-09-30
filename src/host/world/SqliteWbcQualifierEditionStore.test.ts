import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openSqliteWbcQualifierEditionStore } from './SqliteWbcQualifierEditionStore';
import { openSqliteWorldCompetitionCycleStore } from './SqliteWorldCompetitionCycleStore';
import { openSqliteNationalCompetitionSelectionStore } from './SqliteNationalCompetitionSelectionStore';
import { openSqliteNationCompetitionRegionStore } from './SqliteNationCompetitionRegionStore';
import { worldCycleInput } from './WorldCompetitionCycleFixtures.test-support';
import type { WbcDirectBerths } from '../../core/world/competition/WbcBerths';
import type { WbcQualifierSelection } from '../../core/world/competition/WbcGlobalQualifierSelection';
import { selectWbcGlobalQualifierEntrants } from '../../core/world/competition/WbcGlobalQualifierSelection';
import type { WbcQualifierSelectionRequest } from './SqliteWbcQualifierSelectionStore';
import { openSqliteWbcGlobalQualifierPodStore } from './SqliteWbcGlobalQualifierPodStore';
import { openSqliteWbcQualifierScheduleStore } from './SqliteWbcQualifierScheduleStore';
import { registerWbcQualifierFixtureFromWorld } from './WbcQualifierFixtureFromWorld';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { playOfficialNineInningGame } from './OfficialNineInningGame.test-support';
import { drawWbcQualifierEntrantPods } from '../../core/world/competition/WbcQualifierEditionAssembly';
import { openSqliteWorldHostInfrastructureStore } from './SqliteWorldHostInfrastructureStore';
import { openSqliteWbcQualifierHostAccessStore } from './SqliteWbcQualifierHostAccessStore';
import { openSqliteWbcQualifierHostCandidateStore, type SqliteWbcQualifierHostCandidateStore } from './SqliteWbcQualifierHostCandidateStore';

const regions = ['ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'] as const;
it('pins World cutoff, selected entrants, ranking, historical regions and host evidence across reopens', () => {
  const directory = mkdtempSync(join(tmpdir(), 'qualifier-edition-'));
  const path = join(directory, 'world.sqlite');
  const cycles = openSqliteWorldCompetitionCycleStore(path);
  cycles.initialize('career-1', worldCycleInput(0));
  const selections = openSqliteNationalCompetitionSelectionStore(path, { cycle: cycles });
  const world = selections.initialize({ careerId: 'career-1', editionId: 'wbc-2032', kind: 'WBC',
    cycleOrdinal: 0, careerDayOne: '2031-01-01', cutoffDay: 420 });
  const nations = openSqliteNationCompetitionRegionStore(path);
  const entrants = regions.flatMap((region) => Array.from({ length: 4 }, (_, i) => ({
    nationId: `${region}-${i}`, region, route: 'REGIONAL_PRIORITY' as const, sourceId: `placement-${region}` })));
  entrants.forEach((item) => nations.record({ careerId: 'career-1', nationId: item.nationId, region: item.region,
    effectiveFromDay: 0, sourceEventId: `nation-${item.nationId}` }));
  const selected: WbcQualifierSelection = { qualifierEditionId: 'qualifier-2032', directSnapshotId: 'direct-2032',
    rankingSnapshotId: 'ranking-400', eligibilitySnapshotId: 'eligible-400', policyVersion: 'selection-v1',
    qualificationSnapshotId: 'sixteen-2032', entrants };
  // Qualification and ranking are callback fixtures; World/region/Edition persistence is real.
  const direct: WbcDirectBerths = { editionId: world.editionId, qualifierEditionId: selected.qualifierEditionId,
    directSnapshotId: selected.directSnapshotId, cutoffSnapshotId: world.qualificationCutoff.snapshotId,
    cutoffDay: 420, cycleId: 'cycle-0', policyVersion: 'berths-v1',
    previousWorldEditionIds: ['wbc-2024', 'wbc-2028'],
    coefficientSources: [], regionalPlacementSources: [], slots: [],
    entrantNationIds: regions.flatMap((region, index) => Array.from({ length: [7, 7, 4, 2][index] }, (_, i) =>
      `direct-${region}-${i}`)),
    directBerthsByRegion: { ASIA_PACIFIC: 7, AMERICAS: 7, EUROPE: 4, AFRICA: 2 },
    placements: regions.map((region, index) => ({ region, editionId: `regional-${region}`, snapshotId: `placement-${region}`,
      completedAtDay: 130, orderedNationIds: [
        ...Array.from({ length: [7, 7, 4, 2][index] }, (_, i) => `direct-${region}-${i}`),
        ...entrants.filter((item) => item.region === region).map((item) => item.nationId)] })),
  };
  let changedSelection = false, changedHosts = false, changedRanking = false, futureEligibility = false, changedRequest = false;
  const selectionRequest: WbcQualifierSelectionRequest = { careerId: 'career-1', wbcEditionId: world.editionId,
    qualifierEditionId: selected.qualifierEditionId, rankingAsOfDay: 400,
    eligibility: { snapshotId: selected.eligibilitySnapshotId, asOfDay: 400,
      eligibleNationIds: entrants.map((item) => item.nationId) },
    policy: { version: 'selection-v1', regionalPriorityPerRegion: 1, rankingPolicyVersion: 'ranking-v1' },
    registry: { policies: [{ version: 'selection-v1', regionalPriorityPerRegion: 1, rankingPolicyVersion: 'ranking-v1' }] } };
  // The four regional-priority nations legitimately have no World Ranking entry.
  const rankedNationIds = entrants.filter((item) => !item.nationId.endsWith('-0')).map((item) => item.nationId);
  const actualSelection = selectWbcGlobalQualifierEntrants(selected.qualifierEditionId, direct,
    { snapshotId: selected.rankingSnapshotId, policyVersion: 'ranking-v1', asOfDay: 400,
      evidenceResultIds: ['regional-ranking-result'], orderedNationIds: rankedNationIds }, selectionRequest.eligibility,
    selectionRequest.policy, selectionRequest.registry, nations.authority('career-1').nationCompetitionRegion);
  expect(actualSelection.entrants.filter((item) => !rankedNationIds.includes(item.nationId)))
    .toHaveLength(4);
  let candidates: SqliteWbcQualifierHostCandidateStore;
  const source = { selections, nations, direct: { readDirect: () => direct },
    selection: { readSelection: () => ({ ...actualSelection, eligibilitySnapshotId: changedSelection ? 'fork' : selected.eligibilitySnapshotId }),
      readRequest: () => ({ ...selectionRequest, eligibility: { ...selectionRequest.eligibility,
        asOfDay: futureEligibility ? 415 : changedRequest ? 399 : 400 } }) },
    rankings: { readRanking: () => ({ snapshotId: selected.rankingSnapshotId, asOfDay: 400,
      policyVersion: changedRanking ? 'other-ranking-policy' : 'ranking-v1', evidenceResultIds: ['regional-ranking-result'],
      orderedNationIds: rankedNationIds }) },
    hosts: { readCandidates: (careerId: string, editionId: string, beforeDay: number) => {
      const live = candidates.readCandidates(careerId, editionId, beforeDay);
      return live ? { ...live, snapshotId: changedHosts ? 'fork-hosts' : live.snapshotId } : null;
    } } };
  const request = { careerId: 'career-1', wbcEditionId: world.editionId, qualifierEditionId: selected.qualifierEditionId,
    selectedAtDay: 400, calendarWindow: { startsOnDay: 401, endsOnDay: 410 }, drawSeed: 'draw-2032',
    profile: { competitionId: 'global-qualifier', formatVersion: 'four-pods-v1', ruleProfileVersion: 'rules-v1',
      gamePolicyVersion: 'games-v1', drawPolicyVersion: 'mixed-pods-v1', hostingPolicyVersion: 'hosts-v1', distinctPodCities: true } };
  let store = openSqliteWbcQualifierEditionStore(path, source);
  const matches = new SqliteOfficialStateStore(join(directory, 'matches.sqlite'));
  const matchSource = { getMatch: (gameId: string) => matches.getMatch(gameId),
    getOfficialFixture: (gameId: string) => matches.getOfficialFixture(gameId) };
  const pods = openSqliteWbcGlobalQualifierPodStore(path, { selection: source.selection, matches: matchSource,
    editions: { readEdition: (careerId, editionId) => store.readEdition(careerId, editionId) } });
  const schedules = openSqliteWbcQualifierScheduleStore(path, { pods });
  const infrastructure = openSqliteWorldHostInfrastructureStore(path, { nations });
  const access = openSqliteWbcQualifierHostAccessStore(path);
  candidates = openSqliteWbcQualifierHostCandidateStore(path, { selection: source.selection, infrastructure, access,
    qualifiers: pods, editions: { readSnapshot: (careerId, editionId) => store.readSnapshot(careerId, editionId) } });
  try {
    const metrics = { stadiumCapacity: 10000, stadiumQuality: 5, transportQuality: 5,
      accommodationCapacity: 2000, broadcastReadiness: 5, operationsQuality: 5 };
    const draw = drawWbcQualifierEntrantPods({ selection: actualSelection, drawSeed: request.drawSeed,
      drawPolicyVersion: request.profile.drawPolicyVersion });
    for (const [index, region] of regions.entries()) {
      const nationId = `host-${index}`;
      nations.record({ careerId: 'career-1', nationId, region, effectiveFromDay: 0, sourceEventId: `host-nation-${index}` });
      infrastructure.record({ careerId: 'career-1', nationId, region, venueId: `venue-${index}`, cityId: `city-${index}`,
        sourceClubId: null, sourceEventId: `world-venue-${index}`, effectiveFromDay: 10, licensed: true, safe: true, metrics });
      for (const podIndex of [0, 1, 2, 3]) access.record({ careerId: 'career-1', qualifierEditionId: selected.qualifierEditionId,
        drawSnapshotId: draw.drawSnapshotId, podIndex, venueId: `venue-${index}`, sourceEventId: `access-${podIndex}-${index}`,
        effectiveFromDay: 390, geographySuitability: 3, travelCost: index + 1, neutralAccessibility: 5, developingOpportunity: 1 });
    }
    const hostSnapshot = candidates.initialize({ careerId: 'career-1', qualifierEditionId: selected.qualifierEditionId,
      selectedAtDay: 400, drawSeed: request.drawSeed, drawPolicyVersion: request.profile.drawPolicyVersion,
      policy: { version: 'hosts-v1', minimums: metrics,
        suitabilityWeights: { stadiumCapacity: 0, stadiumQuality: 1, transportQuality: 0,
          accommodationCapacity: 0, broadcastReadiness: 0, operationsQuality: 0 },
        accessWeights: { geographySuitability: 1, travelCost: 1, neutralAccessibility: 1, developingOpportunity: 1 },
        minimumNeutralAccessibility: 1, maximumTravelCost: 100,
        rotation: { lookbackDays: 1000, cityPenalty: 1, nationPenalty: 2, regionPenalty: 3 } } });
    expect(() => store.initialize({ ...request, drawSeed: 'other-seed' })).toThrow('draw');
    expect(() => store.initialize({ ...request, selectedAtDay: 401 })).toThrow('pre-play');
    expect(() => store.initialize({ ...request, calendarWindow: { startsOnDay: 401, endsOnDay: 421 } }))
      .toThrow('World cutoff');
    futureEligibility = true;
    expect(() => store.initialize(request)).toThrow('pre-play');
    futureEligibility = false;
    const saved = store.initialize(request);
    expect(saved.edition.pods.flatMap((pod) => pod.entrants)).toHaveLength(16);
    expect(saved.source.world).toEqual(world);
    expect(store.initialize(request)).toEqual(saved);
    expect(() => pods.initialize({ careerId: 'career-1', edition: { ...saved.edition,
      pods: saved.edition.pods.map((pod) => ({ ...pod, hostVenueId: 'unapproved-venue' })) } }))
      .toThrow('accepted qualifier Edition');
    pods.initialize({ careerId: 'career-1', edition: saved.edition });
    const schedule = schedules.initialize({ careerId: 'career-1', editionId: selected.qualifierEditionId,
      policy: { version: 'schedule-v1', gamesPerVenuePerDay: 1, minimumOffDaysBetweenRounds: 1 } });
    for (const slot of schedule.games) {
      const fixture = registerWbcQualifierFixtureFromWorld({ pods, schedules, matches },
        { careerId: 'career-1', editionId: selected.qualifierEditionId, gameId: slot.gameId, gameDay: slot.gameDay });
      playOfficialNineInningGame(matches, { ...fixture.game, seasonId: selected.qualifierEditionId,
        ruleProfileVersion: saved.edition.ruleProfileVersion, gamePolicyVersion: saved.edition.gamePolicyVersion,
        binding: fixture.binding });
    }
    expect(pods.finalize('career-1', selected.qualifierEditionId)!.winners).toHaveLength(4);
    const hosted = candidates.recordCompletedEdition('career-1', selected.qualifierEditionId);
    expect(hosted.completedAtDay).toBe(410);
    expect(candidates.recordCompletedEdition('career-1', selected.qualifierEditionId)).toEqual(hosted);
    // Its completed hosting must not become a dependency of its own earlier candidate snapshot.
    expect(candidates.readCandidates('career-1', selected.qualifierEditionId, 400)).toEqual(hostSnapshot);
    store.close(); store = openSqliteWbcQualifierEditionStore(path, source);
    expect(store.readEdition('career-1', selected.qualifierEditionId)).toEqual(saved.edition);
    expect(Object.isFrozen(store.readSnapshot('career-1', selected.qualifierEditionId)!.source.direct.placements)).toBe(true);
    expect(() => store.initialize({ ...request, drawSeed: 'different' })).toThrow('frozen differently');
    changedRequest = true;
    expect(() => store.readEdition('career-1', selected.qualifierEditionId)).toThrow('corrupt');
    changedRequest = false;
    changedSelection = true;
    expect(() => store.readEdition('career-1', selected.qualifierEditionId)).toThrow('corrupt');
    changedSelection = false; changedHosts = true;
    expect(() => store.readEdition('career-1', selected.qualifierEditionId)).toThrow('corrupt');
    changedHosts = false; changedRanking = true;
    expect(() => store.readEdition('career-1', selected.qualifierEditionId)).toThrow('corrupt');
    changedRanking = false;
    const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
    const db = new DatabaseSync(path);
    try { db.prepare("UPDATE world_wbc_qualifier_editions SET snapshot_json='{}'").run(); }
    finally { db.close(); }
    expect(() => store.readSnapshot('career-1', selected.qualifierEditionId)).toThrow('corrupt');
  } finally {
    candidates.close(); access.close(); infrastructure.close(); schedules.close(); pods.close(); matches.close();
    store.close(); nations.close(); selections.close(); cycles.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
