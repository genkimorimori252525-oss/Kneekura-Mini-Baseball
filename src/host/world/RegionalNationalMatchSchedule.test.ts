import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { planRegionalNationalGroups } from '../../core/world/competition/RegionalNationalGroups';
import { planRegionalNationalSchedule } from '../../core/world/competition/RegionalNationalSchedule';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { openSqliteNationCompetitionRegionStore } from './SqliteNationCompetitionRegionStore';
import { openSqliteRegionalNationalGroupStore } from './SqliteRegionalNationalGroupStore';
import { openSqliteRegionalNationalKnockoutStore } from './SqliteRegionalNationalKnockoutStore';
import { openSqliteRegionalNationalScheduleStore } from './SqliteRegionalNationalScheduleStore';
import { registerRegionalNationalFixtureFromWorld } from './RegionalNationalFixtureFromWorld';
import { openSqliteWorldCompetitionCycleStore } from './SqliteWorldCompetitionCycleStore';
import { openSqliteNationalCompetitionSelectionStore } from './SqliteNationalCompetitionSelectionStore';
import { openSqliteNationalQualificationHistoryStore } from './SqliteNationalQualificationHistoryStore';
import { openSqliteWorldNationalRankingHistoryStore } from './SqliteWorldNationalRankingHistoryStore';
import { worldCycleInput } from './WorldCompetitionCycleFixtures.test-support';
import { playOfficialNineInningGame } from './OfficialNineInningGame.test-support';
import { openSqliteRegionalNationalRankingSnapshotStore } from './SqliteRegionalNationalRankingSnapshotStore';
import { EMPTY_WORLD_NATIONAL_RANKING_POLICY_REGISTRY, registerWorldNationalRankingPolicy } from '../../core/world/competition/WorldNationalRankingHistory';
import { createCompetitionSourceReader, withCompetitionSourceReadScope } from './CompetitionSourceReadScope';
import { openSqliteRegionalNationalDrawStore } from './SqliteRegionalNationalDrawStore';
import { EMPTY_COMPETITION_DRAW_POLICY_REGISTRY, registerCompetitionDrawPolicy } from '../../core/world/competition/CompetitionDraw';
import { openSqliteWorldHostInfrastructureStore } from './SqliteWorldHostInfrastructureStore';
import { openSqliteRegionalNationalHostCandidateStore } from './SqliteRegionalNationalHostCandidateStore';
import { selectRegionalNationalHosts } from '../../core/world/competition/RegionalNationalHosting';

const policy = { version: 'regional-test-schedule-v1', gamesPerVenuePerDay: 2,
  minimumOffDaysBetweenRounds: 0 };
import { regionalNationalInput as inputs } from './RegionalNationalFixtures.test-support';

it('plans 8, 12 and 16 nation editions before knockout entrants qualify', () => {
  for (const [count, total] of [[2, 15], [3, 25], [4, 31]]) {
    const { edition, knockoutEdition } = inputs('EUROPE', count, { startsOnDay: 10, endsOnDay: 30 });
    const plan = planRegionalNationalGroups(edition, { nationCompetitionRegion: () => 'EUROPE' });
    const schedule = planRegionalNationalSchedule(edition, plan, knockoutEdition, policy);
    expect(schedule.games).toHaveLength(total);
    expect(schedule.games.filter((game) => game.stage === 'GROUP')).toHaveLength(count * 6);
    expect(new Set(schedule.games.map((game) => game.gameId)).size).toBe(total);
    expect(Object.isFrozen(schedule.source.knockoutEdition.openingPairs[0])).toBe(true);
    const short = { ...edition, calendarWindow: { startsOnDay: 10, endsOnDay: 11 } };
    expect(() => planRegionalNationalSchedule(short, plan, knockoutEdition, policy)).toThrow('full schedule');
    expect(() => planRegionalNationalSchedule(edition, plan,
      { ...knockoutEdition, groupDrawSnapshotId: 'foreign' }, policy)).toThrow('knockout');
    expect(() => planRegionalNationalSchedule(edition, { ...plan, drawSnapshotId: 'foreign' },
      knockoutEdition, policy)).toThrow('matching');
    expect(() => planRegionalNationalSchedule(edition, plan, knockoutEdition,
      { ...policy, gamesPerVenuePerDay: 0 })).toThrow('policy');
    expect(() => planRegionalNationalSchedule(edition, plan,
      { ...knockoutEdition, openingPairs: knockoutEdition.openingPairs.map(() => [0, 1]) }, policy))
      .toThrow('knockout');
    const nationsOnDay = new Set<string>();
    for (const slot of schedule.games.filter((game) => game.stage === 'GROUP')) {
      const game = plan.groups.flatMap((group) => group.games).find((item) => item.gameId === slot.gameId)!;
      for (const nation of [game.homeNationId, game.awayNationId]) {
        const key = `${nation}:${slot.gameDay}`;
        expect(nationsOnDay.has(key)).toBe(false); nationsOnDay.add(key);
      }
    }
  }
});

it('plays all four recommended regional finals through World schedules, Match and qualification history', () => {
  const directory = mkdtempSync(join(tmpdir(), 'regional-national-match-'));
  const path = join(directory, 'world.sqlite'), matchPath = join(directory, 'matches.sqlite');
  const closables: { close(): void }[] = [];
  const track = <T extends { close(): void }>(store: T): T => { closables.push(store); return store; };
  let matches = new SqliteOfficialStateStore(matchPath);
  closables.push({ close: () => matches.close() });
  const matchSource = { getMatch: (gameId: string) => matches.getMatch(gameId),
    getOfficialFixture: (gameId: string) => matches.getOfficialFixture(gameId) };
  try {
    const cycle = track(openSqliteWorldCompetitionCycleStore(path));
    cycle.initialize('career-1', worldCycleInput(0));
    const selections = track(openSqliteNationalCompetitionSelectionStore(path, { cycle }));
    const regions = track(openSqliteNationCompetitionRegionStore(path));
    const infrastructure = track(openSqliteWorldHostInfrastructureStore(path, { nations: regions }));
    const hostMetrics = { stadiumCapacity: 100, stadiumQuality: 10, transportQuality: 10,
      accommodationCapacity: 100, broadcastReadiness: 10, operationsQuality: 10 };
    const source = { regions, matches: matchSource, selections };
    let groups = track(openSqliteRegionalNationalGroupStore(path, source));
    let knockout = track(openSqliteRegionalNationalKnockoutStore(path, { groups, regions, matches: matchSource }));
    let schedules = track(openSqliteRegionalNationalScheduleStore(path, { groups, selections }));
    const qualification = track(openSqliteNationalQualificationHistoryStore(path,
      { knockouts: { readEvidence: (careerId, editionId) => knockout.readEvidence(careerId, editionId) } }));
    qualification.initialize('career-1', { ASIA_PACIFIC: 'regional-ASIA_PACIFIC', AMERICAS: 'regional-AMERICAS',
      EUROPE: 'regional-EUROPE', AFRICA: 'regional-AFRICA' });
    const ranking = track(openSqliteWorldNationalRankingHistoryStore(path,
      { regional: { readEvidence: (careerId, editionId) => knockout.readEvidence(careerId, editionId) },
        wbc: { readEvidence: () => null }, nations: regions }));
    let played = 0;
    for (const region of ['ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'] as const) {
      const selection = selections.initialize({ careerId: 'career-1', editionId: `${region}-2031`,
        kind: 'REGIONAL_NATIONAL', region, cycleOrdinal: 0, careerDayOne: '2031-01-01', cutoffDay: 100 });
      const { edition, knockoutEdition } = inputs(region, region === 'AFRICA' ? 3 : 4, selection.calendarWindow);
      edition.groups.flatMap((group) => group.nationIds).forEach((nationId) => regions.record({
        careerId: 'career-1', nationId, region, effectiveFromDay: 0, sourceEventId: `region-${nationId}` }));
      regions.record({ careerId: 'career-1', nationId: edition.hostNationIds[0], region, effectiveFromDay: 0,
        sourceEventId: `region-${edition.hostNationIds[0]}` });
      const venueCities = new Map(edition.groups.map((group) => [group.hostVenueId, group.hostCityId]));
      for (const venueId of [...knockoutEdition.openingVenueIds, ...knockoutEdition.semifinalVenueIds, knockoutEdition.finalVenueId]) {
        venueCities.set(venueId, `city-${venueId}`);
      }
      for (const [venueId, cityId] of venueCities) infrastructure.record({ careerId: 'career-1', venueId, cityId,
        nationId: edition.hostNationIds[0], region, effectiveFromDay: 0, sourceEventId: `opened-${venueId}`,
        sourceClubId: null, licensed: true, safe: true, metrics: { ...hostMetrics, stadiumQuality: 100, broadcastReadiness: 30 } });
      expect(() => groups.initialize('career-1', { ...edition,
        calendarWindow: { ...edition.calendarWindow, endsOnDay: edition.calendarWindow.endsOnDay + 1 } }))
        .toThrow('accepted World selection');
      const plan = groups.initialize('career-1', edition);
      const request = { careerId: 'career-1', editionId: edition.editionId, knockoutEdition, policy };
      const schedule = schedules.initialize(request);
      expect(schedules.initialize(request)).toEqual(schedule);
      expect(() => schedules.initialize({ ...request, policy: { ...policy, minimumOffDaysBetweenRounds: 1 } }))
        .toThrow('frozen differently');
      const changedCutoff = track(openSqliteRegionalNationalScheduleStore(path, { groups,
        selections: { readSelection: () => ({ ...selection,
          qualificationCutoff: { snapshotId: 'alternate-valid-cutoff', day: 99 } }) } }));
      expect(() => changedCutoff.readSchedule('career-1', edition.editionId)).toThrow('corrupt');
      const register = (gameId: string, gameDay = schedule.games.find((game) => game.gameId === gameId)!.gameDay) =>
        registerRegionalNationalFixtureFromWorld({ groups, knockout, schedules, matches },
          { careerId: 'career-1', editionId: edition.editionId, gameId, gameDay });
      const play = (gameId: string): void => {
        const fixture = register(gameId);
        const result = playOfficialNineInningGame(matches, { ...fixture.game, seasonId: edition.editionId,
          ruleProfileVersion: edition.ruleProfileVersion, gamePolicyVersion: edition.gamePolicyVersion,
          binding: fixture.binding });
        expect(result.durableRevision).toBe(60); played++;
      };
      const reopen = (): void => {
        schedules.close(); knockout.close(); groups.close(); matches.close();
        matches = new SqliteOfficialStateStore(matchPath);
        groups = track(openSqliteRegionalNationalGroupStore(path, source));
        knockout = track(openSqliteRegionalNationalKnockoutStore(path, { groups, regions, matches: matchSource }));
        schedules = track(openSqliteRegionalNationalScheduleStore(path, { groups, selections }));
        expect(groups.readPlan('career-1', edition.editionId)).toEqual(plan);
        expect(schedules.readSchedule('career-1', edition.editionId)).toEqual(schedule);
      };
      const groupSlots = schedule.games.filter((game) => game.stage === 'GROUP');
      const quarters = schedule.games.filter((game) => game.stage === 'QUARTERFINAL');
      const semis = schedule.games.filter((game) => game.stage === 'SEMIFINAL');
      const final = schedule.games.find((game) => game.stage === 'FINAL')!;
      expect(() => register(groupSlots[0].gameId, groupSlots[0].gameDay + 1)).toThrow('accepted schedule');
      expect(() => register('unknown-game', groupSlots[0].gameDay)).toThrow('accepted schedule');
      expect(matches.getOfficialFixture(groupSlots[0].gameId)).toBeNull();
      expect(() => register(quarters[0].gameId)).toThrow('not yet qualified');
      groupSlots.slice(0, -1).forEach((game) => play(game.gameId));
      expect(groups.finalize('career-1', edition.editionId)).toBeNull(); reopen();
      play(groupSlots.at(-1)!.gameId); groups.finalize('career-1', edition.editionId);
      knockout.initialize('career-1', knockoutEdition);
      if (region === 'ASIA_PACIFIC') {
        const alternateKnockout = track(openSqliteRegionalNationalKnockoutStore(':memory:',
          { groups, regions, matches: matchSource }));
        alternateKnockout.initialize('career-1', { ...knockoutEdition,
          placementPolicy: { ...knockoutEdition.placementPolicy, drawSeed: 'another-seed-same-games' } });
        expect(() => registerRegionalNationalFixtureFromWorld({ groups, knockout: alternateKnockout,
          schedules, matches }, { careerId: 'career-1', editionId: edition.editionId,
          gameId: quarters[0].gameId, gameDay: quarters[0].gameDay })).toThrow('accepted schedule Edition');
        expect(matches.getOfficialFixture(quarters[0].gameId)).toBeNull();
        alternateKnockout.close();
      }
      quarters.slice(0, -1).forEach((game) => play(game.gameId));
      expect(() => register(semis[0].gameId)).toThrow('not yet qualified'); reopen();
      play(quarters.at(-1)!.gameId);
      play(semis[0].gameId);
      expect(() => register(final.gameId)).toThrow('not yet qualified'); reopen();
      play(semis[1].gameId); play(final.gameId);
      const outcome = knockout.finalize('career-1', edition.editionId)!;
      expect(outcome.placement.orderedNationIds).toHaveLength(edition.groups.length * 4);
      expect(qualification.recordRegional('career-1', region, edition.editionId).regional
        .find((item) => item.placement.region === region)?.placement.orderedNationIds)
        .toEqual(outcome.placement.orderedNationIds);
      const readAcceptedEdition = createCompetitionSourceReader(ranking.readRegionalEdition, ranking);
      withCompetitionSourceReadScope(() => {
        expect(readAcceptedEdition('career-1', edition.editionId, edition.calendarWindow.endsOnDay)).toBeNull();
        ranking.recordRegional('career-1', edition.editionId);
        expect(readAcceptedEdition('career-1', edition.editionId, edition.calendarWindow.endsOnDay)).toEqual(edition);
        expect(ranking.readRegionalHostingEdition('career-1', edition.editionId, edition.calendarWindow.endsOnDay))
          .toEqual({ edition, knockoutEdition });
      });
    }
    expect(played).toBe(118);
    expect(ranking.readHistory('career-1').editions).toHaveLength(4);
    expect(qualification.readHistory('career-1')?.regional).toHaveLength(4);
    const completionDay = selections.readSelection('career-1', 'AFRICA-2031')!.calendarWindow.endsOnDay;
    const regionalRankingPolicy = { version: 'regional-ranking-v1', winPoints: 2, tiePoints: 1,
      tierWeights: { REGIONAL: 1, WBC: 0, PREMIER_12: 0 },
      stageWeights: { GROUP: 1, ROUND_OF_16: 1, QUARTERFINAL: 2, SEMIFINAL: 3, BRONZE: 1, FINAL: 4 },
      recencyBands: [{ maxAgeDays: 2000, multiplier: 1 }], tieBreak: 'NATION_ID' as const };
    const regionalRegistry = registerWorldNationalRankingPolicy(EMPTY_WORLD_NATIONAL_RANKING_POLICY_REGISTRY, regionalRankingPolicy);
    const rankingSources = { history: ranking, nations: regions };
    let regionalRankings = track(openSqliteRegionalNationalRankingSnapshotStore(path, rankingSources));
    const savedRankings = (['ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'] as const).map((region) => {
      const nationIds = inputs(region, region === 'AFRICA' ? 3 : 4, { startsOnDay: 0, endsOnDay: 1 })
        .edition.groups.flatMap((group) => group.nationIds);
      const request = { careerId: 'career-1', region, asOfDay: completionDay, nationIds, policy: regionalRankingPolicy, registry: regionalRegistry };
      const saved = regionalRankings.initialize(request);
      expect(saved.ranking.orderedNationIds[0]).toBe(`${region}-0`);
      expect(saved.source.history.editions).toHaveLength(1);
      expect(saved.ranking.evidenceResultIds).toHaveLength(region === 'AFRICA' ? 25 : 31);
      expect(regionalRankings.initialize(request)).toEqual(saved);
      expect(() => regionalRankings.initialize({ ...request, nationIds: [...nationIds].reverse() })).toThrow('frozen differently');
      expect(regionalRankings.readRanking('career-1', region, completionDay - 1)).toBeNull();
      return { region, saved };
    });
    regionalRankings.close(); regionalRankings = track(openSqliteRegionalNationalRankingSnapshotStore(path, rankingSources));
    for (const { region, saved } of savedRankings) expect(regionalRankings.readRanking('career-1', region, completionDay)).toEqual(saved.ranking);
    cycle.initialize('career-1', worldCycleInput(1));
    const drawPolicy = { version: 'regional-next-cycle-draw-fixture-v1', rematchLookbackDays: 2000,
      relaxationOrder: ['REMATCH_AVOIDANCE', 'SAME_LEAGUE_AVOIDANCE', 'REGIONAL_DIVERSITY'] as const };
    const drawRegistry = registerCompetitionDrawPolicy(EMPTY_COMPETITION_DRAW_POLICY_REGISTRY, drawPolicy);
    const regionalHosts = track(openSqliteRegionalNationalHostCandidateStore(path, { selections, nations: regions, infrastructure, history: ranking }));
    const hostPolicy = { version: 'regional-next-host-fixture-v1', hostNationCount: 1 as const, groupHostVenueCount: 2, knockoutHubCount: 1,
      minimums: { GROUP: hostMetrics, KNOCKOUT: { ...hostMetrics, broadcastReadiness: 20 }, FINAL_FOUR: { ...hostMetrics, broadcastReadiness: 30 } },
      suitabilityWeights: { ...hostMetrics, stadiumCapacity: 0, stadiumQuality: 1, transportQuality: 0, accommodationCapacity: 0,
        broadcastReadiness: 0, operationsQuality: 0 }, rotation: { lookbackDays: 2000, cityPenalty: 0, nationPenalty: 10000, regionPenalty: 0 } };
    for (const { region } of savedRankings) {
      const selection = selections.initialize({ careerId: 'career-1', editionId: `${region}-2035`,
        kind: 'REGIONAL_NATIONAL', region, cycleOrdinal: 1, careerDayOne: '2031-01-01', cutoffDay: 1500 });
      const manual = inputs(region, region === 'AFRICA' ? 3 : 4, selection.calendarWindow);
      const nationIds = manual.edition.groups.flatMap((group) => group.nationIds);
      const nativeRanking = regionalRankings.initialize({ careerId: 'career-1', region, asOfDay: 1500, nationIds,
        policy: regionalRankingPolicy, registry: regionalRegistry });
      // Cohort and venue/profile metadata remain fixtures here. The draw unit gate uses actual
      // Native Player legal facts/callups/roster capability; this gate uses actual prior Match history.
      const eligibility = { snapshotId: `accepted-next-cycle-cohort-${region}`, asOfDay: 1500, eligibleNationIds: nationIds };
      const draws = track(openSqliteRegionalNationalDrawStore(':memory:', { selections, nations: regions,
        rankings: regionalRankings, eligibility: { readEligibilityForEdition: (_career, edition, snapshot) =>
          edition === selection.editionId && snapshot === eligibility.snapshotId ? eligibility : null } }));
      const accepted = draws.initialize({ careerId: 'career-1', editionId: selection.editionId,
        eligibilitySnapshotId: eligibility.snapshotId, drawSeed: `regional-2035-${region}`, policy: drawPolicy, registry: drawRegistry });
      expect(accepted.source.ranking).toEqual(nativeRanking);
      expect(accepted.source.rematchHistory.editions).toHaveLength(1);
      expect(accepted.source.ranking.ranking.evidenceResultIds).toHaveLength(region === 'AFRICA' ? 25 : 31);
      const hostNationId = `next-host-${region}`;
      regions.record({ careerId: 'career-1', nationId: hostNationId, region, effectiveFromDay: 1400, sourceEventId: `region-${hostNationId}` });
      for (let index = 0; index < 2; index++) infrastructure.record({ careerId: 'career-1', venueId: `next-${region}-venue-${index}`,
        cityId: `next-${region}-city-${index}`, nationId: hostNationId, region, effectiveFromDay: 1400,
        sourceEventId: `opened-next-${region}-${index}`, sourceClubId: null, licensed: true, safe: true,
        metrics: { ...hostMetrics, stadiumQuality: 50 - index, broadcastReadiness: 30 } });
      const hosts = regionalHosts.initialize({ careerId: 'career-1', editionId: selection.editionId, policy: hostPolicy });
      expect(hosts.source.hostingHistory).toHaveLength(1);
      expect(hosts.source.hostingHistory[0].hosts).toHaveLength(region === 'AFRICA' ? 10 : 11);
      expect(hosts.source.previousEditions[0].knockoutEdition.finalVenueId).toBe(`${region}-final`);
      const selectedHosts = selectRegionalNationalHosts(hosts);
      expect(selectedHosts.hostNationIds).toEqual([hostNationId]);
      expect(accepted.draw.groups.flatMap((group) => group.map((item) => item.teamId))).not.toContain(hostNationId);
      expect(regionalHosts.readCandidates('career-1', selection.editionId, 1500)).toEqual(hosts);
      const edition = { ...manual.edition, editionId: selection.editionId,
        qualificationSnapshotId: eligibility.snapshotId, drawSnapshotId: accepted.drawSnapshotId,
        groups: manual.edition.groups.map((group, index) => ({ ...group,
          nationIds: accepted.draw.groups[index].map((row) => row.teamId) })) };
      const drawnGroups = track(openSqliteRegionalNationalGroupStore(':memory:', { ...source, draws }));
      expect(drawnGroups.initialize('career-1', edition).groups).toHaveLength(region === 'AFRICA' ? 3 : 4);
      expect(draws.readDraw('career-1', selection.editionId)).toEqual(accepted);
    }
    const movedNation = 'ASIA_PACIFIC-0';
    const priorEdition = ranking.readRegionalEdition('career-1', 'ASIA_PACIFIC-2031', completionDay)!;
    regions.record({ careerId: 'career-1', nationId: movedNation, region: 'AMERICAS',
      effectiveFromDay: priorEdition.calendarWindow.startsOnDay + 1, sourceEventId: 'moved-during-tournament' });
    const movedSnapshot = regionalRankings.initialize({ careerId: 'career-1', region: 'ASIA_PACIFIC', asOfDay: completionDay + 1,
      nationIds: priorEdition.groups.flatMap((group) => group.nationIds).filter((nation) => nation !== movedNation),
      policy: regionalRankingPolicy, registry: regionalRegistry });
    expect(movedSnapshot.ranking.orderedNationIds).not.toContain(movedNation);
    expect(movedSnapshot.ranking.evidenceResultIds).toHaveLength(31);
    expect(movedSnapshot.source.nationRegions.find((proof) => proof.nationId === movedNation))
      .toMatchObject({ beforeDay: priorEdition.calendarWindow.startsOnDay, region: 'ASIA_PACIFIC' });
    expect(ranking.readRegionalEdition('career-1', 'ASIA_PACIFIC-2031', completionDay - 1)).toBeNull();
    const unavailableSources = track(openSqliteNationalQualificationHistoryStore(path,
      { knockouts: { readEvidence: () => { throw new Error('later regional requires earlier qualification'); } } }));
    expect(unavailableSources.regionalAuthority('career-1')
      .regionalChampionship('AFRICA', completionDay - 1)).toBeNull();
    expect(unavailableSources.readHistory('career-1', completionDay - 1)?.regional).toEqual([]);
    expect(() => unavailableSources.regionalAuthority('career-1')
      .regionalChampionship('AFRICA', completionDay)).toThrow('corrupt');
    expect(() => unavailableSources.readHistory('career-1')).toThrow('corrupt');
    expect(() => unavailableSources.regionalAuthority('career-1')
      .regionalChampionship('AFRICA', -1)).toThrow('invalid');
    expect(qualification.readHistory('career-1', completionDay)?.regional).toHaveLength(4);
    const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
    const db = new DatabaseSync(path);
    try {
      db.prepare("UPDATE world_regional_national_ranking_snapshots SET snapshot_json='{}' WHERE region='EUROPE'").run();
      expect(() => regionalRankings.readRanking('career-1', 'EUROPE', completionDay)).toThrow('corrupt');
      db.prepare("UPDATE world_regional_national_schedules SET schedule_json='{}'").run();
    }
    finally { db.close(); }
    expect(() => schedules.readSchedule('career-1', 'AFRICA-2031')).toThrow('corrupt');
  } finally {
    closables.reverse().forEach((store) => store.close());
    rmSync(directory, { recursive: true, force: true });
  }
});
