import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { EMPTY_WBC_BERTH_POLICY_REGISTRY, registerWbcBerthPolicy } from '../../core/world/competition/WbcBerths';
import { EMPTY_WBC_REGIONAL_COEFFICIENT_POLICY_REGISTRY, registerWbcRegionalCoefficientPolicy } from '../../core/world/competition/WbcRegionalCoefficients';
import { EMPTY_WORLD_NATIONAL_RANKING_POLICY_REGISTRY, registerWorldNationalRankingPolicy } from '../../core/world/competition/WorldNationalRankingHistory';
import { EMPTY_WBC_QUALIFIER_SELECTION_POLICY_REGISTRY, registerWbcQualifierSelectionPolicy } from '../../core/world/competition/WbcGlobalQualifierSelection';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { openSqliteWorldCompetitionCycleStore } from './SqliteWorldCompetitionCycleStore';
import { openSqliteNationalCompetitionSelectionStore } from './SqliteNationalCompetitionSelectionStore';
import { openSqliteNationCompetitionRegionStore } from './SqliteNationCompetitionRegionStore';
import { openSqliteRegionalNationalGroupStore } from './SqliteRegionalNationalGroupStore';
import { openSqliteRegionalNationalKnockoutStore } from './SqliteRegionalNationalKnockoutStore';
import { openSqliteRegionalNationalScheduleStore } from './SqliteRegionalNationalScheduleStore';
import { registerRegionalNationalFixtureFromWorld } from './RegionalNationalFixtureFromWorld';
import { openSqliteWbcFinalsGroupStore } from './SqliteWbcFinalsGroupStore';
import { openSqliteWbcFinalsKnockoutStore } from './SqliteWbcFinalsKnockoutStore';
import { openSqliteWbcFinalsScheduleStore } from './SqliteWbcFinalsScheduleStore';
import { registerWbcFinalsFixtureFromWorld } from './WbcFinalsFixtureFromWorld';
import { openSqliteOfficialWbcHistoryStore } from './SqliteOfficialWbcHistoryStore';
import { openSqliteNationalQualificationHistoryStore } from './SqliteNationalQualificationHistoryStore';
import { openSqliteWorldNationalRankingHistoryStore } from './SqliteWorldNationalRankingHistoryStore';
import { openSqliteWorldNationalRankingSnapshotStore } from './SqliteWorldNationalRankingSnapshotStore';
import { openSqliteWbcWorldQualificationStore } from './SqliteWbcWorldQualificationStore';
import { openSqliteWbcRegionalCoefficientStore } from './SqliteWbcRegionalCoefficientStore';
import { openSqliteWbcBerthStore } from './SqliteWbcBerthStore';
import { openSqliteWbcQualifierSelectionStore } from './SqliteWbcQualifierSelectionStore';
import { openSqliteWbcQualifierEditionStore } from './SqliteWbcQualifierEditionStore';
import { openSqliteWbcGlobalQualifierPodStore } from './SqliteWbcGlobalQualifierPodStore';
import { openSqliteWbcQualifierScheduleStore } from './SqliteWbcQualifierScheduleStore';
import { registerWbcQualifierFixtureFromWorld } from './WbcQualifierFixtureFromWorld';
import { openSqliteWorldHostInfrastructureStore } from './SqliteWorldHostInfrastructureStore';
import { openSqliteWbcQualifierHostAccessStore } from './SqliteWbcQualifierHostAccessStore';
import { openSqliteWbcQualifierHostCandidateStore } from './SqliteWbcQualifierHostCandidateStore';
import { initializeWorldBoundWbcQualifier, completeWorldBoundWbcQualifier } from './WorldBoundWbcQualifierRuntime';
import { initializeWorldBoundWbcFinals, initializeWorldBoundWbcKnockout, completeWorldBoundWbcFinals } from './WorldBoundWbcFinalsRuntime';
import { openSqliteNationalCompetitionDrawStore } from './SqliteNationalCompetitionDrawStore';
import { openSqliteNationalHostCandidateStore } from './SqliteNationalHostCandidateStore';
import { openSqliteNationalCompetitionEditionStore } from './SqliteNationalCompetitionEditionStore';
import { EMPTY_COMPETITION_DRAW_POLICY_REGISTRY, registerCompetitionDrawPolicy } from '../../core/world/competition/CompetitionDraw';
import { createCompetitionSourceReader, withCompetitionSourceReadScope } from './CompetitionSourceReadScope';
import { worldCycleInput } from './WorldCompetitionCycleFixtures.test-support';
import { wbcFinalsInput } from './WbcFinalsFixtures.test-support';
import { regionalNationalInput } from './RegionalNationalFixtures.test-support';
import { playOfficialNineInningGame } from './OfficialNineInningGame.test-support';

const regions = ['ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'] as const;
it('connects two actual WBC histories and four regional finals through Native qualification and the current 51-game WBC finals', () => {
  const directory = mkdtempSync(join(tmpdir(), 'wbc-native-lifecycle-'));
  const path = join(directory, 'world.sqlite');
  const closables: { close(): void }[] = [];
  const track = <T extends { close(): void }>(store: T): T => { closables.push(store); return store; };
  const matches = new SqliteOfficialStateStore(join(directory, 'matches.sqlite'));
  closables.push(matches);
  const matchSource = { getMatch: (gameId: string) => matches.getMatch(gameId),
    getOfficialFixture: (gameId: string) => matches.getOfficialFixture(gameId) };
  let played = 0;
  let currentFinals: ReturnType<typeof openSqliteWbcFinalsKnockoutStore> | undefined;
  try {
    const cycles = track(openSqliteWorldCompetitionCycleStore(path));
    const selections = track(openSqliteNationalCompetitionSelectionStore(path, { cycle: cycles }));
    const nations = track(openSqliteNationCompetitionRegionStore(path));
    const nationIds = regions.flatMap((region) => Array.from({ length: region === 'AFRICA' ? 12 : 16 }, (_, i) => `${region}-${i}`));
    for (const region of regions) for (const nationId of nationIds.filter((value) => value.startsWith(region))) {
      nations.record({ careerId: 'career-1', nationId, region, effectiveFromDay: 0, sourceEventId: `nation-${nationId}` });
    }
    const regionalGroups = track(openSqliteRegionalNationalGroupStore(path, { selections, regions: nations, matches: matchSource }));
    const regionalKnockout = track(openSqliteRegionalNationalKnockoutStore(path,
      { groups: regionalGroups, regions: nations, matches: matchSource }));
    const regionalSchedules = track(openSqliteRegionalNationalScheduleStore(path, { groups: regionalGroups, selections }));
    const officialHistory: ReturnType<typeof openSqliteOfficialWbcHistoryStore> = track(openSqliteOfficialWbcHistoryStore(path, {
      regions: nations, finals: { readEvidence: (careerId, editionId) => editionId === 'wbc-2040'
        ? currentFinals?.readEvidence(careerId, editionId) ?? null : finals.readEvidence(careerId, editionId) } }));
    const rankingHistory = track(openSqliteWorldNationalRankingHistoryStore(path, { regional: regionalKnockout,
      wbc: { readEvidence: (careerId, editionId) => editionId === 'wbc-2040'
        ? currentFinals?.readEvidence(careerId, editionId) ?? null : finals.readEvidence(careerId, editionId) }, nations }));
    const rankings = track(openSqliteWorldNationalRankingSnapshotStore(path, { history: rankingHistory }));
    const qualificationHistory: ReturnType<typeof openSqliteNationalQualificationHistoryStore> = track(openSqliteNationalQualificationHistoryStore(path, { knockouts: regionalKnockout,
      qualifiers: { readEvidence: (careerId, editionId) => pods.readEvidence(careerId, editionId) },
      selections: { readSelection: (careerId, editionId) => selected.readSelection(careerId, editionId) } }));
    qualificationHistory.initialize('career-1', Object.fromEntries(regions.map((region) => [region, `regional-${region}`])) as Record<typeof regions[number], string>);
    const qualification = track(openSqliteWbcWorldQualificationStore(path, { selections, history: officialHistory,
      regional: qualificationHistory, nations }));
    const coefficients = track(openSqliteWbcRegionalCoefficientStore(path, { history: officialHistory }));
    const berths = track(openSqliteWbcBerthStore(path, { direct: qualification,
      editionCutoff: (editionId) => selections.readSelection('career-1', editionId)?.qualificationCutoff ?? null,
      coefficients, regional: qualificationHistory, qualifiers: qualificationHistory, nations }));
    const selected = track(openSqliteWbcQualifierSelectionStore(path, { direct: qualification, ranking: rankings, nations }));
    const infrastructure = track(openSqliteWorldHostInfrastructureStore(path, { nations }));
    const access = track(openSqliteWbcQualifierHostAccessStore(path));
    const candidates = track(openSqliteWbcQualifierHostCandidateStore(path, { selection: selected, infrastructure, access,
      qualifiers: { readEvidence: (careerId, editionId) => pods.readEvidence(careerId, editionId) },
      editions: { readSnapshot: (careerId, editionId) => editions.readSnapshot(careerId, editionId) } }));
    const editions: ReturnType<typeof openSqliteWbcQualifierEditionStore> = track(openSqliteWbcQualifierEditionStore(path,
      { selections, direct: qualification, selection: selected, rankings, nations, hosts: candidates }));
    const pods: ReturnType<typeof openSqliteWbcGlobalQualifierPodStore> = track(openSqliteWbcGlobalQualifierPodStore(path, { selection: selected, editions, matches: matchSource }));
    const schedules = track(openSqliteWbcQualifierScheduleStore(path, { pods }));
    const seedBerths = new Map<string, ReturnType<typeof wbcFinalsInput>['berths']>();
    // Bootstrap qualification/draw is an accepted fixture for the first two cycles only.
    // Their results are produced by real durable nine-inning Match, never fabricated descriptors.
    const groups: ReturnType<typeof openSqliteWbcFinalsGroupStore> = track(openSqliteWbcFinalsGroupStore(path, { selections, matches: matchSource,
      berths: { readAllocation: (careerId, editionId) => seedBerths.get(editionId) ?? berths.readAllocation(careerId, editionId) } }));
    const finals = track(openSqliteWbcFinalsKnockoutStore(path, { groups, matches: matchSource }));
    const finalSchedules = track(openSqliteWbcFinalsScheduleStore(path, { groups }));
    const play = (fixture: { game: { gameId: string; homeNationId: string; awayNationId: string; venueId: string };
      binding: ReturnType<typeof registerWbcFinalsFixtureFromWorld>['binding'] }, editionId: string,
      ruleProfileVersion: string, gamePolicyVersion: string): void => {
      const result = playOfficialNineInningGame(matches, { ...fixture.game, seasonId: editionId,
        ruleProfileVersion, gamePolicyVersion, binding: fixture.binding });
      expect(result.lineScore.innings).toHaveLength(9); played++;
    };
    for (let ordinal = 0; ordinal < 3; ordinal++) {
      cycles.initialize('career-1', worldCycleInput(ordinal));
      const editionId = `wbc-${2032 + ordinal * 4}`;
      const selection = selections.initialize({ careerId: 'career-1', editionId, kind: 'WBC', cycleOrdinal: ordinal,
        careerDayOne: '2031-01-01', cutoffDay: ordinal * 1461 + 420 });
      if (ordinal === 2) continue;
      const input = wbcFinalsInput(selection.calendarWindow, selection.qualificationCutoff.snapshotId);
      const historicalNations = regions.flatMap((region) => nationIds.filter((value) => value.startsWith(region)).slice(0, 6));
      const historicalBerths = { ...input.berths, editionId, qualificationSnapshotId: `seed-qualified-${editionId}`,
        entrantNationIds: historicalNations };
      seedBerths.set(editionId, historicalBerths);
      const edition = { ...input.edition, editionId, qualificationSnapshotId: historicalBerths.qualificationSnapshotId,
        drawSnapshotId: `seed-draw-${editionId}`, groups: input.edition.groups.map((group) => ({ ...group,
          nationIds: historicalNations.slice(group.groupIndex * 4, group.groupIndex * 4 + 4) })) };
      const knockoutEdition = { ...input.knockoutEdition, editionId,
        qualificationSnapshotId: edition.qualificationSnapshotId, groupDrawSnapshotId: edition.drawSnapshotId };
      groups.initialize({ careerId: 'career-1', edition });
      const schedule = finalSchedules.initialize({ careerId: 'career-1', editionId, knockoutEdition,
        policy: { version: 'schedule-v1', gamesPerVenuePerDay: 2, minimumOffDaysBetweenRounds: 1 } });
      for (const slot of schedule.games) {
        if (slot.stage === 'ROUND_OF_16' && !finals.readPlan('career-1', editionId)) {
          groups.finalize('career-1', editionId); finals.initialize({ careerId: 'career-1', edition: knockoutEdition });
        }
        play(registerWbcFinalsFixtureFromWorld({ groups, knockout: finals, schedules: finalSchedules, matches },
          { careerId: 'career-1', editionId, gameId: slot.gameId, gameDay: slot.gameDay }), editionId,
        edition.ruleProfileVersion, edition.gamePolicyVersion);
      }
      finals.finalize('career-1', editionId);
      expect(officialHistory.record('career-1', editionId).games).toHaveLength(51);
      rankingHistory.recordWbc('career-1', editionId);
    }
    for (const region of regions) {
      const editionId = `${region}-2039`;
      const selection = selections.initialize({ careerId: 'career-1', editionId, kind: 'REGIONAL_NATIONAL', region,
        cycleOrdinal: 2, careerDayOne: '2031-01-01', cutoffDay: 3000 });
      const input = regionalNationalInput(region, region === 'AFRICA' ? 3 : 4, selection.calendarWindow);
      const edition = { ...input.edition, editionId }, knockoutEdition = { ...input.knockoutEdition, editionId };
      regionalGroups.initialize('career-1', edition);
      const schedule = regionalSchedules.initialize({ careerId: 'career-1', editionId, knockoutEdition,
        policy: { version: 'regional-schedule-v1', gamesPerVenuePerDay: 2, minimumOffDaysBetweenRounds: 0 } });
      for (const slot of schedule.games) {
        if (slot.stage === 'QUARTERFINAL' && !regionalKnockout.readPlan('career-1', editionId)) {
          regionalGroups.finalize('career-1', editionId); regionalKnockout.initialize('career-1', knockoutEdition);
        }
        play(registerRegionalNationalFixtureFromWorld({ groups: regionalGroups, knockout: regionalKnockout,
          schedules: regionalSchedules, matches }, { careerId: 'career-1', editionId,
          gameId: slot.gameId, gameDay: slot.gameDay }), editionId, edition.ruleProfileVersion, edition.gamePolicyVersion);
      }
      regionalKnockout.finalize('career-1', editionId);
      qualificationHistory.recordRegional('career-1', region, editionId); rankingHistory.recordRegional('career-1', editionId);
    }
    expect(played).toBe(220);
    const selectedAtDay = 3322;
    const coefficientPolicy = { version: 'coefficients-v1', olderEditionMultiplier: 1, newerEditionMultiplier: 2,
      bestNationsPerRegion: 3, winPoints: { GROUP: 1, ROUND_OF_16: 2, QUARTERFINAL: 3, SEMIFINAL: 4, FINAL: 5 } };
    const berthPolicy = { version: 'direct-v1', performanceMethod: 'DIVISOR_WITH_TWO_EXTRA_CAP' as const };
    const rankingPolicy = { version: 'ranking-v1', winPoints: 2, tiePoints: 1, tierWeights: { REGIONAL: 1, WBC: 3, PREMIER_12: 2 },
      stageWeights: { GROUP: 1, ROUND_OF_16: 2, QUARTERFINAL: 3, SEMIFINAL: 4, BRONZE: 2, FINAL: 5 },
      recencyBands: [{ maxAgeDays: 10000, multiplier: 1 }], tieBreak: 'NATION_ID' as const };
    const selectionPolicy = { version: 'selection-v1', regionalPriorityPerRegion: 1, rankingPolicyVersion: rankingPolicy.version };
    const metrics = { stadiumCapacity: 10000, stadiumQuality: 5, transportQuality: 5,
      accommodationCapacity: 2000, broadcastReadiness: 5, operationsQuality: 5 };
    for (const [index, region] of regions.entries()) {
      const nationId = `host-${index}`;
      nations.record({ careerId: 'career-1', nationId, region, effectiveFromDay: 0, sourceEventId: `host-${index}` });
      infrastructure.record({ careerId: 'career-1', nationId, region, cityId: `city-${index}`, venueId: `venue-${index}`,
        sourceClubId: null, sourceEventId: `venue-${index}`, effectiveFromDay: 0, licensed: true, safe: true, metrics });
    }
    const stores = { qualification, rankings, selection: selected, access, hosts: candidates, editions, pods, schedules,
      history: qualificationHistory, berths };
    const request = { qualification: { careerId: 'career-1', editionId: 'wbc-2040', qualifierEditionId: 'qualifier-2040',
      coefficientPolicy, coefficientRegistry: registerWbcRegionalCoefficientPolicy(EMPTY_WBC_REGIONAL_COEFFICIENT_POLICY_REGISTRY, coefficientPolicy),
      berthPolicy, berthRegistry: registerWbcBerthPolicy(EMPTY_WBC_BERTH_POLICY_REGISTRY, berthPolicy) },
      ranking: { careerId: 'career-1', asOfDay: selectedAtDay, nationIds, policy: rankingPolicy,
        registry: registerWorldNationalRankingPolicy(EMPTY_WORLD_NATIONAL_RANKING_POLICY_REGISTRY, rankingPolicy) },
      selection: { careerId: 'career-1', wbcEditionId: 'wbc-2040', qualifierEditionId: 'qualifier-2040', rankingAsOfDay: selectedAtDay,
        eligibility: { snapshotId: 'accepted-eligibility', asOfDay: selectedAtDay, eligibleNationIds: nationIds },
        policy: selectionPolicy, registry: registerWbcQualifierSelectionPolicy(EMPTY_WBC_QUALIFIER_SELECTION_POLICY_REGISTRY, selectionPolicy) },
      edition: { careerId: 'career-1', wbcEditionId: 'wbc-2040', qualifierEditionId: 'qualifier-2040', selectedAtDay,
        calendarWindow: { startsOnDay: 3323, endsOnDay: 3332 }, drawSeed: 'draw-2040',
        profile: { competitionId: 'global-qualifier', formatVersion: 'four-pods-v1', ruleProfileVersion: 'rules-v1',
          gamePolicyVersion: 'games-v1', drawPolicyVersion: 'mixed-pods-v1', hostingPolicyVersion: 'hosts-v1', distinctPodCities: true } },
      hostPolicy: { version: 'hosts-v1', minimums: metrics,
        suitabilityWeights: { stadiumCapacity: 0, stadiumQuality: 1, transportQuality: 0, accommodationCapacity: 0, broadcastReadiness: 0, operationsQuality: 0 },
        accessWeights: { geographySuitability: 1, travelCost: 1, neutralAccessibility: 1, developingOpportunity: 1 },
        minimumNeutralAccessibility: 1, maximumTravelCost: 100,
        rotation: { lookbackDays: 1000, cityPenalty: 1, nationPenalty: 2, regionPenalty: 3 } },
      accessAssessments: Array.from({ length: 16 }, (_, index) => ({ podIndex: Math.floor(index / 4), venueId: `venue-${index % 4}`,
        sourceEventId: `access-${index}`, effectiveFromDay: selectedAtDay, geographySuitability: 3,
        travelCost: 1, neutralAccessibility: 5, developingOpportunity: 1 })),
      schedulePolicy: { version: 'qualifier-schedule-v1', gamesPerVenuePerDay: 1, minimumOffDaysBetweenRounds: 1 } };
    expect(() => initializeWorldBoundWbcQualifier(stores, { ...request,
      ranking: { ...request.ranking, careerId: 'foreign-career' } })).toThrow('scope');
    expect(qualification.readSnapshot('career-1', 'wbc-2040')).toBeNull();
    expect(() => initializeWorldBoundWbcQualifier({ ...stores,
      schedules: { initialize: () => { throw new Error('interrupted before schedule persistence'); } } }, request))
      .toThrow('interrupted before schedule persistence');
    expect(schedules.readSchedule('career-1', 'qualifier-2040')).toBeNull();
    const reopenedQualification = track(openSqliteWbcWorldQualificationStore(path,
      { selections, history: officialHistory, regional: qualificationHistory, nations }));
    const prepared = initializeWorldBoundWbcQualifier({ ...stores, qualification: reopenedQualification }, request);
    expect(prepared.qualification.direct.entrantNationIds).toHaveLength(20);
    expect(prepared.selection.entrants).toHaveLength(16);
    expect(prepared.ranking.evidenceResultIds).toHaveLength(220);
    // Captured before read reuse was enabled: the complete accepted source hashes stay identical.
    expect(prepared.qualification.snapshotId)
      .toBe('world-wbc-qualification:5096b302da8019c7609af7d6e9be2174c3a0520b90a9acd14073bd22327d03ff');
    expect(prepared.edition.snapshotId)
      .toBe('wbc-qualifier-edition:f8418b6108771fa37242fabe899ca251fb189d3c32a9b722821d8403c3294c95');
    expect(initializeWorldBoundWbcQualifier(stores, request)).toEqual(prepared);
    expect(completeWorldBoundWbcQualifier(stores, 'career-1', 'wbc-2040')).toBeNull();
    for (const slot of prepared.schedule.games) {
      const fixture = registerWbcQualifierFixtureFromWorld({ pods, schedules, matches }, { careerId: 'career-1',
        editionId: 'qualifier-2040', gameId: slot.gameId, gameDay: slot.gameDay });
      play(fixture, 'qualifier-2040', 'rules-v1', 'games-v1');
    }
    const allocation = completeWorldBoundWbcQualifier(stores, 'career-1', 'wbc-2040')!;
    expect(allocation.entrantNationIds).toHaveLength(24);
    expect(allocation.slots.filter((slot) => slot.route === 'GLOBAL_QUALIFIER')).toHaveLength(4);
    expect(allocation.slots.filter((slot) => slot.route !== 'GLOBAL_QUALIFIER')).toHaveLength(20);
    expect(completeWorldBoundWbcQualifier(stores, 'career-1', 'wbc-2040')).toEqual(allocation);
    expect(played).toBe(232);
    expect(qualification.readSnapshot('career-1', 'wbc-2040')).toEqual(prepared.qualification);
    expect(editions.readSnapshot('career-1', 'qualifier-2040')).toEqual(prepared.edition);
    expect(qualificationHistory.readHistory('career-1', selectedAtDay)?.qualifiers).toEqual([]);
    // US infrastructure is introduced after qualifier selection, preserving that frozen prefix.
    nations.record({ careerId: 'career-1', nationId: 'US', region: 'AMERICAS', effectiveFromDay: 3334,
      sourceEventId: 'US-final-host' });
    const worldSelection = selections.readSelection('career-1', 'wbc-2040')!;
    const profileInput = wbcFinalsInput(worldSelection.calendarWindow, worldSelection.qualificationCutoff.snapshotId);
    const publicVenue = { careerId: 'career-1', nationId: 'US', region: 'AMERICAS' as const,
      effectiveFromDay: 3334, licensed: true, safe: true, sourceClubId: null };
    profileInput.edition.groups.forEach((group, index) => infrastructure.record({ ...publicVenue,
      cityId: group.hostCityId, venueId: group.hostVenueId, sourceEventId: `us-pool-${index}`,
      metrics: { ...metrics, stadiumQuality: 50 - index, broadcastReadiness: 50 } }));
    profileInput.knockoutEdition.knockoutHubs.forEach((hub, index) => infrastructure.record({ ...publicVenue,
      ...hub, sourceEventId: `us-hub-${index}`, metrics: { ...metrics, stadiumCapacity: 9000,
        stadiumQuality: 60 - index, broadcastReadiness: 90 } }));
    infrastructure.record({ ...publicVenue, ...profileInput.knockoutEdition.finalFourHost,
      sourceEventId: 'us-final', metrics: { ...metrics, stadiumCapacity: 8000,
        stadiumQuality: 70, broadcastReadiness: 100 } });
    const draws = track(openSqliteNationalCompetitionDrawStore(path,
      { selections, rankings, history: rankingHistory, nations, wbcBerths: berths }));
    const nationalEditions: ReturnType<typeof openSqliteNationalCompetitionEditionStore> = track(openSqliteNationalCompetitionEditionStore(path,
      { draws, hosts: { readCandidates: (careerId, editionId, beforeDay) =>
        nationalHosts.readCandidates(careerId, editionId, beforeDay) } }));
    const nationalHosts = track(openSqliteNationalHostCandidateStore(path,
      { selections, infrastructure, history: rankingHistory, editions: nationalEditions }));
    const currentGroups = track(openSqliteWbcFinalsGroupStore(path,
      { selections, draws, editions: nationalEditions, berths, matches: matchSource }));
    currentFinals = track(openSqliteWbcFinalsKnockoutStore(path,
      { groups: currentGroups, editions: nationalEditions, matches: matchSource }));
    const currentSchedules = track(openSqliteWbcFinalsScheduleStore(path, { groups: currentGroups }));
    const finalsStores = { selections, rankings, draws, hosts: nationalHosts, editions: nationalEditions,
      groups: currentGroups, knockout: currentFinals, schedules: currentSchedules,
      history: officialHistory, rankingHistory };
    const drawPolicy = { version: profileInput.edition.drawPolicyVersion, rematchLookbackDays: 10000,
      relaxationOrder: ['REMATCH_AVOIDANCE', 'REGIONAL_DIVERSITY', 'SAME_LEAGUE_AVOIDANCE'] as const };
    const finalsRequest = { ranking: { ...request.ranking, asOfDay: worldSelection.qualificationCutoff.day },
      draw: { careerId: 'career-1', editionId: 'wbc-2040', kind: 'WBC' as const, drawSeed: 'current-finals-draw',
        policy: drawPolicy, registry: registerCompetitionDrawPolicy(EMPTY_COMPETITION_DRAW_POLICY_REGISTRY, drawPolicy) },
      hosts: { careerId: 'career-1', editionId: 'wbc-2040', policy: {
        kind: 'WBC' as const, version: profileInput.edition.hostingPolicyVersion, knockoutHubCount: 2,
        minimums: { GROUP: metrics, KNOCKOUT: { ...metrics, stadiumCapacity: 9000, broadcastReadiness: 80 },
          FINAL_FOUR: { ...metrics, stadiumCapacity: 8000, broadcastReadiness: 100 } },
        suitabilityWeights: { ...metrics, stadiumCapacity: 0, stadiumQuality: 1, transportQuality: 0,
          accommodationCapacity: 0, broadcastReadiness: 0, operationsQuality: 0 },
        rotation: { lookbackDays: 1000, cityPenalty: 1, nationPenalty: 2, regionPenalty: 3 } } },
      edition: { careerId: 'career-1', editionId: 'wbc-2040', profile: {
        kind: 'WBC' as const, competitionId: profileInput.edition.competitionId, formatVersion: profileInput.edition.formatVersion,
        ruleProfileVersion: profileInput.edition.ruleProfileVersion, gamePolicyVersion: profileInput.edition.gamePolicyVersion,
        hostingPolicyVersion: profileInput.edition.hostingPolicyVersion, groupTiebreakPolicy: profileInput.edition.groupTiebreakPolicy,
        thirdPlacePolicy: profileInput.edition.thirdPlacePolicy, knockoutPolicy: {
          knockoutPolicyVersion: profileInput.knockoutEdition.knockoutPolicyVersion,
          roundOf16Pairs: profileInput.knockoutEdition.roundOf16Pairs,
          roundOf16HubIndices: profileInput.knockoutEdition.roundOf16HubIndices,
          quarterfinalHubIndices: profileInput.knockoutEdition.quarterfinalHubIndices } } },
      schedulePolicy: { version: 'current-finals-schedule-v1', gamesPerVenuePerDay: 2, minimumOffDaysBetweenRounds: 1 } };
    expect(() => initializeWorldBoundWbcFinals(finalsStores, { ...finalsRequest,
      ranking: { ...finalsRequest.ranking, asOfDay: selectedAtDay } })).toThrow('scope or cutoff');
    expect(draws.readDraw('career-1', 'wbc-2040')).toBeNull();
    expect(() => initializeWorldBoundWbcFinals(finalsStores, { ...finalsRequest,
      draw: { ...finalsRequest.draw, registry: EMPTY_COMPETITION_DRAW_POLICY_REGISTRY } })).toThrow('registered version');
    expect(rankings.readRanking('career-1', worldSelection.qualificationCutoff.day)).toBeNull();
    const readCurrentRanking = createCompetitionSourceReader(rankings.readRanking, rankings);
    const readCurrentEdition = createCompetitionSourceReader(nationalEditions.readSnapshot, nationalEditions);
    withCompetitionSourceReadScope(() => {
      expect(readCurrentRanking('career-1', worldSelection.qualificationCutoff.day)).toBeNull();
      expect(readCurrentEdition('career-1', 'wbc-2040')).toBeNull();
      expect(() => initializeWorldBoundWbcFinals({ ...finalsStores, schedules: {
        initialize: () => { throw new Error('interrupted finals schedule'); } } }, finalsRequest)).toThrow('interrupted finals schedule');
      expect(readCurrentRanking('career-1', worldSelection.qualificationCutoff.day)).not.toBeNull();
      expect(readCurrentEdition('career-1', 'wbc-2040')).not.toBeNull();
    });
    const reopenedEditions = track(openSqliteNationalCompetitionEditionStore(path, { draws, hosts: nationalHosts }));
    const preparedFinals = initializeWorldBoundWbcFinals({ ...finalsStores, editions: reopenedEditions }, finalsRequest);
    expect(preparedFinals.edition.kind).toBe('WBC');
    expect(preparedFinals.edition.hosting.hostNationIds).toEqual(['US']);
    expect(preparedFinals.edition.source.draw.source.berths).toEqual(allocation);
    // Captured before pure draw computation reuse: current source/output identity is unchanged.
    expect(preparedFinals.draw.drawSnapshotId)
      .toBe('national-draw:445fe396de6af1684e5f73a39f6cacd8375bf2d7f1949dacafdda8c90fc27434');
    expect(preparedFinals.edition.source.draw.source.ranking.evidenceResultIds).toHaveLength(220);
    expect(preparedFinals.schedule.games).toHaveLength(51);
    expect(completeWorldBoundWbcFinals(finalsStores, 'career-1', 'wbc-2040')).toBeNull();
    expect(officialHistory.readEdition('career-1', 'wbc-2040')).toBeNull();
    expect(initializeWorldBoundWbcKnockout(finalsStores, 'career-1', 'wbc-2040')).toBeNull();
    for (const slot of preparedFinals.schedule.games) {
      if (slot.stage === 'ROUND_OF_16' && !currentFinals.readPlan('career-1', 'wbc-2040')) {
        expect(initializeWorldBoundWbcKnockout(finalsStores, 'career-1', 'wbc-2040')).not.toBeNull();
      }
      play(registerWbcFinalsFixtureFromWorld({ groups: currentGroups, knockout: currentFinals,
        schedules: currentSchedules, matches }, { careerId: 'career-1', editionId: 'wbc-2040',
        gameId: slot.gameId, gameDay: slot.gameDay }), 'wbc-2040',
      profileInput.edition.ruleProfileVersion, profileInput.edition.gamePolicyVersion);
    }
    expect(() => completeWorldBoundWbcFinals({ ...finalsStores, rankingHistory: {
      recordWbc: () => { throw new Error('interrupted ranking adoption'); } } }, 'career-1', 'wbc-2040'))
      .toThrow('interrupted ranking adoption');
    expect(officialHistory.readEdition('career-1', 'wbc-2040')?.games).toHaveLength(51);
    const completedFinals = completeWorldBoundWbcFinals(finalsStores, 'career-1', 'wbc-2040')!;
    expect(completedFinals.history.games).toHaveLength(51);
    expect(completedFinals.ranking.editions.find((entry) => entry.editionId === 'wbc-2040')?.games).toHaveLength(51);
    expect(completeWorldBoundWbcFinals(finalsStores, 'career-1', 'wbc-2040')).toEqual(completedFinals);
    expect(played).toBe(283);
    expect(nationalEditions.readSnapshot('career-1', 'wbc-2040')).toEqual(preparedFinals.edition);
    expect(editions.readSnapshot('career-1', 'qualifier-2040')).toEqual(prepared.edition);
    const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
    const db = new DatabaseSync(path);
    try {
      const original = db.prepare('SELECT snapshot_json FROM world_wbc_world_qualifications').get()!.snapshot_json as string;
      db.prepare("UPDATE world_wbc_world_qualifications SET snapshot_json='{}'").run();
      expect(() => editions.readSnapshot('career-1', 'qualifier-2040')).toThrow('corrupt');
      expect(() => nationalEditions.readSnapshot('career-1', 'wbc-2040')).toThrow('corrupt');
      db.prepare('UPDATE world_wbc_world_qualifications SET snapshot_json=?').run(original);
      expect(editions.readSnapshot('career-1', 'qualifier-2040')).toEqual(prepared.edition);
    } finally { db.close(); }
  } finally { closables.reverse().forEach((store) => store.close()); rmSync(directory, { recursive: true, force: true }); }
}, 600000);
