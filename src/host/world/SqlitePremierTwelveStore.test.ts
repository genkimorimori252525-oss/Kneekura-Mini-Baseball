import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { OfficialGameVenueBinding } from
  '../../core/world/competition/OfficialGameCompletion';
import type { PremierTwelveEdition, PremierTwelveGame } from
  '../../core/world/competition/PremierTwelve';
import type { RegionalNationalEdition } from
  '../../core/world/competition/RegionalNationalGroups';
import { EMPTY_WORLD_NATIONAL_RANKING_POLICY_REGISTRY,
  registerWorldNationalRankingPolicy } from
  '../../core/world/competition/WorldNationalRankingHistory';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { playOfficialNineInningGame } from './OfficialNineInningGame.test-support';
import { registerPremierTwelveFixtureFromWorld } from './PremierTwelveFixtureFromWorld';
import { openSqlitePremierTwelveScheduleStore } from './SqlitePremierTwelveScheduleStore';
import { openSqliteNationalCompetitionDrawStore } from './SqliteNationalCompetitionDrawStore';
import { EMPTY_COMPETITION_DRAW_POLICY_REGISTRY, registerCompetitionDrawPolicy } from
  '../../core/world/competition/CompetitionDraw';
import { openSqliteNationCompetitionRegionStore } from
  './SqliteNationCompetitionRegionStore';
import { openSqliteRegionalNationalGroupStore } from
  './SqliteRegionalNationalGroupStore';
import { openSqliteRegionalNationalKnockoutStore } from
  './SqliteRegionalNationalKnockoutStore';
import { openSqliteWorldNationalRankingHistoryStore } from
  './SqliteWorldNationalRankingHistoryStore';
import { openSqliteWorldNationalRankingSnapshotStore } from
  './SqliteWorldNationalRankingSnapshotStore';
import { openSqliteWorldCompetitionCycleStore } from
  './SqliteWorldCompetitionCycleStore';
import { openSqliteNationalCompetitionSelectionStore } from
  './SqliteNationalCompetitionSelectionStore';
import { worldCycleInput } from './WorldCompetitionCycleFixtures.test-support';
import { openSqlitePremierTwelveGroupStore } from
  './SqlitePremierTwelveGroupStore';
import { openSqlitePremierTwelveFinalFourStore,
  type SqlitePremierTwelveFinalFourStore } from
  './SqlitePremierTwelveFinalFourStore';

const { DatabaseSync }: typeof import('node:sqlite') =
  createRequire(import.meta.url)('node:sqlite');
const nationIds = Array.from({ length: 12 }, (_, index) =>
  `nation-${index}`);
const regionalEdition: RegionalNationalEdition = {
  competitionId: 'national-europe', editionId: 'europe-2033',
  canonicalRole: 'REGIONAL_NATIONAL_CHAMPIONSHIP', region: 'EUROPE',
  formatVersion: 'groups-2-v1', ruleProfileVersion: 'rules-v1',
  gamePolicyVersion: 'games-v1', hostingPolicyVersion: 'hosts-v1',
  qualificationSnapshotId: 'qualification-2033', drawSnapshotId: 'draw-2033',
  tiebreakPolicy: { version: 'ties-v1', tieCreditNumerator: 0,
    tieCreditDenominator: 1, runDifferentialCapPerGame: 5 },
  bestThirdPolicy: { version: 'third-v1', criteria: ['WINS',
    'CAPPED_RUN_DIFFERENTIAL', 'RUNS_AGAINST'], drawSeed: 'third-seed' },
  hostNationIds: ['nation-0'],
  groups: [0, 1].map((groupIndex) => ({ groupIndex,
    nationIds: nationIds.slice(groupIndex * 4, groupIndex * 4 + 4),
    hostNationId: 'nation-0', hostCityId: `city-${groupIndex}`,
    hostVenueId: `venue-${groupIndex}` })),
  calendarWindow: { startsOnDay: 10, endsOnDay: 30 },
};
const policy = { version: 'ranking-v1', winPoints: 2, tiePoints: 1,
  tierWeights: { REGIONAL: 1, WBC: 3, PREMIER_12: 2 },
  stageWeights: { GROUP: 1, ROUND_OF_16: 2, QUARTERFINAL: 3,
    SEMIFINAL: 4, BRONZE: 2, FINAL: 5 },
  recencyBands: [{ maxAgeDays: 2000, multiplier: 1 }],
  tieBreak: 'NATION_ID' as const };
const registry = registerWorldNationalRankingPolicy(
  EMPTY_WORLD_NATIONAL_RANKING_POLICY_REGISTRY, policy);

it('replays regional ranking through all 34 Premier12 games and later rankings', () => {
  const directory = mkdtempSync(join(tmpdir(), 'premier-twelve-'));
  const path = join(directory, 'world.sqlite');
  const closables: { close(): void }[] = [];
  const matchPath = join(directory, 'matches.sqlite');
  let matches = new SqliteOfficialStateStore(matchPath);
  closables.push({ close: () => matches.close() });
  const matchSource = { getMatch: (gameId: string) => matches.getMatch(gameId),
    getOfficialFixture: (gameId: string) => matches.getOfficialFixture(gameId) };
  const track = <T extends { close(): void }>(store: T): T => {
    closables.push(store);
    return store;
  };
  const put = (game: PremierTwelveGame, editionId: string,
    binding?: OfficialGameVenueBinding): void => {
    const fixture = binding ?? matches.registerOfficialFixture({ gameId: game.gameId,
      venueId: game.venueId, fixtureEventId: `fixture-${game.gameId}`, fixtureRevision: 1 });
    const result = playOfficialNineInningGame(matches, { ...game,
      seasonId: editionId, ruleProfileVersion: 'rules-v1', gamePolicyVersion: 'games-v1',
      binding: fixture });
    expect(result.durableRevision).toBe(60);
    expect(result.lineScore.innings).toHaveLength(9);
  };
  try {
    const regions = track(openSqliteNationCompetitionRegionStore(path));
    nationIds.forEach((nationId, index) => regions.record({
      careerId: 'career-1', nationId, region: 'EUROPE',
      effectiveFromDay: 0, sourceEventId: `region-${index}` }));
    const regionalGroups = track(openSqliteRegionalNationalGroupStore(path,
      { regions, matches: matchSource }));
    const regionalPlan = regionalGroups.initialize('career-1', regionalEdition);
    regionalPlan.groups.flatMap((group) => group.games)
      .forEach((game) => put(game, regionalEdition.editionId));
    regionalGroups.finalize('career-1', regionalEdition.editionId);
    const regional = track(openSqliteRegionalNationalKnockoutStore(path,
      { groups: regionalGroups, regions, matches: matchSource }));
    const regionalKnockout = regional.initialize('career-1', {
      competitionId: regionalEdition.competitionId,
      editionId: regionalEdition.editionId, region: 'EUROPE',
      formatVersion: 'groups-2-v1', ruleProfileVersion: 'rules-v1',
      gamePolicyVersion: 'games-v1', qualificationSnapshotId: 'qualification-2033',
      groupDrawSnapshotId: 'draw-2033', knockoutPolicyVersion: 'knockout-v1',
      openingPairs: [[0, 3], [1, 2]],
      openingVenueIds: ['semi-0', 'semi-1'],
      semifinalVenueIds: ['semi-0', 'semi-1'], finalVenueId: 'final-venue',
      placementPolicy: { version: 'placement-v1', criteria: ['GROUP_WINS',
        'GROUP_RUN_DIFFERENTIAL', 'GROUP_RUNS_AGAINST'], drawSeed: 'place-seed' },
    });
    regionalKnockout.openingGames.forEach((game) =>
      put(game, regionalEdition.editionId));
    put(regional.readFinalGame('career-1', regionalEdition.editionId)!,
      regionalEdition.editionId);
    regional.finalize('career-1', regionalEdition.editionId);
    const cycle = track(openSqliteWorldCompetitionCycleStore(path));
    cycle.initialize('career-1', worldCycleInput(0));
    const selections = track(openSqliteNationalCompetitionSelectionStore(path, { cycle }));
    const selection = selections.initialize({ careerId: 'career-1', editionId: 'premier-2034',
      cycleOrdinal: 0, kind: 'PREMIER_12', careerDayOne: '2031-01-01', cutoffDay: 1300 });
    const qualificationDay = selection.qualificationCutoff.day;
    let finalFour: SqlitePremierTwelveFinalFourStore | undefined;
    const history = track(openSqliteWorldNationalRankingHistoryStore(path, {
      regional, wbc: { readEvidence: () => null }, nations: regions,
      premier: { readEvidence: (careerId, editionId) =>
        finalFour?.readEvidence(careerId, editionId) ?? null },
    }));
    history.recordRegional('career-1', regionalEdition.editionId);
    const rankings = track(openSqliteWorldNationalRankingSnapshotStore(path,
      { history }));
    const ranking = rankings.initialize({ careerId: 'career-1',
      asOfDay: qualificationDay, nationIds, policy, registry });
    let drawRegionOverride: 'AFRICA' | undefined;
    let draws = track(openSqliteNationalCompetitionDrawStore(path, { selections, rankings, history,
      nations: { readRegion: (careerId, nationId, beforeDay) => drawRegionOverride
        ?? regions.readRegion(careerId, nationId, beforeDay) } }));
    const drawPolicy = { version: 'premier-test-draw-v1', rematchLookbackDays: 2000,
      relaxationOrder: ['REMATCH_AVOIDANCE', 'SAME_LEAGUE_AVOIDANCE', 'REGIONAL_DIVERSITY'] as const };
    const drawRequest = { careerId: 'career-1', editionId: selection.editionId,
      kind: 'PREMIER_12' as const, drawSeed: 'premier-draw-seed', policy: drawPolicy,
      registry: registerCompetitionDrawPolicy(EMPTY_COMPETITION_DRAW_POLICY_REGISTRY, drawPolicy) };
    const acceptedDraw = draws.initialize(drawRequest);
    expect(draws.initialize(drawRequest)).toEqual(acceptedDraw);
    expect(acceptedDraw.draw.groups.map((group) => group.length)).toEqual([6, 6]);
    expect(acceptedDraw.source.rematchHistory.editions[0].games).toHaveLength(15);
    drawRegionOverride = 'AFRICA';
    expect(() => draws.readDraw('career-1', selection.editionId)).toThrow('corrupt');
    drawRegionOverride = undefined;
    const edition: PremierTwelveEdition = {
      competitionId: 'premier12', editionId: 'premier-2034',
      canonicalRole: 'PREMIER_12', formatVersion: 'premier-v1',
      ruleProfileVersion: 'rules-v1', gamePolicyVersion: 'games-v1',
      rankingPolicyVersion: policy.version,
      qualificationCutoffSnapshotId: selection.qualificationCutoff.snapshotId,
      rankingSnapshotId: ranking.snapshotId, drawSnapshotId: acceptedDraw.drawSnapshotId,
      hostingPolicyVersion: 'premier-hosts-v1',
      tiebreakPolicy: regionalEdition.tiebreakPolicy,
      finalFourPairingPolicy: { version: 'pairs-v1', semifinalPairs: [[0, 3], [1, 2]] },
      hostNationIds: ['nation-0', 'nation-6'],
      groupHosts: [{ groupIndex: 0, nationId: 'nation-0', cityId: 'host-a',
        venueId: 'group-a' }, { groupIndex: 1, nationId: 'nation-6',
        cityId: 'host-b', venueId: 'group-b' }],
      finalFourHost: { nationId: 'nation-0', cityId: 'medal-city',
        venueId: 'medal-venue' },
      groups: acceptedDraw.draw.groups.map((group, groupIndex) => ({ groupIndex,
        nationIds: group.map((entrant) => entrant.teamId) })),
      calendarWindow: selection.calendarWindow,
    };
    let cutoffOverride: typeof selection.qualificationCutoff | undefined;
    const sources = { rankings, selections, draws: {
      readDraw: (careerId: string, editionId: string) => draws.readDraw(careerId, editionId) },
      matches: matchSource,
      editionCutoff: (editionId: string) => cutoffOverride
        ?? selections.authority('career-1').editionCutoff(editionId) };
    const groups = track(openSqlitePremierTwelveGroupStore(path, sources));
    const request = { careerId: 'career-1', edition };
    expect(() => groups.initialize({ ...request, edition: { ...edition,
      groups: edition.groups.map((group, index) => index === 0 ? { ...group,
        nationIds: [group.nationIds[1], group.nationIds[0], ...group.nationIds.slice(2)] } : group) } }))
      .toThrow('accepted draw');
    const earlierRanking = rankings.initialize({ careerId: 'career-1',
      asOfDay: qualificationDay - 1, nationIds, policy, registry });
    cutoffOverride = { ...selection.qualificationCutoff, day: qualificationDay - 1 };
    expect(() => groups.initialize({ ...request, edition: { ...edition,
      rankingSnapshotId: earlierRanking.snapshotId } }))
      .toThrow('accepted World selection');
    cutoffOverride = undefined;
    expect(() => groups.initialize({ ...request, edition: { ...edition,
      calendarWindow: { ...edition.calendarWindow,
        endsOnDay: edition.calendarWindow.endsOnDay + 1 } } }))
      .toThrow('accepted World selection');
    const plan = groups.initialize(request);
    expect(groups.initialize(request)).toEqual(plan);
    expect(groups.readEdition('career-1', edition.editionId)).toEqual(edition);
    finalFour = track(openSqlitePremierTwelveFinalFourStore(path, { groups, matches: matchSource }));
    expect(() => finalFour!.initialize('career-1', edition.editionId))
      .toThrow('finalized groups');
    let activeGroups = groups;
    const schedulePolicy = { version: 'premier-test-schedule-v1',
      gamesPerVenuePerDay: 3, minimumOffDaysBetweenRounds: 0 };
    let scheduleGroupSource = activeGroups;
    const scheduleSources = { groups: {
      readEdition: (careerId: string, editionId: string) =>
        scheduleGroupSource.readEdition(careerId, editionId),
      readPlan: (careerId: string, editionId: string) =>
        scheduleGroupSource.readPlan(careerId, editionId),
    } };
    let schedules = track(openSqlitePremierTwelveScheduleStore(path, scheduleSources));
    const scheduleRequest = { careerId: 'career-1', editionId: edition.editionId,
      policy: schedulePolicy };
    const schedule = schedules.initialize(scheduleRequest);
    expect(schedules.initialize(scheduleRequest)).toEqual(schedule);
    expect(schedule.games).toHaveLength(34);
    const alternateGroups = track(openSqlitePremierTwelveGroupStore(':memory:', { ...sources, draws: undefined }));
    alternateGroups.initialize({ ...request, edition: { ...edition,
      drawSnapshotId: 'different-accepted-draw', hostingPolicyVersion: 'different-host-version',
      groups: edition.groups.map((group, index) => index === 0 ? { ...group,
        nationIds: [group.nationIds[1], group.nationIds[0], ...group.nationIds.slice(2)] } : group) } });
    scheduleGroupSource = alternateGroups;
    expect(() => schedules.readSchedule('career-1', edition.editionId)).toThrow('corrupt');
    scheduleGroupSource = activeGroups;
    expect(() => schedules.initialize({ ...scheduleRequest,
      policy: { ...schedulePolicy, gamesPerVenuePerDay: 2 } })).toThrow('frozen differently');
    const fixtureDay = (gameId: string): number => schedule.games
      .find((game) => game.gameId === gameId)!.gameDay;
    const putPremier = (game: PremierTwelveGame): void => {
      const fixture = registerPremierTwelveFixtureFromWorld({ groups: activeGroups,
        finalFour: finalFour!, schedules, matches }, { careerId: 'career-1', editionId: edition.editionId,
        gameId: game.gameId, gameDay: fixtureDay(game.gameId) });
      expect(registerPremierTwelveFixtureFromWorld({ groups: activeGroups,
        finalFour: finalFour!, schedules, matches }, { careerId: 'career-1', editionId: edition.editionId,
        gameId: game.gameId, gameDay: fixtureDay(game.gameId) })).toEqual(fixture);
      put(game, edition.editionId, fixture.binding);
    };
    const plannedGames = plan.groups.flatMap((group) => group.games);
    const games = schedule.games.filter((slot) => slot.stage === 'GROUP')
      .map((slot) => plannedGames.find((game) => game.gameId === slot.gameId)!);
    expect(() => registerPremierTwelveFixtureFromWorld({ groups: activeGroups,
      finalFour: finalFour!, schedules, matches }, { careerId: 'career-1', editionId: edition.editionId,
      gameId: games[0].gameId, gameDay: edition.calendarWindow.endsOnDay + 1 }))
      .toThrow('accepted Edition');
    expect(matches.getOfficialFixture(games[0].gameId)).toBeNull();
    expect(() => registerPremierTwelveFixtureFromWorld({ groups: activeGroups,
      finalFour: finalFour!, schedules, matches }, { careerId: 'career-1', editionId: edition.editionId,
      gameId: games[0].gameId, gameDay: fixtureDay(games[0].gameId) + 1 }))
      .toThrow('accepted schedule');
    expect(matches.getOfficialFixture(games[0].gameId)).toBeNull();
    expect(() => registerPremierTwelveFixtureFromWorld({ groups: activeGroups,
      finalFour: finalFour!, schedules, matches }, { careerId: 'career-1', editionId: edition.editionId,
      gameId: 'not-planned', gameDay: edition.calendarWindow.startsOnDay }))
      .toThrow('not yet qualified');
    games.slice(0, 29).forEach(putPremier);
    expect(groups.finalize('career-1', edition.editionId)).toBeNull();
    groups.close();
    matches.close();
    matches = new SqliteOfficialStateStore(matchPath);
    activeGroups = track(openSqlitePremierTwelveGroupStore(path, sources));
    draws.close();
    draws = track(openSqliteNationalCompetitionDrawStore(path, { selections, rankings, history,
      nations: regions }));
    expect(draws.readDraw('career-1', selection.editionId)).toEqual(acceptedDraw);
    expect(activeGroups.readPlan('career-1', edition.editionId)).toEqual(plan);
    schedules.close();
    schedules = track(openSqlitePremierTwelveScheduleStore(path, { groups: activeGroups }));
    expect(schedules.readSchedule('career-1', edition.editionId)).toEqual(schedule);
    const lastFixture = registerPremierTwelveFixtureFromWorld({ groups: activeGroups,
      finalFour: finalFour!, schedules, matches }, { careerId: 'career-1', editionId: edition.editionId,
      gameId: games[29].gameId, gameDay: fixtureDay(games[29].gameId) });
    put(games[29], edition.editionId, lastFixture.binding);
    const groupOutcome = activeGroups.finalize('career-1', edition.editionId)!;
    expect(groupOutcome.resultApplicationIds).toHaveLength(30);
    finalFour.close();
    finalFour = track(openSqlitePremierTwelveFinalFourStore(path,
      { groups: activeGroups, matches: matchSource }));
    const medalPlan = finalFour.initialize('career-1', edition.editionId);
    expect(() => registerPremierTwelveFixtureFromWorld({ groups: activeGroups,
      finalFour: finalFour!, schedules, matches }, { careerId: 'career-1', editionId: edition.editionId,
      gameId: medalPlan.finalGameId, gameDay: fixtureDay(medalPlan.finalGameId) }))
      .toThrow('not yet qualified');
    expect(matches.getOfficialFixture(medalPlan.finalGameId)).toBeNull();
    putPremier(medalPlan.semifinalGames[0]);
    expect(() => registerPremierTwelveFixtureFromWorld({ groups: activeGroups,
      finalFour: finalFour!, schedules, matches }, { careerId: 'career-1', editionId: edition.editionId,
      gameId: medalPlan.semifinalGames[0].gameId,
      gameDay: fixtureDay(medalPlan.semifinalGames[0].gameId) + 1 }))
      .toThrow('accepted schedule');
    expect(finalFour.medalGames('career-1', edition.editionId)).toBeNull();
    finalFour.close();
    finalFour = track(openSqlitePremierTwelveFinalFourStore(path,
      { groups: activeGroups, matches: matchSource }));
    expect(finalFour.readPlan('career-1', edition.editionId)).toEqual(medalPlan);
    putPremier(medalPlan.semifinalGames[1]);
    const medals = finalFour.medalGames('career-1', edition.editionId)!;
    putPremier(medals.finalGame);
    expect(finalFour.finalize('career-1', edition.editionId)).toBeNull();
    putPremier(medals.bronzeGame);
    const outcome = finalFour.finalize('career-1', edition.editionId)!;
    expect(outcome.championNationId).toBe(medals.finalGame.homeNationId);
    expect(outcome.bronzeNationId).toBe(medals.bronzeGame.homeNationId);
    const rankedHistory = history.recordPremier('career-1', edition.editionId);
    expect(rankedHistory.editions[1].tier).toBe('PREMIER_12');
    expect(rankedHistory.editions[1].games).toHaveLength(34);
    expect(history.recordPremier('career-1', edition.editionId)).toEqual(rankedHistory);
    expect(rankings.readRanking('career-1', qualificationDay)).toEqual(ranking);
    const laterRanking = rankings.initialize({ careerId: 'career-1',
      asOfDay: edition.calendarWindow.endsOnDay, nationIds, policy, registry });
    expect(laterRanking.evidenceResultIds).toHaveLength(49);
    expect(history.readHistory('career-1')).toEqual(rankedHistory);
    finalFour.close();
    finalFour = track(openSqlitePremierTwelveFinalFourStore(path,
      { groups: activeGroups, matches: matchSource }));
    expect(finalFour.readOutcome('career-1', edition.editionId)).toEqual(outcome);
    expect(() => activeGroups.initialize({ ...request,
      edition: { ...edition, drawSnapshotId: 'changed' } })).toThrow('frozen differently');
    cutoffOverride = { ...selection.qualificationCutoff, day: qualificationDay - 1 };
    expect(() => finalFour!.readOutcome('career-1', edition.editionId)).toThrow('corrupt');
    cutoffOverride = { ...selection.qualificationCutoff, day: edition.calendarWindow.endsOnDay };
    expect(() => activeGroups.readPlan('career-1', edition.editionId))
      .toThrow('corrupt');
    cutoffOverride = undefined;
    const binding = matches.getOfficialFixture(medals.finalGame.gameId)!;
    const matchDb = new DatabaseSync(matchPath);
    matchDb.prepare('UPDATE official_fixtures SET venue_id=? WHERE game_id=?')
      .run('wrong', medals.finalGame.gameId);
    expect(() => history.readHistory('career-1')).toThrow('corrupt');
    expect(rankings.readRanking('career-1', qualificationDay)).toEqual(ranking);
    matchDb.prepare('UPDATE official_fixtures SET venue_id=? WHERE game_id=?')
      .run(binding.venueId, medals.finalGame.gameId);
    matchDb.close();
    const db = new DatabaseSync(path);
    const savedSchedule = db.prepare('SELECT schedule_json FROM world_premier_twelve_schedules')
      .get() as { schedule_json: string };
    db.prepare("UPDATE world_premier_twelve_schedules SET schedule_json='{}'").run();
    expect(() => schedules.readSchedule('career-1', edition.editionId)).toThrow('corrupt');
    db.prepare('UPDATE world_premier_twelve_schedules SET schedule_json=?')
      .run(savedSchedule.schedule_json);
    db.prepare("UPDATE world_premier_twelve_final_four SET outcome_json='{}'").run();
    db.close();
    expect(() => finalFour!.readOutcome('career-1', edition.editionId)).toThrow('corrupt');
  } finally {
    closables.reverse().forEach((store) => store.close());
    rmSync(directory, { recursive: true, force: true });
  }
});
