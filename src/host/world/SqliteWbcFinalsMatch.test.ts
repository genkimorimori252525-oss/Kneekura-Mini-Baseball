import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { EMPTY_WORLD_NATIONAL_RANKING_POLICY_REGISTRY, registerWorldNationalRankingPolicy } from
  '../../core/world/competition/WorldNationalRankingHistory';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { playOfficialNineInningGame } from './OfficialNineInningGame.test-support';
import { registerWbcFinalsFixtureFromWorld } from './WbcFinalsFixtureFromWorld';
import { openSqliteWbcFinalsScheduleStore } from './SqliteWbcFinalsScheduleStore';
import { openSqliteWbcFinalsGroupStore } from './SqliteWbcFinalsGroupStore';
import { openSqliteWbcFinalsKnockoutStore } from './SqliteWbcFinalsKnockoutStore';
import { openSqliteOfficialWbcHistoryStore } from './SqliteOfficialWbcHistoryStore';
import { openSqliteWorldNationalRankingHistoryStore } from './SqliteWorldNationalRankingHistoryStore';
import { openSqliteWorldNationalRankingSnapshotStore } from './SqliteWorldNationalRankingSnapshotStore';
import { openSqliteNationCompetitionRegionStore } from './SqliteNationCompetitionRegionStore';
import { openSqliteWorldCompetitionCycleStore } from './SqliteWorldCompetitionCycleStore';
import { openSqliteNationalCompetitionSelectionStore } from './SqliteNationalCompetitionSelectionStore';
import { worldCycleInput } from './WorldCompetitionCycleFixtures.test-support';
import { wbcFinalsInput } from './WbcFinalsFixtures.test-support';

const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');

it('plays all 51 scheduled WBC games through durable Match, history and rankings after partial restarts', () => {
  const directory = mkdtempSync(join(tmpdir(), 'wbc-finals-match-'));
  const path = join(directory, 'world.sqlite');
  const matchPath = join(directory, 'matches.sqlite');
  const closables: { close(): void }[] = [];
  const track = <T extends { close(): void }>(store: T): T => {
    closables.push(store);
    return store;
  };
  let matches = new SqliteOfficialStateStore(matchPath);
  closables.push({ close: () => matches.close() });
  const matchSource = { getMatch: (gameId: string) => matches.getMatch(gameId),
    getOfficialFixture: (gameId: string) => matches.getOfficialFixture(gameId) };
  try {
    const cycle = track(openSqliteWorldCompetitionCycleStore(path));
    cycle.initialize('career-1', worldCycleInput(0));
    const selections = track(openSqliteNationalCompetitionSelectionStore(path, { cycle }));
    const selection = selections.initialize({ careerId: 'career-1', editionId: 'wbc-2032',
      cycleOrdinal: 0, kind: 'WBC', careerDayOne: '2031-01-01', cutoffDay: 400 });
    const input = wbcFinalsInput(selection.calendarWindow, selection.qualificationCutoff.snapshotId);
    const { edition, knockoutEdition, berths } = input;
    const sources = { berths: { readAllocation: () => berths }, matches: matchSource, selections };
    let groups = track(openSqliteWbcFinalsGroupStore(path, sources));
    expect(() => groups.initialize({ careerId: 'career-1', edition: { ...edition,
      calendarWindow: { ...edition.calendarWindow, endsOnDay: edition.calendarWindow.endsOnDay + 1 } } }))
      .toThrow('accepted World selection');
    const plan = groups.initialize({ careerId: 'career-1', edition });
    let schedules = track(openSqliteWbcFinalsScheduleStore(path, { groups }));
    const request = { careerId: 'career-1', editionId: edition.editionId, knockoutEdition,
      policy: { version: 'wbc-test-schedule-v1', gamesPerVenuePerDay: 2,
        minimumOffDaysBetweenRounds: 1 } };
    const schedule = schedules.initialize(request);
    expect(schedules.initialize(request)).toEqual(schedule);
    expect(schedule.games).toHaveLength(51);
    const alternateGroups = track(openSqliteWbcFinalsGroupStore(':memory:', sources));
    alternateGroups.initialize({ careerId: 'career-1', edition: { ...edition,
      hostingPolicyVersion: 'different-host-version-same-slot-ids' } });
    const alternateSchedules = track(openSqliteWbcFinalsScheduleStore(path, { groups: alternateGroups }));
    expect(() => alternateSchedules.readSchedule('career-1', edition.editionId)).toThrow('corrupt');
    expect(() => schedules.initialize({ ...request, knockoutEdition: { ...knockoutEdition,
      knockoutPolicyVersion: 'changed' } })).toThrow('frozen differently');
    let knockout = track(openSqliteWbcFinalsKnockoutStore(path, { groups, matches: matchSource }));
    const play = (gameId: string): void => {
      const gameDay = schedule.games.find((game) => game.gameId === gameId)!.gameDay;
      const fixture = registerWbcFinalsFixtureFromWorld({ groups, knockout, schedules, matches },
        { careerId: 'career-1', editionId: edition.editionId, gameId, gameDay });
      expect(registerWbcFinalsFixtureFromWorld({ groups, knockout, schedules, matches },
        { careerId: 'career-1', editionId: edition.editionId, gameId, gameDay })).toEqual(fixture);
      const result = playOfficialNineInningGame(matches, { ...fixture.game,
        seasonId: edition.editionId, ruleProfileVersion: edition.ruleProfileVersion,
        gamePolicyVersion: edition.gamePolicyVersion, binding: fixture.binding });
      expect(result.durableRevision).toBe(60);
      expect(result.lineScore.innings).toHaveLength(9);
    };
    const groupSlots = schedule.games.filter((game) => game.stage === 'GROUP');
    const first = groupSlots[0];
    expect(() => registerWbcFinalsFixtureFromWorld({ groups, knockout, schedules, matches },
      { careerId: 'career-1', editionId: edition.editionId,
        gameId: first.gameId, gameDay: first.gameDay + 1 })).toThrow('accepted schedule');
    expect(matches.getOfficialFixture(first.gameId)).toBeNull();
    groupSlots.slice(0, 35).forEach((game) => play(game.gameId));
    expect(groups.finalize('career-1', edition.editionId)).toBeNull();
    groups.close(); schedules.close(); knockout.close(); matches.close();
    matches = new SqliteOfficialStateStore(matchPath);
    groups = track(openSqliteWbcFinalsGroupStore(path, sources));
    schedules = track(openSqliteWbcFinalsScheduleStore(path, { groups }));
    knockout = track(openSqliteWbcFinalsKnockoutStore(path, { groups, matches: matchSource }));
    expect(groups.readPlan('career-1', edition.editionId)).toEqual(plan);
    expect(schedules.readSchedule('career-1', edition.editionId)).toEqual(schedule);
    play(groupSlots[35].gameId);
    const groupOutcome = groups.finalize('career-1', edition.editionId)!;
    expect(groupOutcome.roundOf16NationIds).toHaveLength(16);
    const knockoutPlan = knockout.initialize({ careerId: 'career-1', edition: knockoutEdition });
    const roundOf16 = schedule.games.filter((game) => game.stage === 'ROUND_OF_16');
    const alternateKnockout = track(openSqliteWbcFinalsKnockoutStore(':memory:',
      { groups, matches: matchSource }));
    alternateKnockout.initialize({ careerId: 'career-1', edition: { ...knockoutEdition,
      knockoutPolicyVersion: 'another-accepted-bracket-version' } });
    expect(() => registerWbcFinalsFixtureFromWorld({ groups, knockout: alternateKnockout, schedules, matches },
      { careerId: 'career-1', editionId: edition.editionId, gameId: roundOf16[0].gameId,
        gameDay: roundOf16[0].gameDay })).toThrow('accepted schedule Edition');
    expect(matches.getOfficialFixture(roundOf16[0].gameId)).toBeNull();
    roundOf16.slice(0, 7).forEach((game) => play(game.gameId));
    expect(knockout.quarterfinalGames('career-1', edition.editionId)).toBeNull();
    const quarterSlot = schedule.games.find((game) => game.stage === 'QUARTERFINAL')!;
    expect(() => registerWbcFinalsFixtureFromWorld({ groups, knockout, schedules, matches },
      { careerId: 'career-1', editionId: edition.editionId, gameId: quarterSlot.gameId,
        gameDay: quarterSlot.gameDay })).toThrow('not yet qualified');
    expect(matches.getOfficialFixture(quarterSlot.gameId)).toBeNull();
    knockout.close();
    knockout = track(openSqliteWbcFinalsKnockoutStore(path, { groups, matches: matchSource }));
    expect(knockout.readPlan('career-1', edition.editionId)).toEqual(knockoutPlan);
    play(roundOf16[7].gameId);
    const quarters = schedule.games.filter((game) => game.stage === 'QUARTERFINAL');
    quarters.slice(0, 3).forEach((game) => play(game.gameId));
    expect(knockout.semifinalGames('career-1', edition.editionId)).toBeNull();
    play(quarters[3].gameId);
    const semis = schedule.games.filter((game) => game.stage === 'SEMIFINAL');
    play(semis[0].gameId);
    expect(knockout.finalGame('career-1', edition.editionId)).toBeNull();
    play(semis[1].gameId);
    const finalSlot = schedule.games.find((game) => game.stage === 'FINAL')!;
    expect(knockout.finalize('career-1', edition.editionId)).toBeNull();
    play(finalSlot.gameId);
    const outcome = knockout.finalize('career-1', edition.editionId)!;
    expect(knockout.finalize('career-1', edition.editionId)).toEqual(outcome);
    const nations = track(openSqliteNationCompetitionRegionStore(path));
    berths.entrantNationIds.forEach((nationId, index) => nations.record({ careerId: 'career-1',
      nationId, region: (['ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'] as const)[index % 4],
      effectiveFromDay: 0, sourceEventId: `region-${index}` }));
    const history = track(openSqliteOfficialWbcHistoryStore(path, { finals: knockout, regions: nations }));
    expect(history.record('career-1', edition.editionId).games).toHaveLength(51);
    const rankings = track(openSqliteWorldNationalRankingHistoryStore(path,
      { regional: { readEvidence: () => null }, wbc: knockout, nations }));
    const rankingHistory = rankings.recordWbc('career-1', edition.editionId);
    expect(rankings.recordWbc('career-1', edition.editionId)).toEqual(rankingHistory);
    const snapshots = track(openSqliteWorldNationalRankingSnapshotStore(path, { history: rankings }));
    const policy = { version: 'wbc-test-ranking-v1', winPoints: 2, tiePoints: 1,
      tierWeights: { REGIONAL: 1, WBC: 3, PREMIER_12: 2 },
      stageWeights: { GROUP: 1, ROUND_OF_16: 2, QUARTERFINAL: 3, SEMIFINAL: 4, BRONZE: 2, FINAL: 5 },
      recencyBands: [{ maxAgeDays: 100, multiplier: 1 }], tieBreak: 'NATION_ID' as const };
    const ranking = snapshots.initialize({ careerId: 'career-1', asOfDay: edition.calendarWindow.endsOnDay,
      nationIds: berths.entrantNationIds, policy,
      registry: registerWorldNationalRankingPolicy(EMPTY_WORLD_NATIONAL_RANKING_POLICY_REGISTRY, policy) });
    expect(ranking.evidenceResultIds).toHaveLength(51);
    const db = new DatabaseSync(path);
    db.prepare("UPDATE world_wbc_finals_schedules SET schedule_json='{}'").run();
    db.close();
    expect(() => schedules.readSchedule('career-1', edition.editionId)).toThrow('corrupt');
  } finally {
    closables.reverse().forEach((store) => store.close());
    rmSync(directory, { recursive: true, force: true });
  }
});
