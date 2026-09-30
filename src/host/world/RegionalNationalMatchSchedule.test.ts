import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { RegionalNationalEdition } from '../../core/world/competition/RegionalNationalGroups';
import { planRegionalNationalGroups } from '../../core/world/competition/RegionalNationalGroups';
import type { RegionalNationalKnockoutEdition } from '../../core/world/competition/RegionalNationalKnockout';
import { planRegionalNationalSchedule } from '../../core/world/competition/RegionalNationalSchedule';
import type { ClubWorldRegion } from '../../core/world/competition/ClubWorldBerths';
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

const policy = { version: 'regional-test-schedule-v1', gamesPerVenuePerDay: 2,
  minimumOffDaysBetweenRounds: 0 };
const inputs = (region: ClubWorldRegion, groupCount: number,
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
      ranking.recordRegional('career-1', edition.editionId);
    }
    expect(played).toBe(118);
    expect(ranking.readHistory('career-1').editions).toHaveLength(4);
    expect(qualification.readHistory('career-1')?.regional).toHaveLength(4);
    const completionDay = selections.readSelection('career-1', 'AFRICA-2031')!.calendarWindow.endsOnDay;
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
    try { db.prepare("UPDATE world_regional_national_schedules SET schedule_json='{}'").run(); }
    finally { db.close(); }
    expect(() => schedules.readSchedule('career-1', 'AFRICA-2031')).toThrow('corrupt');
  } finally {
    closables.reverse().forEach((store) => store.close());
    rmSync(directory, { recursive: true, force: true });
  }
});
